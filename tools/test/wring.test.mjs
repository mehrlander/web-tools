// Verifies kits/wring.js end-to-end: kit surface, lossless tokenizers,
// Re-Pair grammar round-trip, induce() on both grouping strategies, the DOM
// signature path, and the MDL selection layer. Loaded via the bootstrap's
// loadKit (the gh.load shape), so what's tested is the artifact pages run.
//
// This is a liveness + invariants check for the generated kit, not a
// replacement for the full Wring test suite (six harnesses), which lives with
// the source modules under archive/wring/ (regenerate the kit there with
// `node export/build-kit.mjs`). Fixtures are inlined: the kit must be
// testable with no repo files.

import test from 'node:test';
import assert from 'node:assert/strict';
import { loadKit } from './bootstrap.mjs';

const { wring } = loadKit('wring.js');

const ACCESS_LOG = `192.168.1.10 - - [05/Jun/2026:10:00:01 +0000] "GET /api/users/1 HTTP/1.1" 200 1534
192.168.1.11 - - [05/Jun/2026:10:00:02 +0000] "GET /api/users/2 HTTP/1.1" 200 1622
192.168.1.10 - - [05/Jun/2026:10:00:03 +0000] "GET /api/users/3 HTTP/1.1" 404 312
192.168.1.12 - - [05/Jun/2026:10:00:04 +0000] "POST /api/orders HTTP/1.1" 201 88
192.168.1.10 - - [05/Jun/2026:10:00:05 +0000] "GET /api/users/4 HTTP/1.1" 200 1701
192.168.1.13 - - [05/Jun/2026:10:00:06 +0000] "GET /api/users/5 HTTP/1.1" 200 1499
192.168.1.11 - - [05/Jun/2026:10:00:07 +0000] "DELETE /api/orders/77 HTTP/1.1" 204 0
192.168.1.10 - - [05/Jun/2026:10:00:08 +0000] "GET /api/users/6 HTTP/1.1" 500 215`;

const HTML_SNIPPET = `<html><body>
<h3 id="_r_14a_" class="text-[12px] break-words text-text-100 line-clamp-4">a</h3>
<h3 id="_r_14k_" class="text-[12px] break-words text-text-100 line-clamp-4">b</h3>
<h3 id="_r_d1_" class="text-[12px] break-words text-text-100 line-clamp-4">c</h3>
<h3 id="_r_d3_" class="text-[12px] break-words text-text-100 line-clamp-4">d</h3>
<div class="flex items-center gap-2">x</div>
<script>ignored()</script>
</body></html>`;

test('kit surface: every documented export present', () => {
  const expected = ['tokenize', 'extractSignatures', 'extractSignaturesFromNodes',
    'countSignatures', 'induceGrammar', 'expandRule', 'reconstructTokens',
    'groupByTemplate', 'summarize', 'reconstruct', 'groupByAlignment',
    'reconstructAlign', 'weightedIntervalSchedule', 'mdlCost', 'selectTemplates',
    'NUL', 'recordsByLines', 'recordsByAnchor', 'induce'];
  for (const k of expected) assert.ok(k in wring, `wring.${k} exists`);
  assert.equal(wring.NUL, '\u0000');
});

test('tokenize: lossless on every mode', () => {
  const gnarly = 'GET /a-b/c_9?x=1&y=$&\n  "quo\'ted"\ttail\n';
  for (const mode of ['punct', 'word', 'char', 'line']) {
    assert.equal(wring.tokenize(gnarly, mode).join(''), gnarly, `${mode} round-trips`);
  }
});

test('grammar (Re-Pair): rules induced, start rule regenerates the stream', () => {
  const tokens = wring.tokenize(ACCESS_LOG, 'punct');
  const grammar = wring.induceGrammar(tokens);
  assert.ok(grammar.rules.size > 1, 'rules were induced');
  assert.equal(wring.reconstructTokens(grammar).join(''), ACCESS_LOG);
});

