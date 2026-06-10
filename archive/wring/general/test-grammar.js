/**
 * Tests for grammar.js (Re-Pair grammar induction).
 *
 * Usage:  node general/test-grammar.js
 *
 * Asserts, for each input:
 *   - Reconstruction: expanding the start rule reproduces the input exactly.
 *   - No repeats remain: no adjacent digram in the start rule occurs ≥2 times
 *     non-overlapping (Re-Pair's termination condition).
 *   - Rule utility: every non-start rule is referenced ≥2 times.
 */

const { induceGrammar, reconstructTokens, expandRule } = require('./grammar.js');

let failures = 0;
function check(name, cond, detail) {
  if (cond) console.log(`  ✓ ${name}`);
  else { failures++; console.log(`  ✗ ${name}${detail ? `: ${detail}` : ''}`); }
}

function utilityViolation(g) {
  for (const [id, uses] of g.ruleUses) if (id !== g.start && uses < 2) return id;
  return null;
}

function startHasNoRepeatPair(g) {
  const body = g.rules.get(g.start);
  const key = (s) => (s.rule !== undefined ? 'r' + s.rule : 't' + s.t);
  // Greedy non-overlapping count per pair.
  const seen = new Map();
  for (let i = 0; i + 1 < body.length; ) {
    const k = key(body[i]) + ' ' + key(body[i + 1]);
    const cnt = (seen.get(k) || 0) + 1;
    seen.set(k, cnt);
    i += 2; // count non-overlapping
  }
  for (const [, c] of seen) if (c >= 2) return false;
  return true;
}

function runCase(label, tokens) {
  console.log(`\n${label}  (${tokens.length} tokens)`);
  const g = induceGrammar(tokens);
  const recon = reconstructTokens(g);
  check('reconstruction exact',
    recon.length === tokens.length && recon.every((t, i) => t === tokens[i]),
    `got ${recon.length}/${tokens.length}`);
  check('rule utility (all rules used ≥2)', utilityViolation(g) === null);
  check('no repeated digram remains in start rule', startHasNoRepeatPair(g));
  return g;
}

runCase('abcabc', [...'abcabc']);
runCase('abcdbcabcd', [...'abcdbcabcd']);
runCase('aaa', [...'aaa']);
runCase('aaaa', [...'aaaa']);
runCase('aaaaaaaa', [...'aaaaaaaa']);
runCase('ababababab', [...'ababababab']);
const noRep = runCase('abcdef (no repeats)', [...'abcdef']);
check('no-repeat input yields only the start rule', noRep.rules.size === 1, `got ${noRep.rules.size}`);

const log = 'GET /a 200\nGET /b 200\nGET /c 200\n'.split(/(\s+)/).filter(Boolean);
const glog = runCase('log-like token stream', log);
check('log induces shared structure (>1 rule)', glog.rules.size > 1, `got ${glog.rules.size}`);

let big = '';
for (let i = 0; i < 200; i++) big += 'item' + (i % 7) + ';';
runCase('200 semicolon records', big.split(/(;)/).filter(Boolean));

const g2 = induceGrammar([...'xyzxyzxyz']);
const someRule = [...g2.rules.keys()].find((id) => id !== g2.start);
if (someRule !== undefined) {
  check('expandRule returns terminals only',
    expandRule(g2, someRule).every((t) => typeof t === 'string'));
}

console.log(`\n${failures === 0 ? 'ALL PASSED' : failures + ' FAILED'}`);
process.exit(failures === 0 ? 0 : 1);
