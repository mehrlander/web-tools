// kits/lists.js: the registry's lists/ folder as one kind of file. What breaks
// without these: a write that drops the keys describing a list, a dropped
// connection read as an empty list and saved over the real one, a stray file
// (the dictate page's autocorrect table) shown as a list, a created list
// claiming a capability the pane cannot render for it, a list created over an
// existing file, and a list deleted with its items still in it.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const win = { GH: { FRESH: { cache: 'no-store' } } };
new Function('window', readFileSync(path.join(repoRoot, 'lib/kits/lists.js'), 'utf8'))(win);
const L = win.Lists;

const notFound = () => Object.assign(new Error('404'), { status: 404 });

// A registry folder: path -> file text. `fail` makes a read throw a non-404.
function registry(files = {}, { fail = new Set() } = {}) {
  const S = { files: { ...files }, saves: [], reads: [], dels: [] };
  return {
    S,
    async get(p, opts) {
      S.reads.push({ path: p, opts });
      if (fail.has(p)) throw Object.assign(new Error('Load failed'), { status: 0 });
      if (!(p in S.files)) throw notFound();
      return { text: S.files[p] };
    },
    async req(p, opts) {
      S.reads.push({ path: p, opts });
      assert.equal(p, 'contents/lists');
      return Object.keys(S.files).filter(f => f.startsWith('lists/'))
        .map(f => ({ type: 'file', name: f.slice('lists/'.length), path: f }));
    },
    async save(p, value, message) { S.saves.push({ path: p, value, message }); S.files[p] = JSON.stringify(value, null, 2); },
    async del(p, message) { S.dels.push({ path: p, message }); delete S.files[p]; return { deleted: true }; },
  };
}
const json = (v) => JSON.stringify(v);

test('mutate keeps every top-level key and reads fresh', async () => {
  const reg = registry({ 'lists/aphorisms.json': json({ title: 'Aphorisms', icon: 'quotes', extra: 7, items: [{ id: 'l1', text: 'a' }] }) });
  const res = await L.append(reg, 'lists/aphorisms.json', { id: 'l2', text: 'b' }, 'msg');
  assert.deepEqual(reg.S.saves[0].value, { title: 'Aphorisms', icon: 'quotes', extra: 7, items: [{ id: 'l1', text: 'a' }, { id: 'l2', text: 'b' }] });
  assert.deepEqual(res.items.map(i => i.id), ['l1', 'l2']);
  assert.deepEqual(reg.S.reads[0].opts, { cache: 'no-store' });
});

test('a missing file reads as empty, and any other read failure aborts the write', async () => {
  const reg = registry();
  await L.append(reg, 'lists/jots.json', { id: 'j1', text: 'first' }, 'msg');
  assert.deepEqual(reg.S.saves[0].value, { items: [{ id: 'j1', text: 'first' }] });

  const down = registry({ 'lists/jots.json': json({ items: [{ id: 'j0', text: 'keep me' }] }) }, { fail: new Set(['lists/jots.json']) });
  await assert.rejects(L.append(down, 'lists/jots.json', { id: 'j1', text: 'new' }, 'msg'), /Load failed/);
  assert.equal(down.S.saves.length, 0, 'nothing saved over the pile it could not read');
});

test('mutate can change the header, and the header comes back described', async () => {
  const reg = registry({ 'lists/words.json': json({ title: 'Words', items: [] }) });
  const res = await L.mutate(reg, 'lists/words.json', (items, header) => ({ items, header: { ...header, title: 'Useful words', icon: 'book-open-text' } }), 'msg');
  assert.deepEqual(reg.S.saves[0].value, { title: 'Useful words', icon: 'book-open-text', items: [] });
  assert.equal(L.describe('lists/words.json', res.header).title, 'Useful words');
});

test('discover finds titled files only, leaves out the built-ins, and sorts by title', async () => {
  const reg = registry({
    'lists/todo.json': json({ items: [] }),
    'lists/jots.json': json({ items: [] }),
    'lists/pins.json': json({ items: [] }),
    'lists/autocorrect.json': json({ note: 'find and replace', items: [{ from: 'a', to: 'b' }] }),
    'lists/useful-words.json': json({ title: 'Useful words and phrases', icon: 'book-open-text', items: [{ id: 'l1', text: 'appurtenance' }] }),
    'lists/aphorisms.json': json({ title: 'Aphorisms', icon: 'quotes', items: [] }),
    'lists/broken.json': '{"title": "Broken", "items": [',
  });
  const found = await L.discover(reg);
  assert.deepEqual(found.map(l => l.path), ['lists/aphorisms.json', 'lists/useful-words.json']);
  assert.equal(found[1].items.length, 1);
  assert.equal(found[1].icon, 'book-open-text');
  assert.ok(found[1].text.includes('appurtenance'), 'carries the bytes it read, for the peek');
});

