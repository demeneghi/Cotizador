(function () {
    'use strict';

    var CFG = window.__APP_CONFIG__;
    if (!CFG) {
        throw new Error('Falta window.__APP_CONFIG__ (cargar js/app-config.js antes)');
    }

    var ESTADOS_DISPONIBLES = CFG.estadosDisponibles;
    var STORAGE_KEY = CFG.storage.cotizadorDataV2;
    var LEGACY_STORAGE_KEY = CFG.storage.legacyCotizadorConfig;
    var STORAGE_INFORME = CFG.storage.cotizacionInforme;
    var STORAGE_PONDERADO = CFG.storage.cotizadorPonderadoV1;
    var ESTADO_DEFAULT = CFG.estadoDefault;
    var CAMPOS_PERSISTIBLES = CFG.camposPersistibles;
    var VALORES_PREDETERMINADOS = CFG.valoresPredeterminados;
    var PONDERADO_CFG = CFG.ponderado || { calibres: [], valoresPredeterminados: {}, tolerancia_suma_pct: 0.01 };
    var PONDERADO_CALIBRES = PONDERADO_CFG.calibres || [];
    var PONDERADO_DEFAULTS = PONDERADO_CFG.valoresPredeterminados || {};
    var PONDERADO_TOL = typeof PONDERADO_CFG.tolerancia_suma_pct === 'number' ? PONDERADO_CFG.tolerancia_suma_pct : 0.01;
    var INFORME_CFG = CFG.informe || {};
    var MAX_HASH_URL_CHARS = typeof INFORME_CFG.maxHashUrlChars === 'number' ? INFORME_CFG.maxHashUrlChars : 48000;
    var INFORME_SCHEMA = typeof INFORME_CFG.informeJsonSchemaVersion === 'number' ? INFORME_CFG.informeJsonSchemaVersion : 2;
    var STORAGE_LIMITS = CFG.storageLimits || {};
    var MAX_BACKUP_BYTES = typeof STORAGE_LIMITS.maxBackupBytes === 'number' ? STORAGE_LIMITS.maxBackupBytes : 256 * 1024;
    var MAX_DATA_BYTES = typeof STORAGE_LIMITS.maxDataBytes === 'number' ? STORAGE_LIMITS.maxDataBytes : 512 * 1024;
    var DEBOUNCE_MS = typeof STORAGE_LIMITS.debounceMs === 'number' ? STORAGE_LIMITS.debounceMs : 250;
    var BRAND = CFG.brand || {};

    var Calc = window.CotizadorCalc;
    if (!Calc) throw new Error('Falta CotizadorCalc (cargar js/calc-core.js antes)');
    var Numeric = window.CotizadorNumeric;
    if (!Numeric) throw new Error('Falta CotizadorNumeric (cargar js/numeric.js antes)');
    var Fmt = window.CotizadorFormat;
    if (!Fmt) throw new Error('Falta CotizadorFormat (cargar js/format-number.js antes)');
    var StorageMod = window.CotizadorStorage;
    if (!StorageMod) throw new Error('Falta CotizadorStorage (cargar js/storage.js antes)');

    function dbg() {
        if (CFG.debug) {
            console.log.apply(console, arguments);
        }
    }

    /**
     * No mostrar "cotizacion inviable" por precio neto negativo mientras el
     * usuario parece seguir escribiendo el precio (un solo digito o decimal en curso).
     */
    function precioVentaParcialParaAdvertencia(precioStr) {
        var t = String(precioStr == null ? '' : precioStr).trim();
        if (!t) return false;
        if (/^\d$/.test(t)) return true;
        if (/[.,]$/.test(t)) return true;
        return false;
    }

    function mostrarErrorCotizador(mensaje) {
        var el = document.getElementById('cotizador-error');
        if (el) {
            el.textContent = mensaje || '';
            if (mensaje) {
                el.classList.add('is-visible');
            } else {
                el.classList.remove('is-visible');
            }
        } else if (mensaje) {
            window.alert(mensaje);
        }
    }

    function crearCalibresDesdeDefaults() {
        var arr = [];
        for (var i = 0; i < PONDERADO_CALIBRES.length; i++) {
            var size = PONDERADO_CALIBRES[i];
            var def = PONDERADO_DEFAULTS[size] || { porcentaje: '', precio: '' };
            arr.push({
                size: size,
                porcentaje: def.porcentaje !== undefined && def.porcentaje !== null ? def.porcentaje : '',
                precio: def.precio !== undefined && def.precio !== null ? def.precio : ''
            });
        }
        return arr;
    }

    function crearValoresEstadoDesdeDefaults() {
        var o = {};
        for (var i = 0; i < CAMPOS_PERSISTIBLES.length; i++) {
            var k = CAMPOS_PERSISTIBLES[i];
            o[k] = VALORES_PREDETERMINADOS[k];
        }
        return o;
    }

    function copiarEstado(src) {
        var o = {};
        for (var i = 0; i < CAMPOS_PERSISTIBLES.length; i++) {
            var k = CAMPOS_PERSISTIBLES[i];
            o[k] = src[k];
        }
        return o;
    }

    function extraerPersistibles(obj) {
        var o = {};
        if (!obj || typeof obj !== 'object') return o;
        for (var i = 0; i < CAMPOS_PERSISTIBLES.length; i++) {
            var k = CAMPOS_PERSISTIBLES[i];
            if (Object.prototype.hasOwnProperty.call(obj, k) && obj[k] !== undefined && obj[k] !== null) {
                o[k] = obj[k];
            }
        }
        return o;
    }

    function fusionarEstadoSeguro(def, incoming) {
        var src = incoming && typeof incoming === 'object' && !Array.isArray(incoming) ? incoming : null;
        var out = {};
        for (var i = 0; i < CAMPOS_PERSISTIBLES.length; i++) {
            var k = CAMPOS_PERSISTIBLES[i];
            out[k] = def[k];
            if (src && Object.prototype.hasOwnProperty.call(src, k) && src[k] !== undefined && src[k] !== null) {
                out[k] = src[k];
            }
        }
        return out;
    }

    function buildDefaultEstadosObj() {
        var def = crearValoresEstadoDesdeDefaults();
        var est = {};
        for (var i = 0; i < ESTADOS_DISPONIBLES.length; i++) {
            est[ESTADOS_DISPONIBLES[i].key] = copiarEstado(def);
        }
        return est;
    }

    function normalizarDatosV2(parsed) {
        if (!parsed || typeof parsed !== 'object') {
            return { version: 2, estado_activo: ESTADO_DEFAULT, estados: buildDefaultEstadosObj() };
        }
        var def = crearValoresEstadoDesdeDefaults();
        var estados = {};
        for (var e = 0; e < ESTADOS_DISPONIBLES.length; e++) {
            var key = ESTADOS_DISPONIBLES[e].key;
            var incoming = parsed.estados && parsed.estados[key];
            estados[key] = fusionarEstadoSeguro(def, incoming);
        }
        var activo = parsed.estado_activo;
        var valido = false;
        for (var v = 0; v < ESTADOS_DISPONIBLES.length; v++) {
            if (ESTADOS_DISPONIBLES[v].key === activo) { valido = true; break; }
        }
        if (!valido) activo = ESTADO_DEFAULT;
        return { version: 2, estado_activo: activo, estados: estados };
    }

    var dataStore = StorageMod.createDebouncedStore({
        key: STORAGE_KEY,
        debounceMs: DEBOUNCE_MS,
        maxBytes: MAX_DATA_BYTES,
        onError: function (info) {
            console.error('storage data', info);
            if (info && info.type === 'quota') {
                mostrarErrorCotizador('Almacenamiento lleno. Libera espacio del navegador o borra datos del sitio.');
            } else if (info && info.type === 'too_large') {
                mostrarErrorCotizador('Configuracion demasiado grande para almacenar.');
            }
        }
    });

    var ponderadoStore = StorageMod.createDebouncedStore({
        key: STORAGE_PONDERADO,
        debounceMs: DEBOUNCE_MS,
        maxBytes: MAX_DATA_BYTES,
        onError: function (info) {
            if (info && info.type === 'quota') {
                mostrarErrorCotizador('Almacenamiento lleno. Libera espacio del navegador o borra datos del sitio.');
            }
        }
    });

    /** Flush sincrono de ambos stores (p. ej. recarga por SW). Sin Alpine; js/storage ya cubre pagehide/beforeunload. */
    function flushPersistenciaStores() {
        try {
            dataStore.flush();
            ponderadoStore.flush();
        } catch (e) {
            console.warn('flushPersistenciaStores:', e && e.message);
        }
    }
    var _g = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : null;
    if (_g) _g.__cotizadorFlushStores = flushPersistenciaStores;

    function cotizador() {
        var initialEstado = crearValoresEstadoDesdeDefaults();
        var base = {
            estadosDisponibles: ESTADOS_DISPONIBLES,
            estadoActivo: ESTADO_DEFAULT,
            brandTitulo: BRAND.titulo || 'Cotizador de pina',
            brandSubtituloPre: BRAND.subtituloPre || '',
            brandSubtituloMid: BRAND.subtituloMid || '',
            brandSubtituloPost: BRAND.subtituloPost || '',

            precio_kg_corto: 0,
            precio_kg_largo: 0,
            precioInviable: false,

            mostrarParametros: false,

            configuracionGuardada: false,
            tabActivo: 'basico',

            calibres: crearCalibresDesdeDefaults(),
            ponderaciones: (function () {
                var z = [];
                for (var i = 0; i < PONDERADO_CALIBRES.length; i++) z.push(0);
                return z;
            })(),
            sumaPct: 0,
            totalPonderado: 0,
            estadoDestinoPonderado: ESTADO_DEFAULT,
            ponderadoAplicadoOk: false,
            mostrarModalLimpiar: false,

            _saveTimer: null,
            _ponderadoSaveTimer: null,
            _toastTimers: [],
            _modalTriggerEl: null,
            _modalKeydownHandler: null,
            _externalUnsubscribe: null
        };
        for (var i = 0; i < CAMPOS_PERSISTIBLES.length; i++) {
            var k = CAMPOS_PERSISTIBLES[i];
            base[k] = initialEstado[k];
        }
        base.precio_venta = '';

        return Object.assign(base, {
            init: function () {
                this.cargarConfiguracion();
                this.cargarPonderado();
                this.calcular();
                this.calcularPonderado();
                if (!this.estadoDestinoPonderado) this.estadoDestinoPonderado = this.estadoActivo;

                var self = this;
                this.$nextTick(function () {
                    CAMPOS_PERSISTIBLES.forEach(function (campo) {
                        self.$watch(campo, function () {
                            self.scheduleGuardar();
                            self.configuracionGuardada = false;
                            self.calcular();
                        });
                    });
                    self.$watch('calibres', function () {
                        self.calcularPonderado();
                        self.scheduleGuardarPonderado();
                    }, { deep: true });
                });

                this._externalUnsubscribe = dataStore.onExternalChange(function (parsed) {
                    if (!parsed) return;
                    var data = normalizarDatosV2(parsed);
                    self.estadoActivo = data.estado_activo;
                    self.aplicarDatos(data.estados[self.estadoActivo], false);
                    self.calcular();
                });
            },

            scheduleGuardar: function () {
                dataStore.set(this.buildPersistedSnapshot());
            },

            scheduleGuardarPonderado: function () {
                ponderadoStore.set({ version: 1, calibres: this.calibres });
            },

            buildPersistedSnapshot: function () {
                var raw = dataStore.getRaw();
                var parsed = StorageMod.safeJSONParse(raw);
                var data = parsed ? normalizarDatosV2(parsed) : normalizarDatosV2(null);
                data.estado_activo = this.estadoActivo;
                data.estados[this.estadoActivo] = this.getPersistibleSnapshot();
                return data;
            },

            cargarConfiguracion: function () {
                try {
                    var parsedV2 = dataStore.get();
                    var data;
                    if (parsedV2) {
                        data = normalizarDatosV2(parsedV2);
                    } else {
                        var legacyRaw = null;
                        try { legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY); } catch (eLeg) { /* ignore */ }
                        if (legacyRaw) {
                            var legacyParsed = StorageMod.safeJSONParse(legacyRaw);
                            var estadosMigr = {};
                            for (var mi = 0; mi < ESTADOS_DISPONIBLES.length; mi++) {
                                var mkey = ESTADOS_DISPONIBLES[mi].key;
                                if (mkey === ESTADO_DEFAULT) {
                                    estadosMigr[mkey] = fusionarEstadoSeguro(crearValoresEstadoDesdeDefaults(), extraerPersistibles(legacyParsed));
                                } else {
                                    estadosMigr[mkey] = crearValoresEstadoDesdeDefaults();
                                }
                            }
                            data = { version: 2, estado_activo: ESTADO_DEFAULT, estados: estadosMigr };
                            dataStore.set(data);
                            dataStore.flush();
                            try { localStorage.removeItem(LEGACY_STORAGE_KEY); } catch (eRm) { /* ignore */ }
                        } else {
                            data = { version: 2, estado_activo: ESTADO_DEFAULT, estados: buildDefaultEstadosObj() };
                            dataStore.set(data);
                            dataStore.flush();
                        }
                    }

                    this.estadoActivo = data.estado_activo;
                    this.aplicarDatos(data.estados[this.estadoActivo], false);
                } catch (error) {
                    console.error('Error cargando configuracion:', error);
                    this.estadoActivo = ESTADO_DEFAULT;
                    this.aplicarDatos(crearValoresEstadoDesdeDefaults(), false);
                }
            },

            nombreEstadoActivo: function () {
                for (var i = 0; i < this.estadosDisponibles.length; i++) {
                    if (this.estadosDisponibles[i].key === this.estadoActivo) {
                        return this.estadosDisponibles[i].nombre;
                    }
                }
                return '';
            },

            getPersistibleSnapshot: function () {
                var o = {};
                for (var i = 0; i < CAMPOS_PERSISTIBLES.length; i++) {
                    var k = CAMPOS_PERSISTIBLES[i];
                    o[k] = this[k];
                }
                return o;
            },

            cambiarEstado: function (nuevaKey) {
                var ok = false;
                for (var i = 0; i < ESTADOS_DISPONIBLES.length; i++) {
                    if (ESTADOS_DISPONIBLES[i].key === nuevaKey) { ok = true; break; }
                }
                if (!ok || nuevaKey === this.estadoActivo) return;

                var snapshotActual = this.buildPersistedSnapshot();
                snapshotActual.estado_activo = nuevaKey;
                this.estadoActivo = nuevaKey;
                this.aplicarDatos(snapshotActual.estados[nuevaKey], false);
                dataStore.set(snapshotActual);
                this.calcular();
            },

            aplicarDatos: function (datos, esReset) {
                if (esReset === undefined) esReset = false;
                var fuente = datos || {};
                for (var i = 0; i < CAMPOS_PERSISTIBLES.length; i++) {
                    var k = CAMPOS_PERSISTIBLES[i];
                    var v = fuente[k];
                    if (v === undefined || v === null) {
                        v = VALORES_PREDETERMINADOS[k];
                    }
                    if (k === 'precio_venta' && (v === undefined || v === null)) {
                        v = '';
                    }
                    this[k] = v;
                }
            },

            validarNumero: Numeric.validarNumero,

            calcParams: function () {
                return {
                    tipo_cambio: this.tipo_cambio,
                    costo_aduana_embarque: this.costo_aduana_embarque,
                    costo_carton_caja: this.costo_carton_caja,
                    costo_empaque_caja_mxn: this.costo_empaque_caja_mxn,
                    costo_manejo_caja: this.costo_manejo_caja
                };
            },

            calcularGastosEmbarque: function (costoFleteMXN, cajas) {
                return Calc.calcularGastosEmbarque(this.calcParams(), costoFleteMXN, cajas);
            },

            calcularPrecioKg: function (precioVenta, comisionVenta, gastosEmbarque, cajas, tipoCambio, pesoCaja) {
                return Calc.calcularPrecioKg(precioVenta, comisionVenta, gastosEmbarque, cajas, tipoCambio, pesoCaja);
            },

            calcular: function () {
                try {
                    var precioVentaNum = Numeric.parseFlexible(this.precio_venta);
                    var tipoCambioNum = Numeric.parseFlexible(this.tipo_cambio);
                    var pesoCajaNum = Numeric.parseFlexible(this.peso_caja);
                    var cajasCortoNum = Numeric.parseFlexible(this.cajas_flete_corto);
                    var cajasLargoNum = Numeric.parseFlexible(this.cajas_flete_largo);

                    var precioInvalido = !isFinite(precioVentaNum) || isNaN(precioVentaNum);
                    var precioVacio = String(this.precio_venta).trim() === '';
                    if (precioVacio || precioInvalido ||
                        !isFinite(tipoCambioNum) || isNaN(tipoCambioNum) || tipoCambioNum <= 0 ||
                        !isFinite(pesoCajaNum) || pesoCajaNum <= 0 ||
                        !isFinite(cajasCortoNum) || cajasCortoNum <= 0 ||
                        !isFinite(cajasLargoNum) || cajasLargoNum <= 0) {
                        this.precio_kg_corto = 0;
                        this.precio_kg_largo = 0;
                        this.precioInviable = false;
                        return;
                    }

                    var gastosEmbarqueCorto = this.calcularGastosEmbarque(this.costo_flete_corto_mxn, this.cajas_flete_corto);
                    var gastosEmbarqueLargo = this.calcularGastosEmbarque(this.costo_flete_largo_mxn, this.cajas_flete_largo) +
                        Numeric.validarNumero(this.costo_sobrepeso_embarque, 0, Infinity);

                    var comision = Numeric.validarNumero(this.comision_venta, 0, 100);
                    var precioNetoCorto = precioVentaNum - (precioVentaNum * comision / 100) - (gastosEmbarqueCorto / cajasCortoNum);
                    var precioNetoLargo = precioVentaNum - (precioVentaNum * comision / 100) - (gastosEmbarqueLargo / cajasLargoNum);

                    this.precio_kg_corto = this.calcularPrecioKg(precioVentaNum, this.comision_venta, gastosEmbarqueCorto, this.cajas_flete_corto, tipoCambioNum, this.peso_caja);
                    this.precio_kg_largo = this.calcularPrecioKg(precioVentaNum, this.comision_venta, gastosEmbarqueLargo, this.cajas_flete_largo, tipoCambioNum, this.peso_caja);

                    this.precio_kg_corto = Numeric.validarNumero(this.precio_kg_corto, 0, Infinity);
                    this.precio_kg_largo = Numeric.validarNumero(this.precio_kg_largo, 0, Infinity);
                    var netoNegativo = precioNetoCorto < 0 || precioNetoLargo < 0;
                    this.precioInviable = netoNegativo && !precioVentaParcialParaAdvertencia(this.precio_venta);
                } catch (error) {
                    console.error('Error en calculo:', error);
                    this.precio_kg_corto = 0;
                    this.precio_kg_largo = 0;
                    this.precioInviable = false;
                }
            },

            guardarConfiguracion: function () {
                try {
                    this.scheduleGuardar();
                    dataStore.flush();
                    this.configuracionGuardada = true;
                    var self = this;
                    var t = setTimeout(function () { self.configuracionGuardada = false; }, 2000);
                    this._toastTimers.push(t);
                } catch (error) {
                    console.error('Error al guardar configuracion:', error);
                    this.configuracionGuardada = false;
                }
            },

            resetearValores: function () {
                var nombre = this.nombreEstadoActivo();
                var msg = 'Restaurar valores predeterminados solo para ' + nombre + '? Se perdera la configuracion guardada de este estado.';
                if (window.confirm(msg)) {
                    try {
                        this.aplicarDatos(crearValoresEstadoDesdeDefaults(), true);
                        this.scheduleGuardar();
                        dataStore.flush();
                        this.calcular();
                        this.configuracionGuardada = false;
                    } catch (error) {
                        console.error('Error al resetear valores:', error);
                    }
                }
            },

            formatNumber: function (num) {
                return Fmt.formatNumber(num);
            },

            exportarRespaldo: function () {
                try {
                    var snapshot = this.buildPersistedSnapshot();
                    var raw = JSON.stringify(snapshot);
                    dataStore.set(snapshot);
                    dataStore.flush();
                    var blob = new Blob([raw], { type: 'application/json;charset=utf-8' });
                    var url = URL.createObjectURL(blob);
                    var a = document.createElement('a');
                    a.href = url;
                    a.download = 'cotizador-respaldo-' + new Date().toISOString().split('T')[0] + '.json';
                    a.rel = 'noopener noreferrer';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                } catch (e) {
                    console.error('exportarRespaldo:', e);
                    mostrarErrorCotizador('No se pudo exportar el respaldo.');
                }
            },

            importarRespaldoSeleccionado: function (evt) {
                var input = evt && evt.target;
                var file = input && input.files && input.files[0];
                if (!file) return;
                if (typeof file.size === 'number' && file.size > MAX_BACKUP_BYTES) {
                    mostrarErrorCotizador('El archivo es demasiado grande para ser un respaldo valido.');
                    if (input) input.value = '';
                    return;
                }
                if (file.type && file.type !== 'application/json' && !/\.json$/i.test(file.name || '')) {
                    mostrarErrorCotizador('El archivo debe ser JSON.');
                    if (input) input.value = '';
                    return;
                }
                var self = this;
                var reader = new FileReader();
                reader.onload = function () {
                    try {
                        var text = String(reader.result || '');
                        if (text.length > MAX_BACKUP_BYTES * 2) {
                            mostrarErrorCotizador('El archivo es demasiado grande para procesarlo.');
                            return;
                        }
                        var parsed = JSON.parse(text);
                        if (!parsed || parsed.version !== 2 || !parsed.estados || typeof parsed.estados !== 'object' || Array.isArray(parsed.estados)) {
                            mostrarErrorCotizador('El archivo no es un respaldo valido (se espera version 2 y estados).');
                            return;
                        }
                        if (typeof parsed.estado_activo !== 'string') {
                            mostrarErrorCotizador('El respaldo no tiene estado_activo valido.');
                            return;
                        }
                        for (var i = 0; i < ESTADOS_DISPONIBLES.length; i++) {
                            var ek = ESTADOS_DISPONIBLES[i].key;
                            if (!Object.prototype.hasOwnProperty.call(parsed.estados, ek)) {
                                mostrarErrorCotizador('El respaldo no contiene el estado: ' + ek);
                                return;
                            }
                        }
                        var data = normalizarDatosV2(parsed);
                        dataStore.set(data);
                        dataStore.flush();
                        self.cargarConfiguracion();
                        self.calcular();
                        mostrarErrorCotizador('');
                    } catch (err) {
                        console.error('importarRespaldo:', err);
                        mostrarErrorCotizador('No se pudo importar el respaldo (JSON invalido o incompatible).');
                    } finally {
                        if (input) input.value = '';
                    }
                };
                reader.onerror = function () {
                    mostrarErrorCotizador('No se pudo leer el archivo.');
                    if (input) input.value = '';
                };
                reader.readAsText(file, 'UTF-8');
            },

            cambiarTab: function (tab) {
                if (tab !== 'basico' && tab !== 'avanzado') return;
                this.tabActivo = tab;
                if (tab === 'avanzado') this.ponderadoAplicadoOk = false;
            },

            calcularPonderado: function () {
                try {
                    var r = Calc.calcularPrecioPonderado(this.calibres);
                    this.ponderaciones = r.ponderaciones;
                    this.sumaPct = r.sumaPct;
                    this.totalPonderado = r.total;
                } catch (e) {
                    console.error('Error en calcularPonderado:', e);
                    this.ponderaciones = [];
                    this.sumaPct = 0;
                    this.totalPonderado = 0;
                }
            },

            solicitarLimpiarPonderado: function (ev) {
                this._modalTriggerEl = (ev && ev.currentTarget) || document.activeElement || null;
                this.mostrarModalLimpiar = true;
                var self = this;
                this.$nextTick(function () {
                    var modal = document.querySelector('.modal-backdrop .modal');
                    if (!modal) return;
                    var focusables = modal.querySelectorAll('button, [href], [tabindex]:not([tabindex="-1"])');
                    if (focusables.length > 0) focusables[0].focus();
                    self._modalKeydownHandler = function (e) {
                        if (e.key !== 'Tab') return;
                        if (focusables.length === 0) return;
                        var first = focusables[0];
                        var last = focusables[focusables.length - 1];
                        if (e.shiftKey && document.activeElement === first) {
                            e.preventDefault();
                            last.focus();
                        } else if (!e.shiftKey && document.activeElement === last) {
                            e.preventDefault();
                            first.focus();
                        }
                    };
                    modal.addEventListener('keydown', self._modalKeydownHandler);
                });
            },

            cancelarLimpiarPonderado: function () {
                this._cerrarModalLimpiar();
            },

            confirmarLimpiarPonderado: function () {
                for (var i = 0; i < this.calibres.length; i++) {
                    this.calibres[i].porcentaje = '';
                    this.calibres[i].precio = '';
                }
                this._cerrarModalLimpiar();
            },

            _cerrarModalLimpiar: function () {
                var modal = document.querySelector('.modal-backdrop .modal');
                if (modal && this._modalKeydownHandler) {
                    modal.removeEventListener('keydown', this._modalKeydownHandler);
                }
                this._modalKeydownHandler = null;
                this.mostrarModalLimpiar = false;
                if (this._modalTriggerEl && typeof this._modalTriggerEl.focus === 'function') {
                    var trigger = this._modalTriggerEl;
                    this._modalTriggerEl = null;
                    setTimeout(function () { try { trigger.focus(); } catch (e) { /* ignore */ } }, 0);
                }
            },

            ponderadoSumaValida: function () {
                return Math.abs(this.sumaPct - 100) <= PONDERADO_TOL;
            },

            porcentajeDisponible: function () {
                var dif = 100 - this.sumaPct;
                return Math.round(dif * 100) / 100;
            },

            disponibleClase: function () {
                var d = this.porcentajeDisponible();
                if (Math.abs(d) <= PONDERADO_TOL) return 'is-completo';
                if (d > 0) return 'is-falta';
                return 'is-excedido';
            },

            disponibleTexto: function () {
                var d = this.porcentajeDisponible();
                if (Math.abs(d) <= PONDERADO_TOL) return 'Completo (100%)';
                if (d > 0) return 'Disponible: ' + Fmt.formatNumber(d) + '%';
                return 'Excedido: ' + Fmt.formatNumber(Math.abs(d)) + '%';
            },

            ponderadoValido: function () {
                return this.ponderadoSumaValida() && this.totalPonderado >= 0.01;
            },

            puedeAplicarPonderado: function () {
                if (!this.ponderadoValido()) return false;
                for (var i = 0; i < ESTADOS_DISPONIBLES.length; i++) {
                    if (ESTADOS_DISPONIBLES[i].key === this.estadoDestinoPonderado) return true;
                }
                return false;
            },

            nombreEstadoPorKey: function (key) {
                for (var i = 0; i < ESTADOS_DISPONIBLES.length; i++) {
                    if (ESTADOS_DISPONIBLES[i].key === key) return ESTADOS_DISPONIBLES[i].nombre;
                }
                return key || '';
            },

            aplicarPonderadoABasico: function () {
                if (!this.puedeAplicarPonderado()) return;
                var destino = this.estadoDestinoPonderado;
                var valor = this.totalPonderado.toFixed(2);
                if (destino !== this.estadoActivo) {
                    this.cambiarEstado(destino);
                }
                this.precio_venta = valor;
                this.tabActivo = 'basico';
                this.ponderadoAplicadoOk = true;
                var self = this;
                var t = setTimeout(function () { self.ponderadoAplicadoOk = false; }, 2500);
                this._toastTimers.push(t);
            },

            cargarPonderado: function () {
                try {
                    var p = ponderadoStore.get();
                    if (!p || !Array.isArray(p.calibres)) return;
                    if (p.version !== 1) return;
                    for (var i = 0; i < this.calibres.length; i++) {
                        var size = this.calibres[i].size;
                        var match = null;
                        for (var j = 0; j < p.calibres.length; j++) {
                            if (p.calibres[j] && p.calibres[j].size === size) { match = p.calibres[j]; break; }
                        }
                        if (match) {
                            this.calibres[i].porcentaje = match.porcentaje !== undefined && match.porcentaje !== null ? match.porcentaje : '';
                            this.calibres[i].precio = match.precio !== undefined && match.precio !== null ? match.precio : '';
                        }
                    }
                } catch (e) {
                    console.error('Error cargando ponderado:', e);
                }
            },

            generarCotizacionHTML: function () {
                mostrarErrorCotizador('');
                try {
                    var precioVentaNum = Numeric.parseFlexible(this.precio_venta);
                    var tipoCambioNum = Numeric.parseFlexible(this.tipo_cambio);

                    if (String(this.precio_venta).trim() === '' || isNaN(precioVentaNum) || !isFinite(precioVentaNum)) {
                        mostrarErrorCotizador('Ingresa un precio de venta valido para generar el informe.');
                        return;
                    }
                    if (precioVentaNum < 0) {
                        mostrarErrorCotizador('El precio de venta no puede ser negativo.');
                        return;
                    }
                    if (!isFinite(tipoCambioNum) || tipoCambioNum <= 0) {
                        mostrarErrorCotizador('Ingresa un tipo de cambio valido mayor a cero.');
                        return;
                    }

                    var fecha = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
                    var hora = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

                    var self = this;
                    var tcInf = Numeric.validarNumero(tipoCambioNum, 0.01);
                    var calcularPasosPorFlete = function (tipo) {
                        var costoFleteMXN = tipo === 'corto' ? self.costo_flete_corto_mxn : self.costo_flete_largo_mxn;
                        var cajas = tipo === 'corto' ? self.cajas_flete_corto : self.cajas_flete_largo;
                        var cajasNorm = Numeric.validarNumero(cajas, 1);
                        var gastosEmbarque = self.calcularGastosEmbarque(costoFleteMXN, cajas);
                        var gastosTotal = tipo === 'largo' ? gastosEmbarque + Numeric.validarNumero(self.costo_sobrepeso_embarque, 0, Infinity) : gastosEmbarque;
                        var comision = precioVentaNum * Numeric.validarNumero(self.comision_venta, 0, 100) / 100;
                        var gastosPorCaja = gastosTotal / cajasNorm;
                        var precioNeto = precioVentaNum - comision - gastosPorCaja;
                        var precioMXN = precioNeto * tcInf;
                        var precioKg = tipo === 'corto' ? self.precio_kg_corto : self.precio_kg_largo;
                        return {
                            fleteUSD: Numeric.validarNumero(costoFleteMXN, 0) / tcInf,
                            empaqueUSD: Numeric.validarNumero(self.costo_empaque_caja_mxn, 0) / tcInf,
                            gastosTotal: gastosTotal,
                            gastosPorCaja: gastosPorCaja,
                            comision: comision,
                            precioNeto: precioNeto,
                            precioMXN: precioMXN,
                            precioKg: precioKg
                        };
                    };

                    var calcCorto = calcularPasosPorFlete('corto');
                    var calcLargo = calcularPasosPorFlete('largo');

                    var detallesCorto = {
                        cartonTotal: Numeric.validarNumero(this.costo_carton_caja, 0) * Numeric.validarNumero(this.cajas_flete_corto, 0),
                        empaqueTotal: calcCorto.empaqueUSD * Numeric.validarNumero(this.cajas_flete_corto, 0),
                        manejoTotal: Numeric.validarNumero(this.costo_manejo_caja, 0) * Numeric.validarNumero(this.cajas_flete_corto, 0)
                    };
                    var detallesLargo = {
                        cartonTotal: Numeric.validarNumero(this.costo_carton_caja, 0) * Numeric.validarNumero(this.cajas_flete_largo, 0),
                        empaqueTotal: calcLargo.empaqueUSD * Numeric.validarNumero(this.cajas_flete_largo, 0),
                        manejoTotal: Numeric.validarNumero(this.costo_manejo_caja, 0) * Numeric.validarNumero(this.cajas_flete_largo, 0)
                    };

                    var nl = '\n';
                    var fmtN = function (n) { return self.formatNumber(n); };

                    var datosInforme = {
                        schemaVersion: INFORME_SCHEMA,
                        fecha: fecha,
                        hora: hora,
                        estado: this.nombreEstadoActivo(),
                        precioVenta: precioVentaNum,
                        tipoCambio: tipoCambioNum,
                        precioKgCorto: this.precio_kg_corto,
                        precioKgLargo: this.precio_kg_largo,
                        calcCorto: [
                            { titulo: 'Paso 1: conversion de flete a USD', badge: 'Conversion', formula: 'Costo flete USD = ' + fmtN(this.costo_flete_corto_mxn) + ' MXN / ' + fmtN(tipoCambioNum), resultado: '$' + fmtN(calcCorto.fleteUSD) + ' USD', label: 'Costo flete USD:', highlight: false },
                            { titulo: 'Paso 2: conversion de empaque a USD', badge: 'Conversion', formula: 'Costo empaque USD = ' + fmtN(this.costo_empaque_caja_mxn) + ' MXN / ' + fmtN(tipoCambioNum), resultado: '$' + fmtN(calcCorto.empaqueUSD) + ' USD', label: 'Costo empaque USD:', highlight: false },
                            { titulo: 'Paso 3: gastos totales de embarque', badge: 'Suma', formula: '= ' + fmtN(calcCorto.fleteUSD) + ' (flete USD)' + nl + '+ ' + fmtN(this.costo_aduana_embarque) + ' (aduana)' + nl + '+ (' + fmtN(this.costo_carton_caja) + ' x ' + fmtN(this.cajas_flete_corto) + ') = ' + fmtN(detallesCorto.cartonTotal) + ' (carton)' + nl + '+ (' + fmtN(calcCorto.empaqueUSD) + ' x ' + fmtN(this.cajas_flete_corto) + ') = ' + fmtN(detallesCorto.empaqueTotal) + ' (empaque)' + nl + '+ (' + fmtN(this.costo_manejo_caja) + ' x ' + fmtN(this.cajas_flete_corto) + ') = ' + fmtN(detallesCorto.manejoTotal) + ' (manejo)', resultado: '$' + fmtN(calcCorto.gastosTotal) + ' USD', label: 'Gastos embarque total:', highlight: true },
                            { titulo: 'Paso 4: gastos prorrateados por caja', badge: 'Division', formula: 'Gastos por caja = ' + fmtN(calcCorto.gastosTotal) + ' USD / ' + fmtN(this.cajas_flete_corto) + ' cajas', resultado: '$' + fmtN(calcCorto.gastosPorCaja) + ' USD', label: 'Gastos por caja:', highlight: false },
                            { titulo: 'Paso 5: descuento por comision', badge: 'Porcentaje', formula: 'Descuento = ' + fmtN(precioVentaNum) + ' USD x ' + fmtN(this.comision_venta) + '% / 100', resultado: '$' + fmtN(calcCorto.comision) + ' USD', label: 'Descuento comision:', highlight: false },
                            { titulo: 'Paso 6: precio neto por caja (USD)', badge: 'Resta', formula: '= ' + fmtN(precioVentaNum) + ' (precio de venta)' + nl + '- ' + fmtN(calcCorto.comision) + ' (comision)' + nl + '- ' + fmtN(calcCorto.gastosPorCaja) + ' (gastos/caja)', resultado: '$' + fmtN(calcCorto.precioNeto) + ' USD', label: 'Precio neto por caja:', highlight: true },
                            { titulo: 'Paso 7: conversion a pesos mexicanos', badge: 'Multiplicacion', formula: 'Precio MXN = ' + fmtN(calcCorto.precioNeto) + ' USD x ' + fmtN(tipoCambioNum), resultado: '$' + fmtN(calcCorto.precioMXN) + ' MXN', label: 'Precio en MXN:', highlight: false },
                            { titulo: 'Paso 8: precio final por kilogramo', badge: 'Division', formula: 'Precio/kg = ' + fmtN(calcCorto.precioMXN) + ' MXN / ' + fmtN(this.peso_caja) + ' kg', resultado: '$' + fmtN(calcCorto.precioKg) + ' MXN/kg', label: 'Precio final por kg:', highlight: true, final: true }
                        ],
                        calcLargo: [
                            { titulo: 'Paso 1: conversion de flete a USD', badge: 'Conversion', formula: 'Costo flete USD = ' + fmtN(this.costo_flete_largo_mxn) + ' MXN / ' + fmtN(tipoCambioNum), resultado: '$' + fmtN(calcLargo.fleteUSD) + ' USD', label: 'Costo flete USD:', highlight: false },
                            { titulo: 'Paso 2: conversion de empaque a USD', badge: 'Conversion', formula: 'Costo empaque USD = ' + fmtN(this.costo_empaque_caja_mxn) + ' MXN / ' + fmtN(tipoCambioNum), resultado: '$' + fmtN(calcLargo.empaqueUSD) + ' USD', label: 'Costo empaque USD:', highlight: false },
                            { titulo: 'Paso 3: gastos totales de embarque', badge: 'Suma', formula: '= ' + fmtN(calcLargo.fleteUSD) + ' (flete USD)' + nl + '+ ' + fmtN(this.costo_aduana_embarque) + ' (aduana)' + nl + '+ (' + fmtN(this.costo_carton_caja) + ' x ' + fmtN(this.cajas_flete_largo) + ') = ' + fmtN(detallesLargo.cartonTotal) + ' (carton)' + nl + '+ (' + fmtN(calcLargo.empaqueUSD) + ' x ' + fmtN(this.cajas_flete_largo) + ') = ' + fmtN(detallesLargo.empaqueTotal) + ' (empaque)' + nl + '+ (' + fmtN(this.costo_manejo_caja) + ' x ' + fmtN(this.cajas_flete_largo) + ') = ' + fmtN(detallesLargo.manejoTotal) + ' (manejo)' + nl + '+ ' + fmtN(this.costo_sobrepeso_embarque) + ' (sobrepeso)', resultado: '$' + fmtN(calcLargo.gastosTotal) + ' USD', label: 'Gastos embarque total:', highlight: true },
                            { titulo: 'Paso 4: gastos prorrateados por caja', badge: 'Division', formula: 'Gastos por caja = ' + fmtN(calcLargo.gastosTotal) + ' USD / ' + fmtN(this.cajas_flete_largo) + ' cajas', resultado: '$' + fmtN(calcLargo.gastosPorCaja) + ' USD', label: 'Gastos por caja:', highlight: false },
                            { titulo: 'Paso 5: descuento por comision', badge: 'Porcentaje', formula: 'Descuento = ' + fmtN(precioVentaNum) + ' USD x ' + fmtN(this.comision_venta) + '% / 100', resultado: '$' + fmtN(calcLargo.comision) + ' USD', label: 'Descuento comision:', highlight: false },
                            { titulo: 'Paso 6: precio neto por caja (USD)', badge: 'Resta', formula: '= ' + fmtN(precioVentaNum) + ' (precio de venta)' + nl + '- ' + fmtN(calcLargo.comision) + ' (comision)' + nl + '- ' + fmtN(calcLargo.gastosPorCaja) + ' (gastos/caja)', resultado: '$' + fmtN(calcLargo.precioNeto) + ' USD', label: 'Precio neto por caja:', highlight: true },
                            { titulo: 'Paso 7: conversion a pesos mexicanos', badge: 'Multiplicacion', formula: 'Precio MXN = ' + fmtN(calcLargo.precioNeto) + ' USD x ' + fmtN(tipoCambioNum), resultado: '$' + fmtN(calcLargo.precioMXN) + ' MXN', label: 'Precio en MXN:', highlight: false },
                            { titulo: 'Paso 8: precio final por kilogramo', badge: 'Division', formula: 'Precio/kg = ' + fmtN(calcLargo.precioMXN) + ' MXN / ' + fmtN(this.peso_caja) + ' kg', resultado: '$' + fmtN(calcLargo.precioKg) + ' MXN/kg', label: 'Precio final por kg:', highlight: true, final: true }
                        ],
                        parametros: [
                            { nombre: 'Comision', valor: fmtN(this.comision_venta) + '%' },
                            { nombre: 'Peso por caja', valor: fmtN(this.peso_caja) + ' kg' },
                            { nombre: 'Flete corto', valor: '$' + fmtN(this.costo_flete_corto_mxn) + ' MXN' },
                            { nombre: 'Flete largo', valor: '$' + fmtN(this.costo_flete_largo_mxn) + ' MXN' },
                            { nombre: 'Cajas flete corto', valor: fmtN(this.cajas_flete_corto) },
                            { nombre: 'Cajas flete largo', valor: fmtN(this.cajas_flete_largo) },
                            { nombre: 'Aduana embarque', valor: '$' + fmtN(this.costo_aduana_embarque) + ' USD' },
                            { nombre: 'Carton por caja', valor: '$' + fmtN(this.costo_carton_caja) + ' USD' },
                            { nombre: 'Empaque por caja', valor: '$' + fmtN(this.costo_empaque_caja_mxn) + ' MXN' },
                            { nombre: 'Manejo por caja', valor: '$' + fmtN(this.costo_manejo_caja) + ' USD' },
                            { nombre: 'Sobrepeso', valor: '$' + fmtN(this.costo_sobrepeso_embarque) + ' USD' }
                        ]
                    };

                    var datosJSON = JSON.stringify(datosInforme);
                    var datosEncoded = encodeURIComponent(datosJSON);

                    try {
                        localStorage.setItem(STORAGE_INFORME, datosJSON);
                        sessionStorage.setItem(STORAGE_INFORME, datosJSON);
                        dbg('Datos de informe guardados');
                    } catch (storageError) {
                        console.error('Error guardando informe:', storageError);
                        if (storageError && storageError.name === 'QuotaExceededError') {
                            mostrarErrorCotizador('No hay espacio suficiente para guardar el informe en el navegador.');
                            return;
                        }
                    }

                    var url = './informe.html';
                    if (datosEncoded.length <= MAX_HASH_URL_CHARS) {
                        url = './informe.html#' + datosEncoded;
                    }
                    var ventana = window.open(url, '_blank', 'noopener,noreferrer');
                    if (ventana === null && window.location.protocol === 'file:') {
                        mostrarErrorCotizador('No se pudo abrir la ventana del informe. Permite ventanas emergentes.');
                    }
                } catch (error) {
                    console.error('Error generando cotizacion:', error);
                    mostrarErrorCotizador('Ocurrio un error al generar el informe.');
                }
            }
        });
    }

    window.cotizador = cotizador;
})();
