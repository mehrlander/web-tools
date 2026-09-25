// Real viewer + HTTP download checks for the native chart and repaired pivot specimens.
// PLAYWRIGHT_CHANNEL=msedge selects installed Edge; XLSX_PREVIEW_DIR selects output.
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { chromium } from 'playwright';
import { resolveCdn, typeFor } from '../render/cdn.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const out = path.resolve(process.env.XLSX_PREVIEW_DIR || path.join(root, 'tools/.preview/excel-cleanup'));
await mkdir(out, { recursive: true });
const sha = b => createHash('sha256').update(b).digest('hex');
const fixtures = [
  ['native', 'tools/test/fixtures/native-chart-cases.xlsx', ['Column', 'Line', 'Scatter']],
  ['demo', 'docs/examples/demonstration-charts.xlsx', ['ColumnAndBar', 'TrendsAndShares']],
  ['pivot', 'docs/examples/demonstration-workbooks.xlsx', ['RawData', 'PivotSummary', 'FormattingAndLogic', 'Reconciliation']],
];
const report = { time: new Date().toISOString(), sourceHashNormalization: 'UTF-8 with LF line endings', sourceHashes: {}, fixtures: [], pageErrors: [], blockedRequests: [] };
for (const file of ['lib/kits/xlsx.js', 'lib/kits/xlsx-chart.js', 'lib/alpineComponents/viewer.js']) report.sourceHashes[file] = sha((await readFile(path.join(root, file), 'utf8')).replace(/\r\n/g, '\n'));
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const fixture = fixtures.find(([id]) => url.pathname === `/download/${id}`);
    const target = path.resolve(root, fixture ? fixture[1] : decodeURIComponent(url.pathname).replace(/^\//, ''));
    if (!target.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    const bytes = await readFile(target);
    res.writeHead(200, { 'content-type': fixture ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : typeFor(target), ...(fixture ? { 'content-disposition': `attachment; filename="${path.basename(target)}"` } : {}) });
    res.end(bytes);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
  report.browserVersion = browser.version();
  const page = await browser.newPage({ viewport: { width: 1600, height: 950 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => report.pageErrors.push(e.message));
  await page.route('**/*', route => {
    const url = route.request().url();
    if (url.startsWith(origin + '/') || /^(data|blob):/.test(url)) return route.continue();
    const result = resolveCdn(url, root, null);
    if (result.kind === 'continue') { report.blockedRequests.push(url); return route.abort(); }
    return route.fulfill({ status: 200, contentType: result.contentType, body: result.kind === 'empty' ? '' : result.body });
  });
  await page.addInitScript({ content: await readFile(path.join(root, 'node_modules/jszip/dist/jszip.min.js'), 'utf8') });
  for (const [id, file, names] of fixtures) {
    const bytes = await readFile(path.join(root, file));
    const item = { id, file, sha256: sha(bytes), sheets: [] };
    report.fixtures.push(item);
    const env = { kind: 'data-view/1', items: [{ name: path.basename(file), content: 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,' + bytes.toString('base64') }] };
    await page.goto('about:blank'); // Hash-only navigation otherwise retains the previous workbook.
    await page.goto(`${origin}/pages/data-view.html#gz=${gzipSync(JSON.stringify(env)).toString('base64url')}`, { waitUntil: 'domcontentloaded' });
    await page.locator('[data-sheet="tabs"] button').first().waitFor({ timeout: 45000 });
    assert.deepEqual((await page.locator('[data-sheet="tabs"] button').allTextContents()).map(s => s.trim()), names);
    await page.evaluate(() => { const el = document.querySelector('[x-data="app()"]'); if (el && window.Alpine) Alpine.$data(el).bleed = true; });
    for (let i = 0; i < names.length; i++) {
      await page.locator('[data-sheet="tabs"] button').nth(i).click();
      await page.waitForTimeout(300);
      const data = await page.evaluate(() => ({
        text: document.querySelector('[data-sheet="stage"]')?.textContent || '',
        charts: [...document.querySelectorAll('.xl-chart-container')].map(c => ({
          status: c.querySelector('svg.xl-chart')?.getAttribute('data-chart-status') || 'rendered',
          text: [...c.querySelectorAll('text')].map(e => e.textContent),
          series: [...c.querySelectorAll('[data-chart-series]')].map(e => e.getAttribute('d')),
          markers: c.querySelectorAll('[data-chart-marker="circle"]').length,
        })),
      }));
      const slug = `${id}-${names[i].toLowerCase()}`;
      await page.screenshot({ path: path.join(out, slug + '.png') });
      for (let j = 0; j < data.charts.length; j++) {
        const chart = page.locator('.xl-chart-container').nth(j);
        await chart.screenshot({ path: path.join(out, `${slug}-chart-${j + 1}.png`) });
        await writeFile(path.join(out, `${slug}-chart-${j + 1}.svg`), await chart.locator('svg.xl-chart').evaluate(e => e.outerHTML));
      }
      item.sheets.push({ name: names[i], charts: data.charts });
      if (id === 'native' && names[i] === 'Line') {
        assert.equal(data.charts.length, 1);
        assert.equal(data.charts[0].markers, 4);
        assert.equal((data.charts[0].series[0].match(/M /g) || []).length, 2);
        for (const label of ['0', '2', '4', '6', '8', '10', 'Month', 'Value']) assert.ok(data.charts[0].text.includes(label), label);
      }
      if (id === 'native' && names[i] === 'Scatter') assert.equal(data.charts[0].status, 'unsupported');
      if (id === 'demo') { assert.equal(data.charts.length, 2); assert.ok(data.charts.every(c => c.status === 'rendered')); }
      if (id === 'pivot' && names[i] === 'Reconciliation') {
        assert.equal((data.text.match(/PASS: EXACT MATCH/g) || []).length, 7);
        assert.ok(!data.text.includes('FAIL'));
      }
      console.log(`ok ${id}: ${names[i]}`);
    }
    // Transport check against the same bytes used above. This is the harness's
    // HTTP download endpoint, not a claim that the viewer has a workbook Save UI.
    const pending = page.waitForEvent('download');
    await page.goto(`${origin}/download/${id}`).catch(error => { if (!/ERR_ABORTED|Download is starting/.test(error.message)) throw error; });
    const download = await pending;
    const destination = path.join(out, `${id}-download.xlsx`);
    await download.saveAs(destination);
    item.downloadSha256 = sha(await readFile(destination));
    assert.equal(item.downloadSha256, item.sha256);
    console.log(`ok ${id}: HTTP download SHA-256 matches viewer input`);
  }
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.blockedRequests, []);
  report.passed = true;
} finally {
  await writeFile(path.join(out, 'verification.json'), JSON.stringify(report, null, 2) + '\n');
  await browser?.close();
  await new Promise(r => server.close(r));
}
