// alpineComponents/estate.js with kits/linked-swiper.js: the Lists view's Snag
// and Note tabs as a list over a strip of cards. What breaks without these: a
// tab that opens on bare rows because its strip was asked for a frame before
// x-show revealed it, a row tap that leaves the card on the last snag, a card
// that keeps a written item's old text, a control the flat rows had that the
// card dropped (Again, Edit, Delete, a row's notes, Reply), a delete that
// throws the reader back to the top of the list, and a chip that narrows the
// list under a card it no longer holds. jsdom has no layout, so the strip's
// geometry is stubbed as the swipe-deck tests stub it; the pixels are the
// headless scenarios' business. Every snag and note here is invented.

import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWindow, startAlpine, deckGeometry } from './bootstrap.mjs';

const REGISTRY = 'me/registry';
const NOTES = 'notes/notes.jsonl';

let FILES = {};   // "<path>" -> file text served from the registry
let SAVES = [];   // every list save: { path, value, message }
let NOTE_SHA = 0;

class FakeGH {
  static FRESH = { cache: 'no-store' };
  static toBase64 = (s) => Buffer.from(s).toString('base64');
  // An age that reads as its date, so a row's meta can be told apart.
  static ago = (iso) => (iso ? 'on ' + String(iso).slice(0, 10) : '');
  constructor(conf = {}) { this.repo = conf.repo || ''; this.ref = conf.ref || 'main'; }
  ago(iso) { return FakeGH.ago(iso); }
  async repos() { return []; }
  async ls() { return []; }
  async get(name) {
    if (this.repo === REGISTRY && name in FILES) return { text: FILES[name], sha: 's' + NOTE_SHA };
    throw Object.assign(new Error('404'), { status: 404 });
  }
  async req(path, opts) {
    if (path === '/user') return { login: 'me' };
    if (path === 'contents/' + NOTES && opts?.method === 'PUT') {
      FILES[NOTES] = Buffer.from(JSON.parse(opts.body).content, 'base64').toString();
      return { content: { sha: 's' + ++NOTE_SHA } };
    }
    if (typeof path === 'string' && path.startsWith('/repos/'))
      return { default_branch: 'main', description: '', private: true, pushed_at: '' };
    return {};
  }
  async save(path, value, message) {
    SAVES.push({ path, value, message });
    FILES[path] = JSON.stringify(value, null, 2);
    return {};
  }
}

const { window, problems } = makeWindow({
  html: `<!doctype html><html><body><div id="es" x-data="estate()"></div></body></html>`,
});
deckGeometry(window);
// A frame as a browser runs it: one callback at a time, each finishing its
// promise jobs before the next begins. jsdom runs a frame's callbacks back to
// back, so a hide Alpine queued lands after the show that followed it and the
// element stays hidden.
window.requestAnimationFrame = global.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 16);
window.cancelAnimationFrame = global.cancelAnimationFrame = (id) => clearTimeout(id);
// A shown element has a box, which is how listMount tells an open tab from a
// hidden one. An element x-show has hidden, or one under it, has none, and
// Alpine reveals it a frame after the state changes, as a browser sees it.
// BOXLESS holds every box back, for a reveal that takes longer.
let BOXLESS = false;
const hiddenBy = (el) => { for (let e = el; e && e.style; e = e.parentElement) if (e.style.display === 'none') return true; return false; };
window.Element.prototype.getClientRects = function () { return this.isConnected && !BOXLESS && !hiddenBy(this) ? [{}] : []; };
window.TOKEN = 'tkn';
window.GH = FakeGH;
window.__shell = {
  REGISTRY_REPO: REGISTRY, DEFAULT_REPO: 'o/tools', quickLinks: [],
  hasToken: () => true, _authState: 'auth', refreshConfigCache() {}, refreshActivity() {},
  view: 'lists', listsTab: 'snag', goListsTab(tab) { this.listsTab = tab; },
};
// The shell is reactive on the page, so a tab change alone redraws the pane.
window.document.addEventListener('alpine:init', () => { window.__shell = window.Alpine.reactive(window.__shell); });

