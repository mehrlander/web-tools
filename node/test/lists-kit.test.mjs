// kits/lists.js: the registry's lists/ folder as one kind of file. What breaks
// without these: a write that drops the keys describing a list, a dropped
// connection read as an empty list and saved over the real one, a stray file
// (the dictate page's autocorrect table) shown as a list, a created list
// claiming a capability the pane cannot render for it, a list created over an
// existing file, a list deleted with its items still in it, a built-in list
// lost or left behind in its old file when it moved to its new name, two
// quick writes where a lagging read drops the first, and a row titled by a
// statement two lines long where the item has a short name.

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
  await L.append(reg, 'lists/notes-to-self.json', { id: 'j1', text: 'first' }, 'msg');
  assert.deepEqual(reg.S.saves[0].value, { items: [{ id: 'j1', text: 'first' }] });

  const down = registry({ 'lists/jot.json': json({ items: [{ id: 'j0', text: 'keep me' }] }) }, { fail: new Set(['lists/jot.json']) });
  await assert.rejects(L.append(down, 'lists/jot.json', { id: 'j1', text: 'new' }, 'msg'), /Load failed/);
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
    'lists/to-do.json': json({ title: 'To-do', items: [] }),
    'lists/jot.json': json({ items: [] }),
    'lists/pin.json': json({ title: 'Pin', items: [] }),
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
  assert.deepEqual(L.describe('lists/to-do.json', {}).capabilities, ['done', 'due']);
  assert.equal(L.describe('lists/to-do.json', {}).title, 'To-do');
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

test('an item is named by its own name, and without one by its id read as words', () => {
  assert.equal(L.itemName({ id: 'a-count-off-by-one', text: 'the row count was off by one after a sort' }), 'A count off by one');
  assert.equal(L.itemName({ id: 'a-count-off-by-one', name: '  Off by one  ' }), 'Off by one', 'its own name, trimmed');
  assert.equal(L.itemName({ id: 'a-count-off-by-one', name: '   ' }), 'A count off by one', 'a blank name is no name');
  assert.equal(L.itemName({ id: 'a-count-off-by-one', name: 7 }), 'A count off by one', 'nor is one that is not text');
  assert.equal(L.itemName({ id: '404-read-as-empty' }), '404 read as empty', 'a digit has no capital');
  assert.equal(L.itemName({ id: 'a-gate--skipped-2' }), 'A gate skipped 2', 'a doubled hyphen is one space');
  assert.equal(L.itemName({ id: 'lmf3k2a9' }), 'Lmf3k2a9', 'an id that is no slug reads as it is');
  assert.equal(L.itemName({ id: 12 }), '12');
  assert.equal(L.itemName({}), '');
  assert.equal(L.itemName(null), '');
});

test('create names the file from the title, refuses a taken path, and refuses a built-in', async () => {
  const reg = registry({ 'lists/aphorisms.json': json({ title: 'Aphorisms', items: [] }) });
  const list = await L.create(reg, { title: 'Useful words & phrases', icon: 'book-open-text', capabilities: ['done', 'link'] });
  assert.equal(list.path, 'lists/useful-words-phrases.json');
  assert.deepEqual(reg.S.saves[0].value, { title: 'Useful words & phrases', icon: 'book-open-text', capabilities: ['done'], items: [] });
  await assert.rejects(L.create(reg, { title: 'Aphorisms' }), /already stored/);
  await assert.rejects(L.create(reg, { title: 'To-do' }), /built-in/);
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
  await assert.rejects(L.move(reg, 'lists/sayings.json', 'lists/to-do.json', i => i, 'msg'), /built-in/);
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
  await assert.rejects(L.remove(reg, 'lists/jot.json', 'msg'), /built-in/);
});

