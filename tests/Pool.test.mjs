import { describe, it } from 'node:test';

import { Aetheris } from '../dist/index.js';

describe('Aetheris Pools', () => {
    it('Should have valid IDs', { todo: false }, ({ assert }) => {
        assert.strictEqual(/^[a-zA-Z0-9_-]{43}$/.test(Aetheris.Pools.AIR_EARTH.id), true);
        assert.strictEqual(/^[a-zA-Z0-9_-]{43}$/.test(Aetheris.Pools.FIRE_AIR.id), true);
        assert.strictEqual(/^[a-zA-Z0-9_-]{43}$/.test(Aetheris.Pools.FIRE_EARTH.id), true);
        assert.strictEqual(/^[a-zA-Z0-9_-]{43}$/.test(Aetheris.Pools.FIRE_WATER.id), true);
        assert.strictEqual(/^[a-zA-Z0-9_-]{43}$/.test(Aetheris.Pools.WATER_AIR.id), true);
        assert.strictEqual(/^[a-zA-Z0-9_-]{43}$/.test(Aetheris.Pools.WATER_EARTH.id), true);
    });
    it('Should have valid base/quote tokens', { todo: false }, ({ assert }) => {
        assert.strictEqual(Aetheris.Pools.AIR_EARTH.tokenBase.id, Aetheris.Tokens.AIR.id);
        assert.strictEqual(Aetheris.Pools.AIR_EARTH.tokenQuote.id, Aetheris.Tokens.EARTH.id);

        assert.strictEqual(Aetheris.Pools.FIRE_AIR.tokenBase.id, Aetheris.Tokens.FIRE.id);
        assert.strictEqual(Aetheris.Pools.FIRE_AIR.tokenQuote.id, Aetheris.Tokens.AIR.id);

        assert.strictEqual(Aetheris.Pools.FIRE_EARTH.tokenBase.id, Aetheris.Tokens.FIRE.id);
        assert.strictEqual(Aetheris.Pools.FIRE_EARTH.tokenQuote.id, Aetheris.Tokens.EARTH.id);

        assert.strictEqual(Aetheris.Pools.FIRE_WATER.tokenBase.id, Aetheris.Tokens.FIRE.id);
        assert.strictEqual(Aetheris.Pools.FIRE_WATER.tokenQuote.id, Aetheris.Tokens.WATER.id);

        assert.strictEqual(Aetheris.Pools.WATER_AIR.tokenBase.id, Aetheris.Tokens.WATER.id);
        assert.strictEqual(Aetheris.Pools.WATER_AIR.tokenQuote.id, Aetheris.Tokens.AIR.id);

        assert.strictEqual(Aetheris.Pools.WATER_EARTH.tokenBase.id, Aetheris.Tokens.WATER.id);
        assert.strictEqual(Aetheris.Pools.WATER_EARTH.tokenQuote.id, Aetheris.Tokens.EARTH.id);
    });
});
