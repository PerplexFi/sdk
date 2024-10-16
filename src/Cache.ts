import { z } from 'zod';

import { PerpMarket, PerpMarketSchema, Pool, PoolReserves, PoolSchema, Token, TokenSchema } from './types';
import { queryGraphQL } from './utils/graphql';
import { GetPoolsQuery, GetPoolsQueryData, GetTokensQuery, GetTokensQueryData } from './utils/perplexApi';

const PerplexCacheSchema = z.object({
    tokens: z.array(TokenSchema).optional(),
    pools: z.array(PoolSchema).optional(),
    perpMarkets: z.array(PerpMarketSchema).optional(),
});

export type PerplexCacheColdData = Required<z.infer<typeof PerplexCacheSchema>>;

export class PerplexCache {
    private _tokenInfos: Map<string, Token>;
    private _tokenBalances: Map<string, bigint>;
    private _poolInfos: Map<string, Pool>;
    private _poolReserves: Map<string, PoolReserves>;
    private _poolReservesLastFetchedAt: Map<string, Date>;
    private _perpMarketInfos: Map<string, PerpMarket>;

    constructor(data?: unknown) {
        const { tokens = [], pools = [], perpMarkets = [] } = data ? PerplexCacheSchema.parse(data) : {};

        this._tokenInfos = new Map(tokens.map((token) => [token.id, token]));
        this._tokenBalances = new Map();

        this._poolInfos = new Map(pools.map((pool) => [pool.id, pool]));
        this._poolReserves = new Map();
        this._poolReservesLastFetchedAt = new Map();

        this._perpMarketInfos = new Map(perpMarkets.map((perpMarket) => [perpMarket.id, perpMarket]));
        // account
    }

    public serialize(): PerplexCacheColdData {
        return {
            tokens: Array.from(this._tokenInfos.values()),
            pools: Array.from(this._poolInfos.values()),
            perpMarkets: Array.from(this._perpMarketInfos.values()),
        };
    }

    public async fetchTokensInfos(perplexApiUrl: string): Promise<void> {
        if (this._tokenInfos.size > 0) {
            // Do not fetch data if tokenInfos already exist
            return;
        }

        const { tokens } = await queryGraphQL<GetTokensQueryData>(perplexApiUrl, GetTokensQuery);

        for (const token of tokens) {
            this._tokenInfos.set(token.id, token);
        }
    }

    public async fetchPoolsInfos(perplexApiUrl: string): Promise<void> {
        if (this._poolInfos.size > 0) {
            // Do not fetch data if poolInfos already exist
            return;
        }

        const { ammPools } = await queryGraphQL<GetPoolsQueryData>(perplexApiUrl, GetPoolsQuery);

        for (const pool of ammPools) {
            this._poolInfos.set(pool.id, {
                id: pool.id,
                feeRate: Number(pool.feeRate),
                tokenBase: pool.base,
                tokenQuote: pool.quote,
                tokenLp: pool.lpToken,
            });
        }
    }

    public getToken(tokenId: string): Token | null {
        return this._tokenInfos.get(tokenId) ?? null;
    }

    public getTokens(): Token[] {
        return Array.from(this._tokenInfos.values());
    }

    public getPool(poolId: string): Pool | null {
        return this._poolInfos.get(poolId) ?? null;
    }

    public getPools(): Pool[] {
        return Array.from(this._poolInfos.values());
    }

    public getTokenBalance(tokenId: string): bigint | null {
        return this._tokenBalances.get(tokenId) ?? null;
    }

    public setTokenBalance(tokenId: string, balance: bigint): void {
        this._tokenBalances.set(tokenId, balance);
    }

    public getPoolReserves(poolId: string): PoolReserves | null {
        return this._poolReserves.get(poolId) ?? null;
    }

    public getPoolReservesLastFetchedAt(poolId: string): Date | null {
        return this._poolReservesLastFetchedAt.get(poolId) ?? null;
    }

    public setPoolReserves(poolId: string, reserves: PoolReserves): void {
        this._poolReserves.set(poolId, reserves);
        this._poolReservesLastFetchedAt.set(poolId, new Date());
    }

    public getPerpMarket(perpMarketId: string): PerpMarket | null {
        return this._perpMarketInfos.get(perpMarketId) ?? null;
    }
}
