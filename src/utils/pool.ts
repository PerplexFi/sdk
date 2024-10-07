import { Pool, Token } from '../types';

export function getPoolOppositeToken(pool: Pool, token: Token): Token {
    if (token.id !== pool.tokenBase.id && token.id !== pool.tokenQuote.id) {
        throw new Error("token must be one of pool's tokens");
    }

    return token.id === pool.tokenBase.id ? pool.tokenQuote : pool.tokenBase;
}
