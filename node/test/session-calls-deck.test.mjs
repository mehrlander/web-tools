// alpineComponents/session-brief.js — the deck of a session's calls holds
// those still waiting on the owner. A call already answered or closed is left
// out unless it is the one opened: on 2026-11-09 a deck of nine slides held
// four closed calls, and a closed call's slide told the owner nothing.
//
// Driven over a fake GH holding one session with five calls: two open
// documentation calls, one closed, one answered, and an open decision. The
// address names an open documentation call, as doc-craft's one link does, and
// the answers arrive after the calls, as they can over the network.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, tick, repoRoot, captureAlpineErrors } from './bootstrap.mjs';

const STORE = 'me/private';
const record = {
  schema: 4, short: 'c0ffee01', day: '2026-11-09', started: '2026-11-09T10:00:00Z', ended: '2026-11-09T12:00:00Z',
  repos: [], exchanges: 1, prompts: [{ at: '2026-11-09T10:00:00Z', text: 'ask' }], replies: [{ at: '2026-11-09T11:00:00Z', text: 'reply' }], calls: [],
};
const call = (slug, kind, at, more = {}) => ({ id: 'c0ffee01-' + slug, session: 'c0ffee01', slug, kind, question: slug + '?', created: at, status: 'open', ...more });
const CALLS = Object.fromEntries([
  call('readme', 'documentation', '2026-11-09T11:00:00Z'),
  call('done', 'documentation', '2026-11-09T11:05:00Z', { status: 'closed', closed: { answer: 'Apply all' } }),
  call('claude-md', 'documentation', '2026-11-09T11:10:00Z'),
  call('answered', 'documentation', '2026-11-09T11:15:00Z'),
  call('size', 'decision', '2026-11-09T11:20:00Z'),
].map((c) => ['user-calls/' + c.id + '.json', c]));
const ANSWERS = { 'user-calls/c0ffee01-answered.answers.jsonl': '{"answer":"1 confirmed","at":"2026-11-09T12:00:00Z"}\n' };
class FakeGH {
  constructor(conf = {}) { this.repo = conf.repo || ''; }
  async get(p) {
    // The answers arrive after the calls, as they can over the network.
    if (p in ANSWERS && this.repo === STORE) { await tick(6); return { text: ANSWERS[p] }; }
    if (p in CALLS && this.repo === STORE) return { text: JSON.stringify(CALLS[p]) };
    throw Object.assign(new Error('404'), { status: 404 });
  }
  async req(p) {
    if (p.startsWith('contents/user-calls')) {
      if (this.repo !== STORE) throw Object.assign(new Error('404'), { status: 404 });
      return [...Object.keys(CALLS), ...Object.keys(ANSWERS)].map((f) => ({ name: f.split('/')[1], path: f, type: 'file' }));
    }
    return { tree: [] };
  }
  static FRESH = { cache: 'no-store' };
}

const { window, problems } = makeWindow({ url: 'https://localhost/pages/session.html#id=c0ffee01&user-call=claude-md',
  html: `<!doctype html><html><body><div id="slide" x-data="sessionBrief(window.__slide)"></div></body></html>` });
window.GH = FakeGH;
window.TOKEN = 'tkn';
window.gh = { load: async () => {} };
window.claudeMark = { svg: () => '<svg></svg>' };
window.sessionRender = { describe: (r) => ({ title: r.short, subtitle: '' }), turns: (r) => r.replies || [], groups: (t) => t.map((x) => [x]),
                         open: async () => ({ close(){} }) };
window.sessionExport = { index: () => ({ el: window.document.createElement('div') }) };
window.chatRender = { block: () => window.document.createElement('pre') };
const decks = [];
window.swipeDeck = { top: () => null, open: (o) => {
  decks.push({ count: o.count, start: o.start, title: o.title, questions: Array.from({ length: o.count }, (_, i) => o.index(i).title) });
  return { close(){} };
} };
window.UserCallForm = { prOf: () => null, postAnswer: async () => {} };
window.__slide = { id: 'c0ffee01', repo: STORE, record };

const { default: Alpine } = await import('alpinejs/dist/module.esm.js');
captureAlpineErrors(Alpine);
window.Alpine = Alpine;
Alpine.data('userCallForm', () => ({}));
for (const k of ['lib/kits/repo-address.js', 'lib/kits/closing-state.js', 'lib/kits/repo-sessions-cache.js']) {
  new window.Function('window', readFileSync(path.join(repoRoot, k), 'utf8'))(window);
}
for (const p of ['lib/alpine-bundle.js', 'lib/alpineComponents/session-brief.js']) {
  new window.Function(readFileSync(path.join(repoRoot, p), 'utf8'))();
}
Alpine.start();
const data = () => Alpine.$data(window.document.getElementById('slide'));
const until = async (ok) => { for (let i = 0; i < 80 && !ok(); i++) await tick(2); return ok(); };
await until(() => decks.length > 0);

test('mounting is quiet', () => assert.deepEqual(problems, []));

test('an address naming a documentation call opens a deck of the open ones, at that call', () => {
  assert.equal(data().calls.length, 5, 'the Calls tab still lists every call');
  assert.deepEqual(decks, [{ count: 2, start: 1, title: 'Calls', questions: ['readme?', 'claude-md?'] }],
    'no closed call, no answered one, no other kind');
});

test('a closed call tapped on the Calls tab opens with the open ones of its kind', () => {
  decks.length = 0;
  data().openCalls(data().calls.findIndex((c) => c.slug === 'done'));
  assert.deepEqual(decks[0].questions, ['readme?', 'claude-md?', 'done?'], 'the Calls tab lists open calls first');
  assert.equal(decks[0].start, 2);
});
