/**
 * Validación estricta del JSON de informe (navegador + tests Node).
 */
(function (global) {
    'use strict';

    var MIN_PASOS = 8;

    function isNonEmptyString(v) {
        return typeof v === 'string' && v.length > 0;
    }

    function validatePaso(p) {
        if (!p || typeof p !== 'object') return false;
        if (!isNonEmptyString(p.titulo) || !isNonEmptyString(p.badge)) return false;
        if (typeof p.formula !== 'string') return false;
        if (typeof p.resultado !== 'string') return false;
        if (typeof p.label !== 'string') return false;
        if (p.highlight !== undefined && typeof p.highlight !== 'boolean') return false;
        if (p.final !== undefined && typeof p.final !== 'boolean') return false;
        return true;
    }

    function validateParametro(p) {
        if (!p || typeof p !== 'object') return false;
        return isNonEmptyString(p.nombre) && typeof p.valor === 'string';
    }

    /**
     * @param {object} o - objeto parseado del informe
     * @param {number} [expectedSchema] - versión esperada desde config
     */
    function validateInforme(o, expectedSchema) {
        if (!o || typeof o !== 'object') return false;
        if (!Array.isArray(o.calcCorto) || !Array.isArray(o.calcLargo) || !Array.isArray(o.parametros)) return false;
        if (o.calcCorto.length < MIN_PASOS || o.calcLargo.length < MIN_PASOS) return false;
        if (o.parametros.length < 1) return false;
        if (typeof o.precioVenta !== 'number' || typeof o.tipoCambio !== 'number') return false;
        if (typeof o.precioKgCorto !== 'number' || typeof o.precioKgLargo !== 'number') return false;
        if (!isFinite(o.precioVenta) || !isFinite(o.tipoCambio)) return false;
        if (!isFinite(o.precioKgCorto) || !isFinite(o.precioKgLargo)) return false;
        if (o.precioVenta < 0 || o.tipoCambio <= 0) return false;
        if (o.precioKgCorto < 0 || o.precioKgLargo < 0) return false;
        if (typeof o.fecha !== 'string' || typeof o.hora !== 'string') return false;
        if (o.estado !== undefined && typeof o.estado !== 'string') return false;
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

    var api = { validateInforme: validateInforme, MIN_PASOS_INFORME: MIN_PASOS };
    global.CotizadorInformeValidate = api;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
