import { z } from 'zod';

import { TokenQuantity } from '../Token';
import { PerpPrice } from './Price';
import { PerpMarket } from './Market';

const PerpPositionSchema = z.object({
    market: z.instanceof(PerpMarket),
    entryPrice: z.string().regex(/^\d+$/),
    fundingQuantity: z.string().regex(/^\d+$/),
    size: z.string().regex(/^\d+$/),
});
type PerpPositionConstructor = z.infer<typeof PerpPositionSchema>;

export class PerpPosition {
    public entryPrice: PerpPrice;
    public fundingQuantity: TokenQuantity;
    public size: TokenQuantity;

    constructor(params: PerpPositionConstructor) {
        const { market, entryPrice, fundingQuantity, size } = PerpPositionSchema.parse(params);

        this.entryPrice = new PerpPrice({
            market,
            value: BigInt(entryPrice),
        });
        this.fundingQuantity = new TokenQuantity({
            token: market.quoteToken,
            quantity: BigInt(fundingQuantity),
        });
        this.size = new TokenQuantity({
            token: market.baseToken,
            quantity: BigInt(size),
        });
    }
}
