// text-lab-proposals.test.mjs: the central proposal browser delegates to the
// same source projection as the FAB and stays addressable without claiming an
// apply operation or the whole private text collection.

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
  {
    id: 'phrase-1', lane: 'phrase-reviews', action: 'qualify',
    from: { text_id: 'from-1', text: 'families' },
    to: { text_id: 'to-1', text: 'bill-section families' },
    author: 'phrase import', purpose: 'Imported qualify recommendation',
    origins: [{
      scope: 'source-occurrence', record: 1,
      source: { path: 'runs/phrases.csv', sha: 'abcdef012345', url: 'https://example.test/phrases' },
      context: { section: 'A1', markdown: 'The surrounding passage.' },
    }],
  },
  {
    id: 'audit-1', lane: 'audit-packet', action: 'repair',
    from: { text_id: 'from-2', text: 'converting to and from' },
    to: { text_id: 'to-2', text: 'converting text to and from compressed form' },
    author: 'audit import', purpose: 'repair',
    origins: [{
      scope: 'source-occurrence', record: 'r04', rationale: 'Name the referent.',
      source: { path: 'runs/packet.json', sha: '9876543210ab', url: 'https://example.test/packet' },
      patient: { repo: 'mehrlander/web-tools', path: 'README.md', url: 'https://example.test/readme' },
    }],
  },
];

