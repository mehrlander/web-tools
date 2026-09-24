// Unwrapping hard-wrapped markdown: a join that changes what the document says.
//
// The kit's claim is that it removes only soft breaks, which CommonMark renders
// as spaces, so the rendered document is unchanged. The corpus test holds it to
// that claim on every markdown file in the repo, rendered with marked before and
// after. The cases above it pin each structure that must survive as written,
// since a corpus can pass by not containing the one that breaks.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';
import { repoRoot } from './bootstrap.mjs';

const src = readFileSync(path.join(repoRoot, 'lib/kits/md-unwrap.js'), 'utf8');
const window = {};
new Function('window', src)(window);
const unwrap = (s) => window.mdUnwrap.unwrap(s);
const text = (s) => unwrap(s).text;

test('a wrapped paragraph becomes one line', () => {
  assert.deepEqual(unwrap('one two\nthree four\nfive\n\nnext para\nhere'),
    { text: 'one two three four five\n\nnext para here', joined: 3 });
});

test('a list item takes its indented continuation, and items stay apart', () => {
  assert.equal(text('- first item\n  continues\n- second\n  also\n\n1. num\n   more'),
    '- first item continues\n- second also\n\n1. num more');
});

test('a hard break is kept, and the lines after it may still join', () => {
  assert.equal(text('line one  \nline two\nline three'), 'line one  \nline two line three');
  assert.equal(text('a\\\nb\nc'), 'a\\\nb c');
  assert.equal(text('a\nb  \nc'), 'a b  \nc', 'a joined line keeps its own trailing hard break');
});

test('fenced and indented code are left exactly', () => {
  const fenced = 'para\n\n```js\nconst a = 1;\nconst b = 2;\n```\nafter\nthis';
  assert.equal(text(fenced), 'para\n\n```js\nconst a = 1;\nconst b = 2;\n```\nafter this');
  assert.equal(text('~~~~\na\nb\n~~~\nc\n~~~~'), '~~~~\na\nb\n~~~\nc\n~~~~', 'a shorter fence does not close');
  assert.equal(text('para\n\n    code one\n    code two\n\ntext'), 'para\n\n    code one\n    code two\n\ntext');
});

test('headings, rules, quotes and reference definitions are not joined', () => {
  assert.equal(text('# Title\nbody\nmore'), '# Title\nbody more');
  assert.equal(text('Setext\ntitle\n======\nbody'), 'Setext title\n======\nbody');
  assert.equal(text('para\n\n---\nnext'), 'para\n\n---\nnext');
  assert.equal(text('> quoted\n> lines'), '> quoted\n> lines');
  assert.equal(text('[//]: # (guide)\n## What'), '[//]: # (guide)\n## What');
  assert.equal(text('see [a]\n\n[a]: https://x.test\n"title"'), 'see [a]\n\n[a]: https://x.test\n"title"');
});

test('tables keep their rows', () => {
  const t = '| a | b |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |\n\nafter\ntable';
  assert.equal(text(t), '| a | b |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |\n\nafter table');
});

test('HTML blocks and comments run to their end untouched', () => {
  assert.equal(text('<details>\n<summary>s</summary>\nbody\n</details>\n\np\nq'),
    '<details>\n<summary>s</summary>\nbody\n</details>\n\np q');
  assert.equal(text('<!--\na\n\nb\n-->\nx\ny'), '<!--\na\n\nb\n-->\nx y');
});

test('frontmatter is kept, and CRLF comes back as CRLF', () => {
  assert.equal(text('---\ntitle: x\ntags: y\n---\n# H\na\nb'), '---\ntitle: x\ntags: y\n---\n# H\na b');
  assert.equal(text('a\r\nb\r\n\r\nc'), 'a b\r\n\r\nc');
});

test('text with nothing to join comes back byte for byte', () => {
  const s = '# T\n\none line\n\n- a\n- b\n';
  assert.deepEqual(unwrap(s), { text: s, joined: 0 });
});

// Every markdown file in the repo, rendered before and after. Whitespace runs
// are collapsed first, since a soft break renders as a newline where the joined
// text has a space, and HTML treats the two alike.
const SKIP = new Set(['node_modules', '.git', 'tools/.preview', 'dist']);
function mdFiles(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    const rel = path.relative(repoRoot, p);
    if (SKIP.has(name) || SKIP.has(rel)) continue;
    const st = statSync(p);
    if (st.isDirectory()) mdFiles(p, acc);
    else if (name.endsWith('.md')) acc.push(p);
  }
  return acc;
}

test('every markdown file in the repo renders the same after unwrapping', () => {
  const norm = (h) => h.replace(/\s+/g, ' ').replace(/> </g, '><').trim();
  const files = mdFiles(repoRoot);
  const broken = [];
  let joined = 0;
  for (const f of files) {
    const before = readFileSync(f, 'utf8');
    const r = unwrap(before);
    joined += r.joined;
    if (norm(marked.parse(before)) !== norm(marked.parse(r.text))) broken.push(path.relative(repoRoot, f));
  }
  assert.ok(files.length > 50, `expected the repo's markdown, found ${files.length} files`);
  assert.ok(joined > 1000, `expected hard-wrapped docs to join, joined ${joined}`);
  assert.deepEqual(broken, [], 'these render differently after unwrapping');
});

test('a break inside an inline code span is left alone', () => {
  assert.equal(text('run `npm\ntest` now\nplease'), 'run `npm\ntest` now please');
});
