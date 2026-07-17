// alpineComponents/estate.js — logic-level tests for the estate's row layout
// and card nesting: group-to-row assignment from the registry's estate.rows
// (defaults, wildcard, leftover groups), and estate.nest folding a companion
// repo into its parent's card. Driven over a fake GH and a stubbed shell; no
// network, no pixels.

import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWindow, startAlpine } from './bootstrap.mjs';

// The registry config each load() reads; tests swap it between loads.
let REGISTRY = {};

class FakeGH {
  constructor(conf = {}) { this.repo = conf.repo || ''; this.ref = conf.ref || 'main'; }
  ago() { return 'recently'; }
  async get(name) {
    if (this.repo === 'me/registry' && name === '.web-tools.json') return { text: JSON.stringify(REGISTRY) };
    throw new Error('404');
  }
  async ls() { throw new Error('404'); }             // no surfaces dir
  async req(path) {
    if (path.startsWith('/repos/')) return { default_branch: 'main', description: '', private: true, pushed_at: '' };
    throw new Error('unexpected ' + path);
  }
}

const { window, problems } = makeWindow({
  html: `<!doctype html><html><body>
    <div id="es" x-data="estate()"></div>
  </body></html>`,
});
window.TOKEN = 'tkn';
window.GH = FakeGH;
window.__shell = {
  REGISTRY_REPO: 'me/registry',
  DEFAULT_REPO: 'me/tools',
  quickLinks: [],
  hasToken: () => true,
  _authState: 'auth',
};

const Alpine = await startAlpine(window, [
  'lib/alpine-bundle.js',
  'lib/alpineComponents/estate.js',
]);

const data = Alpine.$data(window.document.getElementById('es'));
const plain_ = (v) => JSON.parse(JSON.stringify(v));
const rowNames = () => plain_(data.rows.map(r => r.map(e => e.repo)));

const REPOS = [
  { repo: 'me/home', group: 'core' },
  { repo: 'me/tools', group: 'core' },
  { repo: 'me/registry', group: 'core' },
  { repo: 'me/archive', group: 'archives' },
  { repo: 'me/data-a', group: 'data' },
  { repo: 'me/data-b', group: 'data' },
  { repo: 'me/gadgets', group: 'tools' },
];

test('mounts with no startup warnings or errors', () => {
  assert.deepEqual(problems, []);
  assert.ok(data.description.length > 0);
});

test('default layout: core+archives lead, the rest on row two; registry nests under the home repo', async () => {
  REGISTRY = { repos: REPOS };
  await data.load();
  assert.deepEqual(rowNames(), [
    ['me/home', 'me/tools', 'me/archive'],           // registry nested away
    ['me/data-a', 'me/data-b', 'me/gadgets'],
  ]);
  const parent = data.entries.find(e => e.repo === 'me/tools');
  assert.equal(parent.child?.repo, 'me/registry');
});

test('estate.rows overrides membership and order; * collects the unnamed groups', async () => {
  REGISTRY = { repos: REPOS, estate: { rows: [['data'], ['*']] } };
  await data.load();
  assert.deepEqual(rowNames(), [
    ['me/data-a', 'me/data-b'],
    ['me/home', 'me/tools', 'me/archive', 'me/gadgets'],
  ]);
});

test('groups no row names append as a trailing row instead of dropping', async () => {
  REGISTRY = { repos: REPOS, estate: { rows: [['core']] } };
  await data.load();
  assert.deepEqual(rowNames(), [
    ['me/home', 'me/tools'],
    ['me/archive', 'me/data-a', 'me/data-b', 'me/gadgets'],
  ]);
});

test('estate.nest overrides the default pairing; empty nest splits the cards apart', async () => {
  REGISTRY = { repos: REPOS, estate: { nest: { 'me/data-b': 'me/data-a' } } };
  await data.load();
  assert.deepEqual(rowNames()[1], ['me/data-a', 'me/gadgets']);
  assert.equal(data.entries.find(e => e.repo === 'me/data-a').child?.repo, 'me/data-b');
  assert.ok(rowNames()[0].includes('me/registry'), 'registry keeps its own card when nest names other repos');

  REGISTRY = { repos: REPOS, estate: { nest: {} } };
  await data.load();
  assert.deepEqual(rowNames()[0], ['me/home', 'me/tools', 'me/registry', 'me/archive']);
});

test('quickLinks fallback (no repos list) still renders, groupless, on one row', async () => {
  REGISTRY = { quickLinks: [{ repo: 'me/tools', icon: 'ph-toolbox' }, { repo: 'me/home', icon: 'ph-house' }] };
  await data.load();
  assert.deepEqual(rowNames(), [['me/tools', 'me/home']]);
});
