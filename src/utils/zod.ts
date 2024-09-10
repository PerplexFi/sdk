import { z } from 'zod';

export const ZodOrderSide = z.enum(['Buy', 'Sell'] as const);

export type OrderSide = z.infer<typeof ZodOrderSide>;

export const ZodOrderStatus = z.enum(['New', 'Partially-Filled', 'Filled', 'Canceled', 'Failed'] as const);

export type OrderStatus = z.infer<typeof ZodOrderStatus>;

export const ZodOrderType = z.enum(['Market', 'Limit', 'Limit-Maker'] as const);

export type OrderType = z.infer<typeof ZodOrderType>;

export const ZodArweaveId = z.string().regex(/^[a-zA-Z0-9_-]{43}$/);

export const ZodBint = z.string().regex(/^\d+$/);
