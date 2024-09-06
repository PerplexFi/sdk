import { createDataItemSigner, message } from '@permaweb/aoconnect';
import { z } from 'zod';

import { Token, TokenQuantity } from '../Token';
import { ArweaveIdRegex } from '../utils/arweave';
import { PerpOrder } from './Order';
import { lookForMessage } from '../AoMessage';
import { OrderSide, OrderStatus, OrderType } from '../utils/order';

const PerpAccountSchema = z
    .object({
        id: z.string().regex(ArweaveIdRegex, 'Must be a valid AO process ID'),
        baseToken: z.instanceof(Token),
    })
    .refine((params) => params.baseToken.id === params.id);
type PerpAccountConstructor = z.infer<typeof PerpAccountSchema>;

export class PerpAccount {
    public readonly id: string;
    public readonly baseToken: Token;

    constructor(params: PerpAccountConstructor) {
        const { id, baseToken } = PerpAccountSchema.parse(params);

        this.id = id;
        this.baseToken = baseToken;
    }

    // async getSummary(wallet: string): Promise<AccountSummary> {
    // }
}

const PerpMarketSchema = z.object({
    id: z.string().regex(ArweaveIdRegex, 'Must be a valid AO process ID'),
    baseTicker: z.string(),
    baseDenomination: z.number().int().gte(0),
    account: z.instanceof(PerpAccount),
    minPriceTickSize: z.number().int().gte(0),
    minQuantityTickSize: z.number().int().gte(0),
});
type PerpMarketConstructor = z.infer<typeof PerpMarketSchema>;

export class PerpMarket {
    public readonly id: string;
    public readonly baseToken: Token;
    public readonly account: PerpAccount;
    public readonly minPriceTickSize: number;
    public readonly minQuantityTickSize: number;

    constructor(params: PerpMarketConstructor) {
        const { id, baseTicker, baseDenomination, account, minPriceTickSize, minQuantityTickSize } =
            PerpMarketSchema.parse(params);

        this.id = id;
        this.baseToken = new Token({ id, name: baseTicker, ticker: baseTicker, denomination: baseDenomination }, false);
        this.account = account;
        this.minPriceTickSize = minPriceTickSize;
        this.minQuantityTickSize = minQuantityTickSize;
    }

    // priceFromReadable(price: string): Price {
    // }

    // async getOpenOrders(wallet: string): Promise<PerpOrder[]> {
    // }

    // async getOrderbook(): Promise<Orderbook> {
    // }

    async createMarketOrder(args: {
        signer: ReturnType<typeof createDataItemSigner>;
        side: 'Buy' | 'Sell';
        size: TokenQuantity;
        reduceOnly?: boolean;
    }): Promise<PerpOrder> {
        const tags = PerpOrder.forgeCreateMarketTags({
            marketId: this.id,
            side: args.side,
            size: args.size,
            reduceOnly: args.reduceOnly,
        });

        if (args.size.token.id !== this.baseToken.id) {
            throw new Error('Perp orders are only expressed in Base');
        }

        const transferId = await message({
            signer: args.signer,
            process: this.account.id,
            tags,
        });

        // look for all messages
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
            baseToken: this.baseToken,
            originalQuantity: finalMessage.tags['X-Original-Quantity'],
            executedQuantity: finalMessage.tags['X-Executed-Quantity'],
        });
    }

    // async createLimitOrder(): Promise<PerpOrder> {
    // }

    // async cancelOrder(orderId: string): Promise<PerpOrder | undefined> {
    //     // TODO: Order can fail to be canceled if orderId is invalid, or wallet is not owner of order
    // }

    // async getMarketPrice(): Promise<Price | undefined> {
    //     // TODO: MarketPrice = price of the last trade
    // }
}
