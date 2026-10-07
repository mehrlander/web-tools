// node/render/cdn.mjs, the default file for a bare spec on jsDelivr's plain
// /npm/ route and on unpkg. Measured 2026-10-07 against the installed versions
// (alpinejs and its plugins 3.17.4, daisyui 5.7.47, tabulator-tables 6.6.1):
// jsDelivr's answer read from the "Original file" header it prepends, unpkg's
// from the redirect it sends.
//
// jsDelivr's /npm/ route follows the rule its /combine/ route follows
// (cdn-combine-default.test.mjs): `jsdelivr`, then a string `browser`, then
// `main`. The mirror used to hold a per-package table claiming /npm/ honors
// `unpkg`, so a bare `npm/alpinejs` rendered here with the browser build while
// a real browser got the CommonJS one and defined no Alpine. unpkg reads
// `unpkg`, then `main`, and ignores `browser`: a bare `unpkg.com/daisyui` is a
// JavaScript file, not the stylesheet.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';
import { resolveCdn } from '../render/cdn.mjs';

const JSDELIVR = {
  'alpinejs': 'dist/module.cjs.js',
  '@alpinejs/collapse': 'dist/module.cjs.js',
  '@alpinejs/sort': 'dist/module.cjs.js',
  'daisyui': 'daisyui.css',
  'tabulator-tables': 'dist/js/tabulator.js',
};

const UNPKG = {
  'alpinejs': 'dist/cdn.min.js',
  '@alpinejs/collapse': 'dist/cdn.min.js',
  '@alpinejs/sort': 'dist/module.cjs.js',
  'daisyui': 'index.js',
  'tabulator-tables': 'dist/js/tabulator.js',
};

const sha = b => createHash('sha1').update(b).digest('hex');
const served = url => sha(Buffer.from(resolveCdn(url, repoRoot).body));
const file = (pkg, rel) => sha(readFileSync(path.join(repoRoot, 'node_modules', pkg, rel)));

for (const [pkg, rel] of Object.entries(JSDELIVR)) {
  test(`jsDelivr npm/${pkg} serves ${rel}, the file jsDelivr serves`, () => {
    assert.equal(served(`https://cdn.jsdelivr.net/npm/${pkg}`), file(pkg, rel));
  });
}

for (const [pkg, rel] of Object.entries(UNPKG)) {
  test(`unpkg ${pkg} serves ${rel}, the file unpkg redirects to`, () => {
    assert.equal(served(`https://unpkg.com/${pkg}`), file(pkg, rel));
  });
}

test('a version suffix resolves the same way on both hosts', () => {
  assert.equal(served('https://cdn.jsdelivr.net/npm/alpinejs@3'), file('alpinejs', JSDELIVR.alpinejs));
  assert.equal(served('https://unpkg.com/alpinejs@3'), file('alpinejs', UNPKG.alpinejs));
});

test('an explicit file path still wins over either rule', () => {
  assert.equal(served('https://cdn.jsdelivr.net/npm/alpinejs@3/dist/cdn.min.js'), file('alpinejs', 'dist/cdn.min.js'));
});
