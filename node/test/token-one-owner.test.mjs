// ONE READER OF THE SAVED TOKEN: lib/gh-auth.js, as window.ghAuth.resolve().
// On 2026-10-20 about twenty places outside it read localStorage.ghToken for
// themselves, and docs/loader.md showed new files the inline read, so it kept
// spreading. They now ask gh-auth, which gh-boot loads second on every page
// that boots the library. Each kept the order it had (window.TOKEN first, or a
// client's own token first), since those orders were chosen per surface; what
// moved is only the read of storage itself.
//
// The files below still touch storage directly, each because it runs where
// gh-auth cannot be: before any library has loaded, or on a page that loads
// none. A file that boots the library has no such reason.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from '../repo-root.mjs';

const READ = /localStorage\.getItem\(\s*['"]ghToken['"]\s*\)/g;
const WRITE = /localStorage\.(?:setItem|removeItem)\(\s*['"]ghToken['"]/g;

// file -> how many direct reads it may hold, and why.
const READERS = {
  'lib/gh-auth.js': [1, 'the owner'],
  'lib/alpineComponents/fab.js': [1, "_savedToken's one fallback, for a host that loads the FAB without gh-boot"],
  // Boot preambles: they seed window.TOKEN before the library is imported.
  'app/index.html': [1, 'boot preamble'],
  'pages/repo-atlas.html': [1, 'boot preamble'],
  'pages/demos/mention-demo.html': [1, 'boot preamble'],
  // Pages that load no library at all.
  'pages/toss-render.html': [2, 'its render path loads no lib, by design'],
  'pages/doc-growth.html': [1, 'loads no lib'],
  'pages/delivery.html': [1, 'loads no lib'],
  'pages/launcher.html': [1, 'loads no lib; it is the token form'],
  'pages/shortcut-edit.html': [1, 'loads no lib'],
};
const WRITERS = { 'lib/gh-auth.js': 2, 'pages/launcher.html': 2 };

const files = execFileSync('git', ['ls-files', 'lib', 'pages', 'app', 'popups'], { cwd: repoRoot, encoding: 'utf8' })
  .split('\n').filter((f) => /\.(js|html)$/.test(f) && !f.startsWith('pages/scratch/'));
const count = (re) => Object.fromEntries(files
  .map((f) => [f, (readFileSync(path.join(repoRoot, f), 'utf8').match(re) || []).length])
  .filter(([, n]) => n));

test('only gh-auth.js reads the saved token, and each exception is where it was', () => {
  const want = Object.fromEntries(Object.entries(READERS).map(([f, [n]]) => [f, n]));
  assert.deepEqual(count(READ), want,
    'a file reads localStorage.ghToken itself; ask window.ghAuth.resolve() instead, or say here why it cannot');
});

test('only gh-auth.js and the library-free launcher write it', () => {
  assert.deepEqual(count(WRITE), WRITERS, 'a token write outside ghAuth.save skips its change notice');
});
