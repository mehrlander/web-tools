// json-lens.test.mjs: pages/drop/json-lens.html. Pins four things: loaded
// JSON reaches the page as text, not markup; the lens reads each value correctly;
// the filter reaches collapsed branches; JSONPath and TypeScript stay valid for
// awkward keys.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, startAlpine, repoRoot } from './bootstrap.mjs';

const html = readFileSync(path.join(repoRoot, 'pages/drop/json-lens.html'), 'utf8');
const { window } = makeWindow({ html });
const doc = window.document;
// jsdom lacks scrollIntoView and dialog methods; the page only calls them.
window.Element.prototype.scrollIntoView ??= () => {};
for (const d of doc.querySelectorAll('dialog')) {
  d.showModal ??= () => { d.open = true; };
  d.close ??= () => { d.open = false; };
}
const Alpine = await startAlpine(window);
const lens = Alpine.$data(doc.body);
const plain = v => JSON.parse(JSON.stringify(v));
const tick = () => new Promise(r => setTimeout(r, 0));

test('boots on the sample order with a tree and a lens', async () => {
  assert.equal(lens.source, 'E-commerce order');
  assert.ok(doc.querySelectorAll('[data-row]').length > 10);
  assert.match(doc.body.textContent, /Eleanor Vance/);
});

test('keys and values from loaded JSON are text, never markup', async () => {
  lens.pasted = JSON.stringify({ '<img id=pwn1 src=x>': 1, s: '<b id=pwn2>x</b>', rows: [{ '<i id=pwn3>': '<u id=pwn4>' }] });
  lens.loadPasted();
  lens.select(['rows']);
  await tick();
  for (const id of ['pwn1', 'pwn2', 'pwn3', 'pwn4']) assert.equal(doc.getElementById(id), null, id);
  assert.match(doc.body.textContent, /<b id=pwn2>x<\/b>/);
});

test('the lens reads a value by what it looks like', async () => {
  lens.load({ a: '#7c3aed', b: '2026-09-18T14:32:00Z', c: 'https://example.com/x', d: 'https://x.test/p.png',
              avatarUrl: 'https://img.test/u/1?w=150', e: 'javascript:alert(1).png', f: 3 }, 't');
  const kinds = Object.fromEntries(['a', 'b', 'c', 'd', 'avatarUrl', 'e', 'f'].map(k => { lens.select([k]); return [k, lens.kind]; }));
  assert.deepEqual(kinds, { a: 'color', b: 'date', c: 'url', d: 'image', avatarUrl: 'image', e: 'text', f: 'text' });
});

test('the filter finds a match inside a collapsed branch', async () => {
  lens.load({ outer: { inner: { needle: 1 } }, other: 2 }, 't');
  lens.collapseAll();
  assert.equal(lens.rows.length, 1);
  lens.query = 'needle';
  assert.deepEqual(plain(lens.rows.map(r => r.label)), ['root', 'outer', 'inner', 'needle']);
  lens.query = '';
});

test('JSONPath and TypeScript survive awkward keys and ragged records', () => {
  assert.equal(lens.jsonPath(['a b', 0, 'ok', '1']), '$["a b"][0].ok["1"]');
  lens.load({ items: [{ id: 1, 'x-y': 'a' }, { id: 2, note: null }] }, 't');
  assert.equal(lens.ts, '{\n  items: {\n    id: number;\n    "x-y"?: string;\n    note?: null;\n  }[];\n}');
});

test('a record array projects to a table and arrow keys walk the rows', async () => {
  lens.load({ list: [{ a: 1 }, { a: 2, b: 3 }] }, 't');
  lens.select(['list']);
  assert.deepEqual(plain(lens.table.cols), ['a', 'b']);
  window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowDown' }));
  assert.deepEqual(plain(lens.path), ['list', 0]);
});
