// GH.ago, the one relative-age rule (lib/gh-fetch.js). Until 2026-10-20 seven
// views carried their own, and a 40-hour-old commit read "1d ago", "40h ago" or
// "2d ago" depending on which view showed it. What is pinned here is the rule
// the views now share, including the two inputs the copies disagreed on most:
// a date that does not parse, and one in the future.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, repoRoot } from './bootstrap.mjs';

const { window } = makeWindow({ html: '<!doctype html><html><body></body></html>' });
window.GH = class { constructor() { this.headers = {}; } };
new window.Function(readFileSync(path.join(repoRoot, 'lib/gh-fetch.js'), 'utf8'))();
const { GH } = window;
const before = (s) => new Date(Date.now() - s * 1000).toISOString();

test('the largest whole unit, rounded down', () => {
  assert.equal(GH.ago(before(30)), 'just now');
  assert.equal(GH.ago(before(5 * 60)), '5m ago');
  assert.equal(GH.ago(before(40 * 3600)), '1d ago', 'forty hours is one whole day');
  assert.equal(GH.ago(before(3 * 86400)), '3d ago');
  assert.equal(GH.ago(before(70 * 86400)), '2mo ago');
  assert.equal(GH.ago(before(400 * 86400)), '1y ago');
});

test('no date, or one that does not parse, claims no age', () => {
  for (const v of [undefined, null, '', 'not a date']) assert.equal(GH.ago(v), '', String(v));
});

test('a future date is "just now", never a negative age', () => {
  assert.equal(GH.ago(new Date(Date.now() + 3600e3).toISOString()), 'just now');
});

test('a Date or an epoch number reads the same as its ISO string', () => {
  const t = Date.now() - 2 * 3600e3;
  assert.equal(GH.ago(new Date(t)), '2h ago');
  assert.equal(GH.ago(t), '2h ago');
});

test('the instance method is the static, so a client and a view agree', () => {
  const iso = before(3 * 3600);
  assert.equal(new GH().ago(iso), GH.ago(iso));
});
