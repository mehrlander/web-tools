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
const wait = (ms = 60) => new Promise(r => setTimeout(r, ms));
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
const snagRoot = () => roots()[0];
const noteRoot = () => roots()[1];
const selected = (root, key) => [...root.querySelectorAll('[aria-selected="true"]')].map(r => r.getAttribute('data-' + key));
const head = (root) => root.querySelector('[data-ls="head"]');
// The card in view: the strip's slide at the selection.
const cardOf = (root, key, id) => {
  const ids = [...root.querySelectorAll(`[data-part="list"] [data-${key}]`)].map(r => r.getAttribute('data-' + key));
  return root.querySelector('.sd-track').children[ids.indexOf(id)];
};

// Open a tab on fresh files, then tap a row if one is named. The shell here is
// a plain object, so the tab is set before the read: the rows arriving are
// what the root's x-effect hears, and it mounts the strip for the open tab.
async function open(tab, picked = '') {
  SAVES = [];
  FILES = { 'lists/snag.json': JSON.stringify({ items: SNAGS }), [NOTES]: NOTE_LINES.map(line).join('') };
  window.__shell.listsTab = tab;
  data.snagDraft = ''; data.editId = null; data.undoOffer = null; data.replyTo = null;
  data.noteAbout = ''; data.noteKind = '';
  data.snagOpen = ''; data.noteOpen = '';
  await data.loadSnags(reg());
  await data.loadNotes(reg());
  await wait();
  if (picked) {
    click((tab === 'snag' ? snagRoot() : noteRoot()).querySelector(`[data-${tab}="${picked}"]`));
    await wait();
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
  assert.match(text(rows[0].querySelector('[data-part="meta"]')), /^tools ×2 on 2026-10-03 2$/, 'repo, how often, how lately, its notes');
  assert.match(text(rows[1].querySelector('[data-part="meta"]')), /^tools on 2026-10-02$/, 'no badge for a snag seen once, no count without notes');
});

test('the Snag strip opens on the first row, and a row tap moves the card', async () => {
  await open('snag');
  assert.equal(data.snagOpen, 'a-green-over-nothing');
  assert.deepEqual(selected(snagRoot(), 'snag'), ['a-green-over-nothing']);
  assert.match(text(head(snagRoot())), /^a-green-over-nothing/, 'the head row names the snag by its id');
  const card = cardOf(snagRoot(), 'snag', 'a-green-over-nothing');
  assert.equal(text(card.querySelector('[data-part="title"]')), 'a local green over a file nobody listed');
  assert.deepEqual([...card.querySelectorAll('[data-part="links"] button')].map(text), ['python/scan.py', 'node/test/scan.test.mjs']);
  assert.match(text(card.querySelector('[data-part="meta"]')), /Bit 2026-10-01, 2026-10-03/);
  assert.equal(card.querySelector('[data-part="body"] strong').textContent, 'suite', 'the entry, rendered');
  assert.match(text(card), /Seen again on the phone\. me .* Fixed by the gate\. claude\/x/, 'the notes left on it, replies under them');

  click(snagRoot().querySelector('[data-snag="a-stale-name"]'));
  await wait();
  assert.equal(data.snagOpen, 'a-stale-name');
  assert.deepEqual(selected(snagRoot(), 'snag'), ['a-stale-name']);
  assert.match(text(head(snagRoot())), /^a-stale-name/);
  assert.equal(text(cardOf(snagRoot(), 'snag', 'a-stale-name').querySelector('[data-part="title"]')), 'a stale file name was kept');
});

test("the head row carries what a row carried: the snag's notes, Again, Edit and Delete", async () => {
  await open('snag', 'a-green-over-nothing');
  const act = (label) => head(snagRoot()).querySelector(`[data-part="actions"] [aria-label="${label}"]`);
  assert.equal(text(act('Notes about this item')), '2', 'with the count of its notes');

  click(act('It happened again today'));
  await wait();
  const again = JSON.parse(FILES['lists/snag.json']).items.find(x => x.id === 'a-green-over-nothing');
  assert.deepEqual(again.seen, ['2026-10-01', '2026-10-03', data.todayYmd()]);
  assert.match(text(cardOf(snagRoot(), 'snag', 'a-green-over-nothing').querySelector('[data-part="meta"]')),
    new RegExp(data.todayYmd()), 'the card redraws from the written list');

  click(act('Edit'));
  await wait();
  const card = cardOf(snagRoot(), 'snag', 'a-green-over-nothing');
  const fields = card.querySelectorAll('textarea');
  assert.equal(fields.length, 2, 'the title and the entry');
  assert.equal(fields[0].value, 'a local green over a file nobody listed');
  assert.ok(act('Edit').closest('[data-part="actions"]').classList.contains('invisible'), 'the actions step aside and keep their room');
  data.editDraft = 'a local green over a file nobody read';
  click(card.querySelector('[aria-label="Save"]'));
  await wait();
  assert.ok(card.isConnected, 'a write that leaves the rows as they were keeps the card, and the reader\'s place in it');
  assert.equal(text(card.querySelector('[data-part="title"]')), 'a local green over a file nobody read');

  click(act('Notes about this item'));
  assert.equal(window.__shell.listsTab, 'note');
  assert.equal(data.noteAbout, REGISTRY + ':lists/snag.json#a-green-over-nothing');
  data.noteAbout = '';
});

