#!/usr/bin/env node
// Regenerate pages-gallery thumbnails for ANOTHER repo's `pages` catalog, into
// the web-tools-private thumb cache. The web-tools sibling of pages-shots.mjs:
// that one shoots this repo's own pages/ tree into pages/thumbs/ (committed,
// public); this one shoots a different repo's declared `pages` (its
// .web-tools.json catalog) into a private cache show-repo reads token-gated.
//
//   node tools/build/repo-pages-shots.mjs --repo <owner/name> --root <checkout> \
//        --out <thumbs-dir> [page-path ...]
//
//   --repo   the source repo the catalog belongs to (e.g. mehrlander/home)
//   --root   a local checkout of that repo (its .web-tools.json is read here)
//   --out    the thumb cache root to write into (e.g. ../web-tools-private/thumbs)
//   [paths]  optional: only shoot these catalog page paths (default: all local ones)
//
// Output: <out>/<owner>/<repo>/<page-path>.png, one 16:10 PNG per catalog page,
// so the gallery's cache lookup is a pure function of repo + page path. Only
// catalog entries whose target resolves to --repo are shot; a cross-repo entry
// (owner/repo:path pointing elsewhere) belongs to that repo's own shoot and is
// logged and skipped here.
//
// The page is served from --root over loopback; its own relative deps resolve
// same-origin against that tree, and third-party CDN libs are vendored from THIS
// repo's node_modules through the shared resolver (tools/render/cdn.mjs). So the
// source repo needs no node_modules of its own; it only needs to be checked out.
// A page whose bare URL paints an auth/empty state can declare the query string
// of its representative shot with <meta name="shot-query" content="k=v&...">.

import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { resolveCdn, typeFor } from '../render/cdn.mjs';

const WIDTH = 1000, HEIGHT = 625;            // 16:10, matches pages-shots + the card aspect
const WAIT = 3000;                            // let the CDN libs + Alpine + data settle

// node_modules (the vendored libs) lives at this repo's root, regardless of which
// repo's pages we are shooting.
const webToolsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function parseArgs(argv) {
  const o = { repo: '', root: '', out: '', pages: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--repo') o.repo = argv[++i];
    else if (a === '--root') o.root = argv[++i];
    else if (a === '--out') o.out = argv[++i];
    else o.pages.push(a);
  }
  return o;
}

// Mirror of show-repo's resolveCatalogPath: an entry path is either a bare
// in-repo path or an `owner/repo[@ref]:path` cross-repo address.
function resolveCatalogPath(rawPath, declRepo) {
  const m = String(rawPath || '').match(/^([\w.-]+\/[\w.-]+)(?:@([\w./-]+))?:(.+)$/);
  if (m) return { repo: m[1], ref: m[2] || '', path: m[3] };
  return { repo: declRepo, ref: '', path: rawPath };
}

const opts = parseArgs(process.argv.slice(2));
if (!opts.repo || !opts.root || !opts.out) {
  console.error('Usage: node tools/build/repo-pages-shots.mjs --repo <owner/name> --root <checkout> --out <thumbs-dir> [page-path ...]');
  process.exit(2);
}
const sourceRoot = path.resolve(opts.root);
const outRoot = path.resolve(opts.out);

const manifestPath = path.join(sourceRoot, '.web-tools.json');
if (!existsSync(manifestPath)) {
  console.error(`No .web-tools.json at ${manifestPath}`);
  process.exit(2);
}
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const catalog = Array.isArray(manifest.pages) ? manifest.pages : [];
if (!catalog.length) {
  console.error(`${opts.repo} declares no \`pages\` catalog; nothing to shoot.`);
  process.exit(1);
}

// Keep the local, this-repo entries; note the cross-repo ones so the skip is visible.
const targets = [];
for (const entry of catalog) {
  if (!entry || !entry.path) continue;
  const t = resolveCatalogPath(entry.path, opts.repo);
  if (t.repo !== opts.repo) { console.log(`skip (cross-repo) ${entry.path}`); continue; }
  if (opts.pages.length && !opts.pages.includes(t.path)) continue;
  const abs = path.join(sourceRoot, t.path);
  if (!existsSync(abs)) { console.log(`skip (missing) ${t.path}`); continue; }
  targets.push({ path: t.path, abs });
}
if (!targets.length) { console.error('No shootable pages resolved.'); process.exit(1); }

// One loopback server rooted at the source checkout, reused across pages. The
// requested page is served with the same raw path its <script src> deps expect.
const server = http.createServer(async (req, res) => {
  try {
    const reqPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const fp = path.join(sourceRoot, reqPath);
    if (!fp.startsWith(sourceRoot)) { res.writeHead(403).end(); return; }
    const body = await readFile(fp);
    res.writeHead(200, { 'Content-Type': typeFor(fp) });
    res.end(body);
  } catch (e) {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end(String(e.message || e));
  }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const browser = await chromium.launch({ args: ['--no-sandbox', '--ignore-certificate-errors'] });
const results = [];
for (const t of targets) {
  const [owner, name] = opts.repo.split('/');
  const out = path.join(outRoot, owner, name, t.path.replace(/\.html?$/, '.png'));
  await mkdir(path.dirname(out), { recursive: true });
  process.stdout.write(`shooting ${opts.repo}:${t.path} ... `);

  const html = await readFile(t.abs, 'utf8');
  const q = html.match(/<meta\s+name="shot-query"\s+content="([^"]*)"/);
  const errorLines = [];

  const ctx = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT } });
  const page = await ctx.newPage();
  // Loopback stays local; every other request is vendored from THIS repo's
  // node_modules by the shared resolver (own-code impersonation is inert for a
  // foreign page, which loads its deps relative + off the CDN).
  await page.route('**/*', route => {
    const url = route.request().url();
    if (url.startsWith(`http://127.0.0.1:${port}`)) return route.continue();
    const r = resolveCdn(url, webToolsRoot, null);
    if (r.kind === 'continue') return route.continue();
    if (r.kind === 'empty') return route.fulfill({ status: 200, contentType: r.contentType, body: '' });
    return route.fulfill({ status: 200, contentType: r.contentType, body: r.body });
  });
  page.on('pageerror', e => errorLines.push(`[pageerror] ${e.message}`));

  const pageUrlPath = '/' + t.path.split(path.sep).join('/');
  const target = `http://127.0.0.1:${port}${pageUrlPath}${q ? '?' + q[1] : ''}`;
  let ok = false;
  try {
    await page.goto(target, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(WAIT);
    await page.screenshot({ path: out, fullPage: false });
    ok = true;
  } catch (e) {
    errorLines.push(`[fatal] ${e.message}`);
  } finally {
    await ctx.close();
  }
  console.log(ok ? 'ok' : 'FAILED');
  results.push({ path: t.path, out, ok, errors: errorLines });
}
await browser.close();
server.close();

console.log(`\n=== repo-pages-shots ${opts.repo}: ${results.filter(r => r.ok).length}/${results.length} ok ===`);
for (const r of results) {
  const rel = path.relative(process.cwd(), r.out);
  if (!r.ok) console.log(`  FAILED  ${r.path}`);
  else console.log(`  ${rel}${r.errors.length ? `  (${r.errors.length} page error(s))` : ''}`);
}
process.exit(results.every(r => r.ok) ? 0 : 1);
