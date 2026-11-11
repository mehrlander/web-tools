// alpineComponents/estate.js with kits/linked-swiper.js: the Lists view's Snag
// and Note tabs as a list over a strip of cards. What breaks without these: a
// row tap that leaves the card on the last snag, a card that keeps a written
// item's old text, a control the flat rows had that the card dropped (Again,
// Edit, Delete, a row's notes, Reply), a delete that throws the reader back to
// the top of the list, and a chip that narrows the list under a card it no
// longer holds. jsdom has no layout, so the strip's geometry is stubbed as the
// swipe-deck tests stub it; the pixels are the headless scenarios' business.
// Every snag and note here is invented.

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
// A shown element has a box, which is how listMount tells an open tab from a
// hidden one.
window.Element.prototype.getClientRects = function () { return this.isConnected ? [{}] : []; };
window.TOKEN = 'tkn';
window.GH = FakeGH;
window.__shell = {
  REGISTRY_REPO: REGISTRY, DEFAULT_REPO: 'o/tools', quickLinks: [],
  hasToken: () => true, _authState: 'auth', refreshConfigCache() {}, refreshActivity() {},
  view: 'lists', listsTab: 'snag', goListsTab(tab) { this.listsTab = tab; },
};

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
  { id: 'a-green-over-nothing', text: 'a local green over a file nobody listed', note: 'The **suite** passed over a file it never read.',
    repo: 'o/tools', seen: ['2026-10-01', '2026-10-03'], targets: ['o/tools:python/scan.py', 'o/tools:node/test/scan.test.mjs'],
    created_at: '2026-10-01T10:00:00.000Z' },
  { id: 'a-stale-name', text: 'a stale file name was kept', repo: 'o/tools', seen: ['2026-10-02'], created_at: '2026-10-02T10:00:00.000Z' },
  { id: 'a-third-thing', text: 'a third thing went wrong', repo: 'o/other', seen: ['2026-09-01'], created_at: '2026-09-01T10:00:00.000Z' },
];
const NOTE_LINES = [
  { id: 'n1', at: '2026-10-04T00:00:00Z', author: 'me', about: 'o/tools:docs/SNAGS.md#a-green-over-nothing', text: 'Seen again on the phone.' },
  { id: 'n2', at: '2026-10-05T00:00:00Z', author: 'claude/x', about: 'note:n1', text: 'Fixed by the gate.' },
  { id: 'n3', at: '2026-10-06T00:00:00Z', author: 'me', about: 'o/tools#12', text: 'Merged cleanly. Nothing else to do.' },
  { id: 'n4', at: '2026-10-07T00:00:00Z', author: 'claude/tend', about: 'o/tools@claude/a-branch', text: 'The branch holds nothing main lacks.',
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

// Open a tab on fresh files, then tap a row if one is named. The shell here is
// a plain object, so the tab is set before the read: the rows arriving are
// what the root's x-effect hears, and it mounts the strip for the open tab.
async function open(tab, row = '') {
  SAVES = [];
  FILES = { 'lists/snag.json': JSON.stringify({ items: SNAGS }), [NOTES]: NOTE_LINES.map(line).join('') };
  window.__shell.listsTab = tab;
  data.snagDraft = ''; data.editId = null; data.undoOffer = null; data.replyTo = null;
  data.noteAbout = ''; data.noteKind = '';
  await data.loadSnags(reg());
  await data.loadNotes(reg());
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

test('both tabs declare the list and detail, each row a compact item', async () => {
  await open('snag');
  assert.equal(roots().length, 2);
  for (const root of roots()) {
    assert.ok(root.querySelector('[data-part="list"][role="listbox"]'));
    assert.ok(root.querySelector('[data-part="detail"]'));
  }
  const rows = [...snagRoot().querySelectorAll('[data-snag]')];
  assert.deepEqual(rows.map(r => r.dataset.snag), ['a-green-over-nothing', 'a-stale-name', 'a-third-thing'], 'last bitten first');
  assert.equal(text(rows[0].querySelector('[data-part="title"]')), 'a local green over a file nobody listed');
  await until(() => /2$/.test(text(rows[0].querySelector('[data-part="meta"]'))), "the first row's note count");
  assert.match(text(rows[0].querySelector('[data-part="meta"]')), /^tools ×2 on 2026-10-03 2$/, 'repo, how often, how lately, its notes');
  assert.match(text(rows[1].querySelector('[data-part="meta"]')), /^tools on 2026-10-02$/, 'no badge for a snag seen once, no count without notes');
});

test('the Snag strip opens on the first row, and a row tap moves the card', async () => {
  await open('snag');
  await shown('snag', 'a-green-over-nothing');
  assert.match(text(head('snag')), /^a-green-over-nothing/, 'the head row names the snag by its id');
  const card = cardOf('snag', 'a-green-over-nothing');
  await until(() => /Fixed by the gate/.test(text(card)), 'the notes left on the snag');
  assert.equal(text(card.querySelector('[data-part="title"]')), 'a local green over a file nobody listed');
  assert.deepEqual([...card.querySelectorAll('[data-part="links"] button')].map(text), ['python/scan.py', 'node/test/scan.test.mjs']);
  assert.match(text(card.querySelector('[data-part="meta"]')), /Bit 2026-10-01, 2026-10-03/);
  assert.equal(card.querySelector('[data-part="body"] strong').textContent, 'suite', 'the entry, rendered');
  assert.match(text(card), /Seen again on the phone\. me .* Fixed by the gate\. claude\/x/, 'the notes left on it, replies under them');

  click(snagRoot().querySelector('[data-snag="a-stale-name"]'));
  await shown('snag', 'a-stale-name');
  assert.match(text(head('snag')), /^a-stale-name/);
  assert.equal(text(cardOf('snag', 'a-stale-name').querySelector('[data-part="title"]')), 'a stale file name was kept');
});

test("the head row carries what a row carried: the snag's notes, Again, Edit and Delete", async () => {
  await open('snag', 'a-green-over-nothing');
  const act = (label) => head('snag').querySelector(`[data-part="actions"] [aria-label="${label}"]`);
  await until(() => text(act('Notes about this item')) === '2', "the notes button's count");

  click(act('It happened again today'));
  const today = data.todayYmd();
  await until(() => JSON.parse(FILES['lists/snag.json']).items.find(x => x.id === 'a-green-over-nothing').seen.at(-1) === today, 'Again to be saved');
  assert.deepEqual(JSON.parse(FILES['lists/snag.json']).items.find(x => x.id === 'a-green-over-nothing').seen, ['2026-10-01', '2026-10-03', today]);
  await until(() => text(cardOf('snag', 'a-green-over-nothing').querySelector('[data-part="meta"]')).includes(today),
    'the card to redraw from the written list');

  click(act('Edit'));
  const card = cardOf('snag', 'a-green-over-nothing');
  await until(() => card.querySelectorAll('textarea').length === 2, 'the edit form: the title and the entry');
  assert.equal(card.querySelectorAll('textarea')[0].value, 'a local green over a file nobody listed');
  await until(() => act('Edit').closest('[data-part="actions"]').classList.contains('invisible'), 'the actions to step aside');
  data.editDraft = 'a local green over a file nobody read';
  click(card.querySelector('[aria-label="Save"]'));
  await until(() => text(card.querySelector('[data-part="title"]')) === 'a local green over a file nobody read', 'the saved title in the card');
  assert.ok(card.isConnected, "a write that leaves the rows as they were keeps the card, and the reader's place in it");

  click(act('Notes about this item'));
  assert.equal(window.__shell.listsTab, 'note');
  assert.equal(data.noteAbout, REGISTRY + ':lists/snag.json#a-green-over-nothing');
  data.noteAbout = '';
});

test('deleting the snag in view hands the card to the row that took its place', async () => {
  await open('snag', 'a-stale-name');
  assert.match(text(head('snag')), /^a-stale-name/);
  click(head('snag').querySelector('[aria-label="Delete"]'));
  await shown('snag', 'a-third-thing');
  assert.deepEqual(rowIds('snag'), ['a-green-over-nothing', 'a-third-thing']);
  assert.match(text(head('snag')), /^a-third-thing/);
});

test('the add box narrows the list, and the first match takes the card', async () => {
  await open('snag', 'a-green-over-nothing');
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
  assert.equal(text(rows[1].querySelector('[data-part="title"]')), 'Merged cleanly', 'the first sentence');
  assert.match(text(rows[2]), /snag: a local green over a file nobody listed .* me 1$/, 'what it is about, its author, its reply');
  assert.match(text(rows[0]), /tools \/ a-branch .* Landed or overtaken, settled claude\/tend/, "a finding's kind and state");

  assert.match(text(head('note')), /^settled ?Landed or overtaken/);
  const finding = cardOf('note', 'n4');
  await until(() => /Its one commit is on main/.test(text(finding)), "the finding's reason in its card");
  assert.deepEqual([...finding.querySelectorAll('[data-part="links"] a')].map(a => text(a) + ' ' + a.getAttribute('href')),
    ['tools / a-branch https://mehrlander.github.io/web-tools/pages/branch.html#gh=o/tools@claude/a-branch', 'tools #12 https://github.com/o/tools/pull/12']);
  assert.match(text(finding), /The branch holds nothing main lacks\. claude\/tend .* Its one commit is on main\./);

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

test('an About chip narrows the list and moves the card to a note it holds', async () => {
  await open('note', 'n4');
  const chips = () => [...noteRoot().parentElement.querySelectorAll('[data-slot="frame:count-chips"] button')];
  await until(() => chips().length === 4, 'the chips');
  assert.deepEqual(chips().map(text), ['All3', 'Branch1', 'List item1', 'Pull request1']);
  click(chips()[3]);
  await shown('note', 'n3');
  assert.deepEqual(rowIds('note'), ['n3']);
  await until(() => /^Pull request/.test(text(head('note'))), 'the head row for the pull request note');
  click(chips()[3]);
  await until(() => data.noteKind === '', 'a second tap to let the chip go');
});
