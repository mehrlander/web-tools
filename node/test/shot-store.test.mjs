// Screenshots web-tools makes are kept in web-tools-private's thumbs/, never in
// this public repository (node/build/shot-store.mjs): a page or a UI unit can
// show private data. Two public shots did: the Waiting view's open user calls
// (2026-10-06) and a session's compaction summary on the Compactions page's
// thumbnail (2026-11-22). The galleries read the shots with the viewer's token.
//
// Held here: no screenshot folder is tracked, each of the three writers aims
// at the store, and the name pages-shots gives a page's shot is the one the
// app's catalogThumbPath and the gallery's catalog look up.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';
import { STORE_ROOT, UNIT_SHOTS, pageShot } from '../build/shot-store.mjs';
import { STORES } from '../build/ui-recipes.mjs';

const src = (f) => readFileSync(path.join(repoRoot, f), 'utf8');

test('this repository tracks no screenshot folder', () => {
  const r = spawnSync('git', ['ls-files', '--', 'pages/thumbs', 'data/ui-units/thumbs'], { cwd: repoRoot, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(r.stdout.split('\n').filter(Boolean), []);
});

test('every screenshot writer aims at the private store', () => {
  assert.equal(path.basename(STORE_ROOT), 'web-tools-private');
  for (const s of STORES) assert.ok(s.thumbs.startsWith(STORE_ROOT + path.sep), `${s.name} units' shots go to ${s.thumbs}`);
  assert.match(src('node/build/pages-shots.mjs'), /path\.join\(STORE_ROOT, pageShot\(src\)\)/, 'pages-shots writes each page shot into the store');
  assert.match(src('node/build/component-shots.mjs'), /const OUT = path\.join\(STORE_ROOT, UNIT_SHOTS\)/, 'component-shots writes into the store');
  assert.ok(UNIT_SHOTS.startsWith('thumbs/mehrlander/web-tools/'));
});

test("a page's shot has the name the app and the gallery look up", () => {
  const m = src('app/index.html').match(/function catalogThumbPath\([^)]*\)\s*\{[\s\S]*?\n\}/);
  assert.ok(m, 'catalogThumbPath was not found');
  const app = new Function('return (' + m[0] + ')')();
  for (const p of ['pages/diff-tool.html', 'pages/news/news.html', 'lib/kits/demos/note.html', 'skills/tree/demo.html'])
    assert.equal(pageShot(p), app('mehrlander/web-tools', p, ''), p);
  const rows = src('pages/pages.csv').split('\n').slice(1).filter(Boolean);
  assert.ok(rows.length > 50, 'the gallery catalog has its pages');
  assert.ok(rows.every(r => r.includes(',thumbs/mehrlander/web-tools/')), 'every catalog row names its shot in the store');
});
