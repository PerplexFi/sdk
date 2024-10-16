import { createDataItemSigner, dryrun, message, result } from '@permaweb/aoconnect';
import { z } from 'zod';

import { AoConnectMessage, lookForMessage, makeArweaveTxTags } from './AoMessage';
import { PerplexCache, PerplexCacheColdData } from './Cache';
import {
    CancelOrderParams,
    CancelOrderParamsSchema,
    DepositCollateralParams,
    DepositCollateralParamsSchema,
    OrderBook,
    PerpOrder,
    PerpOrderSchema,
    PerpPosition,
    PerpPositionSchema,
    PlacePerpOrderParams,
    PlacePerpOrderParamsSchema,
    PoolReserves,
    Result,
    Swap,
    SwapMinOutputParams,
    SwapMinOutputParamsSchema,
    SwapParams,
    SwapParamsSchema,
} from './types';
import { bigIntToDecimal } from './utils/numbers';
import { OrderBookDataSchema } from './utils/orderbook';
import { fetchAllPositions, fetchLatestFundingRate, fetchOrderBook } from './utils/perplexApi';
import { getPoolOppositeToken } from './utils/pool';
import { OrderSide, OrderStatus, OrderType, ZodArweaveId } from './utils/zod';

const DEFAULT_TTL = 1000 * 60 * 10; // 10 minutes

const PerplexClientConfigSchema = z.object({
    apiUrl: z.string().url(),
    gatewayUrl: z.string().url(),
    walletAddress: ZodArweaveId,
    amm: z
        .object({
            reservesCacheTTL: z.number(), // In milliseconds
        })
        .default({ reservesCacheTTL: DEFAULT_TTL }),
    token: z
        .object({
            balanceCacheTTL: z.number(), // In milliseconds
        })
        .default({ balanceCacheTTL: DEFAULT_TTL }),
    // perp: z.object({
    // }),
});
type PerplexClientConfig = z.infer<typeof PerplexClientConfigSchema>;

export class PerplexClient {
    public readonly config: PerplexClientConfig;
    public readonly signer: ReturnType<typeof createDataItemSigner>;
    public cache: PerplexCache;

    constructor(config: z.input<typeof PerplexClientConfigSchema>, signer: ReturnType<typeof createDataItemSigner>) {
        this.config = PerplexClientConfigSchema.parse(config);
        this.signer = signer;

        this.cache = new PerplexCache();
    }

    public static async getColdCache(apiUrl: string): Promise<PerplexCacheColdData> {
        const cache = new PerplexCache();

        await Promise.all([cache.fetchTokensInfos(apiUrl), cache.fetchPoolsInfos(apiUrl)]);

        return cache.serialize();
    }

    public setCache(jsonData: unknown): void {
        this.cache = new PerplexCache(jsonData);
    }

    public async initializeCache(type?: ('amm' | 'spot' | 'perp')[]): Promise<void> {
        const types = new Set(type ?? ['amm', 'spot', 'perp']);

        for (const cacheType of types.values()) {
            if (cacheType === 'amm') {
                await this.cache.fetchTokensInfos(this.config.apiUrl);
                await this.cache.fetchPoolsInfos(this.config.apiUrl);
            } else if (cacheType === 'spot') {
                // TODO
            } else if (cacheType === 'perp') {
                // TODO
            }
        }
    }

    public async getLatestFundingRate(marketId: string): Promise<Result<number>> {
        const latestFundingRate = await fetchLatestFundingRate(this.config.apiUrl, marketId);

        if (!latestFundingRate) {
            return {
                ok: false,
                error: 'Latest funding rate not found',
            };
        }

        return {
            ok: true,
            data: Number(latestFundingRate),
        };
    }

