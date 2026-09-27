// text-lab-variants.test.mjs: the central variant browser delegates to the
// same collection reader as the FAB, stays addressable (including by the
// pre-rename ?proposal= address), shows each file a variant is proposed for,
// and never claims an apply operation.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = readFileSync(path.join(root, 'pages/text-lab.html'), 'utf8');

// Exercise the real inline Alpine model without booting the page or reaching a
// network. The module has one alpine:init registration block between these two
// stable statements; its closure takes only the objects supplied below.
const start = SRC.indexOf("document.addEventListener('alpine:init'");
const stop = SRC.indexOf("await gh.load('alpine-bundle.js')", start);
assert.ok(start >= 0 && stop > start, 'the Text Lab Alpine model is extractable');
const MODEL = SRC.slice(start, stop);

const ROWS = [
  { id: 'phrase-1', from: { passage_id: 'from-1', text: 'families' }, to: { passage_id: 'to-1', text: 'bill-section families' },
    author: 'guarded editorial pass', purpose: 'qualify',
    proposals: [{ repo: 'mehrlander/web-tools', path: 'docs/text-tools.md', basis: 'https://github.com/mehrlander/web-tools/pull/1' }] },
  { id: 'audit-1', from: { passage_id: 'from-2', text: 'converting to and from' }, to: { passage_id: 'to-2', text: 'converting text to and from compressed form' },
    author: 'doc-audit', purpose: 'repair' },
  { id: 'grok-1', from: { passage_id: 'from-3', text: 'A long paragraph.' }, to: { passage_id: 'to-3', text: 'A paragraph.' },
    author: 'Chief of Staff (Grok)', purpose: 'half-length' },
];

const INDEX = {
  rows: ROWS,
  variants: ROWS,
  proposals: [],
  summary: {
    passages: 6,
    variants: 3,
    proposals: 1,
    by_author: { 'guarded editorial pass': 1, 'doc-audit': 1, 'Chief of Staff (Grok)': 1 },
    by_purpose: { qualify: 1, repair: 1, 'half-length': 1 },
  },
};

function harness(search = '') {
  const address = new URL(`https://example.test/pages/text-lab.html${search}`);
  const location = { href: address.href, search: address.search, hostname: address.hostname };
  const history = {
    writes: [],
    replaceState(_state, _title, value) {
      location.href = String(value);
      location.search = new URL(location.href).search;
      this.writes.push(location.href);
    },
  };
  const loads = [];
  const gh = { load: async name => { loads.push(name); } };
  const window = {};
  window.self = window;
  window.top = window;
  window.TOKEN = '';
  window.TextCollection = {
    load: async () => INDEX,
    search(index, { q = '', author = '', purpose = '' } = {}) {
      const needle = q.toLowerCase();
      return index.rows.filter(row =>
        (!author || row.author === author)
        && (!purpose || row.purpose === purpose)
        && (!needle || `${row.from.text}\n${row.to.text}`.toLowerCase().includes(needle)));
    },
    view(index, id) { return index.rows.find(row => row.id === id) || null; },
  };
  const scrolls = [];
  const document = {
    addEventListener(_name, fn) { fn(); },
    getElementById(id) {
      if (!id.startsWith('variant-')) return null;
      return { scrollIntoView(options) { scrolls.push({ id, options }); } };
    },
  };
  let factory = null;
  const Alpine = { data(name, fn) { assert.equal(name, 'textInstruments'); factory = fn; } };
  const params = new URLSearchParams(location.search);
  new Function('document', 'Alpine', 'window', 'params', 'location', 'history', 'gh', MODEL)(
    document, Alpine, window, params, location, history, gh);
  assert.equal(typeof factory, 'function', 'the inline model registered');
  const model = factory();
  model.$nextTick = fn => fn();
  return { model, window, location, history, loads, scrolls };
}

test('variants is visible without changing the Probes landing', () => {
  const plain = harness().model;
  assert.equal(plain.pane, 'probes');
  assert.equal([...plain.PANES].join(','), 'probes,variants,instruments,resources,runs');
  const linked = harness('?variant=audit-1').model;
  assert.equal(linked.pane, 'variants', 'a variant id is the stronger pane address');
  assert.equal(linked.variantOpen, 'audit-1');
});

