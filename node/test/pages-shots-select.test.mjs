// node/build/pages-shots.mjs: which pages a thumbnail refresh shoots.
//
// CLAUDE.md names the per-session refresh as `npm run pages-shots -- <page…>`,
// and a refresh run that way as `pages-shots -- diff-tool` shot nothing: the
// names were compared with `.html` still on, so a bare name selected the empty
// set, and `results.every(r => r.ok)` is true of an empty set, so the run
// printed `0/0 ok` and exited 0 (snag pages-shots-vacuous-ok, seen twice). The
// selection is a pure function, asserted here without a browser; the last case
// runs the script itself on a name that matches nothing, which exits before
// any browser is launched.

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';
import { selectPages } from '../build/pages-shots.mjs';

const PAGES = [
  { rel: 'diff-tool.html', src: 'pages/diff-tool.html' },
  { rel: 'sub/inner.html', src: 'pages/sub/inner.html' },
  { rel: 'kit-demos/note.html', src: 'lib/kits/demos/note.html' },
  { rel: 'skill-demos/tree.html', src: 'skills/tree/demo.html' },
];
const rels = (r) => r.selected.map(p => p.rel);

test('a page is named with or without pages/ and .html', () => {
  for (const name of ['diff-tool', 'diff-tool.html', 'pages/diff-tool', 'pages/diff-tool.html', './pages/diff-tool.html']) {
    const r = selectPages(PAGES, [name]);
    assert.deepEqual(rels(r), ['diff-tool.html'], name);
    assert.deepEqual(r.unmatched, [], name);
  }
  assert.deepEqual(rels(selectPages(PAGES, ['sub/inner'])), ['sub/inner.html'], 'a page in a folder keeps its folder');
});

test('a demo is named by its thumbnail path or by its source path', () => {
  assert.deepEqual(rels(selectPages(PAGES, ['kit-demos/note'])), ['kit-demos/note.html']);
  assert.deepEqual(rels(selectPages(PAGES, ['lib/kits/demos/note.html'])), ['kit-demos/note.html']);
  assert.deepEqual(rels(selectPages(PAGES, ['skill-demos/tree.html'])), ['skill-demos/tree.html']);
  assert.deepEqual(rels(selectPages(PAGES, ['skills/tree/demo.html'])), ['skill-demos/tree.html']);
});

test('every argument that names nothing is reported, beside the ones that matched', () => {
  const r = selectPages(PAGES, ['diff-tool', 'inner', 'no-such-page']);
  assert.deepEqual(rels(r), ['diff-tool.html']);
  assert.deepEqual(r.unmatched, ['inner', 'no-such-page'], 'a bare name does not reach into a folder');
});

test('no arguments select every page', () => {
  const r = selectPages(PAGES, []);
  assert.deepEqual(rels(r), PAGES.map(p => p.rel));
  assert.deepEqual(r.unmatched, []);
});

test('a run whose argument names no page exits nonzero and names it', () => {
  const r = spawnSync(process.execPath, [path.join(repoRoot, 'node/build/pages-shots.mjs'), 'no-such-page-xyz'],
    { cwd: repoRoot, encoding: 'utf8' });
  assert.notEqual(r.status, 0, 'an empty selection is not a successful refresh');
  assert.match(r.stderr, /no-such-page-xyz/);
  assert.doesNotMatch(r.stdout, /shooting/, 'and nothing was shot');
});

test('a mixed list with one unknown name exits nonzero and shoots nothing', () => {
  const r = spawnSync(process.execPath, [path.join(repoRoot, 'node/build/pages-shots.mjs'), 'diff-tool', 'no-such-page-xyz'],
    { cwd: repoRoot, encoding: 'utf8' });
  assert.notEqual(r.status, 0, 'one bad name fails the whole refresh');
  assert.match(r.stderr, /no-such-page-xyz names no page/);
  assert.doesNotMatch(r.stdout, /shooting/, 'the matched page is not shot either');
});
