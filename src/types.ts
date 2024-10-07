import { z } from 'zod';

import { ZodArweaveId } from './utils/zod';

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

export const PerpMarketSchema = z.object({
    id: z.string(),
    accountId: z.string(),
    minPriceTickSize: z.bigint(),
    minQuantityTickSize: z.bigint(),
});

export type PerpMarket = z.infer<typeof PerpMarketSchema>;

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
