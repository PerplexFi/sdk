import { z } from 'zod';

import { AoMessage, AoMessageTags } from '../AoMessage';
import { Token, TokenQuantity } from '../Token';
import { ArweaveIdRegex } from '../utils/arweave';
import {
    OrderSide,
    OrderSideZodEnum,
    OrderStatus,
    OrderStatusZodEnum,
    OrderType,
    OrderTypeZodEnum,
} from '../utils/order';

const PerpOrderSchema = z.object({
    id: z.string().regex(ArweaveIdRegex, 'Must be a valid AO message ID'),
    type: OrderTypeZodEnum,
    side: OrderSideZodEnum,
    status: OrderStatusZodEnum,
    baseToken: z.instanceof(Token),
    originalQuantity: z.string().regex(/^\d+$/),
    executedQuantity: z.string().regex(/^\d+$/),
});
type PerpOrderConstructor = z.infer<typeof PerpOrderSchema>;

const PerpOrderMarketCreateTagsSchema = z.object({
    marketId: z.string().regex(ArweaveIdRegex),
    side: OrderSideZodEnum,
    size: z.instanceof(TokenQuantity),
    reduceOnly: z.boolean().optional(),
});

export type PerpOrderMarketCreateTagsParams = z.infer<typeof PerpOrderMarketCreateTagsSchema>;

const PerpOrderLimitCreateTagsSchema = z
    .object({
        marketId: z.string().regex(ArweaveIdRegex),
        side: OrderSideZodEnum,
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

    constructor(params: PerpOrderConstructor) {
        const { id, type, side, status, baseToken, originalQuantity, executedQuantity } = PerpOrderSchema.parse(params);

        this.id = id;
        this.type = type;
        this.side = side;
        this.status = status;
        this.originalQuantity = new TokenQuantity({
            token: baseToken,
            quantity: BigInt(originalQuantity),
        });
        this.executedQuantity = new TokenQuantity({
            token: baseToken,
            quantity: BigInt(executedQuantity),
        });
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
