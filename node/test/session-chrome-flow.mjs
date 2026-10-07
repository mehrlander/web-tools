#!/usr/bin/env node
// pages/session.html keeps its chrome on screen while the document scrolls.
//
//   node node/test/session-chrome-flow.mjs
//
// The page has had its scroll shape wrong twice. On 2026-09-02 it was an app
// shell (`h-[100dvh] … overflow-hidden`) over a component that sized to its
// content, so a record taller than the viewport was clipped with nothing to
// scroll. The fix let the document scroll, and left the other half of the house
// style's shape for an embeddable page unbuilt: `min-h-dvh` plus STICKY CHROME
// (html-style rule 5). Nothing was sticky, so at 390x844 the tab row sat
// 189px above the fold at the bottom of the scroll, and Raw laid 243 KB out as
// a single 40,528px block. The outline now has a timeline rail, and the chrome
// includes conversation search; both must survive a scroll to the final row.
//
// Both failures are laid-out pixels over a real scroll, so neither jsdom nor a
// class-level read can hold them: what is asserted here is where a box LANDS
// after the page is scrolled, which is the only statement of the rule that
// cannot pass while the page is broken.
//
// Phone width on purpose. At 1280 the head is short enough that the whole page
// fits and every assertion below passes vacuously.
//
// Exits nonzero on any failure. Not part of `npm test` (needs a browser).

