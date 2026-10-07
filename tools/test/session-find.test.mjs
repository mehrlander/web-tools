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
let outlines = 0;
window.sessionExport = { index: () => { outlines++; return { el: window.document.createElement('div') }; } };
window.swipeDeck = { top: () => null };
window.Element.prototype.scrollIntoView = function () {};
const changed = [];
const matches = [];
window.opts = { record, find: 'launch budget', framed: true, repo: 'me/private',
  path: 'sessions/2026/10/2026-10-01-ab12cd34.json', onFind: value => changed.push(value),
  onMatches: value => matches.push(JSON.parse(JSON.stringify(value))) };
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
  assert.deepEqual(matches, [{ exchanges: 2, passages: 4, occurrences: 4,
    matchedTerms: ['launch', 'budget'], allTerms: true }]);
  assert.equal(outlines, 0, 'active search must not construct a hidden outline');
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
  assert.equal(outlines, 1, 'clearing builds the outline when it first becomes visible');
  assert.deepEqual(matches.slice(1), [
    { exchanges: 0, passages: 0, occurrences: 0, matchedTerms: [], allTerms: false },
    { exchanges: 0, passages: 0, occurrences: 0, matchedTerms: [], allTerms: false },
  ]);
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

async function compactReader(options = {}) {
  window.compactOpts = { record, find: 'launch budget', compact: true, framed: true,
    facts: { summary: 'Unrelated overview', topics: ['Unrelated topic'] }, ...options };
  const box = window.document.createElement('div');
  box.setAttribute('x-data', 'sessionBrief(window.compactOpts)');
  window.document.body.append(box);
  Alpine.initTree(box);
  await tick(6);
  return { box, d: Alpine.$data(box) };
}

test('compact reader mounts only discussion context and opens the selected full exchange', async () => {
  const before = outlines;
  let pagesRead = 0;
  const { box, d } = await compactReader({ pages: () => { pagesRead++; return []; } });
  assert.equal(box.querySelector('[role="tablist"]'), null);
  assert.equal(box.querySelector('section'), null, 'the unrelated overview never mounts');
  assert.doesNotMatch(box.textContent, /Unrelated overview|Unrelated topic|stored record on GitHub/);
  assert.equal(pagesRead, 0, 'the unrelated Look row is not evaluated');
  assert.equal(outlines, before);
  assert.equal(d.outlineBuilt, false);
  assert.match(box.querySelector('[role="status"]').textContent, /4 occurrences · 4 passages · 2 exchanges/);
  const open = [...box.querySelectorAll('button')].find(b => /Open session/.test(b.textContent));
  open.click(); await tick(2);
  assert.equal(opens.at(-1).start, d.findResult.hits[0].card);
  assert.equal(opens.at(-1).find, 'launch budget');
  d.stepFind(1); await tick(2);
  open.click(); await tick(2);
  assert.equal(opens.at(-1).start, d.findResult.hits[1].card);
  d.mountOutline();
  assert.equal(outlines, before, 'pane changes cannot build an invisible outline');
  d.clearFind(); await tick(3);
  assert.equal(outlines, before + 1);
  Alpine.destroyTree(box); box.remove();
  assert.deepEqual(problems, []);
});

test('compact metadata-only results keep honest context and full-session access', async () => {
  const note = 'Matched session title <img src=x>';
  const reports = [];
  const { box, d } = await compactReader({ find: 'not-in-discussion', matchNote: note,
    onMatches: value => reports.push(JSON.parse(JSON.stringify(value))) });
  assert.equal(box.querySelector('[role="status"]').textContent.trim(), note);
  assert.equal(box.querySelector('[role="status"] img'), null);
  assert.doesNotMatch(box.textContent, /search may have matched|No record|No matching captured exchanges/);
  assert.deepEqual(reports, [{ exchanges: 0, passages: 0, occurrences: 0, matchedTerms: [], allTerms: false }]);
  await d.openMatchedSession();
  assert.equal(opens.at(-1).start, 0);
  d.matchNote = ''; await tick(2);
  assert.match(box.querySelector('[role="status"]').textContent, /No matching discussion/);
  Alpine.destroyTree(box); box.remove();
});

test('a fixed compact query leaves search ownership with the host', async () => {
  const { box, d } = await compactReader({ fixedFind: true });
  assert.equal(box.querySelector('[role="search"]'), null);
  assert.equal(d.findQuery, 'launch budget');
  assert.equal(box.querySelectorAll('[data-session-match]').length, 2);
  assert.match(box.textContent, /Open session/);
  assert.equal(el.querySelectorAll('[role="search"]').length, 1, 'the ordinary session keeps its find input');
  Alpine.destroyTree(box); box.remove();
});

test('the embedding host receives the source deck handle it must release', async () => {
  const received = [];
  const { box, d } = await compactReader({ onOpen: handle => received.push(handle) });
  await d.openMatchedSession();
  assert.equal(received.length, 1);
  assert.equal(typeof received[0], 'object');
  Alpine.destroyTree(box); box.remove();
});

test('compact mode avoids unrelated warming and work reads even when standalone', async () => {
  const reads = [];
  window.GH = class { async get(path) { reads.push(path); throw new Error('unexpected read'); }
    async req(path) { reads.push(path); return {}; } };
  const { box, d } = await compactReader({ framed: false,
    warm: [{ path: 'sessions/unused-neighbour.json' }], pane: 'raw', onMatches: () => { throw new Error('host failed'); } });
  assert.equal(d.pane, 'outline');
  assert.equal(d.err, '');
  assert.equal(d.findResult.total, 4);
  assert.deepEqual(reads, []);
  Alpine.destroyTree(box); box.remove();
  assert.deepEqual(problems, []);
});

test('exact badges wait for the record read and report its captured discussion', async () => {
  const reports = [];
  let finish;
  window.GH = class { get() { return new Promise(resolve => { finish = resolve; }); } };
  const { box, d } = await compactReader({ record: null, path: 'sessions/delayed-record.json',
    fixedFind: true, onMatches: value => reports.push(JSON.parse(JSON.stringify(value))) });
  assert.equal(d.loading, true);
  assert.deepEqual(reports, [], 'a pending read is not an exact zero');
  finish({ text: JSON.stringify(record) });
  await tick(6);
  assert.equal(d.loading, false);
  assert.deepEqual(reports, [{ exchanges: 2, passages: 4, occurrences: 4,
    matchedTerms: ['launch', 'budget'], allTerms: true }]);
  assert.equal(d.outlineBuilt, false);
  Alpine.destroyTree(box); box.remove();
  assert.deepEqual(problems, []);
});
