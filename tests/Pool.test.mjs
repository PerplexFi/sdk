import { beforeEach, describe, it } from 'node:test';

import { Aetheris, Pool, Token } from '../dist/index.js';

describe('Aetheris Pools', () => {
    it('AIR_EARTH should have valid base/quote tokens', { todo: false }, ({ assert }) => {
        assert.strictEqual(Aetheris.Pools.AIR_EARTH.tokenBase.id, Aetheris.Tokens.AIR.id);
        assert.strictEqual(Aetheris.Pools.AIR_EARTH.tokenQuote.id, Aetheris.Tokens.EARTH.id);
    });
    it('FIRE_AIR should have valid base/quote tokens', { todo: false }, ({ assert }) => {
        assert.strictEqual(Aetheris.Pools.FIRE_AIR.tokenBase.id, Aetheris.Tokens.FIRE.id);
        assert.strictEqual(Aetheris.Pools.FIRE_AIR.tokenQuote.id, Aetheris.Tokens.AIR.id);
    });
    it('FIRE_EARTH should have valid base/quote tokens', { todo: false }, ({ assert }) => {
        assert.strictEqual(Aetheris.Pools.FIRE_EARTH.tokenBase.id, Aetheris.Tokens.FIRE.id);
        assert.strictEqual(Aetheris.Pools.FIRE_EARTH.tokenQuote.id, Aetheris.Tokens.EARTH.id);
    });
    it('FIRE_WATER should have valid base/quote tokens', { todo: false }, ({ assert }) => {
        assert.strictEqual(Aetheris.Pools.FIRE_WATER.tokenBase.id, Aetheris.Tokens.FIRE.id);
        assert.strictEqual(Aetheris.Pools.FIRE_WATER.tokenQuote.id, Aetheris.Tokens.WATER.id);
    });
    it('WATER_AIR should have valid base/quote tokens', { todo: false }, ({ assert }) => {
        assert.strictEqual(Aetheris.Pools.WATER_AIR.tokenBase.id, Aetheris.Tokens.WATER.id);
        assert.strictEqual(Aetheris.Pools.WATER_AIR.tokenQuote.id, Aetheris.Tokens.AIR.id);
    });
    it('WATER_EARTH should have valid base/quote tokens', { todo: false }, ({ assert }) => {
        assert.strictEqual(Aetheris.Pools.WATER_EARTH.tokenBase.id, Aetheris.Tokens.WATER.id);
        assert.strictEqual(Aetheris.Pools.WATER_EARTH.tokenQuote.id, Aetheris.Tokens.EARTH.id);
    });
});

describe('new Pool()', () => {
    it('should throw if constructor receives invalid id', ({ assert }) => {
        assert.throws(
            () =>
                new Pool({
                    id: 'invalidId',
                    tokenBase: Aetheris.Tokens.AIR,
                    tokenQuote: Aetheris.Tokens.WATER,
                    feeRate: 0.01,
                }),
        );
    });
    it('should throw if constructor receives invalid token', ({ assert }) => {
        assert.throws(
            () =>
                new Pool({
                    id: '0000000000000000000000000000000000000000000',
                    tokenBase: {
                        id: 'asdasd',
                        name: 'fake token',
                        ticker: 'fake',
                        denomination: 12,
                        fromReadable: () => '',
                        balanceOf: () => '',
                    },
                    tokenQuote: Aetheris.Tokens.AIR,
                    feeRate: 0.01,
                }),
        );
        assert.throws(
            () =>
                new Pool({
                    id: '0000000000000000000000000000000000000000000',
                    tokenBase: Aetheris.Tokens.AIR,
                    tokenQuote: {
                        id: 'asdasd',
                        name: 'fake token',
                        ticker: 'fake',
                        denomination: 12,
                        fromReadable: () => '',
                        balanceOf: () => '',
                    },
                    feeRate: 0.01,
                }),
        );
    });
    it('should throw if constructor receives same token twice', ({ assert }) => {
        assert.throws(
            () =>
                new Pool({
                    id: '0000000000000000000000000000000000000000000',
                    tokenBase: Aetheris.Tokens.AIR,
                    tokenQuote: Aetheris.Tokens.AIR,
                    feeRate: 0.01,
                }),
        );
    });
    it('should throw if constructor receives invalid feeRate', ({ assert }) => {
        assert.throws(
            () =>
                new Pool({
                    id: '0000000000000000000000000000000000000000000',
                    tokenBase: Aetheris.Tokens.AIR,
                    tokenQuote: Aetheris.Tokens.WATER,
                    feeRate: -1,
                }),
        );
    });
});

describe('pool.getExpectedOutput()', () => {
    const tokenBase = new Token({
        id: '1111111111111111111111111111111111111111111',
        name: 'TokenBase',
        ticker: 'BASE',
        denomination: 9,
    });
    const tokenQuote = new Token({
        id: '2222222222222222222222222222222222222222222',
        name: 'TokenQuote',
        ticker: 'QUOTE',
        denomination: 12,
    });

    const pool = new Pool({
        id: '0000000000000000000000000000000000000000000',
        tokenBase,
        tokenQuote,
        feeRate: 0, // no fees
    });

    beforeEach(() => {
        pool.reserves = {
            base: tokenBase.fromReadable('725.695682'),
            quote: tokenQuote.fromReadable('380.750899'),
        };
    });

    it('should return the right quantity of the right token', ({ assert }) => {
        const input = tokenQuote.fromReadable('3.5559');
        const expectedOutput = pool.getExpectedOutput(input, 0); // 0% slippage tolerance, aka. real expected output

        assert.ok(expectedOutput.equals(tokenBase.fromReadable('6.714690665')));
    });
});
