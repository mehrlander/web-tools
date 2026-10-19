// alpineComponents/estate.js — the Lists pane's created lists (kits/lists.js):
// load (titled files only, built-ins and the autocorrect table left out),
// add, edit, delete with undo, check-off, creating a list and changing its
// settings, and deleting only an empty one. Driven over a fake GH and a
// stubbed shell; no network, no pixels.

import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWindow, startAlpine } from './bootstrap.mjs';

const REGISTRY = 'me/registry';

let FILES = {};    // "<path>" -> file text served from the registry
let SAVES = [];    // every save: { path, value, message }
let DELS = [];

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
  async req(path) {
    if (typeof path === 'string' && path.startsWith('/repos/'))
      return { default_branch: 'main', description: '', private: true, pushed_at: '' };
    if (path === 'contents/lists')
      return Object.keys(FILES).filter(f => f.startsWith('lists/')).map(f => ({ type: 'file', name: f.slice(6), path: f }));
    return {};
  }
  async save(path, value, message) {
    SAVES.push({ path, value, message });
    FILES[path] = JSON.stringify(value, null, 2);
    return {};
  }
  async del(path, message) { DELS.push({ path, message }); delete FILES[path]; return { deleted: true }; }
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
};

const Alpine = await startAlpine(window, [
  'lib/alpine-bundle.js',
  'lib/kits/surface.js',
  'lib/kits/lists.js',
  'lib/alpineComponents/estate.js',
]);

const data = Alpine.$data(window.document.getElementById('es'));
const reg = () => new FakeGH({ repo: REGISTRY });
const json = (v) => JSON.stringify(v);
const saved = (p) => JSON.parse(FILES[p]);

// Arrays built in the jsdom realm are not deepEqual to this realm's under
// strict mode, so a value read back from the component is copied across first.
const plain = (v) => JSON.parse(JSON.stringify(v));

function seed() {
  SAVES = []; DELS = [];
  data.createdPick = '';
  FILES = {
    'lists/todo.json': json({ items: [] }),
    'lists/jots.json': json({ items: [] }),
    'lists/autocorrect.json': json({ note: 'find and replace', items: [{ from: 'a', to: 'b' }] }),
    'lists/useful-words.json': json({ title: 'Useful words and phrases', icon: 'book-open-text',
      items: [{ id: 'l1', text: 'appurtenance', note: 'something that belongs to a larger thing', created_at: '2026-10-17T00:00:00Z' }] }),
    'lists/aphorisms.json': json({ title: 'Aphorisms', icon: 'quotes', kept: 'by hand',
      items: [{ id: 'l2', text: 'Testing beats guessing.', created_at: '2026-10-18T00:00:00Z' }] }),
  };
}

test('mounts with no startup warnings or errors', () => {
  assert.deepEqual(problems, []);
});

test('loadCreatedLists reads titled files only, sorted, and puts the first on screen', async () => {
  seed();
  data.createdPick = '';
  await data.loadCreatedLists(reg());
  assert.deepEqual(plain(data.createdLists.map(l => l.path)), ['lists/aphorisms.json', 'lists/useful-words.json']);
  assert.equal(data.createdPick, 'lists/aphorisms.json');
  assert.equal(data.createdList.icon, 'quotes');
  assert.equal(data.createdErr, '');
});

test('adding writes {id, text, note, created_at}, keeps the header, and clears the drafts', async () => {
  seed();
  await data.loadCreatedLists(reg());
  data.createdDraft = 'Reducing documentation is a virtue.';
  data.createdNoteDraft = 'A jot from 2026-08-31';
  await data.addToCreated();
  const file = saved('lists/aphorisms.json');
  assert.equal(file.kept, 'by hand', 'a key the pane does not know survives');
  const it = file.items[1];
  assert.match(it.id, /^l/);
  assert.equal(it.text, 'Reducing documentation is a virtue.');
  assert.equal(it.note, 'A jot from 2026-08-31');
  assert.ok(it.created_at);
  assert.equal(data.createdDraft, '');
  assert.equal(data.createdNoteDraft, '');
  assert.match(SAVES[0].message, /to Aphorisms via Web Tools$/);

  data.createdDraft = 'Without a note';
  await data.addToCreated();
  assert.ok(!('note' in saved('lists/aphorisms.json').items[2]), 'an empty note is absent, not empty');
});

