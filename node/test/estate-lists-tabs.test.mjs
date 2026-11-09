// alpineComponents/estate.js and app/index.html: the Lists view's tabs. Every
// list is a tab and one is open at a time; the open one is the shell's
// listsTab, stamped as &tab=, and the estate draws listOpen. Driven over a
// fake GH and a stubbed shell for the estate's side; the shell's route row is
// read from its source, as app-routes.test.mjs reads it, since the shell's
// component is an inline literal with no export.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, startAlpine } from './bootstrap.mjs';
import { repoRoot } from '../repo-root.mjs';

const REGISTRY = 'me/registry';
let FILES = {};
const notFound = () => Object.assign(new Error('404'), { status: 404 });

class FakeGH {
  static FRESH = { cache: 'no-store' };
  constructor(conf = {}) { this.repo = conf.repo || ''; this.ref = conf.ref || 'main'; }
  ago() { return 'recently'; }
  async repos() { return []; }
  async ls() { return []; }
  async get(name) {
    if (this.repo === REGISTRY && name in FILES) return { text: FILES[name] };
    throw notFound();
  }
  async req(p) {
    if (typeof p === 'string' && p.startsWith('/repos/'))
      return { default_branch: 'main', description: '', private: true, pushed_at: '' };
    if (p === 'contents/lists')
      return Object.keys(FILES).filter(f => f.startsWith('lists/')).map(f => ({ type: 'file', name: f.slice(6), path: f }));
    return {};
  }
  async save() { return {}; }
}

const { window, problems } = makeWindow({
  html: `<!doctype html><html><body>
    <div id="es" x-data="estate()"></div>
  </body></html>`,
});
window.TOKEN = 'tkn';
window.GH = FakeGH;
window.__shell = {
  REGISTRY_REPO: REGISTRY,
  DEFAULT_REPO: 'me/tools',
  quickLinks: [],
  hasToken: () => true,
  _authState: 'auth',
  refreshConfigCache() {},
  refreshActivity() {},
  listsTab: 'to-do',
  goListsTab(tab) { this.listsTab = tab; },
};

const Alpine = await startAlpine(window, [
  'lib/alpine-bundle.js',
  'lib/kits/surface.js',
  'lib/kits/lists.js',
  'lib/kits/notes.js',
  'lib/alpineComponents/estate.js',
]);

const data = Alpine.$data(window.document.getElementById('es'));
const reg = () => new FakeGH({ repo: REGISTRY });
const json = (v) => JSON.stringify(v);
const plain = (v) => JSON.parse(JSON.stringify(v));

async function seed(extra = {}) {
  window.__shell.listsTab = 'to-do';
  data.createdNew = false;
  FILES = {
    'lists/to-do.json': json({ items: [
      { id: 't1', text: 'flagged', urgent: true },
      { id: 't2', text: 'plain' },
      { id: 't3', text: 'finished', done: true },
    ] }),
    'lists/snag.json': json({ items: [
      { id: 's1', text: 'a render failed headless', seen: ['2026-10-20'] },
      { id: 's2', text: 'a link opened the wrong tab', seen: ['2026-10-21'] },
    ] }),
    'lists/useful-words.json': json({ title: 'Useful words and phrases', icon: 'book-open-text', items: [{ id: 'l1', text: 'appurtenance' }] }),
    'lists/aphorisms.json': json({ title: 'Aphorisms', icon: 'quotes', items: [] }),
    ...extra,
  };
  await data.loadTodos(reg());
  await data.loadSnags(reg());
  await data.loadCreatedLists(reg());
}

test('mounts with no startup warnings or errors', () => {
  assert.deepEqual(problems, []);
});

