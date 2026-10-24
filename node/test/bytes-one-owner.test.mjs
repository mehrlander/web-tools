// ONE RULE FOR A BYTE COUNT, held here because every copy was written fresh
// rather than copied, so nothing made them agree. Until 2026-10-24 twenty-nine
// formatters in twenty files turned a byte count into "KB" text, and the same
// file read 14.6 KB in the Stage, 15 KB in Search and 14.6K in a brief, and
// traffic.js printed two decimals for a megabyte while its own comment said one.
// The rule is lib/kits/traffic.js's fmtBytes, with fmtBytesShort for a chip:
// gh-boot loads that kit on every page before any chain, so a view reads
// window.Traffic at call time. Found by the code-jobs probe's identifier scan
// (research/code-jobs/), which ranked three of the copies as one function.
//
// The gate is a line that divides by 1024 and names a size unit: the shape of
// a hand-rolled formatter, not of a limit (`50 * 1024 * 1024; // 50 MB`
// multiplies) or of a unit word in prose.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../repo-root.mjs';

const OWNER = 'lib/kits/traffic.js';

const ALLOWED = new Map([
  [OWNER, 'the owner'],
  // The session page's Raw link reads "Raw12K": the size sits flush against
  // its label, unspaced, and the owner's "12 KB" would change the label.
  ['lib/alpineComponents/session-brief.js', 'an unspaced size inside a link label'],
]);
const SKIP = /^(pages\/drop\/|pages\/scratch\/|lib\/vendor\/)|\.min\.js$/;

const DIVIDES = /\/\s*\(?\s*(?:1024|1048576)\b/;
const NAMES_UNIT = /\b[KMG]i?B\b|['"`][KMG]['"`]/;
const UNIT_LIST = /\[\s*['"]B['"]\s*,\s*['"]KB['"]/;

const files = () => execFileSync('git', ['ls-files', '-z', 'lib', 'pages', 'app', 'popups'], { cwd: repoRoot, encoding: 'utf8' })
  .split('\0').filter((f) => /\.(js|html)$/.test(f) && !SKIP.test(f) && !ALLOWED.has(f));

export const offendersIn = (paths, read = (f) => readFileSync(join(repoRoot, f), 'utf8')) => paths.flatMap((f) =>
  read(f).split('\n').flatMap((line, i) =>
    (DIVIDES.test(line) && NAMES_UNIT.test(line)) || UNIT_LIST.test(line) ? [`${f}:${i + 1}`] : []));

test('only traffic.js turns a byte count into KB text', () => {
  assert.deepEqual(offendersIn(files()), [],
    'these format a byte count by hand; call window.Traffic.fmtBytes (or fmtBytesShort) instead');
});

test('the gate catches the shapes the copies took, and not a limit or a word', () => {
  const lines = {
    'a.js': "return (n / 1024).toFixed(1) + ' KB';",
    'b.js': 'report(`${(size / 1024).toFixed(1)} KB`);',
    'c.js': "n < 1048576 ? Math.round(n / 1024) + 'K' : x",
    'd.js': "const u = ['B', 'KB', 'MB', 'GB'];",
    'e.js': 'const MAX = 50 * 1024 * 1024; // 50 MB',
    'f.js': "said('copied, ' + kb + ' KB');",
  };
  assert.deepEqual(offendersIn(Object.keys(lines), (f) => lines[f]), ['a.js:1', 'b.js:1', 'c.js:1', 'd.js:1']);
});

test('each exception still holds what excuses it', () => {
  // An exception that stops formatting bytes by hand should leave the list,
  // rather than wait there to excuse the next copy.
  for (const [f, why] of ALLOWED) {
    if (f === OWNER) continue;
    assert.ok(offendersIn([f]).length > 0, `${f} is excused (${why}) but no longer formats bytes by hand`);
  }
});

test('the owner keeps the rule the views were moved onto', () => {
  const w = {};
  new Function('window', readFileSync(join(repoRoot, OWNER), 'utf8'))(w);
  const { fmtBytes, fmtBytesShort } = w.Traffic;
  assert.deepEqual([900, 9728, 417435, 1460047, 2 ** 31].map((n) => fmtBytes(n)),
    ['900 B', '9.5 KB', '408 KB', '1.4 MB', '2.0 GB']);
  assert.deepEqual([9728, 417435, 1460047].map((n) => fmtBytesShort(n)), ['10 KB', '408 KB', '1.4 MB']);
  assert.equal(fmtBytes(null), '?', 'unknown is never zero');
  assert.equal(fmtBytes(undefined, ''), '', 'a view may ask for nothing instead');
});
