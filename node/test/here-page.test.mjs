// alpineComponents/here-view.js: This browser's Page tab, which lists what the
// page a courier bookmark opened this window from keeps in its own storage.
// The courier link (window.__courier, stage.js courierLink) is stood in for by
// running the code it is handed against this window's own storage, exactly as
// the bookmark would run it on the page: so the list below is filled by the
// real kits/page-storage.js, and only the postMessage hop is skipped.

import { indexedDB as fakeIDB } from 'fake-indexeddb';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, startAlpine, tick, repoRoot } from './bootstrap.mjs';

const { window, problems } = makeWindow({
  html: `<!doctype html><html><body><div id="h" x-data="hereView()"></div></body></html>`,
  url: 'https://shop.example/catalog',
});
window.indexedDB = fakeIDB;
window.CSS = { escape: (v) => String(v).replace(/["\\]/g, '\\$&') };   // jsdom has no CSS namespace
window.fetch = async () => ({ ok: false, status: 503, headers: { get: () => null }, json: async () => ({}) });
window.localStorage.setItem('cart', JSON.stringify({ n: 2 }));
window.localStorage.setItem('theme', 'dark');
await new Promise((res, rej) => {
  const r = fakeIDB.open('shop', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('items', { keyPath: 'id' }).put({ id: 7, name: 'lamp' });
  r.onsuccess = () => { r.result.close(); res(); };
  r.onerror = () => rej(r.error);
});

const asked = [];
window.__shell = { hereTab: 'page', hereItem: '', hereNext: '', authFail: null, courierHost: 'shop.example', syncUrl() {} };
window.__courier = {
  host: 'shop.example',
  ask: async (code, request) => { asked.push(request); return new window.Function('ctx', code)({ errand: request }); },
};
window.gh = {
  async load(p) {
    if (p === 'kits/page-storage.js') new window.Function(readFileSync(path.join(repoRoot, 'lib', p), 'utf8'))();
  },
};

const Alpine = await startAlpine(window, ['lib/alpineComponents/here-view.js']);
const data = Alpine.$data(window.document.getElementById('h'));
const settle = async () => { for (let i = 0; i < 20; i++) await tick(); };
// Objects made in the window realm carry its prototypes, which strict equality
// compares; the assertions are about values.
const plain = (v) => JSON.parse(JSON.stringify(v));
await settle();

test('opened on the Page tab, the list is the page\'s storage, read through the courier', () => {
  assert.equal(data.source, 'page');
  assert.equal(data.srcHost, 'shop.example');
  assert.deepEqual(plain(asked[0]), { read: 'inventory' });
  assert.deepEqual(plain(data.lsRows.map(r => r.key)), ['cart', 'theme']);
  assert.ok(data.lsRows.every(r => r.owner === null), 'web-tools owner labels are not claimed for another site\'s keys');
  assert.deepEqual(plain(data.dbs.map(d => [d.name, d.stores.map(s => s.name + ':' + s.count)])), [['shop', ['items:1']]]);
  assert.deepEqual(plain(data.items.map(it => it.id)), ['ls:cart', 'ls:theme', 'idb:shop/items']);
  assert.match(data.storageLine, /^shop\.example/);
});

test('a card asks the page for its value or its records', async () => {
  const cart = await data.itemContent(data.items[0]);
  assert.deepEqual(plain(cart), { name: 'cart.json', content: JSON.stringify({ n: 2 }, null, 2) });
  const items = await data.itemContent(data.items[2]);
  assert.equal(items.name, 'shop.items.json');
  assert.deepEqual(JSON.parse(items.content), [{ id: 7, name: 'lamp' }]);
  assert.deepEqual(plain(asked.slice(1)), [{ read: 'ls', key: 'cart' }, { read: 'store', db: 'shop', store: 'items' }]);
});

test('with no page on the line the tab says how to get one, and lists nothing', async () => {
  const link = window.__courier;
  delete window.__courier;
  await data.loadPage();
  assert.equal(data.items.length, 0);
  assert.match(data.pageErr, /courier bookmark/);
  window.__courier = link;
});

test('mounts with no warnings or errors', () => {
  assert.deepEqual(problems, []);
});
