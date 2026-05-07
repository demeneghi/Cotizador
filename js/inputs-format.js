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

    function syncModelAndInputEvent(input, formatted) {
        if (input._x_model && typeof input._x_model.set === 'function') {
            try { input._x_model.set(formatted); } catch (e) { /* ignore */ }
        }
        try {
            input.dispatchEvent(new Event('input', { bubbles: true }));
        } catch (e) { /* navegadores antiguos sin Event constructor */ }
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
        syncModelAndInputEvent(input, formatted);
    }

    function readArrowStep(input) {
        var raw = input.getAttribute('data-arrow-step');
        if (raw == null || String(raw).trim() === '') return null;
        var step = Numeric.parseFlexible(raw);
        if (!isFinite(step) || isNaN(step) || step <= 0) return null;
        return step;
    }

    function readArrowMin(input) {
        var raw = input.getAttribute('data-arrow-min');
        if (raw == null || String(raw).trim() === '') return null;
        var lo = Numeric.parseFlexible(raw);
        if (!isFinite(lo) || isNaN(lo)) return null;
        return lo;
    }

    /**
     * Asigna un valor numerico ya validado, formatea como el resto de la app y sincroniza Alpine.
     */
    function setInputNumericValue(input, num) {
        var s = Numeric.formatNumber(num);
        var formatted = Numeric.formatInputLive(s);
        input.value = formatted;
        if (typeof input.setSelectionRange === 'function') {
            try { input.setSelectionRange(formatted.length, formatted.length); } catch (e) { /* ignore */ }
        }
        syncModelAndInputEvent(input, formatted);
    }

    function applyArrowStep(input, direction) {
        var step = readArrowStep(input);
        if (step == null) return false;
        var minBound = readArrowMin(input);
        if (minBound == null) minBound = 0;
        var rawTrim = String(input.value).trim();
        var cur = Numeric.parseFlexible(input.value);
        var base = (rawTrim === '' || !isFinite(cur) || isNaN(cur)) ? 0 : cur;
        var next = base + direction * step;
        if (next < minBound) next = minBound;
        setInputNumericValue(input, next);
        return true;
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

        doc.addEventListener('keydown', function (ev) {
            if (ev.key !== 'ArrowUp' && ev.key !== 'ArrowDown') return;
            if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
            if (!isFormatTarget(ev.target)) return;
            var input = ev.target;
            if (input.readOnly || input.disabled) return;
            if (readArrowStep(input) == null) return;
            ev.preventDefault();
            var dir = ev.key === 'ArrowUp' ? 1 : -1;
            applyArrowStep(input, dir);
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
