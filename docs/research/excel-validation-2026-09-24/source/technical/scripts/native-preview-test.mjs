import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile, writeFile, stat, access } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

// Re-run with the configured runtime's node.exe. Optional: --browser <exe>,
// --playwright <package-directory>, --wait-seconds 600, --output-dir <directory>,
// --native-workbook-sha256 <hash recorded for the workbook Excel exported>.
const options = Object.fromEntries(process.argv.slice(2).reduce((pairs, item, index, items) => {
  if (item.startsWith('--')) pairs.push([item.slice(2), items[index + 1]]);
  return pairs;
}, []));
const taskRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outputDir = path.resolve(options['output-dir'] || path.join(taskRoot, 'outputs/excel-validation/charts'));
const bundlePackages = 'C:/Users/mehrl/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const require = createRequire(import.meta.url);
const playwrightPath = options.playwright || path.join(bundlePackages, 'playwright');
const { chromium } = require(playwrightPath);
const playwrightVersion = require(path.join(playwrightPath, 'package.json')).version;
const cases = ['Column', 'Line', 'Scatter'].map(name => ({ name, image: `excel-${name.toLowerCase()}.png` }));
const requiredFiles = ['native-preview.html', 'chart-cases.xlsx', ...cases.map(item => item.image)];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const fileHash = async name => hash(await readFile(path.join(outputDir, name)));

async function waitForInputs() {
  const deadline = Date.now() + Number(options['wait-seconds'] || 0) * 1000;
  while (true) {
    const missing = [];
    for (const name of requiredFiles) {
      try { if (!(await stat(path.join(outputDir, name))).size) missing.push(name); }
      catch { missing.push(name); }
    }
    if (!missing.length) return;
    if (Date.now() >= deadline) throw new Error(`Native inputs are not ready: ${missing.join(', ')}`);
    console.log(`Waiting for native inputs: ${missing.join(', ')}. Next check in 30 seconds.`);
    await delay(Math.min(30000, Math.max(1, deadline - Date.now())));
  }
}

async function findBrowser() {
  const explicitPath = options.browser || process.env.NATIVE_PREVIEW_BROWSER;
  if (explicitPath) {
    await access(explicitPath);
    return { executablePath: explicitPath };
  }
  // This machine's existing browser probe succeeded with the msedge channel.
  // Let Playwright resolve its installed browser rather than guessing a path.
  return { channel: 'msedge' };
}

