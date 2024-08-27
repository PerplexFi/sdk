import { Pool } from './Pool';
import { Token } from './Token';

export const KnownTokens = {
    FIRE: new Token('KmGmJieqSRJpbW6JJUFQrH3sQPEG9F6DQETlXNt4GpM', 'Fire', 'FIRE', 12),
    EARTH: new Token('PBg5TSJPQp9xgXGfjN27GA28Mg5bQmNEdXH2TXY4t-A', 'Earth', 'EARTH', 12),
    AIR: new Token('2nfFJb8LIA69gwuLNcFQezSuw4CXPE4--U-j-7cxKOU', 'Air', 'AIR', 12),
    WATER: new Token('x7B1WmMJxh9UxRttjQ_gPZxI1BuLDmQzk3UDNgmqojM', 'Water', 'WATER', 12),
} as const;

export const KnownPools = {
    FIRE_EARTH: new Pool('NkXX3uZ4oGkQ3DPAWtjLb2sTA-yxmZKdlOlEHqMfWLQ', KnownTokens.FIRE, KnownTokens.EARTH, 0.003),
    AIR_EARTH: new Pool('z3EwEzjSZGc5aJjNaaaWPQ0StgskHdUoR6hTzu4OVKM', KnownTokens.AIR, KnownTokens.EARTH, 0.003),
    FIRE_AIR: new Pool('4nnKkA_2bH_Im_EfXdoW3ZppD-kBLFPz07hln2OtHXg', KnownTokens.FIRE, KnownTokens.AIR, 0.003),
    WATER_EARTH: new Pool('9cN9J5DA_Jdul85jTGZXq3M3P4xZY1wDQ7dED4SnGWI', KnownTokens.WATER, KnownTokens.EARTH, 0.003),
    WATER_AIR: new Pool('SGfyty-ODGDIRlpH3r-C9sSrLXGLkDhNWbsmFVUtuAw', KnownTokens.WATER, KnownTokens.AIR, 0.003),
    FIRE_WATER: new Pool('8ZnmV8jZPKESc7oJwZDTVUl_bQpZWikqpACDAvO2I5A', KnownTokens.FIRE, KnownTokens.WATER, 0.003),
} as const;
