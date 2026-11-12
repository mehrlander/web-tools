// kits/persistence.js — idb-keyval-backed key/value persistence, exercised
// over fake-indexeddb (in-memory, fresh per test process). The vendored
// idb-keyval rides in via the bootstrap's KIT_IMPORTS rewrite.

import 'fake-indexeddb/auto';
import { IDBDatabase, IDBObjectStore } from 'fake-indexeddb';
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadKit } from './bootstrap.mjs';

const { persistence } = loadKit('persistence');

test('parsePath: 2 segments default the store, 3+ join the key tail', () => {
  assert.deepEqual(persistence.parsePath('page.foo'),
    { db: 'page', store: 'default', key: 'foo' });
  assert.deepEqual(persistence.parsePath('page.bucket.foo'),
    { db: 'page', store: 'bucket', key: 'foo' });
  assert.deepEqual(persistence.parsePath('page.bucket.foo.bar'),
    { db: 'page', store: 'bucket', key: 'foo.bar' });
});

test('parsePath: single-segment and empty paths are rejected', () => {
  assert.throws(() => persistence.parsePath('single'), /needs at least/);
  assert.throws(() => persistence.parsePath(''), /non-empty string/);
  assert.throws(() => persistence.parsePath(null), /non-empty string/);
});

test('save/load round-trips rich types via structured clone', async () => {
  const value = {
    text: 'hello',
    bytes: new Uint8Array([1, 2, 3]),
    when: new Date('2026-06-11T00:00:00Z'),
    map: new Map([['k', 'v']]),
  };
  await persistence.save('t1.rich', value);
  const back = await persistence.load('t1.rich');
  assert.equal(back.text, 'hello');
  assert.ok(back.bytes instanceof Uint8Array);
  assert.deepEqual([...back.bytes], [1, 2, 3]);
  assert.ok(back.when instanceof Date);
  assert.equal(back.when.toISOString(), '2026-06-11T00:00:00.000Z');
  assert.ok(back.map instanceof Map);
  assert.equal(back.map.get('k'), 'v');
});

test('remove deletes; load of a missing key is undefined', async () => {
  await persistence.save('t1.gone', 1);
  await persistence.remove('t1.gone');
  assert.equal(await persistence.load('t1.gone'), undefined);
  assert.equal(await persistence.load('t1.never'), undefined);
});

test('list / entries / clearStore scope to the store, ignoring the key segment', async () => {
  await persistence.save('t2.box.a', 1);
  await persistence.save('t2.box.b', 2);
  await persistence.save('t2.other.c', 3); // different store, same db
  assert.deepEqual((await persistence.list('t2.box.ignored')).sort(), ['a', 'b']);
  const entries = await persistence.entries('t2.box.x');
  assert.deepEqual(Object.fromEntries(entries), { a: 1, b: 2 });
  await persistence.clearStore('t2.box.x');
  assert.deepEqual(await persistence.list('t2.box.x'), []);
  assert.equal(await persistence.load('t2.other.c'), 3); // untouched
});

