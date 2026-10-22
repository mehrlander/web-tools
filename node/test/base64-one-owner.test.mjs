// ONE OWNER FOR BASE64 in the browser: gh-api.js's statics. GH.toBase64 takes
// text (as UTF-8) or bytes, GH.toBase64url is the same for a value that rides in
// a link, and GH.decodeBytes / GH.decode read either alphabet, padded or not,
// with any whitespace. Every page boots gh-api.js first, so a kit or a page that
// does reaches them without a load.
//
// Until 2026-10-20 about twenty files carried a codec of their own, and they had
// drifted on three edges: half spread a whole byte array into
// String.fromCharCode, which overflows the argument limit on a small PNG; the
// decoders split on which alphabet and whether padding they accepted; and the
// text encoders used three different routes to UTF-8, one of them the
// deprecated escape/unescape pair.
//
// The gate counts calls to `btoa(` and `atob(`. A file below may hold exactly
// the number its entry says, so a new copy in an exempt file still fails.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../repo-root.mjs';

const ALLOWED = {
  // The owner.
  'lib/gh-api.js': { n: 2, why: 'the codec itself' },
  // The renderer's critical path loads no lib, by design (its own header).
  'pages/toss-render.html': { n: 3, why: 'its render path loads no lib' },
  // These two lines are page source the kit emits into a self-extracting
  // data: URL, which opens with nothing booted.
  'lib/kits/compression.js': { n: 2, why: 'code it emits into a page that loads no lib' },
  // The toss renderer injects the look kit into a tossed page that boots
  // nothing; it calls gh-api.js's codec wherever the page has one.
  'lib/kits/look.js': { n: 2, why: 'injected into pages that load no lib' },
  // Sample chat turns that quote the API as text.
  'pages/chat-results.html': { n: 3, why: 'quoted sample code, not code that runs' },
  // Pages that load no library at all, so gh-api.js is not there to call.
  'pages/bench.html': { n: 2, why: 'loads no lib' },
  'pages/doc-growth.html': { n: 2, why: 'loads no lib' },
  'pages/delivery.html': { n: 1, why: 'loads no lib' },
  'pages/shortcut-edit.html': { n: 2, why: 'loads no lib' },
  'pages/wsl-sync/pension-map.html': { n: 1, why: 'loads no lib' },
  'popups/render-engine-editor.html': { n: 1, why: 'loads no lib' },
};

const calls = (f) => (readFileSync(join(repoRoot, f), 'utf8').match(/\b(?:btoa|atob)\(/g) || []).length;

test('only gh-api.js encodes and decodes base64', () => {
  const files = execFileSync('git', ['ls-files', 'lib', 'pages', 'app', 'popups'], { cwd: repoRoot, encoding: 'utf8' })
    .split('\n').filter((f) => /\.(js|html)$/.test(f) && !f.startsWith('pages/scratch/'));
  const offenders = files
    .map((f) => [f, calls(f), ALLOWED[f]?.n || 0])
    .filter(([, n, allowed]) => n > allowed)
    .map(([f, n, allowed]) => `${f}: ${n} (allowed ${allowed})`);
  assert.deepEqual(offenders, [],
    'these carry a base64 codec of their own; use window.GH.toBase64 / toBase64url / decodeBytes / decode');
});

test('every exemption is still needed', () => {
  // An entry whose file no longer holds its calls is a stale licence for a
  // copy to come back.
  const stale = Object.entries(ALLOWED).filter(([f, { n }]) => calls(f) < n).map(([f]) => f);
  assert.deepEqual(stale, [], 'lower these counts, or drop the entry');
});
