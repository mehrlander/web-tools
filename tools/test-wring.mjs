#!/usr/bin/env node
/**
 * test-wring.mjs
 *
 * Verifies the generated wring kit (`../lib/kits/wring.js`) end-to-end,
 * loading it the same way web-tools' `gh.load` does — `new Function(body)`
 * with a window object — so what's tested is the exact artifact a page runs.
 *
 * This is a liveness + invariants check for the kit build, not a replacement
 * for the full Wring test suite (six harnesses), which lives with the source
 * modules (snapshot under archive/wring/; regenerate the kit with
 * `node export/build-kit.mjs` from inside the snapshot).
 *
 * Usage: node tools/test-wring.mjs
 */

import { readFileSync } from 'node:fs';

const body = readFileSync(new URL('../lib/kits/wring.js', import.meta.url), 'utf8');

const window = {};
new Function('window', body)(window);
const wring = window.wring;

let failures = 0;
const check = (name, cond) => {
  console.log(`  ${cond ? '✓' : '✗'} ${name}`);
  if (!cond) failures++;
};

// ─── Fixtures (inlined: the kit must be testable with no repo files) ─────────

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

// ─── 1. Kit surface ──────────────────────────────────────────────────────────

console.log('kit surface');
const expected = ['tokenize', 'extractSignatures', 'extractSignaturesFromNodes',
  'countSignatures', 'induceGrammar', 'expandRule', 'reconstructTokens',
  'groupByTemplate', 'summarize', 'reconstruct', 'groupByAlignment',
  'reconstructAlign', 'weightedIntervalSchedule', 'mdlCost', 'selectTemplates',
  'NUL', 'recordsByLines', 'recordsByAnchor', 'induce'];
check('window.wring exists', !!wring);
check('all expected exports present',
  expected.every((k) => k in wring));
check('NUL is U+0000', wring.NUL === '\u0000');

// ─── 2. Tokenizers are lossless ──────────────────────────────────────────────

console.log('tokenize: lossless on every mode');
const gnarly = 'GET /a-b/c_9?x=1&y=$&\n  "quo\'ted"\ttail\n';
for (const mode of ['punct', 'word', 'char', 'line']) {
  check(`${mode} round-trips`, wring.tokenize(gnarly, mode).join('') === gnarly);
}

// ─── 3. Grammar round-trip ───────────────────────────────────────────────────

console.log('grammar (Re-Pair): reconstruction');
{
  const tokens = wring.tokenize(ACCESS_LOG, 'punct');
  const grammar = wring.induceGrammar(tokens);
  check('rules were induced', grammar.rules.size > 1);
  check('start rule regenerates token stream',
    wring.reconstructTokens(grammar).join('') === ACCESS_LOG);
}

// ─── 4. End-to-end induce(), align grouping ──────────────────────────────────

console.log('induce: access.log, structural alignment');
{
  const run = wring.induce(ACCESS_LOG, { group: 'align' });
  check('one dominant template', run.result.groups.length >= 1 &&
    run.result.groups[0].members.length >= 6);
  check('100% reconstruction fidelity',
    run.fidelity.total > 0 && run.fidelity.pass === run.fidelity.total);
  check('client IP is a slot, not an anchor',
    !run.result.groups[0].template.startsWith('192.168.1.10'));
}

// ─── 5. End-to-end induce(), bookend grouping ────────────────────────────────

console.log('induce: access.log, bookend');
{
  const run = wring.induce(ACCESS_LOG, { group: 'bookend', maxSlots: 2 });
  check('groups formed', run.result.groups.length >= 1);
  check('100% reconstruction fidelity',
    run.fidelity.total > 0 && run.fidelity.pass === run.fidelity.total);
}

// ─── 6. DOM path: extract + group + reconstruct ──────────────────────────────

console.log('dom: signatures from raw HTML → templates');
{
  const sigs = wring.extractSignatures(HTML_SNIPPET);
  check('5 signatures extracted (script skipped)', sigs.length === 5);
  const res = wring.groupByTemplate(sigs);
  const h3 = res.groups.find((g) => g.template.startsWith('h3'));
  check('h3 component grouped with id slot', !!h3 && h3.members.length === 4);
  check('reconstruction exact', res.groups.every((g) =>
    g.members.every((m) => wring.reconstruct(g.template, m.slots) === m.original)));
}

// ─── 7. Regression: "$" replacement patterns in data ─────────────────────────

console.log('reconstruct: "$" patterns in slot values stay verbatim');
{
  const strings = ["price.a$&1.usd", "price.b$$2.usd", "price.c$'3.usd"];
  const res = wring.groupByTemplate(strings);
  check('group formed', res.groups.length === 1);
  check('values round-trip', res.groups.every((g) =>
    g.members.every((m) => wring.reconstruct(g.template, m.slots) === m.original)));
}

// ─── 8. Selection: interval scheduling vs brute force ────────────────────────

console.log('selection: weightedIntervalSchedule optimal on random cases');
{
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

  let mismatches = 0;
  for (let c = 0; c < 100; c++) {
    const n = 2 + Math.floor(rnd() * 8);
    const intervals = Array.from({ length: n }, () => {
      const start = Math.floor(rnd() * 20);
      return { start, end: start + 1 + Math.floor(rnd() * 6), weight: Math.floor(rnd() * 21) - 4 };
    });
    const { totalWeight } = wring.weightedIntervalSchedule(intervals);
    if (totalWeight !== bruteBest(intervals)) mismatches++;
  }
  check('100 random cases match brute force', mismatches === 0);
}

// ─── 9. Selection: MDL keeps a worthwhile template, drops a worthless one ────

console.log('selection: selectTemplates MDL behavior');
{
  const good = wring.selectTemplates({
    templates: [{ id: 'T', dictBytes: 10 }],
    instances: [
      { templateId: 'T', start: 0, end: 25, encBytes: 5 },
      { templateId: 'T', start: 30, end: 55, encBytes: 5 },
    ],
    docLength: 60,
  });
  check('keeps a paying template', good.templates.length === 1 && good.saved > 0);

  const bad = wring.selectTemplates({
    templates: [{ id: 'T', dictBytes: 500 }],
    instances: [{ templateId: 'T', start: 0, end: 10, encBytes: 5 }],
    docLength: 60,
  });
  check('drops a template that cannot pay its dictionary cost',
    bad.templates.length === 0 && bad.cost.total === bad.baselineCost);
}

console.log(failures === 0 ? '\nALL PASSED' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
