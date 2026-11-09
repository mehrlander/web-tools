// lib/kits/content-index.js — the estate's Markdown as a word index in the
// registry: the pass over the documents index's rows, the tip gate, the
// incremental read by blob, the fetch cap and the pending fill, the split into
// shards by path, the skipped repos, the manifest, and search across shards.
// Driven over a fake GH; no network.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { repoRoot as root } from '../repo-root.mjs';

const win = { GH: { decode: (s) => Buffer.from(String(s), 'base64').toString('utf8') } };
for (const f of ['lib/kits/file-index.js', 'lib/kits/doc-index.js', 'lib/kits/session-index.js', 'lib/kits/content-index.js'])
  new Function('window', readFileSync(path.join(root, f), 'utf8'))(win);
const { DocIndex: D, ContentIndex: CI } = win;

const blob = (t) => createHash('sha1').update(t).digest('hex');
// The documents index's entry for a repo holding `files` (path -> text) at `sha`.
const docEntry = (files, sha = 'c1') => ({ sha, ...D.encode(Object.entries(files).map(([p, t]) => ({ path: p, blob: blob(t), words: 1 }))) });
function fakeRepo(files) {
  const reads = [];
  const gh = { async get(p, o) { reads.push([p, o?.ref]); if (!(p in files)) throw new Error('404'); return { text: files[p] }; } };
  return { reads, makeGH: () => gh };
}
// A registry holding the shards a pass returned, for the next pass to read.
const store = (e) => { const m = new Map((e?.shards || []).map(s => [s.path, s.doc])); return async (p) => m.get(p) || null; };
const hits = (e, q) => CI.search(e.shards.map(s => s.doc), q);

test('a first pass reads every Markdown file at the tip and finds them by word', async () => {
  const files = { 'README.md': 'The estate search lives in lib/kits/estate-search.js', 'docs/a.md': 'Allotment packets by fund' };
  const r = fakeRepo(files);
  const e = await CI.crawlRepo('o/r', docEntry(files), { makeGH: r.makeGH, read: store(null) });
  assert.deepEqual(r.reads.map(([, ref]) => ref), ['c1', 'c1'], 'read at the tip the documents index recorded');
  assert.equal(e.docs, 2); assert.equal(e.pending, 0);
  assert.deepEqual(e.shards.map(s => s.path), ['state/content-index/o.r.0.json']);
  assert.deepEqual(hits(e, 'allotment'), ['docs/a.md']);
  assert.deepEqual(hits(e, 'estate-search.js'), ['README.md'], 'a compound is found whole');
  assert.deepEqual(hits(e, 'search fund'), [], 'every word has to be in one file');
});

test('the next pass reads only what changed, and a quiet tip reads nothing', async () => {
  const files = { 'a.md': 'alpha', 'b.md': 'beta' };
  const first = await CI.crawlRepo('o/r', docEntry(files), { makeGH: fakeRepo(files).makeGH, read: store(null) });
  const man = CI.buildManifest(null, { 'o/r': first }, ['o/r'], 't');
  const quiet = fakeRepo(files);
  const carried = await CI.crawlRepo('o/r', docEntry(files), { makeGH: quiet.makeGH, prev: man.repos['o/r'], read: store(first) });
  assert.equal(carried.carried, true); assert.equal(quiet.reads.length, 0);

  const moved = { 'a.md': 'alpha', 'b.md': 'gamma' };
  const r = fakeRepo(moved);
  const e = await CI.crawlRepo('o/r', docEntry(moved, 'c2'), { makeGH: r.makeGH, prev: man.repos['o/r'], read: store(first) });
  assert.deepEqual(r.reads.map(([p]) => p), ['b.md'], 'the unchanged blob keeps its terms');
  assert.deepEqual(hits(e, 'gamma'), ['b.md']);
  assert.deepEqual(hits(e, 'beta'), [], 'the old words leave with the old blob');
});

