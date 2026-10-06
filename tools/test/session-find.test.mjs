// The shared reader turns an indexed session hit into literal source excerpts.
// Exercise the real matching kit with Alpine; only the unrelated deck painter
// is a stand-in here. Pixel and real deck checks live in session-find-browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, tick, repoRoot, captureAlpineErrors } from './bootstrap.mjs';

const at = n => '2026-10-01T10:' + String(n).padStart(2, '0') + ':00Z';
const record = {
  schema: 13, short: 'ab12cd34', day: '2026-10-01', opening_ask: 'Find the launch discussion',
  started: at(0), ended: at(8), exchanges: 2, prompts_stored: 2, repos: [],
  prompts: [{ at: at(0), text: 'Where was launch decided?' },
    { at: at(4), text: 'Can the budget change?' }],
  replies: [{ at: at(2), text: 'Launch requires <img src=x onerror=alert(1)> approval.' },
    { at: at(6), text: 'The budget is unchanged.' }],
};
const { window, problems } = makeWindow({ html: '<html><body><div id="reader" x-data="sessionBrief(window.opts)"></div></body></html>' });
window.history.replaceState(null, '', '/pages/session.html?use=feature%2Ffind&refs=me%2Frepo%40draft#gz=synthetic-payload&find=launch');
window.claudeMark = { svg: () => '<svg></svg>' };
window.gh = { load: async () => {} };
window.chatRender = {};
window.readAloud = {};
window.TitleTip = {};
for (const file of ['lib/kits/closing-state.js', 'lib/kits/session-render.js']) {
  new window.Function(readFileSync(path.join(repoRoot, file), 'utf8'))();
}
const opens = [];
window.sessionRender.open = async (_r, options) => { opens.push(options); return {}; };
window.sessionExport = { index: () => ({ el: window.document.createElement('div') }) };
window.swipeDeck = { top: () => null };
window.Element.prototype.scrollIntoView = function () {};
const changed = [];
window.opts = { record, find: 'launch budget', framed: true, repo: 'me/private',
  path: 'sessions/2026/10/2026-10-01-ab12cd34.json', onFind: value => changed.push(value) };
const { default: Alpine } = await import('alpinejs/dist/module.esm.js');
window.Alpine = Alpine;
captureAlpineErrors(Alpine);
new window.Function(readFileSync(path.join(repoRoot, 'lib/alpineComponents/session-brief.js'), 'utf8'))();
Alpine.start();
await tick(6);
const el = window.document.getElementById('reader');
const data = () => Alpine.$data(el);

test('a supplied search finds source passages without changing the host address at mount', () => {
  assert.deepEqual(problems, []);
  assert.equal(data().findResult.hits.length, 2);
  assert.equal(data().findResult.total, 4);
  assert.equal(data().findResult.allTerms, true);
  assert.deepEqual(changed, []);
  assert.equal(el.querySelectorAll('[data-session-match]').length, 2);
  assert.match(el.textContent, /Matches: launch/);
  assert.match(el.textContent, /Matches: budget/);
  assert.equal(el.querySelector('[data-session-find] img'), null, 'captured markup stays text');
  assert.match(el.querySelector('[data-session-find]').textContent, /<img src=x/);
});

test('a match opens its actual deck card and next/previous wrap within matches', async () => {
  const d = data();
  const expected = d.findResult.hits[1].card;
  const buttons = el.querySelectorAll('[data-session-match] button[aria-label^="Read exchange"]');
  buttons[1].click();
  await tick(2);
  assert.equal(opens.at(-1).start, expected);
  assert.equal(d.findAt, 1);
  d.stepFind(1);
  assert.equal(d.findAt, 0);
  d.stepFind(-1);
  assert.equal(d.findAt, 1);
});

test('search updates and clear notify only actual query changes and restore the outline', async () => {
  const d = data();
  d.findText = 'missing'; d.runFind();
  await tick(2);
  assert.equal(d.findResult.hits.length, 0);
  assert.match(el.textContent, /No matching captured exchanges/);
  d.runFind();
  assert.deepEqual(changed, ['missing']);
  d.clearFind();
  await tick(3);
  assert.equal(d.findQuery, '');
  assert.deepEqual(changed, ['missing', '']);
  // Alpine's x-show schedules its DOM update in requestAnimationFrame, which
  // can be later than a few zero-delay ticks under the full parallel suite.
  for (let i = 0; i < 30 && el.querySelector('[x-ref="outline"]').style.display === 'none'; i++) {
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  assert.notEqual(el.querySelector('[x-ref="outline"]').style.display, 'none');
});

test('exchange links retain the mounted subject, exact card, query and preview version', async () => {
  const d = data();
  d.findText = 'launch'; d.runFind();
  await tick(2);
  const card = d.findResult.hits[0].card;
  let url = new URL(d.exchangeUrl(card));
  let hash = new URLSearchParams(url.hash.slice(1));
  assert.equal(hash.get('gh'), 'me/private:sessions/2026/10/2026-10-01-ab12cd34.json');
  assert.equal(hash.has('gz'), false, 'framed reader must not inherit an outer identity');
  assert.equal(hash.get('find'), 'launch');
  assert.equal(hash.get('card'), String(card));
  assert.equal(url.searchParams.get('use'), 'feature/find');
  assert.deepEqual(url.searchParams.getAll('refs'), ['me/repo@draft']);
  d.framed = false;
  url = new URL(d.exchangeUrl(card));
  hash = new URLSearchParams(url.hash.slice(1));
  assert.equal(hash.get('gz'), 'synthetic-payload', 'standalone token-free address survives');
  assert.equal(hash.has('gh'), false);
  window.history.replaceState(null, '', '/pages/session.html#branch=me/repo@feature');
  window.__lib = 'codex/preview';
  url = new URL(d.exchangeUrl(card));
  hash = new URLSearchParams(url.hash.slice(1));
  assert.equal(hash.get('gh'), 'me/private:sessions/2026/10/2026-10-01-ab12cd34.json',
    'a moving branch resolves to the exact recorded session');
  assert.equal(hash.has('branch'), false);
  assert.equal(url.searchParams.get('use'), 'codex/preview', 'the loaded preview ref survives without a query shim');
  assert.equal(d.exchangeUrl(-1), '');
});

test('copy reports actual clipboard success or failure, and literal highlights cannot become markup', async () => {
  const d = data();
  let copied = '';
  Object.defineProperty(window.navigator, 'clipboard', { configurable: true,
    value: { writeText: async text => { copied = text; } } });
  const card = d.findResult.hits[0].card;
  await d.copyExchange(card);
  assert.equal(copied, d.exchangeUrl(card));
  assert.equal(d.findCopied, card);
  window.navigator.clipboard.writeText = async () => { throw new Error('denied'); };
  await d.copyExchange(card);
  assert.match(d.findCopyError, /could not be copied/);
  d.findResult.terms = ['a+b', '<img'];
  const parts = JSON.parse(JSON.stringify(d.findParts('a+b <img ordinary')));
  assert.deepEqual(parts.filter(p => p.match).map(p => p.text), ['a+b', '<img']);
  assert.equal(parts.map(p => p.text).join(''), 'a+b <img ordinary');
  assert.deepEqual(problems, []);
});
