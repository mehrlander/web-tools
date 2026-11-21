// alpineComponents/compactions.js against the store's file format: each
// summary is sessions/compactions/YYYY/MM/<day>-<short>-<UTC time>.json in
// web-tools-private, one object whose `text` is the summary. The listing keeps
// only those files and names each by its file name without `.json`, the id
// `#at=`, `&item=` and the Cost tab's links address; the parse reads the facts
// and the nine sections from the object. The list shows one row per session,
// with a tab per compaction where there is more than one, over one card per
// summary: kits/linked-swiper.js's items and sub-items, mounted here without a
// strip, so a card is drawn once and a pick redraws it.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, repoRoot } from './bootstrap.mjs';

const { window } = makeWindow();
let factory = null;
window.Alpine = { data: (name, f) => { if (name === 'compactions') factory = f; } };
window.esc = (s) => String(s);
new window.Function(readFileSync(path.join(repoRoot, 'lib/kits/linked-swiper.js'), 'utf8'))();
new window.Function(readFileSync(path.join(repoRoot, 'lib/alpineComponents/compactions.js'), 'utf8'))();
window.document.dispatchEvent(new window.Event('alpine:init'));
// Results come from the jsdom realm; copied out so deepEqual compares values.
const own = (x) => JSON.parse(JSON.stringify(x));
const parseDoc = (x) => own(window.Compactions.parseDoc(x));

const NINE = ['Primary Request and Intent', 'Key Technical Concepts', 'Files and Code Sections', 'Errors and fixes',
  'Problem Solving', 'All user messages', 'Pending Tasks', 'Current Work', 'Optional Next Step'];
const FILE = {
  schema: 'compaction/1', session: 'b2cdc8ac-0000-4000-8000-000000000000', short: 'b2cdc8ac', day: '2026-11-03',
  at: '2026-11-05T03:25:03.120Z', ordinal: 2, context_before: 781000, context_after: 113000, chars: 400,
  agent_session: 'https://claude.ai/code/session_x', opening_ask: 'Make the page',
  text: 'This session is being continued from a previous conversation that ran out of context. '
    + 'The summary below covers the earlier portion of the conversation.\n\nSummary:\n'
    + NINE.map((n, i) => `${i + 1}. ${n}:\n   - point ${i + 1}`).join('\n\n')
    + '\n\nIf you need specific details from before compaction, read the transcript.',
};

