// alpineComponents/estate.js — `&set=`, the Sessions pane's named set.
//
// Every other narrowing on the pane is a QUERY: a time window, a repo, a
// closing state. None of them can express "these seven, because somebody read
// them and picked them", which is what a reply hands over once it has done the
// reading. A set is that list, carried in the address as short ids.
//
// It is a SCOPE rather than a fourth filter, and that choice is what these
// tests hold. Being a scope means the deck swipes it for free, since the deck's
// sequence has always been the visible list; it means the Table lens narrows to
// it wherever the grain is built off scopedSessions; and it means the chip row
// already had somewhere to put it. What a scope does not normally do is carry
// an order or outrun the pane's own data, and both of those get a test below.
//
// Driven over the same stub GH as estate-session-tree; no network, no pixels.

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
// The shell holds the spec, exactly as it holds `session` and `lens`; the
// component reads it and never writes it except through setSessionSet.
window.__shell = { REGISTRY_REPO: 'me/registry', DEFAULT_REPO: 'me/tools',
                   quickLinks: [], hasToken: () => true, _authState: 'auth',
                   sessionSetSpec: '',
                   setSessionSet(spec){ this.sessionSetSpec = spec || ''; } };

const Alpine = await startAlpine(window, [
  'lib/alpine-bundle.js',
  'lib/kits/branch-status.js',
  'lib/kits/surface.js',
  'lib/alpineComponents/estate.js',
]);
const data = Alpine.$data(window.document.getElementById('es'));

// Four records on four different days, so the tree's own newest-first order is
// unambiguous and any set order that survives it is the set's doing.
const record = (id, day) =>
  ({ id, agent: '', day, started: day + 'T00:00:00Z', ended: day + 'T01:00:00Z',
     repos: [], branches: [], mins: 60, ask: 'do a thing', state: 'ready' });

const ROWS = [record('aaa11111', '2026-08-10'), record('bbb22222', '2026-08-12'),
              record('ccc33333', '2026-08-14'), record('ddd44444', '2026-08-16')];

const seed = (spec) => {
  data.activity = { 'acme/widget': { defaultBranch: 'main', scan: { branches: [] } } };
  data.sessionRows_ = ROWS;
  data.sessionRepoFilter = '';
  data.sessionStateFilter = '';
  window.__shell.sessionSetSpec = spec;
  data.sessionScope = spec ? 'set' : 'all';
};

test('the spec parses to ids: trimmed, deduped, order kept', () => {
  seed(' ccc33333 , aaa11111,ccc33333 ,bbb22222 ');
  // Joined rather than deepEqual: every array off the component comes back as
  // an Alpine proxy, which assert/strict rejects for its prototype even when
  // the values match. The pane's other tests compare the same way.
  assert.equal(data.sessionSetIds.join(), 'ccc33333,aaa11111,bbb22222');
  assert.equal(data.sessionSetActive, true);
  seed('');
  assert.equal(data.sessionSetIds.join(), '');
  assert.equal(data.sessionSetActive, false);
});

test('a set narrows the list, and KEEPS ITS OWN ORDER against the tree', () => {
  // The tree sorts newest-first, which would be ddd, ccc, bbb, aaa. The set
  // names three of them in a different order, and that order is the one thing a
  // set carries which a filter cannot, so it has to survive.
  seed('aaa11111,ddd44444,bbb22222');
  assert.equal(data.sessionNodes.map(n => n.id).join(), 'aaa11111,ddd44444,bbb22222');
  // Any other scope goes back to the tree's order, so the set is not leaking a
  // sort into the rest of the pane.
  data.sessionScope = 'all';
  assert.equal(data.sessionNodes.map(n => n.id).join(), 'ddd44444,ccc33333,bbb22222,aaa11111');
});

test("the deck's sequence IS the set, which is why no second mechanism exists", () => {
  seed('ccc33333,aaa11111');
  assert.equal(data.sessionDeckRows.map(r => r.id).join(), 'ccc33333,aaa11111');
});

test('the Set chip leads the row and counts what the LINK named, not what matched', () => {
  seed('aaa11111,zzz99999');
  const chips = data.sessionScopes;
  assert.equal(chips[0].key, 'set');
  // Two named, one resolvable. A chip reporting 1 would hide the gap in the one
  // place a reader would take for a total.
  assert.equal(chips[0].count, 2);
  assert.equal(data.sessionNodes.map(n => n.id).join(), 'aaa11111');
  assert.equal(data.sessionSetMissing.join(), 'zzz99999');
  // With no set there is no chip for one, on the repo and state rows' contract.
  seed('');
  assert.ok(!data.sessionScopes.some(s => s.key === 'set'));
  assert.equal(data.sessionSetMissing.join(), '');
});

test('the scope LAPSES when the set goes, so the pane never sits empty under a lit chip', () => {
  seed('aaa11111');
  assert.equal(data.activeSessionScope, 'set');
  window.__shell.sessionSetSpec = '';        // the set goes, the scope has not moved
  assert.equal(data.sessionScope, 'set');
  assert.equal(data.activeSessionScope, data.SESSION_SCOPES[0].key);
  assert.equal(data.sessionScopeMeta.key, data.SESSION_SCOPES[0].key);
});

test('clearing drops the set AND the scope together', () => {
  seed('aaa11111,bbb22222');
  data.clearSessionSet();
  assert.equal(window.__shell.sessionSetSpec, '');
  assert.equal(data.sessionScope, data.SESSION_SCOPES[0].key);
  assert.equal(data.sessionSetActive, false);
});

test('a set is handed on as a set: the link keeps `set` and drops one open record', () => {
  seed('bbb22222,aaa11111');
  window.history.replaceState({}, '', '/app/?view=sessions&set=bbb22222,aaa11111&session=aaa11111&card=3');
  const p = new URL(data.sessionSetLink()).searchParams;
  assert.equal(p.get('view'), 'sessions');
  assert.equal(p.get('set'), 'bbb22222,aaa11111');
  assert.equal(p.get('session'), null);
  assert.equal(p.get('card'), null);
});

test('the set becomes the scope BEFORE a &session= opens, or the deck swipes the wrong list', () => {
  seed('ccc33333,aaa11111');
  data.sessionScope = 'day';                 // as a cold load would have it
  data._setFromUrl = false;
  data.takeSessionSetFromUrl();
  assert.equal(data.sessionScope, 'set');
  // Once only: a reader who steps to another scope is not dragged back by the
  // next stamp of the address.
  data.sessionScope = 'week';
  data.takeSessionSetFromUrl();
  assert.equal(data.sessionScope, 'week');
});

test('the branch grain shows everything under a set, since a branch cannot be in one', () => {
  seed('aaa11111');
  // Snagged's reasoning, and the same answer: the full list under a scope this
  // grain cannot answer reads as what it is, where an empty pane under a lit
  // chip reads as a bug.
  assert.equal(data.inBranchTableScope({ name: 'feature', date: '2025-01-01' }), true);
});
