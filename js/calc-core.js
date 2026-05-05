/**
 * Nucleo de calculos del cotizador (sin Alpine). Usado por la UI y por tests Node.
 *
 * Delega parseo numerico a CotizadorNumeric (modulo unico de parseo decimal).
 */
(function (global) {
    'use strict';

    var Numeric = global.CotizadorNumeric ||
        (typeof require === 'function' ? require('./numeric.js') : null);
    if (!Numeric) {
        throw new Error('Falta CotizadorNumeric (cargar js/numeric.js antes)');
    }

    function validarNumero(valor, minimo, maximo) {
        return Numeric.validarNumero(valor, minimo, maximo);
    }

    /**
     * @param {object} params - tipo_cambio, costo_aduana_embarque, costo_carton_caja, costo_empaque_caja_mxn, costo_manejo_caja
     * @param {number|string} costoFleteMXN - flete en MXN para el tramo actual
     * @param {number|string} cajas - numero de cajas del tramo
     */
    function calcularGastosEmbarque(params, costoFleteMXN, cajas) {
        var tipoCambio = params.tipo_cambio;
        var costoFleteUSD = validarNumero(costoFleteMXN, 0) / validarNumero(tipoCambio, 0.01);
        var numCajas = validarNumero(cajas, 1);
        var costoAduana = validarNumero(params.costo_aduana_embarque, 0);
        var costoCarton = validarNumero(params.costo_carton_caja, 0);
        var costoEmpaqueMXN = validarNumero(params.costo_empaque_caja_mxn, 0);
        var costoEmpaqueUSD = costoEmpaqueMXN / validarNumero(tipoCambio, 0.01);
        var costoManejo = validarNumero(params.costo_manejo_caja, 0);
        var resultado = costoFleteUSD + costoAduana + (costoCarton * numCajas) +
            (costoEmpaqueUSD * numCajas) + (costoManejo * numCajas);
        return validarNumero(resultado, 0);
    }

    /**
     * Devuelve precio por kg en MXN. Si la cotizacion es inviable (precio neto
     * negativo), retorna 0 para evitar mostrar valores irreales en la UI.
     */
    function calcularPrecioKg(precioVenta, comisionVenta, gastosEmbarque, cajas, tipoCambio, pesoCaja) {
        var pv = validarNumero(precioVenta, 0);
        var cv = validarNumero(comisionVenta, 0, 100);
        var ge = validarNumero(gastosEmbarque, 0);
        var nc = validarNumero(cajas, 1);
        var tc = validarNumero(tipoCambio, 0.01);
        var pc = validarNumero(pesoCaja, 0.01);
        var precioNeto = pv - (pv * cv / 100) - (ge / nc);
        if (precioNeto < 0) return 0;
        var resultado = (precioNeto * tc) / pc;
        if (!isFinite(resultado) || isNaN(resultado)) return 0;
        if (resultado < 0) return 0;
        return resultado;
    }

    /**
     * Promedio ponderado por calibre.
     * @param {Array<{porcentaje:(number|string), precio:(number|string)}>} calibres
     * @returns {{ total:number, sumaPct:number, ponderaciones:number[] }}
     */
    function calcularPrecioPonderado(calibres) {
        var ponderaciones = [];
        var total = 0;
        var sumaPct = 0;
        if (!calibres || typeof calibres.length !== 'number' || calibres.length === 0) {
            return { total: 0, sumaPct: 0, ponderaciones: ponderaciones };
        }
        for (var i = 0; i < calibres.length; i++) {
            var fila = calibres[i] || {};
            var p = validarNumero(fila.porcentaje, 0, 100);
            var pr = validarNumero(fila.precio, 0);
            var aporte = (p / 100) * pr;
            if (!isFinite(aporte) || isNaN(aporte)) aporte = 0;
            ponderaciones.push(aporte);
            sumaPct += p;
            total += aporte;
        }
        if (!isFinite(total) || isNaN(total)) total = 0;
        if (!isFinite(sumaPct) || isNaN(sumaPct)) sumaPct = 0;
        return { total: total, sumaPct: sumaPct, ponderaciones: ponderaciones };
    }

    var api = {
        validarNumero: validarNumero,
        calcularGastosEmbarque: calcularGastosEmbarque,
        calcularPrecioKg: calcularPrecioKg,
        calcularPrecioPonderado: calcularPrecioPonderado
    };
    global.CotizadorCalc = api;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
