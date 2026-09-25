#!/usr/bin/env node
// Automated visual verification and screenshot capture for Excel Table & PivotTable styling.
// Compares rendered DOM structures and generates headless Playwright screenshots
// in tools/.preview/ for visual comparison against Excel COM exports.

import http from 'node:http';
import path from 'node:path';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { resolveCdn, typeFor } from '../render/cdn.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const JSZIP_UMD = await readFile(path.join(root, 'node_modules/jszip/dist/jszip.min.js'), 'utf8');

const previewDir = path.join(root, 'tools', '.preview');
await mkdir(previewDir, { recursive: true });

const server = http.createServer(async (req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '');
  try {
    const body = await readFile(path.join(root, rel));
    res.writeHead(200, { 'content-type': typeFor(rel) });
    res.end(body);
  } catch {
    res.writeHead(404); res.end('not found');
  }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({ args: ['--no-sandbox', '--ignore-certificate-errors'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

await page.route('**/*', route => {
  const url = route.request().url();
  if (url.startsWith(origin)) return route.continue();
  const r = resolveCdn(url, root, null);
  if (r.kind === 'continue') return route.continue();
  if (r.kind === 'empty') return route.fulfill({ status: 200, contentType: r.contentType, body: '' });
  return route.fulfill({ status: 200, contentType: r.contentType, body: r.body });
});
await page.addInitScript({ content: JSZIP_UMD });

const failures = [];
const ok = (name, cond, detail = '') => {
  if (cond) console.log(`  ok    ${name}`);
  else { console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`); failures.push(name); }
};

try {
  console.log('1. Loading Demonstration-Workbooks.xlsx in data-view.html...');
  await page.goto(`${origin}/pages/data-view.html?src=${encodeURIComponent('mehrlander/web-tools@main:docs/examples/demonstration-workbooks.xlsx')}`, {
    waitUntil: 'domcontentloaded'
  });

  // Wait for the sheet view to render
  await page.waitForSelector('[data-sheet="root"]', { timeout: 10000 });
  await page.waitForTimeout(2000);

  // Switch to PivotSummary
  console.log('2. Inspecting PivotSummary sheet...');
  const pivotTabBtn = page.locator('[data-sheet="tabs"] button:has-text("PivotSummary")');
  await pivotTabBtn.click();
  await page.waitForTimeout(1000);

  const pivotStats = await page.evaluate(() => {
    const stage = document.querySelector('[data-sheet="stage"]');
    const hdrs = [...stage.querySelectorAll('td.pvt-hdr')].map(td => ({
      text: td.textContent.trim(),
      bg: getComputedStyle(td).backgroundColor,
      color: getComputedStyle(td).color,
      hasCaret: !!td.querySelector('.xl-caret')
    }));
    const subtotals = [...stage.querySelectorAll('td.pvt-subtotal')].map(td => ({
      text: td.textContent.trim(),
      bg: getComputedStyle(td).backgroundColor
    }));
    const grandTotals = [...stage.querySelectorAll('td.pvt-grandtotal')].map(td => ({
      text: td.textContent.trim(),
      borderBottom: getComputedStyle(td).borderBottomStyle
    }));
    const toggles = [...stage.querySelectorAll('.xl-toggle')].length;
    return { hdrsCount: hdrs.length, sampleHdr: hdrs[0], subtotalsCount: subtotals.length, sampleSubtotal: subtotals[0], grandTotalsCount: grandTotals.length, sampleGrandTotal: grandTotals[0], toggles };
  });

  ok('Pivot headers marked with .pvt-hdr', pivotStats.hdrsCount > 0, `found ${pivotStats.hdrsCount}`);
  ok('Pivot headers have light blue background (rgb(200, 225, 238))', pivotStats.sampleHdr?.bg === 'rgb(200, 225, 238)', pivotStats.sampleHdr?.bg);
  ok('Pivot headers have black text color', pivotStats.sampleHdr?.color === 'rgb(0, 0, 0)', pivotStats.sampleHdr?.color);
  ok('Pivot subtotals marked with .pvt-subtotal', pivotStats.subtotalsCount > 0, `found ${pivotStats.subtotalsCount}`);
  ok('Pivot grand total has double bottom border', pivotStats.sampleGrandTotal?.borderBottom === 'double', pivotStats.sampleGrandTotal?.borderBottom);
  ok('Pivot row hierarchy parent toggles present', pivotStats.toggles > 0, `found ${pivotStats.toggles}`);

  const shotPivotBlue = path.join(previewDir, 'rendered-pivot-summary-blue.png');
  await page.screenshot({ path: shotPivotBlue, fullPage: false });
  console.log(`  Saved screenshot: ${shotPivotBlue}`);

  // Switch to RawData
  console.log('3. Inspecting RawData table (ListObject)...');
  const rawTabBtn = page.locator('[data-sheet="tabs"] button:has-text("RawData")');
  await rawTabBtn.click();
  await page.waitForTimeout(1000);

  const tableStats = await page.evaluate(() => {
    const stage = document.querySelector('[data-sheet="stage"]');
    const tblHdrs = [...stage.querySelectorAll('td.tbl-hdr')].map(td => ({
      text: td.textContent.trim(),
      bg: getComputedStyle(td).backgroundColor,
      fontWeight: getComputedStyle(td).fontWeight,
      hasCaret: !!td.querySelector('.xl-caret')
    }));
    const totals = stage.querySelectorAll('td.tbl-total').length;
    return { tblHdrsCount: tblHdrs.length, sampleHdr: tblHdrs[0], totals };
  });

  ok('Table headers marked with .tbl-hdr', tableStats.tblHdrsCount > 0, `found ${tableStats.tblHdrsCount}`);
  ok('Table headers have NO forced light blue header color', tableStats.sampleHdr?.bg !== 'rgb(200, 225, 238)', tableStats.sampleHdr?.bg);
  ok('Table headers are bold', Number(tableStats.sampleHdr?.fontWeight) >= 600, tableStats.sampleHdr?.fontWeight);
  ok('Table headers carry filter dropdown carets', tableStats.sampleHdr?.hasCaret === true);
  ok('Table total row marked with .tbl-total', tableStats.totals > 0, `found ${tableStats.totals}`);

  const shotRawTable = path.join(previewDir, 'rendered-raw-data-table.png');
  await page.screenshot({ path: shotRawTable, fullPage: false });
  console.log(`  Saved screenshot: ${shotRawTable}`);

} catch (err) {
  console.error('Test error:', err);
  failures.push('Exception: ' + err.message);
} finally {
  await browser.close();
  server.close();
}

if (failures.length > 0) {
  console.error(`\nFAILED with ${failures.length} failure(s):`);
  failures.forEach(f => console.error(`  - ${f}`));
  process.exit(1);
} else {
  console.log('\nALL VISUAL TESTS PASSED!');
  process.exit(0);
}
