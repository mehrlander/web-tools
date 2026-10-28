// ONE RULE FOR A BYTE COUNT, held here because each copy was written fresh
// rather than copied, so nothing makes copies agree: the same file can read
// 14.6 KB in one view and 15 KB in the next. The rule is lib/kits/traffic.js's
// fmtBytes: gh-boot loads that kit on every page before any chain, so a view
// reads window.Traffic at call time.
//
// The gate is a line that divides by 1024 and names a size unit: the shape of
// a hand-rolled formatter, not of a limit (`50 * 1024 * 1024; // 50 MB`
// multiplies) or of a unit word in prose.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sources, linesMatching } from './one-home.mjs';

const HOME = 'lib/kits/traffic.js';

const DIVIDES = /\/\s*\(?\s*(?:1024|1048576)\b/;
const NAMES_UNIT = /\b[KMG]i?B\b|['"`][KMG]['"`]/;
const UNIT_LIST = /\[\s*['"]B['"]\s*,\s*['"]KB['"]/;

export const offendersIn = linesMatching((line) => (DIVIDES.test(line) && NAMES_UNIT.test(line)) || UNIT_LIST.test(line));

test('only traffic.js turns a byte count into KB text', () => {
  assert.deepEqual(offendersIn(sources(new Set([HOME]))), [],
    'these format a byte count by hand; call window.Traffic.fmtBytes instead');
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
