/**
 * Test script for the DOM segmenter and the end-to-end HTML → templates path.
 *
 * Usage:  node dom/test-extract.js
 *
 * Asserts:
 *   - extractSignatures emits the expected signatures from the fixture
 *   - script/style/head content is skipped; bare elements are filtered
 *   - attribute parsing handles quotes and unquoted values
 *   - dedupe collapses identical signatures
 *   - the end-to-end pipeline preserves reconstruction fidelity (key invariant)
 */

const fs = require('fs');
const path = require('path');
const {
  extractSignatures,
  countSignatures,
} = require('./extract-signatures.js');
const { groupByTemplate, reconstruct } = require('../core/group-by-template.js');

let failures = 0;
function check(name, cond, detail) {
  if (cond) {
    console.log(`  ✓ ${name}`);
  } else {
    failures++;
    console.log(`  ✗ ${name}${detail ? `: ${detail}` : ''}`);
  }
}

const html = fs.readFileSync(path.join(__dirname, 'fixtures', 'sample.html'), 'utf8');

console.log('extractSignatures: fixture');
const sigs = extractSignatures(html);
check('extracts 27 signatures', sigs.length === 27, `got ${sigs.length}`);
check('skips <style> content (no .ignored class)',
  !sigs.some(s => s.includes('ignored')));
check('skips <head>/<meta>/<title>',
  !sigs.some(s => /^(meta|title|head)\b/.test(s.replace(/[#.]/g, ' '))));
check('captures tag#id form',
  sigs.includes('div#root.relative.w-full.min-h-full.flex.flex-col'));
check('captures id with classes for h3',
  sigs.includes('h3#_r_a1_.text-[12px].break-words.text-text-100.line-clamp-4'));
check('preserves class source order',
  sigs.includes('a.flex.items-center.gap-2.px-2.py-2.rounded-lg.hover:bg-bg-200'));
check('lowercases tag names', sigs.every(s => /^[a-z]/.test(s)));

console.log('\nextractSignatures: options');
const bare = extractSignatures('<div></div><span class="x"></span>');
check('requireClassOrId drops bare <div>', bare.length === 1 && bare[0] === 'span.x');
const withBare = extractSignatures('<div></div><span class="x"></span>', { requireClassOrId: false });
check('requireClassOrId:false keeps bare <div>', withBare.length === 2 && withBare[0] === 'div');
const noId = extractSignatures('<div id="root" class="a"></div>', { includeId: false });
check('includeId:false omits #id', noId[0] === 'div.a');

console.log('\nattribute parsing');
check('single-quoted class', extractSignatures("<p class='a b'></p>")[0] === 'p.a.b');
check('unquoted id', extractSignatures('<p id=x class="a"></p>')[0] === 'p#x.a');
check('">" inside quoted attr does not end tag',
  extractSignatures('<p data-x="a>b" class="c"></p>')[0] === 'p.c');

console.log('\ndedupe + counts');
const deduped = extractSignatures(html, { dedupe: true });
check('dedupe reduces count', deduped.length < sigs.length, `${deduped.length} vs ${sigs.length}`);
check('dedupe yields unique signatures', new Set(deduped).size === deduped.length);
const counts = countSignatures(sigs);
check('most-repeated signature is the list item',
  counts[0].count === 4 && counts[0].signature.startsWith('li.flex'));

console.log('\nend-to-end: HTML → signatures → templates → reconstruction');
const result = groupByTemplate(sigs, { maxSlots: 1 });
check('induces at least 4 templates', result.groups.length >= 4, `got ${result.groups.length}`);
let pass = 0, total = 0;
for (const g of result.groups) {
  for (const m of g.members) {
    total++;
    if (reconstruct(g.template, m.slots) === m.original) pass++;
  }
}
check('every grouped member reconstructs exactly', pass === total, `${pass}/${total}`);
check('majority of signatures grouped',
  (sigs.length - result.ungrouped.length) / sigs.length >= 0.5);

console.log(`\n${failures === 0 ? 'ALL PASSED' : failures + ' FAILED'}`);
process.exit(failures === 0 ? 0 : 1);
