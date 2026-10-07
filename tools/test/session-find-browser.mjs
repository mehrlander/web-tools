#!/usr/bin/env node
// The real shared session reader: find a passage, read its exchange, and
// reopen its copied address. Synthetic records only; no token or network.
// Run: node tools/test/session-find-browser.mjs
// Browser checks stay outside npm test. Screenshots: tools/.preview/.
import http from 'node:http';
import path from 'node:path';
import zlib from 'node:zlib';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { resolveCdn, typeFor } from '../render/cdn.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const shots = path.join(root, 'tools/.preview');
await mkdir(shots, { recursive: true });
const failures = [];
let checks = 0;
const ok = (name, condition, detail = '') => {
  checks++;
  console.log(`  ${condition ? 'ok  ' : 'FAIL'} ${name}${!condition && detail ? ': ' + detail : ''}`);
  if (!condition) failures.push(name);
};
const at = i => new Date(Date.UTC(2026, 9, 4, 10, i)).toISOString();
const record = {
  schema: 14, short: 'fa12ce34', day: '2026-10-04', started: at(0), ended: at(120),
  opening_ask: 'Recover the discussion behind a change.', exchanges: 12,
  prompts_stored: 12, replies_stored: 12, calls_total: 2,
  repos: [{ name: 'web-tools', branch: 'codex/session-find-example' }],
  files: { 'web-tools/example/session-find.md': { read: 2 } },
  prompts: Array.from({ length: 12 }, (_, i) => ({ at: at(i * 10), text: [
    'Recover the discussion behind a change.',
    'Keep the existing session reader and its card addresses.',
    'Where did we discuss cobalt highlighting? The preview should show the words I actually used.',
    'Make results comfortable to read on a narrow phone.',
    'Preserve the link to the captured record.',
    'What did the assistant recommend for the second example?',
    'Use the same result when opening the page from the app.',
    'The clipboard should preserve the query and exact exchange.',
    'Bring cobalt and orchard together in one useful example.',
    'Keep Unicode source text: İstanbul, café, and 👩🏽‍💻.',
    'Tool output should not be mistaken for our discussion.',
    'Treat literal markup as text: <img src=x onerror=window.__sessionFindInjected=1> harmless-markup '
      + 'unbrokenidentifier'.repeat(20),
  ][i] })),
  replies: Array.from({ length: 12 }, (_, i) => ({ at: at(i * 10 + 5), text:
    i === 5 ? 'The orchard example belongs in the captured assistant reply. A click should open this sixth exchange.'
      : `Reply ${i + 1}. The source stays available in its original conversation and the reader keeps its place.` })),
  calls: [
    { at: at(56), name: 'Bash', ok: true, arg: 'echo checked', body: 'checked' },
    { at: at(106), name: 'Bash', ok: true, arg: 'echo toolonlysignal', body: 'toolonlysignal' },
  ],
};
const gz = zlib.gzipSync(Buffer.from(JSON.stringify(record))).toString('base64url');

