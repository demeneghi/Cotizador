#!/usr/bin/env node
/**
 * Build determinista para la PWA estatica.
 *
 * Pasos:
 *   1. Lee `config/app.json` y regenera `js/app-config.js` (espejo).
 *   2. Calcula un hash agregado de los assets criticos y reemplaza el
 *      `CACHE_NAME` en `sw.js`. Esto elimina el riesgo de despliegues con
 *      JS/JSON cacheado contra HTML/CSS nuevos.
 *   3. Regenera `SHA256SUMS` cubriendo todos los archivos servidos
 *      (HTML, JS, CSS, JSON, vendoreados, iconos).
 *
 * Uso:
 *   node scripts/build.cjs           Aplica los cambios.
 *   node scripts/build.cjs --check   Solo verifica que ya esten aplicados.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const CHECK_MODE = process.argv.includes('--check');

const APP_JSON_PATH = path.join(ROOT, 'config', 'app.json');
const APP_CONFIG_JS_PATH = path.join(ROOT, 'js', 'app-config.js');
const SW_PATH = path.join(ROOT, 'sw.js');
const SHA_PATH = path.join(ROOT, 'SHA256SUMS');
const STYLES_PATH = path.join(ROOT, 'styles.css');
const INDEX_HTML_PATH = path.join(ROOT, 'index.html');
const STYLE_PARTIALS = [
    'styles/tokens-and-base.css',
    'styles/responsive.css',
    'styles/informe.css',
    'styles/avanzado.css'
];

const SHA_FILES = [
    'icon-180.png',
    'icon-192.png',
    'icon-512.png',
    'index.html',
    'informe.html',
    'manifest.json',
    'styles.css',
    'sw.js',
    'config/app.json',
    'js/app-config.js',
    'js/disable-mobile-zoom.js',
    'js/numeric.js',
    'js/calc-core.js',
    'js/format-number.js',
    'js/informe-validate.js',
    'js/storage.js',
    'js/inputs-format.js',
    'js/cotizador-main.js',
    'js/sw-register.js',
    'js/informe-app.js',
    'js/theme-meta.js',
    'js/vendor/alpine.min.js',
    'js/vendor/html2canvas.min.js'
];

function read(file) { return fs.readFileSync(file, 'utf8'); }
function write(file, content) { fs.writeFileSync(file, content, 'utf8'); }

function generateStyles() {
    var parts = [];
    parts.push('/* AUTO-GENERADO por scripts/build.cjs concatenando styles/*.css. */\n');
    for (var i = 0; i < STYLE_PARTIALS.length; i++) {
        var rel = STYLE_PARTIALS[i];
        var abs = path.join(ROOT, rel);
        if (!fs.existsSync(abs)) {
            throw new Error('Falta partial de estilos: ' + rel);
        }
        parts.push('/* ===== ' + rel + ' ===== */\n');
        var content = fs.readFileSync(abs, 'utf8');
        if (!content.endsWith('\n')) content += '\n';
        parts.push(content);
    }
    return parts.join('');
}

function generateAppConfigJs(appJsonText) {
    const parsed = JSON.parse(appJsonText);
    const pretty = JSON.stringify(parsed, null, 4);
    const lines = pretty.split('\n').map((l, i) => i === 0 ? l : '    ' + l).join('\n');
    return '/* AUTO-GENERADO por scripts/build.cjs desde config/app.json. NO editar a mano. */\n' +
        'window.__APP_CONFIG__ = ' + lines + ';\n';
}

function sha256File(absPath) {
    const data = fs.readFileSync(absPath);
    return crypto.createHash('sha256').update(data).digest('hex');
}

function sri384(absPath) {
    const data = fs.readFileSync(absPath);
    return 'sha384-' + crypto.createHash('sha384').update(data).digest('base64');
}

function withVendorSRI(parsed) {
    const out = JSON.parse(JSON.stringify(parsed));
    if (out.cdn && out.cdn.alpine) {
        out.cdn.alpine.integrity = sri384(path.join(ROOT, 'js/vendor/alpine.min.js'));
    }
    if (out.cdn && out.cdn.html2canvas) {
        out.cdn.html2canvas.integrity = sri384(path.join(ROOT, 'js/vendor/html2canvas.min.js'));
    }
    return out;
}

function applyAlpineSRIToIndex(indexText, integrity) {
    const re = /(<script\s+defer\s+src="js\/vendor\/alpine\.min\.js")([^>]*)(><\/script>)/;
    const m = indexText.match(re);
    if (!m) {
        throw new Error('No se encontro <script src="js/vendor/alpine.min.js"> en index.html');
    }
    const replacement = '$1 integrity="' + integrity + '" crossorigin="anonymous"$3';
    return indexText.replace(re, replacement);
}

