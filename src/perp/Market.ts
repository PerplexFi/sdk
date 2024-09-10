import { createDataItemSigner, dryrun, message } from '@permaweb/aoconnect';
import { z } from 'zod';

import { AoMessage, lookForMessage } from '../AoMessage';
import { Token, TokenQuantity } from '../Token';
import {
    OrderSide,
    ZodOrderSide,
    OrderStatus,
    ZodOrderStatus,
    OrderType,
    ZodOrderType,
    ZodArweaveId,
    ZodBint,
} from '../utils/zod';
import { PerpOrder } from './Order';
import { PerpPrice } from './Price';
import { PerpPosition } from './Position';
import { getMarketById, getTokenById } from '../utils/token';

const PerpAccountSchema = z.object({
    id: ZodArweaveId,
    tokenDenomination: z.number().int().gte(0),
    tokenName: z.string(),
});
type PerpAccountConstructor = z.infer<typeof PerpAccountSchema>;

function emptyArrayToEmptyObject(val: unknown): unknown {
    if (Array.isArray(val) && val.length === 0) {
        return {};
    }

    return val;
}

const AccountSummaryResponseSchema = z.object({
    collaterals: z.preprocess(emptyArrayToEmptyObject, z.record(z.string())),
    positions: z.preprocess(
        emptyArrayToEmptyObject,
        z.record(
            z.object({
                size: z.string(),
                fundingQty: z.string(),
                entryPrice: z.string(),
            }),
        ),
    ),
    orders: z.preprocess(
        emptyArrayToEmptyObject,
        z.record(
            z.preprocess(
                emptyArrayToEmptyObject,
                z.record(
                    z.object({
                        id: z.string(),
                        from: z.string(),
                        index: z.number().int(),
                        originalQty: z.string(),
                        executedQty: z.string(),
                        executedValue: z.string(),
                        type: ZodOrderType,
                        status: ZodOrderStatus,
                        side: ZodOrderSide,
                        price: z.string(),
                    }),
                ),
            ),
        ),
    ),
    marginDetails: z.object({
        totalMargin: ZodBint,
        marginBeforeLiquidation: ZodBint,
        marginAvailableForOrders: ZodBint,
        requiredInitialMargin: ZodBint,
        requiredMaintenanceMargin: ZodBint,
        unrealizedPnL: ZodBint,
    }),
});

type AccountSummary = {
    collaterals: Map<string, TokenQuantity>; // Key = tokenId
    positions: Map<string, PerpPosition>; // Key = marketId
    orders: Map<
        string, // Key = marketId
        Map<string, PerpOrder> // Key = orderId
    >;
    marginDetails: {
        marginAvailableForOrders: TokenQuantity; // in Account.TOKEN
        marginBeforeLiquidation: TokenQuantity; // in Account.TOKEN
        requiredInitialMargin: TokenQuantity; // in Account.TOKEN
        requiredMaintenanceMargin: TokenQuantity; // in Account.TOKEN
        totalMargin: TokenQuantity; // in Account.TOKEN
        unrealizedPnL: TokenQuantity; // in Account.TOKEN
    };
};

export class PerpAccount {
    #summaries: Map<string, { fetchedAt: Date; summary: AccountSummary }>;
    public readonly id: string;
    public readonly token: Token;

    constructor(params: PerpAccountConstructor) {
        const { id, tokenDenomination, tokenName } = PerpAccountSchema.parse(params);

        this.id = id;
        this.token = new Token(
            {
                id,
                name: tokenName,
                ticker: tokenName,
                denomination: tokenDenomination,
            },
            false,
        );
        this.#summaries = new Map();
    }

