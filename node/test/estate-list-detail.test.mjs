// alpineComponents/estate.js with kits/linked-swiper.js: the Lists view's Snag
// and Note tabs as a list over a strip of cards, and the cards full screen
// (kits/swipe-deck.js open()). What breaks without these: a
// tab that opens on bare rows because its strip was asked for a frame before
// x-show revealed it, a row tap that leaves the card on the last snag, a card
// that keeps a written item's old text, a control the flat rows had that the
// card dropped (Again, Edit, Delete, a row's notes, Reply), a delete that
// throws the reader back to the top of the list, a chip that narrows the
// list under a card it no longer holds, and a takeover whose next arrow sits
// under the floating panel button. jsdom has no layout, so the strip's
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
  static ago = (iso) => (iso ? 'age ' + String(iso).slice(0, 10) : '');
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
// jsdom scrolls nothing; what was asked to come into view is kept.
const SCROLLED = [];
window.Element.prototype.scrollIntoView = function () { SCROLLED.push(this); };
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
const type = (input, value) => { input.value = value; input.dispatchEvent(new window.Event('input', { bubbles: true })); };
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
  const on = () => picked(tab) === id && selected(tab).join() === id && head(tab) && text(cardOf(tab, id))
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
  data.snagDraft = ''; data.editId = null; data.undoOffer = null; data.replyTo = null; data.replyDrafts = {};
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
  await until(() => rowIds('snag').length === 3, 'its rows drawn');
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

// x-show hides a frame late as it reveals a frame late, so a strip asked for
// in the tick its tab is left still finds a box. Built then, it used up the
// rebuild the tab is owed on the way back.
test('a strip asked for as its tab is left is not built, and is on the way back', async () => {
  await open('snag', 'a-door-left-open');
  const old = track('snag');
  data.snagItems = [...data.snagItems];
  for (let i = 0; i < 4; i++) await Promise.resolve();
  window.__shell.listsTab = 'note';
  await until(() => snagRoot().parentElement.style.display === 'none', 'the Snag tab to be hidden');
  await frames(3);
  assert.equal(track('snag'), old, 'no strip is built for a tab out of view');
  old.scrollLeft = 0;
  await go('snag');
  await shown('snag', 'a-door-left-open');
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
  // One meta line, each fact in a slot of its own: the repo, how often, its
  // notes, how lately. A slot with nothing to say stays, empty, so the next
  // one sits where it does on every row.
  const slots = (row) => [...row.querySelector('[data-part="meta"]').children].map(text);
  await until(() => slots(rows[0])[2] === '2', "the first row's note count");
  assert.deepEqual(slots(rows[0]), ['tools', '×2', '2', 'age 2026-10-03']);
  assert.deepEqual(slots(rows[1]), ['tools', '', '', 'age 2026-10-02'], 'seen once, and no notes');
  for (const row of rows) assert.equal(row.querySelectorAll('[data-part="meta"]').length, 1);
});

test("a card holds its snag's title, links, dates, entry and notes, and a row tap moves the card", async () => {
  await open('snag', 'a-count-off-by-one');
  await until(() => text(head('snag')) === '2 1/3', "the head row: the snag's notes and the counter, and no name the card gives");
  const card = cardOf('snag', 'a-count-off-by-one');
  await until(() => /Fixed by the gate/.test(text(card)), 'the notes left on the snag');
  assert.equal(text(card.querySelector('[data-part="title"]')), 'the row count was off by one after a sort');
  assert.deepEqual([...card.querySelectorAll('[data-part="links"] button')].map(text), ['python/scan.py', 'node/test/scan.test.mjs']);
  assert.equal(text(card.querySelector('[data-part="meta"]')), 'a-count-off-by-one tools Bit 2026-10-01, 2026-10-03',
    'the id in full, which is what a citation names, then the repo and the dates');
  assert.equal(card.querySelector('[data-part="body"] strong').textContent, 'sort', 'the entry, rendered');
  assert.match(text(card), /Seen again on the phone\. me 2026-10-04 Fixed by the gate\. claude\/x 2026-10-05$/,
    'the notes left on it, replies under them, each with its day once');

  click(snagRoot().querySelector('[data-snag="a-door-left-open"]'));
  await shown('snag', 'a-door-left-open');
  assert.equal(text(head('snag')), '2/3');
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
  await until(() => rowIds('note').join() === 'n1', 'the list the count counted: the note at the old address, its reply in its card');
  await shown('note', 'n1');
  data.noteAbout = '';
});

