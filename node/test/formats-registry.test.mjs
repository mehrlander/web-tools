// docs/formats.csv: the JSON formats web-tools defines or renders, one row per
// format, keyed by the id its documents write (`user-call/1`) or by a bare
// name where they write none. The properties gate checks the columns' domains
// and that each route is a key of docs/routes-routes.csv; this holds the rows
// to the tree.
//
// The check that derives is the scan: every versioned id a tracked file writes
// under schema, kind, format, profile or envelope must have a row, with that
// key as its id_key, so a new format written into code without a row fails
// here. A path in another repository (owner/repo:path) is checked where that
// checkout sits beside this one, and skipped where it does not (CI).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';
import { parseCsv } from '../build/registries-load.mjs';

const read = (p) => readFileSync(path.join(repoRoot, p), 'utf8');
const rows = parseCsv(read('docs/formats.csv'));
const byId = new Map(rows.map(r => [r.id, r]));
const routes = new Set(parseCsv(read('docs/routes-routes.csv')).map(r => r.key));
const tracked = spawnSync('git', ['ls-files', '-z'], { cwd: repoRoot, encoding: 'utf8' }).stdout.split('\0').filter(Boolean);

// owner/repo:path names a file in a sibling checkout; anything else is a path here.
const CROSS = /^[\w.-]+\/([\w.-]+):(.+)$/;
function where(p) {
  const m = CROSS.exec(p);
  if (!m) return { file: path.join(repoRoot, p), here: true };
  const checkout = path.join(repoRoot, '..', m[1]);
  return { file: existsSync(checkout) ? path.join(checkout, m[2]) : null, here: false };
}

test('every contract and schema exists, here or in a sibling checkout that is present', () => {
  for (const r of rows) {
    for (const col of ['contract', 'schema']) {
      if (col === 'schema' && r.schema === 'none') continue;
      const { file } = where(r[col]);
      if (file) assert.ok(existsSync(file), `${r.id}: ${col} ${r[col]} does not exist`);
    }
  }
});

test('a producer in this repository exists', () => {
  for (const r of rows.filter(r => r.producer !== 'none')) {
    const { file, here } = where(r.producer);
    if (here) assert.ok(existsSync(file), `${r.id}: producer ${r.producer} does not exist`);
  }
});

test('a schema lives under docs/envelopes/schemas/, and validated is yes only where a test reads it', () => {
  const tests = tracked.filter(f => f.startsWith('node/test/') && f !== 'node/test/formats-registry.test.mjs');
  const texts = tests.map(f => read(f));
  for (const r of rows) {
    if (r.schema === 'none') {
      assert.equal(r.validated, 'no', `${r.id}: validated is yes, but there is no schema to validate against`);
      continue;
    }
    assert.ok(r.schema.startsWith('docs/envelopes/schemas/'), `${r.id}: schema ${r.schema} is outside docs/envelopes/schemas/`);
    const named = texts.some(t => t.includes(path.basename(r.schema)));
    assert.equal(r.validated, named ? 'yes' : 'no',
      `${r.id}: validated is ${r.validated}, but ${named ? 'a test names' : 'no test names'} ${r.schema}`);
  }
});

test('every route is a toss route of docs/routes-routes.csv', () => {
  for (const r of rows.filter(r => r.route)) assert.ok(routes.has(r.route), `${r.id}: route ${r.route} is not a toss route`);
});

test('a versioned id names the key its documents write it under', () => {
  for (const r of rows.filter(r => /\/\d+$/.test(r.id))) assert.notEqual(r.id_key, 'none', `${r.id}: a versioned id is written under a key`);
});

// Ids a test writes on purpose to see a reader refuse them. The list is exact
// both ways, so an entry cannot outlive the fixture it excuses.
const NOT_FORMATS = {
  'git-change/99': 'node/test/git-change.test.mjs gives a reader an unknown version',
  'other/1': 'node/test/errands.test.mjs pastes an envelope that is not an errand result',
};
// Derived copies of other files' text, which would only repeat what their sources write.
const DERIVED = ['dist/', 'data/comments/'];
const STRING_ID = /["']?(?<![\w$])\$?(schema|kind|format|profile|envelope)["']?\s*[:=]\s*["']([a-z][a-z0-9-]*\/\d+)["']/g;
const OBJECT_ID = /["']?\b(schema|profile)["']?\s*:\s*\{\s*["']?name["']?\s*:\s*["']([a-z][a-z0-9-]*)["']\s*,\s*["']?version["']?\s*:\s*(\d+)/g;

test('every versioned id a tracked file writes under one of the five keys is a row, with that key as its id_key', () => {
  const found = new Map();
  const note = (id, key, file) => {
    if (!found.has(id)) found.set(id, { keys: new Set(), file });
    found.get(id).keys.add(key);
  };
  for (const f of tracked) {
    if (!/\.(m?js|cjs|py|jsonl?|html)$/.test(f) || DERIVED.some(d => f.startsWith(d))) continue;
    const t = read(f);
    for (const m of t.matchAll(STRING_ID)) note(m[2], m[1], f);
    for (const m of t.matchAll(OBJECT_ID)) note(`${m[2]}/${m[3]}`, m[1], f);
  }
  for (const id of Object.keys(NOT_FORMATS)) assert.ok(found.has(id), `NOT_FORMATS names ${id}, which no file writes any more`);
  for (const [id, { keys, file }] of found) {
    if (NOT_FORMATS[id]) continue;
    const r = byId.get(id);
    assert.ok(r, `${id}, written in ${file}, has no row in docs/formats.csv`);
    assert.ok(keys.has(r.id_key), `${id}: id_key is ${r.id_key}, but ${file} writes it under ${[...keys].join(', ')}`);
  }
});
