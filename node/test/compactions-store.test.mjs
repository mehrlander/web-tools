// alpineComponents/compactions.js against the store's file format: each
// summary is sessions/compactions/YYYY/MM/<day>-<short>-<UTC time>.json in
// web-tools-private, one object whose `text` is the summary. The listing keeps
// only those files and names each by its file name without `.json`, the id
// `#at=`, `&item=` and the Cost tab's links address; the parse reads the facts
// and the nine sections from the object.

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
