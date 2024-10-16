import { OrderBook, OrderBookSchema, PerpMarket } from '../types';
import { gql, queryGraphQL } from './graphql';
import { decimalToBigInt } from './numbers';

const TokenFragment = gql(`
    fragment TokenFragment on Token {
        id
        name
        ticker
        denomination
        logo
    }
`);

type TokenFragmentData = {
    id: string;
    name: string;
    ticker: string;
    denomination: number;
    logo: string | null;
};

export const GetTokensQuery = gql(`
    ${TokenFragment}

    query tokens {
        tokens {
            ...TokenFragment
        } 
    }
`);

export type GetTokensQueryData = {
    tokens: TokenFragmentData[];
};

export const GetPoolsQuery = gql(`
    ${TokenFragment}

    query pools {
        ammPools {
            id
            feeRate
            base {
                ...TokenFragment
            }
            quote {
                ...TokenFragment
            }
            lpToken {
                ...TokenFragment
            }
        } 
    }
`);

export type GetPoolsQueryData = {
    ammPools: {
        id: string;
        feeRate: string;
        base: TokenFragmentData;
        quote: TokenFragmentData;
        lpToken: TokenFragmentData;
    }[];
};

const GetLatestFundingRateQuery = gql(`
    query latestFundingRate($marketId: ID!) {
        latestFundingRate(marketId: $marketId)
    }
`);

type GetLatestFundingRateQueryVariables = {
    marketId: string;
};

type GetLatestFundingRateQueryData = {
    latestFundingRate: string | null;
};

export async function fetchLatestFundingRate(perplexApiUrl: string, marketId: string): Promise<string | null> {
    const { latestFundingRate } = await queryGraphQL<GetLatestFundingRateQueryData, GetLatestFundingRateQueryVariables>(
        perplexApiUrl,
        GetLatestFundingRateQuery,
        { marketId },
    );

    return latestFundingRate;
}

const GetPerpMarketsQuery = gql(`
    query perpMarkets {
        markets(marketType: PERP) {
            ... on PerpMarket {
                id
                minPriceTickSize
                minQuantityTickSize
                makerFeeRate
                takerFeeRate
                oraclePrice
                base {
                    ticker
                    denomination
                    logo
                }
                quote {
                    id
                    denomination
                }
            }
        } 
    }
`);

type GetPerpMarketsQueryData = {
    markets: {
        id: string;
        minPriceTickSize: string;
        minQuantityTickSize: string;
        makerFeeRate: string;
        takerFeeRate: string;
        oraclePrice: string;
        base: {
            ticker: string;
            denomination: number;
            logo: string | null;
        };
        quote: {
            id: string;
            denomination: number;
        };
    }[];
};

export async function fetchAllPerpMarkets(perplexApiUrl: string): Promise<PerpMarket[]> {
    const { markets } = await queryGraphQL<GetPerpMarketsQueryData>(perplexApiUrl, GetPerpMarketsQuery);

    return markets.map((market) => ({
        id: market.id,
        accountId: market.quote.id,
        baseTicker: market.base.ticker,
        baseDenomination: market.base.denomination,
        minPriceTickSize: decimalToBigInt(market.minPriceTickSize, market.quote.denomination),
        minQuantityTickSize: decimalToBigInt(market.minQuantityTickSize, market.base.denomination),
        oraclePrice: BigInt(market.oraclePrice),
    }));
}

const GetMarketDepthQuery = gql(`
    query marketDepth($marketId: ID!) {
        marketDepth(marketId: $marketId) {
            asks {
                price
                size
            }
            bids {
                price
                size
            }
        }
    }
`);

type GetMarketDepthQueryVariables = {
    marketId: string;
};

type GetMarketDepthQueryData = {
    marketDepth: {
        asks: {
            price: string;
            size: string;
        }[];
        bids: {
            price: string;
            size: string;
        }[];
    };
};

export async function fetchOrderBook(perplexApiUrl: string, marketId: string): Promise<OrderBook> {
    const { marketDepth } = await queryGraphQL<GetMarketDepthQueryData, GetMarketDepthQueryVariables>(
        perplexApiUrl,
        GetMarketDepthQuery,
        { marketId },
    );

    return OrderBookSchema.parse({
        asks: marketDepth.asks.map(({ price, size }) => ({
            price: BigInt(price),
            size: BigInt(size),
        })),
        bids: marketDepth.bids.map(({ price, size }) => ({
            price: BigInt(price),
            size: BigInt(size),
        })),
    });
}

const GetPositionsQuery = gql(`
    query positions($wallet: String!) {
        positions(wallet: $wallet, limit: 100) {
            size
            fundingQuantity
            entryPrice
            market {
                id
            }
        }
    }
`);

type GetPositionsQueryVariables = {
    wallet: string;
};

type GetPositionsQueryData = {
    positions: {
        size: string;
        fundingQuantity: string;
        entryPrice: string;
        market: {
            id: string;
        };
    }[];
};

export async function fetchAllPositions(
    perplexApiUrl: string,
    wallet: string,
): Promise<GetPositionsQueryData['positions']> {
    const { positions } = await queryGraphQL<GetPositionsQueryData, GetPositionsQueryVariables>(
        perplexApiUrl,
        GetPositionsQuery,
        { wallet },
    );

    return positions;
}
