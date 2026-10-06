// The estate's half of the freshness rule (app/index.html, "Freshness"; the
// shell's half is shell-freshness.test.mjs). Two jobs land here.
//
//   THE PILL'S READING  The age pill reads the shell's record of when this tab
//                       last CONFIRMED each cache, and says one of three
//                       things: checked N, checking…, or check failed. It read
//                       the file's own stamp until 2026-10-05, as "as of", and
//                       a write time keeps aging over a store nobody changed.
//   THE CONFIRM         A check whose crawl handed back no document names
//                       main's blob sha instead. The pane re-reads only when
//                       that sha is not the copy it shows, and never lets a
//                       lagging read put an older copy back.

import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWindow, startAlpine } from './bootstrap.mjs';

const REGISTRY = 'me/registry';
let FILES = {};
let GETS = [];

class FakeGH {
  static FRESH = { cache: 'no-store' };
  constructor(conf = {}) { this.repo = conf.repo || ''; this.ref = conf.ref || 'main'; }
  ago(d) {
    const s = (Date.now() - new Date(d)) / 1000;
    for (const [unit, v] of Object.entries({ d: 86400, h: 3600, m: 60 }))
      if (s >= v) return `${Math.floor(s / v)}${unit} ago`;
    return 'just now';
  }
  async repos() { return []; }
  async get(name, opts) {
    GETS.push({ name, fresh: opts?.cache === 'no-store' });
    const f = this.repo === REGISTRY && FILES[name];
    if (f) return { text: JSON.stringify(f.doc), sha: f.sha };
    throw Object.assign(new Error('404'), { status: 404 });
  }
  async req() { return {}; }
}

const { window } = makeWindow({
  html: `<!doctype html><html><body><div id="es" x-data="estate()"></div></body></html>`,
});
window.TOKEN = 'tkn';
window.GH = FakeGH;
window.gh = { load: async () => {} };
const shell = {
  REGISTRY_REPO: REGISTRY, DEFAULT_REPO: 'me/tools', quickLinks: [],
  hasToken: () => true, _authState: 'auth', view: 'sessions',
  clock: Date.now(),
  crawlChecking: { configs: false, activity: false, sessions: false },
  cacheCheck: { configs: { at: 0, tried: 0, failed: '' },
                activity: { at: 0, tried: 0, failed: '' },
                sessions: { at: 0, tried: 0, failed: '' } },
  refreshConfigCache() {}, refreshSessions() {}, goSessions() {}, goBranches() {},
};
window.__shell = shell;

const Alpine = await startAlpine(window, [
  'lib/alpine-bundle.js',
  'lib/kits/last-write.js',
  'lib/kits/repo-sessions-cache.js',
  'lib/kits/branch-status.js',
  'lib/alpineComponents/estate.js',
]);
const data = Alpine.$data(window.document.getElementById('es'));
const reg = () => new FakeGH({ repo: REGISTRY });
const MIN = 60 * 1000;
const set = (key, v) => { shell.cacheCheck = { ...shell.cacheCheck, [key]: { at: 0, tried: 0, failed: '', ...v } }; };
const idle = () => { shell.crawlChecking = { configs: false, activity: false, sessions: false };
                     shell.sessionsRefreshing = shell.activityRefreshing = shell.activityGroupRefreshing = false; };

// ── The pill's three readings ───────────────────────────────────────────────

test('a confirmed reading says when it was checked, and nothing else', () => {
  idle();
  set('activity', { at: Date.now() });
  assert.equal(data.pillText(['activity']), 'checked now');
  set('activity', { at: Date.now() - 3 * MIN - 5000 });
  assert.equal(data.pillText(['activity']), 'checked 3m');
});

test('a check in flight says so, the background ones included', () => {
  idle();
  set('sessions', { at: Date.now() - 4 * MIN });
  shell.crawlChecking = { ...shell.crawlChecking, sessions: true };
  assert.equal(data.pillText(['sessions']), 'checking…', 'a check the freshness rule started');
  idle();
  shell.activityGroupRefreshing = true;
  assert.equal(data.pillText(['sessions', 'activity']), 'checking…', 'and a Refresh press');
  idle();
});

test('a failed check says it failed, with the age of the copy still on screen', () => {
  idle();
  set('sessions', { at: Date.now() - 23 * 60 * MIN, failed: 'GitHub Error 409' });
  assert.equal(data.pillText(['sessions']), 'failed · 23h');
  assert.match(data.pillTip(['sessions'], 'tap to check both now'), /409/);
  set('sessions', { at: 0, failed: 'no estate members in the config cache yet' });
  assert.equal(data.pillText(['sessions']), 'check failed');
  set('sessions', {});
});

