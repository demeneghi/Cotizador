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
    assert.ok(cfg.storage.cotizadorPonderadoV1, 'storage.cotizadorPonderadoV1 debe estar definido');
    assert.ok(cfg.ponderado && Array.isArray(cfg.ponderado.calibres));
    assert.strictEqual(cfg.ponderado.calibres.length, 6, 'deben ser 6 calibres');
    assert.strictEqual(typeof cfg.ponderado.tolerancia_suma_pct, 'number');
});

test('calcularPrecioPonderado: caso de la imagen suma 9.9', () => {
    const r = Calc.calcularPrecioPonderado([
        { porcentaje: 5,  precio: 9 },
        { porcentaje: 50, precio: 9 },
        { porcentaje: 30, precio: 11 },
        { porcentaje: 10, precio: 11 },
        { porcentaje: 5,  precio: 11 },
        { porcentaje: 0,  precio: 9 }
    ]);
    assert.strictEqual(r.sumaPct, 100);
    assert.ok(Math.abs(r.total - 9.9) < 1e-9, 'total esperado ≈ 9.9, recibido ' + r.total);
    assert.strictEqual(r.ponderaciones.length, 6);
    assert.ok(Math.abs(r.ponderaciones[0] - 0.45) < 1e-9);
    assert.strictEqual(r.ponderaciones[5], 0);
});

test('calcularPrecioPonderado: vacios y array sin elementos', () => {
    assert.deepStrictEqual(Calc.calcularPrecioPonderado([]), { total: 0, sumaPct: 0, ponderaciones: [] });
    const r = Calc.calcularPrecioPonderado([
        { porcentaje: '', precio: '' },
        { porcentaje: '', precio: '' }
    ]);
    assert.strictEqual(r.total, 0);
    assert.strictEqual(r.sumaPct, 0);
    assert.deepStrictEqual(r.ponderaciones, [0, 0]);
});

test('calcularPrecioPonderado: sanitiza negativos y > 100', () => {
    const r = Calc.calcularPrecioPonderado([
        { porcentaje: -10, precio: 5 },
        { porcentaje: 150, precio: 2 }
    ]);
    assert.strictEqual(r.sumaPct, 100); // -10 → 0, 150 → 100
    assert.ok(Math.abs(r.total - 2) < 1e-9, 'total esperado 2, recibido ' + r.total);
});

test('calcularPrecioPonderado: numeros como string y coma como separador de miles', () => {
    // contrato heredado de validarNumero: la coma se trata como separador de miles, no decimal.
    const r = Calc.calcularPrecioPonderado([
        { porcentaje: '50', precio: '9' },
        { porcentaje: '50', precio: '11' }
    ]);
    assert.strictEqual(r.sumaPct, 100);
    assert.ok(Math.abs(r.total - 10) < 1e-9, 'total esperado 10, recibido ' + r.total);

    // strings con miles ("1,000" => 1000): valida que no se rompe.
    const r2 = Calc.calcularPrecioPonderado([
        { porcentaje: 100, precio: '1,000' }
    ]);
    assert.ok(Math.abs(r2.total - 1000) < 1e-9, 'total esperado 1000, recibido ' + r2.total);
});
