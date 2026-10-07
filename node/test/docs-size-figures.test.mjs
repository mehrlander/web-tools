// No byte or word figure in the prose of a living doc in docs/docs.csv.
//
// Gate 5 of the 2026-09-06 hand-typed fact census (home
// chron/2026/09/2026-09-06-hand-typed-fact-census.md, "What to gate"): a size
// or word count typed into prose ("383 KB", "640 words") changes nothing a
// reader does and is stale after the next build. home's tools/prose-gates.py
// holds budget-drs to the same rule; the two read a figure the same way:
//
//   not reported  a cap or threshold ("under 800 KB", "16 MiB or smaller",
//                 "fewer than 6 words"), which is a rule, not a measurement;
//                 a rate ("words per run"); a figure in a sentence carrying
//                 its own date, which is a record; anything in a fence or
//                 an inline code span
//   reported      every other figure in a living doc's prose
//
// "Living" is docs.csv's status column, the genre the census read. One living
// doc is exempt by name: docs/SNAGS.md is append-on-trip (its own docs.csv
// row says so), and each entry records what a trip measured when it happened.
// Added 2026-10-07 with the six figures it found deleted.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const EXEMPT = new Map([
  ['docs/SNAGS.md', 'append-on-trip: each entry records what a trip measured when it happened'],
]);

const SIZE = /(?<![\w.$,])~?\d[\d,]*(?:\.\d+)?\s?(?:KB|MB|GB|KiB|MiB|GiB|kB|bytes|words(?! per))\b/g;
const RULE_BEFORE = /\b(under|over|below|above|up to|at most|cap|caps|capped|limit|threshold|ceiling|budget|budgeted|maximum|max|exceeds?|guard|fewer than|less than|more than)\b[^.;:]{0,30}$/i;
const RULE_AFTER = /^[^.;:]{0,30}?\b(or (?:smaller|less|fewer|under|below)|is the budget|cap|ceiling|limit|threshold)\b/i;
const DATED = /\b20\d\d-\d\d(-\d\d)?\b/;
const FENCE = /^\s*(```|~~~)/;

function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows;
  return body.filter(r => r.length > 1).map(r => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}

// [first line number, paragraph] for each blank-line block outside fences and frontmatter.
function paragraphs(text) {
  const lines = text.split('\n');
  let start = 0;
  if (lines[0]?.trim() === '---') {
    const end = lines.findIndex((l, i) => i > 0 && l.trim() === '---');
    if (end > 0) start = end + 1;
  }
  const out = []; let block = [], first = null, fence = false;
  for (let i = start; i < lines.length; i++) {
    if (FENCE.test(lines[i])) { fence = !fence; continue; }
    if (fence) continue;
    if (lines[i].trim()) { if (first === null) first = i + 1; block.push(lines[i]); }
    else if (block.length) { out.push([first, block.join('\n')]); block = []; first = null; }
  }
  if (block.length) out.push([first, block.join('\n')]);
  return out;
}

function sentenceAt(s, pos) {
  const a = s.lastIndexOf('. ', pos), b = s.indexOf('. ', pos);
  return s.slice(a + 1, b < 0 ? s.length : b);
}

export function sizeFigures(text) {
  const found = [];
  for (const [first, para] of paragraphs(text)) {
    const plain = para.replace(/`[^`\n]*`/g, '``');
    for (const m of plain.matchAll(SIZE)) {
      if (RULE_BEFORE.test(plain.slice(0, m.index)) || RULE_AFTER.test(plain.slice(m.index + m[0].length))) continue;
      if (DATED.test(sentenceAt(plain, m.index).replace(/\]\([^)]*\)/g, ']'))) continue;
      found.push({ line: first + plain.slice(0, m.index).split('\n').length - 1, figure: m[0].trim() });
    }
  }
  return found;
}

const living = parseCsv(readFileSync(path.join(repoRoot, 'docs', 'docs.csv'), 'utf8'))
  .filter(r => r.status === 'living' && r.path.endsWith('.md'));

test('no living doc types a byte or word figure into its prose', () => {
  const found = [];
  for (const r of living) {
    if (EXEMPT.has(r.path)) continue;
    for (const f of sizeFigures(readFileSync(path.join(repoRoot, r.path), 'utf8'))) {
      found.push(`${r.path}:${f.line} "${f.figure}"`);
    }
  }
  assert.deepEqual(found, [],
    'a size or word figure in a living doc goes stale on the next build; delete it, or ' +
    'say what it is relative to (a cap is a rule and is not reported)');
});

test('the reading: rules, rates, dated sentences and code are not figures', () => {
  assert.deepEqual(sizeFigures('The payload is 383 KB.').map(f => f.figure), ['383 KB']);
  assert.deepEqual(sizeFigures('It went from 640 words to 315.').map(f => f.figure), ['640 words']);
  assert.deepEqual(sizeFigures('Rendered page must be 16 MiB or smaller.'), []);
  assert.deepEqual(sizeFigures('A page under 800 KB loads; fewer than 6 words is an app.'), []);
  assert.deepEqual(sizeFigures('Apps measured 1.1 to 5.0 words per run.'), []);
  assert.deepEqual(sizeFigures('As of 2026-08-17 the images total 10.28 MB.'), []);
  assert.deepEqual(sizeFigures('Run `gzip` to get `383 KB`.\n\n```\n640 words\n```'), []);
});

test('the exemption list names only living docs', () => {
  const paths = new Set(living.map(r => r.path));
  for (const p of EXEMPT.keys()) assert.ok(paths.has(p), `${p} is not a living doc in docs.csv; drop it from EXEMPT`);
});