test('deleting the snag in view hands the card to the row that took its place', async () => {
  await open('snag', 'a-stale-name');
  assert.match(text(head(snagRoot())), /^a-stale-name/);
  click(head(snagRoot()).querySelector('[aria-label="Delete"]'));
  await wait();
  assert.deepEqual([...snagRoot().querySelectorAll('[data-snag]')].map(r => r.dataset.snag), ['a-green-over-nothing', 'a-third-thing']);
  assert.equal(data.snagOpen, 'a-third-thing');
  assert.match(text(head(snagRoot())), /^a-third-thing/);
});

test('the add box narrows the list, and the first match takes the card', async () => {
  await open('snag', 'a-green-over-nothing');
  data.snagDraft = 'third thing';
  await wait();
  assert.deepEqual([...snagRoot().querySelectorAll('[data-snag]')].map(r => r.dataset.snag), ['a-third-thing']);
  assert.equal(data.snagOpen, 'a-third-thing');
  assert.match(text(head(snagRoot())), /^a-third-thing/);
  data.snagDraft = '';
});

test('the Note list holds the notes that answer no other, and a card holds the thread', async () => {
  await open('note');
  const rows = [...noteRoot().querySelectorAll('[data-note]')];
  assert.deepEqual(rows.map(r => r.dataset.note), ['n4', 'n3', 'n1'], 'newest first, the reply in no row');
  assert.equal(text(rows[1].querySelector('[data-part="title"]')), 'Merged cleanly', 'the first sentence');
  assert.match(text(rows[2]), /snag: a local green over a file nobody listed .* me 1$/, 'what it is about, its author, its reply');
  assert.match(text(rows[0]), /tools \/ a-branch .* Landed or overtaken, settled claude\/tend/, "a finding's kind and state");

  assert.equal(data.noteOpen, 'n4');
  assert.match(text(head(noteRoot())), /^settled ?Landed or overtaken/);
  const finding = cardOf(noteRoot(), 'note', 'n4');
  assert.deepEqual([...finding.querySelectorAll('[data-part="links"] a')].map(a => text(a) + ' ' + a.getAttribute('href')),
    ['tools / a-branch https://mehrlander.github.io/web-tools/pages/branch.html#gh=o/tools@claude/a-branch', 'tools #12 https://github.com/o/tools/pull/12']);
  assert.match(text(finding), /The branch holds nothing main lacks\. claude\/tend .* Its one commit is on main\./);

  click(noteRoot().querySelector('[data-note="n1"]'));
  await wait();
  assert.match(text(head(noteRoot())), /^List item/, 'a plain note is headed by the kind of thing it is about');
  const card = cardOf(noteRoot(), 'note', 'n1');
  assert.equal((text(card).match(/Seen again on the phone\./g) || []).length, 1, 'the text once, with no title above it');
  assert.match(text(card), /Seen again on the phone\. me .* Fixed by the gate\. claude\/x/);
});

test('a reply is written from the card, under the note it answers', async () => {
  await open('note', 'n3');
  const card = cardOf(noteRoot(), 'note', 'n3');
  click(card.querySelector('[aria-label="Reply"]'));
  await wait();
  const box = card.querySelector('form input');
  assert.ok(box, 'the reply form opens under the note');
  data.replyDraft = 'agreed';
  card.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await wait();
  const last = JSON.parse(FILES[NOTES].trim().split('\n').at(-1));
  assert.equal(last.about, 'note:n3');
  assert.equal(last.text, 'agreed');
  assert.ok(card.isConnected, 'the card is the one the reply was typed in');
  assert.match(text(card), /Merged cleanly\. Nothing else to do\. me .* agreed me/, 'and it shows the reply');
});

test('an About chip narrows the list and moves the card to a note it holds', async () => {
  await open('note', 'n4');
  const chips = () => [...noteRoot().parentElement.querySelectorAll('[data-slot="frame:count-chips"] button')];
  assert.deepEqual(chips().map(text), ['All3', 'Branch1', 'List item1', 'Pull request1']);
  click(chips()[3]);
  await wait();
  assert.deepEqual([...noteRoot().querySelectorAll('[data-note]')].map(r => r.dataset.note), ['n3']);
  assert.equal(data.noteOpen, 'n3');
  assert.match(text(head(noteRoot())), /^Pull request/);
  click(chips()[3]);
  await wait();
  assert.equal(data.noteKind, '', 'a second tap lets the chip go');
});
