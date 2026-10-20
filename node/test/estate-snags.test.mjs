// alpineComponents/estate.js — the Lists pane's Snag list (kits/lists.js,
// lists/snag.json): load, last-bitten-first order, the add box filtering to a
// likely repeat, a new snag's id and repo, Again with its undo, an edit of the
// title and the entry, a delete with its undo, notes addressed to a snag under
// its new address and the docs/SNAGS.md one older notes carry, and the entry
// rendered without letting markup through. Driven over a fake GH; no network,
// no pixels.

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
  { id: 'ci-run-silently-not-started', text: 'a commit sat in an open PR with no checks',
    note: 'The **push** landed and no run started. See [`test.yml`](https://github.com/o/r/blob/main/.github/workflows/test.yml).',
    repo: 'mehrlander/web-tools', seen: ['2026-08-06', '2026-09-16'], targets: ['mehrlander/web-tools:.github/workflows/test.yml'],
    created_at: '2026-08-06T10:00:00.000Z' },
  { id: 'rename-called-not-worth-it', text: 'a stale file name was kept because renaming it was called a migration',
    repo: 'mehrlander/web-tools', seen: ['2026-10-19'], created_at: '2026-10-19T20:00:00.000Z' },
  { id: 'branch-install-outlived-the-merge', text: 'a shortcut installed from a branch outlived the merge',
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
  assert.deepEqual(ids(data.snagRows), ['rename-called-not-worth-it', 'ci-run-silently-not-started', 'branch-install-outlived-the-merge']);
  data.snagDraft = 'open PR checks';
  assert.deepEqual(ids(data.snagRows), ['ci-run-silently-not-started']);
  data.snagDraft = 'push';                       // the entry is searched too
  assert.deepEqual(ids(data.snagRows), ['ci-run-silently-not-started']);
  data.snagDraft = 'a an';                       // words of two letters or fewer filter nothing
  assert.equal(data.snagRows.length, 3);
  data.snagDraft = '';
});

test('a new snag takes its id from its first six words, unique in the list, and is seen today', async () => {
  await seed();
  data.snagDraft = '  A commit sat in an open PR with no checks again  ';
  await data.addSnag();
  const it = saved().at(-1);
  assert.equal(it.id, 'a-commit-sat-in-an-open');
  assert.equal(it.text, 'A commit sat in an open PR with no checks again');
  assert.equal(it.repo, 'me/tools', 'the repo the app opens on, when none is picked');
  assert.deepEqual(it.seen, [data.todayYmd()]);
  assert.ok(it.created_at);
  assert.equal(data.snagDraft, '');
  assert.match(SAVES.at(-1).message, /^Snag "A commit sat in an open PR with no checks again" via Web Tools$/);

  data.snagDraft = 'A commit sat in an open door';
  data.snagRepo = 'mehrlander/web-tools';
  await data.addSnag();
  assert.equal(saved().at(-1).id, 'a-commit-sat-in-an-open-2');
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
  await data.againSnag(data.snagItems.find(x => x.id === 'ci-run-silently-not-started'));
  const it = saved().find(x => x.id === 'ci-run-silently-not-started');
  assert.deepEqual(it.seen, ['2026-08-06', '2026-09-16', data.todayYmd()]);
  assert.ok(saved().some(x => x.id === 'from-a-session'), 'a snag written since the pane loaded survives');
  assert.match(SAVES.at(-1).message, /^Again: "a commit sat in an open PR with no checks" via Web Tools$/);
  await data.takeUndo();
  assert.deepEqual(saved().find(x => x.id === 'ci-run-silently-not-started').seen, ['2026-08-06', '2026-09-16']);
  assert.ok(saved().some(x => x.id === 'from-a-session'));
});

test('an edit rewrites the title and the entry, a cleared entry is deleted, and no change writes nothing', async () => {
  await seed();
  const it = data.snagItems.find(x => x.id === 'ci-run-silently-not-started');
  data.startSnagEdit(it);
  assert.equal(data.snagOpen, it.id, 'editing opens the entry');
  data.editDraft = 'a commit sat in an open PR with no checks at all';
  data.editNote = '';
  await data.commitSnagEdit(it);
  const after = saved().find(x => x.id === it.id);
  assert.equal(after.text, 'a commit sat in an open PR with no checks at all');
  assert.equal('note' in after, false, 'cleared means absent, not empty');

  const n = SAVES.length;
  const same = data.snagItems.find(x => x.id === it.id);
  data.startSnagEdit(same);
  await data.commitSnagEdit(same);
  assert.equal(SAVES.length, n);
});

test('a delete offers an undo that puts the snag back where it was', async () => {
  await seed();
  await data.deleteSnag(data.snagItems.find(x => x.id === 'rename-called-not-worth-it'));
  assert.deepEqual(ids(saved()), ['ci-run-silently-not-started', 'branch-install-outlived-the-merge']);
  await data.takeUndo();
  assert.deepEqual(ids(saved()), ids(SNAGS));
});

test('a note reaches a snag at its list address and at the docs/SNAGS.md address older notes carry', async () => {
  await seed();
  const it = data.snagItems.find(x => x.id === 'ci-run-silently-not-started');
  data.noteItems = [
    { id: 'n1', at: '2026-09-17T00:00:00Z', author: 'me', about: 'mehrlander/web-tools:docs/SNAGS.md#ci-run-silently-not-started', text: 'before the move' },
    { id: 'n2', at: '2026-10-20T00:00:00Z', author: 'me', about: REGISTRY + ':lists/snag.json#ci-run-silently-not-started', text: 'after' },
    { id: 'n3', at: '2026-10-20T00:00:00Z', author: 'me', about: 'mehrlander/shortcut-tools:docs/SNAGS.md#ci-run-silently-not-started', text: 'a different repo' },
  ];
  assert.equal(data.notesOn(data.SNAG_PATH, it), 2);
  assert.equal(data.aboutLabel('mehrlander/web-tools:docs/SNAGS.md#ci-run-silently-not-started'), 'snag: a commit sat in an open PR with no checks');
  assert.equal(data.aboutLabel(REGISTRY + ':lists/snag.json#ci-run-silently-not-started'), 'snag: a commit sat in an open PR with no checks');
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