function aggregateHashFromMap(map) {
    const h = crypto.createHash('sha256');
    const keys = Object.keys(map).sort();
    for (const rel of keys) {
        const buf = map[rel];
        h.update(rel + '\n');
        h.update(buf);
        h.update('\n');
    }
    return h.digest('hex').slice(0, 12);
}

function updateSwCacheName(swText, version) {
    const re = /(const\s+CACHE_NAME\s*=\s*['"])([^'"]+)(['"])/;
    if (!re.test(swText)) {
        throw new Error('No se encontro CACHE_NAME en sw.js');
    }
    return swText.replace(re, '$1cotizador-pina-' + version + '$3');
}

function generateShaSums() {
    const lines = [];
    for (const rel of SHA_FILES) {
        const abs = path.join(ROOT, rel);
        if (!fs.existsSync(abs)) {
            throw new Error('Falta archivo para SHA256SUMS: ' + rel);
        }
        lines.push(sha256File(abs) + '  ' + rel);
    }
    return lines.join('\n') + '\n';
}

function main() {
    const appJsonRaw = read(APP_JSON_PATH);
    const appJsonParsed = JSON.parse(appJsonRaw);
    const appJsonWithSRI = withVendorSRI(appJsonParsed);
    const appJsonText = JSON.stringify(appJsonWithSRI, null, 2) + '\n';
    const desiredAppConfigJs = generateAppConfigJs(appJsonText);
    const desiredStyles = generateStyles();
    const alpineIntegrity = appJsonWithSRI.cdn.alpine.integrity;
    const indexCurrent = read(INDEX_HTML_PATH);
    const indexDesired = applyAlpineSRIToIndex(indexCurrent, alpineIntegrity);

    const aggregate = {
        'config/app.json': Buffer.from(appJsonText, 'utf8'),
        'js/app-config.js': Buffer.from(desiredAppConfigJs, 'utf8'),
        'styles.css': Buffer.from(desiredStyles, 'utf8'),
        'index.html': Buffer.from(indexDesired, 'utf8')
    };
    const otherForHash = [
        'js/disable-mobile-zoom.js',
        'js/numeric.js',
        'js/calc-core.js',
        'js/format-number.js',
        'js/informe-validate.js',
        'js/storage.js',
        'js/inputs-format.js',
        'js/cotizador-main.js',
        'js/informe-app.js',
        'js/sw-register.js',
        'js/theme-meta.js',
        'js/vendor/alpine.min.js',
        'js/vendor/html2canvas.min.js',
        'informe.html',
        'manifest.json'
    ];
    for (const rel of otherForHash) {
        const abs = path.join(ROOT, rel);
        if (fs.existsSync(abs)) aggregate[rel] = fs.readFileSync(abs);
    }
    const cacheVersion = aggregateHashFromMap(aggregate);

    const swCurrent = read(SW_PATH);
    const swDesired = updateSwCacheName(swCurrent, cacheVersion);

    if (CHECK_MODE) {
        if (appJsonRaw !== appJsonText) {
            console.error('config/app.json desactualizado (integrity SRI no coincide con vendor/)');
            process.exit(1);
        }
        if (indexCurrent !== indexDesired) {
            console.error('index.html desactualizado (integrity de Alpine no coincide)');
            process.exit(1);
        }
        const ok = read(APP_CONFIG_JS_PATH) === desiredAppConfigJs;
        if (!ok) { console.error('app-config.js desactualizado'); process.exit(1); }
        if (read(STYLES_PATH) !== desiredStyles) {
            console.error('styles.css desactualizado respecto a styles/*.css');
            process.exit(1);
        }
        if (swCurrent !== swDesired) {
            console.error('CACHE_NAME desactualizado en sw.js (esperado cotizador-pina-' + cacheVersion + ')');
            process.exit(1);
        }
        const desiredSha = generateShaSums();
        const currentSha = fs.existsSync(SHA_PATH) ? read(SHA_PATH) : '';
        if (desiredSha !== currentSha) {
            console.error('SHA256SUMS desactualizado');
            process.exit(1);
        }
        console.log('Build OK (verificacion).');
        return;
    }

    write(APP_JSON_PATH, appJsonText);
    write(APP_CONFIG_JS_PATH, desiredAppConfigJs);
    write(INDEX_HTML_PATH, indexDesired);
    write(STYLES_PATH, desiredStyles);
    write(SW_PATH, swDesired);
    write(SHA_PATH, generateShaSums());
    console.log('Build aplicado. CACHE_NAME=cotizador-pina-' + cacheVersion);
}

try { main(); }
catch (e) { console.error(e && e.message ? e.message : e); process.exit(1); }