    public async swap(params: SwapParams): Promise<Result<Swap>> {
        const swapParams = SwapParamsSchema.safeParse(params);
        if (!swapParams.success) {
            return {
                ok: false,
                error: `${swapParams.error}`,
            };
        }

        const { poolId, quantity, tokenId, minOutput } = swapParams.data;

        const pool = this.cache.getPool(poolId);
        if (!pool) {
            return {
                ok: false,
                error: 'Pool not found',
            };
        }

        const token = {
            [pool.tokenBase.id]: pool.tokenBase,
            [pool.tokenQuote.id]: pool.tokenQuote,
        }[tokenId];
        if (!token) {
            return {
                ok: false,
                error: 'Token not found',
            };
        }

        const transferId = await message({
            signer: this.signer,
            process: token.id,
            tags: makeArweaveTxTags({
                Action: 'Transfer',
                Quantity: quantity,
                Recipient: pool.id,
                'X-Operation-Type': 'Swap',
                'X-Minimum-Expected-Output': minOutput,
            }),
        });

        const transferOutput = await result({
            message: transferId,
            process: token.id,
        });
        const poolCreditNotice = (transferOutput.Messages as AoConnectMessage[]).find((msg) => {
            const target = msg.Target;
            const action = msg.Tags.find((tag) => tag.name === 'Action');

            return target === pool.id && action?.value === 'Credit-Notice';
        });
        if (!poolCreditNotice) {
            return {
                ok: false,
                error: `Initial Transfer has failed, more infos: https://ao.link/#/message/${transferId}`,
            };
        }

        // 2. Poll gateway to find the resulting message
        const confirmationMessage = await lookForMessage({
            tagsFilter: [
                ['Pushed-For', [transferId]],
                ['From-Process', [pool.id]],
                ['Action', ['Transfer']],
            ],
            isMessageValid: (msg) => !!msg, // Message just has to exist to be valid
            pollArgs: {
                gatewayUrl: this.config.gatewayUrl,
                maxRetries: 40,
                retryAfterMs: 500, // 40*500ms = 20s
            },
        });

        // 3. If message no message is found, consider the swap has failed
        if (!confirmationMessage || confirmationMessage.to === token.id) {
            return {
                ok: false,
                error: `Swap has failed, more infos: https://ao.link/#/message/${transferId}`,
            };
        }

        // TODO: Update cache.reserves with quantityIn/quantityOut?

        return {
            ok: true,
            data: {
                id: transferId,
                quantityIn: quantity,
                tokenIn: token,
                quantityOut: BigInt(confirmationMessage.tags['Quantity']),
                tokenOut: getPoolOppositeToken(pool, token),
                fees: BigInt(confirmationMessage.tags['X-Fees']),
                price: Number(confirmationMessage.tags['X-Price']),
            },
        };
    }

    async updatePoolReserves(poolId: string): Promise<Result<PoolReserves>> {
        const pool = this.cache.getPool(poolId);
        if (!pool) {
            return {
                ok: false,
                error: 'Pool not found',
            };
        }

        const cached = this.cache.getPoolReserves(pool.id);
        const lastFetchedAt = this.cache.getPoolReservesLastFetchedAt(pool.id);
        if (cached && lastFetchedAt && lastFetchedAt.getTime() + this.config.amm.reservesCacheTTL > Date.now()) {
            return {
                ok: true,
                data: cached,
            };
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
            this.cache.setPoolReserves(pool.id, reserves);

            return {
                ok: true,
                data: reserves,
            };
        } else {
            // Can happen if process is not responding
            return {
                ok: false,
                error: 'Process is not responding',
            };
        }
    }

    async updateAllPoolReserves(): Promise<Map<string, Result<PoolReserves>>> {
        const pools = this.cache.getPools();

        return new Map(
            await Promise.all(
                pools.map(
                    async (pool): Promise<[string, Result<PoolReserves>]> => [
                        pool.id,
                        await this.updatePoolReserves(pool.id),
                    ],
                ),
            ),
        );
    }

