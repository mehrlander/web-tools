// JSON shown and JSON edited are two modes with two libraries.
//
// Showing is kits/json-explorer.js, the native themed tree: the viewer's
// `tree` mode, the console's object rows and the transform workbench's Tree
// panel. Editing is vanilla-jsoneditor, the viewer's `edit` mode, offered only
// to a host that asks with `viewer({ edit: true })` (popups/idb-nav.html), and
// imported from its CDN only when that mode mounts. Decided 2026-10-07, built
// 2026-11-16 (tracker task own-json-tree-retire-vje-i0lcj2).
//
// What the cases hold is the part that fails quietly: a reader that loads the
// editor anyway still renders, so only a check on the import shows it; and an
// edit that stops reaching `viewer:tree-change` still looks editable, so only
// the round trip shows the page lost its writes.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, startAlpine, tick, repoRoot } from './bootstrap.mjs';

const { window } = makeWindow({
  html: `<!doctype html><html><body>
    <div id="reader" x-data="viewer({ defaultMode: { json: 'tree', '*': 'raw' } })"></div>
    <div id="writer" x-data="viewer({ edit: true, defaultMode: 'edit' })"></div>
    <div id="con" x-data="debugConsole()"></div>
  </body></html>`,
});

const Alpine = await startAlpine(window, [
  'lib/vanilla-bundle.js',
  'lib/alpine-bundle.js',
  'lib/kits/json-explorer.js',
  'lib/alpineComponents/viewer.js',
  'lib/alpineComponents/console.js',
]);

const VR = window.ViewRegistry;
// Every reach for the editor goes through ViewRegistry.loadEditor, so a
// counting stub there sees any of them. The fake records what it was given
// and hands back the onChange the viewer wired, for the round trip.
let editorLoads = 0;
const made = [];
VR.loadEditor = async () => {
  editorLoads++;
  return {
    createJSONEditor: ({ target, props }) => {
      const ed = { target, props, destroy() {} };
      made.push(ed);
      return ed;
    },
  };
};

const viewerOf = (id) => Alpine.$data(window.document.getElementById(id));
const showAs = async (id, name, content, mode) => {
  const d = viewerOf(id);
  d.file = name;
  d.content = content;
  await d.switchMode(mode);
  await tick(6);
  return d;
};
const ids = (d) => d.availableModes.map(m => m.id);

test('a reading host is offered the tree and not the editor', () => {
  const d = viewerOf('reader');
  d.file = 'a.json'; d.content = '{"a":1}';
  assert.ok(ids(d).includes('tree'));
  assert.ok(!ids(d).includes('edit'), 'the editor was offered to a host that did not ask');
  assert.equal(d.resolveDefaultMode(d.fileContext, d.availableModes).id, 'tree');
});

test('a host that asks with edit: true is offered the editor, and opens in it', () => {
  const d = viewerOf('writer');
  d.file = 'a.json'; d.content = '{"a":1}';
  assert.ok(ids(d).includes('edit'));
  assert.ok(ids(d).includes('tree'), 'the reader stays one tap away');
  assert.equal(d.resolveDefaultMode(d.fileContext, d.availableModes).id, 'edit');
});

test('the view path draws the native tree and never loads the editor', async () => {
  editorLoads = 0;
  const d = await showAs('reader', 'data/x.json', JSON.stringify({ repo: 'web-tools', tags: ['a', 'b'] }), 'tree');
  const root = d.$root;
  const mount = root.querySelector('.json-tree-mount');
  assert.ok(mount, 'no tree mount');
  assert.ok(mount.querySelector('.json-explorer'), 'the explorer did not mount');
  assert.ok(mount.__jsonTree && typeof mount.__jsonTree.destroy === 'function');
  assert.match(mount.textContent, /repo/);
  assert.match(mount.textContent, /web-tools/);
  assert.equal(root.querySelector('.jse-mount'), null);
  assert.equal(editorLoads, 0, 'the reader reached for vanilla-jsoneditor');
});

