// kits/usage-readings.js: every session's usage extract folded into the five
// readings the app's Usage tab draws. The extracts under fixtures/usage are
// made up (no real session's text belongs in this public repo), in the shape
// web-tools-private's sessions/tools/usage.py writes, with round token counts
// so each figure below can be worked by hand from kits/session-usage.js's
// prices: Opus at 4 in, 20 out, 0.20 a cache read, 8 and 5 the two cache
// writes; Fable at 8, 40, 0.20, 16 and 10; all per million tokens.
//
//   aaaa0001  Opus: prompts of 1, 3, 20 and 0 calls, one idle re-load the owner
//             ended, one compaction that paid for itself
//   bbbb0002  Fable: prompts of 70 and 5 calls, re-loads ended by another
//             session and by a pull request, a compaction after an idle hour
//             that did not pay back, and one with no call after it
//   cccc0003  Opus, in the extract shape of before 2026-11-13: no
//             last_step_model, no idle_reloads, a compaction row of four keys
//   dddd0004  a model the price table lacks
//   eeee0005  Opus, no owner prompt: its steps are the extract's unowned ones

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { loadKit, repoRoot } from './bootstrap.mjs';

const kits = () => loadKit('usage-readings', { window: loadKit('session-usage') });
const W = kits();
const R = W.UsageReadings;
const DIR = path.join(repoRoot, 'node/test/fixtures/usage');
const extracts = readdirSync(DIR).filter((f) => f.endsWith('.json')).sort().map((f) => JSON.parse(readFileSync(path.join(DIR, f), 'utf8')));
const close = (a, b, what) => assert.ok(Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b)), `${what}: ${a} != ${b}`);
// Fifteen minutes after the newest session's last step.
const NOW = Date.parse('2026-11-04T10:00:00.000Z');
const r = R.fold(extracts, { now: NOW });
const by = (short) => r.sessions.find((s) => s.short === short);

test('spend: four parts that add up to the total, and the same four per session, dearest first', () => {
  close(r.spend.parts.read, 7.104, 'context reads, with the uncached input');
  close(r.spend.parts.reload, 13.28, 'idle re-loads, at the full write price');
  close(r.spend.parts.write, 14.8, 'the other cache writes');
  close(r.spend.parts.output, 5.42, 'output');
  close(r.spend.total, 40.604, 'total');
  assert.deepEqual(r.spend.rows.map((s) => s.short), ['bbbb0002', 'aaaa0001', 'cccc0003', 'eeee0005']);
  for (const s of r.spend.rows) close(s.parts.read + s.parts.reload + s.parts.write + s.parts.output, s.cost, s.short);
  close(r.spend.rows[0].cost, 26.28, 'bbbb0002');
  close(r.spend.rows[1].cost, 11.104, 'aaaa0001');
  close(r.spend.max, 26.28, 'the scale of the rows');
  close(r.spend.rows.reduce((a, s) => a + s.cost, 0), r.spend.total, 'the rows make the total');
  close(by('eeee0005').parts.reload, 1.28, 'steps with no owner prompt are priced too');
  assert.equal(r.spend.sessions, 5);
  assert.equal(r.spend.from, '2026-10-20');
  assert.equal(r.spend.to, '2026-11-04T09:45:00.000Z');
});

test('a model with no price adds nothing, and its session is named rather than guessed', () => {
  assert.deepEqual(r.spend.unpriced, [{ model: 'claude-sonnet-5-5', sessions: 1 }]);
  assert.equal(by('dddd0004').cost, 0);
  assert.equal(r.spend.rows.some((s) => s.short === 'dddd0004'), false);
});

test('every dollar is priced from the session-usage table: the kit holds no price', () => {
  const cheaper = kits();
  cheaper.SessionUsage.PRICES['claude-opus-5-5'].output /= 2;
  const half = cheaper.UsageReadings.fold(extracts, { now: NOW });
  close(r.spend.parts.output - half.spend.parts.output, (1.3 + 0.02 + 0.02) / 2, 'half the Opus output');
  const dearer = kits();
  dearer.SessionUsage.WRITE_1H *= 2;
  close(dearer.UsageReadings.fold(extracts, { now: NOW }).spend.parts.reload, 2 * 11.28 + 2.0, 'the one-hour multiple doubled, the five-minute one left');
  const src = readFileSync(path.join(repoRoot, 'lib/kits/usage-readings.js'), 'utf8').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  assert.doesNotMatch(src, /\b(input|output|cacheRead|read|w1|w5)\s*:\s*(?:[1-9][\d.]*|0?\.\d*[1-9]\d*)\s*[,}]/, 'a price written into the kit');
  assert.match(src, /U\.PRICES\[model\]/);
  assert.match(src, /U\.WRITE_1H/);
  assert.match(src, /U\.WRITE_5M/);
});

