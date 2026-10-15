// docs/writers.csv: one row per writer, rendered as the Map view's Set tab.
// A writer is a program that makes a commit or moves a branch in an estate
// repository; two writers differ by program, machine, or kind (who decided what
// a commit contains). The properties gate already holds each closed column to
// its declared values; what it cannot see is the file's own references. A
// writer named as another's starter has to exist, a writer has to be started
// by something, a model belongs to an agent and only to one, a Writes view kind
// has to be one write-kinds.js knows, and a local definition has to be a file
// in this tree. docs/direct-to-main.csv joins to it by its `writer` column, so
// every key there has to be a writer here. Every value the tab labels has its
// label in docs/vocabularies.csv, since the tab reads its words from there.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(path.join(repoRoot, p), 'utf8').replace(/^﻿/, '');
const ctx = { window: {} };
vm.runInNewContext(read('lib/kits/csv.js'), ctx);
vm.runInNewContext(read('lib/kits/write-kinds.js'), ctx);
const { Csv, WriteKinds } = ctx.window;
const writers = Csv.rows(read('docs/writers.csv'));
const ids = new Set(writers.map(r => r.writer));

test('every writer is started by something, and every writer it names exists', () => {
  assert.equal(ids.size, writers.length, 'a writer key appears twice');
  for (const r of writers) {
    const by = Csv.list(r.started_by_writer);
    assert.ok(Csv.list(r.starts).length || by.length, `${r.writer}: nothing starts it`);
    for (const id of by) {
      assert.ok(ids.has(id), `${r.writer}: started_by_writer names ${id}, which is not a writer`);
      assert.notEqual(id, r.writer, `${r.writer}: starts itself`);
    }
    if (r.polls) assert.ok(by.length || Csv.list(r.starts).includes('event'),
      `${r.writer}: polls, but names no writer or event it waits for`);
  }
});

test('a writer is named after its program, and a person goes in kind', () => {
  for (const r of writers) assert.ok(!/^you\b/i.test(r.name), `${r.writer}: "${r.name}" names a person, not a program`);
});

test('a model belongs to an agent writer, and every agent writer names one', () => {
  for (const r of writers) assert.equal(!!r.model, r.kind === 'agent', `${r.writer}: kind ${r.kind} with model "${r.model}"`);
});

test('a Writes view kind is one write-kinds.js knows, and a local definition exists', () => {
  for (const r of writers) {
    for (const k of Csv.list(r.write_kind))
      assert.ok(WriteKinds.BY_KEY[k], `${r.writer}: write_kind ${k} is not a Writes view kind`);
    if (!/^[\w.-]+\/[\w.-]+@[^:]+:/.test(r.defined_in))
      assert.ok(existsSync(path.join(repoRoot, r.defined_in)), `${r.writer}: defined_in ${r.defined_in} is not a file here`);
  }
});

// An errand's run.venue names the machine a person runs code on (docs/venues.md
// notes the fields that share the word). This column is a machine too,
// so it is named `machine` and spells a machine the way run-methods.csv does.
// Two values are writers' own, because no run method runs there: the cloud
// container a web session uses, and "your computer", which is coarser than
// run.venue's personal-laptop and work-machine.
test('a machine is spelled as run-methods.csv spells it, except the two writers alone need', () => {
  const runVenues = new Set(Csv.rows(read('docs/run-methods.csv')).flatMap(m => Csv.list(m.venues)));
  const own = new Set(['container', 'computer']);
  for (const r of writers)
    assert.ok(runVenues.has(r.machine) || own.has(r.machine),
      `${r.writer}: machine ${r.machine} is neither a run-methods.csv venue nor container or computer`);
  for (const v of own) assert.ok(!runVenues.has(v), `run-methods.csv now spells ${v}; drop it from this test's own list`);
});

test('every writer docs/direct-to-main.csv names is a writer here', () => {
  const rows = Csv.rows(read('docs/direct-to-main.csv'));
  for (const d of rows) {
    const named = Csv.list(d.writer);
    assert.ok(named.length, `${d.process}: names no writer`);
    for (const id of named) assert.ok(ids.has(id), `${d.process}: writer names ${id}, which is not in docs/writers.csv`);
  }
});

test('every value the tab labels has its label in docs/vocabularies.csv', () => {
  const vocab = new Set(Csv.rows(read('docs/vocabularies.csv'))
    .filter(v => v.registry === 'writers').map(v => v.property + '=' + v.value));
  const want = (prop, v) => assert.ok(vocab.has(prop + '=' + v), `writers.${prop} ${v} has no label in docs/vocabularies.csv`);
  for (const r of writers) {
    want('kind', r.kind);
    want('machine', r.machine);
    if (r.model) want('model', r.model);
    for (const s of Csv.list(r.starts)) want('starts', s);
    for (const w of Csv.list(r.sets_on)) want('sets_on', w);
    for (const m of Csv.list(r.mode)) want('mode', m);
  }
});