test('deleting the snag in view hands the card to the row that took its place', async () => {
  await open('snag', 'a-door-left-open');
  click(head('snag').querySelector('[aria-label="Delete"]'));
  await shown('snag', 'a-third-thing');
  assert.deepEqual(rowIds('snag'), ['a-count-off-by-one', 'a-third-thing']);
  assert.equal(text(head('snag')), '2/2');
});

test('the add box narrows the list, and the first match takes the card', async () => {
  await open('snag', 'a-count-off-by-one');
  data.snagDraft = 'third thing';
  await shown('snag', 'a-third-thing');
  assert.deepEqual(rowIds('snag'), ['a-third-thing']);
  assert.match(text(cardOf('snag', 'a-third-thing').querySelector('[data-part="meta"]')), /^a-third-thing /);
  data.snagDraft = '';
});

test('the Note list holds the notes that answer no other, and a card holds the thread', async () => {
  await open('note', 'n4');
  const rows = [...noteRoot().querySelectorAll('[data-note]')];
  assert.deepEqual(rows.map(r => r.dataset.note), ['n4', 'n3', 'n1'], 'newest first, the reply in no row');
  assert.equal(text(rows[1].querySelector('[data-part="title"]')), 'Merged cleanly', 'its first sentence');
  // One meta line: what it is about, a finding's kind and state, the
  // replies and the age. The last two are the same slots on every row.
  const slots = (row) => [...row.querySelector('[data-part="meta"]').children].filter(el => el.tagName !== 'TEMPLATE').map(text);
  assert.deepEqual(slots(rows[2]), ['snag: the row count was off by one after a sort', '1', 'age 2026-10-04'], 'no author: the card has it');
  assert.deepEqual(slots(rows[1]), ['tools #12', '', 'age 2026-10-06']);
  assert.deepEqual(slots(rows[0]), ['tools / a-branch', 'Landed or overtaken, settled', '', 'age 2026-10-07'], "a finding's kind and state");
  for (const row of rows) assert.equal(row.querySelectorAll('[data-part="meta"]').length, 1);

  assert.equal(text(head('note')), '1/3', 'the head row repeats nothing the row and the chip say');
  const finding = cardOf('note', 'n4');
  await until(() => /Its one commit is on main/.test(text(finding)), "the finding's reason in its card");
  assert.deepEqual([...finding.querySelectorAll('[data-part="links"] a')].map(a => text(a) + ' ' + a.getAttribute('href')),
    ['tools / a-branch https://mehrlander.github.io/web-tools/pages/branch.html#gh=o/tools@claude/a-branch', 'tools #12 https://github.com/o/tools/pull/12']);
  assert.match(text(finding), /The branch holds nothing main lacks\. claude\/weed 2026-10-07 Its one commit is on main\.$/);

  click(noteRoot().querySelector('[data-note="n1"]'));
  await shown('note', 'n1');
  const card = cardOf('note', 'n1');
  await until(() => /Fixed by the gate/.test(text(card)), 'the reply under the note');
  assert.equal((text(card).match(/Seen again on the phone\./g) || []).length, 1, 'the text once, with no title above it');
  assert.match(text(card), /Seen again on the phone\. me 2026-10-04 Fixed by the gate\. claude\/x 2026-10-05$/);
});