test('the same extract prices to the same total as SessionUsage.fromExtract', () => {
  const x = JSON.parse(readFileSync(path.join(repoRoot, 'node/test/fixtures/session-usage/extract.json'), 'utf8'));
  const s = R.session(x, NOW), u = W.SessionUsage.fromExtract(x);
  close(s.cost, u.totals.modelled, 'modelled total');
  // fromExtract keeps a re-load as what it cost over a warm step; here it is
  // the whole write, which is that plus the read it stood in for.
  const written = x.prompts.reduce((a, p) => a + (p.models['claude-opus-5-5']?.reload_written || 0), 0);
  close(s.parts.reload - written * 0.20 / 1e6, u.totals.reload, 'idle re-loads');
  assert.equal(s.reloads.length, u.totals.reloads);
  assert.deepEqual(s.unpriced, u.totals.unpriced);
  assert.deepEqual(s.compactions.map((c) => c.name), u.compactions.map((c) => c.name));
});

test('calls: prompts binned by their model calls, as shares of the prompts and of the calls', () => {
  const c = r.calls;
  assert.equal(c.prompts, 7);
  assert.equal(c.calls, 105);
  assert.equal(c.none, 1, 'a prompt with no call is counted apart');
  assert.equal(c.median, 4);
  assert.equal(c.mean, 15);
  assert.deepEqual(c.bins.map((b) => [b.lo, b.hi, b.prompts, b.calls]),
    [[1, 1, 1, 1], [2, 3, 2, 5], [4, 7, 2, 9], [8, 15, 0, 0], [16, 31, 1, 20], [32, 63, 0, 0], [64, Infinity, 1, 70]]);
  close(c.bins.reduce((a, b) => a + b.promptShare, 0), 1, 'prompt shares');
  close(c.bins.reduce((a, b) => a + b.callShare, 0), 1, 'call shares');
  close(c.bins[6].callShare, 70 / 105, 'one prompt in seven made two thirds of the calls');
  close(c.max, 70 / 105, 'the scale both bars share');
  assert.equal(by('eeee0005').calls, 6, 'steps under no prompt are a session\'s calls, and no prompt\'s');
});

test('re-loads: by what ended the gap, in the dollars they wrote, adding up to spend\'s', () => {
  const rows = Object.fromEntries(r.reloads.rows.map((x) => [x.ender, x]));
  assert.deepEqual(r.reloads.rows.map((x) => x.ender), ['session', 'owner', 'pr', 'task', 'unlisted'], 'dearest first, the unlisted last');
  close(rows.session.cost, 6.4, 'another session, at the one-hour rate');
  close(rows.pr.cost, 2.0, 'a pull request, at the five-minute rate');
  close(rows.owner.cost, 2.0, 'the owner');
  close(rows.task.cost, 1.28, 'a background task');
  assert.equal(rows.owner.gap, 7200000);
  assert.equal(rows.pr.gap, 18000000);
  assert.deepEqual([rows.unlisted.n, rows.unlisted.gap], [1, null], 'an older extract counts its re-loads under no ender');
  close(rows.unlisted.cost, 1.6, 'what its prompts say they wrote');
  assert.equal(r.reloads.n, 5);
  close(r.reloads.cost, r.spend.parts.reload, 'the rows make spend\'s idle re-loads');
  const odd = R.session({ ...extracts[0], idle_reloads: [{ at: '2026-11-01T10:30:05.000Z', gap_ms: 1, ender: 'something new', model: 'claude-opus-5-5', write_1h: 1000000, write_5m: 0 }] }, NOW);
  assert.equal(odd.reloads[0].ender, 'other', 'an ender this kit does not know reads as other');
});

test('continue: the context at the read price while warm, at the one-hour write price once lapsed', () => {
  const c = r.continue;
  assert.deepEqual(c.rows.map((s) => s.short), ['aaaa0001', 'cccc0003', 'eeee0005', 'bbbb0002', 'dddd0004'], 'dearest first, the unpriced last');
  assert.deepEqual([c.warm, c.lapsed], [1, 4]);
  const warm = by('bbbb0002').continue;
  assert.equal(warm.lapsed, false);
  close(warm.cost, 0.1, 'warm: 500k at the cache-read price');
  close(warm.cold, 8.0, 'what it becomes: 500k at Fable\'s one-hour write price');
  assert.equal(warm.left, 45 * 60000);
  close(by('aaaa0001').continue.cost, 3.2, 'lapsed: 400k at Opus\'s one-hour write price');
  close(c.max, 3.2, 'the scale');
  const old = by('cccc0003').continue;
  assert.equal(old.model, 'claude-opus-5-5', 'no last_step_model: the busiest model of the last prompt that used one');
  close(old.cost, 2.4, '300k at Opus\'s one-hour write price');
  assert.deepEqual([by('dddd0004').continue.cost, by('dddd0004').continue.cold], [null, null]);
});

