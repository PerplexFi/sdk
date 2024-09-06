import { createDataItemSigner, dryrun, message } from '@permaweb/aoconnect';
import { z } from 'zod';

import { AoMessage, lookForMessage } from './AoMessage';
import { Token, TokenQuantity } from './Token';
import { ArweaveIdRegex } from './utils/arweave';

type PoolReserves = {
    base: TokenQuantity;
    quote: TokenQuantity;
    lastFetchedAt: Date | null;
};

const PoolSchema = z
    .object({
        id: z.string().regex(ArweaveIdRegex, 'Must be a valid AO process ID'),
        tokenBase: z.instanceof(Token),
        tokenQuote: z.instanceof(Token),
        feeRate: z.number().gte(0).lte(1),
    })
    .refine((params) => params.tokenBase.id !== params.tokenQuote.id);
type PoolConstructor = z.infer<typeof PoolSchema>;

export class Pool {
    #reserves: PoolReserves;
    public readonly id: string;
    public readonly tokenBase: Token;
    public readonly tokenQuote: Token;
    public readonly feeRate: number;

    constructor(params: PoolConstructor) {
        const { id, tokenBase, tokenQuote, feeRate } = PoolSchema.parse(params);

        this.#reserves = {
            base: new TokenQuantity({ token: tokenBase, quantity: 0n }),
            quote: new TokenQuantity({ token: tokenQuote, quantity: 0n }),
            lastFetchedAt: null,
        };
        this.id = id;
        this.tokenBase = tokenBase;
        this.tokenQuote = tokenQuote;
        this.feeRate = feeRate;
    }

    get reserves(): PoolReserves {
        return this.#reserves;
    }

    set reserves(reserves: Omit<PoolReserves, 'lastFetchedAt'>) {
        this.#reserves = {
            base: reserves.base,
            quote: reserves.quote,
            lastFetchedAt: new Date(),
        };
    }

    getExpectedOutput(input: TokenQuantity, slippageTolerance = 0): TokenQuantity {
        if (input.token.id !== this.tokenBase.id && input.token.id !== this.tokenQuote.id) {
            throw new Error('Input.token is invalid, must be one of Pool.tokenBase or Pool.tokenQuote');
        }

        if (slippageTolerance < 0 || slippageTolerance > 1) {
            throw new Error('slippageTolerance must be between 0 and 1');
        }

        // WARNING: Make sure reserves are the most up to date possible
        if (!this.reserves.lastFetchedAt) {
            throw new Error('Reserves not fetched yet');
        }

        const outputToken = this.oppositeToken(input.token);
        const reserves = {
            [this.tokenBase.id]: this.reserves.base,
            [this.tokenQuote.id]: this.reserves.quote,
        };
        const inputReserve = reserves[input.token.id];
        const outputReserve = reserves[outputToken.id];

        const k = this.reserves.base.quantity * this.reserves.quote.quantity;

        // Calculate the new output reserve after the trade
        const newOutputReserve = k / (inputReserve.quantity + input.quantity);

        // Calculate the output quantity (before fee)
        const outputQuantity = outputReserve.quantity - newOutputReserve;

        // Apply the fee rate
        const outputAfterFee = (outputQuantity * (10_000n - BigInt(Math.round(this.feeRate * 10_000)))) / 10_000n;

        // Apply slippage tolerance (converted to bigint)
        const minExpectedOutput =
            (outputAfterFee * (10_000n - BigInt(Math.round(slippageTolerance * 10_000)))) / 10_000n;

        return new TokenQuantity({ token: outputToken, quantity: minExpectedOutput });
    }

    oppositeToken(token: Token): Token {
        if (token.id === this.tokenBase.id) {
            return this.tokenQuote;
        }
        if (token.id === this.tokenQuote.id) {
            return this.tokenBase;
        }

        throw new Error('Invalid token');
    }

    async updateReserves(): Promise<void> {
        if (this.reserves.lastFetchedAt && Date.now() - this.reserves.lastFetchedAt.getTime() <= 60_000) {
            return;
        }

        const dryrunRes = await dryrun({
            process: this.id,
            tags: [
                {
                    name: 'Action',
                    value: 'Reserves',
                },
            ],
        });

        const outputMessage = dryrunRes.Messages.at(0);
        if (outputMessage) {
            const reservesJSON = JSON.parse(outputMessage.Data);
            this.reserves = {
                base: new TokenQuantity({
                    token: this.reserves.base.token,
                    quantity: BigInt(reservesJSON[this.reserves.base.token.id]),
                }),
                quote: new TokenQuantity({
                    token: this.reserves.quote.token,
                    quantity: BigInt(reservesJSON[this.reserves.quote.token.id]),
                }),
            };
        } else {
            // Can happen if process is not responding
            throw new Error('Failed to update reserves');
        }
    }

    async swap(args: {
        signer: ReturnType<typeof createDataItemSigner>;
        input: TokenQuantity;
        minExpectedOutput: TokenQuantity;
    }): Promise<Swap> {
        const tags = Swap.forgeTags(this, args.input, args.minExpectedOutput);

        // 1. Forge message tags and send it
        const transferId = await message({
            process: args.input.token.id,
            signer: args.signer,
            tags,
        });

        // 2. Poll gateway to find the resulting message
        const confirmationMessage = await lookForMessage({
            tagsFilter: [
                {
                    name: 'Action',
                    values: ['Transfer'],
                },
                {
                    name: 'From-Process',
                    values: [this.id],
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

        if (confirmationMessage.to !== args.minExpectedOutput.token.id) {
            // Can happen if the slippage was too big. Confirm by querying aoconnect's `result` and check the Output/Messages?
            throw new Error(`Swap has failed. More infos: https://ao.link/#/message/${transferId}`);
        }

        const output = new TokenQuantity({
            token: args.minExpectedOutput.token,
            quantity: BigInt(confirmationMessage.tags['Quantity']),
        });

        if (args.input.token.id === this.reserves.base.token.id) {
            this.reserves = {
                base: this.reserves.base.add(args.input.quantity),
                quote: this.reserves.quote.sub(output.quantity),
            };
        } else {
            this.reserves = {
                base: this.reserves.base.sub(output.quantity),
                quote: this.reserves.quote.add(args.input.quantity),
            };
        }

        return new Swap({
            id: transferId,
            input: args.input,
            output,
            fees: new TokenQuantity({
                token: args.input.token,
                quantity: BigInt(confirmationMessage.tags['X-Fees']),
            }),
            price: Number(confirmationMessage.tags['X-Price']),
        });
    }
}

const SwapSchema = z.object({
    id: z.string().regex(ArweaveIdRegex, 'Must be a valid AO message ID'),
    input: z.instanceof(TokenQuantity),
    output: z.instanceof(TokenQuantity),
    fees: z.instanceof(TokenQuantity),
    price: z.number().positive(),
});
type SwapConstructor = z.infer<typeof SwapSchema>;

export class Swap {
    public readonly id: string;
    public readonly input: TokenQuantity;
    public readonly output: TokenQuantity;
    public readonly fees: TokenQuantity;
    public readonly price: number;

    constructor(params: SwapConstructor) {
        const { id, input, output, fees, price } = SwapSchema.parse(params);

        this.id = id;
        this.input = input;
        this.output = output;
        this.fees = fees;
        this.price = price;
    }

    static forgeTags(
        pool: Pool,
        input: TokenQuantity,
        minExpectedOutput: TokenQuantity,
    ): Array<{ name: string; value: string }> {
        // 0. Assert args are valid
        if (
            (input.token.id !== pool.tokenBase.id && input.token.id !== pool.tokenQuote.id) || // Make sure input token is valid
            input.quantity <= 0n // Make sure quantity is valid
        ) {
            throw new Error('Invalid input');
        }

        // Make sure the expected output's token is indeed the opposite of the input
        if (minExpectedOutput.token.id !== pool.oppositeToken(input.token).id) {
            throw new Error('Invalid minExpectedOutput');
        }

        return AoMessage.makeTags({
            Action: 'Transfer',
            Recipient: pool.id,
            Quantity: input.quantity,
            'X-Operation-Type': 'Swap',
            'X-Minimum-Expected-Output': minExpectedOutput.quantity,
        });
    }
}