    async updateTokenBalance(tokenId: string): Promise<Result<bigint>> {
        const token = this.cache.getToken(tokenId);
        if (!token) {
            return {
                ok: false,
                error: 'Token not found',
            };
        }

        const cached = this.cache.getTokenBalance(token.id);
        const lastFetchedAt = this.cache.getTokenBalanceLastFetchedAt(token.id);
        if (cached && lastFetchedAt && lastFetchedAt.getTime() + this.config.token.balanceCacheTTL > Date.now()) {
            return {
                ok: true,
                data: cached,
            };
        }

        const dryrunRes = await dryrun({
            process: token.id,
            tags: makeArweaveTxTags({
                Action: 'Balance',
                Target: this.config.walletAddress,
            }),
        });

        const outputMessage = (dryrunRes.Messages as AoConnectMessage[]).at(0);
        if (outputMessage) {
            const balance = BigInt(outputMessage.Tags.find((tag) => tag.name === 'Balance')?.value ?? '0');
            this.cache.setTokenBalance(token.id, balance);

            return {
                ok: true,
                data: balance,
            };
        } else {
            // Can happen if process is not responding
            return {
                ok: false,
                error: 'Process is not responding',
            };
        }
    }

    async updateAllTokenBalances(): Promise<Map<string, Result<bigint>>> {
        const tokens = this.cache.getTokens();

        return new Map(
            await Promise.all(
                tokens.map(
                    async (token): Promise<[string, Result<bigint>]> => [
                        token.id,
                        await this.updateTokenBalance(token.id),
                    ],
                ),
            ),
        );
    }

    getSwapMinOutput(params: SwapMinOutputParams): Result<bigint> {
        const swapMinOutputParams = SwapMinOutputParamsSchema.safeParse(params);

        if (!swapMinOutputParams.success) {
            return {
                ok: false,
                error: `${swapMinOutputParams.error}`,
            };
        }

        const { poolId, tokenId, quantity, slippageTolerance } = swapMinOutputParams.data;

        const pool = this.cache.getPool(poolId);
        if (!pool) {
            return {
                ok: false,
                error: 'Pool not found',
            };
        }

        const token = {
            [pool.tokenBase.id]: pool.tokenBase,
            [pool.tokenQuote.id]: pool.tokenQuote,
        }[tokenId];
        if (!token) {
            return {
                ok: false,
                error: 'Token not found',
            };
        }

        const reserves = this.cache.getPoolReserves(pool.id);
        if (!reserves) {
            return {
                ok: false,
                error: 'Missing pool reserves',
            };
        }

        const outputToken = getPoolOppositeToken(pool, token);
        const inputReserve = reserves[token.id];
        const outputReserve = reserves[outputToken.id];
        if (!inputReserve || !outputReserve) {
            return {
                ok: false,
                error: 'SHOULD NEVER HAPPEN: Missing inputReserve or outputReserve',
            };
        }

        const k = inputReserve * outputReserve;

        // Calculate the new output reserve after the trade
        const newOutputReserve = k / (inputReserve + quantity);

        // Calculate the output quantity (before fee)
        const outputQuantity = outputReserve - newOutputReserve;

        // Apply the fee rate
        const outputAfterFee = (outputQuantity * (10_000n - BigInt(Math.round(pool.feeRate * 10_000)))) / 10_000n;

        // Apply slippage tolerance (converted to bigint)
        return {
            ok: true,
            data: (outputAfterFee * (10_000n - BigInt(Math.round(slippageTolerance * 10_000)))) / 10_000n,
        };
    }

    async getPerpPrices(marketId: string): Promise<Result<{ oracle: bigint; bestBid: bigint; bestAsk: bigint }>> {
        const perpMarket = this.cache.getPerpMarket(marketId);
        if (!perpMarket) {
            return {
                ok: false,
                error: 'Market not found',
            };
        }

        const orderBookRes = await dryrun({
            process: marketId,
            tags: makeArweaveTxTags({
                Action: 'Get-Order-Book',
            }),
        });

        const orderBook = OrderBookDataSchema.safeParse(
            JSON.parse(
                (orderBookRes.Messages as AoConnectMessage[]).find((msg) =>
                    msg.Tags.some(({ name, value }) => name === 'Action' && value === 'Get-Order-Book-Response'),
                )?.Data ?? '{}',
            ),
        );

        if (!orderBook.success) {
            return {
                ok: false,
                error: 'SHOULD NEVER HAPPEN: Get-Order-Book-Response parsing failed',
            };
        }

        return {
            ok: true,
            data: {
                oracle: perpMarket.oraclePrice,
                bestBid: orderBook.data.Bids.reduce((bestBid, bid) => (bid.price < bestBid.price ? bestBid : bid))
                    .price,
                bestAsk: orderBook.data.Asks.reduce((bestAsk, ask) => (ask.price > bestAsk.price ? bestAsk : ask))
                    .price,
            },
        };
    }

