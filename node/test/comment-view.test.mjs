// lib/kits/comment-view.js: a code file read through its comments.
//
// The kit finds blocks in the browser and python/comment-blocks.py finds them
// for data/comments/web-tools.json, so the Comments tab's search and its card
// read the same file two ways. The first test holds them to the same blocks,
// file by file: the same lines, kinds and words.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, loadKit, repoRoot } from './bootstrap.mjs';

const { window } = makeWindow();
loadKit('comment-view.js', { window });
const CV = window.commentView;
const WORDS = (s) => (s.match(/[A-Za-z][A-Za-z'’-]+/g) || []).join(' ');

test('the kit finds the blocks the payload holds, in every file it covers', () => {
  const payload = JSON.parse(readFileSync(path.join(repoRoot, 'data/comments/web-tools.json'), 'utf8'));
  const off = [];
  for (const [file, rows] of payload.files) {
    const got = CV.blocks(readFileSync(path.join(repoRoot, file), 'utf8'), file.split('.').pop());
    const want = rows.map((r) => r[0] + ':' + r[1] + ':' + WORDS(r[2])).join('\n');
    if (got.map((b) => b.line + ':' + b.kind + ':' + WORDS(b.text)).join('\n') !== want) off.push(file);
  }
  assert.deepEqual(off, [], 'files where the kit and python/comment-blocks.py disagree');
});

const PY = [
  '#!/usr/bin/env python3',                                   // 1
  '"""Build the payload: what each row is and where it goes.', // 2
  '',                                                          // 3
  'Inputs:',                                                   // 4
  '  data/a.csv    the rows, one per item, read whole and',   // 5
  '                kept in file order',                        // 6
  '  data/b.csv    the names',                                 // 7
  '"""',                                                       // 8
  'import csv',                                                // 9
  '',                                                          // 10
  '# The cut is a judgment, so it sits here rather than in',   // 11
  '# the data: anything over this many rows is split.',        // 12
  'CUT = 40',                                                  // 13
  '',                                                          // 14
  'def rows(path):',                                           // 15
  '    """Every row of a CSV at path, as a list of dicts."""', // 16
  '    with open(path) as f:',                                 // 17
  '        return list(csv.DictReader(f))',                    // 18
  "TEMPLATE = '''a long string literal that is content and not a docstring at all, so not a block'''", // 19
].join('\n');

test('a Python file: the module docstring, a comment run and a def docstring, and nothing from a string literal', () => {
  const b = CV.blocks(PY, 'py');
  assert.deepEqual(b.map((x) => [x.line, x.end, x.kind]), [[2, 8, 'header'], [11, 12, 'comment']]);
  // A one-line docstring has under twelve words, which embedded-prose.py
  // leaves out; a longer one is kept as a docstring of its def.
  const longer = PY.replace('Every row of a CSV at path, as a list of dicts.', 'Every row of a CSV at path, as a list of dicts, one per line, in the order the file holds them.');
  assert.deepEqual(CV.blocks(longer, 'py').map((x) => x.kind), ['header', 'comment', 'docstring']);
});

test('segments cover every line once: prose for each block, code between, no bar for a lone shebang', () => {
  const segs = CV.segments(PY, 'py');
  assert.deepEqual(segs.map((s) => s.t === 'code' ? 'code ' + s.a + '-' + s.b : s.kind + ' ' + s.line + '-' + s.end),
    ['header 2-8', 'code 9-10', 'comment 11-12', 'code 13-19']);
  const longer = PY.replace('Every row of a CSV at path, as a list of dicts.', 'Every row of a CSV at path, as a list of dicts, one per line, in the order the file holds them.');
  const doc = CV.segments(longer, 'py').find((s) => s.kind === 'docstring');
  assert.equal(doc.owner, 'def rows(path):', 'a docstring names the def it belongs to');
});

test('a JavaScript comment after a statement stays inside its code bar', () => {
  const js = [
    '// look.js: one marker on a page, and why the reader is shown it.', // 1
    'const a = 1; // the count the marker starts from, before any tap', // 2
    '/* A block comment that explains the next function',              // 3
    ' * across two lines of its own. */',                               // 4
    'function go() { return "// not a comment, a string"; }',           // 5
  ].join('\n');
  // Counted as embedded-prose.py counts it, the trailing comment joins the run above.
  assert.deepEqual(CV.blocks(js, 'js').map((x) => [x.line, x.end]), [[1, 2], [3, 4]]);
  const b = CV.blocks(js, 'js', { display: true });
  assert.deepEqual(b.map((x) => [x.line, x.kind, x.own]), [[1, 'header', true], [2, 'comment', false], [3, 'comment', true]]);
  assert.equal(b[2].text, 'A block comment that explains the next function\nacross two lines of its own.');
  assert.deepEqual(CV.segments(js, 'js').map((s) => s.t), ['prose', 'code', 'prose', 'code']);
});

test('prose keeps every word and lays out a definition list, a list and a command', () => {
  const text = [
    'What the build reads, and why each',
    'line wraps where it does.',
    '',
    'Inputs:',
    '  data/a.csv    the rows, one per item, read whole and',
    '                kept in file order',
    '  data/b.csv    the names',
    '',
    '- first, with `code` in it',
    '- second, which runs on',
    '  past its line',
    '',
    '    python3 python/build.py --check',
  ].join('\n');
  const doc = window.document.createElement('div');
  doc.innerHTML = CV.prose(text);
  const walk = window.document.createTreeWalker(doc, 4), seen = [];
  while (walk.nextNode()) seen.push(walk.currentNode.textContent);
  assert.equal(WORDS(seen.join(' ')), WORDS(text), 'no word is lost or added');
  assert.equal(doc.querySelector('p').textContent, 'What the build reads, and why each line wraps where it does.');
  assert.deepEqual([...doc.querySelectorAll('dt')].map((d) => d.textContent), ['data/a.csv', 'data/b.csv']);
  assert.equal(doc.querySelector('dd').textContent, 'the rows, one per item, read whole and kept in file order');
  assert.deepEqual([...doc.querySelectorAll('li')].map((l) => l.textContent), ['first, with code in it', 'second, which runs on past its line']);
  assert.equal(doc.querySelector('li code').textContent, 'code');
  assert.equal(doc.querySelector('pre').textContent, 'python3 python/build.py --check');
});

test('render marks the words looked up and opens a bar to its code', () => {
  const el = window.document.createElement('div');
  window.document.body.append(el);
  const n = CV.render(el, PY, 'py', { mark: /split/gi });
  assert.equal(n, 1, 'one mark, in the comment run');
  assert.equal(el.querySelector('mark').textContent, 'split');
  const bar = el.querySelector('[data-cv-code]');
  assert.equal(bar.getAttribute('aria-expanded'), 'false');
  bar.click();
  assert.equal(bar.getAttribute('aria-expanded'), 'true');
  assert.equal(bar.nextElementSibling.textContent, 'import csv\n');
});
