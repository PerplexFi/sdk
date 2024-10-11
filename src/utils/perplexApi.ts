import { OrderBook, OrderBookSchema, PerpMarket, Pool, Token } from '../types';
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

const GetTokensQuery = gql(`
    ${TokenFragment}

    query tokens {
        tokens {
            ...TokenFragment
        } 
    }
`);

type GetTokensQueryData = {
    tokens: TokenFragmentData[];
};

export async function fetchAllTokens(perplexApiUrl: string): Promise<Token[]> {
    const { tokens } = await queryGraphQL<GetTokensQueryData>(perplexApiUrl, GetTokensQuery, {});

    return tokens;
}

const GetPoolsQuery = gql(`
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
        } 
    }
`);

type GetPoolsQueryData = {
    ammPools: {
        id: string;
        feeRate: string;
        base: TokenFragmentData;
        quote: TokenFragmentData;
    }[];
};

export async function fetchAllPools(perplexApiUrl: string): Promise<Pool[]> {
    const { ammPools } = await queryGraphQL<GetPoolsQueryData>(perplexApiUrl, GetPoolsQuery, {});

    return ammPools.map((pool) => ({
        id: pool.id,
        feeRate: Number(pool.feeRate),
        tokenBase: pool.base,
        tokenQuote: pool.quote,
    }));
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
    const { markets } = await queryGraphQL<GetPerpMarketsQueryData>(perplexApiUrl, GetPerpMarketsQuery, {});

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
