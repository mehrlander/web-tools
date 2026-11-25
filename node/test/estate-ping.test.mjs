// alpineComponents/estate.js — Ping, questions put to Gemini from the Lists
// view. Sending files a lenovo-daemon `ping` errand in the registry; the pane
// then follows each ask through the folder listings (sent, thinking once
// claimed, reply arriving until explicitly settled) and shows Gemini's reply. Driven over
// a fake GH and a stubbed shell; no network, no pixels. The fake registry has
// two branches, so a read or write aimed at the wrong one finds nothing.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { makeWindow, startAlpine } from './bootstrap.mjs';

const REGISTRY = 'me/registry';
let FILES = {};
let SAVES = [];
let COMMITS = [];
let READS = [];
const sha = value => createHash('sha1').update(JSON.stringify(value)).digest('hex');
// Errands and the topics rollup are on the registry's `background` branch
// (kits/errands.js BRANCH); everything else is on main.
const branchOf = (p) => (p.startsWith('errands/') || p === 'state/session-topics.json') ? 'background' : 'main';

class FakeGH {
  // The views call the static GH.ago (gh-fetch.js); it answers with this
  // fake's own formatter below.
  static ago(d) { return FakeGH.prototype.ago.call(null, d); }
  static FRESH = { cache: 'no-store' };
  constructor(c = {}) { this.repo = c.repo || ''; this.ref = c.ref || 'main'; }
  // gh-fetch.js's ago, so the marker's words read as they do in the app.
  ago(dateStr) {
    const s = (Date.now() - new Date(dateStr)) / 1000;
    for (const [unit, v] of Object.entries({ y: 31536000, mo: 2592000, d: 86400, h: 3600, m: 60 }))
      if (s >= v) return `${Math.floor(s / v)}${unit} ago`;
    return 'just now';
  }
  async repos() { return []; }
  async ls(dir) {
    const rows = Object.keys(FILES).filter(p => p.startsWith(dir + '/') && !p.slice(dir.length + 1).includes('/')
                                           && branchOf(p) === this.ref)
      .map(p => ({ name: p.slice(dir.length + 1), type: 'file', sha: sha(FILES[p]) }));
    if (!rows.length) throw Object.assign(new Error('404'), { status: 404 });
    return rows;
  }
  async get(name) {
    READS.push(name);
    if (this.repo === REGISTRY && FILES[name] && branchOf(name) === this.ref) return { text: JSON.stringify(FILES[name]), sha: sha(FILES[name]) };
    throw Object.assign(new Error('404'), { status: 404 });
  }
  async req(path) {
    if (typeof path === 'string' && path.startsWith('commits?path=sessions/')) return COMMITS;
    if (typeof path === 'string' && path.startsWith('/repos/'))
      return { default_branch: 'main', description: '', private: true, pushed_at: '' };
    return {};
  }
  async save(path, value, message) {
    SAVES.push({ path, value, message, ref: this.ref });
    if (branchOf(path) === this.ref) FILES[path] = JSON.parse(JSON.stringify(value));
    return {};
  }
}

const { window, problems } = makeWindow({
  html: `<!doctype html><html><body><div id="es" x-data="estate()"></div></body></html>`,
});
window.TOKEN = 'tkn';
window.GH = FakeGH;
window.__shell = {
  REGISTRY_REPO: REGISTRY, DEFAULT_REPO: 'me/tools', quickLinks: [],
  hasToken: () => true, _authState: 'auth', refreshConfigCache() {}, refreshActivity() {},
};

const Alpine = await startAlpine(window, [
  'lib/alpine-bundle.js',
  'lib/kits/surface.js',
  'lib/kits/errands.js',
  'lib/alpineComponents/estate.js',
]);
const data = Alpine.$data(window.document.getElementById('es'));
const reg = () => new FakeGH({ repo: REGISTRY });
const settle = () => { clearTimeout(data.pingTimer); data.pingTimer = null; };

