/**
 * Tests for align-group.js (structural Stage 3) and its integration in induce.js.
 *
 * Usage:  node general/test-align.js
 */

const fs = require('fs');
const path = require('path');
const { groupByAlignment, reconstructAlign } = require('./align-group.js');
const { induce } = require('./induce.js');

let failures = 0;
function check(name, cond, detail) {
  if (cond) console.log(`  ✓ ${name}`);
  else { failures++; console.log(`  ✗ ${name}${detail ? `: ${detail}` : ''}`); }
}

function allReconstruct(result) {
  for (const g of result.groups) {
    for (const m of g.members) {
      if (reconstructAlign(g.template, m.slots) !== m.original) return false;
    }
  }
  return true;
}

console.log('groupByAlignment: basic slot discovery');
{
  const recs = [['a', '1', 'b'], ['a', '2', 'b'], ['a', '3', 'b']];
  const r = groupByAlignment(recs);
  check('single template for aligned records', r.groups.length === 1, `got ${r.groups.length}`);
  check('template is a${0}b', r.groups[0].template === 'a${0}b', r.groups[0].template);
  check('slots are the varying tokens',
    JSON.stringify(r.groups[0].members.map((m) => m.slots[0])) === JSON.stringify(['1', '2', '3']));
  check('reconstructs exactly', allReconstruct(r));
}

console.log('\ngroupByAlignment: multiple varying positions');
{
  const recs = [
    ['get', ' ', '/a', ' ', '200'],
    ['get', ' ', '/b', ' ', '404'],
    ['get', ' ', '/c', ' ', '200'],
  ];
  const r = groupByAlignment(recs);
  check('one template', r.groups.length === 1);
  check('two slots discovered', r.groups[0].members[0].slots.length === 2, `${r.groups[0].members[0].slots.length}`);
  check('reconstructs exactly', allReconstruct(r));
}

console.log('\ngroupByAlignment: different lengths bucket separately');
{
  const recs = [['a', 'b'], ['a', 'b'], ['a', 'b', 'c'], ['a', 'b', 'c']];
  const r = groupByAlignment(recs);
  check('two templates (one per length)', r.groups.length === 2, `got ${r.groups.length}`);
}

console.log('\ngroupByAlignment: dissimilar same-length records do not merge');
{
  const recs = [['x', 'y', 'z'], ['p', 'q', 'r']]; // 0% agreement
  const r = groupByAlignment(recs, { threshold: 0.5 });
  check('no group formed below threshold', r.groups.length === 0 && r.ungrouped.length === 2);
}

console.log('\ngroupByAlignment: adjacent varying positions merge into one slot');
{
  const recs = [['a', '1', '2', 'b'], ['a', '3', '4', 'b']];
  const r = groupByAlignment(recs);
  check('adjacent slots merge', r.groups[0].template === 'a${0}b', r.groups[0].template);
  check('merged slot value spans both tokens', r.groups[0].members[0].slots[0] === '12', r.groups[0].members[0].slots[0]);
  check('reconstructs exactly', allReconstruct(r));
}

console.log('\nintegration, access.log: align beats bookend on structure');
{
  const log = fs.readFileSync(path.join(__dirname, 'fixtures', 'access.log'), 'utf8');
  const align = induce(log, { group: 'align' });
  const bookend = induce(log, { group: 'bookend', maxSlots: 8 });

  check('align reconstructs every grouped record',
    align.fidelity.total > 0 && align.fidelity.pass === align.fidelity.total);
  check('align yields fewer templates than bookend',
    align.result.groups.length < bookend.result.groups.length,
    `align=${align.result.groups.length} bookend=${bookend.result.groups.length}`);
  check('align produces one dominant template covering most lines',
    align.result.groups[0].members.length >= 7, `${align.result.groups[0].members.length}`);
  // The client IP must be a SLOT, not a hard-coded anchor in the template.
  check('client IP is captured as a slot (not an anchor)',
    /192\.168\.1\.\$\{0\}/.test(align.result.groups[0].template), align.result.groups[0].template);
}

console.log(`\n${failures === 0 ? 'ALL PASSED' : failures + ' FAILED'}`);
process.exit(failures === 0 ? 0 : 1);