test('the pre-rename ?proposal= and ?pane=proposals addresses open the same row and are rewritten', () => {
  const h = harness('?use=branch&proposal=audit-1&q=converting');
  assert.equal(h.model.pane, 'variants');
  assert.equal(h.model.variantOpen, 'audit-1');
  h.model.migrateLegacyAddress();
  const url = new URL(h.location.href);
  assert.equal(url.searchParams.get('variant'), 'audit-1');
  assert.equal(url.searchParams.has('proposal'), false);
  assert.equal(url.searchParams.get('pane'), 'variants');
  assert.equal(url.searchParams.get('use'), 'branch', 'other params ride through');
  assert.equal(url.searchParams.get('q'), 'converting');
  const pane = harness('?pane=proposals');
  assert.equal(pane.model.pane, 'variants');
  pane.model.migrateLegacyAddress();
  assert.equal(new URL(pane.location.href).searchParams.get('pane'), 'variants');
  const current = harness('?variant=audit-1');
  current.model.migrateLegacyAddress();
  assert.equal(current.history.writes.length, 0, 'a current address is left alone');
});

test('the pane loads the collection reader once, and nothing else', async () => {
  const h = harness('?pane=variants');
  h.model.home = { repo: 'mehrlander/home', ref: 'main' };
  await h.model.loadVariants();
  await h.model.loadVariants();
  assert.equal(h.loads.join(','), 'kits/text-collection.js');
  assert.equal(h.model.variantState, 'done');
  assert.equal(h.model.variantTotal, 3);
});

test('search and facets are delegated, grouped by purpose, and deep links stay visible', () => {
  const h = harness('?pane=variants&q=families&author=guarded%20editorial%20pass&purpose=qualify');
  h.model.variantIndex = INDEX;
  h.model.variantState = 'done';
  assert.equal(h.model.variantRows.map(row => row.id).join(','), 'phrase-1');
  assert.equal(h.model.variantGroups().map(group => group.purpose).join(','), 'qualify');
  assert.deepEqual(h.model.variantFacet('purpose').map(row => row.key), ['half-length', 'qualify', 'repair'],
    'facets are the collection\'s own values, counted');
  h.model.variantQ = 'nothing matches';
  h.model.variantOpen = 'audit-1';
  assert.equal(h.model.variantRows[0].id, 'audit-1', 'the exact variant address wins over stale search filters');
});

test('a variant deep link scrolls its expanded row into view after loading', async () => {
  const h = harness('?variant=audit-1');
  h.model.home = { repo: 'mehrlander/home', ref: 'main' };
  await h.model.loadVariants();
  assert.deepEqual(h.scrolls, [{ id: 'variant-audit-1', options: { block: 'start' } }]);
});

test('variant state round-trips through the address', () => {
  const h = harness('?use=branch&data=home-branch');
  h.model.pane = 'variants';
  h.model.variantQ = 'families';
  h.model.variantAuthor = 'doc-audit';
  h.model.variantPurpose = 'repair';
  h.model.toggleVariant('audit-1');
  const url = new URL(h.location.href);
  assert.equal(url.searchParams.get('use'), 'branch');
  assert.equal(url.searchParams.get('data'), 'home-branch');
  assert.equal(url.searchParams.get('pane'), 'variants');
  assert.equal(url.searchParams.get('q'), 'families');
  assert.equal(url.searchParams.get('author'), 'doc-audit');
  assert.equal(url.searchParams.get('purpose'), 'repair');
  assert.equal(url.searchParams.get('variant'), 'audit-1');
  h.model.setVariantFilter('purpose', 'qualify');
  const filtered = new URL(h.location.href);
  assert.equal(filtered.searchParams.get('purpose'), 'qualify');
  assert.equal(filtered.searchParams.has('variant'), false,
    'changing the result set closes a detail that may no longer belong to it');
});

test('a facet the collection does not hold is dropped once the collection is read', async () => {
  const h = harness('?pane=variants&author=nobody&purpose=impossible');
  h.model.normalizeVariantParams();
  assert.equal(h.model.variantAuthor, 'nobody', 'before the load nothing is known to be invalid');
  h.model.home = { repo: 'mehrlander/home', ref: 'main' };
  await h.model.loadVariants();
  assert.equal(h.model.variantAuthor, '');
  assert.equal(h.model.variantPurpose, '');
  const url = new URL(h.location.href);
  assert.equal(url.searchParams.has('author'), false);
  assert.equal(url.searchParams.has('purpose'), false);
});

