'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const Fmt = require(path.join(__dirname, '..', 'js', 'format-number.js'));

test('formatNumber maneja null, NaN, miles y boolean', () => {
    assert.strictEqual(Fmt.formatNumber(null), '0.00');
    assert.strictEqual(Fmt.formatNumber('1,234.5'), '1,234.50');
    assert.strictEqual(Fmt.formatNumber(Infinity), '0.00');
    assert.strictEqual(Fmt.formatNumber(true), '0.00');
    assert.strictEqual(Fmt.formatNumber(undefined), '0.00');
    assert.strictEqual(Fmt.formatNumber(0), '0.00');
});

test('formatNumber acepta coma decimal es-MX', () => {
    assert.strictEqual(Fmt.formatNumber('11,4'), '11.40');
});
