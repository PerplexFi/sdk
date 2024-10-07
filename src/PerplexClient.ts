import { createDataItemSigner, dryrun, message } from '@permaweb/aoconnect';
import { z } from 'zod';

import { lookForMessage, makeArweaveTxTags } from './AoMessage';
import { Pool, PoolReserves, Swap, SwapParams, SwapParamsSchema, Token } from './types';
import { fetchAllPools, fetchAllTokens } from './utils/perplexApi';
import { getPoolOppositeToken } from './utils/pool';

const PerplexClientConfigSchema = z.object({
    apiUrl: z.string().url(),
    amm: z.object({
        reservesCacheTTL: z.number(), // In milliseconds
    }),
    // perp: z.object({
    //     // add configs
    // }),
});
type PerplexClientConfig = z.infer<typeof PerplexClientConfigSchema>;

export class PerplexClient {
    readonly config: PerplexClientConfig;
    #cachedTokens: Map<string, Token>;
    #cachedTokensByTicker: Map<string, string>;
    #cachedPools: Map<string, Pool>;
    #cachedPoolsByTicker: Map<string, string>;
    #poolReserves: Map<string, PoolReserves>;
    #poolReservesLastFetchedAt: Map<string, Date>;

    constructor(config: PerplexClientConfig) {
        this.config = PerplexClientConfigSchema.parse(config);

        this.#cachedTokens = new Map();
        this.#cachedTokensByTicker = new Map();
        this.#cachedPools = new Map();
        this.#cachedPoolsByTicker = new Map();
        this.#poolReserves = new Map();
        this.#poolReservesLastFetchedAt = new Map();
    }

    async initialize(): Promise<void> {
        const tokens = await fetchAllTokens(this.config.apiUrl);
        tokens.forEach((token) => {
            this.#cachedTokens.set(token.id, token);
            this.#cachedTokensByTicker.set(token.ticker, token.id);
        });

        const pools = await fetchAllPools(this.config.apiUrl);
        pools.forEach((pool) => {
            this.#cachedPools.set(pool.id, pool);
            this.#cachedPoolsByTicker.set(`${pool.tokenBase.ticker}/${pool.tokenQuote.ticker}`, pool.id);
        });
    }

    async swap(params: SwapParams, signer: ReturnType<typeof createDataItemSigner>): Promise<Swap> {
        const { pool, quantity, token, minExpectedOutput } = SwapParamsSchema.parse(params);

        // 1. Check quantityIn.token is one of the pool's token
        if (token.id !== pool.tokenBase.id && token.id !== pool.tokenQuote.id) {
            throw new Error("token must be one of pool's tokens");
        }

        const transferId = await message({
            signer,
            process: token.id,
            tags: makeArweaveTxTags({
                Action: 'Transfer',
                Quantity: quantity,
                Recipient: pool.id,
                'X-Operation-Type': 'Swap',
                'X-Minimum-Expected-Output': minExpectedOutput,
            }),
        });

        // TODO: Check Initial transfer did not fail (due to insufficient amount in wallet?)

        // 2. Poll gateway to find the resulting message
        const confirmationMessage = await lookForMessage({
            tagsFilter: [
                {
                    name: 'Action',
                    values: ['Transfer'],
                },
                {
                    name: 'From-Process',
                    values: [pool.id],
                },
                {
                    name: 'Pushed-For',
                    values: [transferId],
                },
            ],
            isMessageValid: (msg) => !!msg, // Message just has to exist to be valid
            pollArgs: {
                maxRetries: 40,
                retryAfterMs: 500, // 40*500ms = 20s
            },
        });

        // 3. If message no message is found, consider the swap has failed
        if (!confirmationMessage) {
            throw new Error('Swap has failed');
        }

        if (confirmationMessage.to === token.id) {
            // Can happen if the slippage was too big. Confirm by querying aoconnect's `result` and check the Output/Messages?
            throw new Error(`Swap has failed. More infos: https://ao.link/#/message/${transferId}`);
        }

        return {
            id: transferId,
            quantityIn: quantity,
            tokenIn: token,
            quantityOut: BigInt(confirmationMessage.tags['Quantity']),
            tokenOut: getPoolOppositeToken(pool, token),
            fees: BigInt(confirmationMessage.tags['X-Fees']),
            price: Number(confirmationMessage.tags['X-Price']),
        };
    }

