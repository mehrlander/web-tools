#!/usr/bin/env node
// probe-driver.mjs — the launcher's self-driving check (?probe=), end to end in
// Chromium against the sibling checkouts: every step runs, the run survives its
// own reloads, and the result it would commit to the registry is captured
// instead of written.
//
//   node node/test/probe-driver.mjs
//
// The `device-link` errand method (docs/run-methods.csv) puts this driver on a
// phone, where a person opens one link and nothing else. This is the check
// that the driver itself works before a person is asked to open anything.
// Not part of `npm test` (needs a browser).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { resolveCdn } from '../render/cdn.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SEL = ['mehrlander/home@main', 'mehrlander/web-tools-private@main',
  'mehrlander/home@main:projects/budget-drs/submittal/link-rewrite.js'];
const framed = encodeURIComponent('view=app&appRepo=mehrlander/web-tools&appPath=pages/diff-tool.html');
const steps = `fab,write,reload,back,reload,go:${framed},fab`;
const url = 'https://mehrlander.github.io/web-tools/pages/scratch/toss-top-probe.html?gh=mehrlander/web-tools:app/index.html&' +
  SEL.map(v => 'refs=' + v).join('&') + `&view=map&probe=test-probe-driver&steps=${steps}`;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addInitScript(() => { try { localStorage.setItem('ghToken', 'test-token'); } catch {} });
const page = await ctx.newPage();
let filed = null;
await page.route('**/*', async route => {
  const req = route.request();
  if (req.method() === 'PUT' && /web-tools-private\/contents\/errands\/results\//.test(req.url())) {
    const body = JSON.parse(req.postData() || '{}');
    filed = { path: decodeURIComponent(new URL(req.url()).pathname.split('/contents/')[1]),
              record: JSON.parse(Buffer.from(body.content || '', 'base64').toString('utf8') || 'null') };
    return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ content: { sha: 'x' }, commit: { sha: 'y' } }) });
  }
  const r = resolveCdn(req.url(), root, null, req.headers());
  if (r.kind === 'continue') return route.abort();
  if (r.kind === 'empty') return route.fulfill({ status: 200, contentType: r.contentType, body: '' });
  return route.fulfill({ status: r.status || 200, contentType: r.contentType, body: r.body });
});
await page.goto(url, { waitUntil: 'domcontentloaded' });
for (let t = 0; t < 90 && !filed; t++) await page.waitForTimeout(1000);
const banner = await page.evaluate(() => document.getElementById('probe-banner')?.textContent || null).catch(() => null);
await browser.close();

console.log('banner: ' + banner);
if (!filed) { console.log('FAIL: no result was filed'); process.exit(1); }
console.log('filed: ' + filed.path);
for (const s of filed.record.steps) console.log('  ' + JSON.stringify(s));
const want = ['fab', 'write', 'reload', 'back', 'reload', 'go', 'fab'];
const got = filed.record.steps.map(s => s.step);
const ok = filed.path === 'errands/results/test-probe-driver.json' && JSON.stringify(got) === JSON.stringify(want) && filed.record.pass;
const framedOk = filed.record.steps[5].frames > 0 && filed.record.steps[0].frames === 0;
console.log(ok && framedOk ? 'PASS: every step ran, in order, the go step mounted a frame, and the result was filed'
  : `FAIL: steps ${got.join(',')}; pass=${filed.record.pass}; frames ${filed.record.steps.map(s => s.frames).join(',')}`);

// A tab that dies during `fab`: Safari reloads it, and the run finds the step
// still armed. Seeded here rather than crashed, since Chromium does not die.
const b2 = await chromium.launch();
const c2 = await b2.newContext();
await c2.addInitScript(() => { try {
  localStorage.setItem('ghToken', 'test-token');
  if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1');
    localStorage.setItem('probe:test-probe-died', JSON.stringify({ i: 0, log: [], armed: 'fab', started: 'x' })); }
} catch {} });
const p2 = await c2.newPage();
let filed2 = null;
await p2.route('**/*', async route => {
  const req = route.request();
  if (req.method() === 'PUT' && /errands\/results\//.test(req.url())) {
    filed2 = JSON.parse(Buffer.from(JSON.parse(req.postData()).content, 'base64').toString('utf8'));
    return route.fulfill({ status: 201, contentType: 'application/json', body: '{"content":{"sha":"x"}}' });
  }
  const r = resolveCdn(req.url(), root, null, req.headers());
  if (r.kind === 'continue') return route.abort();
  if (r.kind === 'empty') return route.fulfill({ status: 200, contentType: r.contentType, body: '' });
  return route.fulfill({ status: r.status || 200, contentType: r.contentType, body: r.body });
});
await p2.goto(url.replace('test-probe-driver', 'test-probe-died').replace(/&steps=[^&]*/, '&steps=fab'));
for (let t = 0; t < 60 && !filed2; t++) await p2.waitForTimeout(1000);
await b2.close();
const diedOk = !!filed2 && filed2.steps[0]?.died === true && filed2.pass === false;
console.log(diedOk ? 'PASS: a step left armed is recorded as died, and the run fails' : 'FAIL: died case ' + JSON.stringify(filed2 && filed2.steps));
process.exit(ok && framedOk && diedOk ? 0 : 1);
