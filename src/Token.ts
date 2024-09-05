import { dryrun } from '@permaweb/aoconnect';
import * as z from 'zod';

import { AoMessage } from './AoMessage';
import { ArweaveIdRegex } from './utils/arweave';

const TokenSchema = z.object({
    id: z.string().regex(ArweaveIdRegex, 'Must be a valid AO process ID'),
    name: z.string(),
    ticker: z.string(),
    denomination: z.number().int().nonnegative(),
    logo: z.string().regex(ArweaveIdRegex, 'Must be a valid Arweave txId').optional(),
});
type TokenConstructor = z.infer<typeof TokenSchema>;

export class Token {
    public readonly id: string;
    public readonly name: string;
    public readonly ticker: string;
    public readonly denomination: number;
    public readonly logo: string | undefined;

    constructor(params: TokenConstructor) {
        const { id, name, ticker, denomination, logo } = TokenSchema.parse(params);

        this.id = id;
        this.name = name;
        this.ticker = ticker;
        this.denomination = denomination;
        this.logo = logo;
    }

    fromReadable(quantity: string): TokenQuantity {
        if (typeof quantity !== 'string' || !/^\d+(\.\d+)?$/.test(quantity)) {
            throw new Error('Invalid quantity');
        }

        const [intPart, decPart = ''] = quantity.split('.');

        return new TokenQuantity({
            token: this,
            quantity: BigInt(intPart + decPart.slice(0, this.denomination).padEnd(this.denomination, '0')),
        });
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

        return new TokenQuantity({ token: this, quantity: BigInt(quantity ?? '0') });
    }
}

const TokenQuantitySchema = z.object({
    token: z.instanceof(Token),
    quantity: z.bigint().nonnegative(),
});
type TokenQuantityConstructor = z.infer<typeof TokenQuantitySchema>;

export class TokenQuantity {
    public readonly token: Token;
    public readonly quantity: bigint;
    constructor(params: TokenQuantityConstructor) {
        const { token, quantity } = TokenQuantitySchema.parse(params);

        this.token = token;
        this.quantity = quantity;
    }

    toReadable(): string {
        const qtyAsString = this.quantity.toString();

        if (qtyAsString.length <= this.token.denomination) {
            return `0.${qtyAsString.padStart(this.token.denomination, '0')}`;
        }
        const intPart = qtyAsString.slice(0, -this.token.denomination);
        const decPart = qtyAsString.slice(-this.token.denomination).replace(/0+$/, '');

        return decPart ? `${intPart}.${decPart}` : intPart;
    }

    add(quantity: bigint): TokenQuantity {
        if (typeof quantity !== 'bigint') {
            throw new Error('Invalid quantity (expected bigint)');
        }

        return new TokenQuantity({ token: this.token, quantity: this.quantity + quantity });
    }

    sub(quantity: bigint): TokenQuantity {
        if (typeof quantity !== 'bigint') {
            throw new Error('Invalid quantity (expected bigint)');
        }

        return new TokenQuantity({ token: this.token, quantity: this.quantity - quantity });
    }

    equals(tokenQuantity: TokenQuantity): boolean {
        return this.token.id === tokenQuantity.token.id && this.quantity === tokenQuantity.quantity;
    }
}
