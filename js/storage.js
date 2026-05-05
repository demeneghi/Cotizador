/**
 * Capa de almacenamiento debounceada con sincronizacion multi-pestana.
 *
 * Resuelve:
 *  - Escrituras sincronas masivas por keystroke (debounce real).
 *  - Cuota: detecta QuotaExceededError y deja un callback al consumidor.
 *  - Multi-tab: subscriptores reciben updates de eventos `storage`.
 *  - Limite de tamano por payload para defender frente a respaldos enormes.
 */
(function (global) {
    'use strict';

    var DEFAULT_DEBOUNCE_MS = 250;
    var DEFAULT_MAX_BYTES = 512 * 1024;

    function safeJSONParse(raw) {
        if (typeof raw !== 'string' || raw.length === 0) return null;
        try { return JSON.parse(raw); } catch (e) { return null; }
    }

    function bytesOf(str) {
        if (typeof str !== 'string') return 0;
        if (typeof TextEncoder !== 'undefined') {
            try { return new TextEncoder().encode(str).length; } catch (e) { /* fallback */ }
        }
        return str.length;
    }

    /**
     * @param {object} opts - { key, debounceMs, maxBytes, onError, storage }
     */
    function createDebouncedStore(opts) {
        var key = opts.key;
        if (!key) throw new Error('storage: key requerido');
        var storage = opts.storage || global.localStorage;
        var debounceMs = typeof opts.debounceMs === 'number' ? opts.debounceMs : DEFAULT_DEBOUNCE_MS;
        var maxBytes = typeof opts.maxBytes === 'number' ? opts.maxBytes : DEFAULT_MAX_BYTES;
        var onError = typeof opts.onError === 'function' ? opts.onError : function () {};
        var pendingValue = null;
        var hasPending = false;
        var timer = null;
        var listeners = [];
        var lastWrittenAt = 0;

        function flushImpl() {
            if (!hasPending) return;
            var serialized;
            try {
                serialized = JSON.stringify(pendingValue);
            } catch (e) {
                onError({ type: 'serialize', error: e });
                hasPending = false;
                pendingValue = null;
                return;
            }
            if (bytesOf(serialized) > maxBytes) {
                onError({ type: 'too_large', size: bytesOf(serialized), maxBytes: maxBytes });
                hasPending = false;
                pendingValue = null;
                return;
            }
            try {
                storage.setItem(key, serialized);
                lastWrittenAt = Date.now();
            } catch (e) {
                if (e && e.name === 'QuotaExceededError') {
                    onError({ type: 'quota', error: e });
                } else {
                    onError({ type: 'write', error: e });
                }
                return;
            }
            hasPending = false;
            pendingValue = null;
        }

        function set(value) {
            pendingValue = value;
            hasPending = true;
            if (timer) clearTimeout(timer);
            timer = setTimeout(flushImpl, debounceMs);
        }

        function flush() {
            if (timer) { clearTimeout(timer); timer = null; }
            flushImpl();
        }

        function get() {
            try {
                var raw = storage.getItem(key);
                return safeJSONParse(raw);
            } catch (e) {
                onError({ type: 'read', error: e });
                return null;
            }
        }

        function getRaw() {
            try { return storage.getItem(key); } catch (e) { return null; }
        }

        function clear() {
            try { storage.removeItem(key); } catch (e) { onError({ type: 'remove', error: e }); }
        }

        function onExternalChange(cb) {
            listeners.push(cb);
            return function () {
                var idx = listeners.indexOf(cb);
                if (idx >= 0) listeners.splice(idx, 1);
            };
        }

        function handleStorageEvent(ev) {
            if (!ev || ev.key !== key) return;
            if (Date.now() - lastWrittenAt < 50) return;
            var parsed = ev.newValue == null ? null : safeJSONParse(ev.newValue);
            for (var i = 0; i < listeners.length; i++) {
                try { listeners[i](parsed, ev); } catch (e) { /* aislado */ }
            }
        }

        if (global.addEventListener) {
            global.addEventListener('storage', handleStorageEvent);
        }
        if (global.addEventListener) {
            global.addEventListener('beforeunload', function () { flush(); });
            global.addEventListener('pagehide', function () { flush(); });
        }

        return {
            set: set,
            get: get,
            getRaw: getRaw,
            flush: flush,
            clear: clear,
            onExternalChange: onExternalChange
        };
    }

    var api = {
        createDebouncedStore: createDebouncedStore,
        DEFAULT_DEBOUNCE_MS: DEFAULT_DEBOUNCE_MS,
        DEFAULT_MAX_BYTES: DEFAULT_MAX_BYTES,
        bytesOf: bytesOf,
        safeJSONParse: safeJSONParse
    };
    global.CotizadorStorage = api;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
