import { z } from 'zod';

export const ZodOrderSide = z.enum(['Buy', 'Sell']);

export const OrderSide = {
    BUY: 'Buy',
    SELL: 'Sell',
} as const;

export type OrderSide = z.infer<typeof ZodOrderSide>;

export const ZodOrderStatus = z.enum(['New', 'Partially-Filled', 'Filled', 'Canceled', 'Failed']);

export const OrderStatus = {
    NEW: 'New',
    PARTIALLY_FILLED: 'Partially-Filled',
    FILLED: 'Filled',
    CANCELED: 'Canceled',
    FAILED: 'Failed',
} as const;

export type OrderStatus = z.infer<typeof ZodOrderStatus>;

export const ZodOrderType = z.enum(['Market', 'Limit', 'Limit-Maker']);

export const OrderType = {
    MARKET: 'Market',
    LIMIT: 'Limit',
    LIMIT_MAKER: 'Limit-Maker',
} as const;

export type OrderType = z.infer<typeof ZodOrderType>;

export const ZodArweaveId = z.string().regex(/^[a-zA-Z0-9_-]{43}$/);

export const ZodBint = z.string().regex(/^\d+$/);