    async placePerpOrder(params: PlacePerpOrderParams): Promise<Result<PerpOrder>> {
        // TODO: Update to `safeParse` so that it does not throw an error.
        const parsedParams = PlacePerpOrderParamsSchema.parse(params);
        const { marketId, type, side, size, reduceOnly } = parsedParams;

        const market = this.cache.getPerpMarket(marketId);
        if (!market) {
            return {
                ok: false,
                error: 'Market not found',
            };
        }

        if (size % market.minQuantityTickSize !== 0n) {
            return {
                ok: false,
                error: `Invalid orderSize, must be a multiple of ${bigIntToDecimal(market.minQuantityTickSize, market.baseDenomination)}`,
            };
        }

        let transferId: string;
        if (type === OrderType.MARKET) {
            transferId = await message({
                signer: this.signer,
                process: market.accountId,
                tags: makeArweaveTxTags({
                    Action: 'Place-Order',
                    Quantity: '0',
                    Recipient: market.id,
                    'X-Order-Type': type,
                    'X-Order-Side': side,
                    'X-Order-Size': size,
                    'X-Reduce-Only': reduceOnly,
                }),
            });
        } else {
            if (parsedParams.price % market.minPriceTickSize !== 0n) {
                return {
                    ok: false,
                    error: `Invalid orderPrice, must be a multiple of ${bigIntToDecimal(market.minPriceTickSize, market.baseDenomination)}`,
                };
            }

            transferId = await message({
                signer: this.signer,
                process: market.accountId,
                tags: makeArweaveTxTags({
                    Action: 'Place-Order',
                    Quantity: '0',
                    Recipient: market.id,
                    'X-Order-Type': type,
                    'X-Order-Side': side,
                    'X-Order-Size': size,
                    'X-Order-Price': parsedParams.price,
                    'X-Reduce-Only': reduceOnly,
                }),
            });
        }

        const takerOrderMsg = await lookForMessage({
            tagsFilter: [
                ['X-Order-Id', [transferId]],
                ['X-Is-Taker', [true]],
                ['From-Process', [market.id]],
            ],
            isMessageValid: (msg) => !!msg,
            pollArgs: {
                gatewayUrl: this.config.gatewayUrl,
                maxRetries: 40,
                retryAfterMs: 500, // 40*500ms = 20s
            },
        });

        if (!takerOrderMsg) {
            return {
                ok: false,
                error: `Place-Order has failed. More infos: https://ao.link/#/message/${transferId}`,
            };
        }

        const order = PerpOrderSchema.safeParse({
            id: transferId,
            type: takerOrderMsg.tags['X-Order-Type'],
            status: takerOrderMsg.tags['X-Order-Status'],
            side: takerOrderMsg.tags['X-Order-Side'],
            originalQuantity: BigInt(takerOrderMsg.tags['X-Original-Quantity']),
            executedQuantity: BigInt(takerOrderMsg.tags['X-Executed-Quantity']),
            initialPrice: BigInt(takerOrderMsg.tags['X-Order-Price']),
            executedValue: BigInt(takerOrderMsg.tags['X-Executed-Value']),
        });

        if (!order.success) {
            return {
                ok: false,
                error: 'SHOULD NEVER HAPPEN: Missing tags in message to create Order object',
            };
        }

        return {
            ok: true,
            data: order.data,
        };
    }