test('a file is read as JSON: every key but text is a fact, text is the summary', () => {
  for (const input of [JSON.stringify(FILE, null, 1) + '\n', FILE]) {
    const d = parseDoc(input);
    assert.equal(d.meta.ordinal, 2);
    assert.equal(d.meta.context_before, 781000);
    assert.equal(d.meta.context_after, 113000);
    assert.equal(d.meta.opening_ask, 'Make the page');
    assert.equal('text' in d.meta, false);
    assert.equal(d.nine, true);
    assert.deepEqual(d.sections.map((s) => s.n), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    assert.equal(d.sections[0].text, '   - point 1');
    assert.equal(d.lead, '', 'the harness lead and closing instruction are left out');
  }
});

test('a far-ahead numbered line inside a section is not taken for a later head', () => {
  const text = NINE.map((n, i) => `${i + 1}. ${n}:\n   - point ${i + 1}`).join('\n\n')
    .replace('   - point 1', '   - point 1\n9. The user asked for the next step: ship it');
  const d = parseDoc({ ...FILE, text: 'Summary:\n' + text });
  assert.deepEqual(d.sections.map((s) => s.n), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(d.nine, true);
  assert.ok(d.sections[0].text.includes('9. The user asked for the next step'));
});

test('a summary in another shape is drawn whole, and null sizes stay null', () => {
  const d = parseDoc({ ...FILE, context_before: null, context_after: null, text: 'Just a note.\n' });
  assert.equal(d.nine, false);
  assert.deepEqual(d.sections, []);
  assert.equal(d.lead, 'Just a note.');
  assert.equal(d.meta.context_before, null);
});

test('the listing keeps .json files and names each by its file name without the extension', async () => {
  const tree = {
    'sessions/compactions': [{ type: 'dir', name: '2026', path: 'sessions/compactions/2026' }],
    'sessions/compactions/2026': [{ type: 'dir', name: '11', path: 'sessions/compactions/2026/11' }],
    'sessions/compactions/2026/11': [
      { type: 'file', name: '2026-11-03-b2cdc8ac-20261105T032503Z.json', path: 'sessions/compactions/2026/11/2026-11-03-b2cdc8ac-20261105T032503Z.json', size: 900 },
      { type: 'file', name: '2026-11-03-c0517ab1-20261103T133000Z.json', path: 'sessions/compactions/2026/11/2026-11-03-c0517ab1-20261103T133000Z.json', size: 500 },
      { type: 'file', name: '2026-11-03-c0517ab1-20261103T120000Z.md', path: 'sessions/compactions/2026/11/2026-11-03-c0517ab1-20261103T120000Z.md', size: 5 },
      { type: 'file', name: 'README.json', path: 'sessions/compactions/2026/11/README.json', size: 5 },
    ],
  };
  const c = factory(null);
  c.gh = { ls: async (p) => tree[p] || [] };
  const rows = own(await c.list());
  assert.deepEqual(rows.map((r) => r.id), ['2026-11-03-b2cdc8ac-20261105T032503Z', '2026-11-03-c0517ab1-20261103T133000Z']);
  assert.equal(rows[0].path, 'sessions/compactions/2026/11/2026-11-03-b2cdc8ac-20261105T032503Z.json');
  assert.equal(rows[0].short, 'b2cdc8ac');
  assert.equal(rows[0].size, 900);
});

test("the Cost tab's compaction name is a listed id", async () => {
  const U = {};
  new window.Function('window', readFileSync(path.join(repoRoot, 'lib/kits/session-usage.js'), 'utf8'))(U);
  const name = U.SessionUsage.compactionName({ day: '2026-11-03', short: 'c0517ab1' }, '2026-11-03T13:30:00.000Z');
  const c = factory(null);
  c.gh = { ls: async (p) => p === 'sessions/compactions' ? [{ type: 'dir', name: '2026', path: 'y' }]
    : p === 'y' ? [{ type: 'dir', name: '11', path: 'm' }]
    : [{ type: 'file', name: name + '.json', path: 'm/' + name + '.json', size: 1 }] };
  c.rows = await c.list();
  assert.ok(c.byId(name), name);
});

const TREE = {
  'sessions/compactions': [{ type: 'dir', name: '2026', path: 'sessions/compactions/2026' }],
  'sessions/compactions/2026': [{ type: 'dir', name: '11', path: 'sessions/compactions/2026/11' }],
  'sessions/compactions/2026/11': ['2026-11-03-b2cdc8ac-20261105T032503Z', '2026-11-03-b2cdc8ac-20261107T130000Z',
    '2026-11-03-b2cdc8ac-20261104T010000Z', '2026-11-06-c0517ab1-20261106T133000Z']
    .map((n) => ({ type: 'file', name: n + '.json', path: 'sessions/compactions/2026/11/' + n + '.json', size: 1 })),
};
const B = '2026-11-03-b2cdc8ac', C1 = '2026-11-06-c0517ab1';
async function listed(get) {
  const c = factory(null);
  c.gh = { ls: async (p) => TREE[p] || [], get };
  c.rows = await c.list();
  return c;
}
// The component on the kit, as its template mounts it. Nothing is read, so
// the summaries' cache stays as the card tests below expect it.
function mounted(c) {
  c.read = () => {};
  const root = window.document.createElement('div');
  root.innerHTML = '<div data-t="list"></div><div data-t="card"></div>';
  window.document.body.append(root);
  c.$refs = { root, list: root.querySelector('[data-t="list"]'), card: root.querySelector('[data-t="card"]') };
  c.mount();
  return c.$refs;
}
const tap = (el) => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));

test('the list has one row per session, the latest compaction first, with a tab per compaction where there is more than one', async () => {
  const c = await listed();
  assert.deepEqual(own(c.groups.map((g) => g.id)), [B, C1], 'b2cdc8ac was last compacted on the 7th, after c0517ab1 on the 6th');
  const ids = [B + '-20261104T010000Z', B + '-20261105T032503Z', B + '-20261107T130000Z'];
  assert.deepEqual(own(c.groups[0].items.map((r) => r.id)), ids);
  assert.deepEqual(own(c.order), [...ids, C1 + '-20261106T133000Z'],
    "the cards run session by session, a session's summaries in the order they were written");
  c.sel = ids[0];
  const { list } = mounted(c);
  assert.deepEqual(own(c._swiper.slides().map((x) => x.sub)), own(c.order), "the kit's cards run in that order");
  const [many, once] = list.children;
  assert.equal(many.getAttribute('data-cmp'), B, 'a row is its session');
  assert.deepEqual([...many.querySelectorAll('[role="tab"]')].map((t) => [t.textContent, t.getAttribute('data-ls-sub')]), ids.map((id, i) => [String(i + 1), id]));
  assert.match(many.querySelector('[role="tab"]').getAttribute('aria-label'), /^Compaction 1 of 3, /);
  assert.doesNotMatch(many.textContent, /×/);
  assert.equal(once.getAttribute('data-cmp'), C1, 'a session compacted once is picked by its row');
  assert.equal(once.querySelector('[role="tab"]'), null);
});

