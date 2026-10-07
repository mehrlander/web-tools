// alpineComponents/transform-workbench.js — the saved-tab cache and its
// formerKey move. The Stage mounts the workbench with persist on, so the tabs a
// person writes live in localStorage under one key; when that key is renamed,
// formerKey carries the saved tabs across once and deletes the old entry.
// Driven against the component factory with a stubbed Alpine and a map-backed
// localStorage, the way pivot.test.mjs loads it.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';

function loadFactory(store) {
  let init = null;
  const factories = {};
  const localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: k => { store.delete(k); },
  };
  const win = {
    document: { addEventListener: (n, f) => { if (n === 'alpine:init') init = f; } },
    Alpine: { data: (name, fn) => { factories[name] = fn; }, raw: x => x, store: () => {} },
    localStorage,
    matchMedia: () => ({ matches: false, addEventListener() {} }),
  };
  win.window = win;
  const src = readFileSync(path.join(repoRoot, 'lib/alpineComponents/transform-workbench.js'), 'utf8');
  new Function('window', 'document', 'Alpine', 'localStorage', 'matchMedia',
    'with (window) { ' + src + ' }')(win, win.document, win.Alpine, win.localStorage, win.matchMedia);
  init();
  return factories.transformWorkbench;
}

const saved = name => JSON.stringify({ tabs: [{ name, fnSrc: 'rows => rows' }] });

test('formerKey moves saved tabs to storageKey and deletes the old entry', () => {
  const store = new Map([['old-key', saved('mine')]]);
  const wb = loadFactory(store)({ persist: true, storageKey: 'new-key', formerKey: 'old-key' });
  wb.restoreTabs();
  assert.deepEqual(wb.tabs.map(t => t.name), ['mine']);
  assert.equal(store.get('new-key'), saved('mine'));
  assert.equal(store.has('old-key'), false);
});

test('tabs already under storageKey win, and the old entry still goes', () => {
  const store = new Map([['old-key', saved('stale')], ['new-key', saved('current')]]);
  const wb = loadFactory(store)({ persist: true, storageKey: 'new-key', formerKey: 'old-key' });
  wb.restoreTabs();
  assert.deepEqual(wb.tabs.map(t => t.name), ['current']);
  assert.equal(store.has('old-key'), false);
});

test('without formerKey the cache reads storageKey alone', () => {
  const store = new Map([['old-key', saved('elsewhere')], ['new-key', saved('here')]]);
  const wb = loadFactory(store)({ persist: true, storageKey: 'new-key' });
  wb.restoreTabs();
  assert.deepEqual(wb.tabs.map(t => t.name), ['here']);
  assert.equal(store.has('old-key'), true);
});
