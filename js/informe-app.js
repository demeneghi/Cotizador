(function () {
    'use strict';

    var CFG = window.__APP_CONFIG__;
    if (!CFG) throw new Error('Falta window.__APP_CONFIG__');
    var Fmt = window.CotizadorFormat;
    if (!Fmt) throw new Error('Falta CotizadorFormat (cargar js/format-number.js antes)');
    var Inv = window.CotizadorInformeValidate;
    if (!Inv) throw new Error('Falta CotizadorInformeValidate (cargar js/informe-validate.js antes)');

    var STORAGE_INFORME = CFG.storage.cotizacionInforme;
    var EXPECTED_SCHEMA = CFG.informe.informeJsonSchemaVersion;
    var MAX_HASH_LEN = (CFG.informe && typeof CFG.informe.maxHashUrlChars === 'number') ? CFG.informe.maxHashUrlChars : 48000;
    var BRAND = CFG.brand || {};
    var H2C_SRC = (CFG.cdn && CFG.cdn.html2canvas && CFG.cdn.html2canvas.src) || './js/vendor/html2canvas.min.js';
    var H2C_INTEGRITY = (CFG.cdn && CFG.cdn.html2canvas && CFG.cdn.html2canvas.integrity) || null;
    var DOWNLOAD_CSP = "default-src 'none'; img-src 'self' data: blob:; style-src 'unsafe-inline'; font-src data:";

    function formatNumber(num) { return Fmt.formatNumber(num); }

    function setText(el, text) { el.textContent = text == null ? '' : String(text); }

    function clearNode(node) {
        while (node.firstChild) node.removeChild(node.firstChild);
    }

    function normalizarFormulaTexto(s) {
        return String(s == null ? '' : s).replace(/<br\s*\/?>/gi, '\n');
    }

    function escapeHTML(s) {
        if (s == null) return '';
        return String(s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function renderNoData(container) {
        clearNode(container);
        var wrap = document.createElement('div');
        wrap.className = 'no-data';
        var h2 = document.createElement('h2');
        setText(h2, 'No hay datos de cotizacion');
        var p = document.createElement('p');
        setText(p, 'Por favor, genera un informe desde el cotizador.');
        var a = document.createElement('a');
        a.href = 'index.html';
        setText(a, 'Ir al cotizador');
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
        setText(a, 'Ir al cotizador');
        wrap.appendChild(h2);
        wrap.appendChild(p);
        wrap.appendChild(a);
        container.appendChild(wrap);
    }

    function appendCalcSteps(column, pasos) {
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
        setText(h1, BRAND.tituloInforme || 'Cotizacion de pina');
        var sub = document.createElement('p');
        var pre = BRAND.subtituloPre || '';
        var mid = BRAND.subtituloMid || '';
        var post = BRAND.subtituloPost || '';
        if (pre) sub.appendChild(document.createTextNode(pre));
        if (mid) {
            var subStrong = document.createElement('strong');
            setText(subStrong, mid);
            sub.appendChild(subStrong);
        }
        if (post) sub.appendChild(document.createTextNode(post));
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
        btnPrint.addEventListener('click', function () { window.print(); });
        var btnDl = document.createElement('button');
        btnDl.className = 'btn-share btn-download';
        btnDl.type = 'button';
        btnDl.textContent = 'Descargar HTML';
        btnDl.addEventListener('click', descargarHTML);
        var btnImg = document.createElement('button');
        btnImg.className = 'btn-share btn-image';
        btnImg.type = 'button';
        btnImg.textContent = 'Descargar imagen';
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
        setText(st1, 'Datos de entrada');
        sec1.appendChild(st1);
        var dp = document.createElement('div');
        dp.className = 'datos-principales';
        var b1 = document.createElement('div');
        b1.className = 'dato-box';
        var l1 = document.createElement('div');
        l1.className = 'dato-label';
        setText(l1, 'Precio de venta');
        var v1 = document.createElement('div');
        v1.className = 'dato-value';
        setText(v1, '$' + formatNumber(informe.precioVenta) + ' USD');
        b1.appendChild(l1);
        b1.appendChild(v1);
        var b2 = document.createElement('div');
        b2.className = 'dato-box';
        var l2 = document.createElement('div');
        l2.className = 'dato-label';
        setText(l2, 'Tipo de cambio');
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
        setText(st2, 'Precios por kilogramo');
        sec2.appendChild(st2);
        var rg = document.createElement('div');
        rg.className = 'resultados-grid';
        var c1 = document.createElement('div');
        c1.className = 'resultado-card';
        var rl1 = document.createElement('div');
        rl1.className = 'resultado-label';
        setText(rl1, 'Flete corto');
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
        setText(rl2, 'Flete largo');
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
        setText(st3, 'Flujo de calculos detallado');
        sec3.appendChild(st3);

        var tabs = document.createElement('div');
        tabs.className = 'flujo-tabs';
        tabs.setAttribute('role', 'tablist');
        tabs.setAttribute('aria-label', 'Flujo de calculos');
        var tabCorto = document.createElement('button');
        tabCorto.type = 'button';
        tabCorto.className = 'flujo-tab is-active';
        tabCorto.id = 'flujo-tab-corto';
        tabCorto.setAttribute('role', 'tab');
        tabCorto.setAttribute('aria-controls', 'flujo-panel-corto');
        tabCorto.setAttribute('aria-selected', 'true');
        tabCorto.tabIndex = 0;
        setText(tabCorto, 'Flete corto');
        var tabLargo = document.createElement('button');
        tabLargo.type = 'button';
        tabLargo.className = 'flujo-tab';
        tabLargo.id = 'flujo-tab-largo';
        tabLargo.setAttribute('role', 'tab');
        tabLargo.setAttribute('aria-controls', 'flujo-panel-largo');
        tabLargo.setAttribute('aria-selected', 'false');
        tabLargo.tabIndex = -1;
        setText(tabLargo, 'Flete largo');
        tabs.appendChild(tabCorto);
        tabs.appendChild(tabLargo);
        sec3.appendChild(tabs);

        var fg = document.createElement('div');
        fg.className = 'flujo-grid';
        var colC = document.createElement('div');
        colC.className = 'flujo-columna';
        colC.id = 'flujo-panel-corto';
        colC.setAttribute('role', 'tabpanel');
        colC.setAttribute('aria-labelledby', 'flujo-tab-corto');
        colC.setAttribute('data-flujo', 'Flete corto');
        appendCalcSteps(colC, informe.calcCorto);
        var colL = document.createElement('div');
        colL.className = 'flujo-columna flujo-columna--inactive';
        colL.id = 'flujo-panel-largo';
        colL.setAttribute('role', 'tabpanel');
        colL.setAttribute('aria-labelledby', 'flujo-tab-largo');
        colL.setAttribute('data-flujo', 'Flete largo');
        colL.hidden = true;
        appendCalcSteps(colL, informe.calcLargo);
        fg.appendChild(colC);
        fg.appendChild(colL);
        sec3.appendChild(fg);
        content.appendChild(sec3);

        function activarTab(activeBtn, inactiveBtn, activePanel, inactivePanel, focus) {
            activeBtn.classList.add('is-active');
            activeBtn.setAttribute('aria-selected', 'true');
            activeBtn.tabIndex = 0;
            inactiveBtn.classList.remove('is-active');
            inactiveBtn.setAttribute('aria-selected', 'false');
            inactiveBtn.tabIndex = -1;
            activePanel.classList.remove('flujo-columna--inactive');
            activePanel.hidden = false;
            inactivePanel.classList.add('flujo-columna--inactive');
            inactivePanel.hidden = true;
            if (focus) activeBtn.focus();
        }

        tabCorto.addEventListener('click', function () {
            activarTab(tabCorto, tabLargo, colC, colL, false);
        });
        tabLargo.addEventListener('click', function () {
            activarTab(tabLargo, tabCorto, colL, colC, false);
        });
        function onTabKeydown(e) {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return;
            e.preventDefault();
            var goCorto = e.key === 'ArrowLeft' || e.key === 'Home';
            if (goCorto) activarTab(tabCorto, tabLargo, colC, colL, true);
            else activarTab(tabLargo, tabCorto, colL, colC, true);
        }
        tabCorto.addEventListener('keydown', onTabKeydown);
        tabLargo.addEventListener('keydown', onTabKeydown);

        var sec4 = document.createElement('div');
        sec4.className = 'section';
        var st4 = document.createElement('div');
        st4.className = 'section-title';
        setText(st4, 'Parametros utilizados');
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
        setText(strong, BRAND.tituloInforme || 'Cotizacion de pina');
        foot.appendChild(strong);
        foot.appendChild(document.createElement('br'));
        var ft = document.createTextNode('Documento generado automaticamente el ' + informe.fecha + ' a las ' + informe.hora);
        foot.appendChild(ft);
        container.appendChild(foot);
    }

    function leerDatosFuente() {
        var datos = null;
        try {
            if (window.location.hash && window.location.hash.length > 1) {
                if (window.location.hash.length > MAX_HASH_LEN) {
                    return { error: 'El enlace del informe es demasiado grande para procesarse.' };
                }
                datos = decodeURIComponent(window.location.hash.substring(1));
            }
        } catch (e) {
            return { error: 'No se pudo leer la URL del informe.' };
        }
        if (!datos) {
            try { datos = localStorage.getItem(STORAGE_INFORME); } catch (e) { /* ignore */ }
        }
        if (!datos) {
            try { datos = sessionStorage.getItem(STORAGE_INFORME); } catch (e) { /* ignore */ }
        }
        if (!datos) return { empty: true };
        if (datos.length > MAX_HASH_LEN) {
            return { error: 'El informe es demasiado grande.' };
        }
        var informe;
        try { informe = JSON.parse(datos); }
        catch (e) { return { error: 'El contenido del informe no es JSON valido.' }; }
        if (!Inv.validateInforme(informe, EXPECTED_SCHEMA)) {
            return { error: 'El informe no tiene el formato esperado. Vuelve a generarlo desde el cotizador.' };
        }
        return { informe: informe };
    }

    function cargarInforme() {
        var root = document.getElementById('informe-content');
        if (!root) return;
        var res = leerDatosFuente();
        if (res.empty) { renderNoData(root); return; }
        if (res.error) { renderError(root, res.error); return; }
        try {
            renderInforme(root, res.informe);
        } catch (e) {
            console.error('Error al pintar el informe:', e);
            renderError(root, 'Error al pintar el informe.');
        }
    }

    function descargarHTML() {
        var res = leerDatosFuente();
        if (res.empty || res.error) {
            window.alert(res.error || 'No hay datos para generar el informe');
            return;
        }
        var shell = document.createElement('div');
        try {
            renderInforme(shell, res.informe);
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
                var safeCSS = cssContent.replace(/<\/style/gi, '<\\/style');
                var safeBody = shell.innerHTML.replace(/<\/body/gi, '<\\/body').replace(/<script/gi, '<\\script');
                var htmlCompleto = '<!DOCTYPE html>\n<html lang="es">\n<head>\n' +
                    '<meta charset="UTF-8">\n' +
                    '<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5">\n' +
                    '<meta http-equiv="Content-Security-Policy" content="' + escapeHTML(DOWNLOAD_CSP) + '">\n' +
                    '<meta name="referrer" content="no-referrer">\n' +
                    '<title>Cotizacion - Informe</title>\n' +
                    '<style>' + safeCSS + '</style>\n' +
                    '</head>\n<body class="informe informe-export">\n<div class="container">\n' +
                    safeBody +
                    '\n</div>\n</body>\n</html>';

                var blob = new Blob([htmlCompleto], { type: 'text/html;charset=utf-8' });
                var url = URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = url;
                a.download = 'Cotizacion-' + new Date().toISOString().split('T')[0] + '.html';
                a.rel = 'noopener noreferrer';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                window.alert('Informe descargado. Puedes compartirlo como archivo.');
            })
            .catch(function () {
                window.alert('No se pudo descargar el HTML (sin red o sin styles.css en cache).');
            });
    }

    var html2canvasPromise = null;
    function ensureHtml2canvas() {
        if (typeof window.html2canvas === 'function') return Promise.resolve(window.html2canvas);
        if (html2canvasPromise) return html2canvasPromise;
        html2canvasPromise = new Promise(function (resolve, reject) {
            var s = document.createElement('script');
            s.src = H2C_SRC;
            if (H2C_INTEGRITY) {
                s.integrity = H2C_INTEGRITY;
                s.crossOrigin = 'anonymous';
            }
            s.async = true;
            s.onload = function () {
                if (typeof window.html2canvas === 'function') resolve(window.html2canvas);
                else reject(new Error('html2canvas cargado pero no disponible'));
            };
            s.onerror = function () { reject(new Error('No se pudo cargar html2canvas')); };
            document.head.appendChild(s);
        });
        return html2canvasPromise;
    }

    function descargarImagen() {
        var botones = document.querySelector('.informe-actions');
        var container = document.querySelector('.container');
        if (!container) {
            window.alert('No hay contenido para exportar.');
            return;
        }
        ensureHtml2canvas().then(function (h2c) {
            if (botones) botones.classList.add('informe-actions--hidden');
            document.body.classList.add('informe-export');
            var devMem = (typeof navigator !== 'undefined' && typeof navigator.deviceMemory === 'number') ? navigator.deviceMemory : 4;
            var scale = devMem < 4 ? 1 : 2;
            var width = container.offsetWidth || 900;
            return h2c(container, {
                scale: scale,
                backgroundColor: '#ffffff',
                logging: false,
                windowWidth: width,
                windowHeight: container.scrollHeight
            });
        }).then(function (canvas) {
            if (botones) botones.classList.remove('informe-actions--hidden');
            document.body.classList.remove('informe-export');
            canvas.toBlob(function (blob) {
                if (!blob) {
                    window.alert('No se pudo generar la imagen (blob vacio).');
                    return;
                }
                var url = URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = url;
                a.download = 'Cotizacion-' + new Date().toISOString().split('T')[0] + '.png';
                a.rel = 'noopener noreferrer';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                window.alert('Imagen descargada. Puedes compartirla como archivo.');
            });
        }).catch(function (err) {
            if (botones) botones.classList.remove('informe-actions--hidden');
            document.body.classList.remove('informe-export');
            console.error('Error generando imagen:', err);
            window.alert('Error al generar la imagen: ' + (err && err.message ? err.message : 'desconocido'));
        });
    }

    window.addEventListener('load', cargarInforme);
})();
