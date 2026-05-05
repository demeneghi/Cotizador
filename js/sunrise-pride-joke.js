/**
 * Broma removible: fase visual de orgullo en "Sunrise" segun max(precio/kg MXN flete corto, largo).
 * Expone window.SunrisePrideJoke.computeClass(corto, largo) para cotizador-main.js (una sola linea de delegacion).
 *
 * Quitar: este archivo + <script> en index.html + ver cabecera de styles/sunrise-pride-joke.css.
 */
(function () {
    'use strict';

    var Numeric = window.CotizadorNumeric;

    function computeClass(precioKgCorto, precioKgLargo) {
        if (!Numeric || typeof Numeric.parseFlexible !== 'function') return 'plain';
        var a = Numeric.parseFlexible(precioKgCorto);
        var b = Numeric.parseFlexible(precioKgLargo);
        if (!isFinite(a) || !isFinite(b)) return 'full';
        var m = Math.max(a, b);
        if (m >= 15) return 'plain';
        if (m <= 9) return 'full';
        if (m <= 11) return 'minus-left';
        if (m <= 13) return 'minus-both';
        return 'text-wane';
    }

    window.SunrisePrideJoke = { computeClass: computeClass };
})();
