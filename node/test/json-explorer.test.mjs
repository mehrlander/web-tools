import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, repoRoot } from './bootstrap.mjs';

const { window } = makeWindow({ html: '<!doctype html><html><body><div id="c"></div></body></html>' });
new window.Function(readFileSync(path.join(repoRoot, 'lib/kits/json-explorer.js'), 'utf8'))();

const { JsonProfile, JsonExplorer } = window;

const sampleSession = {
  schema: 4,
  short: 'b8fae678',
  day: '2026-08-05',
  started: '2026-08-05T13:00:00Z',
  ended: '2026-08-05T16:00:00Z',
  agent_session: 'https://claude.ai/code/session_01SX',
  repos: [{ name: 'web-tools', branch: 'claude/a-1' }],
  calls: [
    { tool: 'read_file', path: 'lib/kits/csv.js', status: 'ok' },
    { tool: 'edit_file', path: 'lib/kits/csv.js', status: 'ok' },
    { tool: 'run_cmd', cmd: 'git status', status: 'err' },
  ],
  flags: { active: true, cached: false, debug: null },
  notes: 'A sample session record for testing.',
};

test('JsonProfile.analyze computes metrics, type counts, and collection schemas', () => {
  const profile = JsonProfile.analyze(sampleSession);

  assert.ok(profile.byteSize > 100, 'byte size computed');
  assert.ok(profile.nodeCount >= 20, 'nodes counted');
  assert.ok(profile.maxDepth >= 3, 'max depth calculated');

  assert.equal(profile.typeCounts.string >= 8, true, 'strings counted');
  assert.equal(profile.typeCounts.number >= 1, true, 'numbers counted');
  assert.equal(profile.typeCounts.boolean, 2, 'booleans counted');
  assert.equal(profile.typeCounts.null, 1, 'nulls counted');
  assert.equal(profile.typeCounts.array >= 2, true, 'arrays counted');
  assert.equal(profile.typeCounts.object >= 5, true, 'objects counted');

  // Root entries
  assert.equal(profile.rootEntries.length, 10);
  const reposEntry = profile.rootEntries.find(e => e.key === 'repos');
  assert.equal(reposEntry.type, 'array');
  assert.equal(reposEntry.count, 1);
  assert.equal(reposEntry.isCollection, true);

  // Collections schema inference
  const callsColl = profile.collections.find(c => c.key === 'calls');
  assert.ok(callsColl, 'calls collection found');
  assert.equal(callsColl.length, 3);
  assert.equal(callsColl.isRecordArray, true);

  const toolCol = callsColl.columns.find(c => c.name === 'tool');
  assert.ok(toolCol, 'tool column detected');
  assert.equal(toolCol.type, 'string');
  assert.equal(toolCol.fillRate, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(toolCol.samples)), ['read_file', 'edit_file', 'run_cmd']);

  const cmdCol = callsColl.columns.find(c => c.name === 'cmd');
  assert.ok(cmdCol, 'cmd column detected');
  assert.equal(cmdCol.fillRate, 1 / 3, 'partial fill rate for sparse column');
});

test('JsonExplorer.mount builds the toolbar once and draws the top level as rows', () => {
  const container = window.document.getElementById('c');
  const explorer = JsonExplorer.mount(container, {
    data: sampleSession,
    name: 'test-session.json',
  });

  assert.ok(explorer, 'explorer instance returned');
  assert.ok(container.querySelector('.json-explorer'), 'explorer element mounted');

  const tabs = [...container.querySelectorAll('[role="tablist"] [role="tab"]')]
    .filter(t => !t.classList.contains('hidden')).map(t => t.textContent.trim());
  assert.deepEqual(tabs, ['Tree', 'Schema', 'JSON'], 'Table is offered only on an array of records');
  assert.equal(container.querySelector('select'), null, 'no chunk select: the tree drills in itself');

  const searchInput = container.querySelector('input[type="search"]');
  assert.ok(searchInput, 'search input rendered');

  // One row per top-level field, and no root row above them.
  const rows = [...container.querySelectorAll('[data-path]')];
  assert.equal(rows.length, Object.keys(sampleSession).length, 'one row per top-level field');
  assert.equal(container.querySelector('[data-path="root"]'), null, 'no root row');
  assert.ok(!container.textContent.includes('nullnull'), 'no "nullnull" label (Element.append(null) writes "null")');

  const calls = container.querySelector('[data-path="calls"]');
  assert.match(calls.textContent, /3 items/, 'a collection says how many items it holds');
  assert.equal(calls.getAttribute('aria-expanded'), 'false', 'collections start closed');

  // At the top level there is nothing to show in the crumb trail.
  assert.ok(container.querySelector('[data-crumbs]').classList.contains('hidden'), 'crumbs hidden at the top level');

  explorer.destroy();
});

