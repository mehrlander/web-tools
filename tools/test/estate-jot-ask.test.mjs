// alpineComponents/estate.js — asking Gemini about a jot. Sending files a
// laptop-daemon `ask` errand in the registry; the pane then follows it through
// the folder listings (sent, thinking once claimed, answered once a result
// lands) and shows the reply under the jot. Driven over a fake GH and a stubbed
// shell; no network, no pixels.

import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWindow, startAlpine } from './bootstrap.mjs';

const REGISTRY = 'me/registry';
let FILES = {};
let SAVES = [];

class FakeGH {
  static FRESH = { cache: 'no-store' };
  constructor(c = {}) { this.repo = c.repo || ''; this.ref = c.ref || 'main'; }
  ago() { return 'recently'; }
  async repos() { return []; }
  async ls(dir) {
    const rows = Object.keys(FILES).filter(p => p.startsWith(dir + '/') && !p.slice(dir.length + 1).includes('/'))
      .map(p => ({ name: p.slice(dir.length + 1), type: 'file' }));
    if (!rows.length) throw Object.assign(new Error('404'), { status: 404 });
    return rows;
  }
  async get(name) {
    if (this.repo === REGISTRY && FILES[name]) return { text: JSON.stringify(FILES[name]) };
    throw Object.assign(new Error('404'), { status: 404 });
  }
  async req(path) {
    if (typeof path === 'string' && path.startsWith('/repos/'))
      return { default_branch: 'main', description: '', private: true, pushed_at: '' };
    return {};
  }
  async save(path, value, message) {
    SAVES.push({ path, value, message });
    FILES[path] = JSON.parse(JSON.stringify(value));
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
const JOT = { id: 'j1abc', text: 'which rivers feed the Columbia', created_at: '2026-10-01T10:00:00Z' };

async function seed(extra = {}) {
  FILES = { 'lists/jots.json': { items: [{ ...JOT }] }, ...extra };
  data.asks = {}; data.askFor = null;
  await data.loadJots(reg());
  SAVES = [];
}

test('mounts with no startup warnings or errors', () => {
  assert.deepEqual(problems, []);
});

test('the sparkle opens a prompt seeded with the jot', async () => {
  await seed();
  data.startAsk(data.jotItems[0]);
  assert.equal(data.askFor, 'j1abc');
  assert.equal(data.askDraft, 'which rivers feed the Columbia');
});

test('asking files one errand request and leaves the jot file alone', async () => {
  await seed();
  data.startAsk(data.jotItems[0]);
  data.askDraft = 'Which rivers feed the Columbia? A short list.';
  await data.askJot(data.jotItems[0]);
  clearTimeout(data.askTimer); data.askTimer = null;

  assert.equal(SAVES.length, 1, 'one write');
  const { path, value } = SAVES[0];
  assert.match(path, /^errands\/requests\/daemon-\d{4}-\d{2}-\d{2}-ask-j1abc-[a-z0-9]+\.json$/);
  assert.equal(value.run.method, 'laptop-daemon');
  assert.equal(value.run.op, 'ask');
  assert.equal(value.run.args.prompt, 'Which rivers feed the Columbia? A short list.');
  assert.equal(value.about, 'me/registry:lists/jots.json#j1abc');
  assert.equal(data.asks.j1abc.stage, 'sent');
  assert.equal(data.askFor, null, 'the prompt box closes');
});

test('the ask moves to thinking when claimed, then shows the reply', async () => {
  await seed();
  data.askDraft = 'rivers?';
  await data.askJot(data.jotItems[0]);
  clearTimeout(data.askTimer); data.askTimer = null;
  const id = data.asks.j1abc.id;

  FILES['errands/claims/' + id + '.json'] = { id, by: 'laptop' };
  await data.loadAsks(reg());
  clearTimeout(data.askTimer); data.askTimer = null;
  assert.equal(data.asks.j1abc.stage, 'thinking');

  delete FILES['errands/claims/' + id + '.json'];
  FILES['errands/results/' + id + '.json'] = { id, ok: true, closedAt: '2026-10-02T17:03:00Z',
    message: 'The Snake.', data: { op: 'ask', model: 'flash', reply: 'The Snake.\nThe Willamette.' } };
  await data.loadAsks(reg());
  assert.equal(data.asks.j1abc.stage, 'answered');
  assert.equal(data.asks.j1abc.reply, 'The Snake.\nThe Willamette.');
  assert.equal(data.asks.j1abc.open, true, 'the reply opens itself');
  assert.equal(data.askTimer, null, 'nothing left to watch, so polling stops');
});

test('a fresh ask survives a listing that has not caught up with it', async () => {
  await seed();
  data.askDraft = 'rivers?';
  await data.askJot(data.jotItems[0]);
  clearTimeout(data.askTimer); data.askTimer = null;
  const id = data.asks.j1abc.id;
  delete FILES['errands/requests/' + id + '.json'];      // the listing lags the write
  await data.loadAsks(reg());
  clearTimeout(data.askTimer); data.askTimer = null;
  assert.equal(data.asks.j1abc?.id, id);
  assert.equal(data.asks.j1abc.stage, 'sent');
});

test('opening the pane finds an earlier answer for a jot', async () => {
  const id = 'daemon-2026-10-01-ask-j1abc-mfoo1234';
  await seed({ ['errands/requests/' + id + '.json']: { id },
               ['errands/results/' + id + '.json']: { id, ok: false, message: 'Gemini did not answer: timeout' } });
  await data.loadAsks(reg());
  assert.equal(data.asks.j1abc.stage, 'answered');
  assert.equal(data.asks.j1abc.ok, false);
  assert.equal(data.asks.j1abc.reply, 'Gemini did not answer: timeout', 'a failure shows its reason');
});
