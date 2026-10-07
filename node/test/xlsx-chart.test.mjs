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
const ambient = { xlsxKit };
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

// ---- legends, colours and tick labels ----------------------------------------
// Small charts written inline, so each case states the one element it is about.
const NS = 'xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"';
const lit = (vals, spPr = '', extra = '') => `<c:ser><c:idx val="0"/><c:tx><c:v>S</c:v></c:tx>${spPr}${extra}` +
  `<c:cat><c:strLit><c:ptCount val="${vals.length}"/>${vals.map((_, i) => `<c:pt idx="${i}"><c:v>C${i}</c:v></c:pt>`).join('')}</c:strLit></c:cat>` +
  `<c:val><c:numLit><c:ptCount val="${vals.length}"/>${vals.map((v, i) => `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`).join('')}</c:numLit></c:val></c:ser>`;
const chartXml = (kind, ser, legendPos) => {
  const body = kind === 'pie' ? `<c:pieChart>${ser}</c:pieChart>`
    : kind === 'line' ? `<c:lineChart><c:grouping val="standard"/>${ser}</c:lineChart><c:catAx/><c:valAx/>`
    : `<c:barChart><c:barDir val="${kind === 'bar' ? 'bar' : 'col'}"/><c:grouping val="clustered"/>${ser}</c:barChart><c:catAx/><c:valAx/>`;
  const legend = legendPos ? `<c:legend><c:legendPos val="${legendPos}"/></c:legend>` : '';
  return `<c:chartSpace ${NS}><c:chart><c:plotArea>${body}</c:plotArea>${legend}</c:chart></c:chartSpace>`;
};
const legendBoxes = (chart, w = 480, h = 280) => {
  const doc = new JSDOM(xlsxChartKit.renderSvg(chart, w, h), { contentType: 'image/svg+xml' }).window.document;
  return [...doc.querySelectorAll('[data-legend-item] text')].map(t => ({ x: Number(t.getAttribute('x')), y: Number(t.getAttribute('y')), text: t.textContent }));
};

test('a legend is drawn inside the frame in every position Excel writes', () => {
  for (const [kind, pos] of [['col', 'b'], ['col', 't'], ['col', 'l'], ['col', 'r'], ['line', 'b'], ['pie', 'b'], ['bar', 'r'], ['bar', 'b']]) {
    const labels = legendBoxes(xlsxKit.parseChartXml(chartXml(kind, lit([1, 2, 3]), pos)));
    assert.ok(labels.length > 0, `${kind} legend at ${pos} is drawn`);
    for (const l of labels) {
      assert.ok(l.x > 0 && l.x < 480 && l.y > 0 && l.y < 280, `${kind} legend at ${pos} sits inside 480x280: ${JSON.stringify(l)}`);
    }
    if (pos === 'b') assert.ok(labels.every(l => l.y > 240), `${kind} bottom legend sits at the bottom`);
    if (pos === 't') assert.ok(labels.every(l => l.y < 50), `${kind} top legend sits at the top`);
  }
  assert.equal(legendBoxes(xlsxKit.parseChartXml(chartXml('col', lit([1, 2, 3])))).length, 0, 'no c:legend, no legend');
});

test('a bar or slice takes its fill, never its outline; a line takes its stroke', () => {
  const redFill = '<a:solidFill><a:srgbClr val="FF0000"/></a:solidFill>';
  const whiteLine = '<a:ln><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:ln>';
  assert.equal(xlsxKit.parseChartXml(chartXml('col', lit([1, 2], `<c:spPr>${redFill}${whiteLine}</c:spPr>`))).series[0].color, '#ff0000');
  assert.equal(xlsxKit.parseChartXml(chartXml('col', lit([1, 2], `<c:spPr>${redFill}<a:ln><a:noFill/></a:ln></c:spPr>`))).series[0].color, '#ff0000');
  const stroke = '<c:spPr><a:ln w="28575"><a:solidFill><a:srgbClr val="00AA00"/></a:solidFill></a:ln></c:spPr>';
  assert.equal(xlsxKit.parseChartXml(chartXml('line', lit([1, 2], stroke))).series[0].color, '#00aa00');
});

test('theme colours resolve against the workbook theme, with Excel lightening applied', () => {
  const theme = ['#ffffff', '#000000', '#e8e8e8', '#0e2841', '#156082', '#e97132', '#196b24', '#0f9ed5', '#a02b93', '#4ea72e'];
  const accent2 = '<c:spPr><a:solidFill><a:schemeClr val="accent2"/></a:solidFill></c:spPr>';
  assert.equal(xlsxKit.parseChartXml(chartXml('col', lit([1], accent2)), theme).series[0].color, '#e97132');
  // "Accent 1, Lighter 40%" as Excel writes it: luminance scaled by 60%, then 40% added.
  const lighter = '<c:spPr><a:solidFill><a:schemeClr val="accent1"><a:lumMod val="60000"/><a:lumOff val="40000"/></a:schemeClr></a:solidFill></c:spPr>';
  const light = xlsxKit.parseChartXml(chartXml('col', lit([1], lighter)), theme).series[0].color;
  assert.match(light, /^#[0-9a-f]{6}$/);
  assert.ok(parseInt(light.slice(1, 3), 16) > 0x15, `lightened accent 1 is lighter: ${light}`);
  // A series with no colour takes the workbook's accents, not a built-in guess.
  assert.deepEqual(line.autoColors.slice(0, 2), ['#4f81bd', '#c0504d'], 'the fixture carries the Office 2007 theme');
  const auto = xlsxKit.parseChartXml(chartXml('col', lit([1, 2])), theme);
  const doc = new JSDOM(xlsxChartKit.renderSvg(auto, 480, 280), { contentType: 'image/svg+xml' }).window.document;
  assert.ok([...doc.querySelectorAll('svg svg rect')].every(r => r.getAttribute('fill') === '#156082'));
});

test('a pie varies colour by point and honours a point fill', () => {
  const dPt = '<c:dPt><c:idx val="1"/><c:spPr><a:solidFill><a:srgbClr val="123456"/></a:solidFill></c:spPr></c:dPt>';
  const pie = xlsxKit.parseChartXml(chartXml('pie', lit([1, 2, 3], '', dPt), 'r'));
  assert.equal(pie.varyColors, true, 'varyColors defaults on for a pie');
  const doc = new JSDOM(xlsxChartKit.renderSvg(pie, 480, 280), { contentType: 'image/svg+xml' }).window.document;
  const fills = [...doc.querySelectorAll('path')].map(p => p.getAttribute('fill'));
  assert.deepEqual(fills, [xlsxChartKit.EXCEL_PALETTE[0], '#123456', xlsxChartKit.EXCEL_PALETTE[2]]);
});

test('tick labels follow the axis number format, locale tags included', () => {
  const f = xlsxChartKit.formatValue;
  assert.equal(f(2000, '"$"#,##0'), '$2,000');
  assert.equal(f(1500, '[$-409]#,##0'), '1,500', 'a locale tag is not a currency sign');
  assert.equal(f(1234.5, '#,##0.00'), '1,234.50');
  assert.equal(f(0.125, '0.00%'), '12.50%');
  assert.equal(f(2100, 'General'), '2100');
  assert.equal(f(2100, ''), '2100');
});
