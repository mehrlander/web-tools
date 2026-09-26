#!/usr/bin/env node
// pages/shortcut-log.html — the reader both sides use, as the app view
// `shortcut-log`.
//
//   node tools/test/shortcut-log-page.mjs
//
// The GitHub API is stubbed and every library is served from node_modules, so
// the run is offline. What is checked is what broke or was asked for:
//
//   - each entry is one line (what ran, verdict, when), with detail on tap;
//   - a paste is scored by its target, against the open PR its commit belongs
//     to, not by the installer's stamp against main;
//   - an unanswerable lookup yields no verdict icon at all;
//   - the token screen is gh-auth's, raised for a missing token and for the
//     private repo's 404.
//
// Exits nonzero on any failure. Not part of `npm test` (needs a browser).

import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { typeFor, resolveCdn } from '../render/cdn.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const failures = [];
const ok = (n, c, d = '') => {
  if (c) console.log(`  ok    ${n}`);
  else { console.log(`  FAIL  ${n}${d ? ' — ' + d : ''}`); failures.push(n); }
};

const server = http.createServer(async (req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '');
  try {
    res.writeHead(200, { 'content-type': typeFor(rel) });
    res.end(await readFile(path.join(root, rel)));
  } catch { res.writeHead(404); res.end('nope'); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

const SHA = '3793674509e3378e65a4f4ed8007373c4e22c8ad';
const HEAD = '203abce496c0ad4836581952ee7cf64cd26035a4';
const stampOf = (d) => [d.getFullYear(), d.getMonth() + 1, d.getDate()]
  .map((n, i) => String(n).padStart(i ? 2 : 4, '0')).join('-') + '-'
  + [d.getHours(), d.getMinutes(), d.getSeconds()].map(n => String(n).padStart(2, '0')).join('');

// Newest first: a run seconds ago, the paste it came from, and an old text row.
const LOG = {
  [stampOf(new Date(Date.now() - 20_000))]:
    'run name=Dump-Named build=c4fd8aa chose=Get-FileInfo\n'
    + JSON.stringify({ Base64: 'eyJvcCI6ImltcG9ydCJ9'.repeat(20), caption: 'a "quoted" thing' }),
  [stampOf(new Date(Date.now() - 600_000))]: JSON.stringify({
    op: 'paste', name: 'Dump-Named', target: 'c4fd8aa', build: 'f18efdb',
    from: `https://raw.githubusercontent.com/mehrlander/shortcut-tools/${SHA}/packed/dump-named.json` }),
  '2026-08-22-170121': 'I pledge allegiance to the Flag',
};

let access = 200;
let pulls = [{ number: 50, state: 'open', head: { sha: HEAD, ref: 'claude/x' } }];
let builds = { main: { 'Dump-Named': 'f0304eb' }, [HEAD]: { 'Dump-Named': 'c4fd8aa' } };

const json = (route, status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const b64 = s => Buffer.from(s, 'utf8').toString('base64');

const handler = async route => {
  const u = new URL(route.request().url());
  const p = u.pathname;
  if (u.host === 'api.github.com' && p.startsWith('/repos/mehrlander/web-tools-private/')) {
    if (access === 404) return json(route, 404, { message: 'Not Found' });
    if (p.endsWith('/contents/shortcuts/log'))
      return json(route, 200, Object.keys(LOG).map(s => ({ name: s + '.json', type: 'file' })));
    const m = p.match(/\/contents\/shortcuts\/log\/(.+)\.json$/);
    if (m) return json(route, 200, { content: b64(LOG[m[1]] || ''), encoding: 'base64', sha: 'x', size: 1 });
  }
  if (u.host === 'api.github.com' && p.startsWith('/repos/mehrlander/shortcut-tools/')) {
    if (/\/commits\/[0-9a-f]{40}\/pulls$/.test(p))
      return pulls === null ? json(route, 500, { message: 'boom' }) : json(route, 200, pulls);
    if (p.endsWith('/contents/plists/builds.json')) {
      const b = builds[u.searchParams.get('ref')];
      return b ? json(route, 200, { content: b64(JSON.stringify(b)), encoding: 'base64', sha: 'x', size: 1 })
               : json(route, 404, { message: 'Not Found' });
    }
  }
  const r = resolveCdn(u.href, root);
  if (r.kind === 'fulfill') return route.fulfill({ status: r.status || 200, body: r.body, contentType: r.contentType });
  if (r.kind === 'empty') return route.fulfill({ status: 200, body: '', contentType: r.contentType });
  if (u.origin === origin) return route.continue();
  return route.fulfill({ status: 404, body: '' });
};

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const withPage = async (setup, fn) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(setup);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', handler);
  await page.goto(`${origin}/pages/shortcut-log.html`, { waitUntil: 'load' });
  try { return await fn(page, errors); } finally { await ctx.close(); }
};
const token = () => { try { localStorage.setItem('ghToken', 'stub') } catch {} };

const rows = page => page.evaluate(() => [...document.querySelectorAll('[data-row]')].map(r => ({
  text: r.innerText.replace(/\s+/g, ' ').trim(),
  height: r.getBoundingClientRect().height,
  current: !!r.querySelector('[data-verdict] .ph-check-circle'),
  stale: !!r.querySelector('[data-verdict] .ph-arrow-circle-up'),
})));
const settle = page => page.waitForFunction(() =>
  document.querySelectorAll('[data-row]').length === 3
  && document.querySelectorAll('[data-verdict] i').length > 0, null, { timeout: 15000 }).catch(() => {});

console.log('shortcut-log.html');

await withPage(token, async (page, errors) => {
  await settle(page);
  const r = await rows(page);
  ok('page boots with no error', errors.length === 0, errors[0]);
  ok('a stored token skips the token screen', !(await page.$('#__ghAuthForm')));
  ok('all three entries render', r.length === 3, String(r.length));
  // One line of meaning per entry, whatever the payload carries.
  ok('every row is one line', r.every(x => x.height < 64), r.map(x => x.height).join(','));
  ok('the run names the shortcut', /^Dump-Named/.test(r[0]?.text), r[0]?.text);
  ok('an entry logged seconds ago says so', /just now/.test(r[0]?.text), r[0]?.text);
  // The defect this redesign fixed: the paste's own stamp is Library-Paste's.
  ok('a paste is scored by its target against its PR head: current', r[1]?.current, r[1]?.text);
  ok('and the row names the PR it was scored against', /#50/.test(r[1]?.text), r[1]?.text);
  ok('the run inherits that baseline', r[0]?.current, r[0]?.text);
  ok('a text row gets no verdict', !r[2]?.current && !r[2]?.stale, r[2]?.text);
  ok('no page-wide horizontal scroll', await page.evaluate(() =>
    document.documentElement.scrollWidth <= innerWidth));

  await page.locator('[data-row]').nth(0).click();
  await page.waitForSelector('[data-detail] [data-facts]', { timeout: 5000 });
  const d = await page.evaluate(() => ({
    listHidden: getComputedStyle(document.querySelector('[data-list]')).display === 'none',
    facts: document.querySelector('[data-facts]').innerText.replace(/\s+/g, ' '),
    pre: document.querySelector('[data-payload] pre')?.textContent || '',
  }));
  ok('on a phone the detail replaces the list', d.listHidden);
  ok('the detail states the verdict and baseline', /current with PR #50/.test(d.facts), d.facts);
  ok('a huge field is elided with its length', /"Base64": "eyJ\S*…\[\d+\]"/.test(d.pre), d.pre.slice(0, 120));
  await page.getByRole('button', { name: 'raw' }).click();
  const raw = await page.textContent('[data-payload] pre');
  ok('raw restores the exact payload', raw.includes('\\"quoted\\"'), raw.slice(0, 80));
  await page.getByRole('button', { name: 'Back' }).click();
  ok('back returns to the list', await page.isVisible('[data-list]'));
});

// Main has moved past the PR head: stale, and the detail names what it publishes.
builds = { main: { 'Dump-Named': 'f0304eb' }, [HEAD]: { 'Dump-Named': 'abcb62e' } };
await withPage(token, async page => {
  await settle(page);
  const r = await rows(page);
  ok('a paste behind its PR head is marked behind', r[1]?.stale && !r[1]?.current, r[1]?.text);
  await page.locator('[data-row]').nth(1).click();
  const facts = (await page.textContent('[data-facts]')).replace(/\s+/g, ' ');
  ok('the detail names the build the PR head publishes', /abcb62e/.test(facts) && /behind PR #50/.test(facts), facts);
  ok('the detail names the installer and its own stamp', /Library-Paste f18efdb/.test(facts), facts);
});

// The failure that would make this worse than no verdict.
pulls = null;
await withPage(token, async page => {
  await page.waitForFunction(() => document.querySelectorAll('[data-row]').length === 3, null, { timeout: 15000 });
  await page.waitForTimeout(800);
  const r = await rows(page);
  ok('an unanswered PR lookup yields no verdict at all', r.every(x => !x.current && !x.stale), r.map(x => x.text).join(' | '));
});
pulls = [];

const prompt = async setup => withPage(setup, async page => {
  await page.waitForSelector('#__ghAuthForm', { timeout: 8000 }).catch(() => {});
  return page.evaluate(() => ({
    shown: !!document.getElementById('__ghAuthForm'),
    getToken: [...document.querySelectorAll('a')].some(a => /github\.com\/settings\/tokens\/new/.test(a.href)),
    text: (document.body.innerText || '').slice(0, 200),
  }));
});
const none = await prompt(() => { try { localStorage.removeItem('ghToken') } catch {} });
ok('no token raises the standard token screen', none.shown, none.text);
ok('and it offers the link to go get one', none.getToken, none.text);
access = 404;
const denied = await prompt(token);
ok('a 404 on the private repo raises it too', denied.shown, denied.text);

await browser.close(); server.close();
console.log(failures.length ? `\n${failures.length} failed` : '\nall passed');
process.exit(failures.length ? 1 : 0);
