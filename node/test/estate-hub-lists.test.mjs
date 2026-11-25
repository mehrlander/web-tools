// alpineComponents/estate.js: the Lists view reads the hub's lists/ (the app's
// own repo, the shell's DEFAULT_REPO) beside the registry's, as web-tools keeps
// the house policies and the peeves there. What breaks without these: a hub
// list missing from the view, an edit to one written into the registry
// instead, a note about one of its items addressed to the registry, a
// proposed list that does not say so, and a rename that moves a file the
// builders read at its path. Driven over a fake GH that serves each repo its
// own files; no network, no pixels.

import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWindow, startAlpine } from './bootstrap.mjs';

const REGISTRY = 'me/registry', HUB = 'me/tools';

let FILES = {};    // repo -> { path -> file text }
let SAVES = [];    // every save: { repo, path, value, message }

const notFound = () => Object.assign(new Error('404'), { status: 404 });

class FakeGH {
  static FRESH = { cache: 'no-store' };
  constructor(conf = {}) { this.repo = conf.repo || ''; this.ref = conf.ref || 'main'; }
  ago() { return 'recently'; }
  async repos() { return []; }
  async ls() { return []; }
  async get(name) {
    const files = FILES[this.repo] || {};
    if (name in files) return { text: files[name] };
    throw notFound();
  }
  async req(path) {
    if (typeof path === 'string' && path.startsWith('/repos/'))
      return { default_branch: 'main', description: '', private: true, pushed_at: '' };
    if (path === 'contents/lists')
      return Object.keys(FILES[this.repo] || {}).filter(f => f.startsWith('lists/')).map(f => ({ type: 'file', name: f.slice(6), path: f }));
    return {};
  }
  async save(path, value, message) {
    SAVES.push({ repo: this.repo, path, value, message });
    (FILES[this.repo] ||= {})[path] = JSON.stringify(value, null, 2);
    return {};
  }
  async del() { throw new Error('no delete expected'); }
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
  DEFAULT_REPO: HUB,
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
  'lib/kits/notes.js',
  'lib/kits/lists.js',
  'lib/alpineComponents/estate.js',
]);

const data = Alpine.$data(window.document.getElementById('es'));
const json = (v) => JSON.stringify(v);
const plain = (v) => JSON.parse(JSON.stringify(v));

function seed() {
  SAVES = [];
  FILES = {
    [REGISTRY]: {
      'lists/aphorisms.json': json({ title: 'Aphorisms', icon: 'quotes', items: [{ id: 'l1', text: 'Testing beats guessing.' }] }),
    },
    [HUB]: {
      'lists/house-policies.json': json({ title: 'House policies', icon: 'scales', edit: 'propose', show_id: true, id_prefix: 'h:', note: 'lead',
        items: [{ id: 'qualify', text: 'Qualified writing', group: 'Writing', note: 'Write clearly.' }] }),
    },
  };
}

test('mounts with no startup warnings or errors', () => {
  assert.deepEqual(problems, []);
});

test('the hub\'s lists load beside the registry\'s, each tagged with its repo, in title order', async () => {
  seed();
  await data.loadCreatedLists(new FakeGH({ repo: REGISTRY }));
  assert.deepEqual(plain(data.createdLists.map(l => [l.path, l.repo])),
    [['lists/aphorisms.json', REGISTRY], ['lists/house-policies.json', HUB]]);
  assert.equal(data.createdErr, '');
});

test('a proposed list says so, and an edit to it is written to the hub', async () => {
  seed();
  await data.loadCreatedLists(new FakeGH({ repo: REGISTRY }));
  data.goList('house-policies');
  const list = data.createdList;
  assert.equal(data.listProposed(list), true);
  assert.equal(data.listProposed(data.createdLists[0]), false);
  assert.equal(data.listRepo(list), HUB);
  assert.match(data.listUrl(list.path, data.listRepo(list)), /me\/tools/);

  const it = list.items[0];
  data.startCreatedEdit(it);
  data.editDraft = 'Qualified writing (rule)';
  await data.commitCreatedEdit(list, it);
  assert.deepEqual(plain(SAVES.map(s => [s.repo, s.path])), [[HUB, 'lists/house-policies.json']]);
  const file = JSON.parse(FILES[HUB]['lists/house-policies.json']);
  assert.equal(file.edit, 'propose', 'the header survives the write');
  assert.equal(file.items[0].group, 'Writing', 'an item key the pane does not know survives');
});

test('a note about a hub list\'s item names the hub, and finds its way back to the tab', async () => {
  seed();
  await data.loadCreatedLists(new FakeGH({ repo: REGISTRY }));
  const list = data.createdLists.find(l => l.repo === HUB);
  const about = data.itemAbout(list.path, list.items[0], data.listRepo(list));
  assert.match(about, /^me\/tools:/);
  assert.equal(data.listTabOf(window.Notes.subject(about)), 'house-policies');
});

test('renaming a proposed list keeps its file where the builders read it', async () => {
  seed();
  await data.loadCreatedLists(new FakeGH({ repo: REGISTRY }));
  data.goList('house-policies');
  data.toggleCreatedSettings();
  data.createdSetTitle = 'Policies';
  await data.saveCreatedSettings();
  assert.deepEqual(plain(SAVES.map(s => [s.repo, s.path])), [[HUB, 'lists/house-policies.json']]);
  assert.equal(JSON.parse(FILES[HUB]['lists/house-policies.json']).title, 'Policies');
});

test('a list whose header sets show_id labels each item with its prefixed id, and others show none', async () => {
  seed();
  await data.loadCreatedLists(new FakeGH({ repo: REGISTRY }));
  const [aph, hp] = data.createdLists;
  assert.equal(data.createdIdLabel(hp, hp.items[0]), 'h:qualify');
  assert.equal(data.createdIdLabel(aph, aph.items[0]), '');
});
