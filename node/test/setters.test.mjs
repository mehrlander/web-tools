// docs/setters.csv: one row per setter, rendered as the Map view's Set tab.
// The properties gate already holds each closed column to its declared values;
// what it cannot see is the file's own references. A setter named as another's
// starter has to exist, a setter has to be started by something, a model
// belongs to an agent and only to one, a Writes view kind has to be one
// write-kinds.js knows, and a local definition has to be a file in this tree.
// docs/direct-to-main.csv joins to it by its `setters` column, so every key
// there has to be a setter here. Every value the tab labels has its label in
// docs/vocabularies.csv, since the tab reads its words from there.
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
const setters = Csv.rows(read('docs/setters.csv'));
const ids = new Set(setters.map(r => r.setter));

test('every setter is started by something, and every setter it names exists', () => {
  assert.equal(ids.size, setters.length, 'a setter key appears twice');
  for (const r of setters) {
    const by = Csv.list(r.started_by_setter);
    assert.ok(Csv.list(r.starts).length || by.length, `${r.setter}: nothing starts it`);
    for (const id of by) {
      assert.ok(ids.has(id), `${r.setter}: started_by_setter names ${id}, which is not a setter`);
      assert.notEqual(id, r.setter, `${r.setter}: starts itself`);
    }
    if (r.polls) assert.ok(by.length || Csv.list(r.starts).includes('event'),
      `${r.setter}: polls, but names no setter or event it waits for`);
  }
});

test('a model belongs to an agent setter, and every agent setter names one', () => {
  for (const r of setters) assert.equal(!!r.model, r.kind === 'agent', `${r.setter}: kind ${r.kind} with model "${r.model}"`);
});

test('a Writes view kind is one write-kinds.js knows, and a local definition exists', () => {
  for (const r of setters) {
    if (r.write_kind) assert.ok(WriteKinds.BY_KEY[r.write_kind], `${r.setter}: write_kind ${r.write_kind} is not a Writes view kind`);
    if (!/^[\w.-]+\/[\w.-]+@[^:]+:/.test(r.defined_in))
      assert.ok(existsSync(path.join(repoRoot, r.defined_in)), `${r.setter}: defined_in ${r.defined_in} is not a file here`);
  }
});

test('every setter docs/direct-to-main.csv names is a setter here', () => {
  const rows = Csv.rows(read('docs/direct-to-main.csv'));
  for (const d of rows) {
    const named = Csv.list(d.setters);
    assert.ok(named.length, `${d.process}: names no setter`);
    for (const id of named) assert.ok(ids.has(id), `${d.process}: setters names ${id}, which is not in docs/setters.csv`);
  }
});

test('every value the tab labels has its label in docs/vocabularies.csv', () => {
  const vocab = new Set(Csv.rows(read('docs/vocabularies.csv'))
    .filter(v => v.registry === 'setters').map(v => v.property + '=' + v.value));
  const want = (prop, v) => assert.ok(vocab.has(prop + '=' + v), `setters.${prop} ${v} has no label in docs/vocabularies.csv`);
  for (const r of setters) {
    want('kind', r.kind);
    want('venue', r.venue);
    if (r.model) want('model', r.model);
    for (const s of Csv.list(r.starts)) want('starts', s);
    for (const w of Csv.list(r.sets_on)) want('sets_on', w);
    for (const m of Csv.list(r.mode)) want('mode', m);
  }
});