test('a folder that does not exist yet is no lists, not an error', async () => {
  const reg = registry();
  reg.req = async () => { throw notFound(); };
  assert.deepEqual(await L.discover(reg), []);
});

test('a created list keeps only the capabilities the pane can render for it', () => {
  const d = L.describe('lists/groceries.json', { title: 'Groceries', capabilities: ['done', 'due', 'link'] });
  assert.deepEqual(d.capabilities, ['done']);
  assert.equal(d.builtIn, false);
  assert.deepEqual(L.describe('lists/todo.json', {}).capabilities, ['done', 'due']);
  assert.equal(L.describe('lists/todo.json', {}).title, 'To-do');
  for (const c of L.OPEN) assert.ok(c in L.CAPABILITIES, c);
  for (const b of L.BUILT_IN) for (const c of b.capabilities) assert.ok(c in L.CAPABILITIES, b.path + ' ' + c);
});

test('icon names normalize, and anything else falls back to the plain list icon', () => {
  assert.equal(L.icon('Quotes'), 'quotes');
  assert.equal(L.icon('ph-book-open-text'), 'book-open-text');
  assert.equal(L.icon(''), L.DEFAULT_ICON);
  assert.equal(L.icon('two words'), L.DEFAULT_ICON);
  assert.equal(L.icon('<b>'), L.DEFAULT_ICON);
});

test('create names the file from the title, refuses a taken path, and refuses a built-in', async () => {
  const reg = registry({ 'lists/aphorisms.json': json({ title: 'Aphorisms', items: [] }) });
  const list = await L.create(reg, { title: 'Useful words & phrases', icon: 'book-open-text', capabilities: ['done', 'link'] });
  assert.equal(list.path, 'lists/useful-words-phrases.json');
  assert.deepEqual(reg.S.saves[0].value, { title: 'Useful words & phrases', icon: 'book-open-text', capabilities: ['done'], items: [] });
  await assert.rejects(L.create(reg, { title: 'Aphorisms' }), /already stored/);
  await assert.rejects(L.create(reg, { title: 'Todo' }), /built-in/);
  await assert.rejects(L.create(reg, { title: '   ' }), /needs a title/);
  await assert.rejects(L.create(reg, { title: '!!!' }), /letter or a digit/);
});

test('move writes the new file before deleting the old, and refuses a taken or built-in path', async () => {
  const reg = registry({
    'lists/aphorisms.json': json({ title: 'Aphorisms', icon: 'quotes', items: [{ id: 'l1', text: 'x' }] }),
    'lists/words.json': json({ title: 'Words', items: [] }),
  });
  const order = [];
  const save = reg.save, del = reg.del;
  reg.save = async (...a) => { order.push('save ' + a[0]); return save(...a); };
  reg.del = async (...a) => { order.push('del ' + a[0]); return del(...a); };
  const res = await L.move(reg, 'lists/aphorisms.json', 'lists/sayings.json',
    (items, header) => ({ items, header: { ...header, title: 'Sayings' } }), 'msg');
  assert.deepEqual(order, ['save lists/sayings.json', 'del lists/aphorisms.json']);
  assert.equal(res.path, 'lists/sayings.json');
  assert.deepEqual(JSON.parse(reg.S.files['lists/sayings.json']), { title: 'Sayings', icon: 'quotes', items: [{ id: 'l1', text: 'x' }] });
  await assert.rejects(L.move(reg, 'lists/sayings.json', 'lists/words.json', i => i, 'msg'), /already stored/);
  await assert.rejects(L.move(reg, 'lists/sayings.json', 'lists/todo.json', i => i, 'msg'), /built-in/);
  assert.ok('lists/sayings.json' in reg.S.files, 'a refused move leaves the list where it was');
});

test('remove deletes an empty list and refuses one with items', async () => {
  const reg = registry({
    'lists/empty.json': json({ title: 'Empty', items: [] }),
    'lists/full.json': json({ title: 'Full', items: [{ id: 'l1', text: 'x' }] }),
  });
  await L.remove(reg, 'lists/empty.json', 'msg');
  assert.deepEqual(reg.S.dels.map(d => d.path), ['lists/empty.json']);
  await assert.rejects(L.remove(reg, 'lists/full.json', 'msg'), /only an empty list/);
  await assert.rejects(L.remove(reg, 'lists/jots.json', 'msg'), /built-in/);
});

test('the built-in paths are the ones the Lists pane writes', () => {
  const src = readFileSync(path.join(repoRoot, 'lib/alpineComponents/estate.js'), 'utf8');
  const pane = Object.fromEntries([...src.matchAll(/const (TODO|JOTS|PINS)_PATH = '([^']+)'/g)].map(m => [m[1], m[2]]));
  assert.deepEqual(L.BUILT_IN.map(b => b.path), [pane.TODO, pane.JOTS, pane.PINS]);
});
