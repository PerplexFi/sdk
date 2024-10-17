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

export const ZodArweaveId = z
    .string()
    .regex(/^[a-zA-Z0-9_-]{43}$/, { message: 'This does not look like a valid Arweave ID' });

export const ZodBint = z.string().regex(/^\d+$/);

export const ZodRawBint = z
    .array(z.number().int())
    .min(2)
    .transform((bint: number[]) => {
        const base = 2n ** 32n;

        // Check if the number is negative
        const isNegative = (bint.at(-1)! & (1 << 31)) !== 0;

        let bigint = BigInt(0);

        if (isNegative) {
            // Convert from two's complement to positive BigInt
            let carry = BigInt(1);
            for (let i = 0; i < bint.length; i += 1) {
                let part = BigInt(~bint[i]!) + carry;
                if (part >= base) {
                    part -= base;
                    carry = BigInt(1);
                } else {
                    carry = BigInt(0);
                }
                bigint += part * base ** BigInt(i);
            }
            // Negate the result to get the correct negative number
            bigint = -bigint;
        } else {
            // Combine the array elements into a single large number for positive values
            for (let i = bint.length - 1; i >= 0; i -= 1) {
                bigint = bigint * base + BigInt(bint[i]!);
            }
        }

        return bigint;
    });