test('induce: access.log, structural alignment', () => {
  const run = wring.induce(ACCESS_LOG, { group: 'align' });
  assert.ok(run.result.groups.length >= 1 && run.result.groups[0].members.length >= 6,
    'one dominant template');
  assert.ok(run.fidelity.total > 0 && run.fidelity.pass === run.fidelity.total,
    '100% reconstruction fidelity');
  assert.ok(!run.result.groups[0].template.startsWith('192.168.1.10'),
    'client IP is a slot, not an anchor');
});

test('induce: access.log, bookend grouping', () => {
  const run = wring.induce(ACCESS_LOG, { group: 'bookend', maxSlots: 2 });
  assert.ok(run.result.groups.length >= 1, 'groups formed');
  assert.ok(run.fidelity.total > 0 && run.fidelity.pass === run.fidelity.total,
    '100% reconstruction fidelity');
});

test('dom: signatures from raw HTML group into templates and reconstruct', () => {
  const sigs = wring.extractSignatures(HTML_SNIPPET);
  assert.equal(sigs.length, 5, 'script tag skipped');
  const res = wring.groupByTemplate(sigs);
  const h3 = res.groups.find((g) => g.template.startsWith('h3'));
  assert.ok(h3 && h3.members.length === 4, 'h3 component grouped with id slot');
  for (const g of res.groups) {
    for (const m of g.members) {
      assert.equal(wring.reconstruct(g.template, m.slots), m.original);
    }
  }
});

test('reconstruct: "$" replacement patterns in slot values stay verbatim', () => {
  const strings = ["price.a$&1.usd", "price.b$$2.usd", "price.c$'3.usd"];
  const res = wring.groupByTemplate(strings);
  assert.equal(res.groups.length, 1);
  for (const g of res.groups) {
    for (const m of g.members) {
      assert.equal(wring.reconstruct(g.template, m.slots), m.original);
    }
  }
});

test('selection: weightedIntervalSchedule matches brute force on 100 random cases', () => {
  // Mulberry32 PRNG for reproducibility
  let s = 42;
  const rnd = () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

  const bruteBest = (intervals) => {
    let best = 0;
    const n = intervals.length;
    for (let mask = 0; mask < (1 << n); mask++) {
      const chosen = intervals.filter((_, i) => mask & (1 << i));
      const ok = chosen.every((a, i) => chosen.every((b, j) =>
        i === j || a.end <= b.start || b.end <= a.start));
      if (!ok) continue;
      const w = chosen.reduce((t, x) => t + x.weight, 0);
      if (w > best) best = w;
    }
    return best;
  };

  for (let c = 0; c < 100; c++) {
    const n = 2 + Math.floor(rnd() * 8);
    const intervals = Array.from({ length: n }, () => {
      const start = Math.floor(rnd() * 20);
      return { start, end: start + 1 + Math.floor(rnd() * 6), weight: Math.floor(rnd() * 21) - 4 };
    });
    const { totalWeight } = wring.weightedIntervalSchedule(intervals);
    assert.equal(totalWeight, bruteBest(intervals));
  }
});

test('selection: selectTemplates keeps a paying template, drops a losing one', () => {
  const good = wring.selectTemplates({
    templates: [{ id: 'T', dictBytes: 10 }],
    instances: [
      { templateId: 'T', start: 0, end: 25, encBytes: 5 },
      { templateId: 'T', start: 30, end: 55, encBytes: 5 },
    ],
    docLength: 60,
  });
  assert.ok(good.templates.length === 1 && good.saved > 0, 'keeps a paying template');

  const bad = wring.selectTemplates({
    templates: [{ id: 'T', dictBytes: 500 }],
    instances: [{ templateId: 'T', start: 0, end: 10, encBytes: 5 }],
    docLength: 60,
  });
  assert.ok(bad.templates.length === 0 && bad.cost.total === bad.baselineCost,
    'drops a template that cannot pay its dictionary cost');
});
