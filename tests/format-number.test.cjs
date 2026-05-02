'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const Fmt = require(path.join(__dirname, '..', 'js', 'format-number.js'));

test('formatNumber maneja null, NaN y miles', () => {
    assert.strictEqual(Fmt.formatNumber(null), '0.00');
    assert.strictEqual(Fmt.formatNumber('1,234.5'), '1,234.50');
    assert.strictEqual(Fmt.formatNumber(Infinity), '0.00');
});
