'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');

test('js/app-config.js es JSON equivalente a config/app.json', () => {
    const jsonPath = path.join(__dirname, '..', 'config', 'app.json');
    const jsPath = path.join(__dirname, '..', 'js', 'app-config.js');
    const cfgJson = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const jsTxt = fs.readFileSync(jsPath, 'utf8');
    const m = jsTxt.match(/window\.__APP_CONFIG__\s*=\s*(\{[\s\S]*\})\s*;/);
    assert.ok(m, 'No se encontró asignación window.__APP_CONFIG__ = {...};');
    const cfgJs = JSON.parse(m[1]);
    assert.deepStrictEqual(cfgJs, cfgJson);
});
