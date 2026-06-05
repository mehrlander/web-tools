#!/usr/bin/env node
// Headless preview harness. Loads a page from the working tree under JSDOM,
// intercepts every external <script>/<link> URL that resolves to repo
// content (jsdelivr /gh/, raw.githubusercontent.com, GitHub contents API)
// and serves it from local files instead. Then waits for Alpine to mount
// and reports which x-data containers actually got their template injected
// by their component's init().
//
// Usage:
//   node tools/preview.mjs <page-path>
//
// Outputs (HTML dump + log) land under tools/.preview/ (gitignored).

import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import jsdomPkg from 'jsdom';
import 'fake-indexeddb/auto';

const { JSDOM, VirtualConsole, requestInterceptor } = jsdomPkg;

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
const htmlPath = path.join(outDir, `${baseName}.html`);
const logPath = path.join(outDir, `${baseName}.log`);

const intercepts = [];

function jsResponse(buf) {
  return new Response(buf, {
    status: 200,
    headers: { 'Content-Type': 'application/javascript; charset=utf-8' },
  });
}
function emptyResponse(contentType = 'application/javascript; charset=utf-8') {
  return new Response('', { status: 200, headers: { 'Content-Type': contentType } });
}
function jsonResponse(obj) {
  return new Response(JSON.stringify(obj), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

// Some kit files use top-level `await import(...)` of remote ESM modules.
// JSDOM's script VM has no dynamic-import callback, so those throw. For
// harness purposes we replace them with self-contained stubs that expose
// the same window.* surface (in-memory persistence, no-op compression).
const STUB_KITS = {
  'lib/kits/persistence.js': `
    (() => {
      const mem = new Map();
      const save = async (path, value) => { mem.set(path, value); };
      const load = async (path) => mem.get(path) ?? null;
      const remove = async (path) => { mem.delete(path); };
      const list = async () => [...mem.keys()];
      window.persistence = { save, load, remove, list };
    })();`,
  'lib/kits/compression.js': `
    (() => {
      const noop = async () => '';
      const text = {
        detectCompressionType: () => null,
        findCompressedChunks: () => [],
        templates: {},
        assess: async () => ({}),
        pack: async (s) => s,
        process: async (input, opts = {}) => ({
          isCompressed: false,
          output: input || '',
          packingSegments: [{ t: 'payload', v: input || '' }],
          sizes: { raw: (input || '').length, brotli: 0, gzip: 0 },
          outSize: (input || '').length,
        }),
      };
      const acorn = { parse: () => null, isJS: async () => false };
      window.compression = {
        brotli: { compress: noop, decompress: noop, detect: () => null, findChunks: () => [] },
        gzip:   { compress: noop, decompress: noop, detect: () => null, findChunks: () => [], sizeOf: () => 0 },
        acorn,
        text,
      };
    })();`,
};

function resolveRequest(request) {
  const u = new URL(request.url);

  // Repo content via jsdelivr GH (with optional @ref)
  if (u.host === 'cdn.jsdelivr.net' && u.pathname.startsWith(`/gh/${REPO}`)) {
    const tail = u.pathname.slice(`/gh/${REPO}`.length).replace(/^@[^/]+/, '');
    const relPath = decodeURIComponent(tail).replace(/^\//, '');
    if (STUB_KITS[relPath]) {
      intercepts.push(`STUB ${request.url}`);
      return jsResponse(Buffer.from(STUB_KITS[relPath]));
    }
    const fp = path.join(repoRoot, relPath);
    if (existsSync(fp)) {
      intercepts.push(`HIT  ${request.url} -> ${path.relative(repoRoot, fp)}`);
      return jsResponse(readFileSync(fp));
    }
    intercepts.push(`MISS ${request.url} -> ${fp}`);
    return new Response('', { status: 404 });
  }

  // Raw GitHub
  if (u.host === 'raw.githubusercontent.com' && u.pathname.startsWith(`/${REPO}/`)) {
    const tail = u.pathname.slice(`/${REPO}/`.length).split('/').slice(1).join('/');
    const fp = path.join(repoRoot, decodeURIComponent(tail));
    if (existsSync(fp)) {
      intercepts.push(`HIT  ${request.url} -> ${path.relative(repoRoot, fp)}`);
      return jsResponse(readFileSync(fp));
    }
  }

  // GitHub contents API: respond with base64-encoded payload
  if (u.host === 'api.github.com' && u.pathname.startsWith(`/repos/${REPO}/contents/`)) {
    const tail = u.pathname.slice(`/repos/${REPO}/contents/`.length);
    const fp = path.join(repoRoot, decodeURIComponent(tail));
    if (existsSync(fp)) {
      const text = readFileSync(fp, 'utf8');
      intercepts.push(`HIT  ${request.url} -> ${path.relative(repoRoot, fp)} (api)`);
      return jsonResponse({
        content: Buffer.from(text).toString('base64'),
        sha: 'local',
        size: text.length,
        html_url: '',
        encoding: 'base64',
      });
    }
    return new Response('not found', { status: 404 });
  }

  // Alpine core + plugins — serve from node_modules. A bare `alpinejs` path is
  // the core; `@alpinejs/<plugin>` (collapse, sort) is that plugin's build. The
  // old `includes('alpinejs')` test matched `@alpinejs/collapse` too and served
  // the full core for it, loading Alpine twice; match the plugin explicitly.
  if (u.host === 'unpkg.com' && /(^|\/)(@alpinejs\/[^/]+|alpinejs)(@[^/]*)?\/?$/.test(u.pathname)) {
    const plug = u.pathname.match(/@alpinejs\/([^/@]+)/);
    const rel = plug ? `node_modules/@alpinejs/${plug[1]}/dist/cdn.min.js`
                     : 'node_modules/alpinejs/dist/cdn.min.js';
    const fp = path.join(repoRoot, rel);
    if (existsSync(fp)) {
      intercepts.push(`HIT  ${request.url} -> ${rel}`);
      return jsResponse(readFileSync(fp));
    }
    intercepts.push(`MISS ${request.url} -> ${fp}`);
    return new Response('', { status: 404 });
  }

  // idb-keyval ESM (used by lib/kits/persistence.js dynamic import)
  if (u.host === 'cdn.jsdelivr.net' && u.pathname.includes('idb-keyval')) {
    const fp = path.join(repoRoot, 'node_modules/idb-keyval/dist/index.js');
    intercepts.push(`HIT  ${request.url} -> node_modules/idb-keyval/dist/index.js`);
    return jsResponse(readFileSync(fp));
  }

  // Tailwind / Phosphor / daisyUI — irrelevant for a DOM-correctness check.
  intercepts.push(`SKIP ${request.url}`);
  return emptyResponse();
}

const consoleLines = [];
const errorLines = [];
const vc = new VirtualConsole();
['log', 'info', 'warn', 'debug'].forEach(level => {
  vc.on(level, (...args) => consoleLines.push(`[${level}] ${args.map(formatArg).join(' ')}`));
});
vc.on('error', (...args) => errorLines.push(`[error] ${args.map(formatArg).join(' ')}`));
vc.on('jsdomError', err => errorLines.push(`[jsdomError] ${err.message}`));

function formatArg(a) {
  if (a instanceof Error) return a.stack || a.message;
  if (typeof a === 'object') { try { return JSON.stringify(a); } catch { return String(a); } }
  return String(a);
}

// Survive a page that throws. A page's async failure (e.g. cm6's esm.sh module
// imports, which jsdom can't do) surfaces as an uncaught exception / unhandled
// rejection at the Node level; without these the harness would die mid-render
// instead of recording the error and finishing — the Chromium `shot` path stays
// up through the same failures, and preview should too. Page-originated, so we
// record and continue; tool-level problems still show up in the captured errors.
process.on('uncaughtException', e => errorLines.push(`[uncaughtException] ${(e && (e.stack || e.message)) || e}`));
process.on('unhandledRejection', r => errorLines.push(`[unhandledRejection] ${(r && (r.stack || r.message)) || r}`));

// jsdom executes neither module scripts (`<script type="module">`) nor dynamic
// import(). Every gh.load page boots with both: a module block that does
// `await import(<gh-api.js URL>)` then `gh.load(...)`. Rewrite that one block so
// jsdom runs it:
//   1. Inject a classic setup script defining window.__importGhApi(url) — it runs
//      gh-api.js *in the page realm* (via the realm's AsyncFunction so window/
//      document/fetch resolve to jsdom) with its `import.meta.url` set to the
//      passed URL, so the self-bootstrap fires exactly as a real import would,
//      and returns { default: GH } (the module namespace).
//   2. Turn the module block into a classic async IIFE (classic scripts can't use
//      top-level await) with its `import(...)` call rewritten to __importGhApi(...).
// That single substitution covers every boot shape in the repo — both the bare
// `await import(URL)` that leans on the self-bootstrap and the
// `const mod = await import(BOOT); new mod.default(...)` form — because the shim
// reproduces both the side effects and the return value. Everything else in the
// block (the page's gh.load calls, inline alpine:init logic) runs verbatim.
function inlineBoot(rawHtml, ghApiSrc) {
  const blockRe = /<script\b([^>]*\btype=["']module["'][^>]*)>([\s\S]*?)<\/script>/gi;
  let m, block = null;
  while ((m = blockRe.exec(rawHtml))) { if (/gh-api\.js/.test(m[2])) { block = m; break; } }
  if (!block) return { html: rawHtml, transformed: false };

  const [full, , body] = block;
  if (!/\bimport\s*\(/.test(body)) return { html: rawHtml, transformed: false };

  // gh-api source as an AsyncFunction body: export stripped, import.meta.url -> the
  // url param, and a trailing return of the module namespace.
  const ghBody = ghApiSrc
    .replace(/export\s+default\s+class\s+GH/, 'class GH')
    .replace(/import\.meta\.url/g, 'url')
    + '\nreturn { default: GH };';
  const setup =
    `<script>window.__importGhApi=(()=>{` +
    `const AF=(async()=>{}).constructor;` +
    `const fn=new AF('url',${JSON.stringify(ghBody)});` +
    `return u=>fn.call(window,u);})();</script>`;

  const classicBody = body.replace(/\bimport\s*\(/, 'window.__importGhApi(');
  const boot =
    `<script>(async () => {\n${classicBody}\n})().catch(e => {\n` +
    `  (window.__previewBootError ||= []).push(String((e && e.stack) || e));\n});</script>`;

  return { html: rawHtml.replace(full, `${setup}\n${boot}`), transformed: true };
}

const rawHtml = await readFile(pageAbs, 'utf8');
const ghApiSrc = readFileSync(path.join(repoRoot, 'lib/gh-api.js'), 'utf8');
const { html, transformed: bootInlined } = inlineBoot(rawHtml, ghApiSrc);
const dom = new JSDOM(html, {
  url: pathToFileURL(pageAbs).href,
  runScripts: 'dangerously',
  resources: {
    interceptors: [requestInterceptor(req => resolveRequest(req))],
  },
  pretendToBeVisual: true,
  virtualConsole: vc,
  beforeParse(window) {
    if (!window.navigator.clipboard) {
      Object.defineProperty(window.navigator, 'clipboard', {
        value: { writeText: async () => {}, readText: async () => '' },
        configurable: true,
      });
    }
    if (!window.indexedDB && globalThis.indexedDB) {
      window.indexedDB = globalThis.indexedDB;
      window.IDBKeyRange = globalThis.IDBKeyRange;
    }
    try { window.localStorage.setItem('ghToken', '\u{1F39F}️GitHubToken-test'); } catch {}
    // gh.load() fetches own code via the contents API with window.fetch — jsdom
    // ships none, so route it through the same local resolver the resource
    // interceptor uses. Everything stays offline.
    window.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : (input && input.url);
      try { return Promise.resolve(resolveRequest({ url, ...init })); }
      catch (e) { return Promise.reject(e); }
    };
    // gh-api.js decodes base64 with TextDecoder; Alpine reads matchMedia. jsdom
    // exposes neither reliably — hand them the Node/no-op equivalents.
    if (!window.TextDecoder) window.TextDecoder = TextDecoder;
    if (!window.TextEncoder) window.TextEncoder = TextEncoder;
    if (!window.matchMedia) {
      window.matchMedia = q => ({
        matches: false, media: q, onchange: null,
        addEventListener() {}, removeEventListener() {},
        addListener() {}, removeListener() {}, dispatchEvent() { return false; },
      });
    }
    // Web Animations API: jsdom has no Element.animate; components that animate
    // (the FAB) call it during init. A no-op that returns a settled animation
    // lets init finish — visual timing isn't a logic-preview concern.
    if (window.Element && !window.Element.prototype.animate) {
      window.Element.prototype.animate = () => ({
        finished: Promise.resolve(), cancel() {}, finish() {}, pause() {}, play() {},
        reverse() {}, onfinish: null, oncancel: null,
        addEventListener() {}, removeEventListener() {},
      });
    }
  },
});

await new Promise(resolve => {
  const win = dom.window;
  let done = false;
  const finish = () => { if (!done) { done = true; resolve(); } };
  if (win.document.readyState === 'complete') {
    setTimeout(finish, 1500);
  } else {
    win.addEventListener('load', () => setTimeout(finish, 1500));
  }
  setTimeout(finish, 8000);
});

const win = dom.window;
const doc = win.document;

const xDataNodes = [...doc.querySelectorAll('[x-data]')];
const componentReports = xDataNodes.map(el => {
  const expr = el.getAttribute('x-data');
  const tag = el.tagName.toLowerCase();
  return {
    expr,
    tag,
    childEls: el.children.length,
    snippet: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80),
  };
});

const alpineVersion = win.Alpine?.version ?? '(Alpine not detected)';

// Did the gh.load boot actually execute? gh-api.js creates window.gh and every
// own-code load shows up as a gh/api intercept. The boot block is rewritten to a
// classic script (inlineBoot) so jsdom can run it at all; if window.gh is still
// absent the inlined chain threw — its reason is captured on window.__previewBootError.
const ownCodeHits = intercepts.filter(l =>
  /\/gh\/mehrlander\/web-tools|api\.github\.com|raw\.githubusercontent/.test(l)).length;
const ghBooted = !!win.gh || ownCodeHits > 0;
const bootErrors = win.__previewBootError || [];
for (const e of bootErrors) errorLines.push(`[boot] ${e}`);
const bootDiag = ghBooted
  ? null
  : !bootInlined
    ? "gh.load boot DID NOT RUN — no `await import(gh-api.js)` module block found to inline; "
      + "the x-data containers below are the static HTML only."
    : "gh.load boot DID NOT RUN — the inlined chain threw before creating window.gh "
      + "(see errors). For a real-browser render use: npm run shot " + arg;

const summary = [
  `=== preview: ${arg} ===`,
  `alpine: ${alpineVersion}`,
  `boot:   ${ghBooted ? 'gh.load chain ran' + (bootInlined ? ' (inlined)' : '') : 'NOT RUN'}`,
  ...(bootDiag ? ['', `! ${bootDiag}`] : []),
  '',
  `--- x-data containers (${componentReports.length}) ---`,
  ...componentReports.map(r =>
    `  <${r.tag} x-data="${r.expr}"> children=${r.childEls}  text="${r.snippet}"`),
  '',
  `--- intercepts (${intercepts.length}) ---`,
  ...intercepts,
  '',
  `--- console (${consoleLines.length}) ---`,
  ...consoleLines,
  '',
  `--- errors (${errorLines.length}) ---`,
  ...errorLines,
].join('\n');

console.log(summary);
await writeFile(htmlPath, dom.serialize());
await writeFile(logPath, summary);
console.log(`\nwrote: ${path.relative(repoRoot, htmlPath)}`);
console.log(`wrote: ${path.relative(repoRoot, logPath)}`);

dom.window.close();
process.exit(errorLines.length > 0 ? 1 : 0);
