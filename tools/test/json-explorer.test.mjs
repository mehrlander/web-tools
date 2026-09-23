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

test('JsonExplorer.mount builds toolbar, breadcrumbs, and renders tree', () => {
  const container = window.document.getElementById('c');
  const explorer = JsonExplorer.mount(container, {
    data: sampleSession,
    name: 'test-session.json',
  });

  assert.ok(explorer, 'explorer instance returned');
  assert.ok(container.querySelector('.json-explorer'), 'explorer element mounted');

  // Toolbar elements
  const tabs = container.querySelectorAll('[role="tablist"] .tab');
  assert.ok(tabs.length >= 3, 'tabs rendered (Tree, Schema, Table, Raw)');
  const select = container.querySelector('select');
  assert.ok(select, 'chunk select rendered');
  assert.ok(select.options.length >= 3, 'chunks populated in dropdown');

  const searchInput = container.querySelector('input[type="search"], input[type="text"]');
  assert.ok(searchInput, 'search input rendered');

  // Tree nodes rendered
  const nodes = container.querySelectorAll('[data-path]');
  assert.ok(nodes.length > 5, 'tree nodes rendered in DOM');

  // Badges
  const arrayBadges = [...container.querySelectorAll('.badge')].filter(b => b.textContent.includes('Array'));
  assert.ok(arrayBadges.length >= 2, 'array badges rendered');

  // Breadcrumbs
  const breadcrumbs = container.querySelectorAll('[data-crumb]');
  assert.ok(breadcrumbs.length >= 1, 'breadcrumbs rendered root');

  explorer.destroy();
});

test('JsonExplorer chunk zooming and path navigation', () => {
  const container = window.document.getElementById('c');
  const explorer = JsonExplorer.mount(container, {
    data: sampleSession,
    chunk: ['calls'],
  });

  // Breadcrumbs should now include root and calls
  const crumbs = [...container.querySelectorAll('[data-crumb]')].map(b => b.textContent.trim());
  assert.deepEqual(crumbs, ['root', 'calls']);

  // Table tab should be available for record array
  const tableTab = [...container.querySelectorAll('[role="tab"]')].find(t => t.textContent.includes('Table'));
  assert.ok(tableTab, 'table tab available for calls chunk');

  // Switch to table view
  explorer.setView('table');
  const table = container.querySelector('table');
  assert.ok(table, 'table element rendered');
  const headers = [...table.querySelectorAll('th')].map(th => th.textContent.trim());
  assert.ok(headers.includes('tool') && headers.includes('status'), 'table headers match calls schema');

  // Zoom back to root
  explorer.focusChunk([]);
  const updatedCrumbs = [...container.querySelectorAll('[data-crumb]')].map(b => b.textContent.trim());
  assert.deepEqual(updatedCrumbs, ['root']);

  explorer.destroy();
});

test('JsonExplorer search filters and highlights matching nodes', () => {
  const container = window.document.getElementById('c');
  const explorer = JsonExplorer.mount(container, {
    data: sampleSession,
  });

  explorer.updateSearch('run_cmd');
  const matchBadge = container.querySelector('.badge-primary');
  assert.ok(matchBadge, 'match count badge rendered');
  assert.equal(matchBadge.textContent.trim(), '1');

  // Matched node should be highlighted
  const matchedRow = container.querySelector('.bg-primary\\/10');
  assert.ok(matchedRow, 'matched row highlighted');
  assert.ok(matchedRow.textContent.includes('run_cmd'));

  explorer.updateSearch('');
  assert.equal(container.querySelector('.badge-primary'), null, 'match badge cleared on empty search');

  explorer.destroy();
});

test('JsonExplorer Schema view renders metric cards and collections', () => {
  const container = window.document.getElementById('c');
  const explorer = JsonExplorer.mount(container, {
    data: sampleSession,
    mode: 'schema',
  });

  const cards = container.querySelectorAll('.p-3.bg-base-200\\/50');
  assert.equal(cards.length, 4, '4 metric cards rendered');

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
