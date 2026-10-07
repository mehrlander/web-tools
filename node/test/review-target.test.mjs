// Verifies kits/review-target.js: the review page's address grammar. Pure
// string logic, so this is the whole behavior — parse of #gh= fragments,
// bare specs, pasted GitHub URLs (compare/blob/tree/pull/bare), and the
// mint/parse round-trip including per-segment encoding.

import test from 'node:test';
import assert from 'node:assert/strict';
import { loadKit } from './bootstrap.mjs';

const { reviewTarget } = loadKit('review-target.js');
const { parse, mint } = reviewTarget;

test('bare spec forms', () => {
  assert.deepEqual(parse('mehrlander/web-tools'), { kind: 'ref', repo: 'mehrlander/web-tools' });
  assert.deepEqual(parse('o/r@main'), { kind: 'ref', repo: 'o/r', ref: 'main' });
  assert.deepEqual(parse('o/r@feat/x:lib/a.js'),
    { kind: 'ref', repo: 'o/r', ref: 'feat/x', path: 'lib/a.js' });
  // ':' starts the path even with no ref
  assert.deepEqual(parse('o/r:docs/README.md'),
    { kind: 'ref', repo: 'o/r', path: 'docs/README.md' });
});

test('fragment and query pair lists', () => {
  assert.deepEqual(parse('#gh=o/r@br:pages/x.html&base=main'),
    { kind: 'ref', repo: 'o/r', ref: 'br', path: 'pages/x.html', base: 'main' });
  assert.deepEqual(parse('?base=dev&gh=o/r@br'),
    { kind: 'ref', repo: 'o/r', ref: 'br', base: 'dev' });
  assert.equal(parse('#base=main'), null);
  assert.equal(parse(''), null);
});

test('slashed branch names survive the #gh= form', () => {
  const t = parse('#gh=mehrlander/web-tools@claude/some-branch-1x2y:lib/kits/cm6-merge.js&base=main');
  assert.equal(t.ref, 'claude/some-branch-1x2y');
  assert.equal(t.path, 'lib/kits/cm6-merge.js');
  assert.equal(t.base, 'main');
});

test('github compare URL', () => {
  assert.deepEqual(parse('https://github.com/o/r/compare/main...feat/x'),
    { kind: 'ref', repo: 'o/r', base: 'main', ref: 'feat/x' });
  // two-dot form accepted too
  assert.deepEqual(parse('https://github.com/o/r/compare/a..b'),
    { kind: 'ref', repo: 'o/r', base: 'a', ref: 'b' });
});

test('github blob / tree / pull / bare URLs', () => {
  assert.deepEqual(parse('https://github.com/o/r/blob/main/lib/a.js'),
    { kind: 'ref', repo: 'o/r', ref: 'main', path: 'lib/a.js' });
  assert.deepEqual(parse('https://github.com/o/r/tree/feat/x'),
    { kind: 'ref', repo: 'o/r', ref: 'feat/x' });
  assert.deepEqual(parse('https://github.com/o/r/pull/226'),
    { kind: 'pull', repo: 'o/r', number: 226 });
  assert.deepEqual(parse('https://github.com/o/r'), { kind: 'ref', repo: 'o/r' });
  assert.equal(parse('https://example.com/nope'), null);
});

test('review-page URL recurses on its own fragment', () => {
  const t = parse('https://mehrlander.github.io/web-tools/pages/review.html#gh=o/r@br&base=main');
  assert.deepEqual(t, { kind: 'ref', repo: 'o/r', ref: 'br', base: 'main' });
});

test('mint round-trips, including encodable characters', () => {
  const t = { repo: 'o/r', ref: 'feat/x', path: 'dir with space/a+b.js', base: 'main' };
  const minted = mint(t);
  assert.ok(minted.startsWith('gh=o/r@feat/x:'));
  assert.ok(!minted.includes(' '), 'spaces are encoded');
  assert.deepEqual(parse('#' + minted), { kind: 'ref', ...t });

  // minimal mint
  assert.equal(mint({ repo: 'o/r' }), 'gh=o/r');
  assert.equal(mint({ repo: 'o/r', ref: 'b' }), 'gh=o/r@b');
  assert.equal(mint(null), '');
});
