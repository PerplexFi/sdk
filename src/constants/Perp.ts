import { PerpAccount, PerpMarket } from '../Perp';

const account = new PerpAccount({
    id: 'PaYijAXMDe4MhFBCJLHM-7uVOg6URFswqBv-JKUcM3k', // TODO: SET REAL VALUE
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
        id: 'RE6V73EGExHhMMERTkv-ufJfWle0GOGKILhJf3VSMEg', // TODO: SET REAL VALUES
        account,
        baseDenomination: 12,
        baseTicker: 'ETH',
        minPriceTickSize: 10, // ???
        minQuantityTickSize: 8, // ???
    }),
} as const;