await waitForInputs();
const inputHashes = Object.fromEntries(await Promise.all(requiredFiles.map(async name => [name, await fileHash(name)])));
const evidence = {
  case: 'native-excel-image-delivery-and-workbook-download',
  scope: 'Diagnostic local page showing Excel-exported PNG images; does not validate an independent renderer.',
  startedAt: new Date().toISOString(),
  inputHashes,
  nativeReferenceWorkbookSha256: options['native-workbook-sha256']?.toLowerCase() || null,
  playwrightVersion,
  nodeVersion: process.version,
  viewport: { width: 1280, height: 1080 },
  images: [],
  requests: [],
  browserErrors: [],
  outcome: 'inconclusive',
};
let browser;
let server;
try {
  if (evidence.nativeReferenceWorkbookSha256) {
    assert.equal(inputHashes['chart-cases.xlsx'], evidence.nativeReferenceWorkbookSha256,
      'Source workbook differs from the identity supplied by the native Excel export run');
  }
  const browserOptions = await findBrowser();
  evidence.browserLaunch = browserOptions;
  const mime = { '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
  server = createServer(async (request, response) => {
    const filename = new URL(request.url, 'http://127.0.0.1').pathname.slice(1) || 'native-preview.html';
    if (filename === 'favicon.ico') { response.writeHead(204); response.end(); return; }
    if (!requiredFiles.includes(filename)) { response.writeHead(404); response.end(); return; }
    try {
      const bytes = await readFile(path.join(outputDir, filename));
      const headers = { 'Content-Type': mime[path.extname(filename)], 'Content-Length': bytes.length, 'Cache-Control': 'no-store' };
      if (filename.endsWith('.xlsx')) headers['Content-Disposition'] = 'attachment; filename="chart-cases.xlsx"';
      response.writeHead(200, headers);
      response.end(bytes);
      evidence.requests.push({ method: request.method, file: filename, status: 200, sha256: hash(bytes), bytes: bytes.length });
    } catch (error) { response.writeHead(500); response.end(String(error)); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  evidence.url = `${origin}/native-preview.html`;
  browser = await chromium.launch({ ...browserOptions, headless: true, timeout: 30000 });
  evidence.browserVersion = browser.version();
  const context = await browser.newContext({ acceptDownloads: true, viewport: evidence.viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', error => evidence.browserErrors.push(String(error)));
  const imageResponses = new Map();
  page.on('response', response => {
    const name = new URL(response.url()).pathname.slice(1);
    if (cases.some(item => item.image === name)) {
      imageResponses.set(name, response.body().then(bytes => ({ sha256: hash(bytes), bytes: bytes.length, status: response.status(), url: response.url() })));
    }
  });
  await page.route('**/*', async route => {
    if (new URL(route.request().url()).origin === origin) await route.continue();
    else { evidence.browserErrors.push(`Unexpected external request: ${route.request().url()}`); await route.abort(); }
  });
  const navigation = await page.goto(evidence.url, { waitUntil: 'networkidle', timeout: 30000 });
  assert.equal(navigation.status(), 200);
  for (const item of cases) {
    const tab = page.getByRole('tab', { name: item.name, exact: true });
    await tab.click();
    assert.equal(await tab.getAttribute('aria-selected'), 'true');
    const panel = page.getByRole('tabpanel', { name: item.name, exact: true });
    await panel.waitFor({ state: 'visible' });
    const img = panel.getByRole('img', { name: `Native Excel capture of the ${item.name} chart`, exact: true });
    await img.evaluate(element => element.decode());
    const dimensions = await img.evaluate(element => ({
      naturalWidth: element.naturalWidth, naturalHeight: element.naturalHeight,
      displayedWidth: element.getBoundingClientRect().width, displayedHeight: element.getBoundingClientRect().height,
      currentSrc: element.currentSrc,
    }));
    assert.ok(dimensions.naturalWidth > 0 && dimensions.naturalHeight > 0, `${item.name} did not decode`);
    const received = await imageResponses.get(item.image);
    assert.ok(received, `${item.name} has no actual image response evidence`);
    assert.equal(received.status, 200);
    assert.equal(received.sha256, inputHashes[item.image], `${item.name} browser image bytes differ from the native PNG`);
    assert.ok(Math.abs(dimensions.displayedWidth / dimensions.displayedHeight - dimensions.naturalWidth / dimensions.naturalHeight) < 0.002, `${item.name} display changed aspect ratio`);
    evidence.images.push({ sheet: item.name, filename: item.image, ...dimensions, ...received, nativeFileSha256: inputHashes[item.image], bytesMatch: true });
  }
  await page.locator('#workbook-hash[data-state="ready"]').waitFor({ state: 'visible' });
  evidence.displayedWorkbookSha256 = await page.locator('#workbook-hash').textContent();
  assert.equal(evidence.displayedWorkbookSha256, inputHashes['chart-cases.xlsx']);
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Download workbook (.xlsx)', exact: true }).click();
  const download = await downloadEvent;
  assert.equal(await download.failure(), null);
  const downloadedName = 'chart-cases-downloaded.xlsx';
  await download.saveAs(path.join(outputDir, downloadedName));
  const downloadedSha256 = await fileHash(downloadedName);
  assert.equal(downloadedSha256, inputHashes['chart-cases.xlsx'], 'Downloaded workbook bytes do not match the final source workbook');
  evidence.download = { savedAs: downloadedName, suggestedFilename: download.suggestedFilename(), url: download.url(), sha256: downloadedSha256, finalWorkbookSha256: inputHashes['chart-cases.xlsx'], bytesMatch: true };
  // Simulate a later workbook change in transport only; do not mutate files.
  const changedBytes = Buffer.from(await readFile(path.join(outputDir, 'chart-cases.xlsx')));
  changedBytes[changedBytes.length - 1] ^= 1;
  const changedRoute = async route => route.fulfill({status:200,contentType:mime['.xlsx'],body:changedBytes});
  await page.route(`${origin}/chart-cases.xlsx`, changedRoute);
  await page.reload({waitUntil:'networkidle'});
  await page.locator('#workbook-hash[data-state="error"]').waitFor();
  assert.match(await page.locator('#workbook-hash').textContent(), /changed since Excel exported/);
  assert.equal(await page.locator('#download-workbook').getAttribute('href'), null);
  assert.equal(await page.locator('#download-workbook').getAttribute('aria-disabled'), 'true');
  evidence.changedWorkbookGuard = {outcome:'confirmed',method:'One response byte changed in browser transport; source files untouched',downloadDisabled:true};
  await page.unroute(`${origin}/chart-cases.xlsx`, changedRoute);
  await page.reload({waitUntil:'networkidle'});
  await page.locator('#workbook-hash[data-state="ready"]').waitFor();
  // Exercise accessible tab keyboard navigation as part of the actual page flow.
  const scatterTab = page.getByRole('tab', { name: 'Scatter', exact: true });
  await scatterTab.focus();
  await page.keyboard.press('Home');
  assert.equal(await page.getByRole('tab', { name: 'Column', exact: true }).getAttribute('aria-selected'), 'true');
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.getByRole('tab', { name: 'Line', exact: true }).getAttribute('aria-selected'), 'true');
  await page.getByRole('tab', { name: 'Column', exact: true }).click();
  await page.screenshot({ path: path.join(outputDir, 'capture.png'), fullPage: true });
  evidence.capture = { filename: 'capture.png', sha256: await fileHash('capture.png'), activeSheet: 'Column' };
  evidence.finalHashes = Object.fromEntries(await Promise.all(requiredFiles.map(async name => [name, await fileHash(name)])));
  assert.deepEqual(evidence.finalHashes, inputHashes, 'Inputs changed during the browser test');
  assert.deepEqual(evidence.browserErrors, []);
  evidence.outcome = 'confirmed';
  evidence.confirmedClaim = 'All three tabs show decoded native Excel images whose received bytes match the retained PNGs. The actual workbook download matches the unchanged source workbook.';
} catch (error) {
  evidence.failure = error.stack || String(error);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
  evidence.finishedAt = new Date().toISOString();
  await writeFile(path.join(outputDir, 'native-preview-evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify({ outcome: evidence.outcome, images: evidence.images.length, downloadMatches: evidence.download?.bytesMatch || false, evidence: path.join(outputDir, 'native-preview-evidence.json'), failure: evidence.failure || null }, null, 2));
}
