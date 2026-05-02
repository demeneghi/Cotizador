(function () {
    'use strict';

    var CFG = window.__APP_CONFIG__;
    if (!CFG) {
        throw new Error('Falta window.__APP_CONFIG__');
    }
    var Fmt = window.CotizadorFormat;
    if (!Fmt) {
        throw new Error('Falta CotizadorFormat (cargar js/format-number.js antes)');
    }
    var Inv = window.CotizadorInformeValidate;
    if (!Inv) {
        throw new Error('Falta CotizadorInformeValidate (cargar js/informe-validate.js antes)');
    }

    var STORAGE_INFORME = CFG.storage.cotizacionInforme;
    var EXPECTED_SCHEMA = CFG.informe.informeJsonSchemaVersion;

    function formatNumber(num) {
        return Fmt.formatNumber(num);
    }

    function setText(el, text) {
        el.textContent = text == null ? '' : String(text);
    }

    function clearNode(node) {
        while (node.firstChild) {
            node.removeChild(node.firstChild);
        }
    }

    function normalizarFormulaTexto(s) {
        return String(s == null ? '' : s).replace(/<br\s*\/?>/gi, '\n');
    }

    function renderNoData(container) {
        clearNode(container);
        var wrap = document.createElement('div');
        wrap.className = 'no-data';
        var h2 = document.createElement('h2');
        setText(h2, 'No hay datos de cotización');
        var p = document.createElement('p');
        setText(p, 'Por favor, genera un informe desde el cotizador.');
        var a = document.createElement('a');
        a.href = 'index.html';
        setText(a, 'Ir al Cotizador');
        wrap.appendChild(h2);
        wrap.appendChild(p);
        wrap.appendChild(a);
        container.appendChild(wrap);
    }

    function renderError(container, msg) {
        clearNode(container);
        var wrap = document.createElement('div');
        wrap.className = 'no-data';
        var h2 = document.createElement('h2');
        setText(h2, 'Error al cargar el informe');
        var p = document.createElement('p');
        setText(p, msg);
        var a = document.createElement('a');
        a.href = 'index.html';
        setText(a, 'Ir al Cotizador');
        wrap.appendChild(h2);
        wrap.appendChild(p);
        wrap.appendChild(a);
        container.appendChild(wrap);
    }

    function appendCalcSteps(column, titleText, pasos) {
        var h3 = document.createElement('h3');
        setText(h3, titleText);
        column.appendChild(h3);
        for (var i = 0; i < pasos.length; i++) {
            var paso = pasos[i];
            var step = document.createElement('div');
            step.className = 'calc-step' + (paso.highlight === true ? ' highlight' : '');
            var header = document.createElement('div');
            header.className = 'calc-step-header';
            var t = document.createElement('div');
            t.className = 'calc-step-title';
            setText(t, paso.titulo);
            var b = document.createElement('div');
            b.className = 'calc-step-badge';
            setText(b, paso.badge);
            header.appendChild(t);
            header.appendChild(b);
            step.appendChild(header);

            var formula = document.createElement('div');
            formula.className = 'calc-formula';
            setText(formula, normalizarFormulaTexto(paso.formula));
            step.appendChild(formula);

            var res = document.createElement('div');
            res.className = 'calc-result' + (paso.final === true ? ' calc-result--final' : '');
            var rl = document.createElement('span');
            rl.className = 'calc-result-label';
            setText(rl, paso.label);
            var rv = document.createElement('span');
            rv.className = 'calc-result-value';
            setText(rv, paso.resultado);
            res.appendChild(rl);
            res.appendChild(rv);
            step.appendChild(res);
            column.appendChild(step);

            if (i < pasos.length - 1) {
                var arr = document.createElement('div');
                arr.className = 'calc-arrow';
                setText(arr, '\u2193');
                column.appendChild(arr);
            }
        }
    }

    function renderInforme(container, informe) {
        clearNode(container);

        var header = document.createElement('div');
        header.className = 'header';
        var h1 = document.createElement('h1');
        setText(h1, 'COTIZACIÓN DE PIÑA');
        var sub = document.createElement('p');
        setText(sub, 'Sunrise · ARU · CBP');
        header.appendChild(h1);
        header.appendChild(sub);
        if (informe.estado) {
            var edo = document.createElement('p');
            edo.className = 'estado-informe';
            setText(edo, 'Estado: ' + informe.estado);
            header.appendChild(edo);
        }
        var fecha = document.createElement('div');
        fecha.className = 'fecha';
        setText(fecha, informe.fecha + ' - ' + informe.hora);
        header.appendChild(fecha);
        container.appendChild(header);

        var actions = document.createElement('div');
        actions.className = 'informe-actions';
        var btnPrint = document.createElement('button');
        btnPrint.className = 'btn-share btn-print';
        btnPrint.type = 'button';
        btnPrint.textContent = 'Imprimir PDF';
        btnPrint.addEventListener('click', function () {
            window.print();
        });
        var btnDl = document.createElement('button');
        btnDl.className = 'btn-share btn-download';
        btnDl.type = 'button';
        btnDl.textContent = 'Descargar HTML';
        btnDl.addEventListener('click', descargarHTML);
        var btnImg = document.createElement('button');
        btnImg.className = 'btn-share btn-image';
        btnImg.type = 'button';
        btnImg.textContent = 'Descargar Imagen';
        btnImg.addEventListener('click', descargarImagen);
        actions.appendChild(btnPrint);
        actions.appendChild(btnDl);
        actions.appendChild(btnImg);
        container.appendChild(actions);

        var content = document.createElement('div');
        content.className = 'content';

        var sec1 = document.createElement('div');
        sec1.className = 'section';
        var st1 = document.createElement('div');
        st1.className = 'section-title';
        setText(st1, 'Datos de Entrada');
        sec1.appendChild(st1);
        var dp = document.createElement('div');
        dp.className = 'datos-principales';
        var b1 = document.createElement('div');
        b1.className = 'dato-box';
        var l1 = document.createElement('div');
        l1.className = 'dato-label';
        setText(l1, 'Precio de Venta');
        var v1 = document.createElement('div');
        v1.className = 'dato-value';
        setText(v1, '$' + formatNumber(informe.precioVenta) + ' USD');
        b1.appendChild(l1);
        b1.appendChild(v1);
        var b2 = document.createElement('div');
        b2.className = 'dato-box';
        var l2 = document.createElement('div');
        l2.className = 'dato-label';
        setText(l2, 'Tipo de Cambio');
        var v2 = document.createElement('div');
        v2.className = 'dato-value';
        setText(v2, '$' + formatNumber(informe.tipoCambio) + ' MXN');
        b2.appendChild(l2);
        b2.appendChild(v2);
        dp.appendChild(b1);
        dp.appendChild(b2);
        sec1.appendChild(dp);
        content.appendChild(sec1);

        var sec2 = document.createElement('div');
        sec2.className = 'section';
        var st2 = document.createElement('div');
        st2.className = 'section-title';
        setText(st2, 'Precios por Kilogramo');
        sec2.appendChild(st2);
        var rg = document.createElement('div');
        rg.className = 'resultados-grid';
        var c1 = document.createElement('div');
        c1.className = 'resultado-card';
        var rl1 = document.createElement('div');
        rl1.className = 'resultado-label';
        setText(rl1, 'Flete Corto');
        var rv1 = document.createElement('div');
        rv1.className = 'resultado-value';
        setText(rv1, '$' + formatNumber(informe.precioKgCorto));
        var ru1 = document.createElement('div');
        ru1.className = 'resultado-unit';
        setText(ru1, 'MXN por kg');
        c1.appendChild(rl1);
        c1.appendChild(rv1);
        c1.appendChild(ru1);
        var c2 = document.createElement('div');
        c2.className = 'resultado-card';
        var rl2 = document.createElement('div');
        rl2.className = 'resultado-label';
        setText(rl2, 'Flete Largo');
        var rv2 = document.createElement('div');
        rv2.className = 'resultado-value';
        setText(rv2, '$' + formatNumber(informe.precioKgLargo));
        var ru2 = document.createElement('div');
        ru2.className = 'resultado-unit';
        setText(ru2, 'MXN por kg');
        c2.appendChild(rl2);
        c2.appendChild(rv2);
        c2.appendChild(ru2);
        rg.appendChild(c1);
        rg.appendChild(c2);
        sec2.appendChild(rg);
        content.appendChild(sec2);

        var sec3 = document.createElement('div');
        sec3.className = 'section';
        var st3 = document.createElement('div');
        st3.className = 'section-title';
        setText(st3, 'Flujo de Cálculos Detallado');
        sec3.appendChild(st3);
        var fg = document.createElement('div');
        fg.className = 'flujo-grid';
        var colC = document.createElement('div');
        colC.className = 'flujo-columna';
        appendCalcSteps(colC, 'FLETE CORTO', informe.calcCorto);
        var colL = document.createElement('div');
        colL.className = 'flujo-columna';
        appendCalcSteps(colL, 'FLETE LARGO', informe.calcLargo);
        fg.appendChild(colC);
        fg.appendChild(colL);
        sec3.appendChild(fg);
        content.appendChild(sec3);

        var sec4 = document.createElement('div');
        sec4.className = 'section';
        var st4 = document.createElement('div');
        st4.className = 'section-title';
        setText(st4, 'Parámetros Utilizados');
        sec4.appendChild(st4);
        var pg = document.createElement('div');
        pg.className = 'parametros-grid';
        for (var p = 0; p < informe.parametros.length; p++) {
            var pr = informe.parametros[p];
            var box = document.createElement('div');
            box.className = 'param-box';
            var nm = document.createElement('div');
            nm.className = 'param-nombre';
            setText(nm, pr.nombre);
            var vl = document.createElement('div');
            vl.className = 'param-valor';
            setText(vl, pr.valor);
            box.appendChild(nm);
            box.appendChild(vl);
            pg.appendChild(box);
        }
        sec4.appendChild(pg);
        content.appendChild(sec4);

        container.appendChild(content);

        var foot = document.createElement('div');
        foot.className = 'footer';
        var strong = document.createElement('strong');
        setText(strong, 'Cotizador de Piña');
        foot.appendChild(strong);
        foot.appendChild(document.createElement('br'));
        var ft = document.createTextNode('Documento generado automáticamente el ' + informe.fecha + ' a las ' + informe.hora);
        foot.appendChild(ft);
        container.appendChild(foot);
    }

    function cargarInforme() {
        var root = document.getElementById('informe-content');
        if (!root) return;

        var datos = null;
        try {
            if (window.location.hash && window.location.hash.length > 1) {
                datos = decodeURIComponent(window.location.hash.substring(1));
            }
        } catch (e) {
            renderError(root, 'No se pudo leer la URL del informe.');
            return;
        }

        if (!datos) {
            datos = localStorage.getItem(STORAGE_INFORME);
        }
        if (!datos) {
            datos = sessionStorage.getItem(STORAGE_INFORME);
        }

        if (!datos) {
            renderNoData(root);
            return;
        }

        var informe;
        try {
            informe = JSON.parse(datos);
        } catch (e) {
            renderError(root, 'El contenido del informe no es JSON válido.');
            return;
        }

        if (!Inv.validateInforme(informe, EXPECTED_SCHEMA)) {
            renderError(root, 'El informe no tiene el formato esperado. Vuelve a generarlo desde el cotizador.');
            return;
        }

        try {
            renderInforme(root, informe);
        } catch (e) {
            console.error('Error al pintar el informe:', e);
            renderError(root, 'Error al pintar el informe.');
        }
    }

    function descargarHTML() {
        var datos = localStorage.getItem(STORAGE_INFORME) || sessionStorage.getItem(STORAGE_INFORME);
        if (!datos && window.location.hash && window.location.hash.length > 1) {
            try {
                datos = decodeURIComponent(window.location.hash.substring(1));
            } catch (e1) {
                window.alert('No se pudo leer el fragmento de la URL del informe.');
                return;
            }
        }

        if (!datos) {
            window.alert('No hay datos para generar el informe');
            return;
        }

        var informe;
        try {
            informe = JSON.parse(datos);
        } catch (e2) {
            window.alert('Los datos del informe no son JSON válido.');
            return;
        }

        if (!Inv.validateInforme(informe, EXPECTED_SCHEMA)) {
            window.alert('El informe no tiene el formato esperado. Vuelve a generarlo desde el cotizador.');
            return;
        }

        var shell = document.createElement('div');
        try {
            renderInforme(shell, informe);
        } catch (e3) {
            console.error('descargarHTML render:', e3);
            window.alert('No se pudo reconstruir el informe para exportar.');
            return;
        }

        fetch('styles.css', { cache: 'force-cache' })
            .then(function (r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.text();
            })
            .then(function (cssContent) {
                var htmlCompleto = '<!DOCTYPE html>\n<html lang="es">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>Cotización de Piña - Informe</title>\n<style>' +
                    cssContent.replace(/<\/style/gi, '<\\/style') +
                    '</style>\n</head>\n<body class="informe">\n<div class="container">\n' +
                    shell.innerHTML +
                    '\n</div>\n</body>\n</html>';

                var blob = new Blob([htmlCompleto], { type: 'text/html;charset=utf-8' });
                var url = URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = url;
                a.download = 'Cotizacion-Pina-' + new Date().toISOString().split('T')[0] + '.html';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                window.alert('Informe descargado. Puedes compartirlo como archivo.');
            })
            .catch(function () {
                window.alert('No se pudo descargar el HTML (sin red o sin styles.css en caché).');
            });
    }

    function descargarImagen() {
        var botones = document.querySelector('.informe-actions');
        var container = document.querySelector('.container');
        if (!container || typeof html2canvas !== 'function') {
            window.alert('html2canvas no está disponible');
            return;
        }

        if (botones) botones.classList.add('informe-actions--hidden');

        html2canvas(container, {
            scale: 2,
            backgroundColor: '#ffffff',
            logging: false,
            windowWidth: 900,
            windowHeight: container.scrollHeight
        }).then(function (canvas) {
            if (botones) botones.classList.remove('informe-actions--hidden');
            canvas.toBlob(function (blob) {
                if (!blob) {
                    window.alert('No se pudo generar la imagen (blob vacío).');
                    return;
                }
                var url = URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = url;
                a.download = 'Cotizacion-Pina-' + new Date().toISOString().split('T')[0] + '.png';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                window.alert('Imagen descargada. Puedes compartirla como archivo.');
            });
        }).catch(function (err) {
            if (botones) botones.classList.remove('informe-actions--hidden');
            console.error('Error generando imagen:', err);
            window.alert('Error al generar la imagen');
        });
    }

    window.addEventListener('load', cargarInforme);
    window.descargarHTML = descargarHTML;
    window.descargarImagen = descargarImagen;
})();