const Alpine = await startAlpine(window, [
  'lib/vanilla-bundle.js',
  'lib/alpine-bundle.js',
  'lib/kits/surface.js',
  'lib/kits/repo-address.js',
  'lib/kits/notes.js',
  'lib/kits/findings.js',
  'lib/kits/lists.js',
  'lib/kits/swipe-deck.js',
  'lib/kits/linked-swiper.js',
  'lib/alpineComponents/estate.js',
]);
const doc = window.document;
const data = Alpine.$data(doc.getElementById('es'));
const reg = () => new FakeGH({ repo: REGISTRY });
// The strip settles over a few animation frames and Alpine flushes between
// them, so every step waits for what it expects to see, never for a count of
// milliseconds: a fixed wait is a guess that fails when the machine is busy.
async function until(check, what, ms = 8000) {
  const t0 = Date.now();
  for (;;) {
    let ok = false;
    try { ok = !!check(); } catch { ok = false; }
    if (ok) return;
    if (Date.now() - t0 > ms) assert.fail('timed out waiting for ' + what);
    await new Promise(r => setTimeout(r, 10));
  }
}
// What a reader sees: the text of everything x-show has not hidden.
const text = (el) => {
  if (!el) return '';
  const copy = el.cloneNode(true);
  for (const hidden of copy.querySelectorAll('[style*="display: none"]')) hidden.remove();
  return copy.textContent.replace(/\s+/g, ' ').trim();
};
const click = (el) => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
const line = (o) => JSON.stringify(o) + '\n';

const SNAGS = [
  { id: 'a-count-off-by-one', text: 'the row count was off by one after a sort', note: 'The **sort** ran before the last row arrived.',
    repo: 'o/tools', seen: ['2026-10-01', '2026-10-03'], targets: ['o/tools:python/scan.py', 'o/tools:node/test/scan.test.mjs'],
    created_at: '2026-10-01T10:00:00.000Z' },
  { id: 'a-door-left-open', text: 'a panel stayed open behind the next one', repo: 'o/tools', seen: ['2026-10-02'], created_at: '2026-10-02T10:00:00.000Z' },
  { id: 'a-third-thing', text: 'a third thing went wrong', repo: 'o/other', seen: ['2026-09-01'], created_at: '2026-09-01T10:00:00.000Z' },
];
const NOTE_LINES = [
  { id: 'n1', at: '2026-10-04T00:00:00Z', author: 'me', about: 'o/tools:docs/SNAGS.md#a-count-off-by-one', text: 'Seen again on the phone.' },
  { id: 'n2', at: '2026-10-05T00:00:00Z', author: 'claude/x', about: 'note:n1', text: 'Fixed by the gate.' },
  { id: 'n3', at: '2026-10-06T00:00:00Z', author: 'me', about: 'o/tools#12', text: 'Merged cleanly. Nothing else to do.' },
  { id: 'n4', at: '2026-10-07T00:00:00Z', author: 'claude/weed', about: 'o/tools@claude/a-branch', text: 'The branch holds nothing main lacks.',
    finding: { kind: 'superseded', subjects: ['o/tools@claude/a-branch', 'o/tools#12'], why: 'Its one commit is on main.' } },
];

const roots = () => [...doc.querySelectorAll('[data-pattern="list-detail"]')];
const rootOf = (tab) => roots()[tab === 'snag' ? 0 : 1];
const snagRoot = () => rootOf('snag');
const noteRoot = () => rootOf('note');
const rowIds = (tab) => [...rootOf(tab).querySelectorAll(`[data-part="list"] [data-${tab}]`)].map(r => r.getAttribute('data-' + tab));
const selected = (tab) => [...rootOf(tab).querySelectorAll('[aria-selected="true"]')].map(r => r.getAttribute('data-' + tab));
const head = (tab) => rootOf(tab).querySelector('[data-ls="head"]');
// A row's card: the strip's slide at that row's place in the list.
const cardOf = (tab, id) => rootOf(tab).querySelector('.sd-track')?.children[rowIds(tab).indexOf(id)];
const picked = (tab) => (tab === 'snag' ? data.snagOpen : data.noteOpen);
const frames = (n) => new Promise(done => { const step = () => (n-- > 0 ? window.requestAnimationFrame(step) : done()); step(); });
// The strip is on a row: the component, the list's mark, the track and the
// drawn card agree, and still agree some frames on. The frames matter: the
// kit reads the track's place a frame after it scrolls, so a step taken
// inside that frame would be answered with the row the strip just left.
async function shown(tab, id) {
  const on = () => picked(tab) === id && selected(tab).join() === id && text(head(tab)) && text(cardOf(tab, id))
    && rootOf(tab).querySelector('.sd-track').scrollLeft === rowIds(tab).indexOf(id);
  for (;;) {
    await until(on, `the ${tab} strip on ${id}`);
    await frames(3);
    if (on()) return;
  }
}

