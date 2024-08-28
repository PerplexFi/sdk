import { createDataItemSigner, message } from '@permaweb/aoconnect';

import { Token, TokenQuantity } from './Token';
import { AoMessage, lookForMessage } from './AoMessage';

type PoolReserves = {
    base: TokenQuantity;
    quote: TokenQuantity;
    lastFetchedAt: Date | null;
};

export class Pool {
    #reserves: PoolReserves;

    constructor(
        public readonly id: string,
        public readonly tokenBase: Token,
        public readonly tokenQuote: Token,
        public readonly feeRate: number,
    ) {
        this.#reserves = {
            base: new TokenQuantity(tokenBase, 0n),
            quote: new TokenQuantity(tokenQuote, 0n),
            lastFetchedAt: null,
        };
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
        if (!this.#reserves.lastFetchedAt) {
            throw new Error('Reserves not fetched yet');
        }

        const outputToken = this.oppositeToken(input.token);
        const reserves = {
            [this.tokenBase.id]: this.#reserves.base,
            [this.tokenQuote.id]: this.#reserves.quote,
        };
        const inputReserve = reserves[input.token.id];
        const outputReserve = reserves[outputToken.id];

        const k = this.#reserves.base.quantity * this.#reserves.quote.quantity;

        // Calculate the new output reserve after the trade
        const newOutputReserve = k / (inputReserve.quantity + input.quantity);

        // Calculate the output quantity (before fee)
        const outputQuantity = outputReserve.quantity - newOutputReserve;

        // Apply the fee rate
        const outputAfterFee = (outputQuantity * (10_000n - BigInt(Math.round(this.feeRate * 10_000)))) / 10_000n;

        // Apply slippage tolerance (converted to bigint)
        const minExpectedOutput =
            (outputAfterFee * (10_000n - BigInt(Math.round(slippageTolerance * 10_000)))) / 10_000n;

        return new TokenQuantity(outputToken, minExpectedOutput);
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
        if (this.#reserves.lastFetchedAt && Date.now() - this.#reserves.lastFetchedAt.getTime() <= 60_000) {
            return;
        }

        // TODO: Fetch reserves using dryrun on Pool process
    }

    async swap(args: {
        signer: ReturnType<typeof createDataItemSigner>;
        input: TokenQuantity;
        minExpectedOutput: TokenQuantity;
    }): Promise<Swap> {
        // 0. Assert args are valid
        if (args.input.token.id !== this.tokenBase.id && args.input.token.id !== this.tokenQuote.id) {
            throw new Error("Invalid args.input's token");
        }

        if (args.minExpectedOutput.token.id !== this.oppositeToken(args.input.token).id) {
            throw new Error("Invalid args.minExpectedOutput's token");
        }

        // 1. Forge message tags and send it
        const transferId = await message({
            process: args.input.token.id,
            signer: args.signer,
            tags: AoMessage.toTagsArray({
                Action: 'Transfer',
                Recipient: this.id,
                Quantity: args.input.quantity,
                'X-Operation-Type': 'Swap',
                'X-Minimum-Expected-Output': args.minExpectedOutput.quantity,
            }),
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

        return new Swap(
            transferId,
            args.input,
            new TokenQuantity(args.minExpectedOutput.token, BigInt(confirmationMessage.tags['Quantity'])),
            new TokenQuantity(args.minExpectedOutput.token, BigInt(confirmationMessage.tags['X-Fees'])),
            Number(confirmationMessage.tags['X-Price']),
        );
    }
}

export class Swap {
    constructor(
        public readonly id: string,
        public readonly input: TokenQuantity,
        public readonly output: TokenQuantity,
        public readonly fees: TokenQuantity,
        public readonly price: number,
    ) {}
}
