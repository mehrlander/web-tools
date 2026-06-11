// Shared CDN -> local resolution for the headless render tools.
//
// The repo's pages pull two unrelated things off the network:
//   1. Own code  — gh-api.js's loader fetches lib/* via the GitHub contents
//      API (base64), after the page's first jsDelivr `/gh/` import of gh-api.js
//      itself. Both must resolve to the on-disk working tree so a render shows
//      branch edits, not whatever main serves.
//   2. Third-party libs — Tailwind/daisyUI/Phosphor/Alpine/etc. from jsDelivr +
//      unpkg, both blocked in this sandbox. Each maps to an npm-installed copy
//      under node_modules.
//
// resolveCdn(url, repoRoot) classifies a request URL and returns one of:
//   { kind:'fulfill', body, contentType }  serve these local bytes
//   { kind:'empty',   contentType }        a known-but-unvendored dep: serve
//                                          nothing (don't break on it), and the
//                                          `tag` says what was skipped
//   { kind:'continue' }                    an allowed host (fonts, APIs): let it
//                                          go to the network unchanged
//
// Used by tools/render/screenshot.mjs (Playwright route) and reusable by any future
// pixel/preview tool. The logic-level twin lives inline in tools/render/preview.mjs.

import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import path from 'node:path';

export const REPO = 'mehrlander/web-tools';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.cjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.svg': 'image/svg+xml',
  '.map': 'application/json; charset=utf-8',
};
export const typeFor = p => TYPES[path.extname(p).toLowerCase()] || 'application/octet-stream';

// Packages whose CDN default file differs from what package.json main/browser
// would pick. jsDelivr/unpkg serve the browser-global build for these; npm main
// is a CommonJS/ESM entry that won't run from a plain <script>.
const CDN_DEFAULT = {
  'alpinejs': 'dist/cdn.min.js',
  '@alpinejs/collapse': 'dist/cdn.min.js',
  '@alpinejs/sort': 'dist/cdn.min.js',
  'daisyui': 'daisyui.css',
  'tabulator-tables': 'dist/js/tabulator.min.js',
};

// Resolve a package + optional subpath to a file under node_modules. `esm`
// marks a jsDelivr `/+esm` import: prefer the package's ESM entry
// (exports["."].import / module), since the UMD/browser default those CDN
// fields point at has no named exports for an `import { x }` to bind to.
// (jsDelivr also bundles a CJS graph into ESM server-side; that we can't do,
// so a CJS-only package still misses — e.g. fast-xml-parser.)
function nodeFile(repoRoot, pkg, sub, esm) {
  const dir = path.join(repoRoot, 'node_modules', pkg);
  if (sub) return path.join(dir, sub);
  if (CDN_DEFAULT[pkg]) return path.join(dir, CDN_DEFAULT[pkg]);
  const pj = path.join(dir, 'package.json');
  if (existsSync(pj)) {
    try {
      const j = JSON.parse(readFileSync(pj, 'utf8'));
      const dot = j.exports && j.exports['.'];
      const def = esm
        ? (dot && (dot.import || dot.module || dot.default)) || j.module || j.main || 'index.js'
        : j.jsdelivr || j.unpkg || j.browser || j.module || j.main || 'index.js';
      if (typeof def === 'string') return path.join(dir, def);
    } catch {}
  }
  return path.join(dir, 'index.js');
}

