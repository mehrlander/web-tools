/**
 * induce-from-html.js
 *
 * End-to-end DOM template induction: raw HTML → signatures → templates.
 * This is the first piece that runs the Wring pipeline from a real document
 * rather than a hand-collected signature list. It wires the DOM segmenter
 * (Stage 1, extract-signatures.js) to Bookend Merge + greedy MDL selection
 * (Stages 3-4, core/group-by-template.js).
 *
 * Usage:
 *   node dom/induce-from-html.js [file.html] [--max-slots N] [--dedupe] [--specific]
 *
 * With no file argument, reads HTML from stdin:
 *   curl -s https://example.com | node dom/induce-from-html.js
 *
 * Output: the induced templates, their slot values, and a compression summary.
 */

const fs = require('fs');
const { extractSignatures, countSignatures } = require('./extract-signatures.js');
const { groupByTemplate, summarize, reconstruct } = require('../core/group-by-template.js');

function parseArgs(argv) {
  const opts = { file: null, maxSlots: 1, dedupe: false, strategy: 'compress' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--max-slots') opts.maxSlots = parseInt(argv[++i], 10) || 1;
    else if (a === '--dedupe') opts.dedupe = true;
    else if (a === '--specific') opts.strategy = 'specific';
    else if (!a.startsWith('--')) opts.file = a;
  }
  return opts;
}

function readInput(file) {
  if (file) return fs.readFileSync(file, 'utf8');
  try {
    return fs.readFileSync(0, 'utf8'); // stdin
  } catch {
    return '';
  }
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const html = readInput(opts.file);

  if (!html.trim()) {
    console.error('Usage: node dom/induce-from-html.js [file.html] [--max-slots N] [--dedupe] [--specific]');
    console.error('       (or pipe HTML via stdin)');
    process.exit(1);
  }

  // Stage 1: segment the document into signatures.
  const signatures = extractSignatures(html, { dedupe: opts.dedupe });

  // Stages 3-4: induce templates and select the best non-overlapping set.
  const result = groupByTemplate(signatures, {
    maxSlots: opts.maxSlots,
    strategy: opts.strategy,
  });

  const source = opts.file || '<stdin>';
  console.log('='.repeat(78));
  console.log(`  DOM Template Induction: ${source}`);
  console.log('='.repeat(78));
  console.log(`\nExtracted ${signatures.length} signatures` +
    (opts.dedupe ? ' (deduped)' : '') +
    ` · maxSlots=${opts.maxSlots} · strategy=${opts.strategy}\n`);

  console.log(summarize(result));

  // Stage 5: verify reconstruction fidelity across every grouped member.
  let pass = 0, fail = 0;
  for (const g of result.groups) {
    for (const m of g.members) {
      if (reconstruct(g.template, m.slots) === m.original) pass++;
      else {
        fail++;
        console.log(`  RECONSTRUCTION FAIL: ${m.original}`);
      }
    }
  }

  // Compression accounting: how many literal characters the templates save.
  const grouped = signatures.length - result.ungrouped.length;
  const rawChars = signatures.reduce((n, s) => n + s.length, 0);
  const savedChars = result.groups.reduce((n, g) => n + g.score, 0);

  console.log('\n' + '-'.repeat(78));
  console.log(`Grouped:        ${grouped}/${signatures.length} signatures ` +
    `(${result.groups.length} templates)`);
  console.log(`Reconstruction: ${pass} passed, ${fail} failed`);
  console.log(`Compression:    ~${savedChars} literal chars saved of ${rawChars} total ` +
    `(${rawChars ? Math.round((savedChars / rawChars) * 100) : 0}%)`);

  // Surface the most repeated exact signatures, a useful structural diagnosis
  // independent of templating.
  const top = countSignatures(signatures).filter(c => c.count > 1).slice(0, 5);
  if (top.length > 0) {
    console.log('\nMost repeated exact signatures:');
    for (const { signature, count } of top) {
      const shown = signature.length > 60 ? signature.slice(0, 57) + '...' : signature;
      console.log(`  ${count}×  ${shown}`);
    }
  }
}

main();
