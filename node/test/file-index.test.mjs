// lib/kits/file-index.js — the estate's file names in the registry: the
// folder-grouped encoding and its cap, the walk past a truncated trees
// response, the default-branch gate, the fold's carry and drop, and the
// ranking the finder shows. Driven over a fake GH; no network.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const win = {};
new Function('window', readFileSync(path.join(root, 'lib/kits/file-index.js'), 'utf8'))(win);
const F = win.FileIndex;

// A fake GH over a nested tree. `limit` is how many entries a recursive read
// may return before it reports `truncated`, standing in for GitHub's 100,000.
function fakeTree(spec, limit = Infinity) {
  const nodes = new Map();
  let n = 0;
  const build = (obj) => {
    const sha = 't' + (n++);
    const entries = Object.entries(obj).map(([name, v]) =>
      v && typeof v === 'object' ? { path: name, type: 'tree', sha: build(v) } : { path: name, type: 'blob', sha: 'b' + (n++) });
    nodes.set(sha, entries);
    return sha;
  };
  const rootSha = build(spec);
  const flat = (sha, prefix = '') => nodes.get(sha).flatMap(e =>
    e.type === 'tree' ? [{ ...e, path: prefix + e.path }, ...flat(e.sha, prefix + e.path + '/')] : [{ ...e, path: prefix + e.path }]);
  const calls = [];
  const gh = {
    async req(p) {
      calls.push(p);
      const m = String(p).match(/^git\/trees\/([^?]+)(\?recursive=1)?$/);
      const sha = m[1] === 'HEAD' || m[1].startsWith('c') ? rootSha : m[1];
      if (!nodes.has(sha)) throw Object.assign(new Error('404'), { status: 404 });
      if (!m[2]) return { sha, tree: nodes.get(sha), truncated: false };
      const all = flat(sha);
      return { sha, tree: all.slice(0, limit), truncated: all.length > limit };
    },
  };
  return { gh, calls };
}

test('paths group by folder, and a folder over the cap is stored as its count', () => {
  const { dirs, files, collapsed } = F.encode(['README.md', 'lib/a.js', 'lib/b.js', 'big/1', 'big/2', 'big/3'], 2);
  assert.deepEqual(dirs, { '': ['README.md'], big: 3, lib: ['a.js', 'b.js'] });
  assert.equal(files, 3);
  assert.equal(collapsed, 1);
  assert.deepEqual(F.paths({ dirs }).sort(), ['README.md', 'lib/a.js', 'lib/b.js']);
});

test('an untruncated tree is one call', async () => {
  const { gh, calls } = fakeTree({ 'README.md': 1, lib: { 'a.js': 1 } });
  const t = await F.readTree(gh, 'HEAD');
  assert.deepEqual(t.paths.sort(), ['README.md', 'lib/a.js']);
  assert.equal(t.truncated, false);
  assert.equal(calls.length, 1);
});

test('a truncated tree is walked subtree by subtree until every path is read', async () => {
  const spec = { 'README.md': 1, docs: { 'a.md': 1 }, bills: { texts: { y1: { '1.htm': 1, '2.htm': 1 }, y2: { '3.htm': 1 } } } };
  const { gh } = fakeTree(spec, 4);
  const t = await F.readTree(gh, 'HEAD');
  assert.deepEqual(t.paths.sort(), ['README.md', 'bills/texts/y1/1.htm', 'bills/texts/y1/2.htm', 'bills/texts/y2/3.htm', 'docs/a.md']);
  assert.equal(t.truncated, false);
});

test('an unmoved tip carries the stored entry and makes no call', async () => {
  const { gh, calls } = fakeTree({ 'a.md': 1 });
  const prev = { sha: 'c1', dirs: { '': ['a.md'] } };
  const e = await F.crawlRepo('me/r', 'c1', { makeGH: () => gh, prev });
  assert.equal(e.carried, true);
  assert.equal(calls.length, 0);
  const moved = await F.crawlRepo('me/r', 'c2', { makeGH: () => gh, prev });
  assert.equal(moved.sha, 'c2');
  assert.deepEqual(moved.dirs, { '': ['a.md'] });
  assert.equal(calls.length, 1);
});

test('no tip to gate on carries rather than reads', async () => {
  const { gh, calls } = fakeTree({ 'a.md': 1 });
  assert.equal(await F.crawlRepo('me/r', '', { makeGH: () => gh, prev: null }), null);
  assert.equal(calls.length, 0);
});

test('the fold keeps members only, strips run facts, and the gate sees only sha moves', () => {
  const prev = { repos: { 'me/a': { sha: '1', dirs: {} }, 'me/gone': { sha: '9', dirs: {} } } };
  const fetched = { 'me/a': { sha: '1', dirs: {}, carried: true }, 'me/b': { sha: '2', dirs: {}, calls: 3 } };
  const next = F.buildIndex(prev, fetched, ['me/a', 'me/b'], '2026-10-01T00:00:00Z');
  assert.deepEqual(Object.keys(next.repos), ['me/a', 'me/b']);
  assert.equal('calls' in next.repos['me/b'], false);
  assert.equal('carried' in next.repos['me/a'], false);
  assert.deepEqual(F.changedRepos(prev, next).sort(), ['me/b', 'me/gone']);
  assert.deepEqual(F.changedRepos(next, F.buildIndex(next, {}, ['me/a', 'me/b'], 'later')), []);
});

test('ranking: the stem itself, then a name prefix, then a name match, then a folder match', () => {
  const doc = { repos: {
    'me/wt': { dirs: { 'data/design': ['content.csv'] } },
    'me/priv': { dirs: { '': ['DESIGN.md'] } },
    'me/home': { dirs: { 'chron': ['2026-04-03-daily-log-design.md'], 'app/lifecycle': ['DESIGN.md'], 'x': ['design-notes.md'] } },
    'me/bills': { dirs: { 'bills/design': 3000 } },
  } };
  const r = F.search(doc, 'Design', { preferRepo: 'me/wt' });
  assert.deepEqual(r.hits.map(h => h.repo + ':' + h.path), [
    'me/priv:DESIGN.md',
    'me/home:app/lifecycle/DESIGN.md',
    'me/home:x/design-notes.md',
    'me/home:chron/2026-04-03-daily-log-design.md',
    'me/wt:data/design/content.csv',
  ]);
  assert.equal(r.total, 5);
  assert.deepEqual(r.folders, [{ repo: 'me/bills', path: 'bills/design', count: 3000 }]);
});

test('the preferred repo wins within a rank, never across ranks', () => {
  const doc = { repos: { 'me/a': { dirs: { '': ['notes.md'] } }, 'me/b': { dirs: { '': ['notes.md', 'old-notes.md'] } } } };
  const r = F.search(doc, 'notes', { preferRepo: 'me/b' });
  assert.deepEqual(r.hits.map(h => h.repo + ':' + h.path), ['me/b:notes.md', 'me/a:notes.md', 'me/b:old-notes.md']);
});

test('the committed text is JSON, one line per folder, and round-trips', () => {
  const doc = { generatedAt: 'g', folderCap: 2000, repos: {
    'me/a': { sha: '1', files: 2, dirs: { '': ['README.md'], lib: ['x.js'] } },
    'me/b': { sha: '2', dirs: { big: 3000 } },
  } };
  const text = F.serialize(doc);
  assert.deepEqual(JSON.parse(text), doc);
  assert.ok(text.split('\n').some(l => l.trim() === '"lib":["x.js"]'), text);
  assert.deepEqual(JSON.parse(F.serialize({ repos: {} })), { repos: {} });
});
