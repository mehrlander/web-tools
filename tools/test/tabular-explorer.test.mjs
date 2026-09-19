import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, repoRoot } from './bootstrap.mjs';

const { window } = makeWindow({ html: '<!doctype html><html><body></body></html>' });
new window.Function(readFileSync(path.join(repoRoot, 'lib/kits/tabular-explorer.js'), 'utf8'))();

const { DataProfile, TabularExplorer } = window;

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

test('TabularExplorer.mount builds navigation, profile, and pivot stages', () => {
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
  assert.ok(container.querySelector('button i.ph-chart-bar'));
  assert.ok(container.querySelector('button i.ph-square-split-horizontal'));

  // Switch to profile
  explorer.setView('profile');
  const cards = container.querySelectorAll('.tabular-col-card');
  assert.ok(cards.length > 0);

  // Switch to pivot
  explorer.setView('pivot');
  const pivotTable = container.querySelector('table');
  assert.ok(pivotTable);

  explorer.destroy();
  assert.equal(container.children.length, 0);
});