test('a long array shows a visible cap, not every row', async () => {
  const big = JSON.stringify(Array.from({ length: 1000 }, (_, i) => i));
  const d = await showAs('reader', 'big.json', big, 'tree');
  assert.match(d.$root.querySelector('.json-tree-mount').textContent, /more of 1,000/);
});

test('invalid JSON says so in the tree pane', async () => {
  const d = await showAs('reader', 'bad.json', '{"a":', 'tree');
  assert.match(d.$root.querySelector('.json-tree-mount').textContent, /Invalid JSON/);
});

test('the edit path round-trips both shapes through viewer:tree-change', async () => {
  made.length = 0;
  editorLoads = 0;
  const seen = [];
  const on = (e) => seen.push(e.detail);
  window.document.addEventListener('viewer:tree-change', on);
  try {
    const d = await showAs('writer', 'db.store.json', '{"a":1}', 'edit');
    assert.equal(editorLoads, 1);
    assert.equal(made.length, 1);
    const ed = made[0];
    assert.equal(ed.props.mode, 'tree');
    assert.equal(ed.props.readOnly, undefined, 'the editor was mounted read-only');
    assert.equal(ed.props.content.json.a, 1);
    assert.equal(d.$root.querySelector('.jse-mount').__jse, ed);

    // Valid JSON arrives as { json }, a half-typed edit as { text }; a page
    // that persists edits reads both.
    ed.props.onChange({ json: { a: 2 } });
    ed.props.onChange({ text: '{"a":' });
    assert.equal(seen.length, 2);
    assert.equal(seen[0].content.json.a, 2);
    assert.equal(seen[0].file, 'db.store.json');
    assert.equal(seen[1].content.text, '{"a":');
  } finally {
    window.document.removeEventListener('viewer:tree-change', on);
  }
});

test("the console's object row draws the native tree", async () => {
  const c = Alpine.$data(window.document.getElementById('con'));
  const host = window.document.createElement('div');
  window.document.body.append(host);
  editorLoads = 0;
  await c._mountTree(host, { _id: 9001, args: [{ level: 'info', n: 3 }] });
  assert.ok(host.querySelector('.json-explorer'), 'the console did not mount the explorer');
  assert.equal(editorLoads, 0, 'the console row reached for vanilla-jsoneditor');
  assert.match(host.textContent, /level/);
  assert.equal(typeof c._editors.get(9001)?.destroy, 'function');
});

// ── where the editor can be imported from ───────────────────────────────────

const VJE = 'vanilla-jsoneditor/standalone.js';
const walk = (dir) => readdirSync(dir).flatMap((n) => {
  const p = path.join(dir, n);
  return statSync(p).isDirectory() ? walk(p) : p.endsWith('.js') ? [p] : [];
});

test('lib/ imports vanilla-jsoneditor in one place, the edit loader', () => {
  const hits = walk(path.join(repoRoot, 'lib'))
    .filter((p) => readFileSync(p, 'utf8').includes(VJE))
    .map((p) => path.relative(repoRoot, p));
  assert.deepEqual(hits, ['lib/alpineComponents/viewer.js']);
  const src = readFileSync(path.join(repoRoot, 'lib/alpineComponents/viewer.js'), 'utf8');
  assert.equal(src.split(VJE).length - 1, 1);
  const at = src.indexOf(VJE);
  assert.ok(src.lastIndexOf('async loadEditor()', at) > src.lastIndexOf('\n  },', at),
    'the import is no longer inside ViewRegistry.loadEditor');
});

test('the pre-build carries that one import and no other', () => {
  const dist = readFileSync(path.join(repoRoot, 'dist/web-tools.js'), 'utf8');
  assert.equal(dist.split(VJE).length - 1, 1);
});

test('popups/idb-nav.html, the page that edits, asks for the editor', () => {
  const page = readFileSync(path.join(repoRoot, 'popups/idb-nav.html'), 'utf8');
  assert.match(page, /viewer\(\{[^}]*edit: true/);
});
