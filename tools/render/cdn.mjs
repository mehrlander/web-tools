// Shared CDN -> local resolution for the headless render tools.
//
// The repo's pages pull three things off the network:
//   1. Own code  — the page imports lib/entry.js from <owner>.github.io, which
//      imports gh-api.js beside it (or from raw.githubusercontent under
//      ?use=), whose loader then fetches lib/* via the GitHub contents API. All three must resolve to
//      the on-disk working tree so a render shows branch edits, not whatever
//      main serves. The pre-build boot and the <base> a toss render stamps
//      reach the same two hosts for the same reason.
//   2. Own data: the GitHub API surface for REPO (contents listings/reads,
//      /repos/<REPO> metadata, git/trees) is answered from the working tree
//      too: no token, no network, and uncommitted edits render. ANOTHER repo's
//      contents are answered from its checkout beside this one where there is
//      one, and otherwise miss rather than reaching the network (see the
//      sibling branch). CONTENTS ONLY: another repo's metadata and git/trees
//      match no branch here, so they still pass through and fail in the
//      sandbox. Identity endpoints (/user, /user/repos) are NOT
//      impersonated, since "who am I" has no local answer; pages must keep
//      first paint off them (see testing.md).
//   3. Third-party libs — Tailwind/daisyUI/Phosphor/Alpine/etc. from jsDelivr +
//      unpkg, both blocked in this sandbox. Each maps to an npm-installed copy
//      under node_modules.
//
// resolveCdn(url, repoRoot, ref?) classifies a request URL and returns one of:
// (ref is the render's --ref value, used to strip a slashed branch name from a
// raw.githubusercontent own-code URL; optional, only the raw case reads it.)
//   { kind:'fulfill', body, contentType }  serve these local bytes
//   { kind:'empty',   contentType }        a known-but-unvendored dep: serve
//                                          nothing (don't break on it), and the
//                                          `tag` says what was skipped
//   { kind:'continue' }                    an allowed host (fonts, APIs): let it
//                                          go to the network unchanged
//
// Used by tools/render/screenshot.mjs (pixels) and tools/render/netlog.mjs
// (request counts), both on the Playwright route, and reusable by any future
// one. The logic-level twin lives inline in tools/render/preview.mjs.
//
// This is the web-tools-specific implementation (it also impersonates the GitHub
// API for this repo). The portable, repo-agnostic write-up of the
// vendor-and-intercept concept is docs/headless-vendoring.md.

