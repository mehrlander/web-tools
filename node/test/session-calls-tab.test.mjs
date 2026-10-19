// alpineComponents/session-brief.js — the Calls tab: the decisions a session put
// to the owner, beside its Outline, Files and Raw (owner, 2026-10-19: "it would
// be helpful to see it with the session like that as opposed to in this
// independent placement"). A framed slide in the app's Sessions pane read no
// calls at all before this; the tab is how it shows them.
//
// Driven over a fake GH holding one session with two calls, one answered.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, tick, repoRoot, captureAlpineErrors } from './bootstrap.mjs';

const STORE = 'me/private';
const record = {
  schema: 4, short: 'c0ffee01', day: '2026-10-15', started: '2026-10-15T10:00:00Z', ended: '2026-10-15T12:00:00Z',
  repos: [{ name: 'widget', branch: 'claude/x' }], exchanges: 1,
  prompts: [{ at: '2026-10-15T10:00:00Z', text: 'ask' }], replies: [{ at: '2026-10-15T11:00:00Z', text: 'reply' }], calls: [],
};
const CALLS = {
  'user-calls/c0ffee01-size.json': { id: 'c0ffee01-size', session: 'c0ffee01', kind: 'decision', name: 'Topic Size',
    question: 'Split topics?', brief: 'Eleven turns disagree.', recommend: 'Keep them whole', why: 'it is the key as built',
    size: 'S', confidence: 'firm', created: '2026-10-15T11:00:00Z' },
  'user-calls/c0ffee01-two.json': { id: 'c0ffee01-two', session: 'c0ffee01', kind: 'decision', question: 'Two steps?',
    recommend: 'Yes, switch', confidence: 'lean', why: 'closer on average', created: '2026-10-15T11:30:00Z' },
};
const ANSWERS = { 'user-calls/c0ffee01-two.answers.jsonl': '{"answer":"Take","at":"2026-10-16T00:00:00Z"}\n' };
const listed = [];
class FakeGH {
  constructor(conf = {}) { this.repo = conf.repo || ''; }
  async get(p) {
    if (p in CALLS && this.repo === STORE) return { text: JSON.stringify(CALLS[p]) };
    if (p in ANSWERS && this.repo === STORE) return { text: ANSWERS[p] };
    throw Object.assign(new Error('404'), { status: 404 });
  }
  async req(p) {
    if (p.startsWith('contents/user-calls')) {
      listed.push(this.repo);
      if (this.repo !== STORE) throw Object.assign(new Error('404'), { status: 404 });
      return [...Object.keys(CALLS), ...Object.keys(ANSWERS), 'user-calls/deadbeef-other.json']
        .map((f) => ({ name: f.split('/')[1], path: f, type: 'file' }));
    }
    return { tree: [] };
  }
  static FRESH = { cache: 'no-store' };
}

const { window, problems } = makeWindow({ html: `<!doctype html><html><body>
  <div id="slide" x-data="sessionBrief(window.__slide)"></div>
  <div id="none" x-data="sessionBrief(window.__none)"></div></body></html>` });
window.GH = FakeGH;
window.TOKEN = 'tkn';
window.gh = { load: async () => {} };
window.claudeMark = { svg: () => '<svg></svg>' };
window.sessionRender = { describe: (r) => ({ title: r.short, subtitle: '' }), turns: (r) => r.replies || [], groups: (t) => t.map((x) => [x]),
                         open: async () => ({ close(){} }) };
window.sessionExport = { index: () => ({ el: window.document.createElement('div') }) };
window.chatRender = { block: () => window.document.createElement('pre') };
const decks = [];
window.swipeDeck = { top: () => null, open: (o) => { decks.push({ count: o.count, start: o.start, title: o.title }); return { close(){} }; } };
// A slide of the app's Sessions pane, framed, opened on the Calls tab as a
// Waiting card's session link asks; and one whose session filed nothing.
window.__slide = { id: 'c0ffee01', repo: STORE, framed: true, record, pane: 'calls' };
window.__none = { id: 'feed0002', repo: STORE, framed: true, record: { ...record, short: 'feed0002' }, pane: 'calls' };

const { default: Alpine } = await import('alpinejs/dist/module.esm.js');
captureAlpineErrors(Alpine);
window.Alpine = Alpine;
for (const k of ['lib/kits/closing-state.js', 'lib/kits/repo-sessions-cache.js']) {
  new window.Function('window', readFileSync(path.join(repoRoot, k), 'utf8'))(window);
}
for (const p of ['lib/alpine-bundle.js', 'lib/alpineComponents/session-brief.js']) {
  new window.Function(readFileSync(path.join(repoRoot, p), 'utf8'))();
}
Alpine.start();
const el = (id) => window.document.getElementById(id);
const data = (id) => Alpine.$data(el(id));
const until = async (ok) => { for (let i = 0; i < 60 && !ok(); i++) await tick(2); return ok(); };
await until(() => data('slide').calls.length === 2 && !data('none').callsLoading);

test('mounting is quiet', () => assert.deepEqual(problems, []));

test('a framed slide reads its session\'s calls, and only its own', () => {
  assert.deepEqual(Array.from(data('slide').calls, (c) => c.id), ['c0ffee01-size', 'c0ffee01-two']);
  assert.ok(listed.includes(STORE), 'the store\'s user-calls/ is listed');
});

test('the Calls tab shows with a count, tinted while a call waits', async () => {
  const tab = el('slide').querySelector('[data-session-calls-tab]');
  await until(() => tab.style.display !== 'none');
  assert.notEqual(tab.style.display, 'none');
  assert.match(tab.textContent, /Calls\s*2/);
  await until(() => data('slide').openCallCount === 1);
  assert.equal(data('slide').openCallCount, 1, 'one is answered');
  assert.match(tab.querySelector('span').className, /bg-warning\/30/);
  assert.equal(el('none').querySelector('[data-session-calls-tab]').style.display, 'none', 'no calls, no tab');
});

test('the pane holds one card per call: question, brief, recommendation, state', async () => {
  const cards = [...el('slide').querySelectorAll('[data-session-call]')];
  assert.equal(cards.length, 2);
  await until(() => /Answered: Take/.test(cards[1].textContent));
  assert.match(cards[0].textContent, /Topic Size[\s\S]*Open[\s\S]*Split topics\?[\s\S]*Eleven turns disagree\.[\s\S]*Recommended:\s*Keep them whole/);
  assert.match(cards[1].textContent, /Decision[\s\S]*Answered: Take[\s\S]*Two steps\?[\s\S]*Lean/);
});

test('a card opens the deck of call forms at that call', () => {
  decks.length = 0;
  el('slide').querySelectorAll('[data-session-call]')[1].click();
  assert.deepEqual(decks, [{ count: 2, start: 1, title: 'Calls' }]);
});

test('an address asking for Calls on a session with none lands on the outline', () => {
  assert.equal(data('slide').pane, 'calls');
  assert.equal(data('none').pane, 'outline');
});
