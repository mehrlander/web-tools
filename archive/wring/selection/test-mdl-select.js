/**
 * Tests for mdl-select.js (Stage 4).
 *
 * Usage:  node selection/test-mdl-select.js
 *
 * The scheduler is the exact part, so we verify it against brute force on many
 * random instances. The selection driver is then checked for sane MDL behavior:
 * it never does worse than all-residual, and it resolves overlapping candidates
 * in favor of the combination that compresses most.
 */

const { weightedIntervalSchedule, mdlCost, selectTemplates } = require('./mdl-select.js');

let failures = 0;
function check(name, cond, detail) {
  if (cond) console.log(`  ✓ ${name}`);
  else { failures++; console.log(`  ✗ ${name}${detail ? `: ${detail}` : ''}`); }
}

// Brute-force max-weight non-overlapping subset (for n ≤ ~16).
function bruteForce(intervals) {
  const items = intervals.filter((x) => x.weight > 0);
  const n = items.length;
  let best = 0;
  for (let mask = 0; mask < (1 << n); mask++) {
    const pick = [];
    for (let i = 0; i < n; i++) if (mask & (1 << i)) pick.push(items[i]);
    pick.sort((a, b) => a.start - b.start);
    let ok = true;
    for (let i = 1; i < pick.length; i++) if (pick[i].start < pick[i - 1].end) { ok = false; break; }
    if (ok) best = Math.max(best, pick.reduce((s, x) => s + x.weight, 0));
  }
  return best;
}

console.log('weightedIntervalSchedule: optimality vs brute force');
let mismatches = 0;
const rng = (() => { let s = 12345; return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; })();
for (let trial = 0; trial < 400; trial++) {
  const n = 1 + Math.floor(rng() * 9);
  const intervals = [];
  for (let i = 0; i < n; i++) {
    const start = Math.floor(rng() * 20);
    const len = 1 + Math.floor(rng() * 6);
    intervals.push({ start, end: start + len, weight: Math.floor(rng() * 21) - 5 });
  }
  const got = weightedIntervalSchedule(intervals).totalWeight;
  const exp = bruteForce(intervals);
  if (got !== exp) { mismatches++; if (mismatches <= 3) console.log(`    trial ${trial}: got ${got}, brute ${exp}`); }
}
check('400 random cases match brute force', mismatches === 0, `${mismatches} mismatched`);

console.log('\nweightedIntervalSchedule: selected set is non-overlapping');
{
  const intervals = [
    { start: 0, end: 5, weight: 10 }, { start: 3, end: 8, weight: 8 },
    { start: 5, end: 9, weight: 6 }, { start: 8, end: 12, weight: 7 },
  ];
  const { selected } = weightedIntervalSchedule(intervals);
  let ok = true;
  for (let i = 1; i < selected.length; i++) if (selected[i].start < selected[i - 1].end) ok = false;
  check('no overlaps in result', ok);
}

console.log('\nselectTemplates: MDL behavior');
{
  // A template that clearly pays for itself: 4 instances, each saves a lot.
  const templates = [{ id: 'A', dictBytes: 10 }];
  const instances = [
    { templateId: 'A', start: 0, end: 20, encBytes: 3 },
    { templateId: 'A', start: 20, end: 40, encBytes: 3 },
    { templateId: 'A', start: 40, end: 60, encBytes: 3 },
    { templateId: 'A', start: 60, end: 80, encBytes: 3 },
  ];
  const r = selectTemplates({ templates, instances, docLength: 100 });
  check('keeps a clearly-worthwhile template', r.templates.length === 1);
  check('selects all 4 non-overlapping instances', r.instances.length === 4);
  check('total cost beats all-residual baseline', r.cost.total < r.baselineCost, `${r.cost.total} vs ${r.baselineCost}`);
  check('reported savings are positive', r.saved > 0);
}
{
  // A template that does NOT pay for itself: one instance saving less than dictBytes.
  const templates = [{ id: 'B', dictBytes: 50 }];
  const instances = [{ templateId: 'B', start: 0, end: 10, encBytes: 4 }];
  const r = selectTemplates({ templates, instances, docLength: 100 });
  check('drops a template that cannot pay for its dictionary cost', r.templates.length === 0);
  check('falls back to all-residual cost', r.cost.total === r.baselineCost);
}
{
  // Overlapping candidates compete for the same characters: a broad cheap
  // template vs. two narrow ones over the same span. Selection should pick the
  // combination with lower total cost.
  const templates = [
    { id: 'WIDE', dictBytes: 8 },
    { id: 'NARROW', dictBytes: 8 },
  ];
  const instances = [
    // WIDE covers [0,30) cheaply in 3 places.
    { templateId: 'WIDE', start: 0, end: 30, encBytes: 5 },
    { templateId: 'WIDE', start: 30, end: 60, encBytes: 5 },
    { templateId: 'WIDE', start: 60, end: 90, encBytes: 5 },
    // NARROW overlaps WIDE on [0,30) but only covers [0,12), worse.
    { templateId: 'NARROW', start: 0, end: 12, encBytes: 5 },
  ];
  const r = selectTemplates({ templates, instances, docLength: 90 });
  check('prefers the wide template over the overlapping narrow one',
    r.templates.length === 1 && r.templates[0].id === 'WIDE', JSON.stringify(r.templates.map(t => t.id)));
  check('covers the whole document with wide instances', r.cost.covered === 90);
}

console.log(`\n${failures === 0 ? 'ALL PASSED' : failures + ' FAILED'}`);
process.exit(failures === 0 ? 0 : 1);
