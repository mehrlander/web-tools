// kits/table-stats.js: the profile and the pivot the viewer's explorer and the
// transform workbench now share. The arithmetic itself is held where its
// readers are (pivot.test.mjs through the workbench, tabular-explorer.test.mjs
// through the explorer); what is here is the one parser both now agree on, and
// that each host really reads the shared engine rather than a copy of its own.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, repoRoot } from './bootstrap.mjs';

const { window } = makeWindow({ html: '<!doctype html><html><body></body></html>' });
for (const f of ['lib/vanilla-bundle.js', 'lib/kits/table-stats.js', 'lib/kits/tabular-explorer.js'])
  new window.Function(readFileSync(path.join(repoRoot, f), 'utf8'))();
const { TableStats, TabularExplorer } = window;

test('one parser: decoration and accounting negatives are numbers, codes are not', () => {
  const p = TableStats.parseNum;
  assert.equal(p('$1,234.50'), 1234.5);
  assert.equal(p('(23.00)'), -23);
  assert.equal(p('12%'), 12);
  assert.equal(p('1e3'), 1000);
  for (const code of ['600-1', '0x10', 'n/a', 'A', '', '  ']) assert.equal(p(code), null, JSON.stringify(code));
  assert.equal(p(NaN), null);
});

test('the profile marks a distinct count it stopped counting', () => {
  const rows = Array.from({ length: 2500 }, (_, i) => ({ id: 'r' + i, k: i % 3 }));
  const cols = TableStats.profile(rows).columns;
  assert.equal(cols.find(c => c.name === 'id').distinctCapped, true);
  assert.equal(cols.find(c => c.name === 'k').distinctCapped, false);
  assert.equal(cols.find(c => c.name === 'k').distinctCount, 3);
});

test("the explorer's Pivot reads the shared engine: an Across column and a skipped-row note", () => {
  const container = window.document.createElement('div');
  window.document.body.append(container);
  const rows = [
    { fund: 'A', year: '2027', amount: '$10.00' },
    { fund: 'A', year: '2028', amount: '$5.25' },
    { fund: 'B', year: '2027', amount: 'n/a' },
    { fund: 'B', year: '2028', amount: '(1.00)' },
  ];
  const exp = TabularExplorer.mount(container, { rows, name: 'f.csv' });
  exp.setView('pivot');
  const selects = [...container.querySelectorAll('select')];
  const across = selects.find(s => s.previousSibling?.textContent === 'Across:');
  across.value = 'year';
  across.dispatchEvent(new window.Event('change'));
  const head = [...container.querySelectorAll('thead th')].map(th => th.textContent);
  assert.deepEqual(head, ['fund', 'Rows', '2027', '2028', 'SUM of amount (total)']);
  const foot = [...container.querySelectorAll('tfoot td')].map(td => td.textContent);
  assert.equal(foot.at(-1), '14.25', 'the grand total is not the sum of the parseable amounts');
  assert.match(container.textContent, /1 row skipped: no number in amount/, 'the "n/a" row vanished without a word');
  exp.destroy();
});

test('list joins each group\'s distinct values, leaves blanks out, and caps a long one', () => {
  const rows = [
    { g: 'a', v: 'x' }, { g: 'a', v: 'y' }, { g: 'a', v: 'x' }, { g: 'a', v: '' },
    { g: 'b', v: 'z' },
  ];
  const res = TableStats.pivot.tree(rows, { rows: ['g'], measure: 'v', agg: 'list', sep: ' | ' });
  assert.deepEqual(JSON.parse(JSON.stringify(res.tree.children.map(c => [c.label, c.value]))), [['a', 'x | y'], ['b', 'z']]);
  assert.equal(res.tree.value, 'x | y | z');
  assert.equal(res.partition, false, 'a list is not a partition');
  const many = Array.from({ length: 25 }, (_, i) => ({ g: 'a', v: 'v' + String(i).padStart(2, '0') }));
  const long = TableStats.pivot.tree(many, { rows: ['g'], measure: 'v', agg: 'list' }).tree.value;
  assert.match(long, /, \+5$/, 'twenty-five values did not stop at twenty with a count of the rest');
});