// Fresh files, read into the pane.
async function load() {
  SAVES = [];
  FILES = { 'lists/snag.json': JSON.stringify({ items: SNAGS }), [NOTES]: NOTE_LINES.map(line).join('') };
  data.snagDraft = ''; data.editId = null; data.undoOffer = null; data.replyTo = null;
  data.noteAbout = ''; data.noteKind = '';
  await data.loadSnags(reg());
  await data.loadNotes(reg());
}
const track = (tab) => rootOf(tab)?.querySelector('.sd-track');
// Show a tab. One come back to builds its strip again, a frame or two after it
// is revealed, and a tap before that would be answered by the strip it
// replaces: wait for the new one.
async function go(tab) {
  const old = window.__shell.listsTab !== tab && track(tab);
  window.__shell.listsTab = tab;
  if (old) await until(() => track(tab) !== old, `the ${tab} strip to be built again`);
}
// Open a tab on fresh files, then tap a row if one is named.
async function open(tab, row = '') {
  const there = go(tab);
  await load();
  await there;
  await until(() => rowIds(tab).length === 3 && rowIds(tab).includes(picked(tab)), `the ${tab} strip to mount`);
  await shown(tab, picked(tab));
  if (row) {
    click(rootOf(tab).querySelector(`[data-${tab}="${row}"]`));
    await shown(tab, row);
  }
}

test('mounts with no startup warnings or errors', () => {
  assert.deepEqual(problems, []);
});

// The first open of the file, so the strip has never been attached: the rows
// are drawn and the root is asked for its strip while it still has no box.
test('a root with no box when its strip is asked for gets the strip once it has one', async () => {
  BOXLESS = true;
  window.__shell.listsTab = 'snag';
  await load();
  await until(() => rowIds('snag').length === 3, 'the rows');
  await frames(8);
  assert.equal(snagRoot().querySelector('[data-ls="head"]'), null, 'no strip while the root has no box');
  BOXLESS = false;
  await shown('snag', 'a-count-off-by-one');
  click(snagRoot().querySelector('[data-snag="a-third-thing"]'));
  await shown('snag', 'a-third-thing');
});

// A hidden track loses its place, as a browser's does, so the strip must be
// built again on the way back, a frame after the tab is revealed.
test('leaving a tab and coming back finds its strip on the row it was left on', async () => {
  await open('snag', 'a-door-left-open');
  await go('note');
  await until(() => picked('note'), 'the Note tab');
  await shown('note', picked('note'));
  track('snag').scrollLeft = 0;
  await go('snag');
  await shown('snag', 'a-door-left-open');
  click(snagRoot().querySelector('[data-snag="a-third-thing"]'));
  await shown('snag', 'a-third-thing');
  await go('note');
  await shown('note', picked('note'));
  click(noteRoot().querySelector('[data-note="n1"]'));
  await shown('note', 'n1');
});

test('both tabs declare the list and detail, each row a compact item', async () => {
  await open('snag');
  assert.equal(roots().length, 2);
  for (const root of roots()) {
    assert.ok(root.querySelector('[data-part="list"][role="listbox"]'));
    assert.ok(root.querySelector('[data-part="detail"]'));
  }
  const rows = [...snagRoot().querySelectorAll('[data-snag]')];
  assert.deepEqual(rows.map(r => r.dataset.snag), ['a-count-off-by-one', 'a-door-left-open', 'a-third-thing'], 'last bitten first');
  assert.equal(text(rows[0].querySelector('[data-part="title"]')), 'the row count was off by one after a sort');
  await until(() => /2$/.test(text(rows[0].querySelector('[data-part="meta"]'))), "the first row's note count");
  assert.match(text(rows[0].querySelector('[data-part="meta"]')), /^tools ×2 on 2026-10-03 2$/, 'repo, how often, how lately, its notes');
  assert.match(text(rows[1].querySelector('[data-part="meta"]')), /^tools on 2026-10-02$/, 'no badge for a snag seen once, no count without notes');
});

