/**
 * induce.js
 *
 * CLI driver for end-to-end general-text template induction. The pipeline
 * itself — the grammar→records bridge and the `induce()` orchestration —
 * lives in `bridge.js` so browser front-ends run the identical code; this
 * file is only flag parsing, file/stdin reading, and the console report.
 *
 * Usage:
 *   node general/induce.js <file> [--tokens punct|word|char] [--records lines|anchor]
 *                                 [--group bookend|align] [--max-slots N]
 *                                 [--threshold F] [--specific] [--min-group N]
 *   (or pipe text via stdin)
 *
 * Dependency-free; runs in Node.
 */

const fs = require('fs');
const { reconstructTokens } = require('./grammar.js');
const { induce, NUL } = require('./bridge.js');

// ─── Display ───────────────────────────────────────────────────────────────

const pretty = (s) => s.split(NUL).join('').replace(/\n/g, '\\n');

function report(source, run, opts) {
  const { grammar, records, result, strategy } = run;
  const line = '='.repeat(78);
  console.log(line);
  console.log(`  General Template Induction: ${source}`);
  console.log(line);
  console.log(`\nTokens=${run.tokens.length} · grammar rules=${grammar.rules.size} · ` +
    `records=${records.length} (${strategy}) · tokenizer=${opts.tokens} · ` +
    `group=${run.group}${run.group === 'bookend' ? ' maxSlots=' + opts.maxSlots : ''}\n`);

  for (let i = 0; i < result.groups.length; i++) {
    const g = result.groups[i];
    console.log(`Template ${i + 1}  (${g.members.length} instances, score ${g.score})`);
    console.log(`  ${pretty(g.template)}`);
    const slotCount = g.members[0].slots.length;
    for (let s = 0; s < slotCount; s++) {
      const vals = g.members.map((m) => pretty(m.slots[s]) || '∅');
      const uniq = [...new Set(vals)];
      const shown = uniq.length <= 8 ? uniq : [...uniq.slice(0, 7), `… +${uniq.length - 7} more`];
      console.log(`    slot ${s}: ${shown.join(', ')}`);
    }
    console.log();
  }

  const { pass, total } = run.fidelity;
  const gT = reconstructTokens(grammar).join('');
  const grouped = records.length - result.ungrouped.length;

  console.log('-'.repeat(78));
  console.log(`Grammar reconstruction: ${gT.length} chars regenerated from start rule`);
  console.log(`Records grouped:        ${grouped}/${records.length} ` +
    `into ${result.groups.length} templates`);
  console.log(`Record reconstruction:  ${pass}/${total} exact`);
  if (result.ungrouped.length) {
    console.log(`\nUngrouped (${result.ungrouped.length}):`);
    for (const s of result.ungrouped.slice(0, 8)) {
      const t = pretty(s);
      console.log(`  ${t.length > 70 ? t.slice(0, 67) + '...' : t}`);
    }
    if (result.ungrouped.length > 8) console.log(`  … +${result.ungrouped.length - 8} more`);
  }
}

function parseArgs(argv) {
  const o = { file: null, tokens: 'punct', records: 'lines', group: 'bookend',
    maxSlots: 1, strategy: 'compress', minGroupSize: 2, threshold: 0.5 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--tokens') o.tokens = argv[++i];
    else if (a === '--records') o.records = argv[++i];
    else if (a === '--group') o.group = argv[++i];
    else if (a === '--max-slots') o.maxSlots = parseInt(argv[++i], 10) || 1;
    else if (a === '--min-group') o.minGroupSize = parseInt(argv[++i], 10) || 2;
    else if (a === '--threshold') o.threshold = parseFloat(argv[++i]) || 0.5;
    else if (a === '--specific') o.strategy = 'specific';
    else if (!a.startsWith('--')) o.file = a;
  }
  return o;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  let text;
  try {
    text = opts.file ? fs.readFileSync(opts.file, 'utf8') : fs.readFileSync(0, 'utf8');
  } catch {
    text = '';
  }
  if (!text.trim()) {
    console.error('Usage: node general/induce.js <file> [--tokens punct|word|char] ' +
      '[--records lines|anchor] [--group bookend|align] [--max-slots N] [--threshold F] ' +
      '[--specific] [--min-group N]');
    console.error('       (or pipe text via stdin)');
    process.exit(1);
  }
  const run = induce(text, opts);
  report(opts.file || '<stdin>', run, opts);
}

module.exports = { induce };

if (require.main === module) main();
