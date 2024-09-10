import { z } from 'zod';

import { AoMessage, AoMessageTags } from '../AoMessage';
import { TokenQuantity } from '../Token';
import {
    OrderSide,
    ZodOrderSide,
    OrderStatus,
    ZodOrderStatus,
    OrderType,
    ZodOrderType,
    ZodBint,
    ZodArweaveId,
} from '../utils/zod';
import { PerpMarket } from './Market';
import { PerpPrice } from './Price';

const PerpOrderSchema = z
    .object({
        id: ZodArweaveId,
        type: ZodOrderType,
        side: ZodOrderSide,
        status: ZodOrderStatus,
        market: z.instanceof(PerpMarket),
        originalQuantity: ZodBint,
        executedQuantity: ZodBint,
        price: ZodBint.optional(),
    })
    .refine((params) => (params.type !== 'Market' && !params.price ? false : true)); // Make sure price is set if order.type is not Market
type PerpOrderConstructor = z.infer<typeof PerpOrderSchema>;

const PerpOrderMarketCreateTagsSchema = z.object({
    marketId: ZodArweaveId,
    side: ZodOrderSide,
    size: z.instanceof(TokenQuantity),
    reduceOnly: z.boolean().optional(),
});

export type PerpOrderMarketCreateTagsParams = z.infer<typeof PerpOrderMarketCreateTagsSchema>;

const PerpOrderLimitCreateTagsSchema = z
    .object({
        marketId: ZodArweaveId,
        side: ZodOrderSide,
        size: z.instanceof(TokenQuantity),
        price: z.instanceof(PerpPrice),
        postOnly: z.boolean().optional(),
        reduceOnly: z.boolean().optional(),
    })
    .refine((params) => params.marketId === params.price.market.id);
type PerpOrderLimitCreateTagsParams = z.infer<typeof PerpOrderLimitCreateTagsSchema>;

export class PerpOrder {
    public readonly id: string;
    public readonly type: OrderType;
    public readonly side: OrderSide;
    public readonly status: OrderStatus;
    public readonly originalQuantity: TokenQuantity;
    public readonly executedQuantity: TokenQuantity;
    public readonly price?: PerpPrice;

    constructor(params: PerpOrderConstructor) {
        const { id, type, side, status, market, originalQuantity, executedQuantity, price } =
            PerpOrderSchema.parse(params);

        this.id = id;
        this.type = type;
        this.side = side;
        this.status = status;
        this.originalQuantity = new TokenQuantity({
            token: market.baseToken,
            quantity: BigInt(originalQuantity),
        });
        this.executedQuantity = new TokenQuantity({
            token: market.baseToken,
            quantity: BigInt(executedQuantity),
        });

        if (price) {
            this.price = new PerpPrice({
                market,
                value: BigInt(price),
            });
        }
    }

    static forgeCreateMarketTags(params: PerpOrderMarketCreateTagsParams): AoMessageTags {
        const { marketId, side, size, reduceOnly } = PerpOrderMarketCreateTagsSchema.parse(params);

        return AoMessage.makeTags({
            Action: 'Transfer',
            Recipient: marketId,
            Quantity: '0',
            'X-Order-Type': 'Market',
            'X-Order-Side': side,
            'X-Order-Size': size.quantity,
            'X-Reduce-Only': reduceOnly || undefined,
        });
    }

    static forgeCreateLimitTags(params: PerpOrderLimitCreateTagsParams): AoMessageTags {
        const { marketId, side, size, price, postOnly, reduceOnly } = PerpOrderLimitCreateTagsSchema.parse(params);

        return AoMessage.makeTags({
            Action: 'Transfer',
            Recipient: marketId,
            Quantity: '0',
            'X-Order-Type': postOnly ? 'Limit-Maker' : 'Limit',
            'X-Order-Side': side,
            'X-Order-Size': size.quantity,
            'X-Order-Price': price.value,
            'X-Reduce-Only': reduceOnly || undefined,
        });
    }

    static forgeCancelTags(orderId: string): AoMessageTags {
        return AoMessage.makeTags({
            Action: 'Cancel-Order',
            'Order-Id': orderId,
        });
    }
}
