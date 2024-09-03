import { describe, it } from 'node:test';

import { Token } from '../dist/index.js';

describe('Token', () => {
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
});
