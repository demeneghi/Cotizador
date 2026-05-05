'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');

const Calc = require(path.join(__dirname, '..', 'js', 'calc-core.js'));
const Numeric = require(path.join(__dirname, '..', 'js', 'numeric.js'));

test('validarNumero respeta minimo y maximo', () => {
    assert.strictEqual(Calc.validarNumero('-5', 0, 100), 0);
    assert.strictEqual(Calc.validarNumero('150', 0, 100), 100);
    assert.strictEqual(Calc.validarNumero('12.5', 0, 100), 12.5);
    assert.strictEqual(Calc.validarNumero('11,4', 0, 100), 11.4);
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

test('calcularPrecioKg con datos minimos', () => {
    const r = Calc.calcularPrecioKg(10, 10, 500, 100, 20, 10);
    assert.ok(typeof r === 'number');
    assert.ok(r >= 0);
});

test('calcularPrecioKg retorna 0 cuando precio neto es negativo', () => {
    // gastos por caja muy altos > precio - comision
    const r = Calc.calcularPrecioKg(1, 0, 1000, 1, 20, 10);
    assert.strictEqual(r, 0);
});

test('calcularPrecioKg con tipoCambio 0 o pesoCaja 0 no explota', () => {
    const r1 = Calc.calcularPrecioKg(10, 10, 500, 100, 0, 10);
    assert.ok(isFinite(r1));
    const r2 = Calc.calcularPrecioKg(10, 10, 500, 100, 20, 0);
    assert.ok(isFinite(r2));
});

test('calcularPrecioKg trunca comision > 100 a 100', () => {
    const r = Calc.calcularPrecioKg(10, 200, 0, 100, 20, 10);
    assert.strictEqual(r, 0);
});

test('config/app.json es JSON valido y tiene claves esperadas', () => {
    const raw = fs.readFileSync(path.join(__dirname, '..', 'config', 'app.json'), 'utf8');
    const cfg = JSON.parse(raw);
    assert.ok(Array.isArray(cfg.estadosDisponibles));
    assert.ok(cfg.storage.cotizadorDataV2);
    assert.ok(Array.isArray(cfg.camposPersistibles));
    assert.ok(cfg.camposPersistibles.includes('precio_venta'));
    assert.ok(cfg.valoresPredeterminados && typeof cfg.valoresPredeterminados.tipo_cambio === 'number');
    assert.ok(cfg.storage.cotizadorPonderadoV1);
    assert.ok(cfg.ponderado && Array.isArray(cfg.ponderado.calibres));
    assert.strictEqual(cfg.ponderado.calibres.length, 6);
    assert.strictEqual(typeof cfg.ponderado.tolerancia_suma_pct, 'number');
    assert.ok(cfg.brand && typeof cfg.brand.titulo === 'string');
    assert.ok(cfg.storageLimits && typeof cfg.storageLimits.maxBackupBytes === 'number');
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
    assert.ok(Math.abs(r.total - 9.9) < 1e-9);
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
    assert.strictEqual(r.sumaPct, 100);
    assert.ok(Math.abs(r.total - 2) < 1e-9);
});

test('calcularPrecioPonderado: numeros como string con coma decimal', () => {
    const r = Calc.calcularPrecioPonderado([
        { porcentaje: '50', precio: '9' },
        { porcentaje: '50', precio: '11' }
    ]);
    assert.strictEqual(r.sumaPct, 100);
    assert.ok(Math.abs(r.total - 10) < 1e-9);

    const r2 = Calc.calcularPrecioPonderado([
        { porcentaje: 100, precio: '1,000.5' }
    ]);
    assert.ok(Math.abs(r2.total - 1000.5) < 1e-9);
});

test('Numeric.parseFlexible se exporta consistente', () => {
    assert.strictEqual(typeof Numeric.parseFlexible, 'function');
});
