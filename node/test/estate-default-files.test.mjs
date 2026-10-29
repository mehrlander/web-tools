// The Sessions row's mark for a session holding an older copy of the default
// skill files than main's (estate.js sessionDefaultStale). The row carries the
// plugin commit of the session's last load (RepoSessionsCache.defaultAtOf); the
// view compares skills/default/'s listing at that commit with main's by blob
// sha. Driven through the real component against a stub GH whose contents
// reads answer per ref.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWindow, startAlpine } from './bootstrap.mjs';

const LISTING = {
  main: { 'SKILL.md': 's1', 'CONVERSATION.md': 'c2', 'QUALIFIED-WRITING.md': 'q1' },
  aaaaaaaaaaa1: { 'SKILL.md': 's1', 'CONVERSATION.md': 'c1', 'QUALIFIED-WRITING.md': 'q1' },
  bbbbbbbbbbb2: { 'SKILL.md': 's1', 'CONVERSATION.md': 'c2', 'QUALIFIED-WRITING.md': 'q1' },
};
const reads = [];
class StubGH {
  constructor(conf = {}) { this.repo = conf.repo || ''; this.ref = conf.ref || 'main'; }
  ago() { return 'recently'; }
  async get() { throw new Error('404'); }
  async ls() { throw new Error('404'); }
  async req(p) {
    const m = /^contents\/skills\/default\?ref=(.+)$/.exec(p);
    if (!m) return { default_branch: 'main', description: '', private: true, pushed_at: '' };
    reads.push(decodeURIComponent(m[1]));
    const files = LISTING[decodeURIComponent(m[1])];
    if (!files) throw new Error('404');
    return Object.entries(files).map(([name, sha]) => ({ type: 'file', name, sha }));
  }
}

const { window } = makeWindow({
  html: `<!doctype html><html><body><div id="es" x-data="estate()"></div></body></html>`,
});
window.TOKEN = 'tkn';
window.GH = StubGH;
window.__shell = { REGISTRY_REPO: 'me/registry', DEFAULT_REPO: 'me/tools',
                   quickLinks: [], hasToken: () => true, _authState: 'auth' };
const Alpine = await startAlpine(window, [
  'lib/alpine-bundle.js',
  'lib/kits/branch-status.js',
  'lib/kits/surface.js',
  'lib/alpineComponents/estate.js',
]);
const data = Alpine.$data(window.document.getElementById('es'));
const settle = () => new Promise(r => setTimeout(r, 0));
const recent = new Date(Date.now() - 3600e3).toISOString();
const row = (defaultAt, ended = recent) => ({ id: 'x', defaultAt, started: ended, ended });

test('a recent session whose copy differs from main is marked once the listings arrive', async () => {
  assert.equal(data.sessionDefaultStale(row('aaaaaaaaaaa1')), false, 'nothing is claimed before the reads land');
  await settle(); await settle();
  assert.equal(data.sessionDefaultStale(row('aaaaaaaaaaa1')), true);
  assert.match(data.sessionDefaultNote(row('aaaaaaaaaaa1')), /from aaaaaaa, and main has changed them since/);
});

test('a session holding main\'s copy is not marked', async () => {
  data.sessionDefaultStale(row('bbbbbbbbbbb2'));
  await settle(); await settle();
  assert.equal(data.sessionDefaultStale(row('bbbbbbbbbbb2')), false);
});

test('each commit is read once, and kept for the next page', async () => {
  const before = reads.length;
  for (let i = 0; i < 3; i++) data.sessionDefaultStale(row('aaaaaaaaaaa1'));
  await settle();
  assert.equal(reads.length, before, 'no second read of a listing already held');
  const kept = JSON.parse(window.localStorage.getItem('wt:defaultFilesAt') || '{}');
  assert.ok(kept.aaaaaaaaaaa1, 'a commit\'s listing is stored, since it never changes');
  assert.ok(!('main' in kept), 'main\'s listing is not stored, since main moves');
});

test('no mark for an old session, a row without the field, an unknown commit, or no token', async () => {
  const old = new Date(Date.now() - 8 * 864e5).toISOString();
  assert.equal(data.sessionDefaultStale(row('aaaaaaaaaaa1', old)), false, 'past the week: no next prompt to be about');
  assert.equal(data.sessionDefaultStale(row('')), false);
  data.sessionDefaultStale(row('ccccccccccc3'));
  await settle(); await settle();
  assert.equal(data.sessionDefaultStale(row('ccccccccccc3')), false, 'a failed read claims nothing');
  const token = window.TOKEN;
  window.TOKEN = '';
  try { assert.equal(data.sessionDefaultStale(row('aaaaaaaaaaa1')), false); }
  finally { window.TOKEN = token; }
});
