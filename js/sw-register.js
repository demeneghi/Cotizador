(function () {
    'use strict';

    var newServiceWorker = null;
    var swRegistration = null;

    function mostrarToastActualizacion() {
        var toast = document.getElementById('updateToast');
        if (toast) {
            toast.classList.add('is-visible');
        } else {
            console.error('No se encontró el elemento updateToast');
        }
    }

    function actualizarApp() {
        var toast = document.getElementById('updateToast');
        if (toast) {
            toast.classList.remove('is-visible');
        }

        if (newServiceWorker) {
            newServiceWorker.postMessage({ action: 'skipWaiting' });
        } else {
            console.error('No hay newServiceWorker disponible');
            if (swRegistration) {
                swRegistration.update().then(function () {
                    window.location.reload();
                });
            }
        }
    }

    function intentarVolcarCotizadorAntesDeRecarga() {
        try {
            var Alpine = window.Alpine;
            if (!Alpine || typeof Alpine.$data !== 'function') return;
            var root = document.querySelector('[x-data]');
            if (!root) return;
            var d = Alpine.$data(root);
            if (d && typeof d.guardarEnLocalStorage === 'function') {
                d.guardarEnLocalStorage();
            }
        } catch (e) {
            console.warn('Volcado previo a recarga SW omitido:', e && e.message);
        }
    }

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', function () {
            navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
                .then(function (registration) {
                    swRegistration = registration;
                    registration.update();

                    registration.addEventListener('updatefound', function () {
                        var sw = registration.installing;
                        if (!sw) {
                            return;
                        }
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
                    }

                    if (registration.installing) {
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
            if (!document.hidden && swRegistration) {
                swRegistration.update();
            }
        });
    } else {
        console.error('Service Worker no soportado en este navegador');
    }

    window.addEventListener('beforeinstallprompt', function (e) {
        e.preventDefault();
        window.deferredInstallPrompt = e;
    });

    document.addEventListener('DOMContentLoaded', function () {
        var btn = document.getElementById('toastUpdateButton') || document.querySelector('.toast-update-button');
        if (btn) {
            btn.addEventListener('click', actualizarApp);
        }

        function formatearConSeparadores(valor) {
            var limpio = valor.replace(/[^\d.,]/g, '');
            limpio = limpio.replace(',', '.');
            if (!limpio) return '';
            var partes = limpio.split('.');
            var parteEntera = partes[0];
            var parteDecimal = partes[1];
            parteEntera = parteEntera.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
            return parteDecimal !== undefined ? parteEntera + '.' + parteDecimal : parteEntera;
        }

        setTimeout(function () {
            var paramInputs = document.querySelectorAll('.param-input-wrapper input');
            paramInputs.forEach(function (input) {
                input.addEventListener('input', function () {
                    var cursorPos = this.selectionStart;
                    var valorAnterior = this.value;
                    var valorFormateado = formatearConSeparadores(valorAnterior);
                    if (valorFormateado !== valorAnterior) {
                        this.value = valorFormateado;
                        var diff = valorFormateado.length - valorAnterior.length;
                        this.setSelectionRange(cursorPos + diff, cursorPos + diff);
                    }
                });
                if (input.value) {
                    input.value = formatearConSeparadores(input.value);
                }
            });
        }, 500);
    });
})();
