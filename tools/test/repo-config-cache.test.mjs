// repo-config-cache.js — the pure config-aggregate builders. Run the IIFE
// against a window stub, then exercise hashing, per-repo history merge (append
// only on change, capped), whole-cache build (membership follows the crawl),
// and the timestamp-ignoring change detector that gates no-op commits.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const src = readFileSync(path.join(repoRoot, 'lib/repo-config-cache.js'), 'utf8');
const window = {};
new Function('window', src)(window);
const C = window.RepoConfigCache;

test('hashConfig is stable, order-preserving, and separates null', () => {
  assert.equal(C.hashConfig({ a: 1, b: 2 }), C.hashConfig({ a: 1, b: 2 }));
  assert.notEqual(C.hashConfig({ a: 1 }), C.hashConfig({ a: 2 }));
  assert.notEqual(C.hashConfig(null), C.hashConfig({}));
});

test('mergeRepo seeds history on first sight', () => {
  const e = C.mergeRepo(undefined, { config: { icon: 'ph-x' }, configName: '.web-tools.json' }, 't0');
  assert.equal(e.history.length, 1);
  assert.deepEqual(e.config, { icon: 'ph-x' });
  assert.equal(e.history[0].at, 't0');
});

test('mergeRepo appends only when the config changes', () => {
  const a = C.mergeRepo(undefined, { config: { icon: 'ph-x' } }, 't0');
  const b = C.mergeRepo(a, { config: { icon: 'ph-x' } }, 't1'); // unchanged
  assert.equal(b.history.length, 1);
  assert.equal(b.fetchedAt, 't1'); // snapshot restamped even without a new version
  const c = C.mergeRepo(b, { config: { icon: 'ph-y' } }, 't2'); // changed
  assert.equal(c.history.length, 2);
  assert.equal(c.history[1].config.icon, 'ph-y');
});

test('mergeRepo caps history at the newest N', () => {
  let e;
  for (let i = 0; i < 25; i++) e = C.mergeRepo(e, { config: { n: i } }, 't' + i, 20);
  assert.equal(e.history.length, 20);
  assert.equal(e.history[0].config.n, 5);   // oldest 5 dropped
  assert.equal(e.history[19].config.n, 24); // newest kept
});

test('buildCache tracks the crawl membership and carries history', () => {
  const prev = C.buildCache(null, {
    'o/a': { config: { v: 1 } },
    'o/b': { config: { v: 1 } },
  }, 't0');
  // a changes, b drops out, c appears
  const next = C.buildCache(prev, {
    'o/a': { config: { v: 2 } },
    'o/c': { config: { v: 1 } },
  }, 't1');
  assert.deepEqual(Object.keys(next.repos).sort(), ['o/a', 'o/c']);
  assert.equal(next.repos['o/a'].history.length, 2); // history carried + appended
  assert.equal(next.repos['o/c'].history.length, 1); // fresh
});

test('cacheChanged ignores timestamps, catches hash and membership', () => {
  const a = C.buildCache(null, { 'o/a': { config: { v: 1 } } }, 't0');
  const sameContent = C.buildCache(a, { 'o/a': { config: { v: 1 } } }, 't1');
  assert.equal(C.cacheChanged(a, sameContent), false); // only fetchedAt moved
  const changed = C.buildCache(a, { 'o/a': { config: { v: 2 } } }, 't2');
  assert.equal(C.cacheChanged(a, changed), true);
  const added = C.buildCache(a, { 'o/a': { config: { v: 1 } }, 'o/b': { config: {} } }, 't3');
  assert.equal(C.cacheChanged(a, added), true);
});