test("a card holds its snag's title, links, dates, entry and notes, and a row tap moves the card", async () => {
  await open('snag', 'a-count-off-by-one');
  assert.match(text(head('snag')), /^a-count-off-by-one/, 'the head row names the snag by its id');
  const card = cardOf('snag', 'a-count-off-by-one');
  await until(() => /Fixed by the gate/.test(text(card)), 'the notes left on the snag');
  assert.equal(text(card.querySelector('[data-part="title"]')), 'the row count was off by one after a sort');
  assert.deepEqual([...card.querySelectorAll('[data-part="links"] button')].map(text), ['python/scan.py', 'node/test/scan.test.mjs']);
  assert.match(text(card.querySelector('[data-part="meta"]')), /Bit 2026-10-01, 2026-10-03/);
  assert.equal(card.querySelector('[data-part="body"] strong').textContent, 'sort', 'the entry, rendered');
  assert.match(text(card), /Seen again on the phone\. me .* Fixed by the gate\. claude\/x/, 'the notes left on it, replies under them');

  click(snagRoot().querySelector('[data-snag="a-door-left-open"]'));
  await shown('snag', 'a-door-left-open');
  assert.match(text(head('snag')), /^a-door-left-open/);
  assert.equal(text(cardOf('snag', 'a-door-left-open').querySelector('[data-part="title"]')), 'a panel stayed open behind the next one');
});

test("the head row carries what a row carried: the snag's notes, Again, Edit and Delete", async () => {
  await open('snag', 'a-count-off-by-one');
  const act = (label) => head('snag').querySelector(`[data-part="actions"] [aria-label="${label}"]`);
  await until(() => text(act('Notes about this item')) === '2', "the notes button's count");

  click(act('It happened again today'));
  const today = data.todayYmd();
  await until(() => JSON.parse(FILES['lists/snag.json']).items.find(x => x.id === 'a-count-off-by-one').seen.at(-1) === today, 'Again to be saved');
  assert.deepEqual(JSON.parse(FILES['lists/snag.json']).items.find(x => x.id === 'a-count-off-by-one').seen, ['2026-10-01', '2026-10-03', today]);
  await until(() => text(cardOf('snag', 'a-count-off-by-one').querySelector('[data-part="meta"]')).includes(today),
    'the card to redraw from the written list');

  click(act('Edit'));
  const card = cardOf('snag', 'a-count-off-by-one');
  await until(() => card.querySelectorAll('textarea').length === 2, 'the edit form: the title and the entry');
  assert.equal(card.querySelectorAll('textarea')[0].value, 'the row count was off by one after a sort');
  await until(() => act('Edit').closest('[data-part="actions"]').classList.contains('invisible'), 'the actions to step aside');
  data.editDraft = 'the row count was off by two after a sort';
  click(card.querySelector('[aria-label="Save"]'));
  await until(() => text(card.querySelector('[data-part="title"]')) === 'the row count was off by two after a sort', 'the saved title in the card');
  assert.ok(card.isConnected, "a write that leaves the rows as they were keeps the card, and the reader's place in it");

  click(act('Notes about this item'));
  assert.equal(window.__shell.listsTab, 'note');
  assert.equal(data.noteAbout, REGISTRY + ':lists/snag.json#a-count-off-by-one');
  data.noteAbout = '';
});

test('deleting the snag in view hands the card to the row that took its place', async () => {
  await open('snag', 'a-door-left-open');
  assert.match(text(head('snag')), /^a-door-left-open/);
  click(head('snag').querySelector('[aria-label="Delete"]'));
  await shown('snag', 'a-third-thing');
  assert.deepEqual(rowIds('snag'), ['a-count-off-by-one', 'a-third-thing']);
  assert.match(text(head('snag')), /^a-third-thing/);
});

test('the add box narrows the list, and the first match takes the card', async () => {
  await open('snag', 'a-count-off-by-one');
  data.snagDraft = 'third thing';
  await shown('snag', 'a-third-thing');
  assert.deepEqual(rowIds('snag'), ['a-third-thing']);
  assert.match(text(head('snag')), /^a-third-thing/);
  data.snagDraft = '';
});

