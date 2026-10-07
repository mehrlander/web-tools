// lib/kits/doc-index.js — the estate's Markdown with word counts in the
// registry: the folder-grouped encoding, the tip gate, the incremental read by
// blob, the fetch cap and the pending fill, and the material-change test.
// Driven over a fake GH; no network.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const win = {};
for (const f of ['lib/kits/file-index.js', 'lib/kits/doc-index.js'])
  new Function('window', readFileSync(path.join(root, f), 'utf8'))(win);
const D = win.DocIndex;

// A flat repo: path -> text. Blob shas are derived from the text, so a changed
// file gets a new blob and an unchanged one keeps its own.
function fakeRepo(files) {
  const blob = (t) => createHash('sha1').update(t).digest('hex');
  const calls = [];
  const gh = {
    async req(p) {
      calls.push(p);
      if (p.startsWith('git/trees/'))
        return { truncated: false, tree: Object.entries(files).map(([path, t]) => ({ path, type: 'blob', sha: blob(t) })) };
      const m = p.match(/^contents\/(.+)\?ref=/);
      const name = decodeURIComponent(m[1]);
      return { content: Buffer.from(files[name], 'utf8').toString('base64') };
    },
  };
  return { gh, calls, makeGH: () => gh };
}

test('only Markdown is indexed, grouped by folder, with whitespace word counts', async () => {
  const r = fakeRepo({ 'README.md': 'one two three', 'docs/a.md': 'café au lait', 'lib/x.js': 'not a doc' });
  const e = await D.crawlRepo('o/r', 'c1', { makeGH: r.makeGH });
  assert.deepEqual(Object.keys(e.dirs), ['', 'docs']);
  assert.equal(e.dirs[''][ 'README.md'][0], 3);
  assert.equal(e.dirs.docs['a.md'][0], 3, 'UTF-8 decoded before splitting');
  assert.equal(e.docs, 2);
  assert.equal(e.words, 6);
  assert.equal(e.pending, 0);
});

test('an unmoved tip carries with no call; a moved tip reads only changed files', async () => {
  const files = { 'a.md': 'alpha', 'b.md': 'beta gamma' };
  const r = fakeRepo(files);
  const first = await D.crawlRepo('o/r', 'c1', { makeGH: r.makeGH });
  const n = r.calls.length;
  const same = await D.crawlRepo('o/r', 'c1', { makeGH: r.makeGH, prev: first });
  assert.equal(same.carried, true);
  assert.equal(r.calls.length, n, 'no call for an unmoved tip');
  files['b.md'] = 'beta gamma delta';
  const next = await D.crawlRepo('o/r', 'c2', { makeGH: r.makeGH, prev: first });
  const reads = r.calls.slice(n).filter(c => c.startsWith('contents/'));
  assert.deepEqual(reads, ['contents/b.md?ref=c2'], 'only the changed blob is read');
  assert.equal(next.dirs['']['a.md'][0], 1);
  assert.equal(next.dirs['']['b.md'][0], 3);
});

test('the fetch cap leaves files pending, and the next run fills them without a tree read', async () => {
  const r = fakeRepo({ 'a.md': 'x', 'b.md': 'y y', 'c.md': 'z z z' });
  const capped = await D.crawlRepo('o/r', 'c1', { makeGH: r.makeGH, fetchCap: 1 });
  assert.equal(capped.pending, 2);
  const before = r.calls.length;
  const filled = await D.crawlRepo('o/r', 'c1', { makeGH: r.makeGH, prev: capped });
  assert.equal(filled.pending, 0);
  assert.equal(filled.words, 6);
  assert.ok(!r.calls.slice(before).some(c => c.startsWith('git/trees/')), 'pending fill reuses the stored list');
  assert.deepEqual(D.changedRepos({ repos: { 'o/r': capped } }, { repos: { 'o/r': filled } }), ['o/r'],
    'a change in pending is a material change even at the same tip');
});

test('rows flattens an entry, and a folder over the cap is stored as its count', () => {
  const docs = [{ path: 'a/1.md', blob: 'x', words: 1 }, { path: 'a/2.md', blob: 'y', words: 2 }, { path: 'b.md', blob: 'z', words: 3 }];
  const e = D.encode(docs, 1);
  assert.equal(e.dirs.a, 2);
  assert.equal(e.collapsed, 1);
  assert.deepEqual(D.rows(e).map(r => r.path), ['b.md']);
});