test('the built-in paths are the ones the Lists pane writes, each named for its list', () => {
  const src = readFileSync(path.join(repoRoot, 'lib/alpineComponents/estate.js'), 'utf8');
  const pane = Object.fromEntries([...src.matchAll(/const (TODO|JOT|PIN|SNAG)_PATH = '([^']+)'/g)].map(m => [m[1], m[2]]));
  assert.deepEqual(L.BUILT_IN.map(b => b.path), [pane.TODO, pane.JOT, pane.PIN, pane.SNAG]);
  for (const b of L.BUILT_IN) assert.equal(b.path, L.pathFor(b.title), b.title);
});

// A registry that answers like GitHub: every save returns the new blob sha,
// and `lag` makes a read return the copy from before the newest save.
function lagging(files = {}) {
  const reg = registry(files);
  const shas = {}, prior = {};
  let n = 0;
  reg.lag = false;
  const get = reg.get, save = reg.save;
  reg.get = async (p, opts) => {
    if (reg.lag && p in prior) { reg.S.reads.push({ path: p, opts }); return prior[p]; }
    const r = await get(p, opts);
    return { ...r, sha: shas[p] || 'base-' + p };
  };
  reg.save = async (p, value, message) => {
    prior[p] = p in reg.S.files ? { text: reg.S.files[p], sha: shas[p] || 'base-' + p } : undefined;
    if (!prior[p]) delete prior[p];
    await save(p, value, message);
    shas[p] = 'sha' + (++n);
    return { content: { sha: shas[p] } };
  };
  // A write from another page or tab.
  reg.elsewhere = (p, text) => { reg.S.files[p] = text; shas[p] = 'sha' + (++n); delete prior[p]; };
  return reg;
}

test('two quick writes both land: they queue, and a read that lags behind this page\'s write is not believed', async () => {
  const reg = lagging({ 'lists/to-do.json': json({ items: [{ id: 't1', text: 'a' }] }) });
  const first = L.append(reg, 'lists/to-do.json', { id: 't2', text: 'b' }, 'msg');
  reg.lag = true;   // from here on, a read is served the copy before the newest save
  const second = L.append(reg, 'lists/to-do.json', { id: 't3', text: 'c' }, 'msg');
  await Promise.all([first, second]);
  assert.deepEqual(JSON.parse(reg.S.files['lists/to-do.json']).items.map(i => i.id), ['t1', 't2', 't3']);

  // A newer write from elsewhere carries a sha this page never saw, and wins.
  reg.lag = false;
  reg.elsewhere('lists/to-do.json', json({ items: [{ id: 'tX', text: 'from a phone' }] }));
  const res = await L.append(reg, 'lists/to-do.json', { id: 't4', text: 'd' }, 'msg');
  assert.deepEqual(res.items.map(i => i.id), ['tX', 't4']);
});

test("an item's flair is one icon for each facet value the table marks, and nothing for the rest", () => {
  assert.deepEqual(L.flair({ id: 'a', kind: 'technical', origin: 'owner' }).map(f => [f.facet, f.icon]),
    [['kind', 'ph-bug'], ['origin', 'ph-user']]);
  assert.deepEqual(L.flair({ id: 'a', kind: 'technical' }).map(f => f.icon), ['ph-bug']);
  assert.deepEqual(L.flair({ id: 'a', kind: 'behavior', origin: 'session' }), [], 'the unmarked value of each facet');
  assert.deepEqual(L.flair({ id: 'a', kind: 'behavior', origin: 'owner' }).map(f => f.icon), ['ph-user']);
  assert.equal(L.flair({ id: 'a', kind: 'technical' })[0].tip, 'Technical: something broke');
  assert.deepEqual(L.flair({ id: 'a' }), [], 'an item that declares no facet');
  assert.deepEqual(L.flair({ id: 'a', kind: 'toString', origin: 'elsewhere' }), [], 'a value the table lacks');
  assert.deepEqual(L.flair(null), []);
});

test("a name Gemini gave is used only for the text it was written for, and an item's own name comes first", () => {
  // The key is FNV-1a over UTF-8; web-tools-private's sessions/tools/test-list-names.py holds the same three values.
  assert.equal(L.textKey('abc'), '1a47e90b');
  assert.equal(L.textKey('  abc \n'), '1a47e90b', 'trimmed');
  assert.equal(L.textKey('café, naïve'), 'fbf36113', 'UTF-8 bytes');
  assert.equal(L.textKey(''), '811c9dc5');

  const it = { id: 'j1', text: 'a thought that runs well past four words' };
  const doc = { lists: { jot: { j1: { name: 'A long thought', key: L.textKey(it.text) }, j2: { name: '', key: 'x' } } } };
  assert.equal(L.givenName(doc, 'jot', it), 'A long thought');
  assert.equal(L.givenName(doc, 'jot', { ...it, text: it.text + ', edited' }), '', 'an edited item has no name until it is named again');
  assert.equal(L.givenName(doc, 'jot', { ...it, name: ' Mine ' }), 'Mine', "the item's own name first");
  assert.equal(L.givenName(doc, 'to-do', it), '', 'another list');
  assert.equal(L.givenName(doc, 'jot', { id: 'j2', text: 'short' }), '', 'an item recorded as needing no name');
  assert.equal(L.givenName(null, 'jot', it), '', 'no file');
  assert.equal(L.givenName({ lists: { jot: { j1: { name: 7, key: L.textKey(it.text) } } } }, 'jot', it), '', 'a name that is not text');
});