    async updatePoolReserves(pool: Pool): Promise<PoolReserves> {
        const cached = this.#poolReserves.get(pool.id);
        const lastFetchedAt = this.#poolReservesLastFetchedAt.get(pool.id);
        if (cached && lastFetchedAt && lastFetchedAt.getTime() + this.config.amm.reservesCacheTTL > Date.now()) {
            return cached;
        }

        const dryrunRes = await dryrun({
            process: pool.id,
            tags: makeArweaveTxTags({
                Action: 'Reserves',
            }),
        });

        const outputMessage = dryrunRes.Messages.at(0);
        if (outputMessage) {
            const reservesJSON = JSON.parse(outputMessage.Data);
            const reserves = {
                [pool.tokenBase.id]: BigInt(reservesJSON[pool.tokenBase.id]),
                [pool.tokenQuote.id]: BigInt(reservesJSON[pool.tokenQuote.id]),
            };
            this.#poolReserves.set(pool.id, reserves);
            this.#poolReservesLastFetchedAt.set(pool.id, new Date());

            return reserves;
        } else {
            // Can happen if process is not responding
            throw new Error(`Failed to update reserves for ${pool.id}`);
        }
    }

    getSwapExpectedOutput(pool: Pool, quantity: bigint, token: Token, slippageTolerance: number): bigint {
        if (token.id !== pool.tokenBase.id && token.id !== pool.tokenQuote.id) {
            throw new Error('Input.token is invalid, must be one of Pool.tokenBase or Pool.tokenQuote');
        }

        if (slippageTolerance < 0 || slippageTolerance > 1) {
            throw new Error('slippageTolerance must be between 0 and 1');
        }

        const reserves = this.#poolReserves.get(pool.id);
        // TODO: Make sure reserves are the most up to date possible?
        if (!reserves) {
            throw new Error('Reserves not fetched yet');
        }

        const outputToken = getPoolOppositeToken(pool, token);
        const inputReserve = reserves[token.id];
        const outputReserve = reserves[outputToken.id];
        if (!inputReserve || !outputReserve) {
            // Should never occur
            throw new Error('An error occured while getting the reserves');
        }

        const k = inputReserve * outputReserve;

        // Calculate the new output reserve after the trade
        const newOutputReserve = k / (inputReserve + quantity);

        // Calculate the output quantity (before fee)
        const outputQuantity = outputReserve - newOutputReserve;

        // Apply the fee rate
        const outputAfterFee = (outputQuantity * (10_000n - BigInt(Math.round(pool.feeRate * 10_000)))) / 10_000n;

        // Apply slippage tolerance (converted to bigint)
        return (outputAfterFee * (10_000n - BigInt(Math.round(slippageTolerance * 10_000)))) / 10_000n;
    }

    // async placePerpOrder(
    //     params: PlacePerpOrderParams,
    //     signer: ReturnType<typeof createDataItemSigner>,
    // ): Promise<PerpOrder> {
    //     //
    // }

    getTokenById(tokenId: string): Token {
        const cachedToken = this.#cachedTokens.get(tokenId);
        if (cachedToken) {
            return cachedToken;
        }

        // If nothing is found, throw an error
        throw new Error('Token not found');
    }

    getToken(tokenTicker: string): Token {
        const tokenId = this.#cachedTokensByTicker.get(tokenTicker);
        const cachedToken = tokenId ? this.#cachedTokens.get(tokenId) : undefined;
        if (cachedToken) {
            return cachedToken;
        }

        // If nothing is found, throw an error
        throw new Error('Token not found');
    }

    getPoolById(poolId: string): Pool {
        const cachedPool = this.#cachedPools.get(poolId);
        if (cachedPool) {
            return cachedPool;
        }

        // If nothing is found, throw an error
        throw new Error('Pool not found');
    }

    getPool(poolTicker: string): Pool {
        const poolId = this.#cachedPoolsByTicker.get(poolTicker);
        const cachedPool = poolId ? this.#cachedPools.get(poolId) : undefined;
        if (cachedPool) {
            return cachedPool;
        }

        // If nothing is found, throw an error
        throw new Error('Pool not found');
    }
}
