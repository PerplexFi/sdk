import { dryrun } from '@permaweb/aoconnect';

import { AoMessage } from './AoMessage';

type TokenConstructor = {
    id: string;
    name: string;
    ticker: string;
    denomination: number;
    logo?: string;
};

export class Token {
    public readonly id: string;
    public readonly name: string;
    public readonly ticker: string;
    public readonly denomination: number;
    public readonly logo: string | undefined;

    constructor({ id, name, ticker, denomination, logo }: TokenConstructor) {
        if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{43}$/.test(id)) {
            throw new Error('id must be a valid AO processId');
        }
        this.id = id;

        if (typeof name !== 'string') {
            throw new Error('name must be a string');
        }
        this.name = name;

        if (typeof ticker !== 'string') {
            throw new Error('ticker must be a string');
        }
        this.ticker = ticker;

        if (typeof denomination !== 'number' || denomination < 0) {
            throw new Error('denomination must be a positive number');
        }
        this.denomination = denomination;

        if (typeof logo === 'string' && !/^[a-zA-Z0-9_-]{43}$/.test(logo)) {
            throw new Error('logo must be a valid Arweave txId');
        }
        this.logo = logo;
    }

    fromReadable(quantity: string): TokenQuantity {
        if (!/^\d+(\.\d+)?$/.test(quantity)) {
            throw new Error('Invalid quantity');
        }

        const [intPart, decPart = ''] = quantity.split('.');

        return new TokenQuantity(
            this,
            BigInt(intPart + decPart.slice(0, this.denomination).padEnd(this.denomination, '0')),
        );
    }

    async balanceOf(wallet: string): Promise<TokenQuantity> {
        const res = await dryrun({
            process: this.id,
            tags: AoMessage.toTagsArray({
                Action: 'Balance',
                Target: wallet,
            }),
        });

        const quantity = res.Messages.at(0)?.Tags.find(
            (tag: { name: string; value: string }) => tag.name === 'Balance',
        )?.value;

        return new TokenQuantity(this, BigInt(quantity ?? '0'));
    }
}

export class TokenQuantity {
    constructor(
        public readonly token: Token,
        public readonly quantity: bigint,
    ) {}

    toReadable(): string {
        const qtyAsString = this.quantity.toString();

        if (qtyAsString.length <= this.token.denomination) {
            return `0.${qtyAsString.padStart(this.token.denomination, '0')}`;
        }
        const intPart = qtyAsString.slice(0, -this.token.denomination);
        const decPart = qtyAsString.slice(-this.token.denomination).replace(/0+$/, '');

        return decPart ? `${intPart}.${decPart}` : intPart;
    }

    equals(tokenQuantity: TokenQuantity): boolean {
        return this.token.id === tokenQuantity.token.id && this.quantity === tokenQuantity.quantity;
    }
}
