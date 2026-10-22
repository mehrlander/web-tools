// docs/intents.csv: one row per thing you might want done that raises where to
// do it, rendered as the "I want to…" row of the Map view's Set tab. A row's
// path runs through the Set diagram: what starts the work, the writers that
// carry it in order, and where it lands. The tab lights exactly that path, so
// every step has to be a line the diagram draws from docs/writers.csv: the
// first writer is started by the path's start, each later writer is started by
// the one before it, and the last writer sets where the path lands. An intent
// that fails here names a route the estate does not have, or a writer whose
// row has fallen behind what it does.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { repoRoot } from '../repo-root.mjs';

const read = (p) => readFileSync(path.join(repoRoot, p), 'utf8').replace(/^﻿/, '');
const ctx = { window: {} };
vm.runInNewContext(read('lib/kits/csv.js'), ctx);
const { Csv } = ctx.window;
const writers = new Map(Csv.rows(read('docs/writers.csv')).map(r => [r.writer, r]));
const intents = Csv.rows(read('docs/intents.csv'));

test('every intent has its words, and no key appears twice', () => {
  assert.ok(intents.length, 'docs/intents.csv has no rows');
  assert.equal(new Set(intents.map(r => r.intent)).size, intents.length, 'an intent key appears twice');
  for (const r of intents)
    for (const f of ['want', 'path', 'who', 'lands', 'catch'])
      assert.ok(String(r[f] || '').trim(), `${r.intent}: ${f} is blank`);
});

test('every intent is a path the Set diagram draws', () => {
  for (const r of intents) {
    const steps = Csv.list(r.path);
    const start = /^start:(.+)$/.exec(steps[0] || '')?.[1];
    const dest = /^dest:(.+)$/.exec(steps.at(-1) || '')?.[1];
    const ids = steps.slice(1, -1);
    assert.ok(start && dest && ids.length, `${r.intent}: a path is start:<what>;<writer>…;dest:<where>`);
    for (const id of ids) assert.ok(writers.has(id), `${r.intent}: ${id} is not a writer`);
    assert.ok(Csv.list(writers.get(ids[0]).starts).includes(start),
      `${r.intent}: ${ids[0]} is not started by ${start}`);
    for (let i = 1; i < ids.length; i++)
      assert.ok(Csv.list(writers.get(ids[i]).started_by_writer).includes(ids[i - 1]),
        `${r.intent}: ${ids[i - 1]} does not start ${ids[i]}`);
    assert.ok(Csv.list(writers.get(ids.at(-1)).sets_on).includes(dest),
      `${r.intent}: ${ids.at(-1)} does not set on ${dest}`);
  }
});

test('every intent\'s document is a file in this tree', () => {
  for (const r of intents) if (r.doc)
    assert.ok(existsSync(path.join(repoRoot, r.doc.split('#')[0])), `${r.intent}: ${r.doc} does not exist`);
});
