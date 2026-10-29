#!/usr/bin/env node
// pages/session.html keeps its head and chrome on screen while its panes scroll.
//
//   node node/test/session-chrome-flow.mjs
//
// session-brief is boxed: its shell is the viewport's height below the page's
// address bar, and the pane under the tabs scrolls inside it, so the head and
// the tab row stay put. The page has had its scroll shape wrong before: on
// 2026-09-02 a record taller than the viewport was clipped with nothing to
// scroll, and at 390x844 under document scroll Raw laid 243 KB out as a single
// 40,528px block. What is asserted here is where a box LANDS after a pane is
// scrolled to its end, which jsdom and a class-level read cannot see.
//
// Phone width on purpose: the head is tallest there, and a pane squeezed to
// nothing is the failure a phone shows first.
//
// Exits nonzero on any failure. Not part of `npm test` (needs a browser).

import http from 'node:http';
import path from 'node:path';
import zlib from 'node:zlib';
import { readFile, mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { resolveCdn, typeFor } from '../render/cdn.mjs';
import { repoRoot as root } from '../repo-root.mjs';

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

// Where a box sits against the viewport, plus every element that scrolls. The
// second is what says which region a drag moves.
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
  const scrolling = [...document.querySelectorAll('*')]
    .filter(el => el.getBoundingClientRect().height > 0 && el.scrollHeight - el.clientHeight > 4 &&
      /auto|scroll/.test(getComputedStyle(el).overflowY));
  return {
    view: { h: innerHeight, w: innerWidth },
    doc: { h: document.documentElement.scrollHeight, y: Math.round(scrollY),
      w: document.documentElement.scrollWidth },
    title: box(shell?.querySelector('.font-medium.leading-snug')),
    chrome: box(chrome),
    tabs: box(chrome?.querySelector('[role="tablist"]')),
    search: box(chrome?.querySelector('[role="search"]')),
    rail: box(rail),
    raw: box(shell?.querySelector('[x-ref="raw"] .json-explorer')),
    scrollers: scrolling.map(el => ({ cls: (el.className || '').toString().slice(0, 40), ...box(el),
      y: Math.round(el.scrollTop), max: el.scrollHeight - el.clientHeight })),
  };
});
// Scroll every scrolling region below the chrome to its end, as a reader would.
const toEnd = () => page.evaluate(() => {
  const chrome = document.querySelector('[x-ref="chrome"]').getBoundingClientRect();
  for (const el of document.querySelectorAll('*')) {
    if (el.scrollHeight - el.clientHeight > 4 && /auto|scroll/.test(getComputedStyle(el).overflowY)
        && el.getBoundingClientRect().top >= chrome.bottom - 1) el.scrollTop = el.scrollHeight;
  }
});
const below = (g) => g.scrollers.filter(s => s.top >= g.chrome.bottom - 1);

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
  // The head finishes after the first card, from reads and kits that arrive
  // later. Read nothing until the network is idle and the chrome has held its
  // place.
  await page.waitForLoadState('networkidle');
  await page.waitForFunction(() => {
    const t = Math.round(document.querySelector('[x-ref="chrome"]').getBoundingClientRect().top);
    const still = window.__chromeTop === t;
    window.__chromeTop = t;
    return still;
  }, null, { polling: 500, timeout: 10000 });
  const input = page.getByRole('searchbox', { name: 'Find in conversation', exact: true });

  const top = await geometry();
  ok('the document does not scroll: the shell fits the viewport',
     top.doc.h <= top.view.h + 1, `doc ${top.doc.h} vs view ${top.view.h}`);
  ok('the phone page has no horizontal overflow', top.doc.w <= top.view.w + 1,
     `${top.doc.w} vs ${top.view.w}`);
  const turns = below(top);
  ok('the turns scroll in one region below the chrome, with a scroll to test',
     turns.length === 1 && turns[0].max > 200, JSON.stringify(top.scrollers));
  ok('the turns keep a share of the screen', turns[0]?.h >= top.view.h * 0.25,
     `${turns[0]?.h} of ${top.view.h}`);

  await toEnd();
  await page.waitForTimeout(400);
  const bottom = await geometry();
  ok('scrolled to the end, the turns moved and the chrome did not',
     below(bottom)[0]?.y > 200 && Math.abs(bottom.chrome.top - top.chrome.top) <= 1,
     `turns at ${below(bottom)[0]?.y}, chrome ${top.chrome.top} then ${bottom.chrome.top}`);
  ok('the head is still on screen', bottom.title?.h > 0 && bottom.title.top >= 0,
     JSON.stringify(bottom.title));
  ok('the timeline rail stays at the top of the pane',
     bottom.rail?.h > 0 && Math.abs(bottom.rail.top - top.rail.top) <= 1,
     `rail ${top.rail?.top} then ${bottom.rail?.top}`);
  await page.screenshot({ path: path.join(shots, 'session-chrome-outline.png') });

  // Search, keeping enough hits that the results still have a real scroll. The
  // field is closed behind the search icon until it is asked for.
  ok('the find field waits behind its icon', !(await input.isVisible()));
  await page.getByRole('button', { name: 'Find in conversation', exact: true }).click();
  await input.fill('Reply');
  await page.waitForFunction(() => document.querySelectorAll('[data-session-match]').length === 12);
  await toEnd();
  await page.waitForTimeout(300);
  const searched = await geometry();
  ok('search results scroll in their own pane and the controls stay put',
     searched.doc.h <= searched.view.h + 1 && Math.abs(searched.chrome.top - top.chrome.top) <= 1
       && searched.search.h > 0 && searched.search.bottom <= searched.view.h
       && below(searched)[0]?.y > 0,
     JSON.stringify({ chrome: searched.chrome, search: searched.search, scrollers: searched.scrollers }));
  await page.screenshot({ path: path.join(shots, 'session-chrome-search.png') });
  await page.getByRole('button', { name: 'Clear conversation search', exact: true }).click();
  await page.waitForFunction(() => !window.Alpine.$data(document.querySelector('#mount > div')).findQuery);
  await page.waitForTimeout(300);
  const cleared = await geometry();
  ok('clear restores the outline and its rail',
     await page.locator('[x-ref="outline"]').isVisible() && cleared.rail?.h > 0,
     JSON.stringify({ rail: cleared.rail }));

  await page.locator('[x-ref="chrome"]').getByRole('tab', { name: /^Raw/ }).click();
  await page.locator('[x-ref="raw"] .json-explorer').waitFor();
  await page.screenshot({ path: path.join(shots, 'session-chrome-raw-tree.png') });
  await page.locator('[x-ref="raw"]').getByRole('tab', { name: /^JSON$/ }).click({ timeout: 5000 })
    .catch(async error => {
      console.log('Raw diagnostic:', await page.locator('[x-ref="raw"]').ariaSnapshot());
      console.log('Browser errors:', errors);
      throw error;
    });
  await page.locator('[x-ref="raw"] pre').waitFor();
  await page.waitForTimeout(400);
  const raw = await geometry();
  ok('Raw clamps the record instead of laying it out as one long page',
     raw.doc.h <= raw.view.h + 1, `doc ${raw.doc.h} (the regression: 40,528)`);
  ok('Raw scrolls the code inside its own box, under the chrome',
     below(raw).length === 1, JSON.stringify(raw.scrollers));
  await page.screenshot({ path: path.join(shots, 'session-chrome-raw.png') });
  ok('no uncaught browser errors', errors.length === 0, errors.join(' | '));
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}

console.log(`\n${checks} checks, ${failures.length} failures`);
if (failures.length) process.exitCode = 1;
