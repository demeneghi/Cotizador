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
    var ESTADO_DEFAULT = CFG.estadoDefault;
    var CAMPOS_PERSISTIBLES = CFG.camposPersistibles;
    var VALORES_PREDETERMINADOS = CFG.valoresPredeterminados;
    var Calc = window.CotizadorCalc;
    if (!Calc) {
        throw new Error('Falta CotizadorCalc (cargar js/calc-core.js antes)');
    }
    var Fmt = window.CotizadorFormat;
    if (!Fmt) {
        throw new Error('Falta CotizadorFormat (cargar js/format-number.js antes)');
    }

    function dbg() {
        if (CFG.debug) {
            console.log.apply(console, arguments);
        }
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

    function crearValoresEstadoDesdeDefaults() {
        var o = {};
        for (var i = 0; i < CAMPOS_PERSISTIBLES.length; i++) {
            var k = CAMPOS_PERSISTIBLES[i];
            o[k] = VALORES_PREDETERMINADOS[k];
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

    function normalizarDatosV2(parsed) {
        if (!parsed || typeof parsed !== 'object') {
            var def0 = crearValoresEstadoDesdeDefaults();
            var est0 = {};
            for (var j = 0; j < ESTADOS_DISPONIBLES.length; j++) {
                var ek = ESTADOS_DISPONIBLES[j].key;
                var copy = {};
                for (var ck in def0) {
                    if (Object.prototype.hasOwnProperty.call(def0, ck)) {
                        copy[ck] = def0[ck];
                    }
                }
                est0[ek] = copy;
            }
            return { version: 2, estado_activo: ESTADO_DEFAULT, estados: est0 };
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
            if (ESTADOS_DISPONIBLES[v].key === activo) {
                valido = true;
                break;
            }
        }
        if (!valido) activo = ESTADO_DEFAULT;
        return { version: 2, estado_activo: activo, estados: estados };
    }

    function cotizador() {
        return {
            estadosDisponibles: ESTADOS_DISPONIBLES,
            estadoActivo: ESTADO_DEFAULT,

            precio_venta: '',
            tipo_cambio: VALORES_PREDETERMINADOS.tipo_cambio,
            comision_venta: VALORES_PREDETERMINADOS.comision_venta,
            peso_caja: VALORES_PREDETERMINADOS.peso_caja,

            costo_flete_corto_mxn: VALORES_PREDETERMINADOS.costo_flete_corto_mxn,
            costo_flete_largo_mxn: VALORES_PREDETERMINADOS.costo_flete_largo_mxn,

            costo_aduana_embarque: VALORES_PREDETERMINADOS.costo_aduana_embarque,
            costo_carton_caja: VALORES_PREDETERMINADOS.costo_carton_caja,
            costo_empaque_caja_mxn: VALORES_PREDETERMINADOS.costo_empaque_caja_mxn,
            costo_manejo_caja: VALORES_PREDETERMINADOS.costo_manejo_caja,
            costo_sobrepeso_embarque: VALORES_PREDETERMINADOS.costo_sobrepeso_embarque,

            cajas_flete_corto: VALORES_PREDETERMINADOS.cajas_flete_corto,
            cajas_flete_largo: VALORES_PREDETERMINADOS.cajas_flete_largo,

            precio_kg_corto: 0,
            precio_kg_largo: 0,

            mostrarParametros: false,
            mostrarFormulas: false,

            configuracionGuardada: false,

            tipoFleteCalc: 'corto',

            init: function () {
                this.cargarConfiguracion();
                this.calcular();

                this.$nextTick(function () {
                    CAMPOS_PERSISTIBLES.forEach(function (campo) {
                        this.$watch(campo, function () {
                            this.guardarEnLocalStorage();
                            this.configuracionGuardada = false;
                            this.calcular();
                        }.bind(this));
                    }.bind(this));
                }.bind(this));
            },

            cargarConfiguracion: function () {
                try {
                    var rawV2 = localStorage.getItem(STORAGE_KEY);
                    var data;

                    if (rawV2) {
                        data = normalizarDatosV2(JSON.parse(rawV2));
                    } else {
                        var legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
                        if (legacyRaw) {
                            var legacyParsed = JSON.parse(legacyRaw);
                            var estadosMigr = {};
                            for (var mi = 0; mi < ESTADOS_DISPONIBLES.length; mi++) {
                                var mkey = ESTADOS_DISPONIBLES[mi].key;
                                if (mkey === ESTADO_DEFAULT) {
                                    estadosMigr[mkey] = fusionarEstadoSeguro(crearValoresEstadoDesdeDefaults(), extraerPersistibles(legacyParsed));
                                } else {
                                    estadosMigr[mkey] = crearValoresEstadoDesdeDefaults();
                                }
                            }
                            data = {
                                version: 2,
                                estado_activo: ESTADO_DEFAULT,
                                estados: estadosMigr
                            };
                            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
                            localStorage.removeItem(LEGACY_STORAGE_KEY);
                        } else {
                            var def = crearValoresEstadoDesdeDefaults();
                            var est = {};
                            for (var i = 0; i < ESTADOS_DISPONIBLES.length; i++) {
                                var kk = ESTADOS_DISPONIBLES[i].key;
                                var c = {};
                                for (var key in def) {
                                    if (Object.prototype.hasOwnProperty.call(def, key)) {
                                        c[key] = def[key];
                                    }
                                }
                                est[kk] = c;
                            }
                            data = {
                                version: 2,
                                estado_activo: ESTADO_DEFAULT,
                                estados: est
                            };
                            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
                        }
                    }

                    this.estadoActivo = data.estado_activo;
                    this.aplicarDatos(data.estados[this.estadoActivo], false);
                } catch (error) {
                    console.error('Error cargando configuración:', error);
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
                    if (ESTADOS_DISPONIBLES[i].key === nuevaKey) {
                        ok = true;
                        break;
                    }
                }
                if (!ok || nuevaKey === this.estadoActivo) return;

                this.guardarEnLocalStorage();
                this.estadoActivo = nuevaKey;
                try {
                    var raw = localStorage.getItem(STORAGE_KEY);
                    var data = raw ? normalizarDatosV2(JSON.parse(raw)) : normalizarDatosV2(null);
                    this.aplicarDatos(data.estados[this.estadoActivo], false);
                    this.guardarEnLocalStorage();
                } catch (e) {
                    console.error('Error al cambiar estado:', e);
                    this.aplicarDatos(crearValoresEstadoDesdeDefaults(), false);
                }
                this.calcular();
            },

            aplicarDatos: function (datos, esReset) {
                if (esReset === undefined) esReset = false;
                if (esReset) {
                    this.precio_venta = datos.precio_venta !== undefined ? datos.precio_venta : VALORES_PREDETERMINADOS.precio_venta;
                } else {
                    this.precio_venta = datos.precio_venta !== undefined && datos.precio_venta !== null
                        ? datos.precio_venta
                        : (VALORES_PREDETERMINADOS.precio_venta !== undefined ? VALORES_PREDETERMINADOS.precio_venta : '');
                }
                this.tipo_cambio = datos.tipo_cambio !== undefined ? datos.tipo_cambio : VALORES_PREDETERMINADOS.tipo_cambio;
                this.comision_venta = datos.comision_venta !== undefined ? datos.comision_venta : VALORES_PREDETERMINADOS.comision_venta;
                this.peso_caja = datos.peso_caja !== undefined ? datos.peso_caja : VALORES_PREDETERMINADOS.peso_caja;
                this.costo_flete_corto_mxn = datos.costo_flete_corto_mxn !== undefined ? datos.costo_flete_corto_mxn : VALORES_PREDETERMINADOS.costo_flete_corto_mxn;
                this.costo_flete_largo_mxn = datos.costo_flete_largo_mxn !== undefined ? datos.costo_flete_largo_mxn : VALORES_PREDETERMINADOS.costo_flete_largo_mxn;
                this.costo_aduana_embarque = datos.costo_aduana_embarque !== undefined ? datos.costo_aduana_embarque : VALORES_PREDETERMINADOS.costo_aduana_embarque;
                this.costo_carton_caja = datos.costo_carton_caja !== undefined ? datos.costo_carton_caja : VALORES_PREDETERMINADOS.costo_carton_caja;
                this.costo_empaque_caja_mxn = datos.costo_empaque_caja_mxn !== undefined ? datos.costo_empaque_caja_mxn : VALORES_PREDETERMINADOS.costo_empaque_caja_mxn;
                this.costo_manejo_caja = datos.costo_manejo_caja !== undefined ? datos.costo_manejo_caja : VALORES_PREDETERMINADOS.costo_manejo_caja;
                this.costo_sobrepeso_embarque = datos.costo_sobrepeso_embarque !== undefined ? datos.costo_sobrepeso_embarque : VALORES_PREDETERMINADOS.costo_sobrepeso_embarque;
                this.cajas_flete_corto = datos.cajas_flete_corto !== undefined ? datos.cajas_flete_corto : VALORES_PREDETERMINADOS.cajas_flete_corto;
                this.cajas_flete_largo = datos.cajas_flete_largo !== undefined ? datos.cajas_flete_largo : VALORES_PREDETERMINADOS.cajas_flete_largo;
            },

            guardarEnLocalStorage: function () {
                try {
                    var data;
                    var raw = localStorage.getItem(STORAGE_KEY);
                    if (raw) {
                        data = normalizarDatosV2(JSON.parse(raw));
                    } else {
                        var def = crearValoresEstadoDesdeDefaults();
                        var estN = {};
                        for (var i = 0; i < ESTADOS_DISPONIBLES.length; i++) {
                            var key = ESTADOS_DISPONIBLES[i].key;
                            var c = {};
                            for (var k in def) {
                                if (Object.prototype.hasOwnProperty.call(def, k)) {
                                    c[k] = def[k];
                                }
                            }
                            estN[key] = c;
                        }
                        data = {
                            version: 2,
                            estado_activo: this.estadoActivo,
                            estados: estN
                        };
                    }
                    data.estado_activo = this.estadoActivo;
                    data.estados[this.estadoActivo] = this.getPersistibleSnapshot();
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
                } catch (error) {
                    console.error('Error guardando en localStorage:', error);
                    if (error && error.name === 'QuotaExceededError') {
                        mostrarErrorCotizador('Almacenamiento lleno. Libera espacio del navegador o borra datos del sitio.');
                    }
                }
            },

            validarNumero: function (valor, minimo, maximo) {
                if (arguments.length === 2) {
                    return Calc.validarNumero(valor, minimo, Infinity);
                }
                return Calc.validarNumero(valor, minimo, maximo);
            },

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
                    var precioRaw = String(this.precio_venta).replace(/,/g, '').trim();
                    var precioVentaNum = precioRaw === '' ? NaN : parseFloat(precioRaw);
                    var tipoCambioNum = parseFloat(String(this.tipo_cambio).replace(/,/g, ''));

                    var precioNoNumerico = precioRaw !== '' && (isNaN(precioVentaNum) || !isFinite(precioVentaNum));
                    var precioVacio = precioRaw === '';
                    if (precioNoNumerico || precioVacio || isNaN(tipoCambioNum) || !isFinite(tipoCambioNum) ||
                        tipoCambioNum <= 0 || Number(this.peso_caja) <= 0 ||
                        Number(this.cajas_flete_corto) <= 0 || Number(this.cajas_flete_largo) <= 0) {
                        this.precio_kg_corto = 0;
                        this.precio_kg_largo = 0;
                        return;
                    }

                    var gastosEmbarqueCorto = this.calcularGastosEmbarque(
                        this.costo_flete_corto_mxn,
                        this.cajas_flete_corto
                    );

                    var gastosEmbarqueLargo = this.calcularGastosEmbarque(
                        this.costo_flete_largo_mxn,
                        this.cajas_flete_largo
                    ) + this.validarNumero(this.costo_sobrepeso_embarque, 0, Infinity);

                    this.precio_kg_corto = this.calcularPrecioKg(
                        precioVentaNum,
                        this.comision_venta,
                        gastosEmbarqueCorto,
                        this.cajas_flete_corto,
                        tipoCambioNum,
                        this.peso_caja
                    );

                    this.precio_kg_largo = this.calcularPrecioKg(
                        precioVentaNum,
                        this.comision_venta,
                        gastosEmbarqueLargo,
                        this.cajas_flete_largo,
                        tipoCambioNum,
                        this.peso_caja
                    );

                    this.precio_kg_corto = this.validarNumero(this.precio_kg_corto, 0, Infinity);
                    this.precio_kg_largo = this.validarNumero(this.precio_kg_largo, 0, Infinity);
                } catch (error) {
                    console.error('Error en cálculo:', error);
                    this.precio_kg_corto = 0;
                    this.precio_kg_largo = 0;
                }
            },

            guardarConfiguracion: function () {
                try {
                    this.guardarEnLocalStorage();
                    this.configuracionGuardada = true;
                    var self = this;
                    setTimeout(function () {
                        self.configuracionGuardada = false;
                    }, 2000);
                } catch (error) {
                    console.error('Error al guardar configuración:', error);
                    this.configuracionGuardada = false;
                }
            },

            resetearValores: function () {
                var nombre = this.nombreEstadoActivo();
                var msg = '¿Restaurar valores predeterminados solo para ' + nombre + '? Se perderá la configuración guardada de este estado.';
                if (window.confirm(msg)) {
                    try {
                        var v = {};
                        for (var key in VALORES_PREDETERMINADOS) {
                            if (Object.prototype.hasOwnProperty.call(VALORES_PREDETERMINADOS, key)) {
                                v[key] = VALORES_PREDETERMINADOS[key];
                            }
                        }
                        this.aplicarDatos(v, true);
                        this.guardarEnLocalStorage();
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

            _formulaTipoCambio: function () {
                return Calc.validarNumero(String(this.tipo_cambio).replace(/,/g, ''), 0.01);
            },

            _formulaCajasActivas: function () {
                var c = this.tipoFleteCalc === 'corto' ? this.cajas_flete_corto : this.cajas_flete_largo;
                return Calc.validarNumero(c, 1);
            },

            _formulaFleteMxnActivo: function () {
                var m = this.tipoFleteCalc === 'corto' ? this.costo_flete_corto_mxn : this.costo_flete_largo_mxn;
                return Calc.validarNumero(m, 0);
            },

            formulaFleteUsd: function () {
                return this._formulaFleteMxnActivo() / this._formulaTipoCambio();
            },

            formulaEmpaqueUsd: function () {
                return Calc.validarNumero(this.costo_empaque_caja_mxn, 0) / this._formulaTipoCambio();
            },

            formulaCartonTotal: function () {
                return Calc.validarNumero(this.costo_carton_caja, 0) * this._formulaCajasActivas();
            },

            formulaEmpaqueLineTotal: function () {
                return this.formulaEmpaqueUsd() * this._formulaCajasActivas();
            },

            formulaManejoTotal: function () {
                return Calc.validarNumero(this.costo_manejo_caja, 0) * this._formulaCajasActivas();
            },

            formulaGastosPorCaja: function () {
                return this.calcularGastosEmbarqueDisplay() / this._formulaCajasActivas();
            },

            _formulaPrecioVentaNum: function () {
                var raw = String(this.precio_venta).replace(/,/g, '').trim();
                if (raw === '') return 0;
                var n = parseFloat(raw);
                if (isNaN(n) || !isFinite(n) || n < 0) return 0;
                return n;
            },

            formulaComisionMonto: function () {
                return this._formulaPrecioVentaNum() * Calc.validarNumero(this.comision_venta, 0, 100) / 100;
            },

            formulaPrecioNeto: function () {
                return this._formulaPrecioVentaNum() - this.formulaComisionMonto() - this.formulaGastosPorCaja();
            },

            formulaPrecioMxn: function () {
                return this.formulaPrecioNeto() * this._formulaTipoCambio();
            },

            formulaPrecioKgPaso: function () {
                return this.formulaPrecioMxn() / Calc.validarNumero(this.peso_caja, 0.01);
            },

            exportarRespaldo: function () {
                try {
                    var raw = localStorage.getItem(STORAGE_KEY);
                    if (!raw) {
                        mostrarErrorCotizador('No hay datos guardados para exportar.');
                        return;
                    }
                    var blob = new Blob([raw], { type: 'application/json;charset=utf-8' });
                    var url = URL.createObjectURL(blob);
                    var a = document.createElement('a');
                    a.href = url;
                    a.download = 'cotizador-respaldo-' + new Date().toISOString().split('T')[0] + '.json';
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
                var self = this;
                var reader = new FileReader();
                reader.onload = function () {
                    try {
                        var parsed = JSON.parse(String(reader.result || ''));
                        if (!parsed || parsed.version !== 2 || !parsed.estados || typeof parsed.estados !== 'object') {
                            mostrarErrorCotizador('El archivo no es un respaldo válido (se espera version 2 y estados).');
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
                        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
                        self.cargarConfiguracion();
                        self.calcular();
                        mostrarErrorCotizador('');
                    } catch (err) {
                        console.error('importarRespaldo:', err);
                        mostrarErrorCotizador('No se pudo importar el respaldo (JSON inválido o incompatible).');
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

            calcularGastosEmbarqueDisplay: function () {
                var costoFleteMXN = this.tipoFleteCalc === 'corto' ? this.costo_flete_corto_mxn : this.costo_flete_largo_mxn;
                var cajas = this.tipoFleteCalc === 'corto' ? this.cajas_flete_corto : this.cajas_flete_largo;
                var gastosBase = this.calcularGastosEmbarque(costoFleteMXN, cajas);
                if (this.tipoFleteCalc === 'largo') {
                    return gastosBase + this.validarNumero(this.costo_sobrepeso_embarque, 0, Infinity);
                }
                return gastosBase;
            },

            generarCotizacionHTML: function () {
                mostrarErrorCotizador('');
                try {
                    var precioRaw = String(this.precio_venta).replace(/,/g, '').trim();
                    var precioVentaNum = precioRaw === '' ? NaN : parseFloat(precioRaw);
                    var tipoCambioNum = parseFloat(String(this.tipo_cambio).replace(/,/g, '')) || 0;

                    if (precioRaw === '' || isNaN(precioVentaNum) || !isFinite(precioVentaNum)) {
                        mostrarErrorCotizador('Ingresa un precio de venta válido para generar el informe.');
                        return;
                    }
                    if (precioVentaNum < 0) {
                        mostrarErrorCotizador('El precio de venta no puede ser negativo.');
                        return;
                    }
                    if (!tipoCambioNum || isNaN(tipoCambioNum) || tipoCambioNum <= 0) {
                        mostrarErrorCotizador('Ingresa un tipo de cambio válido mayor a cero.');
                        return;
                    }

                    var fecha = new Date().toLocaleDateString('es-MX', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric'
                    });
                    var hora = new Date().toLocaleTimeString('es-MX', {
                        hour: '2-digit',
                        minute: '2-digit'
                    });

                    var self = this;
                    var tcInf = Calc.validarNumero(tipoCambioNum, 0.01);
                    var calcularPasosPorFlete = function (tipo) {
                        var costoFleteMXN = tipo === 'corto' ? self.costo_flete_corto_mxn : self.costo_flete_largo_mxn;
                        var cajas = tipo === 'corto' ? self.cajas_flete_corto : self.cajas_flete_largo;
                        var cajasNorm = Calc.validarNumero(cajas, 1);
                        var gastosEmbarque = self.calcularGastosEmbarque(costoFleteMXN, cajas);
                        var gastosTotal = tipo === 'largo' ? gastosEmbarque + self.validarNumero(self.costo_sobrepeso_embarque, 0, Infinity) : gastosEmbarque;
                        var comision = precioVentaNum * Calc.validarNumero(self.comision_venta, 0, 100) / 100;
                        var gastosPorCaja = gastosTotal / cajasNorm;
                        var precioNeto = precioVentaNum - comision - gastosPorCaja;
                        var precioMXN = precioNeto * tcInf;
                        var precioKg = tipo === 'corto' ? self.precio_kg_corto : self.precio_kg_largo;
                        return {
                            fleteUSD: Calc.validarNumero(costoFleteMXN, 0) / tcInf,
                            empaqueUSD: Calc.validarNumero(self.costo_empaque_caja_mxn, 0) / tcInf,
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
                        fleteUSD: calcCorto.fleteUSD,
                        empaqueUSD: calcCorto.empaqueUSD,
                        cartonTotal: this.costo_carton_caja * this.cajas_flete_corto,
                        empaqueTotal: calcCorto.empaqueUSD * this.cajas_flete_corto,
                        manejoTotal: this.costo_manejo_caja * this.cajas_flete_corto
                    };

                    var detallesLargo = {
                        fleteUSD: calcLargo.fleteUSD,
                        empaqueUSD: calcLargo.empaqueUSD,
                        cartonTotal: this.costo_carton_caja * this.cajas_flete_largo,
                        empaqueTotal: calcLargo.empaqueUSD * this.cajas_flete_largo,
                        manejoTotal: this.costo_manejo_caja * this.cajas_flete_largo
                    };

                    var nl = '\n';
                    var datosInforme = {
                        schemaVersion: CFG.informe.informeJsonSchemaVersion,
                        fecha: fecha,
                        hora: hora,
                        estado: this.nombreEstadoActivo(),
                        precioVenta: precioVentaNum,
                        tipoCambio: tipoCambioNum,
                        precioKgCorto: this.precio_kg_corto,
                        precioKgLargo: this.precio_kg_largo,
                        calcCorto: [
                            { titulo: 'Paso 1: Conversión de Flete a USD', badge: 'Conversión', formula: 'Costo Flete USD = ' + this.formatNumber(this.costo_flete_corto_mxn) + ' MXN ÷ ' + this.formatNumber(tipoCambioNum), resultado: '$' + this.formatNumber(calcCorto.fleteUSD) + ' USD', label: 'Costo Flete USD:', highlight: false },
                            { titulo: 'Paso 2: Conversión de Empaque a USD', badge: 'Conversión', formula: 'Costo Empaque USD = ' + this.formatNumber(this.costo_empaque_caja_mxn) + ' MXN ÷ ' + this.formatNumber(tipoCambioNum), resultado: '$' + this.formatNumber(calcCorto.empaqueUSD) + ' USD', label: 'Costo Empaque USD:', highlight: false },
                            { titulo: 'Paso 3: Gastos Totales de Embarque', badge: 'Suma', formula: '= ' + this.formatNumber(calcCorto.fleteUSD) + ' (Flete USD)' + nl + '+ ' + this.formatNumber(this.costo_aduana_embarque) + ' (Aduana)' + nl + '+ (' + this.formatNumber(this.costo_carton_caja) + ' × ' + this.formatNumber(this.cajas_flete_corto) + ') = ' + this.formatNumber(detallesCorto.cartonTotal) + ' (Cartón)' + nl + '+ (' + this.formatNumber(calcCorto.empaqueUSD) + ' × ' + this.formatNumber(this.cajas_flete_corto) + ') = ' + this.formatNumber(detallesCorto.empaqueTotal) + ' (Empaque)' + nl + '+ (' + this.formatNumber(this.costo_manejo_caja) + ' × ' + this.formatNumber(this.cajas_flete_corto) + ') = ' + this.formatNumber(detallesCorto.manejoTotal) + ' (Manejo)', resultado: '$' + this.formatNumber(calcCorto.gastosTotal) + ' USD', label: 'Gastos Embarque Total:', highlight: true },
                            { titulo: 'Paso 4: Gastos Prorrateados por Caja', badge: 'División', formula: 'Gastos por Caja = ' + this.formatNumber(calcCorto.gastosTotal) + ' USD ÷ ' + this.formatNumber(this.cajas_flete_corto) + ' cajas', resultado: '$' + this.formatNumber(calcCorto.gastosPorCaja) + ' USD', label: 'Gastos por Caja:', highlight: false },
                            { titulo: 'Paso 5: Descuento por Comisión', badge: 'Porcentaje', formula: 'Descuento = ' + this.formatNumber(precioVentaNum) + ' USD × ' + this.formatNumber(this.comision_venta) + '% ÷ 100', resultado: '$' + this.formatNumber(calcCorto.comision) + ' USD', label: 'Descuento Comisión:', highlight: false },
                            { titulo: 'Paso 6: Precio Neto por Caja (USD)', badge: 'Resta', formula: '= ' + this.formatNumber(precioVentaNum) + ' (Precio Venta)' + nl + '- ' + this.formatNumber(calcCorto.comision) + ' (Comisión)' + nl + '- ' + this.formatNumber(calcCorto.gastosPorCaja) + ' (Gastos/Caja)', resultado: '$' + this.formatNumber(calcCorto.precioNeto) + ' USD', label: 'Precio Neto por Caja:', highlight: true },
                            { titulo: 'Paso 7: Conversión a Pesos Mexicanos', badge: 'Multiplicación', formula: 'Precio MXN = ' + this.formatNumber(calcCorto.precioNeto) + ' USD × ' + this.formatNumber(tipoCambioNum), resultado: '$' + this.formatNumber(calcCorto.precioMXN) + ' MXN', label: 'Precio en MXN:', highlight: false },
                            { titulo: 'Paso 8: Precio Final por Kilogramo', badge: 'División', formula: 'Precio/Kg = ' + this.formatNumber(calcCorto.precioMXN) + ' MXN ÷ ' + this.formatNumber(this.peso_caja) + ' kg', resultado: '$' + this.formatNumber(calcCorto.precioKg) + ' MXN/kg', label: 'PRECIO FINAL POR KG:', highlight: true, final: true }
                        ],
                        calcLargo: [
                            { titulo: 'Paso 1: Conversión de Flete a USD', badge: 'Conversión', formula: 'Costo Flete USD = ' + this.formatNumber(this.costo_flete_largo_mxn) + ' MXN ÷ ' + this.formatNumber(tipoCambioNum), resultado: '$' + this.formatNumber(calcLargo.fleteUSD) + ' USD', label: 'Costo Flete USD:', highlight: false },
                            { titulo: 'Paso 2: Conversión de Empaque a USD', badge: 'Conversión', formula: 'Costo Empaque USD = ' + this.formatNumber(this.costo_empaque_caja_mxn) + ' MXN ÷ ' + this.formatNumber(tipoCambioNum), resultado: '$' + this.formatNumber(calcLargo.empaqueUSD) + ' USD', label: 'Costo Empaque USD:', highlight: false },
                            { titulo: 'Paso 3: Gastos Totales de Embarque', badge: 'Suma', formula: '= ' + this.formatNumber(calcLargo.fleteUSD) + ' (Flete USD)' + nl + '+ ' + this.formatNumber(this.costo_aduana_embarque) + ' (Aduana)' + nl + '+ (' + this.formatNumber(this.costo_carton_caja) + ' × ' + this.formatNumber(this.cajas_flete_largo) + ') = ' + this.formatNumber(detallesLargo.cartonTotal) + ' (Cartón)' + nl + '+ (' + this.formatNumber(calcLargo.empaqueUSD) + ' × ' + this.formatNumber(this.cajas_flete_largo) + ') = ' + this.formatNumber(detallesLargo.empaqueTotal) + ' (Empaque)' + nl + '+ (' + this.formatNumber(this.costo_manejo_caja) + ' × ' + this.formatNumber(this.cajas_flete_largo) + ') = ' + this.formatNumber(detallesLargo.manejoTotal) + ' (Manejo)' + nl + '+ ' + this.formatNumber(this.costo_sobrepeso_embarque) + ' (Sobrepeso)', resultado: '$' + this.formatNumber(calcLargo.gastosTotal) + ' USD', label: 'Gastos Embarque Total:', highlight: true },
                            { titulo: 'Paso 4: Gastos Prorrateados por Caja', badge: 'División', formula: 'Gastos por Caja = ' + this.formatNumber(calcLargo.gastosTotal) + ' USD ÷ ' + this.formatNumber(this.cajas_flete_largo) + ' cajas', resultado: '$' + this.formatNumber(calcLargo.gastosPorCaja) + ' USD', label: 'Gastos por Caja:', highlight: false },
                            { titulo: 'Paso 5: Descuento por Comisión', badge: 'Porcentaje', formula: 'Descuento = ' + this.formatNumber(precioVentaNum) + ' USD × ' + this.formatNumber(this.comision_venta) + '% ÷ 100', resultado: '$' + this.formatNumber(calcLargo.comision) + ' USD', label: 'Descuento Comisión:', highlight: false },
                            { titulo: 'Paso 6: Precio Neto por Caja (USD)', badge: 'Resta', formula: '= ' + this.formatNumber(precioVentaNum) + ' (Precio Venta)' + nl + '- ' + this.formatNumber(calcLargo.comision) + ' (Comisión)' + nl + '- ' + this.formatNumber(calcLargo.gastosPorCaja) + ' (Gastos/Caja)', resultado: '$' + this.formatNumber(calcLargo.precioNeto) + ' USD', label: 'Precio Neto por Caja:', highlight: true },
                            { titulo: 'Paso 7: Conversión a Pesos Mexicanos', badge: 'Multiplicación', formula: 'Precio MXN = ' + this.formatNumber(calcLargo.precioNeto) + ' USD × ' + this.formatNumber(tipoCambioNum), resultado: '$' + this.formatNumber(calcLargo.precioMXN) + ' MXN', label: 'Precio en MXN:', highlight: false },
                            { titulo: 'Paso 8: Precio Final por Kilogramo', badge: 'División', formula: 'Precio/Kg = ' + this.formatNumber(calcLargo.precioMXN) + ' MXN ÷ ' + this.formatNumber(this.peso_caja) + ' kg', resultado: '$' + this.formatNumber(calcLargo.precioKg) + ' MXN/kg', label: 'PRECIO FINAL POR KG:', highlight: true, final: true }
                        ],
                        parametros: [
                            { nombre: 'Comisión', valor: this.formatNumber(this.comision_venta) + '%' },
                            { nombre: 'Peso por Caja', valor: this.formatNumber(this.peso_caja) + ' kg' },
                            { nombre: 'Flete Corto', valor: '$' + this.formatNumber(this.costo_flete_corto_mxn) + ' MXN' },
                            { nombre: 'Flete Largo', valor: '$' + this.formatNumber(this.costo_flete_largo_mxn) + ' MXN' },
                            { nombre: 'Cajas Flete Corto', valor: this.formatNumber(this.cajas_flete_corto) },
                            { nombre: 'Cajas Flete Largo', valor: this.formatNumber(this.cajas_flete_largo) },
                            { nombre: 'Aduana Embarque', valor: '$' + this.formatNumber(this.costo_aduana_embarque) + ' USD' },
                            { nombre: 'Cartón por Caja', valor: '$' + this.formatNumber(this.costo_carton_caja) + ' USD' },
                            { nombre: 'Empaque por Caja', valor: '$' + this.formatNumber(this.costo_empaque_caja_mxn) + ' MXN' },
                            { nombre: 'Manejo por Caja', valor: '$' + this.formatNumber(this.costo_manejo_caja) + ' USD' },
                            { nombre: 'Sobrepeso', valor: '$' + this.formatNumber(this.costo_sobrepeso_embarque) + ' USD' }
                        ]
                    };

                    try {
                        var datosJSON = JSON.stringify(datosInforme);
                        localStorage.setItem(STORAGE_INFORME, datosJSON);
                        sessionStorage.setItem(STORAGE_INFORME, datosJSON);
                        dbg('Datos de informe guardados');

                        var datosEncoded = encodeURIComponent(datosJSON);
                        var maxH = CFG.informe.maxHashUrlChars;

                        // Solo dos argumentos: con features "noopener" algunos navegadores devuelven null
                        // aunque la pestaña sí se abrió, y el aviso de bloqueo sería un falso positivo.
                        if (window.location.protocol === 'file:') {
                            if (datosEncoded.length > maxH) {
                                var ventanaL = window.open('./informe.html', '_blank');
                                if (!ventanaL) {
                                    mostrarErrorCotizador('No se pudo abrir la ventana del informe. Permite ventanas emergentes.');
                                }
                                return;
                            }
                            var ventana = window.open('./informe.html#' + datosEncoded, '_blank');
                            if (!ventana) {
                                mostrarErrorCotizador('No se pudo abrir la ventana del informe. Permite ventanas emergentes.');
                            }
                        } else {
                            setTimeout(function () {
                                var w = window.open('./informe.html', '_blank');
                                if (!w) {
                                    mostrarErrorCotizador('No se pudo abrir la ventana del informe. Permite ventanas emergentes.');
                                }
                            }, 100);
                        }
                    } catch (storageError) {
                        console.error('Error guardando datos:', storageError);
                        if (storageError && storageError.name === 'QuotaExceededError') {
                            mostrarErrorCotizador('No hay espacio suficiente para guardar el informe en el navegador.');
                        } else {
                            mostrarErrorCotizador('No se pudo guardar el informe. Intenta de nuevo.');
                        }
                    }
                } catch (error) {
                    console.error('Error generando cotización:', error);
                    mostrarErrorCotizador('Ocurrió un error al generar el informe.');
                }
            }
        };
    }

    window.cotizador = cotizador;
})();