test('the tabs run To-do, Jot, Pin, Snag, Ping and Note, then the created lists by title', async () => {
  await seed();
  const tabs = plain(data.listTabs);
  assert.deepEqual(tabs.map(t => t.key), ['to-do', 'jot', 'pin', 'snag', 'ping', 'note', 'aphorisms', 'useful-words']);
  assert.deepEqual(tabs.filter(t => t.first).map(t => t.key), ['aphorisms'], 'the hairline sits before the first created list');
  assert.equal(tabs.find(t => t.key === 'useful-words').count, 1);
  assert.equal(tabs.find(t => t.key === 'to-do').count, 2, 'To-do counts its open items');
  assert.equal(tabs.find(t => t.key === 'to-do').hot, 1, 'and carries how many are hot');
});

test('a key no list answers to opens To-do, but not while the created lists are still read', async () => {
  await seed();
  window.__shell.listsTab = 'nope';
  assert.equal(data.listOpen, 'to-do');
  data.createdLoading = true;
  assert.equal(data.listOpen, 'nope', 'a link to a created list does not flash To-do first');
  data.createdLoading = false;
  window.__shell.listsTab = 'aphorisms';
  assert.equal(data.listOpen, 'aphorisms');
  assert.equal(data.listIsCreated, true);
  assert.equal(data.createdList.title, 'Aphorisms');
});

test('a created list named like a built-in tab takes -list, and a hand-named file its slug', async () => {
  await seed({
    'lists/ping.json': json({ title: 'Ping', items: [] }),
    'lists/My_Reading.json': json({ title: 'Reading', items: [] }),
  });
  const keys = plain(data.listTabs.map(t => t.key));
  assert.ok(keys.includes('ping-list'));
  assert.equal(keys.filter(k => k === 'ping').length, 1, 'the built-in Ping keeps its key');
  assert.ok(keys.includes('my-reading'));
  window.__shell.listsTab = 'my-reading';
  assert.equal(data.createdPick, 'lists/My_Reading.json');
});

test("a row's note button opens the Note tab on that item", async () => {
  await seed();
  data.noteOn('lists/to-do.json', { id: 't2' });
  assert.equal(window.__shell.listsTab, 'note');
  assert.equal(data.noteAbout, REGISTRY + ':lists/to-do.json#t2');
});

test('picking a tab closes the new-list form', async () => {
  await seed();
  data.openCreatedNew();
  assert.equal(data.createdNew, true);
  data.goList('snag');
  assert.equal(data.createdNew, false);
  assert.equal(window.__shell.listsTab, 'snag');
});

test("Snag's tab reads how many match while the add box filters", async () => {
  await seed();
  data.snagDraft = 'render';
  assert.equal(data.listTabs.find(t => t.key === 'snag').count, '1 of 2');
  data.snagDraft = '';
  assert.equal(data.listTabs.find(t => t.key === 'snag').count, 2);
});

// ── The shell's side: the route row and the two navigations ────────────────
const shell = readFileSync(path.join(repoRoot, 'app/index.html'), 'utf8');
const row = (() => {
  const at = shell.indexOf("{ key: 'lists',");
  assert.ok(at > 0, "the VIEWS row { key: 'lists', ... } was not found");
  return shell.slice(at, shell.indexOf("{ key: 'branches',", at));
})();

test('a Lists link opens the list it names, and the default stays out of the address', () => {
  assert.match(row, /open\(u\)\{ this\.goLists\(u\.tab\); \}/);
  assert.match(row, /if \(this\.listsTab && this\.listsTab !== LISTS_HOME\) p\.set\('tab', this\.listsTab\)/);
  assert.match(shell, /const LISTS_HOME = 'to-do';/);
});

test('the key is a slug, and a bare goLists keeps the open list', () => {
  const m = shell.match(/const LISTS_TAB = (\/.+\/);/);
  assert.ok(m, 'LISTS_TAB was not found');
  const re = new Function('return ' + m[1])();
  for (const ok of ['to-do', 'snag', 'useful-words', 'ping-list']) assert.ok(re.test(ok), ok);
  for (const bad of ['', 'Snag', '../x', 'a b', '-lead']) assert.ok(!re.test(bad), JSON.stringify(bad));
  assert.match(shell, /goLists\(tab\)\{\n\s+if \(tab !== undefined\) this\.listsTab = LISTS_TAB\.test\(tab\) \? tab : LISTS_HOME;/);
});
