// use-boot-block.test.mjs — the ?use= boot, which is how every render link in
// the conventions reaches a branch.
//
// A loader page imports lib/entry.js, which under ?use= fetches that ref's
// lib/gh-api.js from raw.githubusercontent and blob-imports it. The blob: URL
// carries no ref for gh-api to parse out of import.meta.url, so entry.js hands
// it one: window.__ghBlobBoot = { repo, ref }, read at gh-api.js's module scope.
//
// The defect this exists for: pages/audit-render.html shipped a hand-rolled
// copy of that block setting { ref, base }. `repo` was undefined, every load
// asked api.github.com for /repos//contents/…, and the page rendered blank with
// a FAB on it. The suite was green, because no test sets `use` and the toss's
// #gh= route is what injects it. Some sixty pages carried their own copy of the
// block then. Since 2026-09-26 there is one copy, in lib/entry.js, and the
// pre-build pages keep a second shape that fetches dist/<bundle>.js.
//
// So this reads the blocks as text and holds two things: no page hand-rolls
// the chain block again, and the blocks that remain carry what the runtime
// needs, in the right order.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const walk = dir => readdirSync(dir).flatMap(name => {
  const full = path.join(dir, name);
  if (name === 'node_modules') return [];
  if (statSync(full).isDirectory()) return walk(full);
  return name.endsWith('.html') ? [full] : [];
});

const pages = ['app', 'pages', 'popups', 'lib', 'archive']
  .flatMap(d => walk(path.join(repoRoot, d)))
  .map(full => ({ rel: path.relative(repoRoot, full).split(path.sep).join('/'),
                  src: readFileSync(full, 'utf8') }));

// The raw fetch is what identifies a hand-written ?use= block: the pre-build
// pages fetch dist/<bundle>.js. (The chain block lives in lib/entry.js, below.)
const RAW = /https:\/\/raw\.githubusercontent\.com\/([^/`'"]+\/[^/`'"]+)\/\$\{(\w+)\}\/([^`'"]+)/g;

// One block per raw fetch: from the `if (` guarding it to the revoke that ends
// it. Every page in the tree writes it in that shape.
//
// A raw fetch that does NOT blob-import is a different thing and not this
// gate's business: toss-render's bookmarklet reads a blob's text off
// raw.githubusercontent and hands it to the gzip route, and it recovers from a
// bad response rather than throwing on one.
function blocks(src) {
  return [...src.matchAll(RAW)].map(m => {
    const open = src.lastIndexOf('if (', m.index);
    const close = src.indexOf('revokeObjectURL', m.index);
    if (close < 0) return null;
    const text = src.slice(open, close);
    if (!/URL\.createObjectURL/.test(text) || !/await\s+import\s*\(/.test(text)) return null;
    return { repo: m[1], refVar: m[2], file: m[3], text };
  }).filter(Boolean);
}

const found = pages.flatMap(p => blocks(p.src).map(b => ({ ...b, rel: p.rel })));

test('the scan reaches the blocks it is meant to gate', () => {
  // Vacuity guard for the pre-build family, the one hand-written shape left: a
  // scan that quietly matched nothing would pass forever.
  assert.ok(found.length >= 4,
    `only ${found.length} pre-build ?use= blocks matched; the shape moved and this gate went blind`);
});

test('a fetch that failed is never blob-imported', () => {
  // raw answers a bad ref with an HTML 404 page and a 200-shaped body is not
  // what makes it importable: the Blob sets its own JS type, so the page would
  // import the error page and fail somewhere unrelated.
  const bad = found.filter(b => !/if\s*\(!\w+\.ok\)\s*throw/.test(b.text)).map(b => b.rel);
  assert.deepEqual([...new Set(bad)], [],
    'a ?use= block blob-imports without checking the response');
});

// ── the chain family: one block, in lib/entry.js ────────────────────────────
// Code lines only: the header comment quotes the import a page writes.
const entry = readFileSync(path.join(repoRoot, 'lib/entry.js'), 'utf8')
  .split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');

test('no page hand-rolls the gh-api.js boot; the chain pages import lib/entry.js', () => {
  const rolled = pages.filter(p => !p.rel.startsWith('archive/') &&
    /raw\.githubusercontent\.com\/[^`'"]*\/lib\/gh-api\.js/.test(p.src)).map(p => p.rel);
  assert.deepEqual(rolled, [],
    'a page fetches lib/gh-api.js itself; import lib/entry.js instead, which is the one copy');
  const importers = pages.filter(p => /import\(\s*['"`]https:\/\/mehrlander\.github\.io\/web-tools\/lib\/entry\.js/.test(p.src));
  assert.ok(importers.length >= 50,
    `only ${importers.length} pages import lib/entry.js; the shape moved and this gate went blind`);
  assert.ok(importers.some(p => p.rel === 'pages/audit-render.html'),
    'the page the defect shipped on no longer boots through entry.js');
});

test('entry.js hands gh-api a repo and the fetched ref, before the import, and checks the response', () => {
  const m = entry.match(/__ghBlobBoot\s*=\s*\{([^}]*)\}/);
  assert.ok(m, 'entry.js sets no __ghBlobBoot');
  assert.match(m[1], /\brepo\b/, 'without repo, gh-api builds /repos//contents/… and the page renders blank');
  assert.match(m[1], /\bref\b/, 'without ref, gh-api does not know which ref it was fetched at');
  assert.match(entry, /raw\.githubusercontent\.com\/\$\{repo\}\/\$\{ref\}\/lib\/gh-api\.js/,
    'the fetch must read the same repo and ref the boot object names');
  const set = entry.indexOf('__ghBlobBoot');
  const imp = entry.search(/await\s+import\s*\(/);
  assert.ok(set >= 0 && imp > set, 'gh-api reads __ghBlobBoot at module scope, so it must be set first');
  assert.match(entry, /if\s*\(!\w+\.ok\)\s*throw/, 'a failed fetch must not be blob-imported');
});