test('a reply is written from the card, under the note it answers', async () => {
  await open('note', 'n3');
  const card = cardOf('note', 'n3');
  await until(() => card.querySelector('[aria-label="Reply"]'), "the note's reply control");
  click(card.querySelector('[aria-label="Reply"]'));
  await until(() => card.querySelector('form input'), 'the reply form under the note');
  assert.equal(doc.activeElement, card.querySelector('form input'), 'a form the reader opened takes focus');
  await until(() => SCROLLED.at(-1) === card.querySelector('form'), 'the form to be brought into view');
  assert.match(card.querySelector('form').className, /max-sm:scroll-mb-\[calc\(var\(--fab-bottom,1\.5rem\)\+4rem\)\]/,
    'clear of the floating panel button, which sits where a form at the end of the card opens');
  type(card.querySelector('form input'), 'agreed');
  card.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await until(() => JSON.parse(FILES[NOTES].trim().split('\n').at(-1)).text === 'agreed', 'the reply to be saved');
  assert.equal(JSON.parse(FILES[NOTES].trim().split('\n').at(-1)).about, 'note:n3');
  await until(() => /Merged cleanly\. Nothing else to do\. me .* agreed me/.test(text(card)), 'the reply in the card');
  assert.ok(card.isConnected, 'the card is the one the reply was typed in');
  assert.equal(card.querySelector('form'), null, 'and the form has closed');
});

// The reader opens Reply, types, and then moves the card: by a row tap, by a
// swipe, and by an arrow. Each used to close the form and drop the text.
test('a reply being typed survives the card moving, and its form stays open', async () => {
  await open('note', 'n3');
  const card = () => cardOf('note', 'n3');
  const form = () => card().querySelector('form input');
  click(card().querySelector('[aria-label="Reply"]'));
  await until(form, 'the reply form');
  type(form(), 'not sent yet');

  click(noteRoot().querySelector('[data-note="n1"]'));
  await shown('note', 'n1');
  assert.equal(data.replyTo, 'n3', 'a row tap leaves the form open');
  track('note').scrollTo({ left: 1 });
  await shown('note', 'n3');
  assert.equal(form().value, 'not sent yet', 'a swipe back finds the text');

  click(head('note').querySelector('[data-swipe-step="-1"]'));
  await shown('note', 'n4');
  assert.equal(form().value, 'not sent yet', 'an arrow leaves it too');

  click(card().querySelector('[aria-label="Reply"]'));
  await until(() => !form(), 'the reply control to close the form');
  click(card().querySelector('[aria-label="Reply"]'));
  await until(form, 'the form again');
  assert.equal(form().value, 'not sent yet', 'a form closed and opened again comes back with its text');
  type(form(), '');
  click(noteRoot().querySelector('[data-note="n3"]'));
  await shown('note', 'n3');
  click(noteRoot().querySelector('[data-note="n1"]'));
  await shown('note', 'n1');
  assert.equal(data.replyTo, null, 'an empty form closes when the card moves');
});

// What the phone layout rests on, as far as markup can say it; the pixels are
// measured headless. Without these a card's links wrap to three rows, its
// icon controls are 24 to 32px targets at a third of the text's tone, and the
// floating panel button covers a card's last lines.
test('a card keeps its links to one row, its icon controls thumb-sized on touch, and room under its end', async () => {
  await open('note', 'n4');
  const card = cardOf('note', 'n4');
  const links = card.querySelector('[data-part="links"]');
  assert.deepEqual([...links.children].map(el => el.tagName), ['DIV', 'BUTTON'], 'the pills, then the funnel');
  assert.match(links.firstElementChild.className, /flex-nowrap.*overflow-x-auto/, 'a single row, scrolled sideways');
  assert.equal(links.firstElementChild.querySelectorAll('a').length, 2);
  assert.equal(links.lastElementChild.getAttribute('aria-label'), 'Show only the notes about this');
  assert.match(card.className, /max-sm:pb-\[calc\(var\(--fab-bottom,1\.5rem\)\+4rem\)\]/, "the note dock's own clearance of the button");

  await open('snag', 'a-count-off-by-one');
  const snag = cardOf('snag', 'a-count-off-by-one');
  assert.match(snag.querySelector('[data-part="links"]').className, /flex-nowrap.*overflow-x-auto/);
  await until(() => snag.querySelector('[aria-label="Reply"]'), 'the notes left on the snag');
  const controls = [...head('snag').querySelectorAll('[data-part="actions"] button'), ...snag.querySelectorAll('[aria-label="Reply"]'),
                    links.lastElementChild];
  assert.equal(controls.length, 7, 'four on the head row, a reply under each of two notes, the funnel');
  for (const b of controls) {
    assert.ok(b.className.includes('[@media(hover:none)]:min-h-10') && b.className.includes('[@media(hover:none)]:min-w-10'), text(b) || b.getAttribute('aria-label'));
    if (b.getAttribute('aria-label') !== 'It happened again today') assert.ok(b.className.includes('[@media(hover:none)]:text-base-content/60'));
  }
});