// The Sessions pane draws a branch tile under each row, so its pill speaks for
// both caches and is only as current as the staler one.
test('a pill over two caches reports the older confirmation', () => {
  idle();
  set('sessions', { at: Date.now() - 1 * MIN });
  set('activity', { at: Date.now() - 4 * MIN - 5000 });
  assert.equal(data.pillText(['sessions', 'activity']), 'checked 4m');
});

test('the pills carry no native title, only a title-tip', async () => {
  const src = await import('node:fs').then(fs => fs.readFileSync(new URL('../../lib/alpineComponents/estate.js', import.meta.url), 'utf8'));
  const pill = src.slice(src.indexOf('const agePill = '), src.indexOf('</button>`;', src.indexOf('const agePill = ')));
  assert.doesNotMatch(pill, /:title=|\stitle=/);
  assert.match(pill, /:data-title-tip=/);
});

// ── The confirm ─────────────────────────────────────────────────────────────

test('main still holding the copy on screen costs no read', async () => {
  FILES = { 'state/sessions.json': { doc: { generatedAt: '2026-10-05T10:00:00Z', rows: [] }, sha: 's1' } };
  await data.loadSessions(reg());
  assert.equal(data.cacheSha_.sessions, 's1');
  GETS = [];
  await data.confirmCache({ key: 'sessions', sha: 's1' });
  assert.deepEqual(GETS, []);
});

test('main holding another copy re-reads it fresh, and records its sha', async () => {
  FILES = { 'state/sessions.json': { doc: { generatedAt: '2026-10-05T10:00:00Z', rows: [] }, sha: 's1' } };
  await data.loadSessions(reg());
  FILES = { 'state/sessions.json': { doc: { generatedAt: '2026-10-05T17:07:50Z', rows: [] }, sha: 's2' } };
  GETS = [];
  await data.confirmCache({ key: 'sessions', sha: 's2' });
  assert.deepEqual(GETS.filter(g => g.name === 'state/sessions.json'), [{ name: 'state/sessions.json', fresh: true }]);
  assert.equal(data.sessionsGeneratedAt, '2026-10-05T17:07:50Z');
  assert.equal(data.cacheSha_.sessions, 's2');
});

test('a document handed over by a crawl carries its sha, so the next confirm can match it', async () => {
  await data.reloadSessions({ generatedAt: '2026-10-05T17:30:00Z', rows: [] }, 's3');
  assert.equal(data.cacheSha_.sessions, 's3');
  GETS = [];
  await data.confirmCache({ key: 'sessions', sha: 's3' });
  assert.deepEqual(GETS, []);
});

// A check over a quiet store hands back main's copy, restamped. Taking it
// would rebuild the whole Sessions tree every five minutes over identical rows.
test('a handed document with the sha already on screen is not taken again', async () => {
  await data.reloadSessions({ generatedAt: '2026-10-05T17:30:00Z', rows: [] }, 's4');
  const rows = data.sessionRows_;
  await data.reloadSessions({ generatedAt: '2026-10-05T17:35:00Z', rows: [] }, 's4');
  assert.equal(data.sessionRows_, rows, 'the same rows object: nothing re-rendered');
  assert.equal(data.sessionsGeneratedAt, '2026-10-05T17:30:00Z');
});

test('a pane this view has not loaded is not read on its account', async () => {
  data._loaded = { ...data._loaded, activity: false };
  GETS = [];
  await data.confirmCache({ key: 'activity', sha: 'a7' });
  assert.deepEqual(GETS, []);
});

// The contents API is read-after-write eventual: seconds after this page's own
// commit, a read can still be served the copy that commit replaced. A confirm
// that re-read through that lag must not put the older copy back.
test('a lagging read does not replace what this page itself just wrote', async () => {
  const path = 'state/sessions.json';
  const mine = { generatedAt: '2026-10-05T17:40:00Z', rows: [] };
  window.LastWrite.note(REGISTRY, path, mine, 's5');
  FILES = { [path]: { doc: { generatedAt: '2026-10-05T17:07:50Z', rows: [] }, sha: 's2' } };
  data.cacheSha_ = { ...data.cacheSha_, sessions: 'x' };
  data._loaded = { ...data._loaded, sessions: true };
  await data.confirmCache({ key: 'sessions', sha: 's2' });
  assert.equal(data.sessionsGeneratedAt, '2026-10-05T17:40:00Z');
  assert.equal(data.cacheSha_.sessions, 's5');
  window.LastWrite.forget(REGISTRY, path);
});
