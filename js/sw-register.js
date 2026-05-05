(function () {
    'use strict';

    var newServiceWorker = null;
    var swRegistration = null;
    var lastUpdateAt = 0;
    var pollIntervalId = null;

    /* Cooldown mínimo entre chequeos disparados por eventos (focus, visibilitychange). */
    var UPDATE_THROTTLE_MS = 30 * 1000;
    /* Polling activo mientras la pestaña esté visible. */
    var POLL_INTERVAL_MS = 60 * 1000;

    function mostrarToastActualizacion() {
        var toast = document.getElementById('updateToast');
        if (toast) {
            toast.classList.add('is-visible');
        } else {
            console.error('No se encontro el elemento updateToast');
        }
    }

    function actualizarApp() {
        var toast = document.getElementById('updateToast');
        if (toast) toast.classList.remove('is-visible');

        if (newServiceWorker) {
            try { newServiceWorker.postMessage({ action: 'skipWaiting' }); }
            catch (e) { console.error('postMessage skipWaiting:', e); }
        } else if (swRegistration) {
            swRegistration.update().then(function () {
                if (swRegistration.waiting) {
                    try { swRegistration.waiting.postMessage({ action: 'skipWaiting' }); }
                    catch (e) { /* ignore */ }
                }
            }).catch(function (e) { console.error('update fallo:', e); });
        }
    }

    function intentarVolcarCotizadorAntesDeRecarga() {
        try {
            var g = typeof globalThis !== 'undefined' ? globalThis : window;
            var fn = g && g.__cotizadorFlushStores;
            if (typeof fn === 'function') fn();
        } catch (e) {
            console.warn('Volcado previo a recarga SW omitido:', e && e.message);
        }
    }

    function chequearActualizacion(force) {
        if (!swRegistration) return;
        var now = Date.now();
        if (!force && now - lastUpdateAt < UPDATE_THROTTLE_MS) return;
        lastUpdateAt = now;
        swRegistration.update().catch(function () { /* ignore */ });
    }

    function iniciarPolling() {
        if (pollIntervalId !== null) return;
        pollIntervalId = setInterval(function () {
            if (document.hidden) return;
            chequearActualizacion(false);
        }, POLL_INTERVAL_MS);
    }

    function detenerPolling() {
        if (pollIntervalId === null) return;
        clearInterval(pollIntervalId);
        pollIntervalId = null;
    }

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', function () {
            navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
                .then(function (registration) {
                    swRegistration = registration;
                    registration.update().catch(function () { /* ignore */ });
                    lastUpdateAt = Date.now();

                    registration.addEventListener('updatefound', function () {
                        var sw = registration.installing;
                        if (!sw) return;
                        newServiceWorker = sw;
                        sw.addEventListener('statechange', function () {
                            if (sw.state === 'installed' && navigator.serviceWorker.controller) {
                                mostrarToastActualizacion();
                            }
                        });
                    });

                    if (registration.waiting) {
                        newServiceWorker = registration.waiting;
                        mostrarToastActualizacion();
                    } else if (registration.installing) {
                        newServiceWorker = registration.installing;
                    }

                    if (!document.hidden) iniciarPolling();
                })
                .catch(function (err) {
                    console.error('Error registrando Service Worker:', err);
                });
        });

        var refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', function () {
            if (!refreshing) {
                refreshing = true;
                intentarVolcarCotizadorAntesDeRecarga();
                window.location.reload();
            }
        });

        document.addEventListener('visibilitychange', function () {
            if (document.hidden) {
                detenerPolling();
                return;
            }
            iniciarPolling();
            chequearActualizacion(false);
        });

        window.addEventListener('focus', function () {
            chequearActualizacion(false);
        });

        window.addEventListener('online', function () {
            chequearActualizacion(true);
        });

        window.addEventListener('pagehide', function () {
            detenerPolling();
        });
    } else {
        console.error('Service Worker no soportado en este navegador');
    }

    document.addEventListener('DOMContentLoaded', function () {
        var btn = document.getElementById('toastUpdateButton') || document.querySelector('.toast-update-button');
        if (btn) btn.addEventListener('click', actualizarApp);
    });
})();
