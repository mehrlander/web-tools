// docs/machines.csv: one row per computer work runs on, rendered as the Map
// view Set tab's machine boxes. Three things spell a machine by its key:
// writers.csv's `machine`, run-methods.csv's `machines`, and errands.js's
// MACHINES, which an errand's run.venue must be one of. What breaks without
// this: each grows its own spelling of the same machine, as the three did
// before the registry, and a label or gloss is written twice.
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

test('every writer runs on machines the registry lists', () => {
  for (const r of Csv.rows(read('docs/writers.csv'))) {
    const ms = Csv.list(r.machine);
    assert.ok(ms.length, `${r.writer}: no machine`);
    for (const m of ms) assert.ok(keys.has(m), `${r.writer}: machine ${m} is not a docs/machines.csv key`);
  }
});

test('every machine a run method allows is a machine, and MACHINES is exactly those', () => {
  const used = new Set(Csv.rows(read('docs/run-methods.csv')).flatMap(m => Csv.list(m.machines)));
  for (const v of used) assert.ok(keys.has(v), `run-methods.csv names ${v}, which is not a docs/machines.csv key`);
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
