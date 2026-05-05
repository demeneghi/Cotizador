/**
 * Formateo en vivo de inputs numericos (separadores de miles).
 *
 * Aplica delegacion de eventos a nivel `document`, lo que cubre tanto los
 * inputs estaticos como los creados dinamicamente por Alpine `x-for`. El
 * contrato de parseo se delega a CotizadorNumeric para evitar la doble
 * interpretacion de coma/punto.
 */
(function (global) {
    'use strict';

    var Numeric = global.CotizadorNumeric;
    if (!Numeric) {
        return;
    }

    var SELECTOR = 'input[data-format-numeric]';

    function isFormatTarget(el) {
        if (!el || el.tagName !== 'INPUT') return false;
        return el.matches && el.matches(SELECTOR);
    }

    function reformat(input) {
        var prevValue = input.value;
        if (prevValue.length > Numeric.MAX_INPUT_LEN) {
            prevValue = prevValue.slice(0, Numeric.MAX_INPUT_LEN);
        }
        var caret = typeof input.selectionStart === 'number' ? input.selectionStart : prevValue.length;
        var formatted = Numeric.formatInputLive(prevValue);
        if (formatted === prevValue) return;
        var diff = formatted.length - prevValue.length;
        input.value = formatted;
        if (typeof input.setSelectionRange === 'function') {
            var newPos = caret + diff;
            if (newPos < 0) newPos = 0;
            if (newPos > formatted.length) newPos = formatted.length;
            try { input.setSelectionRange(newPos, newPos); } catch (e) { /* ignore */ }
        }
        if (input._x_model && typeof input._x_model.set === 'function') {
            try { input._x_model.set(formatted); } catch (e) { /* ignore */ }
        }
        try {
            input.dispatchEvent(new Event('input', { bubbles: true }));
        } catch (e) { /* navegadores antiguos sin Event constructor */ }
    }

    function attach(root) {
        var doc = root || global.document;
        if (!doc || doc._cotizadorNumericFormatAttached) return;
        doc._cotizadorNumericFormatAttached = true;

        doc.addEventListener('input', function (ev) {
            if (!isFormatTarget(ev.target)) return;
            if (ev.isTrusted === false) return;
            reformat(ev.target);
        }, true);

        doc.addEventListener('change', function (ev) {
            if (!isFormatTarget(ev.target)) return;
            reformat(ev.target);
        }, true);
    }

    var api = { attach: attach, reformat: reformat, SELECTOR: SELECTOR };
    global.CotizadorInputsFormat = api;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    if (global.document) {
        if (global.document.readyState === 'loading') {
            global.document.addEventListener('DOMContentLoaded', function () { attach(); });
        } else {
            attach();
        }
    }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