test('a failed add puts both drafts back', async () => {
  seed();
  await data.loadCreatedLists(reg());
  const real = FakeGH.prototype.save;
  FakeGH.prototype.save = async () => { throw new Error('conflict'); };
  try {
    data.createdDraft = 'kept';
    data.createdNoteDraft = 'also kept';
    await data.addToCreated();
    assert.equal(data.createdDraft, 'kept');
    assert.equal(data.createdNoteDraft, 'also kept');
  } finally { FakeGH.prototype.save = real; }
});

test('an edit rewrites text and note, a cleared note goes, and an unchanged edit writes nothing', async () => {
  seed();
  await data.loadCreatedLists(reg());
  data.pickCreated(data.createdLists[1]);
  const list = data.createdList, it = list.items[0];
  data.startCreatedEdit(it);
  await data.commitCreatedEdit(list, it);
  assert.equal(SAVES.length, 0, 'opening and closing an edit leaves no commit');

  data.startCreatedEdit(it);
  data.editDraft = 'appurtenance (n.)';
  data.editNote = '';
  await data.commitCreatedEdit(list, it);
  const row = saved('lists/useful-words.json').items[0];
  assert.equal(row.text, 'appurtenance (n.)');
  assert.ok(!('note' in row));
  assert.equal(data.editId, null);
});

test('a delete offers an undo that puts the item back', async () => {
  seed();
  await data.loadCreatedLists(reg());
  const list = data.createdList;
  await data.deleteFromCreated(list, list.items[0]);
  assert.equal(saved('lists/aphorisms.json').items.length, 0);
  await data.takeUndo();
  assert.deepEqual(saved('lists/aphorisms.json').items.map(i => i.id), ['l2']);
});

test('check-off is off until the list turns it on, then done items sink below open ones', async () => {
  seed();
  await data.loadCreatedLists(reg());
  const list = data.createdList;
  assert.equal(data.createdHas(list, 'done'), false);

  data.toggleCreatedSettings();
  data.createdSetDone = true;
  await data.saveCreatedSettings();
  assert.deepEqual(saved('lists/aphorisms.json').capabilities, ['done']);
  assert.equal(data.createdHas(list, 'done'), true);

  data.createdDraft = 'second';
  await data.addToCreated();
  await data.toggleCreatedDone(list, list.items[0]);
  let first = saved('lists/aphorisms.json').items[0];
  assert.equal(first.done, true);
  assert.ok(first.done_at);
  assert.deepEqual(plain(data.createdRows(list).map(i => i.text)), ['second', 'Testing beats guessing.']);

  await data.toggleCreatedDone(list, list.items[0]);
  first = saved('lists/aphorisms.json').items[0];
  assert.ok(!('done' in first) && !('done_at' in first), 'reopening removes both keys');

  data.toggleCreatedSettings();
  data.createdSetDone = false;
  await data.saveCreatedSettings();
  assert.ok(!('capabilities' in saved('lists/aphorisms.json')), 'turning the last one off removes the key');
});