async function seed(files = {}) {
  FILES = { ...files };
  READS = [];
  data.pingItems = [];
  await data.loadPings();
  settle();
  SAVES = [];
}

async function send(prompt) {
  data.pingDraft = prompt;
  await data.sendPing();
  settle();
  return data.pingItems[0].id;
}

test('mounts with no startup warnings or errors', () => {
  assert.deepEqual(problems, []);
});

test('sending files one ping errand and lists the question as sent', async () => {
  await seed();
  const id = await send('Which rivers feed the Columbia? A short list.');
  assert.equal(SAVES.length, 1, 'one write');
  const { path, value, message, ref } = SAVES[0];
  assert.equal(path, 'errands/requests/' + id + '.json');
  assert.equal(ref, 'background', 'filed on the errand branch, not main');
  assert.equal(value.dest, REGISTRY + '@background:errands/results');
  assert.match(id, /^daemon-\d{4}-\d{2}-\d{2}-ping-[a-z0-9]+$/);
  assert.equal(value.run.method, 'lenovo-daemon');
  assert.equal(value.run.venue, 'lenovo');
  assert.equal(value.run.op, 'ping');
  assert.equal(value.run.args.prompt, 'Which rivers feed the Columbia? A short list.');
  assert.match(message, /^Ping Gemini/);
  assert.equal(data.pingItems[0].stage, 'sent');
  assert.equal(data.pingDraft, '', 'the box clears');
});

test('a question moves to thinking when claimed, then shows the reply', async () => {
  await seed();
  const id = await send('rivers?');
  FILES['errands/claims/' + id + '.json'] = { id, by: 'lenovo' };
  await data.loadPings({ quiet: true }); settle();
  assert.equal(data.pingItems[0].stage, 'thinking');

  delete FILES['errands/claims/' + id + '.json'];
  FILES['errands/results/' + id + '.json'] = { id, ok: true, closedAt: '2026-10-02T17:03:00Z',
    message: 'The Snake.', data: { op: 'ping', model: 'flash', reply: 'The Snake.\nThe Willamette.' } };
  await data.loadPings({ quiet: true });
  assert.equal(data.pingItems[0].stage, 'answered');
  assert.equal(data.pingItems[0].reply, 'The Snake.\nThe Willamette.');
  assert.equal(data.pingTimer, null, 'nothing left to watch, so polling stops');
});

test('an interim reply stays visible and polling until the final result replaces it', async () => {
  await seed();
  const id = await send('rivers?'), result = 'errands/results/' + id + '.json';
  FILES[result] = { id, ok: true, data: { settled: false, reply: 'Interim reply' } };
  await data.loadPings({ quiet: true });
  assert.equal(data.pingItems[0].stage, 'reply');
  assert.equal(data.pingItems[0].reply, 'Interim reply');
  assert.ok(data.pingTimer, 'an interim result does not disarm polling');
  settle();
  await data.loadPings({ quiet: true }); settle();
  assert.equal(READS.filter(path => path === result).length, 2, 'an unchanged interim result is still revalidated');

  FILES[result] = { id, ok: true, closedAt: '2026-10-02T17:03:00Z', data: { settled: true, reply: 'Final reply' } };
  await data.loadPings({ quiet: true });
  assert.equal(data.pingItems[0].stage, 'answered');
  assert.equal(data.pingItems[0].outcome, 'complete');
  assert.equal(data.pingItems[0].reply, 'Final reply');
  assert.equal(data.pingTimer, null, 'the final result ends polling');
  await data.loadPings({ quiet: true });
  assert.equal(READS.filter(path => path === result).length, 3, 'only a known final reply with unchanged SHA is reused');
});

