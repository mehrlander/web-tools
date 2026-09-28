// lib/alpineComponents/*.js — the `description` string each component carries.
//
// The FAB's Inspect tab shows it under the component's row, at 13px, in a drawer
// 22rem wide. Two strings had grown into manuals there: the Map's to about 1,000
// words and the FAB's own to about 2,100. The Map's per-tab account moved to
// docs/map-tabs.csv and the FAB's to docs/fab.md on 2026-09-28, and each string
// now says what the component is and where the account lives.
//
// The bound is set above the longest remaining string (ref-switch.js, 140 words
// on that date) rather than fitted to it, so it catches a manual regrowing and
// not an ordinary edit.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const dir = path.join(repoRoot, 'lib', 'alpineComponents');
const LIMIT = 150;

// A description is a string literal or several joined with +. Read the literals
// and join them; anything else (a variable, a call) is reported, not guessed at.
const lit = String.raw`'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|` + '`[^`]*`';
const descRe = new RegExp(String.raw`^\s*description:\s*((?:${lit})(?:\s*\+\s*(?:${lit}))*)`, 'gm');
const unquote = s => s.slice(1, -1).replace(/\\(.)/g, '$1');

const found = [];
for (const f of readdirSync(dir).filter(f => f.endsWith('.js'))) {
  const src = readFileSync(path.join(dir, f), 'utf8');
  for (const m of src.matchAll(descRe)) {
    const text = [...m[1].matchAll(new RegExp(lit, 'g'))].map(x => unquote(x[0])).join('');
    found.push({ f, words: text.split(/\s+/).filter(Boolean).length });
  }
}

test('the scan reads the components it claims to', () => {
  assert.ok(found.length >= 25, 'descriptions parsed short: ' + found.length);
  assert.ok(found.some(d => d.f === 'fab.js') && found.some(d => d.f === 'map.js'));
});

test(`a component description stays under ${LIMIT} words`, () => {
  for (const d of found)
    assert.ok(d.words <= LIMIT,
      `${d.f}: description is ${d.words} words; the account belongs in a doc or a registry row`);
});

test('the two long accounts point at where they went', () => {
  const read = f => readFileSync(path.join(dir, f), 'utf8');
  assert.match(read('fab.js'), /description: '[^']*docs\/fab\.md/);
  assert.match(read('map.js'), /description: '[^']*docs\/map-tabs\.csv/);
});