test('layers a new store onto a database other tools created at a higher version', async () => {
  // Simulate another tool owning the db at version 3 with its own store.
  await new Promise((resolve, reject) => {
    const req = indexedDB.open('shared-db', 3);
    req.onupgradeneeded = () => req.result.createObjectStore('theirs');
    req.onsuccess = () => { req.result.close(); resolve(); };
    req.onerror = () => reject(req.error);
  });

  await persistence.save('shared-db.mine.k', 'v'); // must reopen at version 4
  assert.equal(await persistence.load('shared-db.mine.k'), 'v');

  const db = await new Promise((resolve, reject) => {
    const req = indexedDB.open('shared-db');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  assert.equal(db.version, 4);
  assert.deepEqual([...db.objectStoreNames].sort(), ['mine', 'theirs']);
  db.close();
});

test('collection: put auto-assigns ids, preserves explicit ids, and round-trips', async () => {
  const items = persistence.collection('shelf.items');
  const a = await items.put({ name: 'a' });
  assert.ok(a.id, 'auto-assigned id');
  const b = await items.put({ id: 7, name: 'b' }); // legacy numeric id preserved
  assert.equal(b.id, 7);

  assert.deepEqual(await items.get(7), { id: 7, name: 'b' });
  assert.equal(await items.count(), 2);
  assert.deepEqual((await items.all()).map(r => r.name).sort(), ['a', 'b']);
  assert.deepEqual((await items.find(r => r.name === 'a')).length, 1);

  await items.delete(a.id);
  assert.equal(await items.count(), 1);
  await items.clear();
  assert.equal(await items.count(), 0);
});

test('collection path must be exactly <db>.<store>', () => {
  assert.throws(() => persistence.collection('justdb'), /must be "<db>\.<store>"/);
  assert.throws(() => persistence.collection('a.b.c'), /must be "<db>\.<store>"/);
});

test('idb introspection: databases / stores / storesDetail / count / readAll', async () => {
  await persistence.save('probe.box.k1', 'v1');
  await persistence.save('probe.box.k2', 'v2');

  const dbs = (await persistence.idb.databases()).map(d => d.name);
  assert.ok(dbs.includes('probe'));

  assert.deepEqual(await persistence.idb.stores('probe'), ['box']);

  const detail = await persistence.idb.storesDetail('probe');
  assert.equal(detail.length, 1);
  assert.equal(detail[0].name, 'box');
  assert.equal(detail[0].count, 2);
  assert.equal(detail[0].keyPath, '(key)'); // out-of-line keys

  assert.equal(await persistence.idb.count('probe', 'box'), 2);
  assert.equal(await persistence.idb.count('probe', 'nope'), 0);
  assert.deepEqual((await persistence.idb.readAll('probe', 'box')).sort(), ['v1', 'v2']);
  assert.deepEqual(await persistence.idb.readAll('probe', 'nope'), []);
});

test('idb.readEntries keeps out-of-line keys beside their values', async () => {
  await persistence.save('entries.box.k1', { n: 1 });
  await persistence.save('entries.box.k2', 'two');
  const got = await persistence.idb.readEntries('entries', 'box');
  assert.deepEqual(got.sort((a, b) => String(a.key).localeCompare(String(b.key))),
    [{ key: 'k1', value: { n: 1 } }, { key: 'k2', value: 'two' }]);
  assert.deepEqual(await persistence.idb.readEntries('entries', 'nope'), []);
});

test('idb.admin: clearStore, replaceAll, deleteStore, deleteDb', async () => {
  // A keyPath store, as a legacy Dexie-style table would have.
  await new Promise((resolve, reject) => {
    const req = indexedDB.open('legacy', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('rows', { keyPath: 'id' });
    req.onsuccess = () => { req.result.close(); resolve(); };
    req.onerror = () => reject(req.error);
  });

  await persistence.idb.admin.replaceAll('legacy', 'rows',
    [{ id: 1, n: 'x' }, { id: 2, n: 'y' }, { id: 2, n: 'y2' }]); // dup id: last write wins
  const rows = await persistence.idb.readAll('legacy', 'rows');
  assert.deepEqual(rows, [{ id: 1, n: 'x' }, { id: 2, n: 'y2' }]);

  await assert.rejects(
    persistence.idb.admin.replaceAll('legacy', 'missing', []),
    /not in "legacy"/);

  await persistence.idb.admin.clearStore('legacy', 'rows');
  assert.equal(await persistence.idb.count('legacy', 'rows'), 0);

  await persistence.idb.admin.deleteStore('legacy', 'rows');
  assert.deepEqual(await persistence.idb.stores('legacy'), []);

  await persistence.idb.admin.deleteDb('legacy');
  const names = (await persistence.idb.databases()).map(d => d.name);
  assert.ok(!names.includes('legacy'));
});

const seedReplacementStore = async (name) => {
  const db = await new Promise((resolve, reject) => {
    const req = indexedDB.open(name, 1);
    req.onupgradeneeded = () => {
      const store = req.result.createObjectStore('rows', { keyPath: 'id' });
      store.createIndex('name', 'name', { unique: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction('rows', 'readwrite');
      tx.oncomplete = resolve;
      tx.onabort = () => reject(tx.error);
      tx.objectStore('rows').put({ id: 1, name: 'original' });
    });
  } finally { db.close(); }
};

test('replaceAll preserves the original store when the first record has no key', async () => {
  const name = 'replace-missing-first-key';
  await seedReplacementStore(name);
  await assert.rejects(persistence.idb.admin.replaceAll(name, 'rows', [{ name: 'missing key' }]),
    { name: 'DataError' });
  assert.deepEqual(await persistence.idb.readAll(name, 'rows'), [{ id: 1, name: 'original' }]);
});

test('replaceAll rolls back earlier writes when a later record has an invalid key', async () => {
  const name = 'replace-invalid-later-key';
  await seedReplacementStore(name);
  await assert.rejects(persistence.idb.admin.replaceAll(name, 'rows', [
    { id: 2, name: 'partial replacement' }, { id: null, name: 'invalid key' },
  ]), { name: 'DataError' });
  assert.deepEqual(await persistence.idb.readAll(name, 'rows'), [{ id: 1, name: 'original' }]);
});

test('replaceAll rolls back when a unique index rejects a later request', async () => {
  const name = 'replace-unique-index-failure';
  await seedReplacementStore(name);
  await assert.rejects(persistence.idb.admin.replaceAll(name, 'rows', [
    { id: 2, name: 'duplicate' }, { id: 3, name: 'duplicate' },
  ]), { name: 'ConstraintError' });
  assert.deepEqual(await persistence.idb.readAll(name, 'rows'), [{ id: 1, name: 'original' }]);
});

test('replaceAll resolves after the replacement transaction completes', async (t) => {
  const name = 'replace-commit-completion';
  await seedReplacementStore(name);
  let committed = false;
  const transaction = IDBDatabase.prototype.transaction;
  t.mock.method(IDBDatabase.prototype, 'transaction', function (...args) {
    const tx = transaction.apply(this, args);
    if (this.name === name && args[1] === 'readwrite') {
      tx.addEventListener('complete', () => { committed = true; });
    }
    return tx;
  });
  await persistence.idb.admin.replaceAll(name, 'rows', [{ id: 2, name: 'replacement' }]);
  assert.equal(committed, true, 'a successful request is not yet a committed replacement');
  assert.deepEqual(await persistence.idb.readAll(name, 'rows'), [{ id: 2, name: 'replacement' }]);
});

test('replaceAll rejects an abort after a successful put and preserves the original store', async (t) => {
  const name = 'replace-abort-after-put';
  await seedReplacementStore(name);
  const put = IDBObjectStore.prototype.put;
  t.mock.method(IDBObjectStore.prototype, 'put', function (...args) {
    const req = put.apply(this, args);
    if (this.transaction.db.name === name) {
      req.addEventListener('success', () => this.transaction.abort(), { once: true });
    }
    return req;
  });
  await assert.rejects(persistence.idb.admin.replaceAll(name, 'rows', [{ id: 2, name: 'replacement' }]),
    { name: 'AbortError' });
  assert.deepEqual(await persistence.idb.readAll(name, 'rows'), [{ id: 1, name: 'original' }]);
});

test('replaceAll permits an empty replacement and keeps duplicate IDs last-write-wins', async () => {
  const name = 'replace-empty-and-duplicates';
  await seedReplacementStore(name);
  await persistence.idb.admin.replaceAll(name, 'rows', [
    { id: 2, name: 'first' }, { id: 2, name: 'last' },
  ]);
  assert.deepEqual(await persistence.idb.readAll(name, 'rows'), [{ id: 2, name: 'last' }]);
  await persistence.idb.admin.replaceAll(name, 'rows', []);
  assert.deepEqual(await persistence.idb.readAll(name, 'rows'), []);
});

test('replaceAll closes its connection when JSON normalization fails', async (t) => {
  const name = 'replace-json-failure';
  await seedReplacementStore(name);
  let closed = false;
  const close = IDBDatabase.prototype.close;
  t.mock.method(IDBDatabase.prototype, 'close', function (...args) {
    if (this.name === name) closed = true;
    return close.apply(this, args);
  });
  const cyclic = [];
  cyclic.push(cyclic);
  await assert.rejects(persistence.idb.admin.replaceAll(name, 'rows', cyclic), TypeError);
  assert.equal(closed, true);
  assert.deepEqual(await persistence.idb.readAll(name, 'rows'), [{ id: 1, name: 'original' }]);
});
