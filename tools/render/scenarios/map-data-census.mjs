// The declared public hub inventory, opened through Map into Files. The renderer
// serves this checkout's manifest, census and source CSV; no invented estate.
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

export default async (page, { repoRoot }) => {
  const fail = (what, state) => { throw new Error('map-data-census: ' + what + ' ' + JSON.stringify(state)); };
  const noOverflow = async (where) => {
    const size = await page.evaluate(() => ({
      width: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    if (size.scroll > size.width + 1) fail(where + ' must contain horizontal scrolling', size);
  };
  await page.waitForFunction(() => {
    const el = document.querySelector('[x-data="map()"]');
    const map = el && Alpine.$data(el);
    return map?.mapTab === 'data' && !map.dataLoading && map.dataCensus;
  }, null, { timeout: 30000 });
  const inventory = await page.evaluate(() => {
    const map = Alpine.$data(document.querySelector('[x-data="map()"]'));
    return { authed: map.hasToken(), error: map.dataErr,
      sources: map.dataCensus.map(s => ({ repo: s.repo, ref: s.ref, state: s.state, files: s.files.length })),
      matches: map.dataMatches.length };
  });
  if (inventory.authed || inventory.error || inventory.sources.length !== 1 ||
      inventory.sources[0].repo !== 'mehrlander/web-tools' ||
      inventory.sources[0].state !== 'declared' || inventory.matches < 1)
    fail('the public hub must load its declared inventory', inventory);
  await noOverflow('Data');
  const label = page.viewportSize().width < 600 ? 'phone' : 'desktop';
  const outDir = path.resolve(process.env.CENSUS_SCREENSHOT_DIR || path.join(repoRoot, 'tools/.preview'));
  await mkdir(outDir, { recursive: true });
  await page.screenshot({ path: path.join(outDir, `map-data-census-${label}.png`) });

  await page.getByRole('searchbox', { name: 'Search CSV inventory' }).fill('docs/docs.csv');
  await page.waitForFunction(() => {
    const map = Alpine.$data(document.querySelector('[x-data="map()"]'));
    return map.dataMatches.length === 1 && map.dataMatches[0].path === 'docs/docs.csv';
  }, null, { timeout: 10000 });
  const row = page.locator('section').filter({ has: page.getByRole('searchbox', { name: 'Search CSV inventory' }) })
    .getByRole('button').filter({ has: page.getByText('docs.csv', { exact: true }) });
  await row.click();
  await page.waitForFunction(() => {
    const browser = document.querySelector('[data-file-browser]');
    const files = browser && Alpine.$data(browser.parentElement);
    const viewer = browser?.querySelector('[data-slide="' + files?.at + '"] [data-file-viewer]');
    return window.__shell?.view === 'files' && files?.sel === 'docs/docs.csv' &&
      viewer?.offsetParent && viewer.querySelectorAll('.tabulator-row').length > 0;
  }, null, { timeout: 30000 });
  const opened = await page.evaluate(() => {
    const browser = document.querySelector('[data-file-browser]');
    const files = Alpine.$data(browser.parentElement);
    const viewer = browser.querySelector('[data-slide="' + files.at + '"] [data-file-viewer]');
    const store = Alpine.store('browser');
    return { view: window.__shell.view, path: files.sel, repo: store.repo, ref: store.ref,
      rows: viewer.querySelectorAll('.tabulator-row').length };
  });
  if (opened.repo !== inventory.sources[0].repo || opened.ref !== inventory.sources[0].ref)
    fail('Files must keep the inventory repository and ref', opened);
  await noOverflow('Files');
  console.log('CHECK OK map-data-census', JSON.stringify({ viewport: label, inventory, opened }));
};
