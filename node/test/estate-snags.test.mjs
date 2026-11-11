// alpineComponents/estate.js — the Lists pane's Snag list (kits/lists.js,
// lists/snag.json): load, last-bitten-first order, the add box filtering to a
// likely repeat, a new snag's id and repo, Again with its undo, an edit of the
// title and the entry, a delete with its undo, notes addressed to a snag under
// its new address and the docs/SNAGS.md one older notes carry, what a snag's
// card reads, and the entry rendered without letting markup through. Driven
// over a fake GH; no network, no pixels.

import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWindow, startAlpine } from './bootstrap.mjs';

const REGISTRY = 'me/registry';

let FILES = {};    // "<path>" -> file text served from the registry
let SAVES = [];    // every save: { path, value, message }
let FAIL = false;  // the next save throws

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
    if (FAIL) { FAIL = false; throw new Error('save refused'); }
    SAVES.push({ path, value, message });
    FILES[path] = JSON.stringify(value, null, 2);
    return {};
  }
  async del(path) { delete FILES[path]; return { deleted: true }; }
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
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
window.esc = s => String(s ?? '').replace(/[&<>"']/g, c => ESC[c]);

const Alpine = await startAlpine(window, [
  'lib/alpine-bundle.js',
  'lib/kits/surface.js',
  'lib/kits/repo-address.js',
  'lib/kits/notes.js',
  'lib/kits/lists.js',
  'lib/alpineComponents/estate.js',
]);

const data = Alpine.$data(window.document.getElementById('es'));
const reg = () => new FakeGH({ repo: REGISTRY });
const json = (v) => JSON.stringify(v);
const saved = () => JSON.parse(FILES['lists/snag.json']).items;
const ids = (xs) => [...xs].map(x => x.id);

const SNAGS = [
  { id: 'gate-skipped-the-new-folder', text: 'a gate skipped the folder added that day',
    note: 'The **gate** read a roster and the folder was not on it. See [`gate.yml`](https://github.com/o/r/blob/main/.github/workflows/gate.yml).',
    repo: 'mehrlander/web-tools', seen: ['2026-08-06', '2026-09-16'], targets: ['mehrlander/web-tools:.github/workflows/test.yml'],
    created_at: '2026-08-06T10:00:00.000Z' },
  { id: 'old-label-kept-on-a-button', text: 'a button kept its old label after the action changed',
    repo: 'mehrlander/web-tools', seen: ['2026-10-19'], created_at: '2026-10-19T20:00:00.000Z' },
  { id: 'copy-outlasted-its-source', text: 'a pasted copy outlasted the page it came from',
    repo: 'mehrlander/shortcut-tools', seen: ['2026-09-01'], created_at: '2026-09-01T09:00:00.000Z' },
];

async function seed(items = SNAGS) {
  SAVES = []; FAIL = false;
  data.snagDraft = ''; data.snagRepo = ''; data.editId = null; data.undoOffer = null;
  FILES = { 'lists/snag.json': json({ items }) };
  await data.loadSnags(reg());
}

test('mounts with no startup warnings or errors', () => {
  assert.deepEqual(problems, []);
});

test('loadSnags reads lists/snag.json; a missing file is an empty list, not an error', async () => {
  FILES = {};
  await data.loadSnags(reg());
  assert.equal(data.snagItems.length, 0);
  assert.equal(data.snagErr, '');
  await seed();
  assert.equal(data.snagItems.length, 3);
});

test('the snag file is a built-in list, never shown among the created ones', async () => {
  await seed();
  FILES['lists/snag.json'] = json({ title: 'Snag', items: SNAGS });
  await data.loadCreatedLists(reg());
  assert.ok(!data.createdLists.some(l => l.path === 'lists/snag.json'));
  const d = window.Lists.describe('lists/snag.json', {});
  assert.equal(d.builtIn, true);
  assert.deepEqual([...d.capabilities], ['seen', 'link']);
});

test('rows run last bitten first, and the add box keeps only the snags holding every typed word', async () => {
  await seed();
  assert.deepEqual(ids(data.snagRows), ['old-label-kept-on-a-button', 'gate-skipped-the-new-folder', 'copy-outlasted-its-source']);
  data.snagDraft = 'gate skipped folder';
  assert.deepEqual(ids(data.snagRows), ['gate-skipped-the-new-folder']);
  data.snagDraft = 'roster';                      // the entry is searched too
  assert.deepEqual(ids(data.snagRows), ['gate-skipped-the-new-folder']);
  data.snagDraft = 'a an';                       // words of two letters or fewer filter nothing
  assert.equal(data.snagRows.length, 3);
  data.snagDraft = '';
});

test('a new snag takes its id from its first six words, unique in the list, and is seen today', async () => {
  await seed();
  data.snagDraft = '  A gate skipped the folder added that day again  ';
  await data.addSnag();
  const it = saved().at(-1);
  assert.equal(it.id, 'a-gate-skipped-the-folder-added');
  assert.equal(it.text, 'A gate skipped the folder added that day again');
  assert.equal(it.repo, 'me/tools', 'the repo the app opens on, when none is picked');
  assert.deepEqual(it.seen, [data.todayYmd()]);
  assert.ok(it.created_at);
  assert.equal(data.snagDraft, '');
  assert.match(SAVES.at(-1).message, /^Snag "A gate skipped the folder added that day again" via Web Tools$/);

  data.snagDraft = 'A gate skipped the folder added later';
  data.snagRepo = 'mehrlander/web-tools';
  await data.addSnag();
  assert.equal(saved().at(-1).id, 'a-gate-skipped-the-folder-added-2');
  assert.equal(saved().at(-1).repo, 'mehrlander/web-tools');
});

test('a refused save puts the typed snag back in the box', async () => {
  await seed();
  data.snagDraft = 'lost on a refused save';
  FAIL = true;
  await data.addSnag();
  assert.equal(data.snagDraft, 'lost on a refused save');
  assert.equal(data.snagItems.length, 3, 'and the pane shows what the file holds');
});

test('Again adds today to a snag read fresh, and its undo takes back only that date', async () => {
  await seed();
  FILES['lists/snag.json'] = json({ items: [...SNAGS, { id: 'from-a-session', text: 'written elsewhere', repo: 'o/r', seen: ['2026-10-20'] }] });
  await data.againSnag(data.snagItems.find(x => x.id === 'gate-skipped-the-new-folder'));
  const it = saved().find(x => x.id === 'gate-skipped-the-new-folder');
  assert.deepEqual(it.seen, ['2026-08-06', '2026-09-16', data.todayYmd()]);
  assert.ok(saved().some(x => x.id === 'from-a-session'), 'a snag written since the pane loaded survives');
  assert.match(SAVES.at(-1).message, /^Again: "a gate skipped the folder added that day" via Web Tools$/);
  await data.takeUndo();
  assert.deepEqual(saved().find(x => x.id === 'gate-skipped-the-new-folder').seen, ['2026-08-06', '2026-09-16']);
  assert.ok(saved().some(x => x.id === 'from-a-session'));
});

test('an edit rewrites the title and the entry, a cleared entry is deleted, and no change writes nothing', async () => {
  await seed();
  const it = data.snagItems.find(x => x.id === 'gate-skipped-the-new-folder');
  data.startSnagEdit(it);
  assert.equal(data.snagOpen, it.id, 'editing opens the entry');
  data.editDraft = 'a gate skipped the folder added that day and the next';
  data.editNote = '';
  await data.commitSnagEdit(it);
  const after = saved().find(x => x.id === it.id);
  assert.equal(after.text, 'a gate skipped the folder added that day and the next');
  assert.equal('note' in after, false, 'cleared means absent, not empty');

  const n = SAVES.length;
  const same = data.snagItems.find(x => x.id === it.id);
  data.startSnagEdit(same);
  await data.commitSnagEdit(same);
  assert.equal(SAVES.length, n);
});

test('a delete offers an undo that puts the snag back where it was', async () => {
  await seed();
  await data.deleteSnag(data.snagItems.find(x => x.id === 'old-label-kept-on-a-button'));
  assert.deepEqual(ids(saved()), ['gate-skipped-the-new-folder', 'copy-outlasted-its-source']);
  await data.takeUndo();
  assert.deepEqual(ids(saved()), ids(SNAGS));
});

test('a note reaches a snag at its list address and at the docs/SNAGS.md address older notes carry', async () => {
  await seed();
  const it = data.snagItems.find(x => x.id === 'gate-skipped-the-new-folder');
  data.noteItems = [
    { id: 'n1', at: '2026-09-17T00:00:00Z', author: 'me', about: 'mehrlander/web-tools:docs/SNAGS.md#gate-skipped-the-new-folder', text: 'before the move' },
    { id: 'n2', at: '2026-10-20T00:00:00Z', author: 'me', about: REGISTRY + ':lists/snag.json#gate-skipped-the-new-folder', text: 'after' },
    { id: 'n3', at: '2026-10-20T00:00:00Z', author: 'me', about: 'mehrlander/shortcut-tools:docs/SNAGS.md#gate-skipped-the-new-folder', text: 'a different repo' },
  ];
  assert.equal(data.itemNotes(data.SNAG_PATH, it).length, 2);
  assert.equal(data.aboutLabel('mehrlander/web-tools:docs/SNAGS.md#gate-skipped-the-new-folder'), 'snag: a gate skipped the folder added that day');
  assert.equal(data.aboutLabel(REGISTRY + ':lists/snag.json#gate-skipped-the-new-folder'), 'snag: a gate skipped the folder added that day');
  assert.equal(data.aboutLabel('mehrlander/web-tools@main:docs/SNAGS.md#gate-skipped-the-new-folder'), 'snag: a gate skipped the folder added that day',
    'read as Notes.subject reads it, a ref and all');
  assert.equal(data.aboutLabel('mehrlander/shortcut-tools:docs/SNAGS.md#gate-skipped-the-new-folder'), 'snag: gate-skipped-the-new-folder',
    "another repo's snag of that id is not this one");

  // The Note tab opened on the snag lists what the count counted. It
  // filtered on the list address alone, so a snag whose notes all sit at the
  // old address showed a count and then an empty list.
  data.noteKind = '';
  data.noteAbout = data.itemAbout(data.SNAG_PATH, it);
  assert.deepEqual(ids(data.noteList), ['n2', 'n1'], 'both addresses, newest first');
  data.noteAbout = 'mehrlander/web-tools:docs/SNAGS.md#gate-skipped-the-new-folder';
  assert.deepEqual(ids(data.noteList), ['n2', 'n1'], 'and from the old address the same');
  data.noteAbout = 'mehrlander/web-tools';
  assert.deepEqual(ids(data.noteList), ['n1'], 'a prefix that names no snag is a prefix still');
  data.noteAbout = '';
  data.noteItems = [];
});

test('a card finds its snag by id, and draws the notes left on it at either address as rows', async () => {
  await seed();
  assert.deepEqual(ids(data.snagFor('old-label-kept-on-a-button')), ['old-label-kept-on-a-button']);
  assert.equal(data.snagFor('no-such-snag').length, 0, 'a card whose snag has gone draws nothing');
  assert.deepEqual([...data.snagIds], ids(data.snagRows));
  const it = data.snagItems.find(x => x.id === 'gate-skipped-the-new-folder');
  data.noteItems = [
    { id: 'n1', at: '2026-09-17T00:00:00Z', author: 'me', about: 'mehrlander/web-tools:docs/SNAGS.md#gate-skipped-the-new-folder', text: 'before the move' },
    { id: 'n2', at: '2026-09-18T00:00:00Z', author: 'me', about: 'note:n1', text: 'replied once' },
    { id: 'n3', at: '2026-10-20T00:00:00Z', author: 'me', about: REGISTRY + ':lists/snag.json#gate-skipped-the-new-folder', text: 'after' },
    { id: 'n4', at: '2026-10-21T00:00:00Z', author: 'me', about: 'mehrlander/web-tools', text: 'about the repo' },
  ];
  assert.equal(data.itemNotes(data.SNAG_PATH, it).map(n => n.id + n.depth).join(' '), 'n30 n10 n21');
  assert.equal(data.itemNotes(data.SNAG_PATH, data.snagItems.find(x => x.id === 'old-label-kept-on-a-button')).length, 0);
  data.noteItems = [];
});

test('an entry renders bold, code and links, and lets no markup through', () => {
  const html = data.snagHtml('The **push** ran `a *b* c` and [`x.yml`](https://e.x/y) <script>.\n\nA *second* paragraph.');
  assert.match(html, /<strong>push<\/strong>/);
  assert.match(html, /<code class="font-mono text-sm">a \*b\* c<\/code>/, 'an asterisk inside code stays one');
  assert.match(html, /<a href="https:\/\/e.x\/y"[^>]*><code[^>]*>x.yml<\/code><\/a>/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /<em>second<\/em>/);
  assert.equal((html.match(/<p /g) || []).length, 2);
});

test('the dates a snag bit read once each, with a count for a busy day', () => {
  assert.equal(data.snagSeenLabel({ seen: ['2026-09-10', '2026-09-14', '2026-09-14', '2026-09-14'] }), '2026-09-10, 2026-09-14 ×3');
});
