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
  // req fails the way gh-api.js fails: an Error carrying status, GitHub's
  // message and the rate figure as fields. `fail` is set per test.
  let fail = null;
  class FakeGH {
    static memoClear() { memoClears++; }
    get headers() { return this.token ? { Authorization: `Bearer ${this.token}` } : {}; }
    async req() {
      if (!fail) return {};
      throw Object.assign(new Error(`GitHub Error ${fail.status}`), fail);
    }
  }
  window.GH = FakeGH;
  const events = [];
  window.addEventListener('web-tools:token-changed', event => events.push(event));
  window.eval(SRC);
  return { window, events, memoClears: () => memoClears, reloads, failWith: f => { fail = f; } };
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

// ── A page claiming the failure (ghAuth.onFail) ─────────────────────────────
// The app routes a 401 or 403 to its This browser view; a page with no
// handler, or a handler that declines, keeps the takeover.

const takeover = (window) => !!window.document.getElementById('__ghAuthForm');

test('a handler that claims a 401 receives the failure and the takeover stays away', async () => {
  const h = harness();
  h.window.ghAuth.save('ghp_abcdefghijklmnop1234');
  const seen = [];
  h.window.ghAuth.onFail(info => { seen.push(info); return true; });
  h.failWith({ status: 401, detail: 'Bad credentials', rateRemaining: null });
  const gh = new h.window.GH();
  gh.repo = 'owner/name';
  await assert.rejects(gh.req('contents/a.csv'), /401/, 'the caller still sees its own failure');
  assert.equal(seen.length, 1);
  assert.equal(seen[0].status, 401);
  assert.equal(seen[0].detail, 'Bad credentials');
  assert.equal(seen[0].path, 'contents/a.csv');
  assert.equal(seen[0].repo, 'owner/name');
  assert.equal(seen[0].method, 'GET');
  assert.equal(seen[0].hadToken, true, 'the request carried the saved token');
  assert.equal(h.window.ghAuth.lastFail, seen[0]);
  assert.equal(takeover(h.window), false);
});

test('a handler that declines leaves the takeover to answer', async () => {
  const h = harness();
  h.window.ghAuth.onFail(() => false);
  h.failWith({ status: 403, detail: 'API rate limit exceeded', rateRemaining: 0 });
  await assert.rejects(new h.window.GH().req('contents/a.csv'));
  assert.equal(takeover(h.window), true);
});

test('with no handler the takeover answers, as before', async () => {
  const h = harness();
  h.failWith({ status: 401, detail: 'Bad credentials' });
  await assert.rejects(new h.window.GH().req('contents/a.csv'));
  assert.equal(takeover(h.window), true);
});

test('a quiet request reaches neither the handler nor the takeover', async () => {
  const h = harness();
  let calls = 0;
  h.window.ghAuth.onFail(() => { calls++; return true; });
  h.failWith({ status: 401, detail: 'Bad credentials' });
  await assert.rejects(new h.window.GH().req('/user', { quiet: true }));
  assert.equal(calls, 0);
  assert.equal(takeover(h.window), false);
});

// ── The token record (wt:tokenMeta) ─────────────────────────────────────────

test('saving records when, and which token by its tail, never the token', () => {
  const h = harness();
  h.window.ghAuth.save('ghp_abcdefghijklmnopWXYZ');
  const raw = h.window.localStorage.getItem('wt:tokenMeta');
  assert.ok(!raw.includes('ghp_'), 'the record holds no copy of the token');
  const m = h.window.ghAuth.meta();
  assert.equal(m.tail, 'WXYZ');
  assert.equal(typeof m.savedAt, 'number');
  h.window.ghAuth.clear();
  assert.equal(h.window.localStorage.getItem('wt:tokenMeta'), null, 'clearing the token clears its record');
  assert.equal(h.window.ghAuth.meta(), null);
});

test('a token that arrived another way does not inherit the old record', () => {
  const h = harness();
  h.window.ghAuth.save('ghp_abcdefghijklmnopWXYZ');
  h.window.localStorage.setItem('ghToken', 'ghp_abcdefghijklmnop9999');
  assert.equal(h.window.ghAuth.meta(), null);
});

test('noteAccepted stamps the saved token only when that is the token that was accepted', () => {
  const h = harness();
  h.window.ghAuth.save('ghp_abcdefghijklmnopWXYZ');
  h.window.ghAuth.noteAccepted('someone', 'Bearer ghp_some-other-token');
  assert.equal(h.window.ghAuth.meta().okAt, undefined, 'another token cannot stamp this one');
  h.window.ghAuth.noteAccepted('mehrlander', 'Bearer ghp_abcdefghijklmnopWXYZ');
  const m = h.window.ghAuth.meta();
  assert.equal(m.login, 'mehrlander');
  assert.equal(typeof m.okAt, 'number');
  assert.equal(typeof m.savedAt, 'number', 'the saved date survives the stamp');
});

test('looksLikeToken accepts GitHub token shapes and refuses the rest', () => {
  const h = harness();
  const ok = h.window.ghAuth.looksLikeToken;
  assert.ok(ok('ghp_' + 'a'.repeat(36)));
  assert.ok(ok('github_pat_' + 'a'.repeat(40)));
  assert.ok(ok('a'.repeat(40)));
  assert.ok(!ok('not-a-token'));
  assert.ok(!ok('ghp_short'));
});
