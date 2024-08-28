import { dryrun } from '@permaweb/aoconnect/browser';
import { AoMessage } from './AoMessage';

export class Token {
    constructor(
        public readonly id: string,
        public readonly name: string,
        public readonly ticker: string,
        public readonly denomination: number,
    ) {}

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
}
