'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const Numeric = require(path.join(__dirname, '..', 'js', 'numeric.js'));

test('parseFlexible: coma decimal es-MX', () => {
    assert.strictEqual(Numeric.parseFlexible('11,4'), 11.4);
    assert.strictEqual(Numeric.parseFlexible('1,5'), 1.5);
});

test('parseFlexible: punto decimal en-US', () => {
    assert.strictEqual(Numeric.parseFlexible('11.4'), 11.4);
});

test('parseFlexible: ambos separadores, ultimo es decimal', () => {
    assert.strictEqual(Numeric.parseFlexible('1,234.5'), 1234.5);
    assert.strictEqual(Numeric.parseFlexible('1.234,5'), 1234.5);
});

test('parseFlexible: solo miles cuando hay multiples del mismo separador', () => {
    assert.strictEqual(Numeric.parseFlexible('1,234,567'), 1234567);
    assert.strictEqual(Numeric.parseFlexible('1.234.567'), 1234567);
});

test('parseFlexible: vacio, null, boolean -> NaN', () => {
    assert.ok(Number.isNaN(Numeric.parseFlexible('')));
    assert.ok(Number.isNaN(Numeric.parseFlexible(null)));
    assert.ok(Number.isNaN(Numeric.parseFlexible(true)));
    assert.ok(Number.isNaN(Numeric.parseFlexible(undefined)));
});

test('parseFlexible: trunca cadenas largas', () => {
    const longStr = '9'.repeat(100);
    const r = Numeric.parseFlexible(longStr);
    assert.ok(typeof r === 'number');
    assert.ok(isFinite(r));
});

test('parseFlexible: maneja signos', () => {
    assert.strictEqual(Numeric.parseFlexible('-1.5'), -1.5);
    assert.strictEqual(Numeric.parseFlexible('+1.5'), 1.5);
});

test('validarNumero: aplica clamp y devuelve min en NaN', () => {
    assert.strictEqual(Numeric.validarNumero('-5', 0, 100), 0);
    assert.strictEqual(Numeric.validarNumero('150', 0, 100), 100);
    assert.strictEqual(Numeric.validarNumero('11,4', 0, 100), 11.4);
    assert.strictEqual(Numeric.validarNumero('', 0.01), 0.01);
    assert.strictEqual(Numeric.validarNumero('abc', 5), 5);
});

test('formatNumber: locale en-US, 2 decimales', () => {
    assert.strictEqual(Numeric.formatNumber(null), '0.00');
    assert.strictEqual(Numeric.formatNumber('1,234.5'), '1,234.50');
    assert.strictEqual(Numeric.formatNumber('1.234,5'), '1,234.50');
    assert.strictEqual(Numeric.formatNumber(Infinity), '0.00');
    assert.strictEqual(Numeric.formatNumber(true), '0.00');
});

test('formatInputLive: agrega miles sin perder decimales en escritura', () => {
    assert.strictEqual(Numeric.formatInputLive('1234'), '1,234');
    assert.strictEqual(Numeric.formatInputLive('1234.5'), '1,234.5');
    // Cuando solo hay una coma con < 3 digitos despues, se trata como decimal
    // y se normaliza a punto (formato de salida unico).
    assert.strictEqual(Numeric.formatInputLive('1234,5'), '1,234.5');
    // Mixto es-MX 1.234,5 -> entera 1234, decimal 5 -> 1,234.5
    assert.strictEqual(Numeric.formatInputLive('1.234,5'), '1,234.5');
    assert.strictEqual(Numeric.formatInputLive(''), '');
    // Multiples comas se interpretan como miles -> se eliminan ambas
    assert.strictEqual(Numeric.formatInputLive('1,234,567'), '1,234,567');
});

test('formatInputLive: preserva separador decimal trailing (escritura en curso)', () => {
    // Bug reportado: al teclear "1." el punto se borraba inmediatamente y
    // el usuario nunca podia llegar a "1.5".
    assert.strictEqual(Numeric.formatInputLive('1.'), '1.');
    assert.strictEqual(Numeric.formatInputLive('1,'), '1.');
    assert.strictEqual(Numeric.formatInputLive('1234.'), '1,234.');
    assert.strictEqual(Numeric.formatInputLive('0.'), '0.');
    assert.strictEqual(Numeric.formatInputLive('.'), '0.');
    assert.strictEqual(Numeric.formatInputLive('.5'), '0.5');
});

test('parseFlexible: tolera decimal trailing como cero', () => {
    assert.strictEqual(Numeric.parseFlexible('1.'), 1);
    assert.strictEqual(Numeric.parseFlexible('1,'), 1);
    assert.strictEqual(Numeric.parseFlexible('1234.'), 1234);
    assert.strictEqual(Numeric.parseFlexible('0.'), 0);
});

test('parseFlexible: 1,000 con 3 digitos despues es miles (en-US)', () => {
    assert.strictEqual(Numeric.parseFlexible('1,000'), 1000);
    assert.strictEqual(Numeric.parseFlexible('10,000'), 10000);
});
