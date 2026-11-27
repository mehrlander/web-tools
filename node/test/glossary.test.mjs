// glossary.test.mjs — the glossary's two authored files agree with each other
// and with the tree: docs/glossary/README.md states the format.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from './bootstrap.mjs';
import { parseCsv } from '../build/registries-load.mjs';

const read = (f) => parseCsv(readFileSync(join(repoRoot, 'docs/glossary', f), 'utf8'));
const terms = read('terms.csv');
const senses = read('senses.csv');
const names = new Set(terms.map((t) => t.term));

test('every sense belongs to a glossary term', () => {
  const orphans = senses.filter((s) => !names.has(s.term)).map((s) => `${s.term}/${s.sense}`);
  assert.deepEqual(orphans, []);
});

test('every term has a sense', () => {
  const held = new Set(senses.map((s) => s.term));
  assert.deepEqual([...names].filter((n) => !held.has(n)), []);
});

test('a term with a plain-sense collision lists its plain sense', () => {
  const plain = new Set(senses.filter((s) => s.domain === 'general').map((s) => s.term));
  const missing = terms.filter((t) => t.general === 'yes' && !plain.has(t.term)).map((t) => t.term);
  assert.deepEqual(missing, [], 'general: yes means the plain sense is in use and protected');
});

test('cf names glossary terms', () => {
  const bad = terms.flatMap((t) => (t.cf || '').split(';').filter(Boolean)
    .filter((c) => !names.has(c)).map((c) => `${t.term} -> ${c}`));
  assert.deepEqual(bad, []);
});

test('a sense home resolves into the tree, and only a plain sense lacks one', () => {
  const bad = senses.filter((s) => s.home ? !existsSync(join(repoRoot, s.home)) : s.domain !== 'general')
    .map((s) => `${s.term}/${s.sense}: ${s.home || '(blank)'}`);
  assert.deepEqual(bad, []);
});

test('replaced_by is set exactly on retired senses', () => {
  const bad = senses.filter((s) => (s.status === 'retired') !== Boolean(s.replaced_by))
    .map((s) => `${s.term}/${s.sense}`);
  assert.deepEqual(bad, []);
});
