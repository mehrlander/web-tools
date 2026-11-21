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

  const tabs = [...container.querySelector('[role="tablist"]').querySelectorAll('[role="tab"]')]
    .filter(t => !t.classList.contains('hidden')).map(t => t.textContent.trim());
  assert.deepEqual(tabs, ['Tree', 'JSON'], 'Table is offered only on an array of records, and a docked tree has its Schema in the panel');
  const panelTabs = [...container.querySelectorAll('[data-panel-view]')].map(t => t.textContent.trim());
  assert.deepEqual(panelTabs, ['Value', 'Schema'], 'the panel switches between Value and Schema');
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

test('a docked tree keeps a panel: the schema of the opened field, or the selection with its copies', async () => {
  const container = window.document.getElementById('c');
  const data = { repos: [{ name: 'web-tools', branch: 'main' }], 'odd-key': 7, notes: 'x'.repeat(200) };
  const explorer = JsonExplorer.mount(container, { data, name: 'd.json' });
  const pane = container.querySelector('[data-selection]');
  const copy = (what) => pane.querySelector(`[aria-label="Copy the ${what}"]`);
  const tick = () => new Promise(r => setTimeout(r, 0));
  let copied = null;
  window.io = { copy: async (t) => { copied = t; return true; } };
  try {
    assert.equal(container.querySelector('[data-view="schema"]'), null, 'a docked tree has no Schema tab');
    assert.ok(!pane.classList.contains('hidden'), 'with nothing selected the panel is up');
    assert.match(pane.textContent, /d\.json/, 'and names the opened file');
    pane.querySelector('[data-panel-view="schema"]').click();
    assert.ok(pane.querySelector('table'), 'with its schema');
    pane.querySelector('[data-panel-view="value"]').click();
    assert.match(pane.querySelector('pre').textContent, /"odd-key": 7/, 'or its value, as indented JSON');
    pane.querySelector('[data-panel-view="schema"]').click();

    container.querySelector('[data-path="repos"]').click();
    assert.ok(container.querySelector('[data-path="repos[0]"]'), 'a row that opens still opens on a tap');
    assert.match(pane.textContent, /list · 1 item/);
    assert.match(pane.textContent, /branch/, 'a selected list of records shows its fields');
    await tick();
    assert.ok(container.querySelector('[data-path="repos"]').hasAttribute('data-selected'), 'the selected row is marked after the redraw');

    container.querySelector('[data-path="repos[0]"]').click();
    container.querySelector('[data-path="repos[0].name"]').click();
    assert.match(pane.textContent, /repos\[0\]\.name/);
    assert.equal(pane.querySelector('[data-what]').textContent, 'text · 9 characters');
    const label = pane.querySelector('[data-title-tip-lead]');
    assert.equal(label.textContent, 'path', 'the path is labeled');
    assert.equal(label.getAttribute('data-title-tip-lead'), '3 steps from the top of d.json');
    assert.deepEqual(label.getAttribute('data-title-tip').split('\n'),
      ['repos · list · 1 item', '[0] · object · 2 fields', 'name · text · 9 characters'], 'its title-tip walks the path');
    assert.equal(pane.lastElementChild.getAttribute('data-what'), '', 'the type and size sit on a line under the box');
    copy('path').click(); await tick();
    assert.equal(copied, 'repos[0].name');
    copy('value').click(); await tick();
    assert.equal(copied, 'web-tools');

    assert.ok(pane.querySelector('[role="tablist"]').classList.contains('hidden'), 'a plain value has no Value and Schema switch');
    container.querySelector('[data-path="odd-key"]').click();
    assert.ok(!container.querySelector('[data-path="repos[0].name"]').hasAttribute('data-selected'), 'one selection at a time');
    copy('path').click(); await tick();
    assert.equal(copied, '["odd-key"]', 'a key that is not an identifier is bracketed and quoted');
    copy('value').click(); await tick();
    assert.equal(copied, '7', 'a number copies as its JSON text');

    const notes = container.querySelector('[data-path="notes"]');
    notes.click();
    assert.equal(pane.textContent.includes('x'.repeat(200)), true, 'the panel shows a long string in full');
    assert.ok(notes.querySelector('[data-clamp]').classList.contains('line-clamp-3'), 'while its row stays clamped');

    notes.click();
    assert.match(pane.textContent, /d\.json/, 'a second tap clears the selection, back to the opened file');
  } finally {
    delete window.io;
    explorer.destroy();
  }
});

test('an inline tree shows the panel only for a selection', () => {
  const container = window.document.getElementById('c');
  const explorer = JsonExplorer.mount(container, { data: { a: 1 }, name: 'i.json', fill: false });
  const pane = container.querySelector('[data-selection]');
  try {
    assert.ok(container.querySelector('[data-view="schema"]'), 'an inline tree keeps its Schema tab');
    assert.ok(pane.classList.contains('hidden'), 'no selection, no panel');
    container.querySelector('[data-path="a"]').click();
    assert.ok(!pane.classList.contains('hidden'));
    assert.match(pane.textContent, /number/);
  } finally {
    explorer.destroy();
  }
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

test('JsonProfile counts an empty string as an unfilled cell', () => {
  const col = JsonProfile.analyze({ r: [{ a: '' }, { a: 'x' }] }).collections[0].columns[0];
  assert.equal(col.fillRate, 0.5);
  assert.deepEqual([...col.samples], ['x']);
});

test('JsonExplorer a crumb zooms to its own level, not the one above', () => {
  const container = window.document.getElementById('c');
  const explorer = JsonExplorer.mount(container, { data: { a: { b: { c: 1 } } }, chunk: ['a', 'b'] });
  const names = () => [...container.querySelectorAll('[data-crumb]')].map(b => b.textContent.trim());
  assert.deepEqual(names(), ['document.json', 'a', 'b']);
  container.querySelectorAll('[data-crumb]')[1].click();
  assert.deepEqual(names(), ['document.json', 'a']);
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

test('JsonExplorer Schema view totals its Fields table and renders collections', () => {
  const container = window.document.getElementById('c');
  const explorer = JsonExplorer.mount(container, {
    data: sampleSession,
    mode: 'schema',
  });

  assert.equal(container.querySelector('[data-schema-summary]'), null, 'no line of totals above the table');
  const total = container.querySelector('[data-schema-total]');
  assert.ok(total, 'the Fields table has a foot');
  assert.match(total.textContent, /^Alldepth \d+[\d,]+ nodes[\d.]+ (B|KB|MB)$/);

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