const server = http.createServer(async (req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '');
  const target = path.resolve(root, rel);
  if (!target.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
  try {
    const body = await readFile(target);
    res.writeHead(200, { 'content-type': typeFor(rel) }); res.end(body);
  }
  catch { res.writeHead(404); res.end('not found'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
const runtimeErrors = [];
try {
  browser = await chromium.launch({ args: ['--no-sandbox', '--ignore-certificate-errors'],
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
  for (const [width, theme] of [[1280, 'winter'], [390, 'winter'], [320, 'dark']]) {
    console.log(`\n${width}px / ${theme}`);
    const context = await browser.newContext({ viewport: { width, height: 900 },
      permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await context.newPage();
    page.on('pageerror', error => runtimeErrors.push(`${width}: ${error.message}`));
    await page.route('**/*', route => {
      const url = route.request().url();
      if (url.startsWith(origin)) return route.continue();
      // The gz fixture never needs another repository, including a sibling
      // private checkout the normal render resolver would otherwise serve.
      if (url.startsWith('https://api.github.com/')
          && !url.startsWith('https://api.github.com/repos/mehrlander/web-tools/')) {
        return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
      }
      const resolved = resolveCdn(url, root, null);
      if (resolved.kind === 'continue') return route.abort();
      return route.fulfill({ status: 200, contentType: resolved.contentType,
        body: resolved.kind === 'empty' ? '' : resolved.body });
    });
    const url = `${origin}/pages/session.html#gz=${gz}&find=cobalt%20orchard`;
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelectorAll('[data-session-match]').length === 3,
      { timeout: 30000 });
    await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
    const input = page.getByRole('searchbox', { name: 'Find in conversation', exact: true });
    const state = () => page.evaluate(() => {
      const el = document.querySelector('#mount > div');
      const data = window.Alpine.$data(el);
      return { query: data.findQuery, at: data.findAt, hits: data.findResult.hits.map(h => h.card),
        total: data.findResult.total, pane: data.pane };
    });
    const overflow = () => page.evaluate(() => ({ width: innerWidth,
      document: document.documentElement.scrollWidth,
      results: document.querySelector('[data-session-find]')?.scrollWidth,
      resultBox: Math.round(document.querySelector('[data-session-find]')?.getBoundingClientRect().width || 0) }));
    const initial = await state();
    ok('address query finds the three source exchanges', JSON.stringify(initial.hits) === '[2,5,8]');
    ok('distributed terms stay labelled on their own exchanges',
      await page.locator('[data-session-match="2"]').innerText().then(t => t.includes('Matches:') && t.includes('cobalt'))
      && await page.locator('[data-session-match="5"]').innerText().then(t => t.includes('Assistant') && t.includes('orchard')));
    await input.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(shots, `session-find-${width}-${theme}.png`), fullPage: true });
    const before = await overflow();
    ok('search fits the viewport', before.document <= width + 1 && before.results <= before.resultBox + 1,
      JSON.stringify(before));

    await input.press('Enter');
    await page.waitForFunction(() => window.Alpine.$data(document.querySelector('#mount > div')).findAt === 1);
    await input.press('Shift+Enter');
    ok('Enter and Shift+Enter move between matches', (await state()).at === 0);
    await page.getByRole('button', { name: 'Previous matching exchange', exact: true }).click();
    ok('previous wraps to the last matching exchange', (await state()).at === 2);
    await page.getByRole('button', { name: 'Next matching exchange', exact: true }).click();
    ok('next wraps back to the first matching exchange', (await state()).at === 0);

    await page.getByRole('button', { name: 'Read exchange 6', exact: true }).click();
    await page.waitForFunction(() => {
      const deck = window.swipeDeck?.top?.()?.deck;
      return deck && Math.round(deck.track.scrollLeft / deck.track.clientWidth) === 5;
    });
    ok('a result opens its actual exchange card', true);
    const revealed = await page.evaluate(() => {
      const track = window.swipeDeck.top().deck.track;
      const slide = track.children[5];
      const prose = slide.querySelector('[data-session-prose-match="true"]');
      const bounds = prose?.getBoundingClientRect();
      return { shown: !!bounds && bounds.height > 0 && bounds.bottom > 0 && bounds.top < innerHeight,
        text: prose?.textContent || '',
        repeats: (slide.textContent.match(/The orchard example belongs/g) || []).length,
        openTools: slide.querySelectorAll('details[open]').length };
    });
    ok('matching assistant prose is revealed once with tool details folded',
      revealed.shown && revealed.text.includes('orchard') && revealed.repeats === 1 && revealed.openTools === 0,
      JSON.stringify(revealed));
    await page.goBack();
    await page.waitForFunction(() => !window.swipeDeck?.top?.());
    ok('browser Back returns to the same query and selected result',
      (await state()).query === 'cobalt orchard' && (await state()).at === 1);

    await page.getByRole('button', { name: 'Copy link to exchange 6', exact: true }).click();
    await page.getByRole('button', { name: 'Exchange link copied', exact: true }).waitFor();
    const copied = new URL(await page.evaluate(() => navigator.clipboard.readText()));
    const params = new URLSearchParams(copied.hash.slice(1));
    ok('copied link preserves gz, card, and find',
      params.get('gz') === gz && params.get('card') === '5' && params.get('find') === 'cobalt orchard');
    copied.protocol = 'http:'; copied.host = new URL(origin).host;
    copied.pathname = copied.pathname.replace(/^\/web-tools\//, '/');
    await page.goto(copied.href, { waitUntil: 'domcontentloaded' });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      const d = window.swipeDeck?.top?.()?.deck;
      return d && Math.round(d.track.scrollLeft / d.track.clientWidth) === 5;
    }).catch(async error => {
      console.log('Copied address diagnostic:', await page.evaluate(() => ({
        path: location.pathname,
        card: new URLSearchParams(location.hash.slice(1)).get('card'),
        body: document.body.innerText.slice(-900),
        deck: !!window.swipeDeck?.top?.(),
        source: document.querySelector('#mount > div')?.getAttribute('x-data'),
      })));
      await page.screenshot({ path: path.join(shots, 'session-find-reopen-failure.png'), fullPage: true });
      throw error;
    });
    ok('copied address reopens the exact sixth exchange', true);
    await page.getByRole('button', { name: 'Close', exact: true }).last().click();
    await page.waitForFunction(() => !window.swipeDeck?.top?.());

    for (const pane of ['Files', 'Raw', 'Outline']) {
      await page.getByRole('tab', { name: new RegExp('^' + pane) }).click();
      await page.waitForFunction(p => window.Alpine.$data(document.querySelector('#mount > div')).pane === p,
        pane.toLowerCase());
    }
    ok('Files and Raw return to the preserved conversation search',
      (await state()).query === 'cobalt orchard' && await input.isVisible());
    await input.fill('toolonlysignal');
    await page.waitForFunction(() => window.Alpine.$data(document.querySelector('#mount > div')).findQuery === 'toolonlysignal');
    ok('tool-only text does not become a conversation hit',
      (await state()).hits.length === 0 && await page.getByText('No matching captured exchanges', { exact: true }).isVisible());
    await input.fill('harmless-markup');
    await page.waitForFunction(() => document.querySelectorAll('[data-session-match]').length === 1);
    const safe = await page.locator('[data-session-find]').evaluate(el => ({
      text: el.textContent, images: el.querySelectorAll('img').length,
      executed: window.__sessionFindInjected || 0 }));
    ok('source HTML remains literal text', safe.text.includes('<img src=x') && !safe.images && !safe.executed);
    await input.fill('<img');
    await page.waitForFunction(() => window.Alpine.$data(document.querySelector('#mount > div')).findQuery === '<img');
    ok('HTML-like query highlights text without creating elements',
      await page.locator('[data-session-find]').evaluate(el =>
        el.textContent.includes('<img') && !el.querySelector('img') && !window.__sessionFindInjected));
    const narrow = await overflow();
    ok('long source text wraps without horizontal overflow',
      narrow.document <= width + 1 && narrow.results <= narrow.resultBox + 1, JSON.stringify(narrow));
    await input.press('Escape');
    await page.waitForFunction(() => !window.Alpine.$data(document.querySelector('#mount > div')).findQuery);
    ok('Escape clears search and restores the outline',
      await page.locator('[x-ref="outline"]').isVisible() && await input.inputValue() === '');
    await context.close();
  }
  ok('no uncaught browser errors', runtimeErrors.length === 0, runtimeErrors.join(' | '));
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
console.log(`\n${checks} checks, ${failures.length} failures`);
if (failures.length) process.exitCode = 1;