test("a tap on a row outside its tabs opens the session's first summary, a tap on a tab that one, and the head carries its number", async () => {
  const c = await listed(async () => { throw new Error('404'); });
  c.sel = B + '-20261107T130000Z';
  const { list, card } = mounted(c);
  const row = (g) => list.querySelector(`[data-cmp="${g}"]`);
  const pill = () => card.querySelector('[data-ls="head"] [data-ls-pill]')?.textContent ?? '';
  assert.equal(row(B).querySelector('[role="tab"]:nth-child(3)').getAttribute('aria-selected'), 'true', "the open summary's tab is the active one");
  assert.equal(row(B).getAttribute('aria-selected'), 'true', 'and its row is tinted');
  assert.equal(pill(), '3', "the card's head carries its compaction's number");
  tap(row(B).querySelector('[role="tab"]:nth-child(2)'));
  assert.equal(c.sel, B + '-20261105T032503Z');
  tap(row(B).querySelector('.truncate'));
  assert.equal(c.sel, B + '-20261104T010000Z');
  assert.equal(pill(), '1');
  tap(row(C1));
  assert.equal(c.sel, C1 + '-20261106T133000Z');
  assert.equal(pill(), '', 'a session compacted once has no number to give');
});

test('a card is the chart\'s room and the summary, every section open under a heading that sticks, and nothing scrolls sideways', async () => {
  const c = await listed(async (p) => {
    if (p.startsWith('sessions/usage/')) throw new Error('404');
    return { text: JSON.stringify({ ...FILE, text: FILE.text.replace('   - point 3', '   ```\n   const a = 1;\n   ```\n   | a | b |') }) };
  });
  await c.listUsage();
  window.Compactions.USAGE.delete(B);
  const id = B + '-20261107T130000Z';
  c.sel = id;
  const slide = window.document.createElement('div');
  slide.className = 'sd-slide overflow-y-auto';
  const el = window.document.createElement('div');
  slide.append(el);
  window.document.body.append(slide);
  c.fill(id, el, false);
  const box = el.firstElementChild;
  assert.deepEqual([...box.children].map((x) => Object.keys(x.dataset)[0]), ['cmpChart', 'cmpRest'], 'the chart first, then the summary');
  assert.ok(slide.classList.contains('overflow-x-hidden'), "the card's scroller moves up and down only");
  for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 5));
  const secs = [...el.querySelectorAll('[data-sec]')];
  assert.deepEqual(secs.map((x) => x.dataset.sec), ['1', '6', '8', '7', '9', '2', '3', '4', '5'], 'the plain-language five, then the technical four');
  assert.equal(el.querySelector('details, [data-sec-nav], [data-sec-go]'), null, 'no fold and no chip: every section is open');
  assert.deepEqual(secs.map((x) => x.firstElementChild.firstChild.textContent), [0, 5, 7, 6, 8, 1, 2, 3, 4].map((i) => NINE[i]),
    "a heading is the section's name, without the number the reordering would scramble");
  assert.deepEqual(secs.map((x) => x.querySelector('h3 [data-sec-count]')?.textContent || ''), ['(1)', '(1)', '(1)', '(1)', '(1)', '(1)', '', '(1)', '(1)'],
    'beside the name, how many items its list has; the section rewritten as a code block and a table line has none');
  for (const x of secs) assert.match(x.firstElementChild.className, /\bsticky\b.*--cmp-pad.*\bbg-base-100\b/, 'a heading sticks to the top and covers what scrolls under it');
  assert.ok(box.style.getPropertyValue('--cmp-pad') !== '', "the headings are told the scroller's top padding");
  assert.ok(el.querySelector('[data-sec="3"] pre'), 'a technical section is drawn without being opened');
  assert.equal(el.querySelector('[role="tab"], [data-cmp-top]'), null, 'no tab row on the card');
  assert.doesNotMatch(el.textContent, /Make the page/, "the session's opening ask is not drawn on the card");
  assert.doesNotMatch(el.innerHTML, /overflow-x-auto|whitespace-nowrap|whitespace-pre(?!-wrap)/, 'code and table lines wrap');
});

