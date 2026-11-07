// docs/machines.csv: one row per computer work runs on, rendered as the Map
// view Set tab's machine boxes. writers.csv's `machine`, run-methods.csv's
// `machines` and credentials.csv's `held_at` declare that they reference it,
// and properties-registry.test.mjs holds every declared reference. What is
// left here is what a declaration cannot reach: errands.js's MACHINES literal,
// which an errand's run.venue must be one of, the Set tab's reading of the
// registry, and the document that shares its subject.
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
const machines = Csv.rows(read('docs/machines.csv'));
const keys = new Set(machines.map(v => v.machine));

test('every machine has one row, a label and a Phosphor icon', () => {
  assert.equal(keys.size, machines.length, 'a machine key appears twice');
  for (const v of machines) {
    assert.ok(v.label, `${v.machine}: no label`);
    assert.match(v.icon, /^ph-[a-z-]+$/, `${v.machine}: icon ${v.icon} is not a Phosphor class`);
  }
});

test('MACHINES is exactly the machines run-methods.csv allows', () => {
  const used = new Set(Csv.rows(read('docs/run-methods.csv')).flatMap(m => Csv.list(m.machines)));
  assert.deepEqual([...Errands.MACHINES].sort(), [...used].sort(),
    'errands.js MACHINES differs from the machines run-methods.csv allows');
});

test('the Set tab takes its machine boxes from the registry, not a list of its own', () => {
  const map = read('lib/alpineComponents/map.js');
  assert.ok(!/WRITERS_MACHINES/.test(map), 'map.js carries its own machine list again');
  assert.ok(map.includes("'docs/machines.csv'"), 'map.js no longer reads docs/machines.csv');
});

test('docs/machines.md points at the registry it shares the subject with', () => {
  assert.ok(read('docs/machines.md').includes('machines.csv'), 'docs/machines.md does not link docs/machines.csv');
});
