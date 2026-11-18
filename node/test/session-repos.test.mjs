// alpineComponents/session-repos.js, the Sessions pane's Repos lens: the
// session rows folded per repo. A session's satellites are its distinct
// repo-branches, a repo it worked in on its default branch counting once; an
// owner-qualified name and a bare one are one repo; a repo's companions count
// the sessions it shares with each other repo, and the first card's pairs
// rank the repos worked together most.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, repoRoot } from './bootstrap.mjs';

const { window } = makeWindow();
window.Alpine = { data: () => {} };
window.esc = (s) => String(s);
new window.Function(readFileSync(path.join(repoRoot, 'lib/alpineComponents/session-repos.js'), 'utf8'))();
// Results come from the jsdom realm; copied out so deepEqual compares values.
const own = (x) => JSON.parse(JSON.stringify(x));
const { model, ALL } = window.SessionRepos;

const row = (id, day, repos) => ({ id, day, repos: repos.map(([name, branch]) => ({ name, branch })) });
const ROWS = [
  row('a1', '2026-11-01', [['home', 'claude/x'], ['web-tools', 'claude/x'], ['mehrlander/web-tools', 'claude/y']]),
  row('b1', '2026-11-03', [['mehrlander/home', 'main'], ['home', null]]),
  row('c1', '2026-11-02', [['web-tools', 'claude/z'], ['home', 'claude/z']]),
  row('d1', '2026-11-04', []),
];

test('an owner-qualified name and a bare one are one repo', () => {
  const m = model(ROWS);
  assert.deepEqual(own(m.repos.map(e => [e.name, e.stars.length])), [['home', 3], ['web-tools', 2]]);
});

test('a session draws a satellite per distinct repo-branch, its default branch once', () => {
  const m = model(ROWS);
  const by = Object.fromEntries(m.all.stars.map(s => [s.id, own(s.sats)]));
  assert.deepEqual(by.a1, [{ repo: 'home', branch: 'claude/x' }, { repo: 'web-tools', branch: 'claude/x' },
    { repo: 'web-tools', branch: 'claude/y' }]);
  assert.deepEqual(by.b1, [{ repo: 'home', branch: '' }], 'main and no branch are the default branch');
  assert.equal(by.d1, undefined, 'a session naming no repo draws no star');
});

test('branches count only work off the default branch', () => {
  const m = model(ROWS);
  assert.equal(m.repos.find(e => e.name === 'web-tools').branches, 3);
  assert.equal(m.repos.find(e => e.name === 'home').branches, 2);
  assert.equal(m.all.branches, 5);
});

test('stars run widest first, then newest', () => {
  const m = model(ROWS);
  assert.deepEqual(own(m.all.stars.map(s => s.id)), ['a1', 'c1', 'b1']);
  assert.equal(ALL, '*');
});

test('companions and pairs count shared sessions', () => {
  const m = model(ROWS);
  assert.deepEqual(own(m.repos.find(e => e.name === 'home').with), [{ name: 'web-tools', n: 2 }]);
  assert.deepEqual(own(m.all.pairs), [{ a: 'home', b: 'web-tools', n: 2 }]);
  assert.equal(m.repos.find(e => e.name === 'home').first, '2026-11-01');
  assert.equal(m.repos.find(e => e.name === 'home').last, '2026-11-03');
});
