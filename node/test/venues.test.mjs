// docs/venues.csv: one row per place work runs, rendered as the Map view Set
// tab's machine boxes. writers.csv's `machine` and run-methods.csv's `venues`
// declare that they reference it, and properties-registry.test.mjs holds every
// declared reference. What is left here is what a declaration cannot reach:
// errands.js's VENUES literal, the Set tab's reading of the registry, and the
// document that shares its subject.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { repoRoot } from '../repo-root.mjs';

const read = (p) => readFileSync(path.join(repoRoot, p), 'utf8').replace(/^﻿/, '');
const ctx = { window: {} };
vm.runInNewContext(read('lib/kits/csv.js'), ctx);
vm.runInNewContext(read('lib/kits/errands.js'), ctx);
const { Csv, Errands } = ctx.window;
const venues = Csv.rows(read('docs/venues.csv'));
const keys = new Set(venues.map(v => v.venue));

test('every venue has one row, a label and a Phosphor icon', () => {
  assert.equal(keys.size, venues.length, 'a venue key appears twice');
  for (const v of venues) {
    assert.ok(v.label, `${v.venue}: no label`);
    assert.match(v.icon, /^ph-[a-z-]+$/, `${v.venue}: icon ${v.icon} is not a Phosphor class`);
  }
});

test('VENUES is exactly the venues run-methods.csv allows', () => {
  const used = new Set(Csv.rows(read('docs/run-methods.csv')).flatMap(m => Csv.list(m.venues)));
  assert.deepEqual([...Errands.VENUES].sort(), [...used].sort(),
    'errands.js VENUES differs from the venues run-methods.csv allows');
});

test('the Set tab takes its machine boxes from the registry, not a list of its own', () => {
  const map = read('lib/alpineComponents/map.js');
  assert.ok(!/WRITERS_MACHINES/.test(map), 'map.js carries its own machine list again');
  assert.ok(map.includes("'docs/venues.csv'"), 'map.js no longer reads docs/venues.csv');
});

test('docs/venues.md points at the registry it shares the subject with', () => {
  assert.ok(read('docs/venues.md').includes('venues.csv'), 'docs/venues.md does not link docs/venues.csv');
});
