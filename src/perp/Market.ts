import { createDataItemSigner, message } from '@permaweb/aoconnect';
import { z } from 'zod';

import { lookForMessage } from '../AoMessage';
import { Token, TokenQuantity } from '../Token';
import { ArweaveIdRegex } from '../utils/arweave';
import { OrderSide, OrderStatus, OrderType } from '../utils/order';
import { PerpOrder } from './Order';
import { PerpPrice } from './Price';

const PerpAccountSchema = z.object({
    id: z.string().regex(ArweaveIdRegex, 'Must be a valid AO process ID'),
});
type PerpAccountConstructor = z.infer<typeof PerpAccountSchema>;

export class PerpAccount {
    public readonly id: string;

    constructor(params: PerpAccountConstructor) {
        const { id } = PerpAccountSchema.parse(params);

        this.id = id;
    }

    // async getSummary(wallet: string): Promise<AccountSummary> {
    // }
}

const PerpMarketSchema = z.object({
    id: z.string().regex(ArweaveIdRegex, 'Must be a valid AO process ID'),
    account: z.instanceof(PerpAccount),
    accountDenomination: z.number().int().gte(0),
    baseTicker: z.string(),
    baseDenomination: z.number().int().gte(0),
    minPriceTickSize: z.number().int().gte(0),
    minQuantityTickSize: z.number().int().gte(0),
});
type PerpMarketConstructor = z.infer<typeof PerpMarketSchema>;

export class PerpMarket {
    public readonly id: string;
    public readonly account: PerpAccount;
    public readonly baseToken: Token;
    public readonly quoteToken: Token;
    public readonly minPriceTickSize: number;
    public readonly minQuantityTickSize: number;

    constructor(params: PerpMarketConstructor) {
        const {
            id,
            account,
            accountDenomination,
            baseTicker,
            baseDenomination,
            minPriceTickSize,
            minQuantityTickSize,
        } = PerpMarketSchema.parse(params);

        this.id = id;
        this.account = account;
        this.baseToken = new Token(
            {
                id,
                name: baseTicker,
                ticker: baseTicker,
                denomination: baseDenomination,
            },
            false,
        );
        this.quoteToken = new Token(
            {
                id: account.id,
                name: 'USD',
                ticker: 'USD',
                denomination: accountDenomination,
            },
            false,
        );
        this.minPriceTickSize = minPriceTickSize;
        this.minQuantityTickSize = minQuantityTickSize;
    }

    priceFromReadable(price: string): PerpPrice {
        if (typeof price !== 'string' || !/^\d+(\.\d+)?$/.test(price)) {
            throw new Error('Invalid price');
        }

        const [intPart, decPart = ''] = price.split('.');

        return new PerpPrice({
            market: this,
            value: BigInt(
                intPart +
                    decPart
                        .slice(0, this.quoteToken.denomination - this.minPriceTickSize)
                        .padEnd(this.quoteToken.denomination, '0'),
            ),
        });
    }

    sizeFromReadable(size: string): TokenQuantity {
        if (typeof size !== 'string' || !/^\d+(\.\d+)?$/.test(size)) {
            throw new Error('Invalid size');
        }

        const [intPart, decPart = ''] = size.split('.');

        return new TokenQuantity({
            token: this.baseToken,
            quantity: BigInt(
                intPart +
                    decPart
                        .slice(0, this.baseToken.denomination - this.minQuantityTickSize)
                        .padEnd(this.baseToken.denomination, '0'),
            ),
        });
    }

    // async getOpenOrders(wallet: string): Promise<PerpOrder[]> {
    // }

    // async getOrderbook(): Promise<Orderbook> {
    // }

