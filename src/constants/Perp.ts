import { PerpAccount, PerpMarket } from '../perp/Market';

const account = new PerpAccount({
    id: 'perp_account_id',
    tokenName: 'USD',
    tokenDenomination: 12,
});

export const Market = {
    BTC: new PerpMarket({
        id: 'btc_perp_market_id_000000000000000000000000', // TODO: SET REAL VALUES
        account,
        baseDenomination: 8,
        baseTicker: 'BTC',
        minPriceTickSize: 3, // ???
        minQuantityTickSize: 3, // ???
    }),
    ETH: new PerpMarket({
        id: 'eth_perp_market_id_000000000000000000000000', // TODO: SET REAL VALUES
        account,
        baseDenomination: 18,
        baseTicker: 'ETH',
        minPriceTickSize: 3, // ???
        minQuantityTickSize: 3, // ???
    }),
} as const;
