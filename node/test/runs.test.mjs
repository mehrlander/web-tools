// docs/runs.csv: one row per kind of run, rendered as the Map view's Runs tab.
// The properties gate already holds each closed column to its declared values;
// what it cannot see is the file's own references. A run named as another's
// starter has to exist, a run has to be started by something, a model belongs
// to an agent and only to one, a Writes view kind has to be one write-kinds.js
// knows, and a local definition has to be a file in this tree. Every value the
// tab labels has its label in docs/vocabularies.csv, since the tab reads its
// words from there.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(path.join(repoRoot, p), 'utf8');
const ctx = { window: {} };
vm.runInNewContext(read('lib/kits/csv.js'), ctx);
vm.runInNewContext(read('lib/kits/write-kinds.js'), ctx);
const { Csv, WriteKinds } = ctx.window;
const runs = Csv.rows(read('docs/runs.csv'));
const ids = new Set(runs.map(r => r.run));

test('every run is started by something, and every run it names exists', () => {
  assert.equal(ids.size, runs.length, 'a run key appears twice');
  for (const r of runs) {
    const by = Csv.list(r.started_by_run);
    assert.ok(Csv.list(r.starts).length || by.length, `${r.run}: nothing starts it`);
    for (const id of by) {
      assert.ok(ids.has(id), `${r.run}: started_by_run names ${id}, which is not a run`);
      assert.notEqual(id, r.run, `${r.run}: starts itself`);
    }
    if (r.polls) assert.ok(by.length || Csv.list(r.starts).includes('event'),
      `${r.run}: polls, but names no run or event it waits for`);
  }
});

test('a model belongs to an agent run, and every agent run names one', () => {
  for (const r of runs) assert.equal(!!r.model, r.kind === 'agent', `${r.run}: kind ${r.kind} with model "${r.model}"`);
});

test('a Writes view kind is one write-kinds.js knows, and a local definition exists', () => {
  for (const r of runs) {
    if (r.write_kind) assert.ok(WriteKinds.BY_KEY[r.write_kind], `${r.run}: write_kind ${r.write_kind} is not a Writes view kind`);
    if (!/^[\w.-]+\/[\w.-]+@[^:]+:/.test(r.defined_in))
      assert.ok(existsSync(path.join(repoRoot, r.defined_in)), `${r.run}: defined_in ${r.defined_in} is not a file here`);
  }
});

test('every value the tab labels has its label in docs/vocabularies.csv', () => {
  const vocab = new Set(Csv.rows(read('docs/vocabularies.csv'))
    .filter(v => v.registry === 'runs').map(v => v.property + '=' + v.value));
  const want = (prop, v) => assert.ok(vocab.has(prop + '=' + v), `runs.${prop} ${v} has no label in docs/vocabularies.csv`);
  for (const r of runs) {
    want('kind', r.kind);
    want('venue', r.venue);
    if (r.model) want('model', r.model);
    for (const s of Csv.list(r.starts)) want('starts', s);
    for (const w of Csv.list(r.writes_to)) want('writes_to', w);
  }
});
