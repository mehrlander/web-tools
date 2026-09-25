import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import jsdomPkg from 'jsdom';
import JSZip from 'jszip';
import { loadKit } from './bootstrap.mjs';

const { JSDOM } = jsdomPkg;
globalThis.DOMParser = new JSDOM('').window.DOMParser;
const { xlsxKit } = loadKit('xlsx');
const ambient = {};
new Function('window', readFileSync(new URL('../../lib/vanilla-bundle.js', import.meta.url), 'utf8'))(ambient);
const { xlsxChartKit } = loadKit('xlsx-chart', { window: ambient });
// This unchanged specimen was opened in native Excel and exported on Sept 24.
// Its blank-cell chart cache deliberately differs from its worksheet source.
const bytes = readFileSync(new URL('./fixtures/native-chart-cases.xlsx', import.meta.url));
const zip = await JSZip.loadAsync(bytes);
const parts = await Promise.all(Object.entries(zip.files).filter(([p, f]) => !f.dir && /\.(xml|rels)$/.test(p))
  .map(async ([p, f]) => [p, await f.async('string')]));
const { xl } = xlsxKit.analyze(parts);
const line = xl.charts['xl/charts/chart2.xml'];
const lineXml = await zip.file('xl/charts/chart2.xml').async('string');
const svg = chart => new JSDOM(xlsxChartKit.renderSvg(chart, 700, 400), { contentType: 'image/svg+xml' }).window.document;

test('native fixture identity and worksheet blanks take precedence over cached zero', () => {
  assert.equal(createHash('sha256').update(bytes).digest('hex'), '96e0742507ef118fe00639331ba4c6acb98fe42198acb45f7c60d42dbb951326');
  assert.equal(xlsxKit.parseChartXml(lineXml).series[0].values[1], 0);
  assert.deepEqual(line.series[0].values, [2, null, 7, 3, 9]);
  assert.deepEqual(line.series[0].categories, ['Jan', 'Feb', 'Mar', 'Apr', 'May']);
  assert.deepEqual(line.unsupported, []);
  const reversed = xlsxKit.analyze([...parts].reverse()).xl.charts['xl/charts/chart2.xml'];
  assert.deepEqual(reversed.series, line.series, 'worksheet resolution is independent of ZIP part order');
});

test('sparse numeric and category cache indices stay aligned, including a missing tail', () => {
  const xml = lineXml.replace('<c:pt idx="1"><c:v>0</c:v></c:pt>', '')
    .replace('<c:pt idx="4"><c:v>9</c:v></c:pt>', '')
    .replace('<c:pt idx="1"><c:v>Feb</c:v></c:pt>', '');
  const series = xlsxKit.parseChartXml(xml).series[0];
  assert.deepEqual(series.values, [2, null, 7, 3, null]);
  assert.deepEqual(series.categories, ['Jan', null, 'Mar', 'Apr', 'May']);
});

test('fixed axes, axis titles and explicit circular markers reach SVG', () => {
  assert.equal(line.valueAxis.min, 0);
  assert.equal(line.valueAxis.max, 10);
  assert.equal(line.valueAxis.majorUnit, 2);
  assert.equal(line.series[0].marker.symbol, 'circle');
  assert.equal(line.series[0].marker.size, 6);
  const doc = svg(line);
  const texts = [...doc.querySelectorAll('text')].map(n => n.textContent);
  assert.ok(texts.includes('10'));
  assert.ok(!texts.includes('12'));
  assert.equal(doc.querySelector('[data-axis-title="x"]').textContent, 'Month');
  assert.equal(doc.querySelector('[data-axis-title="y"]').textContent, 'Value');
  assert.equal(doc.querySelectorAll('circle[data-chart-marker="circle"]').length, 4);
  assert.equal(doc.querySelector('circle').getAttribute('r'), '4', 'six points converted to eight CSS pixels');
});

