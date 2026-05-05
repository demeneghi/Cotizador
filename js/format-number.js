/**
 * Compatibilidad: delega en CotizadorNumeric (modulo unico de formato).
 */
(function (global) {
    'use strict';

    var Numeric = global.CotizadorNumeric ||
        (typeof require === 'function' ? require('./numeric.js') : null);
    if (!Numeric) {
        throw new Error('Falta CotizadorNumeric (cargar js/numeric.js antes)');
    }

    var api = { formatNumber: Numeric.formatNumber };
    global.CotizadorFormat = api;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
