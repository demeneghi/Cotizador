(function () {
    'use strict';

    var newServiceWorker = null;
    var swRegistration = null;
    var lastUpdateAt = 0;
    var UPDATE_THROTTLE_MS = 5 * 60 * 1000;

    function mostrarToastActualizacion() {
        var toast = document.getElementById('updateToast');
        if (toast) {
            toast.classList.add('is-visible');
            toast.setAttribute('aria-hidden', 'false');
            document.body.classList.add('update-modal-open');
            var btn = document.getElementById('toastUpdateButton');
            if (btn) {
                try { btn.focus(); } catch (e) { /* ignore */ }
            }
        } else {
            console.error('No se encontro el elemento updateToast');
        }
    }

    function actualizarApp() {
        var toast = document.getElementById('updateToast');
        if (toast) {
            toast.classList.remove('is-visible');
            toast.setAttribute('aria-hidden', 'true');
        }
        document.body.classList.remove('update-modal-open');

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
            if (document.hidden || !swRegistration) return;
            var now = Date.now();
            if (now - lastUpdateAt < UPDATE_THROTTLE_MS) return;
            lastUpdateAt = now;
            swRegistration.update().catch(function () { /* ignore */ });
        });
    } else {
        console.error('Service Worker no soportado en este navegador');
    }

    document.addEventListener('DOMContentLoaded', function () {
        var btn = document.getElementById('toastUpdateButton') || document.querySelector('.toast-update-button');
        if (btn) btn.addEventListener('click', actualizarApp);
    });
})();
