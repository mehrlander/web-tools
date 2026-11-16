// alpineComponents/estate.js — a session that worked in a HIDDEN repo.
//
// The registry's `hidden` list keeps a repo out of the sidebar, the nav, the
// Repos grid and the activity crawl. The Sessions view honours it too: a row
// whose `repos` names a hidden repo stays out of the rows, the tree and the
// counts until the Hidden chip shows it, and `attached` (every checkout the
// container held) does not count as working there.
//
// Driven over the same fake GH as estate-session-scope; no network, no pixels.

import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWindow, startAlpine } from './bootstrap.mjs';

const REGISTRY = 'me/registry';

class FakeGH {
  constructor(conf = {}) { this.repo = conf.repo || ''; this.ref = conf.ref || 'main'; }
  ago() { return 'just now'; }
  async repos() { return []; }
  async ls() { return []; }
  async get() { throw Object.assign(new Error('404'), { status: 404 }); }
  async req() { return { default_branch: 'main' }; }
  async save() { return {}; }
}

const { window } = makeWindow({
  html: `<!doctype html><html><body><div id="es" x-data="estate()"></div></body></html>`,
});
window.TOKEN = 'tkn';
window.GH = FakeGH;
window.gh = { load: async () => {} };
window.__shell = {
  REGISTRY_REPO: REGISTRY, DEFAULT_REPO: 'me/tools', quickLinks: [],
  hasToken: () => true, _authState: 'auth', view: 'activity',
  refreshConfigCache() {}, refreshActivity() {}, refreshSessions() {},
  anchorMenu: () => ({}),
  estateHidden: ['mehrlander/fun'], estateHiddenReady: true,
};

const Alpine = await startAlpine(window, [
  'lib/alpine-bundle.js',
  'lib/kits/closing-state.js',
  'lib/kits/repo-sessions-cache.js',
  'lib/kits/surface.js',
  'lib/kits/branch-status.js',
  'lib/kits/prompt-link.js',
  'lib/alpineComponents/estate.js',
]);

const data = Alpine.$data(window.document.getElementById('es'));
const now = new Date().toISOString();
const row = (id, repos, attached = []) => ({
  id, day: now.slice(0, 10), started: now, ended: now,
  repos: repos.map(name => ({ name, branch: 'main', lines: 10 })), attached,
});

data.sessionRows_ = [
  row('aaaaaaaa', ['web-tools']),
  row('bbbbbbbb', ['fun', 'web-tools']),
  // Held fun in its container but never stood in it: not hidden.
  row('cccccccc', ['web-tools-private'], ['fun', 'web-tools-private']),
];
data.sessionScope = 'all';

// Read back through $data, everything is a reactive proxy; compare plain copies.
const ids = rows => JSON.parse(JSON.stringify(rows.map(r => r.id))).sort();

test('a session that worked in a hidden repo leaves the rows and the tree', () => {
  assert.deepEqual(ids(data.scopedSessions), ['aaaaaaaa', 'cccccccc']);
  assert.deepEqual(ids(data.sessionNodes.filter(n => n.row).map(n => n.row)), ['aaaaaaaa', 'cccccccc']);
  assert.equal(data.sessionRepos.some(r => r.repo === 'fun'), false, 'no chip for the hidden repo');
});

test('the Hidden chip counts it, and showing brings it back with its repo chip', () => {
  assert.equal(data.hiddenSessionCount, 1);
  data.showHiddenSessions = true;
  try {
    assert.deepEqual(ids(data.scopedSessions), ['aaaaaaaa', 'bbbbbbbb', 'cccccccc']);
    assert.deepEqual(ids(data.sessionNodes.filter(n => n.row).map(n => n.row)), ['aaaaaaaa', 'bbbbbbbb', 'cccccccc']);
    assert.equal(data.sessionRepos.some(r => r.repo === 'fun'), true);
  } finally {
    data.showHiddenSessions = false;
  }
});

test('with nothing hidden every session shows and the chip has nothing to count', () => {
  window.__shell.estateHidden = [];
  try {
    assert.equal(data.hiddenSessionCount, 0);
    assert.deepEqual(ids(data.scopedSessions), ['aaaaaaaa', 'bbbbbbbb', 'cccccccc']);
  } finally {
    window.__shell.estateHidden = ['mehrlander/fun'];
  }
});
