// gh-auth.test.mjs: saved-token changes are one account boundary, with no
// credential disclosed in the event that tells mounted surfaces to stand down.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, repoRoot } from './bootstrap.mjs';

const SRC = readFileSync(path.join(repoRoot, 'lib/gh-auth.js'), 'utf8');

function harness() {
  const { window, problems } = makeWindow();
  let memoClears = 0;
  // jsdom locks location and location.reload against every stub, and answers a
  // real call with "Not implemented: navigation to another Document" on the
  // virtual console. That error IS the observation: it fires only when the
  // listener actually reached location.reload().
  const reloads = () => problems.filter(
    ([, message]) => /navigation to another Document/.test(String(message))).length;
  class FakeGH {
    static memoClear() { memoClears++; }
    get headers() { return {}; }
    async req() { return {}; }
  }
  window.GH = FakeGH;
  const events = [];
  window.addEventListener('web-tools:token-changed', event => events.push(event));
  window.eval(SRC);
  return { window, events, memoClears: () => memoClears, reloads };
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

// Asserted through the listener rather than by matching the source. Three
// regexes stood here, and one of them pinned `e.key !== 'ghToken'`, so closing
// the localStorage.clear() gap would have broken the test that was supposed to
// protect the behaviour. A source match also passes on dead code.
function storageEvent(window, key, newValue) {
  const event = new window.Event('storage');
  Object.assign(event, { key, newValue, storageArea: window.localStorage });
  window.dispatchEvent(event);
  return event;
}

test('another tab changing ghToken is a reload boundary', () => {
  const h = harness();
  h.window.ghAuth.save('account-a');
  const before = h.memoClears();

  h.window.localStorage.setItem('ghToken', 'account-b');
  storageEvent(h.window, 'ghToken', 'account-b');
  assert.equal(h.window.TOKEN, 'account-b', 'the shared token follows the other tab');
  assert.equal(h.memoClears(), before + 1, 'and private request state is dropped');
  assert.equal(h.events.at(-1).detail, null, 'the notification still carries no credential');
  assert.equal(h.reloads(), 1, 'the page reloads rather than repainting from the old account');
});

test('another tab clearing all storage is the same boundary', () => {
  const h = harness();
  h.window.ghAuth.save('account-a');

  // localStorage.clear() in another tab fires with key === null, and the event
  // carries no newValue, so the listener has to read the value back.
  h.window.localStorage.clear();
  storageEvent(h.window, null, null);
  assert.equal(h.window.TOKEN, '', 'the signed-out state reaches this tab');
  assert.equal(h.reloads(), 1);
});

test('an unrelated storage key is not an account boundary', () => {
  const h = harness();
  h.window.ghAuth.save('account-a');
  const before = h.memoClears();
  storageEvent(h.window, 'someOtherKey', 'x');
  assert.equal(h.memoClears(), before, 'no cache is dropped');
  assert.equal(h.reloads(), 0, 'and nothing reloads');
});
