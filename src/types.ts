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
    poolId: ZodArweaveId,
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
    baseDenomination: z.number().int().positive(),
    minPriceTickSize: z.bigint(),
    minQuantityTickSize: z.bigint(),
    oraclePrice: z.bigint(),
});

export type PerpMarket = z.infer<typeof PerpMarketSchema>;

export const PlacePerpOrderParamsSchema = z.discriminatedUnion('type', [
    z.object({
        marketId: ZodArweaveId,
        type: z.literal(OrderType.MARKET),
        side: ZodOrderSide,
        size: z.bigint().positive(),
        reduceOnly: z.boolean().optional(),
    }),
    z.object({
        marketId: ZodArweaveId,
        type: z.literal(OrderType.LIMIT),
        side: ZodOrderSide,
        size: z.bigint().positive(),
        price: z.bigint().positive(),
        reduceOnly: z.boolean().optional(),
    }),
    z.object({
        marketId: ZodArweaveId,
        type: z.literal(OrderType.LIMIT_MAKER),
        side: ZodOrderSide,
        size: z.bigint().positive(),
        price: z.bigint().positive(),
        reduceOnly: z.boolean().optional(),
    }),
]);

export type PlacePerpOrderParams = z.infer<typeof PlacePerpOrderParamsSchema>;

export const CancelOrderParamsSchema = z.object({
    marketId: ZodArweaveId,
    orderId: ZodArweaveId,
});

export type CancelOrderParams = z.infer<typeof CancelOrderParamsSchema>;

export const PerpOrderSchema = z.object({
    id: z.string(),
    type: ZodOrderType,
    status: ZodOrderStatus,
    side: ZodOrderSide,
    originalQuantity: z.bigint(),
    executedQuantity: z.bigint(),
    initialPrice: z.bigint().optional(),
    executedValue: z.bigint(),
});

export type PerpOrder = z.infer<typeof PerpOrderSchema>;

export const DepositCollateralParamsSchema = z.object({
    accountId: ZodArweaveId,
    token: TokenSchema,
    quantity: z.bigint().positive(),
});

export type DepositCollateralParams = z.infer<typeof DepositCollateralParamsSchema>;

const OrderBookPriceLevelSchema = z.object({
    price: z.bigint(),
    size: z.bigint(),
});

export const OrderBookSchema = z.object({
    asks: z.array(OrderBookPriceLevelSchema),
    bids: z.array(OrderBookPriceLevelSchema),
});

export type OrderBook = z.infer<typeof OrderBookSchema>;
