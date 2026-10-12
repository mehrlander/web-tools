// No code in the tree reaches a GitHub repo through jsDelivr's /gh/ route.
//
// Own code has one path: a page imports lib/entry.js from GitHub Pages, which
// blob-imports gh-api.js from raw.githubusercontent at the page's ?use= ref,
// and gh.load reads everything after that through the contents API. A file's
// bytes come from raw; a file a <script src> must point at comes from Pages.
// jsDelivr's /gh/ route was a fourth path with its own cache (about twelve
// hours on a branch) and its own purge ritual, and it spread by being copied:
// by 2026-09-26 it sat in the boot of some sixty pages, three component
// fallbacks, two bookmarklets and a public-repo listing, and was removed from
// all of them at once. This holds the line.
//
// Third-party libraries through jsDelivr's /npm/ and /combine/ routes are the
// house stack and are not what this is about. Dated prose (docs, tracker,
// archive, dump) may still name the old route. The frozen Excel source-cache
// is also historical evidence, retained byte-for-byte for reproduction.

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const self = path.relative(repoRoot, fileURLToPath(import.meta.url)).split(path.sep).join('/');

const CODE = /\.(m?js|cjs|html|py|sh)$/;
const EXEMPT = /^(archive|dump|tracker)\//;
const FROZEN_EXCEL_SOURCES = 'research/excel-validation-2026-09-24/source/technical/source-cache/';
const ROUTES = ['cdn.jsdelivr.net/gh/', 'data.jsdelivr.com', 'purge.jsdelivr.net'];

const shouldScan = f => CODE.test(f) && !EXEMPT.test(f) &&
  !f.startsWith(FROZEN_EXCEL_SOURCES) && f !== self;

test('the frozen Excel source-cache exemption leaves active code and research probes covered', () => {
  assert.equal(shouldScan(`${FROZEN_EXCEL_SOURCES}viewer.js`), false);
  assert.equal(shouldScan(`${FROZEN_EXCEL_SOURCES}pr791-review/lib__kits__xlsx.js`), false);
  for (const f of [
    'lib/kits/xlsx.js',
    'pages/data-view.html',
    'node/render/cdn.mjs',
    'docs/examples/preview.html',
    'research/excel-validation-2026-09-24/source/technical/scripts/browser-probe.mjs',
    'research/excel-validation-2026-09-24/source/technical/source-cache-new/viewer.js',
    'docs/research/another-run/source/technical/source-cache/viewer.js',
  ]) assert.equal(shouldScan(f), true, f);
});

test('no code reaches a repo through jsDelivr /gh/, its data API, or its purge', () => {
  const files = execFileSync('git', ['ls-files'], { cwd: repoRoot, encoding: 'utf8' })
    .split('\n').filter(shouldScan);
  const hits = [];
  for (const f of files) {
    let text;
    try { text = readFileSync(path.join(repoRoot, f), 'utf8'); } catch { continue; }
    text.split('\n').forEach((line, i) => {
      for (const r of ROUTES) if (line.includes(r)) hits.push(`${f}:${i + 1}  ${r}`);
    });
  }
  assert.deepEqual(hits, [],
    'Own code loads through lib/entry.js and gh.load; bytes come from raw.githubusercontent, ' +
    'and anything a <script src> needs comes from GitHub Pages. See docs/loader.md.');
});