// Parse a jsDelivr `npm/<pkg>[@ver]/<sub>` or unpkg `<pkg>[@ver]/<sub>` spec
// into { pkg, sub, esm }. Handles scoped packages and a trailing `+esm`.
function parseNpm(spec) {
  spec = spec.replace(/^npm\//, '');
  const esm = /\/\+esm$/.test(spec);
  spec = spec.replace(/\/?\+esm$/, '').replace(/\/$/, '');
  let scope = '', rest = spec;
  if (spec.startsWith('@')) {
    const i = spec.indexOf('/');
    scope = spec.slice(0, i) + '/';
    rest = spec.slice(i + 1);
  }
  const j = rest.indexOf('/');
  const nameVer = j < 0 ? rest : rest.slice(0, j);
  const sub = j < 0 ? '' : rest.slice(j + 1);
  const name = nameVer.replace(/@.*/, '');
  return { pkg: scope + name, sub, esm };
}

function readSpec(spec, repoRoot) {
  const { pkg, sub, esm } = parseNpm(spec);
  const fp = nodeFile(repoRoot, pkg, sub, esm);
  if (existsSync(fp)) return { body: readFileSync(fp), contentType: typeFor(fp) };
  return null;
}

export function resolveCdn(rawUrl, repoRoot) {
  let u;
  try { u = new URL(rawUrl); } catch { return { kind: 'continue' }; }
  const host = u.host;

  // --- Own code: jsDelivr /gh/<repo>[@ref]/<path> (the first gh-api.js import) ---
  if (host === 'cdn.jsdelivr.net' && u.pathname.startsWith(`/gh/${REPO}`)) {
    const tail = u.pathname.slice(`/gh/${REPO}`.length).replace(/^@[^/]+/, '');
    const rel = decodeURIComponent(tail).replace(/^\//, '');
    const fp = path.join(repoRoot, rel);
    if (existsSync(fp)) return { kind: 'fulfill', body: readFileSync(fp), contentType: typeFor(fp), tag: `gh ${rel}` };
    return { kind: 'empty', contentType: 'application/javascript; charset=utf-8', tag: `MISS gh ${rel}` };
  }
  // Other /gh/ refs are third-party data (word lists, etc.) — not vendored.
  if (host === 'cdn.jsdelivr.net' && u.pathname.startsWith('/gh/')) {
    return { kind: 'empty', contentType: 'application/octet-stream', tag: `skip ${u.pathname}` };
  }

  // --- Own code: GitHub contents API (every load after gh-api.js) ---
  if (host === 'api.github.com' && u.pathname.startsWith(`/repos/${REPO}/contents/`)) {
    const tail = u.pathname.slice(`/repos/${REPO}/contents/`.length);
    const rel = decodeURIComponent(tail).replace(/\/$/, '');
    const fp = path.join(repoRoot, rel);
    if (existsSync(fp)) {
      // A directory path returns the contents-API array, not file bytes — and
      // readFileSync on a dir throws EISDIR, so this guard is also a crash fix.
      if (statSync(fp).isDirectory()) {
        const entries = readdirSync(fp, { withFileTypes: true }).map(e => ({
          name: e.name,
          path: rel ? `${rel}/${e.name}` : e.name,
          type: e.isDirectory() ? 'dir' : 'file',
          sha: 'local', size: 0, html_url: '', download_url: '',
        }));
        return { kind: 'fulfill', contentType: 'application/json; charset=utf-8', tag: `api dir ${rel}`, body: JSON.stringify(entries) };
      }
      const text = readFileSync(fp, 'utf8');
      return {
        kind: 'fulfill', contentType: 'application/json; charset=utf-8', tag: `api ${tail}`,
        body: JSON.stringify({
          content: Buffer.from(text).toString('base64'),
          encoding: 'base64', sha: 'local', size: text.length, html_url: '',
        }),
      };
    }
    return { kind: 'empty', contentType: 'application/json; charset=utf-8', tag: `MISS api ${tail}` };
  }

  // --- Third-party libs: jsDelivr /combine/ (comma-joined specs) ---
  if (host === 'cdn.jsdelivr.net' && u.pathname.startsWith('/combine/')) {
    const specs = u.pathname.slice('/combine/'.length).split(',');
    const parts = [];
    let ct = null, miss = [];
    for (const s of specs) {
      const r = readSpec(s, repoRoot);
      if (r) { parts.push(Buffer.from(r.body)); ct = ct || r.contentType; }
      else miss.push(s);
    }
    return {
      kind: 'fulfill', body: Buffer.concat(parts),
      contentType: ct || 'application/javascript; charset=utf-8',
      tag: `combine ${specs.length - miss.length}/${specs.length}` + (miss.length ? ` MISS:${miss.join(',')}` : ''),
    };
  }

  // --- Third-party libs: jsDelivr /npm/ and unpkg ---
  if (host === 'cdn.jsdelivr.net' && u.pathname.startsWith('/npm/')) {
    const r = readSpec(u.pathname.slice(1), repoRoot);
    if (r) return { kind: 'fulfill', body: Buffer.from(r.body), contentType: r.contentType, tag: `npm ${u.pathname}` };
    return { kind: 'empty', contentType: typeFor(u.pathname), tag: `MISS ${u.pathname}` };
  }
  if (host === 'unpkg.com') {
    const r = readSpec(u.pathname.slice(1), repoRoot);
    if (r) return { kind: 'fulfill', body: Buffer.from(r.body), contentType: r.contentType, tag: `unpkg ${u.pathname}` };
    return { kind: 'empty', contentType: typeFor(u.pathname), tag: `MISS unpkg ${u.pathname}` };
  }

  // --- Known-but-unvendored module CDNs (e.g. cm6's esm.sh imports) ---
  if (host === 'esm.sh' || host === 'cdnjs.cloudflare.com') {
    return { kind: 'empty', contentType: 'application/javascript; charset=utf-8', tag: `skip ${host}${u.pathname}` };
  }

  // --- Allowed hosts (Google Fonts, GitHub raw, data APIs): pass through ---
  return { kind: 'continue' };
}