test('a note just added takes the card', async () => {
  await open('note', 'n1');
  data.noteAbout = 'o/tools#31'; data.noteDraft = 'One more for that pull request.';
  await data.addNote();
  const id = data.noteItems.at(-1).id;
  await shown('note', id);
  assert.match(text(cardOf('note', id)), /One more for that pull request\./);
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
  click(chips()[3]);
  await until(() => data.noteKind === '', 'a second tap to let the chip go');
});

// ── The cards full screen ────────────────────────────────────────────────
// The takeover hangs off the body, outside the component's tree. Without the
// scope it is handed, its cards are markup that binds to nothing: no title,
// and controls that throw.
const overlay = () => doc.querySelector('.sd-overlay');
const deckTrack = () => overlay().querySelector('.sd-track');
const deckCard = (i) => deckTrack().children[i];
const sub = (label) => overlay().querySelector(`.sd-subheader [aria-label="${label}"]`);
async function door(tab, at) {
  click(head(tab).querySelector('[data-swipe-cards]'));
  await until(() => overlay() && deckTrack().scrollLeft === at && text(deckCard(at)), `the takeover on card ${at}`);
  await frames(3);
}
async function closed() {
  await until(() => !overlay() && data.listDeck === '', 'the takeover to close');
}

test("the head row's door opens the cards full screen at the card in view, and closing returns to the card it closed on", async () => {
  await open('snag', 'a-door-left-open');
  assert.ok(head('snag').querySelector('[data-swipe-cards]'), 'the door, in the head row');
  await door('snag', 1);
  assert.equal(picked('snag'), 'a-door-left-open', "the kit's opening report of slide 0 is not a pick");
  assert.equal(data.listDeck, 'snag');
  assert.equal(text(deckCard(1).querySelector('[data-part="title"]')), 'a panel stayed open behind the next one');
  assert.match(text(deckCard(1).querySelector('[data-part="meta"]')), /^a-door-left-open tools Bit 2026-10-02$/);
  assert.match(deckCard(1).querySelector('[data-part="title"]').className, /group-\[\.is-deck\]:text-xl/, "a deck's reading size");
  assert.deepEqual([...overlay().querySelectorAll('.sd-subheader button')].map(b => b.getAttribute('aria-label')),
    ['Notes about this item', 'It happened again today', 'Edit', 'Delete'], "the snag's four controls, under the header");

  deckTrack().scrollTo({ left: 2 });
  await shown('snag', 'a-third-thing');
  assert.equal(text(deckCard(2).querySelector('[data-part="title"]')), 'a third thing went wrong');
  click(overlay().querySelector('[aria-label="Close"]'));
  await closed();
  await shown('snag', 'a-third-thing');
});

// The floating panel button paints above everything at the bottom right,
// where the takeover's footer puts its next arrow. Without this the arrow is
// under the button on a phone, and the band left for the button shows the
// foot of the card under the takeover.
test('the takeover stops short of the floating panel button while it is open, and gives the room back', async () => {
  const frame = doc.documentElement.style, room = () => frame.getPropertyValue('--deck-bottom');
  await open('snag', 'a-door-left-open');
  await door('snag', 1);
  assert.equal(room(), '', 'no button on the page, nothing reserved');
  click(overlay().querySelector('[aria-label="Close"]'));
  await closed();

  // The button's mount, kept from Alpine: only its presence is read.
  const mount = doc.createElement('div');
  mount.setAttribute('x-ignore', '');
  mount.innerHTML = '<div x-data="fab()"></div>';
  doc.body.append(mount);
  await door('snag', 1);
  assert.equal(room(), 'calc(var(--fab-bottom, 1.5rem) + 4rem)', "the band the button's own note dock leaves");
  await until(() => snagRoot().className.includes('[:root:not([data-deck-pane=dock])_&]:invisible'),
    'the list and strip under it to go out of sight, unless the takeover is docked beside them');
  click(overlay().querySelector('[aria-label="Close"]'));
  await closed();
  assert.equal(room(), '', 'given back on close');
  await until(() => !snagRoot().className.includes('invisible'), 'the list and strip back in sight');

  frame.setProperty('--deck-bottom', '12px');
  await door('snag', 1);
  assert.equal(room(), 'calc(var(--fab-bottom, 1.5rem) + 4rem)');
  await go('note');
  await closed();
  assert.equal(room(), '12px', "a takeover let go by a change of tab puts back what the page had");
  frame.removeProperty('--deck-bottom');
  mount.remove();
  await go('snag');
  await shown('snag', 'a-door-left-open');
});

