import { Pool } from '../Pool';
import { Token } from '../Token';

export const Tokens = {
    AIR: new Token({
        id: '2nfFJb8LIA69gwuLNcFQezSuw4CXPE4--U-j-7cxKOU',
        name: 'Air',
        ticker: 'AIR',
        denomination: 12,
    }),
    EARTH: new Token({
        id: 'PBg5TSJPQp9xgXGfjN27GA28Mg5bQmNEdXH2TXY4t-A',
        name: 'Earth',
        ticker: 'EARTH',
        denomination: 12,
    }),
    FIRE: new Token({
        id: 'KmGmJieqSRJpbW6JJUFQrH3sQPEG9F6DQETlXNt4GpM',
        name: 'Fire',
        ticker: 'FIRE',
        denomination: 12,
    }),
    WATER: new Token({
        id: 'x7B1WmMJxh9UxRttjQ_gPZxI1BuLDmQzk3UDNgmqojM',
        name: 'Water',
        ticker: 'WATER',
        denomination: 12,
    }),
} as const;

export const Pools = {
    AIR_EARTH: new Pool({
        id: 'z3EwEzjSZGc5aJjNaaaWPQ0StgskHdUoR6hTzu4OVKM',
        tokenBase: Tokens.AIR,
        tokenQuote: Tokens.EARTH,
        feeRate: 0.003,
    }),
    FIRE_AIR: new Pool({
        id: '4nnKkA_2bH_Im_EfXdoW3ZppD-kBLFPz07hln2OtHXg',
        tokenBase: Tokens.FIRE,
        tokenQuote: Tokens.AIR,
        feeRate: 0.003,
    }),
    FIRE_EARTH: new Pool({
        id: 'NkXX3uZ4oGkQ3DPAWtjLb2sTA-yxmZKdlOlEHqMfWLQ',
        tokenBase: Tokens.FIRE,
        tokenQuote: Tokens.EARTH,
        feeRate: 0.003,
    }),
    FIRE_WATER: new Pool({
        id: '8ZnmV8jZPKESc7oJwZDTVUl_bQpZWikqpACDAvO2I5A',
        tokenBase: Tokens.FIRE,
        tokenQuote: Tokens.WATER,
        feeRate: 0.003,
    }),
    WATER_AIR: new Pool({
        id: 'SGfyty-ODGDIRlpH3r-C9sSrLXGLkDhNWbsmFVUtuAw',
        tokenBase: Tokens.WATER,
        tokenQuote: Tokens.AIR,
        feeRate: 0.003,
    }),
    WATER_EARTH: new Pool({
        id: '9cN9J5DA_Jdul85jTGZXq3M3P4xZY1wDQ7dED4SnGWI',
        tokenBase: Tokens.WATER,
        tokenQuote: Tokens.EARTH,
        feeRate: 0.003,
    }),
} as const;