test('a rewritten terminal result is reread while the unchanged request stays cached', async () => {
  const id = 'daemon-2026-10-02-ping-rewritten', request = 'errands/requests/' + id + '.json', result = 'errands/results/' + id + '.json';
  await seed({ [request]: { id, createdAt: '2026-10-02T17:00:00Z', run: { args: { prompt: 'rivers?' } } },
    [result]: { id, ok: true, data: { reply: 'First answer' } } });
  await data.loadPings({ quiet: true });
  assert.equal(READS.filter(path => path === result).length, 1);
  FILES[result] = { id, ok: true, data: { reply: 'Corrected answer' } };
  await data.loadPings({ quiet: true });
  assert.equal(data.pingItems[0].reply, 'Corrected answer');
  assert.equal(READS.filter(path => path === result).length, 2);
  assert.equal(READS.filter(path => path === request).length, 1);
});

test('a temporarily unreadable final result preserves the interim reply and keeps polling', async () => {
  await seed();
  const id = await send('rivers?'), result = 'errands/results/' + id + '.json';
  FILES[result] = { id, ok: true, data: { settled: false, reply: 'Interim reply' } };
  await data.loadPings({ quiet: true }); settle();
  FILES[result] = [];
  await data.loadPings({ quiet: true });
  assert.equal(data.pingItems[0].stage, 'reply');
  assert.equal(data.pingItems[0].reply, 'Interim reply');
  assert.ok(data.pingTimer);
  settle();
  FILES[result] = { id, ok: true, data: { settled: true, reply: 'Final reply' } };
  await data.loadPings({ quiet: true });
  assert.equal(data.pingItems[0].reply, 'Final reply');
  assert.equal(data.pingTimer, null);
});

test('a declined ping is terminal with its reason and a neutral label', async () => {
  await seed();
  const id = await send('rivers?');
  FILES['errands/results/' + id + '.json'] = { id, ok: true, answered: false, message: 'Cancelled by owner',
    closedAt: '2026-10-02T17:05:00Z', data: { settled: false, reply: 'Old interim reply', updatedAt: '2026-10-02T17:03:00Z' } };
  await data.loadPings({ quiet: true });
  assert.equal(data.pingItems[0].outcome, 'declined');
  assert.equal(data.pingItems[0].reply, 'Cancelled by owner');
  assert.equal(data.pingItems[0].at, '2026-10-02T17:05:00Z', 'the decline time supersedes old interim metadata');
  assert.equal(data.pingItems[0].ok, true, 'a decline is not failure');
  assert.equal(data.pingTimer, null, 'a decline closes the errand');
  await new Promise(resolve => setTimeout(resolve, 0));
  const row = [...window.document.querySelectorAll('[data-part="item"]')].find(el => el.textContent.includes('Cancelled by owner'));
  assert.ok(row?.textContent.includes('Declined'));
});

test('a question just sent survives a listing that has not caught up with it', async () => {
  await seed();
  const id = await send('rivers?');
  delete FILES['errands/requests/' + id + '.json'];      // the listing lags the write
  await data.loadPings({ quiet: true }); settle();
  assert.equal(data.pingItems[0]?.id, id);
  assert.equal(data.pingItems[0].stage, 'sent');
});

test('opening the view lists earlier asks newest first, from the app and the command line', async () => {
  const older = 'daemon-2026-09-30-ping-a1b2c3';                // filed by errand_runner.py file ping
  const newer = 'daemon-2026-10-01-ping-mfoo1234';
  await seed({
    ['errands/requests/' + older + '.json']: { id: older, createdAt: '2026-09-30T08:00:00Z', run: { args: { prompt: 'from a session' } } },
    ['errands/requests/' + newer + '.json']: { id: newer, createdAt: '2026-10-01T08:00:00Z', run: { args: { prompt: 'from the app' } } },
    ['errands/results/' + newer + '.json']: { id: newer, ok: false, message: 'Gemini did not answer: timeout' },
    'errands/requests/ask-2026-08-12-wps.json': { id: 'ask-2026-08-12-wps', note: 'a person errand' },
  });
  assert.deepEqual(Array.from(data.pingItems, p => p.prompt), ['from the app', 'from a session']);
  assert.equal(data.pingItems[0].ok, false);
  assert.equal(data.pingItems[0].reply, 'Gemini did not answer: timeout', 'a failure shows its reason');
  assert.equal(data.pingItems[1].stage, 'sent');
});

