'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

function makeFakeStorage() {
    var store = {};
    return {
        _store: store,
        getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
        setItem: function (k, v) {
            if (typeof v !== 'string') throw new Error('value must be string');
            store[k] = v;
        },
        removeItem: function (k) { delete store[k]; }
    };
}

test('createDebouncedStore: debounce + flush + lectura', () => {
    var listeners = {};
    global.addEventListener = function (type, cb) { listeners[type] = cb; };
    delete require.cache[require.resolve(path.join(__dirname, '..', 'js', 'storage.js'))];
    var Mod = require(path.join(__dirname, '..', 'js', 'storage.js'));
    var fake = makeFakeStorage();

    var s = Mod.createDebouncedStore({
        key: 'k1',
        storage: fake,
        debounceMs: 10,
        maxBytes: 1024,
        onError: function () {}
    });

    s.set({ a: 1 });
    assert.strictEqual(fake.getItem('k1'), null);
    s.flush();
    assert.deepStrictEqual(JSON.parse(fake.getItem('k1')), { a: 1 });
    assert.deepStrictEqual(s.get(), { a: 1 });
    s.clear();
    assert.strictEqual(fake.getItem('k1'), null);
});

test('createDebouncedStore: rechaza payloads demasiado grandes', () => {
    var Mod = require(path.join(__dirname, '..', 'js', 'storage.js'));
    var fake = makeFakeStorage();
    var errors = [];
    var s = Mod.createDebouncedStore({
        key: 'k2',
        storage: fake,
        debounceMs: 0,
        maxBytes: 50,
        onError: function (e) { errors.push(e); }
    });
    s.set({ payload: 'x'.repeat(1024) });
    s.flush();
    assert.strictEqual(fake.getItem('k2'), null);
    assert.ok(errors.some(function (e) { return e.type === 'too_large'; }));
});

test('createDebouncedStore: maneja QuotaExceededError', () => {
    var Mod = require(path.join(__dirname, '..', 'js', 'storage.js'));
    var fakeQuota = makeFakeStorage();
    fakeQuota.setItem = function () {
        var e = new Error('quota');
        e.name = 'QuotaExceededError';
        throw e;
    };
    var errs = [];
    var s = Mod.createDebouncedStore({
        key: 'k3',
        storage: fakeQuota,
        debounceMs: 0,
        maxBytes: 1024,
        onError: function (e) { errs.push(e); }
    });
    s.set({ a: 1 });
    s.flush();
    assert.ok(errs.some(function (e) { return e.type === 'quota'; }));
});

test('createDebouncedStore: segundo flush tras error de escritura puede persistir', () => {
    delete require.cache[require.resolve(path.join(__dirname, '..', 'js', 'storage.js'))];
    var Mod = require(path.join(__dirname, '..', 'js', 'storage.js'));
    var fake = makeFakeStorage();
    var throwQuota = true;
    var baseSet = fake.setItem.bind(fake);
    fake.setItem = function (k, v) {
        if (throwQuota) {
            var e = new Error('quota');
            e.name = 'QuotaExceededError';
            throw e;
        }
        baseSet(k, v);
    };
    var s = Mod.createDebouncedStore({
        key: 'k3b',
        storage: fake,
        debounceMs: 0,
        maxBytes: 1024,
        onError: function () {}
    });
    s.set({ a: 1 });
    s.flush();
    assert.strictEqual(fake.getItem('k3b'), null);
    throwQuota = false;
    s.flush();
    assert.deepStrictEqual(JSON.parse(fake.getItem('k3b')), { a: 1 });
});

test('safeJSONParse devuelve null en JSON invalido', () => {
    var Mod = require(path.join(__dirname, '..', 'js', 'storage.js'));
    assert.strictEqual(Mod.safeJSONParse(''), null);
    assert.strictEqual(Mod.safeJSONParse('not json'), null);
    assert.deepStrictEqual(Mod.safeJSONParse('{"a":1}'), { a: 1 });
});
