import { z } from 'zod';

import { OrderType, ZodArweaveId, ZodOrderSide, ZodOrderStatus, ZodOrderType } from './utils/zod';

export const TokenSchema = z.object({
    id: ZodArweaveId,
    name: z.string(),
    ticker: z.string(),
    denomination: z.number().int().nonnegative(),
    logo: ZodArweaveId.nullable(),
});

export type Token = z.infer<typeof TokenSchema>;

export const PoolSchema = z.object({
    id: z.string(),
    feeRate: z.number(),
    tokenBase: TokenSchema,
    tokenQuote: TokenSchema,
});

export type Pool = z.infer<typeof PoolSchema>;

export type PoolReserves = Record<string, bigint>;

export const SwapParamsSchema = z.object({
    pool: PoolSchema,
    token: TokenSchema,
    quantity: z.bigint().positive(),
    minExpectedOutput: z.bigint().positive(),
});

export type SwapParams = z.infer<typeof SwapParamsSchema>;

export type Swap = {
    id: string;
    quantityIn: bigint;
    tokenIn: Token;
    quantityOut: bigint;
    tokenOut: Token;
    fees: bigint;
    price: number;
};

export const PerpMarketSchema = z.object({
    id: z.string(),
    accountId: z.string(),
    baseTicker: z.string(),
    minPriceTickSize: z.bigint(),
    minQuantityTickSize: z.bigint(),
});

export type PerpMarket = z.infer<typeof PerpMarketSchema>;

export const PlacePerpOrderParamsSchema = z
    .discriminatedUnion('type', [
        z.object({
            market: PerpMarketSchema,
            type: z.literal(OrderType.MARKET),
            side: ZodOrderSide,
            size: z.bigint().positive(),
            reduceOnly: z.boolean().optional(),
        }),
        z.object({
            market: PerpMarketSchema,
            type: z.literal(OrderType.LIMIT).or(z.literal(OrderType.LIMIT_MAKER)),
            side: ZodOrderSide,
            size: z.bigint().positive(),
            price: z.bigint().positive(),
            reduceOnly: z.boolean().optional(),
        }),
    ])
    .refine((params) => params.type !== OrderType.MARKET && params.price % params.market.minPriceTickSize === 0n, {
        message: 'Invalid price tick size',
    })
    .refine((params) => params.size % params.market.minQuantityTickSize === 0n, {
        message: 'Invalid quantity tick size',
    });

export type PlacePerpOrderParams = z.infer<typeof PlacePerpOrderParamsSchema>;

export const PerpOrderSchema = z.object({
    id: z.string(),
    type: ZodOrderType,
    status: ZodOrderStatus,
    side: ZodOrderSide,
    size: z.bigint(),
    originalQuantity: z.bigint(),
    executedQuantity: z.bigint(),
    initialPrice: z.bigint().optional(),
    executedValue: z.bigint(),
});

export type PerpOrder = z.infer<typeof PerpOrderSchema>;