test('the Note list holds the notes that answer no other, and a card holds the thread', async () => {
  await open('note', 'n4');
  const rows = [...noteRoot().querySelectorAll('[data-note]')];
  assert.deepEqual(rows.map(r => r.dataset.note), ['n4', 'n3', 'n1'], 'newest first, the reply in no row');
  assert.equal(text(rows[1].querySelector('[data-part="title"]')), 'Merged cleanly', 'its first sentence');
  assert.match(text(rows[2]), /snag: the row count was off by one after a sort .* me 1$/, 'what it is about, its author, its reply');
  assert.match(text(rows[0]), /tools \/ a-branch .* Landed or overtaken, settled claude\/weed/, "a finding's kind and state");

  assert.match(text(head('note')), /^settled ?Landed or overtaken/);
  const finding = cardOf('note', 'n4');
  await until(() => /Its one commit is on main/.test(text(finding)), "the finding's reason in its card");
  assert.deepEqual([...finding.querySelectorAll('[data-part="links"] a')].map(a => text(a) + ' ' + a.getAttribute('href')),
    ['tools / a-branch https://mehrlander.github.io/web-tools/pages/branch.html#gh=o/tools@claude/a-branch', 'tools #12 https://github.com/o/tools/pull/12']);
  assert.match(text(finding), /The branch holds nothing main lacks\. claude\/weed .* Its one commit is on main\./);

  click(noteRoot().querySelector('[data-note="n1"]'));
  await shown('note', 'n1');
  assert.match(text(head('note')), /^List item/, 'a plain note is headed by the kind of thing it is about');
  const card = cardOf('note', 'n1');
  await until(() => /Fixed by the gate/.test(text(card)), 'the reply under the note');
  assert.equal((text(card).match(/Seen again on the phone\./g) || []).length, 1, 'the text once, with no title above it');
  assert.match(text(card), /Seen again on the phone\. me .* Fixed by the gate\. claude\/x/);
});

test('a reply is written from the card, under the note it answers', async () => {
  await open('note', 'n3');
  const card = cardOf('note', 'n3');
  await until(() => card.querySelector('[aria-label="Reply"]'), "the note's reply control");
  click(card.querySelector('[aria-label="Reply"]'));
  await until(() => card.querySelector('form input'), 'the reply form under the note');
  data.replyDraft = 'agreed';
  card.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await until(() => JSON.parse(FILES[NOTES].trim().split('\n').at(-1)).text === 'agreed', 'the reply to be saved');
  assert.equal(JSON.parse(FILES[NOTES].trim().split('\n').at(-1)).about, 'note:n3');
  await until(() => /Merged cleanly\. Nothing else to do\. me .* agreed me/.test(text(card)), 'the reply in the card');
  assert.ok(card.isConnected, 'the card is the one the reply was typed in');
});

test('a note just added takes the card', async () => {
  await open('note', 'n1');
  data.noteAbout = 'o/tools#31'; data.noteDraft = 'One more on the pull request.';
  await data.addNote();
  const id = data.noteItems.at(-1).id;
  await shown('note', id);
  assert.match(text(cardOf('note', id)), /One more on the pull request\./);
  data.noteAbout = '';
});

test("a list item pill opens the Snag tab on that snag's card", async () => {
  await open('note', 'n1');
  const pill = cardOf('note', 'n1').querySelector('[data-part="links"] a');
  assert.equal(text(pill), 'snag: the row count was off by one after a sort');
  data.snagOpen = 'a-third-thing';
  click(pill);
  await shown('snag', 'a-count-off-by-one');
  assert.equal(window.__shell.listsTab, 'snag');
});

test('an About chip narrows the list and moves the card to a note it holds', async () => {
  await open('note', 'n4');
  const chips = () => [...noteRoot().parentElement.querySelectorAll('[data-slot="frame:count-chips"] button')];
  await until(() => chips().length === 4, 'the About chips');
  assert.deepEqual(chips().map(text), ['All3', 'Branch1', 'List item1', 'Pull request1']);
  click(chips()[3]);
  await shown('note', 'n3');
  assert.deepEqual(rowIds('note'), ['n3']);
  await until(() => /^Pull request/.test(text(head('note'))), 'the head row for the pull request note');
  click(chips()[3]);
  await until(() => data.noteKind === '', 'a second tap to let the chip go');
});
