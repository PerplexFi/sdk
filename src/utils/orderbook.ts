import { z } from 'zod';
import { ZodOrderSide, ZodOrderStatus, ZodOrderType, ZodRawBint } from './zod';

const OrderSchema = z.object({
    id: z.string(),
    from: z.string(),
    originalQty: ZodRawBint,
    executedQty: ZodRawBint,
    executedValue: ZodRawBint,
    type: ZodOrderType,
    status: ZodOrderStatus,
    side: ZodOrderSide,
    price: ZodRawBint,
});

export type ParsedOrder = z.infer<typeof OrderSchema>;

const PriceLevelSchema = z.object({
    price: ZodRawBint,
    totalQuantity: ZodRawBint,
    orders: z.array(OrderSchema).optional(),
});

export const OrderBookDataSchema = z.object({
    Asks: z.array(PriceLevelSchema),
    Bids: z.array(PriceLevelSchema),
});
