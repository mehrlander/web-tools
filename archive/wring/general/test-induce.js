/**
 * Tests for the end-to-end general pipeline (induce.js) and tokenizer.
 *
 * Usage:  node general/test-induce.js
 *
 * The headline invariant is reconstruction fidelity: every layer must round-trip.
 *   - tokenizers are lossless (join === input)
 *   - the grammar regenerates the exact token stream
 *   - every grouped record reconstructs exactly from its template + slots
 */

const fs = require('fs');
const path = require('path');
const { tokenize } = require('./tokenize.js');
const { induceGrammar, reconstructTokens } = require('./grammar.js');
const { induce } = require('./induce.js');

let failures = 0;
function check(name, cond, detail) {
  if (cond) console.log(`  ✓ ${name}`);
  else { failures++; console.log(`  ✗ ${name}${detail ? `: ${detail}` : ''}`); }
}

const samples = [
  'GET /a 200\nGET /b 200\n',
  'the quick brown fox; the quick red fox; the slow brown fox;',
  '192.168.1.1 ok\n192.168.1.2 ok\n10.0.0.1 fail\n',
  '',
  'no-repeats-here-xyz',
];

console.log('tokenizer losslessness');
for (const mode of ['punct', 'word', 'char', 'line']) {
  const ok = samples.every((s) => tokenize(s, mode).join('') === s);
  check(`mode '${mode}' round-trips`, ok);
}

console.log('\ngrammar regenerates token stream');
for (const s of samples) {
  const toks = tokenize(s, 'punct');
  const g = induceGrammar(toks);
  const recon = reconstructTokens(g);
  check(`"${s.slice(0, 20).replace(/\n/g, '\\n')}…"`,
    recon.length === toks.length && recon.every((t, i) => t === toks[i]));
}

console.log('\nend-to-end induction on access.log');
const log = fs.readFileSync(path.join(__dirname, 'fixtures', 'access.log'), 'utf8');
for (const opts of [
  { records: 'lines', maxSlots: 1 },
  { records: 'lines', maxSlots: 8 },
  { records: 'anchor', maxSlots: 4 },
]) {
  const run = induce(log, opts);
  const label = `records=${opts.records} maxSlots=${opts.maxSlots}`;
  check(`${label}: every grouped record reconstructs exactly`,
    run.fidelity.total > 0 && run.fidelity.pass === run.fidelity.total,
    `${run.fidelity.pass}/${run.fidelity.total}`);
  check(`${label}: produces at least one template`, run.result.groups.length >= 1);
}

console.log('\nNUL safety (input containing NUL is handled)');
const withNul = 'a\u0000b\na\u0000c\n';
const run = induce(withNul, { records: 'lines' });
check('runs without crashing on NUL input', run.fidelity.pass === run.fidelity.total);

console.log(`\n${failures === 0 ? 'ALL PASSED' : failures + ' FAILED'}`);
process.exit(failures === 0 ? 0 : 1);
