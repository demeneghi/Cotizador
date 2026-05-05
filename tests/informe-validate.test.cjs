'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const Inv = require(path.join(__dirname, '..', 'js', 'informe-validate.js'));

function pasoBase(i) {
    return {
        titulo: 'Paso ' + i,
        badge: 'B',
        formula: 'f',
        resultado: 'r',
        label: 'L'
    };
}

function informeValido() {
    var calcCorto = [];
    var calcLargo = [];
    for (var i = 0; i < Inv.MIN_PASOS_INFORME; i++) {
        calcCorto.push(pasoBase(i));
        calcLargo.push(pasoBase(i));
    }
    calcCorto[Inv.MIN_PASOS_INFORME - 1].final = true;
    calcLargo[Inv.MIN_PASOS_INFORME - 1].final = true;
    return {
        schemaVersion: 2,
        fecha: '1 de mayo de 2026',
        hora: '12:00',
        estado: 'Veracruz',
        precioVenta: 10,
        tipoCambio: 20,
        precioKgCorto: 1,
        precioKgLargo: 2,
        calcCorto: calcCorto,
        calcLargo: calcLargo,
        parametros: [{ nombre: 'N', valor: 'V' }]
    };
}

test('validateInforme acepta informe bien formado', () => {
    assert.strictEqual(Inv.validateInforme(informeValido(), 2), true);
});

test('validateInforme rechaza precio negativo o pocos pasos', () => {
    var bad = informeValido();
    bad.precioVenta = -1;
    assert.strictEqual(Inv.validateInforme(bad, 2), false);
    var short = informeValido();
    short.calcCorto = short.calcCorto.slice(0, 3);
    assert.strictEqual(Inv.validateInforme(short, 2), false);
});

test('validateInforme rechaza schemaVersion inesperado y acepta legacy (undefined o 1)', () => {
    var o = informeValido();
    o.schemaVersion = 99;
    assert.strictEqual(Inv.validateInforme(o, 2), false);
    var o2 = informeValido();
    delete o2.schemaVersion;
    assert.strictEqual(Inv.validateInforme(o2, 2), true);
    var o3 = informeValido();
    o3.schemaVersion = 1;
    assert.strictEqual(Inv.validateInforme(o3, 2), true);
});

test('validateInforme rechaza strings demasiado largos (DoS por enlace)', () => {
    var o = informeValido();
    o.calcCorto[0].titulo = 'x'.repeat(Inv.LIMITS.titulo + 1);
    assert.strictEqual(Inv.validateInforme(o, 2), false);

    var o2 = informeValido();
    o2.calcLargo[2].formula = 'y'.repeat(Inv.LIMITS.formula + 1);
    assert.strictEqual(Inv.validateInforme(o2, 2), false);

    var o3 = informeValido();
    o3.fecha = 'z'.repeat(Inv.LIMITS.fecha + 1);
    assert.strictEqual(Inv.validateInforme(o3, 2), false);
});

test('validateInforme rechaza demasiados pasos o parametros', () => {
    var o = informeValido();
    for (var i = 0; i < Inv.MAX_PASOS_INFORME + 1; i++) o.calcCorto.push(pasoBase(i));
    assert.strictEqual(Inv.validateInforme(o, 2), false);

    var o2 = informeValido();
    var many = [];
    for (var j = 0; j < Inv.MAX_PARAMETROS_INFORME + 1; j++) many.push({ nombre: 'N', valor: 'V' });
    o2.parametros = many;
    assert.strictEqual(Inv.validateInforme(o2, 2), false);
});

test('validateInforme rechaza numeros no finitos o gigantes', () => {
    var o = informeValido();
    o.precioVenta = 1e15;
    assert.strictEqual(Inv.validateInforme(o, 2), false);
    var o2 = informeValido();
    o2.tipoCambio = Infinity;
    assert.strictEqual(Inv.validateInforme(o2, 2), false);
});
