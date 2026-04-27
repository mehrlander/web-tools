#!/usr/bin/env node
// JSDOM-based preview harness — fallback for environments without a real
// browser. Loads a page, intercepts every external <script>/<link> URL and
// serves it from the local working tree or node_modules. Then waits for
// Alpine to mount and reports which x-data containers actually got their
// template injected by their component's init().
//
// This is lower-fidelity than tools/preview.mjs (no real layout, no canvas,
// no clipboard) but it runs anywhere npm runs.
//
// Usage:
//   node tools/preview-jsdom.mjs <page-path>

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
  console.error('Usage: node tools/preview-jsdom.mjs <page-path>');
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
const htmlPath = path.join(outDir, `${baseName}.jsdom.html`);
const logPath = path.join(outDir, `${baseName}.jsdom.log`);

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
  'kits/persistence.js': `
    (() => {
      const mem = new Map();
      const save = async (path, value) => { mem.set(path, value); };
      const load = async (path) => mem.get(path) ?? null;
      const remove = async (path) => { mem.delete(path); };
      const list = async () => [...mem.keys()];
      window.persistence = { save, load, remove, list };
    })();`,
  'kits/compression.js': `
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

  // Alpine — serve from node_modules
  if (u.host === 'unpkg.com' && u.pathname.includes('alpinejs')) {
    const fp = path.join(repoRoot, 'node_modules/alpinejs/dist/cdn.min.js');
    intercepts.push(`HIT  ${request.url} -> node_modules/alpinejs/dist/cdn.min.js`);
    return jsResponse(readFileSync(fp));
  }

  // idb-keyval ESM (used by kits/persistence.js dynamic import)
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

const html = await readFile(pageAbs, 'utf8');
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

const summary = [
  `=== preview-jsdom: ${arg} ===`,
  `alpine: ${alpineVersion}`,
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