    async cancelOrder(params: CancelOrderParams): Promise<Result<PerpOrder>> {
        const { marketId, orderId } = CancelOrderParamsSchema.parse(params);

        const market = this.cache.getPerpMarket(marketId);
        if (!market) {
            return {
                ok: false,
                error: 'Market not found',
            };
        }

        const messageId = await message({
            signer: this.signer,
            process: market.id,
            tags: makeArweaveTxTags({
                Action: 'Cancel-Order',
                'Order-Id': orderId,
            }),
        });

        const res = await result({
            message: messageId,
            process: market.id,
        });

        const orderMessage = (res.Messages as AoConnectMessage[]).find((msg) =>
            msg.Tags.some((tag) => tag.name === 'X-Order-Status' && tag.value === 'Canceled'),
        );
        if (!orderMessage) {
            // TODO: Handle error
            //       eg. Cancel an order that's not yours / Cancel an ID that does not exist (forward X-Error?)
            return {
                ok: false,
                error: 'Failed to cancel order',
            };
        }

        const tags = Object.fromEntries(orderMessage.Tags.map(({ name, value }) => [name, value]));

        const order = PerpOrderSchema.safeParse({
            id: tags['X-Order-Id'],
            type: tags['X-Order-Type'] as OrderType,
            status: tags['X-Order-Status'] as OrderStatus,
            side: tags['X-Order-Side'] as OrderSide,
            originalQuantity: BigInt(tags['X-Original-Quantity']),
            executedQuantity: BigInt(tags['X-Executed-Quantity']),
            initialPrice: BigInt(tags['X-Order-Price']),
            executedValue: BigInt(tags['X-Executed-Value']),
        });

        if (!order.success) {
            return {
                ok: false,
                error: 'SHOULD NEVER HAPPEN: Missing tags in message to create Order object',
            };
        }

        return {
            ok: true,
            data: order.data,
        };
    }

    async depositCollateral(params: DepositCollateralParams): Promise<Result<bigint>> {
        const { accountId, token, quantity } = DepositCollateralParamsSchema.parse(params);

        const transferId = await message({
            signer: this.signer,
            process: token.id,
            tags: makeArweaveTxTags({
                Action: 'Transfer',
                Quantity: quantity,
                Recipient: accountId,
            }),
        });

        const confirmationMessage = await lookForMessage({
            tagsFilter: [['Pushed-For', [transferId]]],
            isMessageValid: (msg) =>
                msg.tags['Action'] === 'Collateral-Added' ||
                (msg.tags['Action'] === 'Transfer' && !!msg.tags['X-Error']),
            pollArgs: {
                gatewayUrl: this.config.gatewayUrl,
                maxRetries: 40,
                retryAfterMs: 500, // 40*500ms = 20s
            },
        });

        if (!confirmationMessage || confirmationMessage.tags['Action'] === 'Transfer') {
            return {
                ok: false,
                error:
                    confirmationMessage?.tags['X-Error'] ??
                    `Deposit has failed, more infos at https://ao.link/#/message/${transferId}`,
            };
        }

        // TODO: Return a DepositSuccess object instead?
        return {
            ok: true,
            data: quantity,
        };
    }

    // TODO: Implement method
    // async withdrawCollateral(params: WithdrawCollateralParams): Promise<bigint> {}

    async getOrderBook(marketId: string): Promise<Result<OrderBook>> {
        const perpMarket = this.cache.getPerpMarket(marketId);
        if (!perpMarket) {
            return {
                ok: false,
                error: 'Market not found',
            };
        }

        // TODO: Cache response (to be able to update it with WS)
        const orderbook = await fetchOrderBook(this.config.apiUrl, marketId);

        return {
            ok: true,
            data: orderbook,
        };
    }

    async getPositions(): Promise<Result<PerpPosition[]>> {
        const positions = await fetchAllPositions(this.config.apiUrl, this.config.walletAddress);

        // TODO: Cache response (to be able to update it with WS)
        // TODO: Add marketId as optional param?

        return {
            ok: true,
            data: positions.map((pos) =>
                PerpPositionSchema.parse({
                    size: BigInt(pos.size),
                    fundingQuantity: BigInt(pos.fundingQuantity),
                    entryPrice: BigInt(pos.entryPrice),
                    market: this.cache.getPerpMarket(pos.market.id),
                }),
            ),
        };
    }
}