test('edit, Again and Delete act from the takeover, and a form is drawn there and not in the strip under it', async () => {
  await open('snag', 'a-count-off-by-one');
  await door('snag', 0);
  const card = deckCard(0), under = cardOf('snag', 'a-count-off-by-one');
  click(sub('Edit'));
  await until(() => card.querySelectorAll('textarea').length === 2, 'the edit form in the takeover');
  assert.equal(under.querySelectorAll('textarea').length, 0, 'none in the strip: two would each commit on a click in the other');
  assert.equal(text(under.querySelector('[data-part="title"]')), 'the row count was off by one after a sort', 'which keeps the title');
  data.editDraft = 'the row count was off by three after a sort';
  click(card.querySelector('[aria-label="Save"]'));
  await until(() => text(card.querySelector('[data-part="title"]')) === 'the row count was off by three after a sort', 'the saved title in the takeover');
  assert.equal(text(under.querySelector('[data-part="title"]')), 'the row count was off by three after a sort', 'and under it');
  assert.equal(JSON.parse(FILES['lists/snag.json']).items.find(x => x.id === 'a-count-off-by-one').text, 'the row count was off by three after a sort');

  click(sub('It happened again today'));
  const today = data.todayYmd();
  await until(() => JSON.parse(FILES['lists/snag.json']).items.find(x => x.id === 'a-count-off-by-one').seen.at(-1) === today, 'Again to be saved');
  await until(() => text(card.querySelector('[data-part="meta"]')).includes(today), 'the takeover card to redraw');
  assert.ok(overlay(), 'a write that removes no row leaves the takeover open');

  click(sub('Delete'));
  await closed();
  await shown('snag', 'a-door-left-open');
  assert.deepEqual(rowIds('snag'), ['a-door-left-open', 'a-third-thing'], 'the takeover closes on the list as it now is');
});

test('a tab left with its takeover open lets the takeover go', async () => {
  await open('snag', 'a-door-left-open');
  await door('snag', 1);
  await go('note');
  await closed();
  await shown('note', picked('note'));
  await go('snag');
  await shown('snag', 'a-door-left-open');
});

test('a reply is written from the takeover', async () => {
  await open('note', 'n3');
  await door('note', 1);
  assert.equal(overlay().querySelector('.sd-subheader button'), null, 'a note has no controls of its own up there');
  const card = deckCard(1), under = cardOf('note', 'n3');
  click(card.querySelector('[aria-label="Reply"]'));
  await until(() => card.querySelector('form input'), 'the reply form in the takeover');
  assert.equal(under.querySelector('form'), null);
  assert.equal(doc.activeElement, card.querySelector('form input'));
  type(card.querySelector('form input'), 'from the takeover');
  card.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await until(() => JSON.parse(FILES[NOTES].trim().split('\n').at(-1)).text === 'from the takeover', 'the reply to be saved');
  assert.equal(JSON.parse(FILES[NOTES].trim().split('\n').at(-1)).about, 'note:n3');
  await until(() => /from the takeover me/.test(text(card)), 'the reply in the takeover card');
  window.history.back();
  await closed();
  await shown('note', 'n3');
});

test('what leaves the tab from a takeover card closes the takeover first', async () => {
  await open('note', 'n1');
  await door('note', 2);
  data.snagOpen = 'a-third-thing';
  click(deckCard(2).querySelector('[data-part="links"] a'));
  await closed();
  await shown('snag', 'a-count-off-by-one');
  assert.equal(window.__shell.listsTab, 'snag');
});

