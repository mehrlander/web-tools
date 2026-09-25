import http from 'node:http';
import path from 'node:path';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { resolveCdn, typeFor } from '../render/cdn.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const JSZIP_UMD = await readFile(path.join(root, 'node_modules/jszip/dist/jszip.min.js'), 'utf8');

const previewDir = path.resolve(process.env.XLSX_PREVIEW_DIR || path.join(root, 'tools', '.preview'));
await mkdir(previewDir, { recursive: true });


const failures = [];
const ok = (name, cond, detail = '') => {
  if (cond) console.log(`  ok    ${name}`);
  else { console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`); failures.push(name); }
};

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

const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined, args: ['--no-sandbox', '--ignore-certificate-errors'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });

await page.route('**/*', route => {
  const url = route.request().url();
  if (url.startsWith(origin)) return route.continue();
  const r = resolveCdn(url, root, null);
  if (r.kind === 'continue') return route.continue();
  if (r.kind === 'empty') return route.fulfill({ status: 200, contentType: r.contentType, body: '' });
  return route.fulfill({ status: 200, contentType: r.contentType, body: r.body });
});
await page.addInitScript({ content: JSZIP_UMD });
page.on('pageerror', e => console.log(`  [pageerror] ${e.message}`));

try {
  console.log('Loading demonstration-charts.xlsx in data-view viewer:');
  const xlsxBuf = await readFile(path.join(root, 'docs', 'examples', 'demonstration-charts.xlsx'));
  const b64 = xlsxBuf.toString('base64');
  const env = {
    kind: 'data-view/1',
    items: [{
      name: 'demonstration-charts.xlsx',
      content: 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,' + b64
    }]
  };

  await page.goto(`${origin}/pages/data-view.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);

  await page.evaluate(async (payload) => {
    const bytes = new TextEncoder().encode(payload);
    const gz = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
    const buf = new Uint8Array(await new Response(gz).arrayBuffer());
    let str = ''; for (const b of buf) str += String.fromCharCode(b);
    location.hash = 'gz=' + btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    location.reload();
  }, JSON.stringify(env));

  await page.waitForTimeout(4500);

  // Enable bleed mode to give full width to the workbook view
  await page.evaluate(() => {
    const appEl = document.querySelector('[x-data="app()"]');
    if (appEl && window.Alpine) {
      Alpine.$data(appEl).bleed = true;
    }
  });
  await page.waitForTimeout(800);

  // 1. Sheet 1: ColumnAndBar
  console.log('Validating Sheet 1: ColumnAndBar');
  const sheet1Details = await page.evaluate(() => {
    const table = document.querySelector('[data-sheet="stage"] table');
    const cols = [...(table?.querySelectorAll('thead th') || [])].map(th => th.textContent.trim());
    const containers = [...document.querySelectorAll('.xl-chart-container')].map(c => ({
      left: c.style.left,
      top: c.style.top,
      width: c.offsetWidth,
      height: c.offsetHeight,
      parentCell: c.parentElement?.dataset?.c,
    }));
    return { cols, containers };
  });
  console.log('Sheet 1 details:', sheet1Details);

  const sheet1Containers = await page.locator('.xl-chart-container').all();
  ok('sheet 1 renders two chart containers', sheet1Containers.length === 2, `found ${sheet1Containers.length}`);

  const chart1Title = await page.locator('.xl-chart-container').nth(0).locator('text').first().textContent();
  ok('chart 1 has correct title', /Budget vs Actual by Division/i.test(chart1Title), chart1Title);

  const chart1Bars = await page.locator('.xl-chart-container').nth(0).locator('rect').count();
  ok('chart 1 has bars and legend swatches', chart1Bars >= 8, `rect count: ${chart1Bars}`);

  const chart2Title = await page.locator('.xl-chart-container').nth(1).locator('text').first().textContent();
  ok('chart 2 has correct title', /Net Variance by Division/i.test(chart2Title), chart2Title);

  const chart2Bars = await page.locator('.xl-chart-container').nth(1).locator('rect').count();
  ok('chart 2 has horizontal bars', chart2Bars >= 4, `rect count: ${chart2Bars}`);

  // Screenshot sheet 1
  const sheet1Path = path.join(previewDir, 'rendered-sheet-column-and-bar.png');
  await page.screenshot({ path: sheet1Path, fullPage: false });

  // Screenshot individual chart elements
  const c1Path = path.join(previewDir, 'rendered-chart-1-column.png');
  await sheet1Containers[0].screenshot({ path: c1Path });

  const c2Path = path.join(previewDir, 'rendered-chart-2-bar.png');
  await sheet1Containers[1].screenshot({ path: c2Path });

  // 2. Sheet 2: TrendsAndShares
  console.log('Switching to Sheet 2: TrendsAndShares');
  const tabSwitched = await page.evaluate(() => {
    const tabs = [...document.querySelectorAll('[data-sheet="tabs"] button')];
    const target = tabs.find(b => b.textContent.includes('TrendsAndShares'));
    if (target) {
      target.click();
      return true;
    }
    return false;
  });
  ok('clicked TrendsAndShares sheet tab', tabSwitched);
  await page.waitForTimeout(3000);

  const sheet2Containers = await page.locator('.xl-chart-container').all();
  ok('sheet 2 renders two chart containers', sheet2Containers.length === 2, `found ${sheet2Containers.length}`);

  const chart3Title = await page.locator('.xl-chart-container').nth(0).locator('text').first().textContent();
  ok('chart 3 has correct title', /Quarterly Outlay Trajectory/i.test(chart3Title), chart3Title);

  const chart3Lines = await page.locator('.xl-chart-container').nth(0).locator('path[data-chart-series]').count();
  ok('chart 3 has 3 series line paths', chart3Lines === 3, `line paths count: ${chart3Lines}`);

  const chartInfo = await page.evaluate(() => {
    return [...document.querySelectorAll('.xl-chart-container')].map(c => ({
      width: c.offsetWidth,
      height: c.offsetHeight,
      left: c.style.left,
      top: c.style.top,
      parentTd: c.parentElement?.dataset?.c || '',
    }));
  });
  console.log('Chart container info on Sheet 2:', chartInfo);

  const chart4Title = await page.locator('.xl-chart-container').nth(1).locator('text').first().textContent();
  ok('chart 4 has correct title', /Expenditure Share by Object/i.test(chart4Title), chart4Title);

  const chart4Slices = await page.locator('.xl-chart-container').nth(1).locator('path').count();
  ok('chart 4 has 5 pie slices', chart4Slices === 5, `path count: ${chart4Slices}`);

  // Screenshot sheet 2
  const sheet2Path = path.join(previewDir, 'rendered-sheet-trends-and-shares.png');
  await page.screenshot({ path: sheet2Path, fullPage: false });

  // Screenshot individual chart elements
  const c3Path = path.join(previewDir, 'rendered-chart-3-line.png');
  await sheet2Containers[0].screenshot({ path: c3Path });

  const c4Path = path.join(previewDir, 'rendered-chart-4-pie.png');
  await sheet2Containers[1].screenshot({ path: c4Path });

  // 3. Mobile Gutter Scroll Test: verify charts slide behind the sticky row number gutter
  console.log('Testing mobile viewport and horizontal scroll over gutter...');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);

  // Scroll the stage horizontally so that the chart is partially under the sticky row gutter
  const scrolled = await page.evaluate(() => {
    const pane = document.querySelector('[data-sheet="stage"] > div') || document.querySelector('[data-sheet="stage"]');
    if (pane) {
      pane.scrollLeft = 850;
      return { scrollLeft: pane.scrollLeft, maxScroll: pane.scrollWidth - pane.clientWidth };
    }
    return null;
  });
  ok('scrolled horizontally on mobile width', scrolled?.scrollLeft > 0, `scrollLeft: ${scrolled?.scrollLeft}`);

  const mobileGutterPath = path.join(previewDir, 'mobile-gutter-scrolled.png');
  await page.screenshot({ path: mobileGutterPath, fullPage: false });

  console.log('\nChart checks completed.');
} catch (err) {
  console.error('Test error:', err);
  failures.push('Exception: ' + err.message);
} finally {
  await browser.close();
  server.close();
}

if (failures.length > 0) {
  console.error('\nFAILED CHECKS:\n' + failures.map(f => `  - ${f}`).join('\n'));
  process.exit(1);
} else {
  console.log('\nALL CHECKS PASSED');
  process.exit(0);
}
