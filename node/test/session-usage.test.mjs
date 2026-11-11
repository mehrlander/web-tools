// kits/session-usage.js: a session record as per-prompt cost and context, the
// arithmetic behind the session view's Cost tab. Driven over a small inline
// record whose every figure can be worked by hand: two owner prompts and one
// from another session, five steps, one compaction.

import test from 'node:test';
import assert from 'node:assert/strict';
import { loadKit } from './bootstrap.mjs';

const U = loadKit('session-usage').SessionUsage;
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

const step = (at, input, read, write, output, extra = {}) => ({
  at, model: 'claude-opus-5-5',
  usage: { input_tokens: input, cache_read_input_tokens: read, cache_creation_input_tokens: write,
           output_tokens: output, ...extra },
});

const record = {
  schema: 17, day: '2026-11-03', short: 'abcd1234',
  cost: { totalCostUSD: 9.5 },
  prompts: [
    { at: '2026-11-03T10:00:00.000Z', text: 'first' },
    { at: '2026-11-03T10:30:00.000Z', text: 'peer note', origin: 'peer' },
    { at: '2026-11-03T13:00:00.000Z', text: 'second' },
  ],
  injected: [{ kind: 'compaction', at: '2026-11-03T14:00:00.000Z', chars: 1234, body: 'x' },
             { kind: 'stop_hook', at: '2026-11-03T14:00:01.000Z' }],
  responses: [
    // Before the first prompt: belongs to it. The session's first step, so not
    // a re-load though it writes everything.
    step('2026-11-03T09:59:59.000Z', 0, 0, 200000, 100),
    // After the peer note: still the first prompt's, since the note has an origin.
    step('2026-11-03T10:31:00.000Z', 0, 200000, 1000, 100),
    // Two hours idle: the whole context written again on 201,000 tokens.
    step('2026-11-03T13:00:05.000Z', 0, 1000, 200000, 100),
    // The first step after the compaction writes a fresh context: not a re-load.
    step('2026-11-03T14:00:05.000Z', 0, 0, 160000, 100),
    // Zero context: skipped.
    step('2026-11-03T14:00:06.000Z', 0, 0, 0, 0),
  ],
};

test('steps go to the latest owner prompt, and the peer note is not a prompt', () => {
  const { prompts } = U.read(record);
  assert.deepEqual(prompts.map(p => [p.n, p.prompt, p.steps]), [[1, 0, 2], [2, 2, 2]]);
  assert.equal(prompts[0].context, 201000);
  assert.equal(prompts[1].context, 160000);
});

test('cost at list prices, with one-hour writes at twice the input price', () => {
  const { prompts, totals } = U.read(record);
  // 200,000 written at $8 + 100 out at $20 ; 200,000 read at $0.20 + 1,000 written + 100 out.
  const a = (200000 * 8 + 100 * 20) / 1e6, b = (200000 * 0.2 + 1000 * 8 + 100 * 20) / 1e6;
  close(prompts[0].cost, a + b);
  close(prompts[0].reload, 0);
  const c = (1000 * 0.2 + 200000 * 8 + 100 * 20) / 1e6, d = (160000 * 8 + 100 * 20) / 1e6;
  close(prompts[1].cost, c + d);
  close(totals.modelled, a + b + c + d);
  assert.equal(totals.harness, 9.5);
  assert.equal(totals.measured, true);
  assert.equal(totals.steps, 4);
});

test('an idle re-load is priced at write less read, apart from the rest', () => {
  const { prompts, totals } = U.read(record);
  close(prompts[1].reload, 200000 * (8 - 0.2) / 1e6);
  close(prompts[1].rest, prompts[1].cost - prompts[1].reload);
  assert.equal(prompts[1].reloads, 1);
  assert.equal(totals.reloads, 1);
});

test('a compaction gives its context either side and marks its prompt', () => {
  const { compactions, prompts, totals } = U.read(record);
  assert.equal(totals.compactions, 1);
  assert.deepEqual(compactions[0], { at: '2026-11-03T14:00:00.000Z', name: '2026-11-03-abcd1234-20261103T140000Z',
                                     chars: 1234, before: 201000, after: 160000, prompt: 2 });
  assert.deepEqual(prompts.map(p => p.compaction), [false, true]);
});

test('five-minute writes cost 1.25 times input, and an unsplit count is one-hour', () => {
  const split = U.stepCost(step('t', 0, 0, 1000, 0, { cache_creation: { ephemeral_5m_input_tokens: 1000, ephemeral_1h_input_tokens: 0 } }));
  close(split.cost, 1000 * 4 * 1.25 / 1e6);
  close(U.stepCost(step('t', 0, 0, 1000, 0)).cost, 1000 * 8 / 1e6);
  const fable = U.stepCost({ model: 'claude-fable-5-2', usage: { input_tokens: 10, output_tokens: 10, cache_read_input_tokens: 10 } });
  close(fable.cost, (10 * 8 + 10 * 40 + 10 * 0.2) / 1e6);
});

test('an unknown model gets no price and is named, never guessed', () => {
  const r = { ...record, responses: [{ ...step('2026-11-03T10:01:00.000Z', 5, 0, 0, 5), model: 'claude-sonnet-5-5' }] };
  const { prompts, totals } = U.read(r);
  assert.deepEqual(totals.unpriced, ['claude-sonnet-5-5']);
  assert.equal(prompts[0].unpriced, true);
  assert.equal(prompts[0].cost, 0);
  assert.equal(totals.modelled, 0);
});

test('a record with no responses is not measured', () => {
  const { totals, prompts } = U.read({ prompts: record.prompts });
  assert.equal(totals.measured, false);
  assert.equal(totals.modelled, null);
  assert.equal(prompts.length, 2);
});
