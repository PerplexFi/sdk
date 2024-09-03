import { describe, it } from 'node:test';

import { Aetheris } from '../dist/index.js';

describe('Aetheris Tokens', () => {
    it('Should have valid IDs', { todo: false }, ({ assert }) => {
        assert.strictEqual(/^[a-zA-Z0-9_-]{43}$/.test(Aetheris.Tokens.AIR.id), true);
        assert.strictEqual(/^[a-zA-Z0-9_-]{43}$/.test(Aetheris.Tokens.EARTH.id), true);
        assert.strictEqual(/^[a-zA-Z0-9_-]{43}$/.test(Aetheris.Tokens.FIRE.id), true);
        assert.strictEqual(/^[a-zA-Z0-9_-]{43}$/.test(Aetheris.Tokens.WATER.id), true);
    });
    it('Should have valid names', { todo: false }, ({ assert }) => {
        assert.strictEqual(Aetheris.Tokens.AIR.name, 'Air');
        assert.strictEqual(Aetheris.Tokens.EARTH.name, 'Earth');
        assert.strictEqual(Aetheris.Tokens.FIRE.name, 'Fire');
        assert.strictEqual(Aetheris.Tokens.WATER.name, 'Water');
    });
    it('Should have valid tickers', { todo: false }, ({ assert }) => {
        assert.strictEqual(Aetheris.Tokens.AIR.ticker, 'AIR');
        assert.strictEqual(Aetheris.Tokens.EARTH.ticker, 'EARTH');
        assert.strictEqual(Aetheris.Tokens.FIRE.ticker, 'FIRE');
        assert.strictEqual(Aetheris.Tokens.WATER.ticker, 'WATER');
    });
});
