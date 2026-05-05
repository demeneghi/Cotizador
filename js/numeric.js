/**
 * Modulo numerico unificado.
 *
 * Contrato unico para parseo, validacion y formateo. Centraliza la decision
 * sobre el separador decimal (resuelve la inconsistencia historica entre
 * `validarNumero` y la UI de formateo) y elimina ambiguedades para usuarios
 * que escriben en formato es-MX ("11,4") o en-US ("11.4").
 *
 * Reglas de parseo:
 *   - Si la cadena tiene tanto '.' como ',', el ultimo en aparecer se trata
 *     como separador decimal y el otro como miles.
 *   - Si solo hay ',', se trata como decimal SI aparece una sola vez con
 *     entre 0 y 2 digitos despues (incluye trailing "1," como decimal en
 *     construccion); con 3 digitos despues se trata como miles ("1,000").
 *   - Si solo hay '.', misma regla: 0-2 digitos => decimal; 3 digitos => miles.
 *   - Espacios y caracteres no numericos se descartan.
 */
(function (global) {
    'use strict';

    var DEFAULT_MIN = 0;
    var DEFAULT_MAX = Infinity;
    var MAX_INPUT_LEN = 32;

    function isFiniteNumber(n) {
        return typeof n === 'number' && !isNaN(n) && isFinite(n);
    }

    function parseFlexible(value) {
        if (value === null || value === undefined) return NaN;
        if (typeof value === 'number') return isFiniteNumber(value) ? value : NaN;
        if (typeof value === 'boolean') return NaN;
        var s = String(value);
        if (s.length > MAX_INPUT_LEN) s = s.slice(0, MAX_INPUT_LEN);
        s = s.replace(/[\s\u00A0]/g, '');
        if (!s) return NaN;
        var negative = false;
        if (s.charAt(0) === '-') { negative = true; s = s.slice(1); }
        else if (s.charAt(0) === '+') { s = s.slice(1); }
        s = s.replace(/[^\d.,]/g, '');
        if (!s) return NaN;
        var lastDot = s.lastIndexOf('.');
        var lastComma = s.lastIndexOf(',');
        var dotCount = (s.match(/\./g) || []).length;
        var commaCount = (s.match(/,/g) || []).length;
        var decimalSep = null;
        if (lastDot !== -1 && lastComma !== -1) {
            decimalSep = lastDot > lastComma ? '.' : ',';
        } else if (lastComma !== -1) {
            var afterComma = s.length - lastComma - 1;
            // afterComma >= 0 permite "1," (decimal en construccion).
            // < 3 evita interpretar "1,000" (miles en-US) como decimal.
            if (commaCount === 1 && afterComma >= 0 && afterComma < 3) {
                decimalSep = ',';
            }
        } else if (lastDot !== -1) {
            var afterDot = s.length - lastDot - 1;
            if (dotCount === 1 && afterDot >= 0 && afterDot < 3) {
                decimalSep = '.';
            }
        }
        var normalized;
        if (decimalSep === ',') {
            normalized = s.replace(/\./g, '').replace(',', '.');
        } else if (decimalSep === '.') {
            normalized = s.replace(/,/g, '');
        } else {
            normalized = s.replace(/[.,]/g, '');
        }
        if (normalized === '' || normalized === '.' || normalized === '-') return NaN;
        var n = Number(normalized);
        if (!isFiniteNumber(n)) return NaN;
        return negative ? -n : n;
    }

    function clamp(num, min, max) {
        var lo = min !== undefined && min !== null ? min : DEFAULT_MIN;
        var hi = max !== undefined && max !== null ? max : DEFAULT_MAX;
        if (num < lo) return lo;
        if (num > hi) return hi;
        return num;
    }

    /**
     * Valida y normaliza un valor numerico. Si no es parseable, devuelve `min`.
     */
    function validarNumero(valor, minimo, maximo) {
        var n = parseFlexible(valor);
        var lo = minimo !== undefined && minimo !== null ? minimo : DEFAULT_MIN;
        var hi = maximo !== undefined && maximo !== null ? maximo : DEFAULT_MAX;
        if (!isFiniteNumber(n)) return lo;
        return clamp(n, lo, hi);
    }

    /**
     * Formato visual: 1234.5 -> "1,234.50" (en-US, 2 decimales).
     */
    function formatNumber(num) {
        if (num === null || num === undefined || typeof num === 'boolean') return '0.00';
        if (typeof num === 'string') {
            num = parseFlexible(num);
        }
        if (!isFiniteNumber(num)) return '0.00';
        return num.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    /**
     * Formato para inputs en vivo. Conserva el caracter decimal escrito por el
     * usuario y unicamente agrega separadores de miles a la parte entera.
     * No fuerza decimales.
     */
    function formatInputLive(rawValue) {
        var v = String(rawValue == null ? '' : rawValue);
        v = v.replace(/[^\d.,\-]/g, '');
        if (!v) return '';
        var negative = v.charAt(0) === '-';
        if (negative) v = v.slice(1);
        var lastDot = v.lastIndexOf('.');
        var lastComma = v.lastIndexOf(',');
        var decimalSep = null;
        if (lastDot !== -1 && lastComma !== -1) {
            decimalSep = lastDot > lastComma ? '.' : ',';
        } else if (lastComma !== -1) {
            var afterComma = v.length - lastComma - 1;
            if ((v.match(/,/g) || []).length === 1 && afterComma >= 0 && afterComma < 3) {
                decimalSep = ',';
            }
        } else if (lastDot !== -1) {
            var afterDot = v.length - lastDot - 1;
            if ((v.match(/\./g) || []).length === 1 && afterDot >= 0 && afterDot < 3) {
                decimalSep = '.';
            }
        }
        var integerPart;
        var decimalPart = '';
        if (decimalSep === '.') {
            integerPart = v.replace(/,/g, '').slice(0, lastDot - (v.match(/,/g) || []).length);
            decimalPart = v.slice(lastDot + 1).replace(/[.,]/g, '');
        } else if (decimalSep === ',') {
            var noDots = v.replace(/\./g, '');
            var newLastComma = noDots.lastIndexOf(',');
            integerPart = noDots.slice(0, newLastComma);
            decimalPart = noDots.slice(newLastComma + 1).replace(/[.,]/g, '');
        } else {
            integerPart = v.replace(/[.,]/g, '');
        }
        integerPart = integerPart.replace(/^0+(?=\d)/, '');
        if (!integerPart && decimalSep) integerPart = '0';
        if (!integerPart && !decimalSep) return negative ? '-' : '';
        var withSep = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        var out = withSep + (decimalSep ? '.' + decimalPart : '');
        return (negative ? '-' : '') + out;
    }

    var api = {
        parseFlexible: parseFlexible,
        validarNumero: validarNumero,
        formatNumber: formatNumber,
        formatInputLive: formatInputLive,
        MAX_INPUT_LEN: MAX_INPUT_LEN
    };
    global.CotizadorNumeric = api;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
