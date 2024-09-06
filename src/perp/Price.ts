import { z } from 'zod';

import { PerpMarket } from './Market';

const PerpPriceSchema = z.object({
    market: z.instanceof(PerpMarket),
    value: z.bigint(),
});
type PerpPriceConstructor = z.infer<typeof PerpPriceSchema>;

export class PerpPrice {
    public readonly market: PerpMarket;
    public readonly value: bigint; // value is "how much quote for 1 base", expressed using quoteDenomination

    constructor(params: PerpPriceConstructor) {
        const { market, value } = PerpPriceSchema.parse(params);

        this.market = market;
        this.value = value;
    }
}