test('continue: exactly an hour idle is still warm, a millisecond more is not', () => {
  const last = Date.parse('2026-11-04T09:45:00.000Z');
  const at = (ms) => R.session(extracts.find((e) => e.short === 'bbbb0002'), last + ms).continue;
  assert.deepEqual([at(3600000).lapsed, at(3600000).left], [false, 0]);
  assert.equal(at(3600001).lapsed, true);
  close(at(3600001).cost, 8.0, 'lapsed');
  assert.equal(R.session({ ...extracts[0], context_now: null }, NOW).continue, null, 'no context, no row');
});

test('compactions: an estimated cost, the saving over the calls that followed, and the break-even', () => {
  const c = Object.fromEntries(r.compactions.rows.map((x) => [x.name, x]));
  assert.deepEqual(r.compactions.rows.map((x) => x.name), ['2026-11-02-bbbb0002-20261104T094400Z', '2026-11-02-bbbb0002-20261103T150000Z',
    '2026-11-01-aaaa0001-20261101T104500Z', '2026-10-20-cccc0003-20261020T170000Z'], 'newest first, named as the summaries store names them');
  const paid = c['2026-11-01-aaaa0001-20261101T104500Z'];
  close(paid.summary, 0.36, 'the summarizing call: 800k read from the cache and 10k tokens out');
  close(paid.first, 0.8, 'the first call after, as recorded');
  close(paid.cost, 1.16, 'cost');
  close(paid.perCall, 0.14, 'each call after reads 700k less');
  close(paid.saved, 14, 'over 100 calls');
  close(paid.even, 1.16 / 0.14, 'break-even');
  assert.equal(paid.paid, true);
  const idle = c['2026-11-02-bbbb0002-20261103T150000Z'];
  close(idle.summary, 15.0, 'over an hour after the step before: the old context is written again, not read');
  close(idle.cost, 17.4, 'cost');
  close(idle.saved, 1.5, 'ten calls');
  assert.equal(idle.paid, false);
  const last = c['2026-11-02-bbbb0002-20261104T094400Z'];
  assert.equal(last.model, 'claude-fable-5-2', 'no call after it: the session\'s last model');
  close(last.cost, 0.5, 'the summary alone');
  assert.deepEqual([last.after, last.perCall, last.saved, last.paid], [null, null, null, null], 'nothing to say it saved');
  const old = c['2026-10-20-cccc0003-20261020T170000Z'];
  close(old.cost, 0.22, 'an older row has no first write to add');
  close(old.even, 2.2, 'and still a break-even');
  assert.deepEqual([old.calls, old.saved, old.paid], [null, null, null], 'but no count of the calls that followed');
});

test('compactions: the totals, and the break-even of the typical one at any context', () => {
  const c = r.compactions;
  assert.equal(c.n, 4);
  close(c.cost, 19.28, 'every costed row');
  close(c.saved, 15.5, 'the rows with a count of calls');
  assert.deepEqual([c.judged, c.paid], [2, 1]);
  assert.equal(c.typical.read, 0.2);
  assert.equal(c.typical.after, 100000);
  close(c.typical.fixed, 0.7, 'the middle of 0.1, 0.4, 1.0 and 3.0');
  close(R.breakEven(800000, c.typical), (0.16 + 0.7) / 0.14, 'at 800k');
  assert.ok(R.breakEven(200000, c.typical) > R.breakEven(800000, c.typical), 'a smaller context takes more calls to pay back');
  assert.equal(R.breakEven(100000, c.typical), null, 'no saving, no break-even');
  assert.equal(R.breakEven(800000, { fixed: 1, after: 0, read: 0 }), null);
});

test('nothing in, nothing out: empty readings rather than a throw', () => {
  for (const input of [[], null, [null, 'x', 3]]) {
    const e = R.fold(input, { now: NOW });
    assert.deepEqual([e.sessions.length, e.spend.total, e.spend.rows.length, e.calls.prompts, e.reloads.n, e.continue.rows.length, e.compactions.n], [0, 0, 0, 0, 0, 0, 0]);
    assert.deepEqual([e.calls.median, e.calls.mean, e.compactions.even], [null, null, null]);
  }
});
