// kits/page-storage.js: the code the courier runs ON a visited page so This
// browser's Page tab can list what that page stores. Exercised the way the
// bookmark runs it: script() through `new Function('ctx', …)`, with the request
// in ctx.errand, over fake-indexeddb and a localStorage stand-in. Running the
// text rather than calling read() also proves read() is self-contained, which
// it must be to run in another realm.

import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadKit } from './bootstrap.mjs';

const { PageStorage } = loadKit('page-storage');

class Store {
  constructor() { this.m = new Map(); }
  get length() { return this.m.size; }
  key(i) { return [...this.m.keys()][i] ?? null; }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.m.set(k, String(v)); }
}
globalThis.localStorage = new Store();
globalThis.location = { host: 'shop.example' };
localStorage.setItem('cart', JSON.stringify({ n: 2 }));
localStorage.setItem('theme', 'dark');

const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const seed = await new Promise((res, rej) => {
  const r = indexedDB.open('shop', 1);
  r.onupgradeneeded = () => { r.result.createObjectStore('items', { keyPath: 'id' }); r.result.createObjectStore('log'); };
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
});
{
  const tx = seed.transaction(['items', 'log'], 'readwrite');
  tx.objectStore('items').put({ id: 1, name: 'a', when: new Date('2026-01-02T00:00:00Z'), bytes: new Uint8Array([1, 2, 3]) });
  tx.objectStore('items').put({ id: 2, name: 'b', tags: new Set(['x']) });
  tx.objectStore('log').put('first line', 'k1');
  await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
  seed.close();
}

// The page's run, exactly as bookmarklets/courier-stage.js does it.
const run = (request) => new Function('ctx', PageStorage.script())({ errand: request }).then(JSON.parse);
const names = async () => (await indexedDB.databases()).map(d => d.name).sort();

test('the script is a function body the bookmark can run', () => {
  assert.match(PageStorage.script(), /^return \(async function\(ctx\)/);
});

test('the inventory lists localStorage keys with sizes and every database with its stores', async () => {
  const inv = await run({ read: 'inventory' });
  assert.equal(inv.host, 'shop.example');
  assert.deepEqual(inv.ls, [{ key: 'cart', bytes: ('cart' + '{"n":2}').length * 2 }, { key: 'theme', bytes: ('theme' + 'dark').length * 2 }]);
  assert.equal(inv.dbState, 'ok');
  assert.deepEqual(inv.dbs, [{ name: 'shop', records: 3, error: '', stores: [
    { name: 'items', count: 2, keyPath: 'id' }, { name: 'log', count: 1, keyPath: '(key)' }] }]);
});

test('one localStorage value comes back as stored', async () => {
  assert.deepEqual(await run({ read: 'ls', key: 'cart' }), { value: '{"n":2}' });
  assert.deepEqual(await run({ read: 'ls', key: 'absent' }), { value: null });
});

test('a store comes back as entries, with what JSON cannot hold as labelled stand-ins', async () => {
  const got = await run({ read: 'store', db: 'shop', store: 'items' });
  assert.equal(got.total, 2);
  assert.equal(got.keyPath, 'id');
  assert.deepEqual(got.entries[0], { key: 1, value: { id: 1, name: 'a', when: '2026-01-02T00:00:00.000Z',
    bytes: { '[binary]': 'Uint8Array', bytes: 3 } } });
  assert.deepEqual(got.entries[1].value.tags, ['x']);
  const log = await run({ read: 'store', db: 'shop', store: 'log' });
  assert.equal(log.keyPath, null);
  assert.deepEqual(log.entries, [{ key: 'k1', value: 'first line' }]);
});

test('a limit caps the records and the total still counts them all', async () => {
  const got = await run({ read: 'store', db: 'shop', store: 'items', limit: 1 });
  assert.equal(got.entries.length, 1);
  assert.equal(got.total, 2);
});

test('it writes nothing: reading lists no new database, and a missing one is refused, not created', async () => {
  const before = await names();
  await run({ read: 'inventory' });
  await assert.rejects(run({ read: 'store', db: 'nowhere', store: 'x' }));
  assert.deepEqual(await names(), before);
  assert.deepEqual(before, ['shop']);
  const db = await new Promise((res, rej) => { const r = indexedDB.open('shop'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  assert.equal(await req(db.transaction('items').objectStore('items').count()), 2);
  db.close();
});