test('JsonExplorer opens a collection on a tap and offers a way back', () => {
  const container = window.document.getElementById('c');
  const explorer = JsonExplorer.mount(container, { data: sampleSession, name: 's.json' });

  container.querySelector('[data-path="calls"]').click();
  assert.equal(container.querySelector('[data-path="calls"]').getAttribute('aria-expanded'), 'true');
  assert.ok(container.querySelector('[data-path="calls[0]"]'), 'children drawn once opened');

  const collapse = container.querySelector('[aria-label="Collapse to the top level"]');
  assert.ok(!collapse.classList.contains('hidden'), 'collapse offered once something is open');
  collapse.click();
  assert.equal(container.querySelector('[data-path="calls[0]"]'), null, 'collapse closes it again');
  assert.ok(collapse.classList.contains('hidden'), 'and hides itself');

  explorer.destroy();
});

test('JsonExplorer chunk zooming and path navigation', () => {
  const container = window.document.getElementById('c');
  const explorer = JsonExplorer.mount(container, {
    data: sampleSession,
    chunk: ['calls'],
  });

  const crumbs = [...container.querySelectorAll('[data-crumb]')].map(b => b.textContent.trim());
  assert.deepEqual(crumbs, ['document.json', 'calls']);
  assert.match(container.querySelector('[data-crumbs]').textContent, /3 items/, 'the trail says what is open');

  const tableTab = [...container.querySelectorAll('[role="tab"]')].find(t => t.textContent.includes('Table'));
  assert.ok(tableTab && !tableTab.classList.contains('hidden'), 'table tab available for calls chunk');

  explorer.setView('table');
  const table = container.querySelector('table');
  assert.ok(table, 'table element rendered');
  const headers = [...table.querySelectorAll('th')].map(th => th.textContent.trim());
  assert.ok(headers.includes('tool') && headers.includes('status'), 'table headers match calls schema');

  explorer.focusChunk([]);
  assert.deepEqual([...container.querySelectorAll('[data-crumb]')], [], 'no trail back at the top level');
  assert.equal(container.querySelector('[role="tab"][aria-selected="true"]').textContent.trim(), 'Tree',
    'leaving an array of records leaves the Table view');

  // The row's arrow opens a field on its own.
  container.querySelector('[data-path="repos"] [aria-label="Open repos on its own"]').click();
  assert.deepEqual([...container.querySelectorAll('[data-crumb]')].map(b => b.textContent.trim()), ['document.json', 'repos']);

  explorer.destroy();
});

test('JsonExplorer search filters to matching rows and their ancestors', () => {
  const container = window.document.getElementById('c');
  const explorer = JsonExplorer.mount(container, {
    data: sampleSession,
  });

  explorer.updateSearch('run_cmd');
  assert.equal(container.querySelector('[data-match-count]').textContent.trim(), '1');

  const paths = [...container.querySelectorAll('[data-path]')].map(r => r.dataset.path);
  assert.deepEqual(paths, ['calls', 'calls[2]', 'calls[2].tool'], 'only the match and the way to it');
  const matchedRow = container.querySelector('.bg-primary\\/10');
  assert.ok(matchedRow, 'matched row highlighted');
  assert.ok(matchedRow.textContent.includes('run_cmd'));

  explorer.updateSearch('');
  assert.equal(container.querySelector('[data-match-count]').textContent, '', 'count cleared on empty search');
  assert.equal(container.querySelectorAll('[data-path]').length, Object.keys(sampleSession).length);

  explorer.destroy();
});

test('JsonExplorer keeps one filter input across renders, so typing is not interrupted', () => {
  const container = window.document.getElementById('c');
  const explorer = JsonExplorer.mount(container, { data: sampleSession });
  const input = container.querySelector('input[type="search"]');
  explorer.updateSearch('csv');
  assert.equal(container.querySelector('input[type="search"]'), input,
    'the input survives a render; it was rebuilt on every keystroke and lost focus');
  explorer.setView('schema');
  explorer.setView('tree');
  assert.equal(container.querySelector('input[type="search"]'), input);
  explorer.destroy();
});

test('JsonExplorer Schema view renders a one-line summary and collections', () => {
  const container = window.document.getElementById('c');
  const explorer = JsonExplorer.mount(container, {
    data: sampleSession,
    mode: 'schema',
  });

  const summary = container.querySelector('[data-schema-summary]');
  assert.ok(summary, 'summary line rendered');
  assert.match(summary.textContent, /nodes · depth \d+ · \d+ collections?$/);

  const schemaTables = container.querySelectorAll('table');
  assert.ok(schemaTables.length >= 2, 'top keys and collection schema tables rendered');

  explorer.destroy();
});

test('JsonExplorer Raw view renders preformatted text', () => {
  const container = window.document.getElementById('c');
  const explorer = JsonExplorer.mount(container, {
    data: sampleSession,
    mode: 'raw',
  });

  const pre = container.querySelector('pre');
  assert.ok(pre, 'pre tag rendered');
  assert.ok(pre.textContent.includes('"schema": 4'));

  explorer.destroy();
});
