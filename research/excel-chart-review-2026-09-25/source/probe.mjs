import http from 'node:http';
import path from 'node:path';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const task = path.resolve(import.meta.dirname, '../..');
const root = path.join(task, 'work/web-tools-pr792-review');
const out = path.join(task, 'outputs/pr792-review');
await mkdir(out, { recursive: true });
const require = createRequire(path.join(root, 'package.json'));
const { chromium } = require('playwright');
const JSZip = require('jszip');
const { JSDOM } = require('jsdom');
const { resolveCdn, typeFor } = await import(pathToFileURL(path.join(root, 'tools/render/cdn.mjs')));
const { loadKit } = await import(pathToFileURL(path.join(root, 'tools/test/bootstrap.mjs')));
globalThis.DOMParser = new JSDOM('').window.DOMParser;
const { xlsxKit } = loadKit('xlsx');
const { xlsxChartKit } = loadKit('xlsx-chart');
const sha = b => createHash('sha256').update(b).digest('hex');
const head = '3263a62ec6588e6e60df1afbf77697b3d1e9582c';
const report = { head, time: new Date().toISOString(), fixtures: [], synthetic: {}, browser: [], pageErrors: [], blocked: [], empty: [] };
const sources = [
  ['native-cases', path.join(task, 'outputs/excel-validation/charts/chart-cases.xlsx')],
  ['pr-demo', path.join(root, 'docs/examples/demonstration-charts.xlsx')]
];
const archives = [];
for (const [name, source] of sources) {
  const bytes = await readFile(source);
  const zip = await JSZip.loadAsync(bytes);
  archives.push(zip);
  const chartPaths = Object.keys(zip.files).filter(p => /^xl\/charts\/chart\d+\.xml$/.test(p)).sort();
  const charts = [];
  for (const part of chartPaths) {
    const xml = await zip.file(part).async('string');
    const model = xlsxKit.parseChartXml(xml);
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const axes = [...doc.getElementsByTagName('*')].filter(e => e.localName === 'valAx').map(e => {
      const nodes = [...e.getElementsByTagName('*')];
      return Object.fromEntries(['min', 'max', 'majorUnit'].map(key => [key, nodes.find(n => n.localName === key)?.getAttribute('val') ?? null]));
    });
    charts.push({ part, sha256: sha(xml), axes, model });
  }
  report.fixtures.push({ name, source: path.relative(task, source), sha256: sha(bytes), charts });
}

// Isolate sparse-cache parsing and grouping. These are in-memory diagnostics;
// neither source workbook is rewritten, and these are not native Excel tests.
const lineXml = await archives[0].file('xl/charts/chart2.xml').async('string');
const sparseLine = lineXml.replace(/<c:pt idx="1"><c:v>0<\/c:v><\/c:pt>/, '');
if (sparseLine === lineXml) throw new Error('Sparse diagnostic did not remove the intended cached zero');
report.synthetic.sparseLine = { model: xlsxKit.parseChartXml(sparseLine) };
const demoColumn = report.fixtures[1].charts.find(c => c.model?.chartType === 'barChart' && c.model.subType === 'column');
const demoColumnXml = await archives[1].file(demoColumn.part).async('string');
const withGrouping = grouping => {
  const doc = new DOMParser().parseFromString(demoColumnXml, 'application/xml');
  const node = [...doc.getElementsByTagName('*')].find(e => e.localName === 'grouping');
  node.setAttribute('val', grouping);
  return xlsxKit.parseChartXml(doc);
};
const clustered = withGrouping('clustered');
const stacked = withGrouping('stacked');
const percentStacked = withGrouping('percentStacked');
const render = model => xlsxChartKit.renderSvg(model, 700, 400);
report.synthetic.grouping = {
  clusteredEqualsStacked: render(clustered) === render(stacked),
  clusteredEqualsPercentStacked: render(clustered) === render(percentStacked),
  parsedGroupings: [clustered.grouping, stacked.grouping, percentStacked.grouping],
  explanation: 'Only the XML grouping attribute changes before parsing. Identical SVG shows the renderer ignores it.'
};
await writeFile(path.join(out, 'grouping-clustered.svg'), render(clustered));
await writeFile(path.join(out, 'grouping-stacked.svg'), render(stacked));