    async getSummary(wallet: string): Promise<AccountSummary> {
        const existingSummary = this.#summaries.get(wallet);
        if (existingSummary && Date.now() - existingSummary.fetchedAt.getTime() <= 60_000) {
            // Prevent updating the summary too often
            return existingSummary.summary;
        }

        const res = await dryrun({
            process: this.id,
            tags: AoMessage.makeTags({
                Action: 'Account-Summary',
                Target: wallet,
            }),
        });

        const data = res.Messages.at(0)?.Data;
        if (!data) {
            throw new Error('An error occured while fetching the account summary');
        }

        const summaryResponse = AccountSummaryResponseSchema.parse(JSON.parse(data));
        const summary: AccountSummary = {
            collaterals: new Map(
                Object.entries(summaryResponse.collaterals).map(([tokenId, quantity]) => {
                    const token =
                        getTokenById(tokenId) ??
                        new Token({
                            id: tokenId,
                            name: '_UNKNOWN_TOKEN_',
                            ticker: '???',
                            denomination: 0,
                        });

                    return [
                        tokenId,
                        new TokenQuantity({
                            token,
                            quantity: BigInt(quantity),
                        }),
                    ];
                }),
            ),
            positions: new Map(
                Object.entries(summaryResponse.positions).map(([marketId, positionData]) => {
                    const market = getMarketById(marketId);
                    if (!market) {
                        throw new Error('Market not found, make sure it is available in getMarketById');
                    }

                    return [
                        marketId,
                        new PerpPosition({
                            market,
                            entryPrice: positionData.entryPrice,
                            size: positionData.size,
                            fundingQuantity: positionData.fundingQty,
                        }),
                    ];
                }),
            ),
            orders: new Map(
                Object.entries(summaryResponse.orders).map(([marketId, ordersData]) => {
                    const market = getMarketById(marketId);
                    if (!market) {
                        throw new Error('Market not found, make sure it is available in getMarketById');
                    }

                    return [
                        marketId,
                        new Map(
                            Object.entries(ordersData).map(([orderId, orderData]) => [
                                orderId,
                                new PerpOrder({
                                    id: orderData.id,
                                    type: orderData.type,
                                    side: orderData.side,
                                    status: orderData.status,
                                    market,
                                    originalQuantity: orderData.originalQty,
                                    executedQuantity: orderData.executedQty,
                                    price: orderData.price,
                                }),
                            ]),
                        ),
                    ];
                }),
            ),
            marginDetails: {
                marginAvailableForOrders: new TokenQuantity({
                    token: this.token,
                    quantity: BigInt(summaryResponse.marginDetails.marginAvailableForOrders),
                }),
                marginBeforeLiquidation: new TokenQuantity({
                    token: this.token,
                    quantity: BigInt(summaryResponse.marginDetails.marginBeforeLiquidation),
                }),
                requiredInitialMargin: new TokenQuantity({
                    token: this.token,
                    quantity: BigInt(summaryResponse.marginDetails.requiredInitialMargin),
                }),
                requiredMaintenanceMargin: new TokenQuantity({
                    token: this.token,
                    quantity: BigInt(summaryResponse.marginDetails.requiredMaintenanceMargin),
                }),
                totalMargin: new TokenQuantity({
                    token: this.token,
                    quantity: BigInt(summaryResponse.marginDetails.totalMargin),
                }),
                unrealizedPnL: new TokenQuantity({
                    token: this.token,
                    quantity: BigInt(summaryResponse.marginDetails.unrealizedPnL),
                }),
            },
        };

        this.#summaries.set(wallet, { fetchedAt: new Date(), summary }); // Save summary for later use

        return summary;
    }
}

const PerpMarketSchema = z.object({
    id: ZodArweaveId,
    account: z.instanceof(PerpAccount),
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
        const { id, account, baseTicker, baseDenomination, minPriceTickSize, minQuantityTickSize } =
            PerpMarketSchema.parse(params);

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
        this.quoteToken = account.token;
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
                const orderStatus = msg.tags['X-Order-Status'] as OrderStatus;

                if (orderStatus === 'Filled' || orderStatus === 'Canceled' || orderStatus === 'Failed') {
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
            market: this,
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
                const orderStatus = msg.tags['X-Order-Status'] as OrderStatus;

                if (
                    msg.tags['Action'] === 'Order-Booked' ||
                    orderStatus === 'Filled' ||
                    orderStatus === 'Canceled' ||
                    orderStatus === 'Failed'
                ) {
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
            market: this,
            originalQuantity: finalMessage.tags['X-Original-Quantity'],
            executedQuantity: finalMessage.tags['X-Executed-Quantity'],
            price: finalMessage.tags['X-Order-Price'],
        });
    }

    // async cancelOrder(orderId: string): Promise<PerpOrder | undefined> {
    //     // TODO: Order can fail to be canceled if orderId is invalid, or wallet is not owner of order
    // }

    // async getMarketPrice(): Promise<Price | undefined> {
    //     // TODO: MarketPrice = price of the last trade
    // }
}
