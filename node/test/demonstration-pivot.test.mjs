import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import JSZip from 'jszip';
import jsdomPkg from 'jsdom';

const { JSDOM } = jsdomPkg;
const parser = new (new JSDOM('').window.DOMParser)();
const zip = await JSZip.loadAsync(readFileSync(new URL('../../docs/examples/demonstration-workbooks.xlsx', import.meta.url)));
const xml = async path => parser.parseFromString(await zip.file(path).async('string'), 'application/xml');
const raw = await xml('xl/worksheets/sheet1.xml');
const pivot = await xml('xl/worksheets/sheet2.xml');
const reconcile = await xml('xl/worksheets/sheet4.xml');
const strings = [...(await xml('xl/sharedStrings.xml')).querySelectorAll('si')].map(e => [...e.querySelectorAll('t')].map(t => t.textContent).join(''));
const value = (sheet, ref) => {
  const cell = sheet.querySelector(`c[r="${ref}"]`);
  const text = cell?.querySelector('v')?.textContent;
  return cell?.getAttribute('t') === 's' ? strings[Number(text)] : text;
};

test('demonstration pivot uses the table data body and has 24 refreshed cache records', async () => {
  const cache = await xml('xl/pivotCache/pivotCacheDefinition1.xml');
  assert.equal(cache.querySelector('worksheetSource').getAttribute('name'), 'Financials');
  assert.equal(cache.querySelector('worksheetSource').hasAttribute('ref'), false);
  assert.equal(cache.documentElement.getAttribute('recordCount'), '24');
  assert.equal((await xml('xl/pivotCache/pivotCacheRecords1.xml')).documentElement.children.length, 24);
  const table = await xml('xl/tables/table1.xml');
  assert.equal(table.documentElement.getAttribute('ref'), 'B5:N30');
  assert.equal(table.documentElement.getAttribute('totalsRowCount'), '1');
});

test('saved PivotTable grand totals agree with an independent sum of source records', () => {
  const grand = [...pivot.querySelectorAll('row')].find(row => value(pivot, `B${row.getAttribute('r')}`) === 'Grand Total');
  assert.ok(grand);
  const row = grand.getAttribute('r');
  const expected = [21450, 21595, 145];
  for (const [i, col] of ['J', 'K', 'L'].entries()) {
    const sum = Array.from({ length: 24 }, (_, j) => Number(value(raw, `${col}${j + 6}`))).reduce((a, b) => a + b, 0);
    assert.equal(sum, expected[i]);
    assert.equal(Number(value(pivot, col + row)), sum);
  }
  assert.ok(![...pivot.querySelectorAll('c')].some(c => c.getAttribute('t') === 's' && strings[Number(c.querySelector('v')?.textContent)] === '(blank)'));
});

test('all seven saved reconciliation checks pass and three actually read the PivotTable', () => {
  for (let row = 6; row <= 12; row++) {
    assert.equal(value(reconcile, `E${row}`), '0');
    assert.equal(value(reconcile, `F${row}`), 'PASS: EXACT MATCH');
    if (row >= 10) assert.match(reconcile.querySelector(`c[r="E${row}"] f`).textContent, /GETPIVOTDATA\(.+PivotSummary!\$B\$5/);
  }
});

test('the repaired example contains no saved worksheet error cells', async () => {
  for (const name of Object.keys(zip.files).filter(p => /^xl\/worksheets\/sheet\d+\.xml$/.test(p))) {
    assert.equal((await xml(name)).querySelectorAll('c[t="e"]').length, 0, name);
  }
});