import http from 'node:http';
import path from 'node:path';
import zlib from 'node:zlib';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { resolveCdn, typeFor } from '../render/cdn.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const shots = path.join(root, 'node/.preview');
await mkdir(shots, { recursive: true });
const failures = [];
const errors = [];
let checks = 0;
const ok = (name, cond, detail = '') => {
  checks++;
  if (cond) console.log(`  ok    ${name}`);
  else { console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`); failures.push(name); }
};

// A record carried IN the address, so this needs no token and no store: #gz= is
// the page's own fallback for a reader who has neither. Twelve exchanges is
// what makes the outline taller than a phone; a shorter one would scroll
// nowhere and assert nothing.
const at = (m) => new Date(Date.UTC(2026, 8, 4, 13, m)).toISOString().replace(/\.\d+Z$/, 'Z');
const record = {
  schema: 4, short: 'ab12cd34', day: '2026-09-04',
  started: at(0), ended: at(134),
  agent_session: 'https://claude.ai/code/session_01SX',
  repos: [{ name: 'web-tools', branch: 'claude/scroll-1' }],
  opening_ask: 'the first ask', exchanges: 12, calls_total: 169, failures: 4,
  files_total: 0, files: {}, tokens: { output: 342268 },
  prompts: Array.from({ length: 12 }, (_, i) => ({ at: at(i * 10), text:
    `Ask ${i + 1}: a prompt long enough that its row wraps to more than one line on a phone.` })),
  replies: Array.from({ length: 12 }, (_, i) => ({ at: at(i * 10 + 5), text:
    `Reply ${i + 1}. Several sentences, so the card row has a body to summarise. `.repeat(4) })),
  calls: [],
};
const gz = zlib.gzipSync(Buffer.from(JSON.stringify(record)))
  .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const server = http.createServer(async (req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '');
  const target = path.resolve(root, rel);
  if (!target.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
  try {
    const body = await readFile(target);
    res.writeHead(200, { 'content-type': typeFor(rel) });
    res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

let browser, page;

// Where a box sits against the viewport, plus every element that declares a
// scroll region of its own. The second is what catches the other way this can
// go wrong: pinning the chrome by nesting a scroller inside the document, which
// on a phone takes the drag away from the page.
const geometry = () => page.evaluate(() => {
  const box = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height),
      w: Math.round(r.width) };
  };
  const shell = document.querySelector('#mount > div');
  const chrome = shell?.querySelector('[x-ref="chrome"]');
  const rail = shell?.querySelector('[title^="the session, start to end."]')?.parentElement;
  return {
    view: { h: innerHeight, w: innerWidth },
    doc: { h: document.documentElement.scrollHeight, y: Math.round(scrollY),
      w: document.documentElement.scrollWidth },
    chrome: box(chrome),
    chromeH: Number.parseFloat(shell && getComputedStyle(shell).getPropertyValue('--chrome-h')),
    tabs: box(chrome?.querySelector('[role="tablist"]')),
    search: box(chrome?.querySelector('[role="search"]')),
    rail: box(rail),
    raw: box(shell?.querySelector('[x-ref="raw"] .json-explorer')),
    scrollers: [...document.querySelectorAll('*')]
      .filter(el => el.getBoundingClientRect().height > 0 && el.scrollHeight - el.clientHeight > 4 &&
        /auto|scroll/.test(getComputedStyle(el).overflowY))
      .map(el => (el.className || '').toString().slice(0, 40)),
  };
});

try {
  browser = await chromium.launch({ args: ['--no-sandbox', '--ignore-certificate-errors'],
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
  page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    const url = route.request().url();
    if (url.startsWith(origin)) return route.continue();
    // Synthetic payload only: a neighbouring private checkout must never be
    // used to satisfy an unrelated request made by this geometry harness.
    if (url.startsWith('https://api.github.com/')
        && !url.startsWith('https://api.github.com/repos/mehrlander/web-tools/')) {
      return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
    }
    const r = resolveCdn(url, root, null);
    if (r.kind === 'continue') return route.abort();
    return route.fulfill({ status: 200, contentType: r.contentType, body: r.kind === 'empty' ? '' : r.body });
  });
  await page.goto(`${origin}/pages/session.html#gz=${gz}`, { waitUntil: 'domcontentloaded' });
  await page.locator('[x-ref="outline"] [data-card="12"]').waitFor({ timeout: 30000 });
  await page.waitForFunction(() => {
    const host = document.querySelector('#mount > div');
    return parseFloat(getComputedStyle(host).getPropertyValue('--chrome-h')) > 0;
  });
  await page.waitForTimeout(500);
  const input = page.getByRole('searchbox', { name: 'Find in conversation', exact: true });

  const top = await geometry();
  ok('the record is taller than the phone, so there is a scroll to test',
     top.doc.h > top.view.h + 200, `doc ${top.doc.h} vs view ${top.view.h}`);
  ok('the DOCUMENT is the scroller, with no nested region taking the drag',
     top.scrollers.length === 0, `nested: ${top.scrollers.join(' | ')}`);
  ok('the wrapped search row is included in the published chrome height',
     top.search?.h > 0 && top.search.top >= top.tabs.bottom
       && Math.abs(top.chromeH - top.chrome.h) <= 1,
     JSON.stringify({ tabs: top.tabs, search: top.search, chrome: top.chrome, chromeH: top.chromeH }));
  ok('the phone page has no horizontal overflow', top.doc.w <= top.view.w + 1,
     `${top.doc.w} vs ${top.view.w}`);

  await page.evaluate(() => scrollTo(0, 99999));
  await page.waitForTimeout(400);
  const bottom = await geometry();
  ok('scrolled to the end, the chrome remains at the top of the screen',
     bottom.doc.y > 200 && bottom.chrome && Math.abs(bottom.chrome.top) <= 1,
     `scroll ${bottom.doc.y}, chrome at ${bottom.chrome?.top}`);
  ok('the search control remains inside the visible sticky chrome',
     bottom.search?.h > 0 && bottom.search.top >= 0 && bottom.search.bottom <= bottom.chrome.bottom + 1,
     JSON.stringify({ search: bottom.search, chrome: bottom.chrome }));
  ok('the timeline rail pins directly below the measured chrome',
     bottom.rail?.h > 0 && Math.abs(bottom.rail.top - bottom.chrome.bottom) <= 1,
     `rail at ${bottom.rail?.top}, chrome ends at ${bottom.chrome?.bottom}`);
  await page.screenshot({ path: path.join(shots, 'session-chrome-outline.png') });

  // Search from the bottom, keeping enough hits that the document still has
  // a genuine scroll. A one-hit search could pass this without sticky chrome.
  await input.fill('Reply');
  await page.waitForFunction(() => document.querySelectorAll('[data-session-match]').length === 12);
  await page.evaluate(() => scrollTo(0, 99999));
  await page.waitForTimeout(300);
  const searched = await geometry();
  ok('search at the end keeps its controls visible while the document scrolls',
     searched.doc.y > 200 && Math.abs(searched.chrome.top) <= 1
       && searched.search.h > 0 && searched.search.bottom <= searched.view.h,
     JSON.stringify({ y: searched.doc.y, chrome: searched.chrome, search: searched.search }));
  ok('matching passages use document flow rather than a nested scroll region', searched.scrollers.length === 0,
     searched.scrollers.join(' | '));
  await page.screenshot({ path: path.join(shots, 'session-chrome-search.png') });
  await page.getByRole('button', { name: 'Clear conversation search', exact: true }).click();
  await page.waitForFunction(() => !window.Alpine.$data(document.querySelector('#mount > div')).findQuery);
  await page.evaluate(() => scrollTo(0, 99999));
  await page.waitForTimeout(300);
  const cleared = await geometry();
  ok('clear restores the outline and its correctly offset timeline',
     await page.locator('[x-ref="outline"]').isVisible()
       && cleared.rail?.h > 0 && Math.abs(cleared.rail.top - cleared.chrome.bottom) <= 1,
     JSON.stringify({ rail: cleared.rail, chrome: cleared.chrome }));

  await page.locator('[x-ref="chrome"]').getByRole('tab', { name: /^Raw/ }).click();
  await page.locator('[x-ref="raw"] .json-explorer').waitFor();
  await page.screenshot({ path: path.join(shots, 'session-chrome-raw-tree.png') });
  await page.locator('[x-ref="raw"]').getByRole('tab', { name: /Raw$/ }).click({ timeout: 5000 })
    .catch(async error => {
      console.log('Raw diagnostic:', await page.locator('[x-ref="raw"]').ariaSnapshot());
      console.log('Browser errors:', errors);
      throw error;
    });
  await page.locator('[x-ref="raw"] pre').waitFor();
  await page.waitForTimeout(400);
  const raw = await geometry();
  ok('Raw clamps the record instead of laying it out as one long page',
     raw.doc.h < raw.view.h * 3, `doc ${raw.doc.h} (the regression: 40,528)`);
  ok('Raw scrolls the code inside its own box, under the chrome',
     raw.scrollers.length === 1, `scrollers: ${raw.scrollers.join(' | ') || 'none'}`);
  ok('Raw updates the chrome measurement after hiding conversation search',
     raw.search?.h === 0 && raw.chrome.h < cleared.chrome.h
       && Math.abs(raw.chromeH - raw.chrome.h) <= 1,
     JSON.stringify({ search: raw.search, chrome: raw.chrome, chromeH: raw.chromeH }));
  await page.screenshot({ path: path.join(shots, 'session-chrome-raw.png') });
  ok('no uncaught browser errors', errors.length === 0, errors.join(' | '));
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}

console.log(`\n${checks} checks, ${failures.length} failures`);
if (failures.length) process.exitCode = 1;
