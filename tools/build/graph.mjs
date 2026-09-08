// Static resolver for a page's gh.load chain.
//
// gh.load(path) fetches lib/<path> (loadBase is 'lib/'), strips export/export
// default, and runs it. A file can pull more own-code with its own gh.load(...)
// or fab.js's _selfLoad(...). This walks that graph from a page entry and
// returns the *set* of own-repo files the page can reach — every lib/* the
// runtime loader would request.
//
// Order doesn't matter to the consumer (tools/build/build.mjs keys a flat
// path -> source cache that gh.get looks up; execution order is decided at
// runtime by the actual gh.load calls), so this collects a set, not a sequence.
//
// Resolution mirrors the loader: a load arg P resolves to repo file lib/P,
// cached under key 'lib/P' (what gh.get receives). http(s) args are third-party
// (Alpine/Tailwind stay on their CDN tags) and are skipped.

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

// Every gh-booted page imports gh-api.js, whose bootstrap loads gh-boot.js;
// gh-boot.js then loads gh-auth/gh-fetch/kits/console/vanilla-bundle from its
// BOOT manifest. Seeding gh-boot.js and walking it picks all of that up, which
// became true when the walk learned to read a manifest entry (BOOT_PATH_RE);
// before that it was an intention this comment stated and the scanner did not
// implement.
const IMPLICIT_SEED = ['gh-boot.js'];

// load('X') / gh.load('X') / this.load('X') / _selfLoad('X' — capture the first
// string-literal arg. http(s) args are filtered by the caller.
const LOAD_RE = /(?:_selfLoad|(?:\bgh|this)?\.?load)\s*\(\s*['"`]([^'"`]+)['"`]/g;

// AND A BOOT MANIFEST ENTRY'S `path:`, which is the second way own code names
// own code and the one this walker did not read. gh-boot.js does not call
// gh.load at all: it declares { path: 'vanilla-bundle.js' } and friends and
// loads them from the manifest, so seeding gh-boot.js and walking it picked up
// none of the eight, and every per-page build shipped with seven of them still
// on the network. The comment above IMPLICIT_SEED claimed the opposite and had
// claimed it for as long as the seed existed; measured on pages/dictate.html,
// 2026-09-08, where they were the last serial contents-API calls left after the
// page adopted its build. tools/build/build-app.mjs walks this edge and named
// it, which is why the app's build never had the gap.
//
// Only a literal ending in .js, since `path:` is a common key: anything caught
// that is not own code lands in `misses`, which the build reports.
const BOOT_PATH_RE = /\bpath:\s*['"]([^'"]+\.js)['"]/g;

function scanLoads(src) {
  // Drop comment-only lines so doc examples (e.g. `// gh.load('something.js')`)
  // aren't mistaken for real loads. In-code loads sit on non-comment lines.
  const code = src.split('\n').filter(l => !/^\s*(\/\/|\*)/.test(l)).join('\n');
  const out = new Set();
  let m;
  for (const re of [LOAD_RE, BOOT_PATH_RE]) {
    re.lastIndex = 0;
    while ((m = re.exec(code))) {
      const p = m[1];
      if (!/^https?:/i.test(p) && !p.includes('${')) out.add(p);
    }
  }
  return out;
}

// Pull the gh.load args out of a page's <script type="module"> boot block, and
// confirm the page actually boots the loader (imports gh-api.js, or its own
// build). Returns { isGhBooted, loads:Set, defaultRef }.
//
// A PAGE THAT HAS ADOPTED ITS BUILD IS STILL A gh.load PAGE, which is the
// circularity this second pattern breaks: adopting the build replaces the
// gh-api.js import with `dist/<page>.js`, and a detector looking only for the
// first then reports the page as unbuildable and refuses to rebuild the very
// artifact it is running on. Every later commit would have shipped a stale
// build with nothing to say so. What makes a page buildable is the CHAIN, and
// the chain is unchanged: the build is the same loader with its reads served
// from memory. Found the moment pages/dictate.html adopted one (2026-09-08).
const BOOT_IMPORT = /gh-api\.js|dist\/[\w.-]+\.js/;

export function readPageBoot(repoRoot, pagePath) {
  const html = readFileSync(path.join(repoRoot, pagePath), 'utf8');
  const blocks = [...html.matchAll(/<script\b[^>]*\btype=["']module["'][^>]*>([\s\S]*?)<\/script>/gi)].map(b => b[1]);
  const boot = blocks.find(b => BOOT_IMPORT.test(b)) || '';
  const isGhBooted = !!boot;
  const loads = scanLoads(boot);
  // The boot block's own gh-api import URL doesn't count as a load arg; drop any
  // accidental capture of a lib path that is gh-api.js itself.
  loads.delete('gh-api.js');
  const refM = boot.match(/BRANCH\s*=\s*['"]([^'"]+)['"]/);
  return { isGhBooted, loads, defaultRef: refM ? refM[1] : 'main' };
}

// Walk the graph from a page. Returns:
//   { files: [{ key, rel, src }], misses: [string], seeds: [string] }
// where key = 'lib/<load-path>' (the gh.get cache key) and rel is the repo path.
export function buildGraph(repoRoot, pagePath) {
  const { isGhBooted, loads, defaultRef } = readPageBoot(repoRoot, pagePath);
  if (!isGhBooted) {
    throw new Error(`${pagePath} has no loader boot block (gh-api.js or its own dist/ build) — not a gh.load page, nothing to build.`);
  }

  const seeds = [...new Set([...IMPLICIT_SEED, ...loads])];
  const files = new Map();   // rel -> { key, rel, src }
  const misses = new Set();
  const queue = [...seeds];

  while (queue.length) {
    const loadPath = queue.shift();
    const rel = 'lib/' + loadPath;
    if (files.has(rel)) continue;
    const fp = path.join(repoRoot, rel);
    if (!existsSync(fp)) { misses.add(loadPath); continue; }
    const src = readFileSync(fp, 'utf8');
    files.set(rel, { key: rel, rel, src });
    for (const child of scanLoads(src)) queue.push(child);
  }

  return { files: [...files.values()], misses: [...misses], seeds, defaultRef };
}