// ── The daemon's status ─────────────────────────────────────────────────────
const minsAgo = (m) => new Date(Date.now() - m * 60000).toISOString().replace(/\.\d{3}Z$/, 'Z');

test('the marker reads the daemon as active when its topics follow the last record', async () => {
  await seed({ 'state/session-topics.json': { sessions: {
    a: { analyzed_at: minsAgo(40) }, b: { analyzed_at: minsAgo(6) } } } });
  COMMITS = [{ commit: { committer: { date: minsAgo(8) } } }];
  await data.loadDaemon(reg());
  assert.equal(data.daemonHealth.level, 'up');
  assert.equal(data.daemonText, 'Daemon active 6m ago');
});

test('the marker reads the daemon as behind when a record has waited ten minutes', async () => {
  await seed({ 'state/session-topics.json': { sessions: { a: { analyzed_at: minsAgo(40) } } } });
  COMMITS = [{ commit: { committer: { date: minsAgo(14) } } }];
  await data.loadDaemon(reg());
  assert.equal(data.daemonHealth.level, 'behind');
  assert.equal(data.daemonText, 'Daemon behind: sessions waiting 14m');
});

test('Check files a status errand, and the answer turns the marker active', async () => {
  await seed({ 'state/session-topics.json': { sessions: { a: { analyzed_at: minsAgo(200) } } } });
  COMMITS = [{ commit: { committer: { date: minsAgo(210) } } }];
  await data.loadDaemon(reg());
  assert.equal(data.daemonHealth.level, 'quiet');
  data.daemon = { ...data.daemon, check: null };
  await data.checkDaemon();
  clearTimeout(data.daemonTimer); data.daemonTimer = null;
  assert.equal(SAVES.length, 1);
  assert.equal(SAVES[0].value.run.op, 'status');
  assert.equal(SAVES[0].ref, 'background');
  assert.equal(data.daemonHealth.level, 'checking');
  const id = data.daemon.check.id;
  FILES['errands/results/' + id + '.json'] = { id, ok: true, closedAt: minsAgo(0), data: { op: 'status', host: 'lenovo' } };
  await data.readCheck();
  assert.equal(data.daemonHealth.level, 'up');
  assert.equal(data.daemonText, 'Daemon active just now');
});

test('an interim status check remains open and cancellation does not claim daemon activity', async () => {
  await seed({ 'state/session-topics.json': { sessions: { a: { analyzed_at: minsAgo(200) } } } });
  COMMITS = [{ commit: { committer: { date: minsAgo(210) } } }];
  await data.loadDaemon(reg());
  data.daemon = { ...data.daemon, check: null };
  await data.checkDaemon();
  clearTimeout(data.daemonTimer); data.daemonTimer = null;
  const id = data.daemon.check.id, result = 'errands/results/' + id + '.json';
  FILES[result] = { id, ok: true, closedAt: minsAgo(0), data: { settled: false } };
  await data.readCheck();
  assert.equal(data.daemon.check.closedAt, '');
  assert.equal(data.daemonHealth.level, 'checking');
  FILES[result] = { id, ok: true, answered: false, closedAt: minsAgo(0), message: 'Cancelled by owner' };
  await data.readCheck();
  assert.equal(data.daemon.check.outcome, 'declined');
  assert.equal(data.daemonHealth.level, 'quiet');
});

// An unanswered question keeps the pane polling, as it should; stop it so the
// run can exit.
test.after(() => {
  data.pingItems = []; data.pingUntil = 0; settle();
  clearTimeout(data.daemonTimer); data.daemonTimer = null;
});
