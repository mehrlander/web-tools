// docs/run-methods.csv owns how a person runs an errand's script; kits/errands.js
// carries a copy as its METHODS literal, so validate() and normalize() need no
// fetch. What breaks without this: the registry and the kit drift, and the card
// shows one method's rules while validate() enforces another's venues.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';
import { parseCsv, splitList } from '../build/registries-load.mjs';

const win = {};
new Function('window', readFileSync(path.join(repoRoot, 'lib/kits/errands.js'), 'utf8'))(win);
const E = win.Errands;
const rows = parseCsv(readFileSync(path.join(repoRoot, 'docs/run-methods.csv'), 'utf8'));
const list = (s) => splitList(s).map(x => x.trim()).filter(Boolean);

test('the METHODS literal and docs/run-methods.csv agree; the CSV is the owner', () => {
  const fromCsv = Object.fromEntries(rows.map(r => [r.method, {
    venues: list(r.venues), outputReturn: r.output_return, rules: list(r.rules) }]));
  assert.deepEqual(JSON.parse(JSON.stringify(E.METHODS)), fromCsv);
});

test('every venue a method allows is one the errand schema knows', () => {
  for (const r of rows) for (const v of list(r.venues)) assert.ok(E.VENUES.includes(v), r.method + ': ' + v);
});
