// node/render/cdn.mjs, the default file for a bare spec inside a jsDelivr
// /combine/ URL. jsDelivr reads `jsdelivr`, then a string `browser`, then
// `main`, and nothing else: measured 2026-10-06 by fetching each of these
// combine URLs and reading the "Original files" header jsDelivr prepends. The
// table below is that measurement, with `.min` dropped, since the mirror serves
// the unminified twin of the file jsDelivr minifies.
//
// The mirror used to read `unpkg` and `module` as well, and two packages moved:
// tabulator-tables got its ESM build, which threw on `export` and killed every
// library combined beside it, and alpinejs got the working build jsDelivr never
// sends to a combine. A page that passed here and died in a browser, or the
// reverse, is the failure this pins.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';
import { resolveCdn } from '../render/cdn.mjs';

const SERVED = {
  'daisyui': 'daisyui.css',
  '@tailwindcss/browser': 'dist/index.global.js',
  '@phosphor-icons/web': 'src/index.js',
  'tabulator-tables': 'dist/js/tabulator.js',
  'clipboard': 'dist/clipboard.js',
  'papaparse': 'papaparse.min.js',
  'diff': 'dist/diff.js',
  'alpinejs': 'dist/module.cjs.js',
  'fflate': 'umd/index.js',
};

// Compared by hash: assert.deepEqual on two different megabyte buffers spends
// a minute building the diff and then fails the whole file without naming a case.
const sha = b => createHash('sha1').update(b).digest('hex');
const combined = spec => sha(Buffer.from(resolveCdn(`https://cdn.jsdelivr.net/combine/npm/${spec}`, repoRoot).body));
const file = (pkg, rel) => sha(readFileSync(path.join(repoRoot, 'node_modules', pkg, rel)));

for (const [pkg, rel] of Object.entries(SERVED)) {
  test(`combine/npm/${pkg} serves ${rel}, the file jsDelivr serves`, () => {
    assert.equal(combined(pkg), file(pkg, rel));
  });
}

test('a version suffix resolves the same way', () => {
  assert.equal(combined('tabulator-tables@6'), file('tabulator-tables', SERVED['tabulator-tables']));
});

test('an explicit file path still wins, which is the fix for a bare alpinejs', () => {
  assert.equal(combined('alpinejs@3/dist/cdn.min.js'), file('alpinejs', 'dist/cdn.min.js'));
});