test('a rename moves the file to the new title\u2019s name, and a taken name is refused', async () => {
  seed();
  await data.loadCreatedLists(reg());
  data.toggleCreatedSettings();
  data.createdSetTitle = 'Sayings';
  data.createdSetIcon = 'chat-centered-text';
  await data.saveCreatedSettings();
  assert.ok(!('lists/aphorisms.json' in FILES), 'the old file is gone');
  const file = saved('lists/sayings.json');
  assert.equal(file.title, 'Sayings');
  assert.equal(file.icon, 'chat-centered-text');
  assert.equal(file.kept, 'by hand', 'the header rides along');
  assert.deepEqual(plain(file.items.map(i => i.id)), ['l2']);
  assert.equal(data.createdList.path, 'lists/sayings.json');
  assert.equal(data.createdPick, 'lists/sayings.json');
  assert.match(SAVES.at(-1).message, /^Rename the list "Aphorisms" to "Sayings"/);
  assert.deepEqual(plain(data.createdLists.map(l => l.title)), ['Sayings', 'Useful words and phrases']);

  // A case change keeps the same file name, so it is an edit in place.
  const before = DELS.length;
  data.toggleCreatedSettings();
  data.createdSetTitle = 'SAYINGS';
  await data.saveCreatedSettings();
  assert.equal(DELS.length, before);
  assert.equal(saved('lists/sayings.json').title, 'SAYINGS');

  // A title whose file name another list holds writes nothing.
  const saves = SAVES.length;
  data.toggleCreatedSettings();
  data.createdSetTitle = 'Useful words';   // lists/useful-words.json in this fixture
  await data.saveCreatedSettings();
  assert.equal(SAVES.length, saves);
  assert.equal(saved('lists/sayings.json').title, 'SAYINGS');
});

test('creating a list writes a titled empty file and puts it on screen; a taken title is refused', async () => {
  seed();
  await data.loadCreatedLists(reg());
  data.openCreatedNew();
  data.createdNewTitle = 'Groceries';
  data.createdNewIcon = 'shopping-cart';
  await data.createList();
  assert.deepEqual(saved('lists/groceries.json'), { title: 'Groceries', icon: 'shopping-cart', items: [] });
  assert.equal(data.createdPick, 'lists/groceries.json');
  assert.equal(data.createdNew, false);

  const before = SAVES.length;
  data.openCreatedNew();
  data.createdNewTitle = 'Aphorisms';
  await data.createList();
  assert.equal(SAVES.length, before, 'nothing written over the existing list');
  assert.equal(data.createdNew, true, 'the form stays open on a refusal');
});

test('only an empty list can be deleted', async () => {
  seed();
  await data.loadCreatedLists(reg());
  await data.deleteCreatedList();
  assert.equal(DELS.length, 0);
  FILES['lists/empty.json'] = json({ title: 'Empty', items: [] });
  await data.loadCreatedLists(reg());
  data.pickCreated(data.createdLists.find(l => l.path === 'lists/empty.json'));
  await data.deleteCreatedList();
  assert.deepEqual(DELS.map(d => d.path), ['lists/empty.json']);
  assert.ok(!data.createdLists.some(l => l.path === 'lists/empty.json'));
});

test('starting another edit commits an open created-list edit first', async () => {
  seed();
  FILES['lists/jots.json'] = json({ items: [{ id: 'j1', text: 'a jot', created_at: '2026-10-01T00:00:00Z' }] });
  await data.loadCreatedLists(reg());
  await data.loadJots(reg());
  const list = data.createdList, it = list.items[0];
  data.startCreatedEdit(it);
  data.editDraft = 'Testing beats guessing, usually.';
  data.startJotEdit(data.jotItems[0]);
  await new Promise(r => setTimeout(r, 0));
  assert.equal(saved('lists/aphorisms.json').items[0].text, 'Testing beats guessing, usually.');
  assert.equal(data.editId, 'j1');
  data.cancelEdit();
});

test('a note about a created-list item is labelled with the list and the item', async () => {
  seed();
  await data.loadCreatedLists(reg());
  assert.equal(data.aboutLabel(REGISTRY + ':lists/aphorisms.json#l2'), 'Aphorisms: Testing beats guessing.');
  assert.equal(data.aboutLabel(REGISTRY + ':lists/elsewhere.json#x'), REGISTRY + ':lists/elsewhere.json#x');
});

test('the jot writer keeps the file’s other top-level keys', async () => {
  seed();
  FILES['lists/jots.json'] = json({ owner: 'me', items: [] });
  data.jotDraft = 'an idea';
  await data.addJot();
  assert.equal(saved('lists/jots.json').owner, 'me');
  assert.equal(saved('lists/jots.json').items.length, 1);
});