test('the markup shows the four fields and never offers Apply', () => {
  assert.match(SRC, /x-show="pane === 'variants'"/);
  assert.match(SRC, /Search variants/);
  assert.match(SRC, />Variant</);
  assert.match(SRC, />Purpose</);
  assert.match(SRC, />Author</);
  assert.match(SRC, /prior work, not an automatic recommendation/);
  assert.match(SRC, /:id="'variant-' \+ p\.id"/, 'each stable variant address resolves to a DOM target');
  assert.doesNotMatch(SRC, />\s*apply\s*</i);
  assert.doesNotMatch(SRC, /lane|Provenance|Relocation|Evidence/, 'nothing the collection does not carry is drawn');
  assert.match(SRC, /if \(!this\.variantIndex \|\| !window\.TextCollection\) return \[\]/,
    'hidden Alpine expressions have a null-safe getter');
  assert.match(SRC, /const pane = this\.PANES\.includes\(name\)/,
    'async pane work keeps the pane that initiated it instead of rereading mutable state');
});

test('a variant with proposals shows a chip per target path, linking the basis', () => {
  const chips = SRC.slice(SRC.indexOf('data-variant-proposals'));
  assert.match(chips, /x-for="q in p\.proposals"/);
  assert.match(chips, /x-text="q\.path"/, 'the chip names the target path');
  assert.match(chips, /:href="safeHref\(q\.basis\)"/, 'and links the basis');
  const { model } = harness();
  assert.equal(model.safeHref('https://github.com/mehrlander/web-tools/pull/1'), 'https://github.com/mehrlander/web-tools/pull/1');
  assert.equal(model.safeHref('javascript:alert(1)'), null, 'a basis that is not a web address gets no link');
});

test('the variants deck reads the filtered rows and keeps its place in the address', async () => {
  const h = harness('?pane=variants&purpose=repair&deck=variants&at=4');
  const opened = [];
  h.window.swipeDeck = { open: o => { opened.push(o); return {}; }, h: () => ({}) };
  h.model.home = { repo: 'mehrlander/home', ref: 'main' };
  await h.model.loadVariants();
  await new Promise(r => setTimeout(r, 0));
  assert.equal(opened.length, 1, 'an addressed deck reopens once the collection is read');
  assert.equal(opened[0].count, 1, 'the deck holds the filtered rows, not the collection');
  assert.equal(opened[0].start, 0, 'a slide past the end is clamped to the last one');
  assert.equal(opened[0].subtitle, 'repair · every author');
  assert.ok(h.loads.includes('kits/swipe-deck.js'));
  opened[0].onSlide(0);
  assert.equal(new URL(h.location.href).searchParams.get('deck'), 'variants');
  opened[0].onClose();
  const closed = new URL(h.location.href);
  assert.equal(closed.searchParams.has('deck'), false);
  assert.equal(closed.searchParams.has('at'), false);
  assert.equal(closed.searchParams.get('purpose'), 'repair', 'closing the deck keeps the filters');
});

test('text runs are the run folders that declare their files, newest first', async () => {
  const h = harness('?pane=runs');
  const files = [
    { repo: 'mehrlander/web-tools', path: 'CLAUDE.md', words_before: 10, words_after: 8, variants: 3 },
    { repo: 'mehrlander/home', path: 'CLAUDE.md', words_before: 20, words_after: 15, variants: 4 },
  ];
  h.model.home = {
    req: async () => [
      { type: 'dir', name: '2026-09-16-import' },
      { type: 'dir', name: '2026-09-27-behavior-trim' },
      { type: 'file', name: 'README.md' },
    ],
    get: async p => {
      if (p.endsWith('2026-09-27-behavior-trim/files.jsonl')) return { text: files.map(f => JSON.stringify(f)).join('\n') + '\n' };
      if (p.endsWith('2026-09-27-behavior-trim/README.md')) return { text: '# Behavior trim, 2026-09-27\n\nbody' };
      throw new Error('404');
    },
  };
  await h.model.loadTextRuns();
  assert.equal(h.model.textRuns.length, 1, 'a folder without files.jsonl is a run of another kind');
  const run = h.model.textRuns[0];
  assert.equal(run.title, 'Behavior trim, 2026-09-27');
  assert.equal(run.date, '2026-09-27');
  assert.equal(run.variants, 7);
  assert.equal(run.files.length, 2);
});

test('the markup offers the deck door on the list, each group, and each text run', () => {
  assert.equal((SRC.match(/ph-cards-three/g) || []).length >= 3, true);
  assert.match(SRC, /@click="openVariantDeck\(variantRows\)"/);
  assert.match(SRC, /@click="openRunDeck\(r\)"/);
  assert.match(SRC, /x-init="renderPair\(\$el, p\)"/, 'an open row shows the pair as md-diff draws it');
});
