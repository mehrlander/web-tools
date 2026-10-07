// alpineComponents/estate.js — what the branch reading does NOT cover.
//
// The crawl has stored `scanned`, `older` and `truncated` since the activity
// cache existed, and until 2026-09-09 nothing on the page read any of them. So
// every count on the Branches pane described a window while reading as a
// census: web-tools stored 30 rows against 401 older branches, home 30 against
// 425, and the estate's stranded reading covered its freshest fifth with
// nothing on screen to say so.
//
// The three limits are different in kind and the line has to keep them apart,
// which is what these tests hold:
//
//   pending    the per-pass budget ran out. Progress, not a ceiling: it falls
//              to zero over quiet crawls.
//   horizon    `keep` cut them, so they have no row at all. A setting.
//   by name    the branch WALK hit its own cap and cut ALPHABETICALLY. This one
//              invalidates the other two as recency statements, so it cannot be
//              summed into them.

import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWindow, startAlpine } from './bootstrap.mjs';

class StubGH {
  constructor(conf = {}) { this.repo = conf.repo || ''; this.ref = conf.ref || 'main'; }
  ago() { return 'recently'; }
  async get() { throw new Error('404'); }
  async ls() { throw new Error('404'); }
  async req() { return { default_branch: 'main', description: '', private: true, pushed_at: '' }; }
}

const { window } = makeWindow({
  html: `<!doctype html><html><body><div id="es" x-data="estate()"></div></body></html>`,
});
window.TOKEN = 'tkn';
window.GH = StubGH;
window.__shell = { REGISTRY_REPO: 'me/registry', DEFAULT_REPO: 'me/tools',
                   quickLinks: [], hasToken: () => true, _authState: 'auth',
                   ACTIVITY_SCAN_CAP: 30 };

const Alpine = await startAlpine(window, [
  'lib/alpine-bundle.js',
  'lib/kits/branch-status.js',
  'lib/kits/surface.js',
  'lib/alpineComponents/estate.js',
]);
const data = Alpine.$data(window.document.getElementById('es'));

const repo = (scan) => ({ defaultBranch: 'main', scan: { branches: [], ...scan } });

test('a fully covered estate says nothing at all', () => {
  data.activity = { 'acme/widget': repo({ pending: 0, beyondHorizon: 0, listCapped: false, listOrdered: true }) };
  assert.equal(data.branchReach.any, false, 'silence is the goal state, not a permanent apology');
});

test('a budget that ran out reads as progress, and is counted separately', () => {
  data.activity = { 'acme/widget': repo({ pending: 40, beyondHorizon: 0, listCapped: false, listOrdered: true }) };
  assert.equal(data.branchReach.pending, 40);
  assert.equal(data.branchReach.horizon, 0);
  assert.match(data.branchReachNote, /40 waiting on the next crawl/);
});

test('the stored horizon is a different limit and says so', () => {
  data.activity = { 'acme/widget': repo({ pending: 5, beyondHorizon: 120, listCapped: false, listOrdered: true }) };
  assert.match(data.branchReachNote, /5 waiting on the next crawl, 120 past the stored horizon/);
});

test('a walk cut ALPHABETICALLY is named by repo, since it voids the other two', () => {
  // The one limit that cannot be folded into a count. A sample chosen by name
  // is not a recency window, so "the freshest N" is a false sentence about it
  // and the line has to name the repo rather than add to a total.
  data.activity = {
    'acme/widget': repo({ pending: 0, beyondHorizon: 0, listCapped: true, listOrdered: false }),
    'acme/other': repo({ pending: 0, beyondHorizon: 0, listCapped: true, listOrdered: true }),
  };
  assert.deepEqual([...data.branchReach.byName], ['widget'], 'only the unordered one');
  assert.match(data.branchReachNote, /cut alphabetically, not by date/);
});

test('a cache written before the fields existed claims nothing either way', () => {
  // listOrdered null is "we do not know", which must not read as "cut by name".
  data.activity = { 'acme/widget': repo({ listCapped: true, listOrdered: null }) };
  assert.equal(data.branchReach.any, false);
});

test('the limits sum across repos, because the reading spans them', () => {
  data.activity = {
    'acme/widget': repo({ pending: 10, beyondHorizon: 100, listCapped: false, listOrdered: true }),
    'acme/other': repo({ pending: 7, beyondHorizon: 20, listCapped: false, listOrdered: true }),
  };
  assert.equal(data.branchReach.pending, 17);
  assert.equal(data.branchReach.horizon, 120);
});
