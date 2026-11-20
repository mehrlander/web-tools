// alpineComponents/estate.js — a session that worked in a HIDDEN repo.
//
// The registry's `hidden` list keeps a repo out of the sidebar, the nav, the
// Repos grid and the activity crawl. The Sessions view honours it too: a row
// whose `repos` names a hidden repo stays out of the rows, the tree and the
// counts, with no control on the pane to bring it back, and `attached` (every
// checkout the container held) does not count as working there.
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
  accountRepoNames: ['mehrlander/budget-drs-acfr', 'mehrlander/site.github.io'],
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

test('the pane has no control that shows it again', () => {
  assert.equal('showHiddenSessions' in data, false);
  assert.equal('hiddenSessionCount' in data, false);
});

test('with nothing hidden every session shows, its repo chip included', () => {
  window.__shell.estateHidden = [];
  try {
    assert.equal(data.sessionRepos.some(r => r.repo === 'fun'), true);
    assert.deepEqual(ids(data.scopedSessions), ['aaaaaaaa', 'bbbbbbbb', 'cccccccc']);
  } finally {
    window.__shell.estateHidden = ['mehrlander/fun'];
  }
});

test('a renamed folder is read as the repo it was cloned from', () => {
  // budget-drs-acfr.partial: a sparse clone a session renamed, recorded under
  // the folder's name before record.py named checkouts by their origin.
  assert.equal(data.knownRepoName('budget-drs-acfr.partial'), 'budget-drs-acfr');
  assert.equal(data.knownRepoName('site.github.io'), 'site.github.io', 'a repo whose own name has a dot keeps it');
  assert.equal(data.knownRepoName('notes.bak'), 'notes.bak', 'a stem the account has no repo by is left alone');
  assert.equal(data.sessionRepoName({ name: 'mehrlander/budget-drs-acfr.partial' }), 'budget-drs-acfr');
});

test('?showhidden= shows hidden repos without touching the stored list', () => {
  const U = window.RepoSessionsCache.unhide, hid = new Set(['fun', 'drop']);
  const left = (q) => JSON.parse(JSON.stringify([...U(hid, q)])).sort();
  assert.deepEqual(left(''), ['drop', 'fun'], 'no parameter: the list stands');
  assert.deepEqual(left('?showhidden=1'), [], 'showhidden=1 shows every hidden repo');
  assert.deepEqual(left('?showhidden=mehrlander/fun'), ['drop'], 'a full name names its repo');
  const setQuery = (q) => window.history.replaceState(null, '', q);
  try {
    setQuery('?view=sessions&showhidden=fun');
    assert.deepEqual(ids(data.scopedSessions), ['aaaaaaaa', 'bbbbbbbb', 'cccccccc'], 'the pane shows the named repo');
    assert.deepEqual(window.__shell.estateHidden, ['mehrlander/fun'], 'the stored list is untouched');
  } finally {
    setQuery('?view=sessions');
  }
  assert.deepEqual(ids(data.scopedSessions), ['aaaaaaaa', 'cccccccc'], 'without the parameter it is hidden again');
});
