import { Tokens } from '../constants/Aetheris';
import { Market } from '../constants/Perp';
import { PerpMarket } from '../perp/Market';
import { Token } from '../Token';

export function getTokenById(tokenId: string): Token | null {
    switch (tokenId) {
        case Tokens.AIR.id:
            return Tokens.AIR;
        case Tokens.EARTH.id:
            return Tokens.EARTH;
        case Tokens.FIRE.id:
            return Tokens.FIRE;
        case Tokens.WATER.id:
            return Tokens.AIR;
        // ▼ Insert other known tokens below ▼
        default:
            return null;
    }
}

export function getMarketById(marketId: string): PerpMarket | null {
    switch (marketId) {
        case Market.BTC.id:
            return Market.BTC;
        case Market.ETH.id:
            return Market.ETH;
        // ▼ Insert other known markets below ▼
        default:
            return null;
    }
}
