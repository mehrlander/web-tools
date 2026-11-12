// alpineComponents/compactions.js against the store's file format: each
// summary is sessions/compactions/YYYY/MM/<day>-<short>-<UTC time>.json in
// web-tools-private, one object whose `text` is the summary. The listing keeps
// only those files and names each by its file name without `.json`, the id
// `#at=`, `&item=` and the Cost tab's links address; the parse reads the facts
// and the nine sections from the object. The list shows one row per session,
// and a session's card shows one of its summaries at a time, chosen by a tab.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, repoRoot } from './bootstrap.mjs';

const { window } = makeWindow();
let factory = null;
window.Alpine = { data: (name, f) => { if (name === 'compactions') factory = f; } };
window.esc = (s) => String(s);
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

test('the list has one row per session, the latest compaction first, and a session keeps its summaries in time order', async () => {
  const c = await listed();
  assert.deepEqual(own(c.groups.map((g) => g.id)), [B, C1], 'b2cdc8ac was last compacted on the 7th, after c0517ab1 on the 6th');
  assert.deepEqual(own(c.groups[0].items.map((r) => r.id)),
    [B + '-20261104T010000Z', B + '-20261105T032503Z', B + '-20261107T130000Z']);
  const row = c.rowHtml(c.groups[0]);
  assert.match(row, new RegExp('data-cmp="' + B + '"'), 'a row is addressed by its session');
  assert.match(row, /×3/, 'a session compacted more than once says how many times');
  assert.doesNotMatch(c.rowHtml(c.groups[1]), /×/);
});

test("a session's card shows its latest summary until another is opened there", async () => {
  const c = await listed();
  assert.equal(c.curOf(B), B + '-20261107T130000Z');
  c.cur[B] = B + '-20261104T010000Z';
  assert.equal(c.curOf(B), B + '-20261104T010000Z');
  c.cur[B] = 'gone';
  assert.equal(c.curOf(B), B + '-20261107T130000Z', 'a summary no longer listed falls back to the latest');
  assert.equal(c.curOf('2026-01-01-00000000'), '');
});

test('a context size is written in thousands', () => {
  const k = window.Compactions.fmtK;
  assert.deepEqual([785231, 105235, 999, 1000, 1250000, null].map(k), ['785k', '105k', '999', '1k', '1.25M', '?']);
});

test('a card: the chart\'s room, then one line with a tab per compaction and the open summary\'s facts, then the summary', async () => {
  const c = await listed(async (p) => {
    if (p.startsWith('sessions/usage/')) throw new Error('404');
    return { text: JSON.stringify({ ...FILE, context_before: 785231, context_after: 105235 }) };
  });
  await c.listUsage();
  window.Compactions.USAGE.delete(B);
  c.sel = c.curOf(B);
  const el = window.document.createElement('div');
  window.document.body.append(el);
  c.fill(B, el, false);
  const box = el.firstElementChild;
  assert.deepEqual([...box.children].map((x) => Object.keys(x.dataset)[0] || x.className), ['cmpChart', '@container', 'cmpRest'],
    'the chart is first, the line of tabs under it');
  for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 5));
  const top = el.querySelector('[data-cmp-top]');
  const tabs = [...top.querySelectorAll('[role="tab"]')];
  assert.deepEqual(tabs.map((t) => t.textContent), ['1', '2', '3']);
  assert.equal(top.querySelector('.tab-active').textContent, '3', 'the latest is open');
  assert.match(top.textContent, /785k → 105k/);
  assert.doesNotMatch(top.textContent, /token|character|\bof\b/);
  assert.equal(top.querySelector('[data-session-link]').getAttribute('aria-label'), 'Open the session');
  assert.ok(el.querySelector('[data-sec="1"]'), 'the summary is drawn under the line');
  assert.doesNotMatch(el.textContent, /Make the page/, "the session's opening ask is not drawn on the card");

  tabs[0].dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  assert.equal(c.sel, B + '-20261104T010000Z', 'a tab opens its summary');
  assert.equal(el.querySelector('[data-cmp-top] .tab-active').textContent, '1');
  assert.equal(el.querySelector('[data-usage-chart]').getAttribute('data-usage-chart'), B + '-20261104T010000Z',
    "the chart stays and is told which summary's drop to pick out");

  const one = window.document.createElement('div');
  window.document.body.append(one);
  c.fill(C1, one, false);
  assert.equal(one.querySelector('[role="tablist"]'), null, 'a session compacted once has no tabs');
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
  const room = (gid) => {
    const el = window.document.createElement('div');
    window.document.body.append(el);
    c.fill(gid, el, false);
    return el.querySelector('[data-cmp-chart]');
  };
  assert.equal(room(B).classList.contains('hidden'), false, 'a session with an extract keeps the chart\'s room');
  assert.match(room(B).className, /min-h-\[88px\]/);
  assert.equal(room(C1).classList.contains('hidden'), true, 'a session without one keeps none');
  c.gh.ls = async () => { throw new Error('offline'); };
  await c.listUsage();
  assert.equal(c.hasUsage(C1), undefined, 'a failed listing leaves it unknown');
});