const olderPath = 'C:/Users/mehrl/.gemini/antigravity/brain/71fb05a6-090d-4167-b515-57b3176e3aa7/Demonstration-Charts.xlsx';
const olderBytes = await readFile(olderPath);
const older = await JSZip.loadAsync(olderBytes);
report.priorDemoComparison = { workbookSha256: sha(olderBytes), currentWorkbookSha256: report.fixtures[1].sha256, chartParts: [] };
for (const c of report.fixtures[1].charts) {
  const priorPart = await older.file(c.part).async('string');
  report.priorDemoComparison.chartParts.push({ part: c.part, identical: sha(priorPart) === c.sha256, priorSha256: sha(priorPart) });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method !== 'GET') { res.writeHead(405); res.end(); return; }
    const rel = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\//, '');
    const target = path.resolve(root, rel);
    if (!target.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    const body = await readFile(target);
    res.writeHead(200, { 'content-type': typeFor(target) }); res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  report.browserVersion = browser.version();
  const page = await browser.newPage({ viewport: { width: 1600, height: 950 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => report.pageErrors.push(e.message));
  await page.route('**/*', route => {
    const url = route.request().url();
    if (url.startsWith(origin) || url.startsWith('blob:') || url.startsWith('data:')) return route.continue();
    const result = resolveCdn(url, root, head);
    if (result.kind === 'continue') { report.blocked.push(url); return route.abort(); }
    if (result.kind === 'empty') { report.empty.push({ url, tag: result.tag }); return route.fulfill({ status: 200, contentType: result.contentType, body: '' }); }
    return route.fulfill({ status: 200, contentType: result.contentType, body: result.body });
  });
  await page.addInitScript({ content: await readFile(path.join(root, 'node_modules/jszip/dist/jszip.min.js'), 'utf8') });
  for (const [name, source] of sources) {
    console.log('Loading', name);
    const bytes = await readFile(source);
    const env = { kind: 'data-view/1', items: [{ name: path.basename(source), content: 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,' + bytes.toString('base64') }] };
    const hash = gzipSync(Buffer.from(JSON.stringify(env))).toString('base64url');
    await page.goto('about:blank');
    await page.goto(`${origin}/pages/data-view.html#gz=${hash}`, { waitUntil: 'domcontentloaded' });
    await page.locator('[data-sheet="tabs"] button').first().waitFor({ timeout: 45000 });
    const expectedFirstTab = name === 'native-cases' ? 'Column' : 'ColumnAndBar';
    if ((await page.locator('[data-sheet="tabs"] button').first().textContent()).trim() !== expectedFirstTab) throw new Error(`Unexpected workbook tabs for ${name}`);
    await page.evaluate(() => { const el = document.querySelector('[x-data="app()"]'); if (el && window.Alpine) window.Alpine.$data(el).bleed = true; });
    const tabs = await page.locator('[data-sheet="tabs"] button').allTextContents();
    for (let i = 0; i < tabs.length; i++) {
      await page.locator('[data-sheet="tabs"] button').nth(i).click();
      await page.waitForTimeout(500);
      const details = await page.evaluate(() => ({
        charts: [...document.querySelectorAll('.xl-chart-container')].map(c => ({
          width: c.offsetWidth, height: c.offsetHeight,
          text: [...c.querySelectorAll('text')].map(e => e.textContent),
          lines: [...c.querySelectorAll('path[fill="none"]')].map(e => ({ d: e.getAttribute('d'), stroke: e.getAttribute('stroke') })),
          rectangles: c.querySelectorAll('rect').length,
          paths: c.querySelectorAll('path').length
        })),
        tabs: [...document.querySelectorAll('[data-sheet="tabs"] button')].map(e => e.textContent.trim())
      }));
      const slug = `${name}-${tabs[i].trim().replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
      await page.screenshot({ path: path.join(out, slug + '-page.png'), fullPage: true });
      for (let j = 0; j < details.charts.length; j++) {
        const chart = page.locator('.xl-chart-container').nth(j);
        await chart.screenshot({ path: path.join(out, `${slug}-chart-${j + 1}.png`) });
        await writeFile(path.join(out, `${slug}-chart-${j + 1}.svg`), await chart.locator('svg').evaluate(e => e.outerHTML));
      }
      report.browser.push({ fixture: name, sheet: tabs[i].trim(), ...details });
      console.log(name, tabs[i].trim(), JSON.stringify(details.charts));
    }
    report.fixtures.find(f => f.name === name).downloadControls = await page.locator('a[download],button[title*="ownload"],button[aria-label*="ownload"]').evaluateAll(es => es.map(e => ({ text: e.textContent.trim(), title: e.getAttribute('title'), label: e.getAttribute('aria-label'), download: e.getAttribute('download') })));
  }
} finally {
  await writeFile(path.join(out, 'probe-results.json'), JSON.stringify(report, null, 2) + '\n');
  await browser?.close();
  await new Promise(r => server.close(r));
}
