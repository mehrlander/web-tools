// kits/session-usage.js: fromExtract against read. A usage extract is
// web-tools-private's sessions/usage/YYYY/MM/<record name>.json, written by
// that repo's sessions/tools/usage.py from a session record by the kit's own
// rules, so the Compactions tab can draw a session without its record. The two
// readings must agree. The fixtures are a made-up record (no real session's
// text belongs in this public repo) and the extract usage.py wrote from it, and
// the same record with every prompt from another session, which leaves every
// step without an owner prompt. The record exercises each rule the two share:
// a step before the first prompt, a peer note, an idle re-load at each cache
// lifetime, the first step after a compaction, an unpriced model, a skipped
// step, a step out of time order and a prompt with no steps.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { loadKit, repoRoot } from './bootstrap.mjs';

const U = loadKit('session-usage').SessionUsage;
const fixture = (name) => JSON.parse(readFileSync(path.join(repoRoot, 'node/test/fixtures/session-usage', name), 'utf8'));
const close = (a, b, what) => assert.ok(Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a)), `${what}: ${a} != ${b}`);

function agree(record, extract) {
  const a = U.read(record), b = U.fromExtract(extract);
  assert.equal(b.prompts.length, a.prompts.length, 'prompt count');
  a.prompts.forEach((p, i) => {
    const q = b.prompts[i];
    for (const k of ['n', 'prompt', 'at', 'steps', 'context', 'reloads', 'compaction', 'unpriced']) {
      assert.equal(q[k], p[k], `prompt ${p.n}: ${k}`);
    }
    for (const k of ['cost', 'rest', 'reload']) close(p[k], q[k], `prompt ${p.n}: ${k}`);
  });
  assert.deepEqual(b.compactions, a.compactions);
  for (const k of ['measured', 'harness', 'reloads', 'steps', 'prompts', 'compactions']) {
    assert.equal(b.totals[k], a.totals[k], `totals.${k}`);
  }
  close(a.totals.modelled, b.totals.modelled, 'totals.modelled');
  close(a.totals.reload, b.totals.reload, 'totals.reload');
  assert.deepEqual(b.totals.unpriced, a.totals.unpriced);
  return { a, b };
}

test('read of the record and fromExtract of its extract agree on every prompt and the totals', () => {
  const { a } = agree(fixture('record.json'), fixture('extract.json'));
  // The fixture reaches what it is for: both re-load kinds, a priced and an
  // unpriced model, a compaction inside a prompt, a prompt with no steps.
  assert.deepEqual(a.prompts.map((p) => p.reloads), [0, 1, 1, 0]);
  assert.deepEqual(a.totals.unpriced, ['claude-sonnet-5-5']);
  assert.deepEqual(a.prompts.map((p) => p.compaction), [false, true, true, false]);
  assert.equal(a.prompts[3].context, null);
  assert.ok(a.totals.reload > 0);
});

test('with no owner prompt the totals still agree, kept as the extract\'s unowned steps', () => {
  const { a, b } = agree(fixture('peer-record.json'), fixture('peer-extract.json'));
  assert.equal(a.prompts.length, 0);
  assert.ok(b.totals.modelled > 0 && b.totals.steps === a.totals.steps);
});

test('an extract carries tokens only: its dollars come from the kit\'s one price table', () => {
  const x = fixture('extract.json');
  assert.equal(x.schema, 'usage/1');
  const { harness_cost, ...rest } = x;
  assert.doesNotMatch(JSON.stringify(rest), /cost|usd|price/i);
  const cheaper = loadKit('session-usage').SessionUsage;
  cheaper.PRICES['claude-opus-5-5'].output /= 2;
  assert.ok(cheaper.fromExtract(x).totals.modelled < U.fromExtract(x).totals.modelled);
});

test('the compaction names match the store\'s summary files', () => {
  const b = U.fromExtract(fixture('extract.json'));
  assert.deepEqual(b.compactions.map((c) => c.name),
    ['2026-11-04-0ddba11a-20261104T120000Z', '2026-11-04-0ddba11a-20261104T140000Z']);
});