    async createMarketOrder(args: {
        signer: ReturnType<typeof createDataItemSigner>;
        side: 'Buy' | 'Sell';
        size: string;
        reduceOnly?: boolean;
    }): Promise<PerpOrder> {
        const tags = PerpOrder.forgeCreateMarketTags({
            marketId: this.id,
            side: args.side,
            size: this.sizeFromReadable(args.size),
            reduceOnly: args.reduceOnly,
        });

        const transferId = await message({
            signer: args.signer,
            process: this.account.id,
            tags,
        });

        const finalMessage = await lookForMessage({
            tagsFilter: [
                {
                    name: 'X-Order-Id',
                    values: [transferId],
                },
                {
                    name: 'From-Process',
                    values: [this.id],
                },
            ],
            isMessageValid: (msg) => {
                const orderStatus = msg.tags['X-Order-Status'];

                if (orderStatus === 'Filled' || orderStatus === 'Canceled') {
                    // If order is filled
                    // Or order is refunded (because of lack of liquidity)
                    // TODO: Handle reduce-only failed?
                    return true;
                }

                return false;
            },
            pollArgs: {
                maxRetries: 40,
                retryAfterMs: 500, // 40*500ms = 20s
            },
        });

        if (!finalMessage) {
            throw new Error(`createMarketOrder has failed. More infos: https://ao.link/#/message/${transferId}`);
        }

        return new PerpOrder({
            id: finalMessage.tags['X-Order-Id'],
            type: finalMessage.tags['X-Order-Type'] as OrderType, // casting type is not an issue because zod handles value checking
            side: finalMessage.tags['X-Order-Side'] as OrderSide, // casting type is not an issue because zod handles value checking
            status: finalMessage.tags['X-Order-Status'] as OrderStatus, // casting type is not an issue because zod handles value checking
            token: this.baseToken,
            originalQuantity: finalMessage.tags['X-Original-Quantity'],
            executedQuantity: finalMessage.tags['X-Executed-Quantity'],
        });
    }

    async createLimitOrder(args: {
        signer: ReturnType<typeof createDataItemSigner>;
        side: 'Buy' | 'Sell';
        size: string;
        price: string;
        postOnly?: boolean;
        reduceOnly?: boolean;
    }): Promise<PerpOrder> {
        const tags = PerpOrder.forgeCreateLimitTags({
            marketId: this.id,
            side: args.side,
            size: this.sizeFromReadable(args.size),
            price: this.priceFromReadable(args.price),
            postOnly: args.postOnly,
            reduceOnly: args.reduceOnly,
        });

        const transferId = await message({
            signer: args.signer,
            process: this.account.id,
            tags,
        });

        const finalMessage = await lookForMessage({
            tagsFilter: [
                {
                    name: 'X-Order-Id',
                    values: [transferId],
                },
                {
                    name: 'From-Process',
                    values: [this.id],
                },
            ],
            isMessageValid: (msg) => {
                const orderStatus = msg.tags['X-Order-Status'];

                if (msg.tags['Action'] === 'Order-Booked' || orderStatus === 'Filled' || orderStatus === 'Failed') {
                    // If order is booked
                    // Or order is filled
                    // Or order is failed (because of postOnly/reduceOnly making it fail)
                    // TODO: Handle errors (post-only failed, reduce-only failed, ...)
                    return true;
                }

                return false;
            },
            pollArgs: {
                maxRetries: 40,
                retryAfterMs: 500, // 40*500ms = 20s
            },
        });

        if (!finalMessage) {
            throw new Error(`createLimitOrder has failed. More infos: https://ao.link/#/message/${transferId}`);
        }

        return new PerpOrder({
            id: finalMessage.tags['X-Order-Id'],
            type: finalMessage.tags['X-Order-Type'] as OrderType, // casting type is not an issue because zod handles value checking
            side: finalMessage.tags['X-Order-Side'] as OrderSide, // casting type is not an issue because zod handles value checking
            status: finalMessage.tags['X-Order-Status'] as OrderStatus, // casting type is not an issue because zod handles value checking
            token: this.baseToken,
            originalQuantity: finalMessage.tags['X-Original-Quantity'],
            executedQuantity: finalMessage.tags['X-Executed-Quantity'],
        });
    }

    // async cancelOrder(orderId: string): Promise<PerpOrder | undefined> {
    //     // TODO: Order can fail to be canceled if orderId is invalid, or wallet is not owner of order
    // }

    // async getMarketPrice(): Promise<Price | undefined> {
    //     // TODO: MarketPrice = price of the last trade
    // }
}