test('the usage listing says which cards keep room for a chart, before any file is read', async () => {
  const c = await listed(async () => { throw new Error('404'); });
  const USAGE = window.Compactions.USAGE;
  USAGE.delete(B); USAGE.delete(C1);
  const usage = {
    'sessions/usage': [{ type: 'dir', name: '2026', path: 'sessions/usage/2026' }],
    'sessions/usage/2026': [{ type: 'dir', name: '11', path: 'sessions/usage/2026/11' }],
    'sessions/usage/2026/11': [{ type: 'file', name: B + '.json', path: 'sessions/usage/2026/11/' + B + '.json' }],
  };
  const ls = c.gh.ls;
  c.gh.ls = async (p) => usage[p] || ls(p);
  await c.listUsage();
  assert.equal(c.hasUsage(B), true);
  assert.equal(c.hasUsage(C1), false);
  const room = (id) => {
    const el = window.document.createElement('div');
    window.document.body.append(el);
    c.fill(id, el, false);
    return el.querySelector('[data-cmp-chart]');
  };
  assert.equal(room(B + '-20261107T130000Z').classList.contains('hidden'), false, 'a session with an extract keeps the chart\'s room');
  assert.match(room(B + '-20261104T010000Z').className, /min-h-\[82px\]/);
  assert.equal(room(C1 + '-20261106T133000Z').classList.contains('hidden'), true, 'a session without one keeps none');
  c.gh.ls = async () => { throw new Error('offline'); };
  await c.listUsage();
  assert.equal(c.hasUsage(C1), undefined, 'a failed listing leaves it unknown');
});

test('the section in view goes with the reader on a swipe and inside a session, and not to another session by its row', async () => {
  const c = await listed();
  const [b1, b2, , c1] = c.order;
  assert.equal(c.carries(b1, b2, 'list'), true, "a tab of the same session, tapped in the list");
  assert.equal(c.carries(b2, c1, 'swipe'), true, 'a swipe, into another session too');
  assert.equal(c.carries(b2, c1, 'list'), false, "another session's row starts at the top");
  assert.equal(c.carries(b2, c1, 'api'), false);
  c._deck = {};
  assert.equal(c.carries(b2, c1, 'api'), true, 'a swipe in the deck arrives through the host');
  assert.deepEqual(own(c.neighbours(b2)), [b1, c.order[2]], 'the cards either side follow the one in view');
  assert.deepEqual(own(c.neighbours(b1)), [b2]);
});

test("a note the summary's writer put after a heading's name is kept, in lighter type", () => {
  const c = factory(null);
  const h = c.head({ n: 3, name: 'Files and Code Sections (referenced; no edits survive)' });
  assert.equal(h.textContent, 'Files and Code Sections (referenced; no edits survive)', 'every word as written');
  assert.equal(h.firstChild.textContent, 'Files and Code Sections');
  assert.match(h.lastChild.className, /font-normal/);
  assert.equal(c.head({ n: 1, name: 'Primary Request and Intent' }).childElementCount, 0);
});

test('the summaries either side of the one in view are read ahead', async () => {
  const c = await listed(async () => { throw new Error('404'); });
  const [b1, b2, b3, c1] = c.order;
  c.sel = b1;
  const asked = [];
  c.read = (id) => { asked.push(id); };
  const el = (id) => { const x = window.document.createElement('div'); window.document.body.append(x); c.fill(id, x, false); };
  el(b3); el(c1);
  assert.deepEqual(asked, [], 'a card two or three away is not read');
  el(b2); el(b1);
  assert.deepEqual(asked, [b2, b1], 'the card in view and the one beside it are');
});

test('a section heading counts the top-level items of its list, and a prose section has no count', () => {
  const c = factory(null);
  const listed3 = c.section({ n: 7, name: 'Pending Tasks', text: '   - one\n     - under one\n   - two\n   1. three is a new list\n' });
  assert.equal(listed3.querySelector('[data-sec-count]').textContent, '(3)', 'nested items are not counted');
  assert.equal(listed3.querySelector('[data-sec-count]').getAttribute('aria-label'), '3 items');
  const prose = c.section({ n: 8, name: 'Current Work', text: '   The session was drafting a README.\n' });
  assert.equal(prose.querySelector('[data-sec-count]'), null);
  const noted = c.section({ n: 3, name: 'Files and Code Sections (referenced)', text: '   - a.md\n' });
  assert.deepEqual([...noted.firstElementChild.childNodes].map((x) => x.textContent), ['Files and Code Sections', '(1)', ' (referenced)'],
    "the count sits between the name and the writer's note");
});
