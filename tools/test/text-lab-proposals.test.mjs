// text-lab-proposals.test.mjs: the central proposal browser delegates to the
// same collection reader as the FAB and stays addressable without claiming an
// apply operation.

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
  { id: 'phrase-1', from: { text_id: 'from-1', text: 'families' }, to: { text_id: 'to-1', text: 'bill-section families' },
    author: 'guarded editorial pass', purpose: 'qualify' },
  { id: 'audit-1', from: { text_id: 'from-2', text: 'converting to and from' }, to: { text_id: 'to-2', text: 'converting text to and from compressed form' },
    author: 'doc-audit', purpose: 'repair' },
  { id: 'grok-1', from: { text_id: 'from-3', text: 'A long paragraph.' }, to: { text_id: 'to-3', text: 'A paragraph.' },
    author: 'Chief of Staff (Grok)', purpose: 'half-length' },
];

const INDEX = {
  rows: ROWS,
  proposals: ROWS,
  summary: {
    texts: 6,
    proposals: 3,
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
      if (!id.startsWith('proposal-')) return null;
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

test('proposals is visible without changing the Probes landing', () => {
  const plain = harness().model;
  assert.equal(plain.pane, 'probes');
  assert.equal([...plain.PANES].join(','), 'probes,proposals,instruments,resources,runs');
  const linked = harness('?proposal=audit-1').model;
  assert.equal(linked.pane, 'proposals', 'a proposal id is the stronger pane address');
  assert.equal(linked.proposalOpen, 'audit-1');
});

test('the pane loads the collection reader once, and nothing else', async () => {
  const h = harness('?pane=proposals');
  h.model.home = { repo: 'mehrlander/home', ref: 'main' };
  await h.model.loadProposals();
  await h.model.loadProposals();
  assert.equal(h.loads.join(','), 'kits/text-collection.js');
  assert.equal(h.model.proposalState, 'done');
  assert.equal(h.model.proposalTotal, 3);
});

test('search and facets are delegated, grouped by purpose, and deep links stay visible', () => {
  const h = harness('?pane=proposals&q=families&author=guarded%20editorial%20pass&purpose=qualify');
  h.model.proposalIndex = INDEX;
  h.model.proposalState = 'done';
  assert.equal(h.model.proposalRows.map(row => row.id).join(','), 'phrase-1');
  assert.equal(h.model.proposalGroups().map(group => group.purpose).join(','), 'qualify');
  assert.deepEqual(h.model.proposalFacet('purpose').map(row => row.key), ['half-length', 'qualify', 'repair'],
    'facets are the collection\'s own values, counted');
  h.model.proposalQ = 'nothing matches';
  h.model.proposalOpen = 'audit-1';
  assert.equal(h.model.proposalRows[0].id, 'audit-1', 'the exact proposal address wins over stale search filters');
});

test('a proposal deep link scrolls its expanded row into view after loading', async () => {
  const h = harness('?proposal=audit-1');
  h.model.home = { repo: 'mehrlander/home', ref: 'main' };
  await h.model.loadProposals();
  assert.deepEqual(h.scrolls, [{ id: 'proposal-audit-1', options: { block: 'start' } }]);
});

test('proposal state round-trips through the address', () => {
  const h = harness('?use=branch&data=home-branch');
  h.model.pane = 'proposals';
  h.model.proposalQ = 'families';
  h.model.proposalAuthor = 'doc-audit';
  h.model.proposalPurpose = 'repair';
  h.model.toggleProposal('audit-1');
  const url = new URL(h.location.href);
  assert.equal(url.searchParams.get('use'), 'branch');
  assert.equal(url.searchParams.get('data'), 'home-branch');
  assert.equal(url.searchParams.get('pane'), 'proposals');
  assert.equal(url.searchParams.get('q'), 'families');
  assert.equal(url.searchParams.get('author'), 'doc-audit');
  assert.equal(url.searchParams.get('purpose'), 'repair');
  assert.equal(url.searchParams.get('proposal'), 'audit-1');
  h.model.setProposalFilter('purpose', 'qualify');
  const filtered = new URL(h.location.href);
  assert.equal(filtered.searchParams.get('purpose'), 'qualify');
  assert.equal(filtered.searchParams.has('proposal'), false,
    'changing the result set closes a detail that may no longer belong to it');
});

test('a facet the collection does not hold is dropped once the collection is read', async () => {
  const h = harness('?pane=proposals&author=nobody&purpose=impossible');
  h.model.normalizeProposalParams();
  assert.equal(h.model.proposalAuthor, 'nobody', 'before the load nothing is known to be invalid');
  h.model.home = { repo: 'mehrlander/home', ref: 'main' };
  await h.model.loadProposals();
  assert.equal(h.model.proposalAuthor, '');
  assert.equal(h.model.proposalPurpose, '');
  const url = new URL(h.location.href);
  assert.equal(url.searchParams.has('author'), false);
  assert.equal(url.searchParams.has('purpose'), false);
});

test('the markup shows the four fields and never offers Apply', () => {
  assert.match(SRC, /x-show="pane === 'proposals'"/);
  assert.match(SRC, /Search proposals/);
  assert.match(SRC, /Proposed replacement/);
  assert.match(SRC, />Purpose</);
  assert.match(SRC, />Author</);
  assert.match(SRC, /prior work, not an automatic recommendation/);
  assert.match(SRC, /:id="'proposal-' \+ p\.id"/, 'each stable proposal address resolves to a DOM target');
  assert.doesNotMatch(SRC, />\s*apply\s*</i);
  assert.doesNotMatch(SRC, /lane|Provenance|Relocation|Evidence/, 'nothing the collection does not carry is drawn');
  assert.match(SRC, /if \(!this\.proposalIndex \|\| !window\.TextCollection\) return \[\]/,
    'hidden Alpine expressions have a null-safe getter');
  assert.match(SRC, /const pane = this\.PANES\.includes\(name\)/,
    'async pane work keeps the pane that initiated it instead of rereading mutable state');
});
