#!/usr/bin/env node
// Headless preview harness.
//
// Loads a page from this repo in headless Chromium, intercepts any HTTP
// fetch that would resolve to repo content (jsdelivr/gh or GitHub contents
// API) and serves it from the local working tree instead. Captures console
// output, page errors, failed requests, the rendered DOM, and a screenshot.
//
// Usage:
//   node tools/preview.mjs <page-path>
//
// Outputs land under tools/.preview/ (gitignored).

import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = 'mehrlander/web-tools';
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const arg = process.argv[2];
if (!arg) {
  console.error('Usage: node tools/preview.mjs <page-path>');
  process.exit(2);
}

const pageAbs = path.resolve(repoRoot, arg);
if (!existsSync(pageAbs)) {
  console.error(`Page not found: ${pageAbs}`);
  process.exit(2);
}

const outDir = path.join(repoRoot, 'tools', '.preview');
await mkdir(outDir, { recursive: true });
const baseName = path.basename(arg, path.extname(arg));
const screenshotPath = path.join(outDir, `${baseName}.png`);
const htmlPath = path.join(outDir, `${baseName}.html`);
const logPath = path.join(outDir, `${baseName}.log`);

function contentTypeFor(p) {
  const ext = path.extname(p).toLowerCase();
  if (ext === '.js' || ext === '.mjs') return 'application/javascript; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  return 'text/plain; charset=utf-8';
}

// Resolve a URL to a path in the local working tree, or null if it's not
// one of our repo-content URLs.
function resolveLocalPath(urlStr) {
  const url = new URL(urlStr);

  // jsdelivr GH: cdn.jsdelivr.net/gh/<owner>/<repo>[@ref]/<path>
  if (url.host === 'cdn.jsdelivr.net' && url.pathname.startsWith(`/gh/${REPO}`)) {
    const tail = url.pathname.slice(`/gh/${REPO}`.length).replace(/^@[^/]+/, '');
    return { kind: 'raw', filePath: path.join(repoRoot, decodeURIComponent(tail)) };
  }

  // raw.githubusercontent.com/<owner>/<repo>/<ref>/<path>
  if (url.host === 'raw.githubusercontent.com' && url.pathname.startsWith(`/${REPO}/`)) {
    const tail = url.pathname.slice(`/${REPO}/`.length).split('/').slice(1).join('/');
    return { kind: 'raw', filePath: path.join(repoRoot, decodeURIComponent(tail)) };
  }

  // GitHub contents API: api.github.com/repos/<owner>/<repo>/contents/<path>
  if (url.host === 'api.github.com' && url.pathname.startsWith(`/repos/${REPO}/contents/`)) {
    const tail = url.pathname.slice(`/repos/${REPO}/contents/`.length);
    return { kind: 'contents-api', filePath: path.join(repoRoot, decodeURIComponent(tail)) };
  }

  return null;
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });

// Seed a fake token so any code that fishes for one finds the sentinel
// rather than throwing or trying to prompt.
await ctx.addInitScript(() => {
  try { localStorage.setItem('ghToken', '\u{1F39F}️GitHubToken-test'); } catch {}
});

const page = await ctx.newPage();

const messages = [];
const errors = [];
page.on('console', msg => messages.push(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', err => errors.push(`[pageerror] ${err.message}\n${err.stack || ''}`));
page.on('requestfailed', req => {
  // Ignore failures we caused on purpose by 404'ing unknown intercepts.
  const f = req.failure()?.errorText || '';
  errors.push(`[requestfailed] ${req.url()} :: ${f}`);
});

const intercepted = [];
async function handleRoute(route) {
  const target = resolveLocalPath(route.request().url());
  if (!target) return route.continue();
  if (!existsSync(target.filePath)) {
    intercepted.push(`MISS ${route.request().url()} -> ${target.filePath}`);
    return route.fulfill({ status: 404, body: 'not found locally' });
  }
  const text = await readFile(target.filePath, 'utf8');
  intercepted.push(`HIT  ${route.request().url()} -> ${path.relative(repoRoot, target.filePath)}`);
  if (target.kind === 'contents-api') {
    return route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify({
        content: Buffer.from(text).toString('base64'),
        sha: 'local',
        size: text.length,
        html_url: '',
        encoding: 'base64',
      }),
    });
  }
  return route.fulfill({
    status: 200,
    contentType: contentTypeFor(target.filePath),
    body: text,
  });
}

await page.route('**/cdn.jsdelivr.net/gh/**', handleRoute);
await page.route('**/raw.githubusercontent.com/**', handleRoute);
await page.route('**/api.github.com/repos/**', handleRoute);

const pageUrl = pathToFileURL(pageAbs).href;
try {
  await page.goto(pageUrl, { waitUntil: 'load', timeout: 15000 });
} catch (e) {
  errors.push(`[goto] ${e.message}`);
}

// Give Alpine a beat to mount any components.
await page.waitForTimeout(1200);

const html = await page.content();
await page.screenshot({ path: screenshotPath, fullPage: true });
await writeFile(htmlPath, html);

const summary = [
  `=== preview: ${arg} ===`,
  `screenshot: ${path.relative(repoRoot, screenshotPath)}`,
  `html:       ${path.relative(repoRoot, htmlPath)}`,
  '',
  `--- intercepts (${intercepted.length}) ---`,
  ...intercepted,
  '',
  `--- console (${messages.length}) ---`,
  ...messages,
  '',
  `--- errors (${errors.length}) ---`,
  ...errors,
].join('\n');

console.log(summary);
await writeFile(logPath, summary);

await browser.close();
process.exit(errors.length > 0 ? 1 : 0);