test('past the fetch cap a file is pending, keeps any old words, and the next pass fills it', async () => {
  const files = { 'a.md': 'one', 'b.md': 'two', 'c.md': 'three' };
  const e = await CI.crawlRepo('o/r', docEntry(files), { makeGH: fakeRepo(files).makeGH, read: store(null), fetchCap: 2 });
  assert.equal(e.pending, 1); assert.equal(e.docs, 2);
  const man = CI.buildManifest(null, { 'o/r': e }, ['o/r'], 't');
  const r = fakeRepo(files);
  const next = await CI.crawlRepo('o/r', docEntry(files), { makeGH: r.makeGH, prev: man.repos['o/r'], read: store(e), fetchCap: 2 });
  assert.deepEqual(r.reads.map(([p]) => p), ['c.md'], 'the same tip still reads, because something was pending');
  assert.equal(next.pending, 0); assert.equal(next.docs, 3);
  assert.deepEqual(CI.changedRepos(man, CI.buildManifest(man, { 'o/r': next }, ['o/r'], 't2')), ['o/r']);
});

test('a large repo is split by path into shards of at most BUCKET_DOCS, deterministically', async () => {
  const files = {};
  for (let i = 0; i < CI.BUCKET_DOCS + 5; i++) files[`d/${i}.md`] = `word${i} common`;
  const e = await CI.crawlRepo('o/big', docEntry(files), { makeGH: fakeRepo(files).makeGH, read: store(null), fetchCap: Infinity });
  assert.equal(e.shards.length, 2);
  assert.deepEqual(e.shards.map(s => s.path), ['state/content-index/o.big.0.json', 'state/content-index/o.big.1.json']);
  assert.equal(e.shards.reduce((n, s) => n + s.doc.docs.length, 0), CI.BUCKET_DOCS + 5);
  assert.equal(hits(e, 'word7').length, 1 + 10 + 100, 'a substring of a term: word7, word70 to 79, word700 to 799');
  assert.deepEqual(hits(e, 'word1004'), ['d/1004.md']);
  assert.equal(hits(e, 'common').length, CI.BUCKET_DOCS + 5, 'every shard answers');
  const again = await CI.crawlRepo('o/big', docEntry(files), { makeGH: fakeRepo(files).makeGH, read: store(null), fetchCap: Infinity });
  assert.equal(JSON.stringify(again.shards), JSON.stringify(e.shards), 'the same input writes the same bytes');
});

test('a shard round-trips its blobs and terms', () => {
  const s = CI.buildShard({ 'a.md': { blob: 'abc', terms: new Set(['x', 'y']) }, 'b.md': { blob: 'def', terms: new Set(['y']) } });
  const back = CI.readShard(s);
  assert.equal(back['a.md'].blob, 'abc');
  assert.deepEqual([...back['b.md'].terms], ['y']);
});

test('skipped repos are not indexed and leave the manifest', async () => {
  for (const repo of Object.keys(CI.SKIP)) {
    assert.equal(await CI.crawlRepo(repo, docEntry({ 'a.md': 'x' }), { makeGH: fakeRepo({}).makeGH, read: store(null) }), null);
  }
  const man = CI.buildManifest({ repos: { 'mehrlander/fn-data': { sha: 's', docs: 1, pending: 0, shards: [] } } }, {}, ['mehrlander/fn-data'], 't');
  assert.deepEqual(man.repos, {});
});

test('the manifest names shards by path and carries no terms', async () => {
  const files = { 'a.md': 'alpha' };
  const e = await CI.crawlRepo('o/r', docEntry(files), { makeGH: fakeRepo(files).makeGH, read: store(null) });
  const man = CI.buildManifest(null, { 'o/r': e }, ['o/r'], 't');
  assert.deepEqual(man.repos['o/r'], { sha: 'c1', docs: 1, pending: 0, shards: ['state/content-index/o.r.0.json'] });
});
