// The renderer's commits endpoints (tools/render/cdn.mjs), answered from local
// git, 2026-09-24. They were passed through to the live API, unauthenticated
// from a headless browser, and a rate-limit 403 made the app swap the view
// under test for its token screen. Browser-free: resolveCdn is a function.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolveCdn } from '../render/cdn.mjs';
import { repoRoot } from '../repo-root.mjs';

const API = 'https://api.github.com/repos/mehrlander/web-tools/commits';
const R = (url) => resolveCdn(url, repoRoot);
const head = spawnSync('git', ['-C', repoRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim();

test('a commit list is answered offline, main meaning the checkout', () => {
  // One, not two: CI checks out at depth 1, where HEAD has no parent to list.
  const r = R(API + '?sha=main&per_page=1');
  assert.equal(r.kind, 'fulfill');
  const list = JSON.parse(r.body);
  assert.equal(list.length, 1);
  assert.equal(list[0].sha, head);
  assert.match(list[0].commit.author.date, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/, 'dates in GitHub\'s UTC form');
  assert.ok(list[0].commit.message.length && list[0].commit.message === list[0].commit.message.trim());
});

test('a path filter returns that file\'s last commit', () => {
  const want = spawnSync('git', ['-C', repoRoot, 'log', '-n', '1', '--format=%H', 'HEAD', '--', 'package.json'], { encoding: 'utf8' }).stdout.trim();
  const list = JSON.parse(R(API + '?sha=main&path=package.json&per_page=1').body);
  assert.deepEqual(list.map(c => c.sha), [want]);
});

test('one commit carries its files and stats', () => {
  const c = JSON.parse(R(API + '/' + head).body);
  assert.equal(c.sha, head);
  assert.ok(Array.isArray(c.files) && Array.isArray(c.parents));
  assert.equal(c.stats.total, c.stats.additions + c.stats.deletions);
});

test('an absent commit is a 404, not a pass-through', () => {
  const r = R(API + '/' + '0'.repeat(40));
  assert.equal(r.kind, 'fulfill');
  assert.equal(r.status, 404);
});

test('another repo\'s commits still pass through', () => {
  assert.equal(R('https://api.github.com/repos/someone/else/commits').kind, 'continue');
});
