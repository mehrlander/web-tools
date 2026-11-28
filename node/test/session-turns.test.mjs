// alpineComponents/session-brief.js — the Turns tab, with the Outline folded
// in (owner, 2026-11-17): a list of the exchanges over a strip of their cards
// (house style rule 11, kits/linked-swiper.js).
//
// What is pinned: a row is Gemini's headline where its file has one, else the
// exchange's own title; rows group under Gemini's topics, each marked with how
// its last stretch ended; a card is Gemini's summary over the exchange as
// session-render draws it; a search filters the list to the matching
// exchanges and moves the card to the first; a prompt named elsewhere (the
// cost chart, a topic on the Overview) selects its exchange here; and the
// card's door opens the full deck at it.
//
// Over the real session-render, swipe-deck and linked-swiper in jsdom; the
// turn renderer (chat-render) is a stand-in that writes the text.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, tick, repoRoot, captureAlpineErrors } from './bootstrap.mjs';

const at = (m) => '2026-10-01T10:' + String(m).padStart(2, '0') + ':00Z';
const record = {
  schema: 13, short: 'ab12cd34', day: '2026-10-01', started: at(0), ended: at(30), repos: [],
  prompts: [{ at: at(0), text: 'Plan the launch' }, { at: at(10), text: 'Check the budget' }, { at: at(20), text: 'Write it up' }],
  replies: [{ at: at(5), text: 'The launch plan is ready.' }, { at: at(15), text: 'The budget holds.' }, { at: at(25), text: 'Written.' }],
};
const topics = {
  title: 'Launch', summary: 'Planned a launch.',
  agenda: [{ topic: 'Launch plan', turns: [0, 1], kind: 'new', at: at(0), state: { glyph: '🟢', name: 'ready', line: 'Ready' } },
           { topic: 'Write-up', turns: [2, 2], kind: 'new', at: at(20), state: { glyph: '⚫', name: 'clean', line: 'Done' } }],
  turns: [{ turn: 0, at: at(0), headline: 'Plans the launch', summary: 'Sets out the launch steps.' },
          { turn: 1, at: at(10), headline: 'Checks the budget', summary: 'Confirms the budget holds.' }],
  turn_count: 3,
};

const { window, problems } = makeWindow({ html: '<html><body><div id="t" x-data="sessionBrief(window.__t)"></div></body></html>' });
window.claudeMark = { svg: () => '<svg></svg>' };
window.gh = { load: async () => {} };
window.readAloud = {};
window.TitleTip = {};
window.ClosingState = {};
window.chatRender = { ready: async () => {}, message: (t) => { const d = window.document.createElement('div'); d.setAttribute('data-role', t.role); d.textContent = t.md; return d; } };
for (const file of ['lib/vanilla-bundle.js', 'lib/kits/repo-address.js', 'lib/kits/closing-state.js', 'lib/kits/repo-sessions-cache.js',
                    'lib/kits/session-render.js', 'lib/kits/swipe-deck.js', 'lib/kits/linked-swiper.js']) {
  new window.Function('window', readFileSync(path.join(repoRoot, file), 'utf8'))(window);
}
window.sessionExport = { index: () => ({ el: window.document.createElement('div') }) };
const opens = [];
window.sessionRender.open = async (r, o) => { opens.push(o); return {}; };
window.Element.prototype.scrollIntoView = function () {};
window.Element.prototype.scrollTo = function () {};
window.__t = { record, repo: 'me/private', framed: true, pane: 'turns' };
const { default: Alpine } = await import('alpinejs/dist/module.esm.js');
window.Alpine = Alpine;
captureAlpineErrors(Alpine);
new window.Function(readFileSync(path.join(repoRoot, 'lib/alpine-bundle.js'), 'utf8'))();
new window.Function(readFileSync(path.join(repoRoot, 'lib/alpineComponents/session-brief.js'), 'utf8'))();
Alpine.start();
const el = window.document.getElementById('t');
const d = Alpine.$data(el);
const until = async (ok) => { for (let i = 0; i < 100 && !ok(); i++) await new Promise((r) => setTimeout(r, 20)); return ok(); };
const rows = () => [...el.querySelectorAll('[data-turn-list] [data-turn]')];
await until(() => rows().length === 3);
// Gemini's file, as readTopics would land it.
d.topics = topics; d.topicsState = 'found';
await tick(2);
d.mountTurns();
await until(() => /Plans the launch/.test(el.querySelector('[data-turn-list]').textContent));
await tick(4);

test('mounting is quiet', () => assert.deepEqual(problems, []));

test('rows are Gemini\'s headlines, else the exchange\'s own title, under topics marked by how they ended', () => {
  const text = rows().map((r) => [...r.children].map((c) => c.textContent.trim()).join(' '));
  assert.equal(text[0], '1 Plans the launch');
  assert.equal(text[1], '2 Checks the budget');
  assert.match(text[2], /^3 Write it up/, 'no headline for this turn, so its own title');
  const heads = [...el.querySelectorAll('[data-turn-list] .sticky')].map((h) => [...h.children].map((c) => c.textContent).join(' '));
  assert.deepEqual(heads, ['🟢 Launch plan', '⚫ Write-up']);
  assert.deepEqual([...el.querySelectorAll('[data-at="tabs"] [role="tab"]')].map((t) => t.textContent.trim().match(/^[A-Za-z]+/)?.[0]),
    ['Calls', 'Overview', 'Turns', 'Views', 'Files', 'Record'], 'no Outline tab');
});

test('a card is Gemini\'s summary over the exchange as session-render draws it', async () => {
  const card = el.querySelector('[data-turn-strip]');
  await until(() => card.querySelector('[data-turn-summary]'));
  assert.match(card.querySelector('[data-turn-summary]').textContent, /Sets out the launch steps/);
  assert.ok([...card.querySelectorAll('[data-role="user"]')].some((n) => /Plan the launch/.test(n.textContent)), 'the ask');
  assert.ok([...card.querySelectorAll('[data-role="assistant"]')].some((n) => /launch plan is ready/.test(n.textContent)), 'and the reply');
  assert.match(card.querySelector('[data-ls="head"]').textContent, /Plans the launch/, 'the head names the turn');
});

test('a prompt named elsewhere selects its exchange, and the door opens the deck there', async () => {
  d.goTurn(1);
  await tick(4);
  assert.equal(d.tSel, '1');
  assert.equal(rows()[1].getAttribute('aria-selected'), 'true');
  d.goTopic(d.gist.list.find((t) => t.topic === 'Write-up'));
  await tick(4);
  assert.equal(d.tSel, '2', 'a topic selects its first exchange');
  opens.length = 0;
  el.querySelector('[data-turn-strip] [data-swipe-cards]').click();
  await until(() => opens.length);
  assert.equal(opens[0].start, 2);
});

test('a search filters the list to the matching exchanges and moves the card to the first', async () => {
  d.findText = 'budget'; d.runFind();
  await until(() => rows().length === 1);
  assert.equal(rows()[0].getAttribute('data-turn'), '1');
  assert.equal(d.tSel, '1', 'the card moved to the match');
  assert.equal(el.querySelector('[data-find-count]').textContent, '1 turn');
  d.clearFind();
  await until(() => rows().length === 3);
  assert.equal(rows().length, 3, 'clearing brings every turn back');
});
