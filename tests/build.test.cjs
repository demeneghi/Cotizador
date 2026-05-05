'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');

test('build script genera app-config.js identico a config/app.json', () => {
    execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'build.cjs')], { cwd: ROOT, stdio: 'pipe' });
    const appJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'app.json'), 'utf8'));
    const jsTxt = fs.readFileSync(path.join(ROOT, 'js', 'app-config.js'), 'utf8');
    const m = jsTxt.match(/window\.__APP_CONFIG__\s*=\s*(\{[\s\S]*\})\s*;/);
    assert.ok(m, 'No se encontro asignacion window.__APP_CONFIG__ = {...};');
    const cfgJs = JSON.parse(m[1]);
    assert.deepStrictEqual(cfgJs, appJson);
});

test('build:check pasa tras ejecutar build', () => {
    execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'build.cjs')], { cwd: ROOT, stdio: 'pipe' });
    execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'build.cjs'), '--check'], { cwd: ROOT, stdio: 'pipe' });
});

test('SHA256SUMS cubre archivos criticos', () => {
    const sha = fs.readFileSync(path.join(ROOT, 'SHA256SUMS'), 'utf8');
    const required = [
        'index.html',
        'informe.html',
        'manifest.json',
        'styles.css',
        'sw.js',
        'config/app.json',
        'js/app-config.js',
        'js/numeric.js',
        'js/calc-core.js',
        'js/cotizador-main.js',
        'js/sw-register.js',
        'js/informe-app.js',
        'js/storage.js',
        'js/inputs-format.js'
    ];
    for (const f of required) {
        assert.ok(sha.indexOf('  ' + f) !== -1, 'SHA256SUMS debe incluir ' + f);
    }
});
