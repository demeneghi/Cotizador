/**
 * Validacion estricta del JSON de informe (navegador + tests Node).
 * Limites de longitud por campo para evitar DoS por enlace controlado.
 */
(function (global) {
    'use strict';

    var MIN_PASOS = 8;
    var MAX_PASOS = 32;
    var MAX_PARAMETROS = 64;
    var LIMITS = {
        titulo: 200,
        badge: 64,
        formula: 4000,
        resultado: 200,
        label: 200,
        nombre: 100,
        valor: 200,
        fecha: 80,
        hora: 40,
        estado: 80
    };
    var MAX_NUMBER = 1e12;

    function isNonEmptyString(v, max) {
        return typeof v === 'string' && v.length > 0 && v.length <= max;
    }

    function isBoundedString(v, max) {
        return typeof v === 'string' && v.length <= max;
    }

    function isFiniteSafeNumber(n) {
        return typeof n === 'number' && isFinite(n) && !isNaN(n) && Math.abs(n) <= MAX_NUMBER;
    }

    function validatePaso(p) {
        if (!p || typeof p !== 'object') return false;
        if (!isNonEmptyString(p.titulo, LIMITS.titulo)) return false;
        if (!isNonEmptyString(p.badge, LIMITS.badge)) return false;
        if (!isBoundedString(p.formula, LIMITS.formula)) return false;
        if (!isBoundedString(p.resultado, LIMITS.resultado)) return false;
        if (!isBoundedString(p.label, LIMITS.label)) return false;
        if (p.highlight !== undefined && typeof p.highlight !== 'boolean') return false;
        if (p.final !== undefined && typeof p.final !== 'boolean') return false;
        return true;
    }

    function validateParametro(p) {
        if (!p || typeof p !== 'object') return false;
        return isNonEmptyString(p.nombre, LIMITS.nombre) && isBoundedString(p.valor, LIMITS.valor);
    }

    /**
     * @param {object} o - objeto parseado del informe
     * @param {number} [expectedSchema] - version esperada desde config
     */
    function validateInforme(o, expectedSchema) {
        if (!o || typeof o !== 'object') return false;
        if (!Array.isArray(o.calcCorto) || !Array.isArray(o.calcLargo) || !Array.isArray(o.parametros)) return false;
        if (o.calcCorto.length < MIN_PASOS || o.calcCorto.length > MAX_PASOS) return false;
        if (o.calcLargo.length < MIN_PASOS || o.calcLargo.length > MAX_PASOS) return false;
        if (o.parametros.length < 1 || o.parametros.length > MAX_PARAMETROS) return false;
        if (!isFiniteSafeNumber(o.precioVenta) || !isFiniteSafeNumber(o.tipoCambio)) return false;
        if (!isFiniteSafeNumber(o.precioKgCorto) || !isFiniteSafeNumber(o.precioKgLargo)) return false;
        if (o.precioVenta < 0 || o.tipoCambio <= 0) return false;
        if (o.precioKgCorto < 0 || o.precioKgLargo < 0) return false;
        if (!isNonEmptyString(o.fecha, LIMITS.fecha) || !isNonEmptyString(o.hora, LIMITS.hora)) return false;
        if (o.estado !== undefined && !isBoundedString(o.estado, LIMITS.estado)) return false;
        var exp = expectedSchema !== undefined ? expectedSchema : 2;
        if (o.schemaVersion !== undefined && o.schemaVersion !== 1 && o.schemaVersion !== exp) {
            return false;
        }
        for (var i = 0; i < o.calcCorto.length; i++) {
            if (!validatePaso(o.calcCorto[i])) return false;
        }
        for (var j = 0; j < o.calcLargo.length; j++) {
            if (!validatePaso(o.calcLargo[j])) return false;
        }
        for (var k = 0; k < o.parametros.length; k++) {
            if (!validateParametro(o.parametros[k])) return false;
        }
        return true;
    }

    var api = {
        validateInforme: validateInforme,
        MIN_PASOS_INFORME: MIN_PASOS,
        MAX_PASOS_INFORME: MAX_PASOS,
        MAX_PARAMETROS_INFORME: MAX_PARAMETROS,
        LIMITS: LIMITS
    };
    global.CotizadorInformeValidate = api;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
