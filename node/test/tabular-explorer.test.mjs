import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, repoRoot } from './bootstrap.mjs';

const { window } = makeWindow({ html: '<!doctype html><html><body></body></html>' });
new window.Function(readFileSync(path.join(repoRoot, 'lib/kits/tabular-explorer.js'), 'utf8'))();

const { DataProfile, TabularExplorer } = window;

test('declared columns survive empty datasets and retain source labels', () => {
  const columns = [{ field: 'first', title: ' a ' }, { field: 'second', title: '' }, { field: 'third', title: ' a ' }];
  const profile = DataProfile.analyze([], { columns });
  assert.equal(profile.rowCount, 0);
  assert.equal(profile.colCount, 3);
  assert.equal(profile.typeCounts.empty, 3);
  assert.deepEqual(Array.from(profile.columns, c => c.title), [' a ', '', ' a ']);
});

test('explorer uses explicit labels safely in grid, Columns, Pivot, filters and CSV download', t => {
  const priorTable = window.Tabulator, priorPapa = window.Papa;
  const priorUrl = window.URL.createObjectURL, priorRevoke = window.URL.revokeObjectURL;
  t.after(() => {
    window.Tabulator = priorTable; window.Papa = priorPapa;
    window.URL.createObjectURL = priorUrl; window.URL.revokeObjectURL = priorRevoke;
  });
  let grid, exported;
  window.Tabulator = class { constructor(_target, opts) { grid = opts; } redraw() {} destroy() {} };
  window.Papa = { unparse: data => { exported = data; return 'csv'; } };
  window.URL.createObjectURL = () => 'blob:test';
  window.URL.revokeObjectURL = () => {};
  const container = window.document.createElement('div');
  const columns = [
    { field: 'a.b', title: '<b>Group</b>' },
    { field: 'col2', title: '' }, { field: 'amount', title: '<b>Group</b>' },
  ];
  const explorer = TabularExplorer.mount(container, {
    columns, rows: [{ 'a.b': 'A', col2: 'keep', amount: '12' }],
    opts: { filter: { col: 'a.b', find: 'A' } },
  });
  assert.equal(grid.columns.length, 3);
  assert.equal(grid.columns[0].title, '&lt;b&gt;Group&lt;/b&gt;');
  assert.equal(grid.columns[1].title, '');
  assert.equal(grid.nestedFieldSeparator, false);
  assert.equal(grid.initialHeaderFilter[0].field, 'a.b');
  explorer.setView('columns');
  assert.equal(container.querySelector('tbody tr td:nth-child(2)').textContent, '<b>Group</b>');
  assert.equal(container.querySelectorAll('b').length, 0);
  explorer.setView('pivot');
  assert.ok(Array.from(container.querySelectorAll('option')).some(o => o.value === 'amount' && o.textContent === '<b>Group</b>'));
  assert.ok(container.textContent.includes('SUM of <b>Group</b>'));
  container.querySelector('i.ph-download-simple').closest('a').click();
  assert.deepEqual(Array.from(exported.fields), ['<b>Group</b>', '', '<b>Group</b>']);
  assert.deepEqual(Array.from(exported.data[0]), ['A', 'keep', '12']);
  explorer.destroy();
});

test('DataProfile.parseNum parses numbers, currencies, and accounting negatives', () => {
  assert.equal(DataProfile.parseNum(42), 42);
  assert.equal(DataProfile.parseNum('42'), 42);
  assert.equal(DataProfile.parseNum('  1,234.50  '), 1234.5);
  assert.equal(DataProfile.parseNum('$1,234.50'), 1234.5);
  assert.equal(DataProfile.parseNum('(23.00)'), -23);
  assert.equal(DataProfile.parseNum('($23.50)'), -23.5);
  assert.equal(DataProfile.parseNum('0.00 '), 0);
  assert.equal(DataProfile.parseNum(''), null);
  assert.equal(DataProfile.parseNum(null), null);
  assert.equal(DataProfile.parseNum('NotANumber'), null);
});

test('DataProfile.analyze profiles empty, numeric, categorical, and text columns', () => {
  const sample = [
    { package: 'CORE PAM', amount: '(23.00)', emptyCol: '', year: '2028', desc: 'A long description of the budget request...' },
    { package: 'CORE PAM', amount: '100.00',  emptyCol: '', year: '2029', desc: 'Second description with some details.' },
    { package: 'Portals',  amount: '50.00',   emptyCol: '', year: '2028', desc: 'Third description for testing.' },
    { package: 'Portals',  amount: '0.00',    emptyCol: '', year: '2029', desc: 'Fourth description for testing.' },
  ];

  const profile = DataProfile.analyze(sample);
  assert.equal(profile.rowCount, 4);
  assert.equal(profile.colCount, 5);
  assert.equal(profile.typeCounts.empty, 1);
  assert.equal(profile.typeCounts.numeric, 1);

  const amountCol = profile.columns.find(c => c.name === 'amount');
  assert.equal(amountCol.type, 'numeric');
  assert.equal(amountCol.numStats.min, -23);
  assert.equal(amountCol.numStats.max, 100);
  assert.equal(amountCol.numStats.sum, 127);
  assert.equal(amountCol.numStats.negatives, 1);
  assert.equal(amountCol.numStats.zeros, 1);
  assert.equal(amountCol.numStats.bins.length, 10);

  const pkgCol = profile.columns.find(c => c.name === 'package');
  assert.equal(pkgCol.type, 'categorical');
  assert.equal(pkgCol.distinctCount, 2);
  assert.equal(pkgCol.topValues.length, 2);
  assert.equal(pkgCol.topValues[0].count, 2);

  const emptyCol = profile.columns.find(c => c.name === 'emptyCol');
  assert.equal(emptyCol.type, 'empty');
  assert.equal(emptyCol.fillRate, 0);
});

test('TabularExplorer.mount builds navigation, columns schema matrix, and pivot stages', () => {
  const container = window.document.createElement('div');
  window.document.body.append(container);

  const sample = [
    { program: 'A', amount: '10' },
    { program: 'A', amount: '20' },
    { program: 'B', amount: '30' },
  ];

  const explorer = TabularExplorer.mount(container, {
    rows: sample,
    name: 'test.csv',
  });

  assert.ok(container.querySelector('.tabular-explorer'));
  assert.ok(container.querySelector('button i.ph-table'));
  assert.ok(container.querySelector('button i.ph-columns'));
  assert.ok(container.querySelector('button i.ph-square-split-horizontal'));

  // Card button is icon-only (no text label)
  const cardBtn = container.querySelector('button i.ph-cards-three')?.parentElement;
  assert.ok(cardBtn);
  assert.equal(cardBtn.querySelectorAll('span').length, 0);

  // Three-dot menu exists for options
  assert.ok(container.querySelector('details summary i.ph-dots-three-vertical'));

  // Switch to columns (or profile)
  explorer.setView('columns');
  const colRows = container.querySelectorAll('tbody tr');
  assert.ok(colRows.length >= 2, 'lists dataset columns in schema table');

  // Verify inspector is present
  assert.ok(container.querySelector('.font-bold'), 'inspector renders active column details');

  // Switch to pivot
  explorer.setView('pivot');
  const pivotTable = container.querySelector('table');
  assert.ok(pivotTable);

  explorer.destroy();
  assert.equal(container.children.length, 0);
});
