'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');

const Calc = require(path.join(__dirname, '..', 'js', 'calc-core.js'));

test('validarNumero respeta mínimo y máximo', () => {
    assert.strictEqual(Calc.validarNumero('-5', 0, 100), 0);
    assert.strictEqual(Calc.validarNumero('150', 0, 100), 100);
    assert.strictEqual(Calc.validarNumero('12.5', 0, 100), 12.5);
});

test('calcularGastosEmbarque coherente con tipo de cambio', () => {
    const params = {
        tipo_cambio: 20,
        costo_aduana_embarque: 100,
        costo_carton_caja: 1,
        costo_empaque_caja_mxn: 20,
        costo_manejo_caja: 0.1
    };
    const ge = Calc.calcularGastosEmbarque(params, 20000, 1000);
    assert.ok(ge > 100);
});

test('calcularPrecioKg con datos mínimos', () => {
    const r = Calc.calcularPrecioKg(10, 10, 500, 100, 20, 10);
    assert.ok(typeof r === 'number');
    assert.ok(r >= 0);
});

test('config/app.json es JSON válido y tiene claves esperadas', () => {
    const raw = fs.readFileSync(path.join(__dirname, '..', 'config', 'app.json'), 'utf8');
    const cfg = JSON.parse(raw);
    assert.ok(Array.isArray(cfg.estadosDisponibles));
    assert.ok(cfg.storage.cotizadorDataV2);
    assert.ok(Array.isArray(cfg.camposPersistibles));
    assert.ok(cfg.camposPersistibles.includes('precio_venta'), 'precio_venta debe persistirse por estado');
    assert.ok(cfg.valoresPredeterminados && typeof cfg.valoresPredeterminados.tipo_cambio === 'number');
});
