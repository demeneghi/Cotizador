/* ESLint flat config (v9+). */
'use strict';

const baseRules = {
    'no-undef': 'error',
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-debugger': 'error',
    'no-console': 'off',
    eqeqeq: ['error', 'smart'],
    curly: ['error', 'multi-line'],
    'no-throw-literal': 'error',
    'no-unsafe-finally': 'error',
    'no-prototype-builtins': 'off',
    'no-empty': ['error', { allowEmptyCatch: true }]
};

// Los .js bajo /js cargan en navegador pero exportan tambien por CommonJS
// cuando son requeridos desde Node (tests). 'module' aparece dentro de un
// `typeof module !== 'undefined'`, asi que se declara como global readonly.
const browserGlobals = {
    window: 'readonly',
    document: 'readonly',
    navigator: 'readonly',
    localStorage: 'readonly',
    sessionStorage: 'readonly',
    fetch: 'readonly',
    URL: 'readonly',
    Blob: 'readonly',
    FileReader: 'readonly',
    Event: 'readonly',
    Promise: 'readonly',
    setTimeout: 'readonly',
    clearTimeout: 'readonly',
    TextEncoder: 'readonly',
    Alpine: 'readonly',
    html2canvas: 'readonly',
    console: 'readonly',
    module: 'readonly',
    require: 'readonly',
    globalThis: 'readonly'
};

const nodeGlobals = {
    require: 'readonly',
    module: 'readonly',
    process: 'readonly',
    __dirname: 'readonly',
    __filename: 'readonly',
    Buffer: 'readonly',
    console: 'readonly',
    setTimeout: 'readonly',
    clearTimeout: 'readonly',
    globalThis: 'readonly',
    global: 'readonly'
};

const swGlobals = {
    self: 'readonly',
    caches: 'readonly',
    fetch: 'readonly',
    URL: 'readonly',
    Response: 'readonly',
    Promise: 'readonly',
    console: 'readonly'
};

module.exports = [
    {
        ignores: ['js/vendor/**', 'node_modules/**', 'styles/**', 'styles.css', '*.css', '*.html', '*.json', '*.md', '*.min.js']
    },
    {
        files: ['js/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'script',
            globals: Object.assign({}, browserGlobals, { globalThis: 'readonly' })
        },
        rules: baseRules
    },
    {
        files: ['sw.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'script',
            globals: swGlobals
        },
        rules: baseRules
    },
    {
        files: ['scripts/**/*.cjs', 'tests/**/*.cjs'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: Object.assign({}, nodeGlobals)
        },
        rules: baseRules
    }
];
