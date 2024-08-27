import { Token, TokenQuantity } from './Token';

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

    async updateReserves(): Promise<void> {
        if (this.#reserves.lastFetchedAt && Date.now() - this.#reserves.lastFetchedAt.getTime() <= 60_000) {
            return;
        }

        // TODO: Fetch reserves using dryrun on Pool process
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
}
