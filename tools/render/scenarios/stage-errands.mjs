// Shoot the stage's errand panel: the fourth intake, and the only one that
// could not be reached from the app until now. The two files it reads are
// public and tokenless by design, so the stub here only stands in for the
// sandbox's lack of network; the request shape, the parse and the render are
// the page's own.
//
//   npm run shot -- app/index.html --query view=stage \
//     --script tools/render/scenarios/stage-errands.mjs
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from '../../test/bootstrap.mjs';

export default async (page) => {
  const list = readFileSync(path.join(repoRoot, 'courier/errands.json'), 'utf8');
  const pointer = readFileSync(path.join(repoRoot, 'bookmarklets/courier.js'), 'utf8');

  // A second open errand, so the panel is seen carrying a choice rather than
  // the one shape a single row can show. Fixture only; the real list has one.
  const two = JSON.parse(list);
  const a = two.errands[0];
  two.errands.push({ ...a, id: 'ofm-acfr-index', title: 'List the OFM annual reports',
    note: 'The parallel OFM index on the same host, 2000 to 2017. Same wall, same reason.',
    url: a.url.replace('/drs/', '/ofm/'), opened: '2026-09-16',
    result: { ...a.result, path: 'courier/results/ofm-acfr-index.md' } });

  // ERR=1 shoots the honest-failure state instead. A 403 here is the API's
  // 60-reads-an-hour limit, not a permission problem, which is the one thing
  // the panel has to say plainly or a reader goes looking for a token.
  if (process.env.ERR) {
    await page.route('https://api.github.com/repos/mehrlander/web-tools/contents/**', route =>
      route.fulfill({ status: 403, body: 'rate limited',
        headers: { 'access-control-allow-origin': '*' } }));
  } else
  await page.route('https://api.github.com/repos/mehrlander/web-tools/contents/**', route => {
    const p = decodeURIComponent(new URL(route.request().url()).pathname)
      .replace('/repos/mehrlander/web-tools/contents/', '');
    const body = p === 'courier/errands.json' ? JSON.stringify(two, null, 1)
      : p === 'bookmarklets/courier.js' ? pointer : null;
    if (body === null) return route.fulfill({ status: 404, body: 'no',
      headers: { 'access-control-allow-origin': '*' } });
    route.fulfill({ status: 200, body,
      headers: { 'content-type': 'text/plain', 'access-control-allow-origin': '*' } });
  });

  // ROUTE=1 arrives by address instead of by tap, which is the path the courier
  // takes from our own origin: ?view=stage&tab=errands must open the panel on
  // mount, with no click anywhere.
  if (process.env.ROUTE) {
    // Reload so the mount happens with the stub above in place. The shot tool
    // answers api.github.com from the working tree and the first load is
    // already over by the time a scenario runs, so without this the panel
    // opens correctly and renders the contents-API envelope as no errands.
    await page.reload({ waitUntil: 'load' });
    await page.locator('.ph-moped').first().waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForTimeout(1200);
    const seen = await page.evaluate(() => ({
      open: !!document.querySelector('a[title^="Drag to your bookmarks bar"]'),
      rows: document.querySelectorAll('button[title^="Errands:"]').length,
      search: location.search,
    }));
    console.log('panel open on arrival:', seen.open ? 'YES' : 'NO (bug)');
    console.log('address after mount:', seen.search);
    return;
  }

  const btn = page.locator('button[title^="Errands:"]');
  await btn.waitFor({ state: 'visible', timeout: 15000 });
  await btn.click();
  await page.locator('.ph-moped').first().waitFor({ timeout: 5000 });
  await page.waitForTimeout(900);
};
