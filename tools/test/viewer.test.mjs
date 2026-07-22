// alpineComponents/viewer.js — logic tests for resolveDefaultMode, the resolver
// that picks which of a file's available modes it opens in. Covers the three
// `defaultMode` forms (string, ext map, function), the size-aware function case,
// and the availability safety net (a resolved mode that isn't valid for the file
// falls back to raw). Driven against the real ViewRegistry via a mounted
// instance; show()/switchMode are avoided because they load CDN assets that
// never resolve under jsdom, so the file is pointed at fixtures by setting
// file/content directly, which is all the resolver reads.

import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWindow, startAlpine, tick } from './bootstrap.mjs';

const { window, problems } = makeWindow({
  html: `<!doctype html><html><body>
    <div id="v" x-data="viewer({ defaultMode: { md: 'preview', json: 'tree', '*': 'raw' } })"></div>
  </body></html>`,
});

// alpine-bundle.js defines the browser store the viewer reads for repo/ref.
const Alpine = await startAlpine(window, [
  'lib/alpine-bundle.js',
  'lib/alpineComponents/viewer.js',
]);

const data = Alpine.$data(window.document.getElementById('v'));

// Set defaultMode + the shown file, then ask the resolver which mode wins.
// availableModes recomputes from file/content, so this exercises the real
// per-module test() gating without touching the asset-loading show() path.
const resolve = (name, content, dm) => {
  data.defaultMode = dm;
  data.file = name;
  data.content = content;
  return data.resolveDefaultMode(data.fileContext, data.availableModes).id;
};

test('mounts clean; the map opt is plumbed onto defaultMode', () => {
  assert.deepEqual(problems, []);
  assert.ok(data.description.length > 0);
  assert.equal(typeof data.defaultMode, 'object');
  assert.equal(data.defaultMode.md, 'preview');
});

test('string form: honored when available, else falls back to raw', () => {
  assert.equal(resolve('a.md', '# hi', 'code'), 'code');   // code tests true for md
  assert.equal(resolve('a.md', '# hi', 'raw'), 'raw');
  assert.equal(resolve('a.md', '# hi', 'tree'), 'raw');    // tree is json-only → fallback
});

test('ext map: keyed by extension with * catch-all', () => {
  const map = { md: 'preview', json: 'tree', '*': 'code' };
  assert.equal(resolve('notes.md', '# hi', map), 'preview');
  assert.equal(resolve('data.json', '[1,2,3]', map), 'tree');
  assert.equal(resolve('main.py', 'x=1', map), 'code');    // '*' → code, valid for py
});

test('ext map: unresolvable pick (no key/catch-all, or mode not available) → raw', () => {
  assert.equal(resolve('main.py', 'x=1', { md: 'preview' }), 'raw');       // py absent, no '*'
  assert.equal(resolve('data.json', '[1,2,3]', { '*': 'preview' }), 'raw'); // preview invalid for json
});

test('function form: receives the file, can key on size', () => {
  const bySize = (f) => f.content.length > 20 ? 'raw' : 'preview';
  assert.equal(resolve('a.md', '# hi', bySize), 'preview');         // short → preview
  assert.equal(resolve('a.md', '#'.repeat(40), bySize), 'raw');     // long → raw
});

test('function form: a falsy return or a throw falls back to raw', () => {
  assert.equal(resolve('a.md', '# hi', () => null), 'raw');
  assert.equal(resolve('a.md', '# hi', () => { throw new Error('boom'); }), 'raw');
});

test('no opt: defaultMode defaults to the raw string', async () => {
  const el = window.document.createElement('div');
  el.setAttribute('x-data', 'viewer()');
  window.document.body.appendChild(el);
  Alpine.initTree(el);
  await tick();
  assert.equal(Alpine.$data(el).defaultMode, 'raw');
});

test('no stray warnings or errors after the resolves', async () => {
  await tick();
  assert.deepEqual(problems, []);
});
