/**
 * Formato numérico compartido (cotizador, informe, tests Node).
 */
(function (global) {
    'use strict';

    function formatNumber(num) {
        if (num == null || typeof num === 'boolean') return '0.00';
        if (typeof num === 'string') {
            num = Number(num.replace(/,/g, ''));
        }
        if (typeof num !== 'number' || isNaN(num) || !isFinite(num)) return '0.00';
        return num.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    var api = { formatNumber: formatNumber };
    global.CotizadorFormat = api;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