import { readFileSync, existsSync, statSync, lstatSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

export const REPO = 'mehrlander/web-tools';

// Serialized git/trees body, built once per process (see the trees branch).
let treeBodyCache = null;

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
// A checkout of another repo in this estate, beside this one. Returns the file
// path when the sibling exists, is a git checkout, and holds the file; null
// otherwise, so every caller falls through to its own rule. It never leaves the
// parent directory: `rel` is resolved and then required to stay inside.
function siblingFile(repoRoot, owner, name, rel) {
  if (!/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(name)) return null;
  const root = path.resolve(repoRoot, '..', name);
  if (root === path.resolve(repoRoot)) return null;
  if (!existsSync(path.join(root, '.git'))) return null;
  const fp = path.resolve(root, decodeURIComponent(rel));
  if (fp !== root && !fp.startsWith(root + path.sep)) return null;
  return existsSync(fp) && statSync(fp).isFile() ? fp : null;
}

function nodeFile(repoRoot, pkg, sub, esm, combine) {
  const dir = path.join(repoRoot, 'node_modules', pkg);
  if (sub) return path.join(dir, sub);
  // CDN_DEFAULT models the /npm/ route, which honors the `unpkg` field. The
  // /combine/ route does NOT: it resolves through package.json main, so a bare
  // `npm/alpinejs` spec there yields dist/module.cjs.js and the page gets a
  // CommonJS file that defines no global. Applying the map to a combine request
  // serves a working Alpine no browser would ever receive, so the page renders
  // here and ships dead (SNAGS: combine-serves-cjs).
  if (!combine && CDN_DEFAULT[pkg]) return path.join(dir, CDN_DEFAULT[pkg]);
  const pj = path.join(dir, 'package.json');
  if (existsSync(pj)) {
    try {
      const j = JSON.parse(readFileSync(pj, 'utf8'));
      const dot = j.exports && j.exports['.'];
      // For a /+esm request, `browser` outranks `main`. jsDelivr's +esm route
      // bundles the package's BROWSER graph and ships the result as a module,
      // so a CJS-only package with a browser field resolves to a file that
      // runs in a page. Reading main instead hands the page the Node entry,
      // which reaches for `fs`, `stream` and a bare `process`, and the failure
      // arrives as a runtime error deep inside the library rather than as a
      // MISS. exceljs is the case that found this: no exports map and no
      // module field, so the chain fell straight through to ./excel.js and the
      // page died with "process is not defined" the first time it wrote a
      // workbook. Written as a rule so the next such package resolves itself.
      const def = esm
        ? (dot && (dot.import || dot.module || dot.default)) || j.module
          || (typeof j.browser === 'string' ? j.browser : null) || j.main || 'index.js'
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

// A package whose CDN path and whose npm path are different packages.
//
// Pages load `@tailwindcss/typography/dist/typography.min.css`. That file has
// not been published since 0.5.0: every version after it ships the Tailwind
// PLUGIN and no built CSS. jsDelivr answers the versionless URL by falling back
// to the last version that has the file, which its own header confirms
// (`x-jsd-version: 0.5.0`), so a real browser has been loading 0.5.0 all along
// while `node_modules/@tailwindcss/typography` holds the current plugin. The
// resolver saw a package with no such file and served an honest MISS, so every
// headless screenshot of a prose surface was taken with no prose styles.
//
// So 0.5.0 is installed a second time under an alias (package.json,
// `typography-dist`) and this table points the CDN path at it. Real bytes,
// byte-identical to what the CDN serves, which is the vendoring rule in
// docs/headless-vendoring.md rather than an exception to it.
const PKG_ALIAS = { '@tailwindcss/typography': 'typography-dist' };

// A package with no ESM build at all, which nodeFile's comment says is the
// case this shim cannot serve: jsDelivr bundles the CJS graph server-side and
// we have no bundler here. Where the package ALSO ships a UMD that assigns a
// browser global, that UMD plus a re-export of the global is the same module by
// a shorter road, and it is real published bytes rather than a rewrite.
//
// One entry per package naming the file and the global, because neither is
// derivable: jszip's `browser` map keys on an extensionless path Node resolves
// and `existsSync` does not, which is why a /+esm request for it answered MISS.
// Three kits import it this way (xlsx, docx, export), so every headless shot of
// a page that opens a zip drew nothing and said only that a module failed to
// load. Only for a UMD that assigns to `window`: one that relies on `this` at
// top level gets `undefined` in a module and throws.
const UMD_ESM = {
  jszip: { file: 'dist/jszip.min.js', global: 'JSZip' },
};

function readSpec(spec, repoRoot, combine) {
  const { pkg: cdnPkg, sub, esm } = parseNpm(spec);
  if (esm && !sub && UMD_ESM[cdnPkg]) {
    const { file, global } = UMD_ESM[cdnPkg];
    const umd = path.join(repoRoot, 'node_modules', cdnPkg, file);
    if (existsSync(umd)) {
      const body = readFileSync(umd, 'utf8')
        + `\n;const __umd = globalThis[${JSON.stringify(global)}];\n`
        + `export default __umd;\nexport { __umd as ${global} };\n`;
      return { body, contentType: 'application/javascript; charset=utf-8' };
    }
  }
  const pkg = (PKG_ALIAS[cdnPkg] && existsSync(path.join(repoRoot, 'node_modules', PKG_ALIAS[cdnPkg], sub)))
    ? PKG_ALIAS[cdnPkg] : cdnPkg;
  let fp = nodeFile(repoRoot, pkg, sub, esm, combine);
  // jsDelivr auto-minifies: a `.min.js`/`.min.css` URL works on the CDN even
  // when the npm tarball ships only the unminified file (e.g. codemirror@5).
  if (!existsSync(fp) && /\.min\.(js|css)$/.test(fp)) {
    const plain = fp.replace(/\.min\.(js|css)$/, '.$1');
    if (existsSync(plain)) fp = plain;
  }
  // A URL naming the package's own bundle (npm/marked/marked.min.js) is served
  // by jsDelivr from whatever the published tarball happens to lay out, which
  // moves between majors: marked@18 ships lib/marked.umd.js and nothing at the
  // root. When the explicit sub-path misses and its basename is the package's
  // own name, fall back to the package's declared browser entry, which is the
  // file the URL was after. Scripted as a rule rather than a per-package alias
  // so the next relocation resolves itself.
  if (!existsSync(fp) && sub && path.basename(sub).replace(/\.min\.(js|css)$/, '.$1').split('.')[0] === pkg.split('/').pop()) {
    const manifest = path.join(repoRoot, 'node_modules', pkg, 'package.json');
    if (existsSync(manifest)) {
      try {
        const m = JSON.parse(readFileSync(manifest, 'utf8'));
        const entry = typeof m.browser === 'string' ? m.browser : m.main;
        // Only when the entry is the same KIND of file that was asked for. A
        // package's declared entry is its Node entry, and for a plugin that is
        // JavaScript no matter what the URL wanted: @tailwindcss/typography
        // ships no dist CSS and its basename matches its package name, so
        // without this test a request for dist/typography.min.css resolves to
        // src/index.js and the page gets a Node module as its stylesheet,
        // reported in the log as a hit. A miss is the honest answer and shows
        // up as MISS.
        if (entry && path.extname(entry) === path.extname(fp).replace(/^\.min/, '')) {
          const cand = path.join(repoRoot, 'node_modules', pkg, entry);
          if (existsSync(cand)) fp = cand;
        }
      } catch (e) { /* unreadable manifest: fall through to the miss */ }
    }
  }
  if (existsSync(fp)) return { body: readFileSync(fp), contentType: typeFor(fp) };
  return null;
}

// The esm.sh half of the story above: `/<pkg>[@version][/subpath]` to the
// package's ESM entry (exports["."].import, then module, then main) or the
// subpath's exports pattern, then every bare specifier in the served text
// rewritten to an absolute esm.sh URL so the browser asks this resolver again.
// Only static `import … from` / `export … from` and dynamic `import('…')` forms
// are rewritten, and only when the specifier is bare (no leading `.`, `/`, or
// scheme). The CM6 dist files are plain ESM of exactly that shape.
function esmEntry(dir, sub) {
  const pj = path.join(dir, 'package.json');
  let j = {};
  try { j = JSON.parse(readFileSync(pj, 'utf8')); } catch { return null; }
  const pick = v => typeof v === 'string' ? v : v && (v.import || v.module || v.default || v.browser);
  if (!sub) {
    const dot = j.exports && (typeof j.exports === 'string' ? j.exports : j.exports['.'] || (j.exports.import ? j.exports : null));
    const rel = pick(dot) || j.module || j.main || 'index.js';
    return typeof rel === 'string' ? path.join(dir, rel) : null;
  }
  const ex = j.exports && typeof j.exports === 'object' ? j.exports : null;
  if (ex) {
    if (ex['./' + sub]) { const rel = pick(ex['./' + sub]); if (rel) return path.join(dir, rel); }
    for (const [key, val] of Object.entries(ex)) {
      if (!key.includes('*')) continue;
      const [head, tail] = key.slice(2).split('*');
      if (sub.startsWith(head) && sub.endsWith(tail)) {
        const star = sub.slice(head.length, sub.length - tail.length);
        const rel = pick(val);
        if (rel) return path.join(dir, rel.replace('*', star));
      }
    }
  }
  for (const cand of [sub, sub + '.js', sub + '/index.js']) {
    const fp = path.join(dir, cand);
    if (existsSync(fp) && statSync(fp).isFile()) return fp;
  }
  return null;
}
const BARE = /((?:^|[^\w$.])(?:import|export)\s*(?:[^'"`;]*?\s+from\s*)?)(['"])([^'"./][^'"]*)\2|(\bimport\s*\(\s*)(['"])([^'"./][^'"]*)\5/g;
export function readEsm(pathname, repoRoot) {
  const spec = decodeURIComponent(pathname.replace(/^\/+/, '')).replace(/^v\d+\//, '').replace(/^stable\//, '');
  const m = spec.match(/^(@[^/@]+\/[^/@]+|[^/@]+)(?:@[^/]+)?(?:\/(.*))?$/);
  if (!m) return null;
  const pkg = m[1], sub = (m[2] || '').replace(/\?.*$/, '');
  const dir = path.join(repoRoot, 'node_modules', pkg);
  if (!existsSync(dir)) return null;
  const fp = esmEntry(dir, sub);
  if (!fp || !existsSync(fp)) return null;
  const text = readFileSync(fp, 'utf8').replace(BARE, (all, pre, q, name, dpre, dq, dname) =>
    pre !== undefined ? `${pre}${q}https://esm.sh/${name}${q}` : `${dpre}${dq}https://esm.sh/${dname}${dq}`);
  return { body: text, contentType: 'application/javascript; charset=utf-8' };
}

// The commits endpoints in the live API's shape, as far as the app reads it:
// sha, parents, the commit's message and dates, and for one commit its files.
const commitJson = (fields, files) => {
  const [sha, parents, name, email, adate, cname, cdate0, ...msg] = fields;
  const utc = (d) => new Date(d).toISOString().replace('.000Z', 'Z');   // GitHub's form
  const date = utc(adate), cdate = utc(cdate0);
  const out = {
    sha, html_url: `https://github.com/${REPO}/commit/${sha}`, author: null, committer: null,
    parents: parents ? parents.split(' ').map(p => ({ sha: p })) : [],
    commit: { message: msg.join('\x1f').trim(), author: { name, email, date }, committer: { name: cname, date: cdate } },
  };
  if (files) {
    out.files = files;
    const add = files.reduce((n, f) => n + f.additions, 0), del = files.reduce((n, f) => n + f.deletions, 0);
    out.stats = { additions: add, deletions: del, total: add + del };
  }
  return out;
};
const FMT = '--format=%H%x1f%P%x1f%an%x1f%ae%x1f%aI%x1f%cn%x1f%cI%x1f%B%x1e';
const json = (status, body, tag) => ({ kind: 'fulfill', status, contentType: 'application/json; charset=utf-8', tag, body: JSON.stringify(body) });
function localCommits(u, root) {
  const git = (...args) => spawnSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 64 << 20 });
  const rev = (r) => (!r || r === 'main' || r === 'HEAD') ? 'HEAD' : r;
  const one = u.pathname.match(/\/commits\/([^/]+)$/);
  if (one) {
    const r = git('show', '--no-patch', FMT, rev(decodeURIComponent(one[1])));
    if (r.status !== 0) return json(404, { message: 'No commit found for SHA: ' + one[1] }, `api commit ${one[1]} (absent)`);
    const num = git('show', '--numstat', '--format=', rev(decodeURIComponent(one[1]))).stdout.trim();
    const files = num ? num.split('\n').map(l => {
      const [a, d, filename] = l.split('\t');
      return { filename, status: 'modified', additions: +a || 0, deletions: +d || 0, changes: (+a || 0) + (+d || 0) };
    }) : [];
    return json(200, commitJson(r.stdout.replace(/\x1e\s*$/, '').split('\x1f'), files), `api commit ${one[1].slice(0, 7)}`);
  }
  const q = u.searchParams, per = Math.min(100, +q.get('per_page') || 30), page = Math.max(1, +q.get('page') || 1);
  const args = ['log', FMT, '-n', String(per), '--skip', String((page - 1) * per), rev(q.get('sha'))];
  if (q.get('since')) args.push('--since=' + q.get('since'));
  if (q.get('until')) args.push('--until=' + q.get('until'));
  if (q.get('path')) args.push('--', q.get('path'));
  const r = git(...args);
  if (r.status !== 0) return json(404, { message: 'No commit found for SHA: ' + q.get('sha') }, 'api commits (absent)');
  const list = r.stdout.split('\x1e').map(c => c.trim()).filter(Boolean).map(c => commitJson(c.split('\x1f')));
  return json(200, list, `api commits${q.get('path') ? ' ' + q.get('path') : ''}`);
}

export function resolveCdn(rawUrl, repoRoot, ref) {
  let u;
  try { u = new URL(rawUrl); } catch { return { kind: 'continue' }; }
  const host = u.host;

  // --- A SIBLING REPO in the same estate, served from its checkout. ---
  // pages/shortcuts.html is the first page here whose data belongs to another
  // repo: it reads shortcut-tools' catalog.json. Without this route a headless
  // render of such a page shows chrome and an empty table, because the branch
  // holding the data may not be pushed yet and the request would otherwise reach
  // the real network, which the sandbox refuses. The same reasoning as the own
  // code rules below: a --ref render must see the working tree, and a sibling
  // checkout IS the working tree for the repo that owns the file.
  {
    const m = /^\/([^/]+)\/([^/]+)\/(.+)$/.exec(u.pathname);
    if (host === 'raw.githubusercontent.com' && m) {
      // <owner>/<repo>/<ref>/<path>, and a branch name carries slashes, so the
      // ref cannot be found by counting segments. Try each split and take the
      // first that names a file in the sibling.
      const rest = m[3];
      for (let i = rest.indexOf('/'); i >= 0; i = rest.indexOf('/', i + 1)) {
        const sib = siblingFile(repoRoot, m[1], m[2], rest.slice(i + 1));
        if (sib) return { kind: 'fulfill', body: readFileSync(sib), contentType: typeFor(sib),
                          tag: `sibling ${m[2]}/${rest.slice(i + 1)}` };
      }
    }
  }

  // --- Own code: raw.githubusercontent.com/<repo>/<ref>/<path>. The pre-build
  // ?use= boot loads dist/web-tools.js this way (fetch + blob-import), so a
  // --ref render must serve the working tree here too, or it would hit the
  // real remote bundle and lose branch edits. lib/entry.js reaches gh-api.js
  // the same way on every page, with or without ?use=.
  // The ref is stripped by the exact --ref value (branch names carry slashes,
  // so segment-counting can't find where the path starts); with no ref known,
  // fall back to dropping one segment. ---
  if (host === 'raw.githubusercontent.com' && u.pathname.startsWith(`/${REPO}/`)) {
    const after = u.pathname.slice(`/${REPO}/`.length);
    const tail = (ref && after.startsWith(ref + '/'))
      ? after.slice(ref.length + 1)
      : after.replace(/^[^/]+\//, '');
    const rel = decodeURIComponent(tail);
    const fp = path.join(repoRoot, rel);
    if (existsSync(fp)) return { kind: 'fulfill', body: readFileSync(fp), contentType: typeFor(fp), tag: `raw ${rel}` };
    return { kind: 'empty', contentType: 'application/javascript; charset=utf-8', tag: `MISS raw ${rel}` };
  }

  // --- Own code via GitHub Pages: <owner>.github.io/<repo>/<path>. Every page's
  // lib/entry.js import lands here, and the <base> a toss-render address render
  // stamps resolves the tossed page's relative URLs here too. ---
  {
    const [owner, name] = REPO.split('/');
    if (host === `${owner}.github.io` && u.pathname.startsWith(`/${name}/`)) {
      const rel = decodeURIComponent(u.pathname.slice(name.length + 2));
      const fp = path.join(repoRoot, rel);
      if (existsSync(fp)) return { kind: 'fulfill', body: readFileSync(fp), contentType: typeFor(fp), tag: `pages ${rel}` };
      return { kind: 'empty', contentType: 'application/octet-stream', tag: `MISS pages ${rel}` };
    }
  }

  // --- Own repo metadata: /repos/<REPO> (identity-free page boots) ---
  if (host === 'api.github.com' && u.pathname === `/repos/${REPO}`) {
    const [login, name] = REPO.split('/');
    return {
      kind: 'fulfill', contentType: 'application/json; charset=utf-8', tag: 'api repo meta',
      body: JSON.stringify({
        full_name: REPO, name, owner: { login }, default_branch: 'main',
        private: false, has_pages: true, description: '(local render)',
        stargazers_count: 0, forks_count: 0, pushed_at: new Date().toISOString(),
      }),
    };
  }

  // --- Own repo history: commits and commits/<sha>, from local git ---
  // Passed through to the live API until 2026-09-24, unauthenticated from a
  // headless browser at 60 calls an hour. The app's activity surfaces spend
  // two dozen per load, and a 403 makes the shell swap the whole view for its
  // "GitHub token needed" screen, so a check of an unrelated view failed on
  // whichever run crossed the limit. `main` means HEAD, as the tree's ref
  // does: the checkout is the ref being rendered.
  if (host === 'api.github.com' && /^\/repos\/[^/]+\/[^/]+\/commits(\/[^/]+)?$/.test(u.pathname)
      && u.pathname.startsWith(`/repos/${REPO}/commits`)) {
    return localCommits(u, repoRoot);
  }

  // --- Own repo tree: git/trees/<ref> (the Pages lens scan) ---
  // Always answered recursively from the working tree; the ref is ignored
  // because the working tree IS the ref being rendered.
  if (host === 'api.github.com' && u.pathname.startsWith(`/repos/${REPO}/git/trees/`)) {
    if (!treeBodyCache) {
      const skip = new Set(['.git', 'node_modules']);
      const tree = [];
      const walk = (rel) => {
        const dir = path.join(repoRoot, rel);
        for (const e of readdirSync(dir, { withFileTypes: true })) {
          if (!rel && skip.has(e.name)) continue;
          const p = rel ? `${rel}/${e.name}` : e.name;
          if (e.isDirectory()) { tree.push({ path: p, type: 'tree' }); walk(p); }
          else {
            // Real blobs carry size; keep the impersonation faithful (repo-atlas
            // maps by it). lstat, not stat: for a symlink the live API reports the
            // target-path string length, which is exactly the link inode's size —
            // and a dangling link (or a file deleted since readdir) must degrade
            // to one sizeless entry, not kill the whole tree response.
            let size = 0;
            try { size = lstatSync(path.join(dir, e.name)).size; } catch {}
            tree.push({ path: p, type: 'blob', size });
          }
        }
      };
      walk('');
      // The working tree is fixed for the lifetime of one render process; don't
      // re-stat thousands of files when a page asks for the tree again.
      treeBodyCache = JSON.stringify({ sha: 'local', truncated: false, tree });
    }
    return {
      kind: 'fulfill', contentType: 'application/json; charset=utf-8',
      tag: `api tree (cached)`,
      body: treeBodyCache,
    };
  }

  // A REF IS A REF, and for a long time this pretended otherwise. Every
  // contents read was answered from the working tree whatever `?ref=` asked
  // for, which is right for the common case (a page loading its own lib at the
  // branch under test) and silently wrong for any surface that COMPARES two
  // refs. kits/md-diff.js and alpineComponents/file-review.js both do: handed
  // two refs that resolve to one tree, the card correctly concluded the file
  // was unchanged, dropped to its read pane, and every headless shot of a
  // comparison showed the feature switched off. One such shot was handed to a
  // reader as evidence the page was wrong. Measured 2026-09-18 on
  // pages/approve.html, whose two items differ from main by 36 lines and came
  // back identical.
  //
  // So a ref that git can resolve is read from git. The working tree stays the
  // answer for a ref git does not know, for a path that is not committed, and
  // for no ref at all, which keeps the common case exactly as it was.
  //
  // EXCEPT THE CODE UNDER TEST, which is the trap the first version walked
  // into. A page boots its library with a ref of its own, and a demo's is
  // `main` by default; honouring that served main's lib to a shot of the
  // working tree, so the very change being photographed was not in the picture.
  // Caught within the hour by a scenario that asserted a style the working tree
  // sets and the shot did not have.
  //
  // The split is what each path IS. `lib/` and `dist/` are the program doing
  // the rendering, and a headless shot exists to photograph the program on
  // disk. Everything else is the material it renders, where a ref is a real
  // question with two different answers, which is the case the ref support was
  // added for.
  const CODE = /^(lib|dist)\//;
  const gitShow = (root, ref, rel) => {
    if (!ref || CODE.test(rel)) return null;
    const r = spawnSync('git', ['-C', root, 'show', `${ref}:${rel}`],
                        { maxBuffer: 64 * 1024 * 1024 });
    return r.status === 0 ? r.stdout : null;
  };

  // --- Own code: GitHub contents API (every load after gh-api.js) ---
  if (host === 'api.github.com' && u.pathname.startsWith(`/repos/${REPO}/contents/`)) {
    const tail = u.pathname.slice(`/repos/${REPO}/contents/`.length);
    const rel = decodeURIComponent(tail).replace(/\/$/, '');
    const fp = path.join(repoRoot, rel);
    const atRef = gitShow(repoRoot, u.searchParams.get('ref'), rel);
    if (atRef) {
      return {
        kind: 'fulfill', contentType: 'application/json; charset=utf-8',
        tag: `api ${tail} @${u.searchParams.get('ref')}`,
        body: JSON.stringify({
          content: atRef.toString('base64'),
          encoding: 'base64', sha: 'local', size: atRef.length, html_url: '',
        }),
      };
    }
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
      // Bytes, not text. Reading as utf8 and re-encoding round-trips a text
      // file exactly and CORRUPTS every binary one, since the invalid
      // sequences in a PNG are replaced on decode and the base64 that goes out
      // is of the replacements. The real contents API base64s the bytes, so
      // this does too, which is what lets a page fetching an image through the
      // API (the viewer's image module) be rendered headlessly at all.
      const bytes = readFileSync(fp);
      return {
        kind: 'fulfill', contentType: 'application/json; charset=utf-8', tag: `api ${tail}`,
        body: JSON.stringify({
          content: bytes.toString('base64'),
          encoding: 'base64', sha: 'local', size: bytes.length, html_url: '',
        }),
      };
    }
    return { kind: 'empty', contentType: 'application/json; charset=utf-8', tag: `MISS api ${tail}` };
  }

  // --- A SIBLING repo's contents, served from its checkout next to this one ---
  //
  // The estate's newer panes are cross-repo: the Chats pane reads
  // mehrlander/chat-histories, the guides fold reads whichever repos hold a
  // shelf. Without this they render their signed-out state headlessly, so a
  // cross-repo pane could be shot only by hand with a real token.
  //
  // Scoped deliberately: the repo NAME must match a directory beside this
  // checkout, and that directory must be a git repo. A multi-repo session
  // already has its siblings on disk, and a request for a repo that is not
  // checked out falls through to the miss below rather than reaching the
  // network, so the render stays offline either way.
  const sibling = /^\/repos\/[^/]+\/([^/]+)\/contents\/(.*)$/.exec(u.pathname);
  if (host === 'api.github.com' && sibling) {
    const [, name, tail] = sibling;
    const root = path.join(repoRoot, '..', name);
    const rel = decodeURIComponent(tail).replace(/\/$/, '').replace(/\?.*$/, '');
    const fp = path.join(root, rel);
    if (existsSync(path.join(root, '.git')) && existsSync(fp)) {
      if (statSync(fp).isDirectory()) {
        const entries = readdirSync(fp, { withFileTypes: true }).map(e => ({
          name: e.name, path: rel ? `${rel}/${e.name}` : e.name,
          type: e.isDirectory() ? 'dir' : 'file',
          sha: 'local', size: 0, html_url: '', download_url: '',
        }));
        return { kind: 'fulfill', contentType: 'application/json; charset=utf-8',
                 tag: `api ${name} dir ${rel}`, body: JSON.stringify(entries) };
      }
      // Bytes, for the same reason the own-repo route above reads bytes: a
      // utf8 decode replaces every invalid sequence, so a gzip inventory or an
      // image served this way arrived corrupted, and a page reading it through
      // DecompressionStream reported the damage as "Failed to fetch"
      // (2026-09-18, the viewer's Proposals mode over home's drafts.jsonl.gz).
      const bytes = readFileSync(fp);
      return {
        kind: 'fulfill', contentType: 'application/json; charset=utf-8', tag: `api ${name}/${rel}`,
        body: JSON.stringify({
          content: bytes.toString('base64'),
          encoding: 'base64', sha: 'local', size: bytes.length, html_url: '',
        }),
      };
    }
    return { kind: 'empty', contentType: 'application/json; charset=utf-8', tag: `MISS api ${name}/${rel}` };
  }

  // --- Third-party libs: jsDelivr /combine/ (comma-joined specs) ---
  if (host === 'cdn.jsdelivr.net' && u.pathname.startsWith('/combine/')) {
    const specs = u.pathname.slice('/combine/'.length).split(',');
    const parts = [];
    let ct = null, miss = [];
    for (const s of specs) {
      const r = readSpec(s, repoRoot, true);
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

  // --- esm.sh: a bare ESM package graph, served from node_modules ---
  // esm.sh serves each package as a module whose imports are rewritten to
  // absolute esm.sh URLs. A page that imports `https://esm.sh/@codemirror/view`
  // therefore never needs an import map. To stand in for it offline, serve the
  // package's ESM entry from node_modules and rewrite ITS bare specifiers the
  // same way, so `from '@codemirror/state'` inside the served file becomes a
  // request this resolver answers on the next hop. A package that is not
  // installed still answers empty, as before, so a page reaching for one the
  // checkout lacks fails the way it did rather than hitting the network.
  if (host === 'esm.sh') {
    const r = readEsm(u.pathname, repoRoot);
    if (r) return { kind: 'fulfill', body: Buffer.from(r.body), contentType: r.contentType, tag: `esm ${u.pathname}` };
    return { kind: 'empty', contentType: 'application/javascript; charset=utf-8', tag: `skip ${host}${u.pathname}` };
  }
  if (host === 'cdnjs.cloudflare.com') {
    return { kind: 'empty', contentType: 'application/javascript; charset=utf-8', tag: `skip ${host}${u.pathname}` };
  }

  // --- Allowed hosts (Google Fonts, GitHub raw, data APIs): pass through ---
  return { kind: 'continue' };
}