test('line gap, span, and zero policies produce different segment and point counts', () => {
  for (const [blanks, moves, edges, points] of [['gap', 2, 2, 4], ['span', 1, 3, 4], ['zero', 1, 4, 5]]) {
    const chart = { ...line, blanks };
    const doc = svg(chart);
    const d = doc.querySelector('[data-chart-series]').getAttribute('d');
    assert.equal((d.match(/M /g) || []).length, moves, blanks);
    assert.equal((d.match(/L /g) || []).length, edges, blanks);
    assert.equal(doc.querySelectorAll('[data-chart-marker]').length, points, blanks);
  }
});

test('explicit marker none does not invent markers', () => {
  const chart = structuredClone(line);
  chart.series[0].marker.symbol = 'none';
  assert.equal(svg(chart).querySelectorAll('[data-chart-marker]').length, 0);
});

test('stacked and percentage-stacked charts are explicitly unavailable instead of clustered', () => {
  const columnXml = parts.find(([name]) => name === 'xl/charts/chart1.xml')[1];
  for (const grouping of ['stacked', 'percentStacked']) {
    const chart = xlsxKit.parseChartXml(columnXml.replace('grouping val="clustered"', `grouping val="${grouping}"`));
    assert.equal(chart.grouping, grouping);
    const doc = svg(chart);
    assert.equal(doc.documentElement.getAttribute('data-chart-status'), 'unsupported');
    assert.equal(doc.querySelectorAll('rect').length, 0);
    assert.match(doc.documentElement.textContent, /Open the workbook in Excel/);
  }
});

test('unsupported scatter charts retain their worksheet anchor and visible fallback', () => {
  const sheet = Object.values(xl.sheets).find(s => s.name === 'Scatter');
  assert.equal(sheet.drawings.length, 1);
  const drawing = xlsxKit.sheetLayout(sheet, xl).drawings[0];
  assert.equal(drawing.kind, 'chart');
  assert.ok(drawing.width > 0 && drawing.height > 0);
  const doc = svg(drawing.chart);
  assert.equal(doc.documentElement.getAttribute('data-chart-status'), 'unsupported');
  assert.match(doc.documentElement.textContent, /scatter/);
});

test('a missing chart part retains a visible anchored fallback', () => {
  const missing = xlsxKit.analyze(parts.filter(([name]) => name !== 'xl/charts/chart2.xml')).xl;
  const sheet = Object.values(missing.sheets).find(s => s.name === 'Line');
  const drawing = xlsxKit.sheetLayout(sheet, missing).drawings[0];
  assert.equal(drawing.kind, 'chart');
  assert.equal(svg(drawing.chart).documentElement.getAttribute('data-chart-status'), 'unsupported');
});

test('unresolved references and unsaved formula results are reported rather than guessed', () => {
  const unresolved = parts.map(([name, xml]) => [name, name === 'xl/charts/chart2.xml' ? xml.replaceAll('Line!', "'Missing Sheet'!") : xml]);
  assert.ok(xlsxKit.analyze(unresolved).xl.charts['xl/charts/chart2.xml'].unsupported.includes('Chart source cannot be resolved'));
  const formula = parts.map(([name, xml]) => [name, name === 'xl/worksheets/sheet2.xml' ? xml.replace(/<c r="B5"[^>]*\/>/, '<c r="B5"><f>1+1</f></c>') : xml]);
  assert.ok(xlsxKit.analyze(formula).xl.charts['xl/charts/chart2.xml'].unsupported.includes('Chart formulas without saved results'));
});

test('date and logarithmic axes have a visible unsupported state', () => {
  for (const xml of [lineXml.replaceAll('c:catAx', 'c:dateAx'), lineXml.replace('<c:scaling>', '<c:scaling><c:logBase val="10"/>')]) {
    assert.equal(svg(xlsxKit.parseChartXml(xml)).documentElement.getAttribute('data-chart-status'), 'unsupported');
  }
});

test('invalid or excessively dense axis intervals terminate with a fallback', () => {
  for (const valueAxis of [{ min: 0, max: 0 }, { min: 0, max: 10, majorUnit: 0 }, { min: 0, max: 10, majorUnit: 0.000001 }]) {
    assert.equal(svg({ ...line, valueAxis }).documentElement.getAttribute('data-chart-status'), 'unsupported');
  }
});
