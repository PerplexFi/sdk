import { describe, it } from 'node:test';

import { Token } from '../dist/index.js';

describe('new Token()', () => {
    it('should throw if constructor receives invalid id', ({ assert }) => {
        assert.throws(
            () =>
                new Token({
                    id: 'invalid_id',
                    name: 'name',
                    ticker: 'ticker',
                    denomination: 9,
                }),
        );
    });
    it('should throw if constructor receives invalid name', ({ assert }) => {
        assert.throws(
            () =>
                new Token({
                    id: '0000000000000000000000000000000000000000000',
                    name: 0,
                    ticker: 'ticker',
                    denomination: 9,
                }),
        );
    });
    it('should throw if constructor receives invalid ticker', ({ assert }) => {
        assert.throws(
            () =>
                new Token({
                    id: '0000000000000000000000000000000000000000000',
                    name: 'name',
                    ticker: 0,
                    denomination: 9,
                }),
        );
    });
    it('should throw if constructor receives invalid denomination', ({ assert }) => {
        assert.throws(
            () =>
                new Token({
                    id: '0000000000000000000000000000000000000000000',
                    name: 'name',
                    ticker: 'ticker',
                    denomination: -1,
                }),
        );
    });
    it('should throw if constructor receives invalid logo', ({ assert }) => {
        assert.throws(
            () =>
                new Token({
                    id: '0000000000000000000000000000000000000000000',
                    name: 'name',
                    ticker: 'ticker',
                    denomination: 6,
                    logo: 'invalid_logo',
                }),
        );
    });
});

describe('token.fromReadable()', () => {
    it('should return the right TokenQuantity based on the denomination', ({ assert }) => {
        const token = new Token({
            id: '0000000000000000000000000000000000000000000',
            name: 'test token',
            ticker: 'TEST',
            denomination: 15,
        });
        const tokenQuantity = token.fromReadable('1.23456');

        assert.strictEqual(tokenQuantity.token.id, token.id);
        assert.strictEqual(tokenQuantity.quantity, 1_234_560_000_000_000n);
    });
});