function harness(search = '') {
  const address = new URL(`https://example.test/pages/text-lab.html${search}`);
  const location = {
    href: address.href,
    search: address.search,
    hostname: address.hostname,
  };
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
  window.TextProposals = {
    load: async () => INDEX,
    search(index, { q = '', lane = '', action = '' } = {}) {
      const needle = q.toLowerCase();
      return index.rows.filter(row =>
        (!lane || row.lane === lane)
        && (!action || row.action === action)
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
  const Alpine = { data(name, fn) {
    assert.equal(name, 'textInstruments');
    factory = fn;
  } };
  const params = new URLSearchParams(location.search);
  new Function('document', 'Alpine', 'window', 'params', 'location', 'history', 'gh', MODEL)(
    document, Alpine, window, params, location, history, gh);
  assert.equal(typeof factory, 'function', 'the inline model registered');
  const model = factory();
  model.$nextTick = fn => fn();
  return { model, window, location, history, loads, scrolls };
}

const INDEX = {
  rows: ROWS,
  proposals: ROWS,
  summary: {
    proposals: 2,
    by_lane: { 'phrase-reviews': 1, 'audit-packet': 1 },
    by_action: { qualify: 1, repair: 1 },
  },
};

test('proposals is visible without changing the Probes landing', () => {
  const plain = harness().model;
  assert.equal(plain.pane, 'probes');
  assert.equal([...plain.PANES].join(','), 'probes,proposals,instruments,resources,runs');

  const linked = harness('?proposal=audit-1').model;
  assert.equal(linked.pane, 'proposals', 'a proposal id is the stronger pane address');
  assert.equal(linked.proposalOpen, 'audit-1');
});

test('the pane lazy-loads the shared projection once', async () => {
  const h = harness('?pane=proposals');
  h.model.home = { repo: 'mehrlander/home', ref: 'main' };
  await h.model.loadProposals();
  await h.model.loadProposals();

  assert.equal(h.loads.join(','), 'kits/csv.js,kits/text-proposals.js');
  assert.equal(h.model.proposalState, 'done');
  assert.equal(h.model.proposalTotal, 2);
});

test('search and facets are delegated, grouped, and deep links stay visible', () => {
  const h = harness('?pane=proposals&q=families&lane=phrase-reviews&action=qualify');
  h.model.proposalIndex = INDEX;
  h.model.proposalState = 'done';
  assert.equal(h.model.proposalRows.map(row => row.id).join(','), 'phrase-1');
  assert.equal(h.model.proposalGroups().map(group => group.label).join(','), 'Phrase reviews');

  h.model.proposalQ = 'nothing matches';
  h.model.proposalOpen = 'audit-1';
  assert.equal(h.model.proposalRows[0].id, 'audit-1',
    'the exact proposal address wins over stale search filters');

});

test('a proposal deep link scrolls its expanded row into view after loading', async () => {
  const h = harness('?proposal=audit-1');
  h.model.home = { repo: 'mehrlander/home', ref: 'main' };
  await h.model.loadProposals();
  assert.deepEqual(h.scrolls, [
    { id: 'proposal-audit-1', options: { block: 'start' } },
  ]);
});

test('proposal state round-trips through the address', () => {
  const h = harness('?use=branch&data=home-branch');
  h.model.pane = 'proposals';
  h.model.proposalQ = 'families';
  h.model.proposalLane = 'phrase-reviews';
  h.model.proposalAction = 'qualify';
  h.model.toggleProposal('phrase-1');

  const url = new URL(h.location.href);
  assert.equal(url.searchParams.get('use'), 'branch');
  assert.equal(url.searchParams.get('data'), 'home-branch');
  assert.equal(url.searchParams.get('pane'), 'proposals');
  assert.equal(url.searchParams.get('q'), 'families');
  assert.equal(url.searchParams.get('lane'), 'phrase-reviews');
  assert.equal(url.searchParams.get('action'), 'qualify');
  assert.equal(url.searchParams.get('proposal'), 'phrase-1');

  h.model.setProposalFilter('action', 'repair');
  const filtered = new URL(h.location.href);
  assert.equal(filtered.searchParams.get('action'), 'repair');
  assert.equal(filtered.searchParams.has('proposal'), false,
    'changing the result set closes a detail that may no longer belong to it');
});

test('invalid proposal facets normalize to the visible all-state labels', () => {
  const h = harness('?pane=proposals&lane=unknown&action=impossible');
  h.model.normalizeProposalParams();
  assert.equal(h.model.proposalLane, '');
  assert.equal(h.model.proposalAction, '');
  const url = new URL(h.location.href);
  assert.equal(url.searchParams.has('lane'), false);
  assert.equal(url.searchParams.has('action'), false);
});

test('the markup exposes provenance and never offers Apply', () => {
  assert.match(SRC, /x-show="pane === 'proposals'"/);
  assert.match(SRC, /Search proposals/);
  assert.match(SRC, /Original text/);
  assert.match(SRC, /Prior revision/);
  assert.match(SRC, /Provenance/);
  assert.match(SRC, /Imported review/);
  assert.match(SRC, /Relocation/);
  assert.match(SRC, /Evidence/);
  assert.match(SRC, /prior work, not an automatic recommendation/);
  assert.match(SRC, /:id="'proposal-' \+ p\.id"/,
    'each stable proposal address resolves to a DOM target');
  assert.doesNotMatch(SRC, />\s*apply\s*</i);
  assert.match(SRC, /if \(!this\.proposalIndex \|\| !window\.TextProposals\) return \[\]/,
    'hidden Alpine expressions have a null-safe getter');
  assert.match(SRC, /const pane = this\.PANES\.includes\(name\)/,
    'async pane work keeps the pane that initiated it instead of rereading mutable state');
});

test('local model proposals have a visible group and addressable objective filters', () => {
  const h = harness('?pane=proposals&lane=local-proposals&action=clarity');
  h.model.proposalIndex = { ...INDEX, rows: [{ ...ROWS[0], id: 'local-1', lane: 'local-proposals', action: 'clarity' }] };
  assert.equal(h.model.proposalRows.length, 1);
  assert.equal(h.model.proposalGroups()[0].label, 'Local models');
  assert.equal(h.model.PROPOSAL_LANES.some(row => row.key === 'local-proposals'), true);
  assert.equal(h.model.PROPOSAL_ACTIONS.some(row => row.key === 'half'), true);
});
