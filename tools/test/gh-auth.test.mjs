// gh-auth.test.mjs: saved-token changes are one account boundary, with no
// credential disclosed in the event that tells mounted surfaces to stand down.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, repoRoot } from './bootstrap.mjs';

const SRC = readFileSync(path.join(repoRoot, 'lib/gh-auth.js'), 'utf8');

function harness() {
  const { window } = makeWindow();
  let memoClears = 0;
  class FakeGH {
    static memoClear() { memoClears++; }
    get headers() { return {}; }
    async req() { return {}; }
  }
  window.GH = FakeGH;
  const events = [];
  window.addEventListener('web-tools:token-changed', event => events.push(event));
  window.eval(SRC);
  return { window, events, memoClears: () => memoClears };
}

test('save updates the shared token, clears request state, and emits no credential', () => {
  const h = harness();
  assert.equal(h.window.ghAuth.save('  account-a  '), 'account-a');
  assert.equal(h.window.localStorage.getItem('ghToken'), 'account-a');
  assert.equal(h.window.TOKEN, 'account-a');
  assert.equal(h.memoClears(), 1);
  assert.equal(h.events.length, 1);
  assert.equal(h.events[0].detail, null);
});

test('clear removes the saved and shared token through the same boundary', () => {
  const h = harness();
  h.window.ghAuth.save('account-a');
  h.window.ghAuth.clear();
  assert.equal(h.window.localStorage.getItem('ghToken'), null);
  assert.equal(h.window.TOKEN, '');
  assert.equal(h.memoClears(), 2);
  assert.equal(h.events.length, 2);
  assert.ok(h.events.every(event => event.detail === null));
});

test('another tab changing ghToken is a reload boundary', () => {
  assert.match(SRC, /addEventListener\('storage'/);
  assert.match(SRC, /if \(e\.key !== 'ghToken'\) return/);
  assert.match(SRC, /announceToken\(e\.newValue \|\| ''\)[\s\S]*?location\.reload\(\)/);
});
