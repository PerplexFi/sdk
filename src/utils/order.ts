import { z } from 'zod';

export const OrderSideZodEnum = z.enum(['Buy', 'Sell'] as const);

export type OrderSide = z.infer<typeof OrderSideZodEnum>;

export const OrderStatusZodEnum = z.enum(['New', 'Partially-Filled', 'Filled', 'Canceled', 'Failed'] as const);

export type OrderStatus = z.infer<typeof OrderStatusZodEnum>;

export const OrderTypeZodEnum = z.enum(['Market', 'Limit', 'Limit-Maker'] as const);

export type OrderType = z.infer<typeof OrderTypeZodEnum>;
