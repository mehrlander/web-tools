// gh-transfer.js — the cross-repo copy methods on GH.prototype, and in
// particular commitFiles, which lands a whole fileset as ONE commit through the
// Git Data API where copyTo makes one commit per file through the Contents API.
//
// The file had no test at all before this one, so getRaw, saveRaw, copyTo,
// createRef and createPull are covered here too. Each test runs the IIFE
// against a minimal GH stub that records every request, then reads that log to
// prove the call SEQUENCE, which is the whole of what a Git Data write is: a
// blob per file, one tree over the branch's current one, one commit, one ref
// move. A wrong order still returns shas and still looks like it worked.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot, withTraffic, GH_BASE64 } from './bootstrap.mjs';

const src = readFileSync(path.join(repoRoot, 'lib/gh-transfer.js'), 'utf8');

// `refFails` makes the first N ref PATCHes reject as non-fast-forward, which is
// the branch taking a commit while the blobs upload. `tip` advances each time,
// so a rebuild that reused the stale parent would be visible.
function makeGH({ refFails = 0, contents = {}, blobs = {}, defaultBranch = 'main' } = {}) {
  const reqs = [];
  let failed = 0, tipN = 0;
  function GH(conf = {}) { this.token = conf.token || ''; this.repo = conf.repo || ''; this.ref = ''; }
  GH.toBase64 = GH_BASE64.toBase64;
  GH.FRESH = { cache: 'no-store' };
  GH.prototype.req = async function (p, opts = {}) {
    const body = opts.body ? JSON.parse(opts.body) : null;
    reqs.push({ repo: this.repo, path: p, method: opts.method || 'GET', body, opts });
    if (p === '') return { default_branch: defaultBranch };
    if (p.startsWith('contents/')) {
      if (opts.method === 'PUT') return { content: { sha: 'put-sha' } };
      const key = decodeURIComponent(new URL(p, 'https://api.github.com/').pathname.slice('/contents/'.length));
      if (!(key in contents)) throw Object.assign(new Error('404'), { status: 404 });
      return contents[key];
    }
    if (p.startsWith('git/ref/heads/')) return { object: { sha: 'tip' + tipN } };
    if (p === 'git/blobs') return { sha: 'blob-' + reqs.filter(r => r.path === 'git/blobs').length };
    // The READ side of the same endpoint: what getRaw falls back to when the
    // Contents API withholds the bytes of a file over its ~1 MB cap.
    if (p.startsWith('git/blobs/')) {
      const sha = p.slice('git/blobs/'.length);
      if (!(sha in blobs)) throw Object.assign(new Error('404'), { status: 404 });
      return blobs[sha];
    }
    if (p.startsWith('git/commits/')) return { tree: { sha: 'tree-of-' + p.split('/').pop() } };
    if (p === 'git/trees') return { sha: 'newtree' + tipN };
    if (p === 'git/commits') return { sha: 'newcommit' + tipN };
    if (p.startsWith('git/refs/heads/') && opts.method === 'PATCH') {
      if (failed < refFails) { failed++; tipN++; throw Object.assign(new Error('not a fast forward'), { status: 422 }); }
      return { object: { sha: body.sha } };
    }
    if (p === 'git/refs') return { ref: body.ref };
    if (p === 'pulls') return { number: 7, html_url: 'https://example/pull/7' };
    throw new Error('unstubbed request: ' + opts.method + ' ' + p);
  };
  const window = withTraffic({ GH });
  new Function('window', src)(window);
  return { GH, gh: new GH({ repo: 'me/dest' }), reqs };
}

const seq = (reqs) => reqs.map(r => r.method + ' ' + r.path);
const FILES = [{ path: 'pkg/a.txt', content: 'YQ==' }, { path: 'pkg/b.bin', content: 'Yg==' }];

test('commitFiles writes blobs, then one tree, one commit, one ref move', async () => {
  const { gh, reqs } = makeGH();
  const out = await gh.commitFiles(FILES, { message: 'deposit', branch: 'main' });
  assert.deepEqual(seq(reqs), [
    'POST git/blobs', 'POST git/blobs',
    'GET git/ref/heads/main', 'GET git/commits/tip0',
    'POST git/trees', 'POST git/commits', 'PATCH git/refs/heads/main',
  ], 'blobs first, then the tip read the tree is built on');
  assert.deepEqual(out, { sha: 'newcommit0', branch: 'main', tree: 'newtree0', files: 2 });
});

test('every file rides one commit, so the destination takes one write', async () => {
  const { gh, reqs } = makeGH();
  await gh.commitFiles(FILES, { branch: 'main' });
  assert.equal(reqs.filter(r => r.path === 'git/commits' && r.method === 'POST').length, 1);
  assert.equal(reqs.filter(r => r.method === 'PATCH').length, 1);
  assert.equal(reqs.filter(r => r.path.startsWith('contents/')).length, 0,
    'the Contents API is not touched, which is what makes it one commit');
});

test('the tree is built over the branch tip, and names every file at 100644', async () => {
  const { gh, reqs } = makeGH();
  await gh.commitFiles(FILES, { branch: 'main' });
  const tree = reqs.find(r => r.path === 'git/trees').body;
  assert.equal(tree.base_tree, 'tree-of-tip0', 'built over what the branch already has');
  assert.deepEqual(tree.tree, [
    { path: 'pkg/a.txt', mode: '100644', type: 'blob', sha: 'blob-1' },
    { path: 'pkg/b.bin', mode: '100644', type: 'blob', sha: 'blob-2' },
  ]);
  const commit = reqs.find(r => r.path === 'git/commits' && r.method === 'POST').body;
  assert.deepEqual(commit.parents, ['tip0'], 'the branch tip is the parent, so nothing is orphaned');
});

test('content rides as base64 and is never decoded on the way through', async () => {
  const { gh, reqs } = makeGH();
  await gh.commitFiles([{ path: 'x', content: '3q2+7w==' }], { branch: 'main' });
  const blob = reqs.find(r => r.path === 'git/blobs').body;
  assert.deepEqual(blob, { content: '3q2+7w==', encoding: 'base64' });
});

test('an empty repository file copies alongside nonempty content in one commit', async () => {
  const { gh, reqs } = makeGH({ contents: {
    'empty.txt': { content: '', sha: 'empty-blob', size: 0 },
  } });
  const empty = await gh.getRaw('empty.txt');
  const out = await gh.commitFiles([
    { path: 'empty.txt', content: empty.content }, ...FILES,
  ], { branch: 'main' });
  assert.deepEqual(reqs.filter(r => r.path === 'git/blobs').map(r => r.body), [
    { content: '', encoding: 'base64' },
    { content: 'YQ==', encoding: 'base64' },
    { content: 'Yg==', encoding: 'base64' },
  ]);
  assert.equal(reqs.find(r => r.path === 'git/trees').body.tree.length, 3);
  assert.equal(reqs.filter(r => r.method === 'PATCH').length, 1);
  assert.equal(out.files, 3);
});

test('empty content replaces an existing blob and takes precedence over bytes', async () => {
  const { gh, reqs } = makeGH();
  await gh.commitFiles([
    { path: 'truncate.txt', content: '', sha: 'old-blob' },
    { path: 'empty.txt', content: '', bytes: new Uint8Array([42]) },
  ], { branch: 'main' });
  assert.deepEqual(reqs.filter(r => r.path === 'git/blobs').map(r => r.body.content), ['', '']);
  assert.deepEqual(reqs.find(r => r.path === 'git/trees').body.tree.map(f => f.sha), ['blob-1', 'blob-2']);
});

test('zero-byte buffers, existing blobs and explicit deletions keep their meanings', async () => {
  const { gh, reqs } = makeGH();
  await gh.commitFiles([
    { path: 'buffer.bin', bytes: new ArrayBuffer(0) },
    { path: 'array.bin', bytes: new Uint8Array(0) },
    { path: 'existing.txt', sha: 'existing-blob' },
    { path: 'deleted.txt', sha: null, content: '' },
  ], { branch: 'main' });
  assert.deepEqual(reqs.filter(r => r.path === 'git/blobs').map(r => r.body.content), ['', '']);
  assert.deepEqual(reqs.find(r => r.path === 'git/trees').body.tree.map(f => f.sha), [
    'blob-1', 'blob-2', 'existing-blob', null,
  ]);
});

test('absent file payloads are still refused', async () => {
  for (const payload of [{}, { content: null }, { content: undefined, bytes: null }]) {
    const { gh, reqs } = makeGH();
    await assert.rejects(() => gh.commitFiles([{ path: 'missing.txt', ...payload }], { branch: 'main' }),
      /must have content, bytes, or sha/);
    assert.equal(reqs.length, 0);
  }
});

test('transfer reads and writes preserve literal URL characters in file paths', async () => {
  const name = 'notes/A#B?C%2F & café.txt';
  const { gh, reqs } = makeGH({ contents: { [name]: { content: 'YQ==', sha: 's1', size: 1 } } });
  gh.ref = 'feature/copy#part&more+100%';
  const file = await gh.getRaw(name);
  await gh.saveRaw(name, file.content, 'copy', gh.ref);
  const [read, write] = reqs;
  for (const request of [read, write]) {
    const url = new URL(request.path, 'https://api.github.com/');
    assert.equal(decodeURIComponent(url.pathname), '/contents/' + name);
    assert.equal(url.hash, '');
  }
  const readUrl = new URL(read.path, 'https://api.github.com/');
  assert.equal(readUrl.searchParams.get('ref'), gh.ref);
  assert.equal([...readUrl.searchParams].length, 1);
  assert.equal(new URL(write.path, 'https://api.github.com/').search, '');
  assert.equal(write.body.branch, gh.ref);
});

test('reserved branch characters survive commit retries and ref creation', async () => {
  const branch = 'feature/copy#part&more+100%';
  const { gh, reqs } = makeGH({ refFails: 1 });
  await gh.commitFiles(FILES, { branch });
  await gh.createRef('next#branch', branch);
  const refs = reqs.filter(r => /^git\/refs?\/heads\//.test(r.path));
  assert.equal(refs.length, 5, 'two tip reads, two ref moves, and the source branch read');
  for (const request of refs) {
    const url = new URL(request.path, 'https://api.github.com/');
    assert.equal(decodeURIComponent(url.pathname).replace(/^\/git\/refs?\/heads\//, ''), branch);
    assert.equal(url.search, '');
    assert.equal(url.hash, '');
    assert.ok(url.pathname.includes('/feature/'), 'branch separators remain path separators');
  }
  assert.equal(reqs.find(r => r.path === 'git/refs').body.ref, 'refs/heads/next#branch');
});

test('saveRaw refreshes a conflicting file SHA without changing the client ref', async () => {
  const { gh, reqs } = makeGH();
  Object.defineProperty(gh, 'ref', {
    get() { return this._ref; },
    set(value) { this._ref = value; this._pinned = true; this._pathsOnly = false; },
  });
  gh.ref = 'preview';
  gh._pinned = false;
  gh._pathsOnly = true;
  const request = gh.req;
  let writes = 0;
  gh.req = async function(p, opts = {}) {
    if (opts.method === 'PUT') {
      writes++;
      if (writes === 1) throw Object.assign(new Error('stale SHA'), { status: 409 });
      assert.equal(JSON.parse(opts.body).sha, 'fresh-sha');
    } else if (p.startsWith('contents/')) {
      reqs.push({ path: p, opts });
      return { content: '', sha: opts.cache === 'no-store' ? 'fresh-sha' : 'stale-sha', size: 0 };
    }
    return request.call(this, p, opts);
  };
  await gh.saveRaw('empty.txt', '', 'truncate', 'target');
  assert.equal(writes, 2);
  const recovery = reqs.find(r => r.opts.cache === 'no-store');
  assert.ok(recovery, 'a recovery read bypasses the browser HTTP cache');
  assert.equal(new URL(recovery.path, 'https://api.github.com/').searchParams.get('ref'), 'target');
  assert.equal(gh.ref, 'preview');
  assert.equal(gh._pinned, false);
  assert.equal(gh._pathsOnly, true);
});

test('a branch that moved mid-upload rebuilds on the new tip rather than clobbering it', async () => {
  const { gh, reqs } = makeGH({ refFails: 1 });
  const out = await gh.commitFiles(FILES, { branch: 'main' });
  assert.equal(reqs.filter(r => r.path === 'git/blobs').length, 2,
    'blobs are content-addressed, so the retry re-uploads nothing');
  assert.equal(reqs.filter(r => r.method === 'PATCH').length, 2, 'one rejected move, one that landed');
  const trees = reqs.filter(r => r.path === 'git/trees');
  assert.equal(trees[1].body.base_tree, 'tree-of-tip1',
    'the second tree is built on the tip that rejected the first, not the stale one');
  assert.equal(out.sha, 'newcommit1');
});

test('the tip read bypasses the HTTP cache, or the retry re-reads the rejected sha', async () => {
  const { gh, reqs } = makeGH();
  await gh.commitFiles(FILES, { branch: 'main' });
  const tipRead = reqs.find(r => r.path === 'git/ref/heads/main');
  assert.equal(tipRead.opts.cache, 'no-store');
});

test('a branch that keeps moving gives up rather than looping', async () => {
  const { gh, reqs } = makeGH({ refFails: 9 });
  await assert.rejects(() => gh.commitFiles(FILES, { branch: 'main' }), (e) => e.status === 422);
  assert.equal(reqs.filter(r => r.method === 'PATCH').length, 3, 'bounded at three attempts');
});

test('a slashed branch name is not percent-encoded, since the ref path carries it whole', async () => {
  const { gh, reqs } = makeGH();
  await gh.commitFiles(FILES, { branch: 'claude/some-branch' });
  assert.ok(reqs.some(r => r.path === 'git/ref/heads/claude/some-branch'));
  assert.ok(reqs.some(r => r.path === 'git/refs/heads/claude/some-branch' && r.method === 'PATCH'));
});

test('no branch given falls back to the instance ref, then to the repo default', async () => {
  const a = makeGH({ defaultBranch: 'trunk' });
  a.gh.ref = 'feature';
  await a.gh.commitFiles(FILES);
  assert.ok(a.reqs.some(r => r.path === 'git/ref/heads/feature'));
  assert.ok(!a.reqs.some(r => r.path === ''), 'the instance ref answers without asking the API');

  const b = makeGH({ defaultBranch: 'trunk' });
  await b.gh.commitFiles(FILES);
  assert.ok(b.reqs.some(r => r.path === 'git/ref/heads/trunk'));
});

test('an empty fileset is refused rather than committed as nothing', async () => {
  const { gh, reqs } = makeGH();
  await assert.rejects(() => gh.commitFiles([], { branch: 'main' }), /at least one file/);
  assert.equal(reqs.length, 0);
});

test('copyTo still makes one commit per file, which is the other route', async () => {
  const { gh, reqs } = makeGH({ contents: { 'a.txt': { content: 'YQ==', sha: 's1', size: 1 },
                                            'b.txt': { content: 'Yg==', sha: 's2', size: 1 } } });
  const res = await gh.copyTo({ repo: 'me/other', dir: 'pkg' }, ['a.txt', 'b.txt']);
  assert.deepEqual(res.map(r => [r.path, r.to, r.status]),
    [['a.txt', 'pkg/a.txt', 'ok'], ['b.txt', 'pkg/b.txt', 'ok']]);
  assert.equal(reqs.filter(r => r.method === 'PUT').length, 2, 'two PUTs, so two commits');
});

test('copyTo reports a file it could not read and keeps going', async () => {
  const { gh } = makeGH({ contents: { 'b.txt': { content: 'Yg==', sha: 's2', size: 1 } } });
  const res = await gh.copyTo({ repo: 'me/other' }, ['gone.txt', 'b.txt']);
  assert.equal(res[0].status, 'error');
  assert.equal(res[1].status, 'ok', 'one failure does not abort the batch');
});

// ── getRaw over the Contents API's cap ──────────────────────────────────────
// A file past ~1 MB comes back from the Contents API as metadata with an EMPTY
// content string, which is the one answer that must never be passed on: an
// empty string is valid base64 for zero bytes, so a write takes it and lands an
// empty file while reporting success. The write side of this file has always
// used the Git Data API, whose blob ceiling is about 100 MB, so the cap was an
// asymmetry rather than a limit of the transfer.

test('getRaw reads a file over the Contents cap through its blob instead of failing', async () => {
  const { gh, reqs } = makeGH({
    contents: { 'big.bin': { content: '', sha: 'bigsha', size: 3_000_000 } },
    blobs: { bigsha: { content: 'QUJD\nREVG\n', encoding: 'base64', size: 3_000_000 } },
  });
  const out = await gh.getRaw('big.bin');
  assert.equal(out.content, 'QUJDREVG', 'the blob API wraps its base64; the whitespace comes out');
  assert.equal(out.sha, 'bigsha');
  assert.equal(out.size, 3_000_000);
  assert.deepEqual(seq(reqs), ['GET contents/big.bin', 'GET git/blobs/bigsha'],
    'one extra request, and only on a file that would otherwise have failed');
});

test('a file under the cap still costs one request', async () => {
  const { gh, reqs } = makeGH({ contents: { 'a.txt': { content: 'YQ==', sha: 's1', size: 1 } } });
  assert.equal((await gh.getRaw('a.txt')).content, 'YQ==');
  assert.deepEqual(seq(reqs), ['GET contents/a.txt'], 'the fallback never fires on the common path');
});

test('an empty file is empty, not truncated: no blob read, no error', async () => {
  const { gh, reqs } = makeGH({ contents: { 'empty.txt': { content: '', sha: 's0', size: 0 } } });
  assert.equal((await gh.getRaw('empty.txt')).content, '');
  assert.deepEqual(seq(reqs), ['GET contents/empty.txt'], 'size 0 is the answer, not a withheld one');
});

test('a blob the API will not hand over either is an error naming the size', async () => {
  const { gh } = makeGH({
    contents: { 'huge.bin': { content: '', sha: 'hugesha', size: 200_000_000 } },
    blobs: { hugesha: { content: '', encoding: 'none', size: 200_000_000 } },
  });
  await assert.rejects(() => gh.getRaw('huge.bin'), /too large to read through the API \(190\.7 MB\)/);
});

test('a truncated file with no sha to read it by says so rather than reading nothing', async () => {
  const { gh } = makeGH({ contents: { 'odd.bin': { content: '', size: 2_000_000 } } });
  await assert.rejects(() => gh.getRaw('odd.bin'), /no blob sha/i);
});

test('a blob that is not base64 is refused rather than written as if it were', async () => {
  const { gh } = makeGH({
    contents: { 'utf.bin': { content: '', sha: 'utfsha', size: 2_000_000 } },
    blobs: { utfsha: { content: 'plain text', encoding: 'utf-8', size: 2_000_000 } },
  });
  await assert.rejects(() => gh.getRaw('utf.bin'), /not base64/i);
});

test('createRef reports an existing branch rather than failing on it', async () => {
  const { GH } = makeGH();
  const gh = new GH({ repo: 'me/dest' });
  gh.req = async (p, opts = {}) => {
    if (p === '') return { default_branch: 'main' };
    if (p.startsWith('git/ref/heads/')) return { object: { sha: 'tip' } };
    throw Object.assign(new Error('exists'), { status: 422 });  // the POST to git/refs
  };
  assert.deepEqual(await gh.createRef('topic'), { branch: 'topic', sha: 'tip', created: false });
});

test('createPull opens a draft by default, on the repo default base', async () => {
  const { gh, reqs } = makeGH({ defaultBranch: 'trunk' });
  await gh.createPull({ title: 'T', head: 'topic' });
  const body = reqs.find(r => r.path === 'pulls').body;
  assert.deepEqual(body, { title: 'T', head: 'topic', base: 'trunk', body: '', draft: true });
});

test('commitFiles refuses the default branch when refuseDefaultBranch is set', async () => {
  const { gh } = makeGH({ defaultBranch: 'main' });
  await assert.rejects(
    () => gh.commitFiles(FILES, { branch: 'main', refuseDefaultBranch: true }),
    /Refusing to commit directly to the default branch/
  );
});

test('commitFiles verifies resulting tree equals expectedTree before ref update', async () => {
  const { gh, reqs } = makeGH();
  // expectedTree mismatch
  await assert.rejects(
    () => gh.commitFiles(FILES, { branch: 'topic', expectedTree: 'wrong-tree-sha' }),
    /Tree verification failed/
  );
  assert.equal(reqs.filter(r => r.method === 'PATCH').length, 0, 'ref must not be touched if tree verification fails');

  // expectedTree match
  const ok = await gh.commitFiles(FILES, { branch: 'topic', expectedTree: 'newtree0' });
  assert.equal(ok.tree, 'newtree0');
});

test('commitFiles refuses moved branch when requireBaseCommit is set', async () => {
  const { gh } = makeGH();
  await assert.rejects(
    () => gh.commitFiles(FILES, { branch: 'topic', requireBaseCommit: 'older-base-commit' }),
    /Branch topic has moved/
  );
});

test('commitFiles is idempotent when current head already has expectedTree', async () => {
  const { GH } = makeGH();
  const gh = new GH({ repo: 'me/dest' });
  let patchCalled = false;
  gh.req = async (p, opts = {}) => {
    if (p === '') return { default_branch: 'main' };
    if (p === 'git/ref/heads/topic') return { object: { sha: 'already-at-target' } };
    if (p === 'git/commits/already-at-target') return { tree: { sha: 'matching-tree' } };
    if (opts.method === 'PATCH') patchCalled = true;
    throw new Error('Unexpected call: ' + p);
  };
  const res = await gh.commitFiles([{ path: 'a.txt', sha: 'blob1' }], {
    branch: 'topic',
    requireBaseCommit: 'already-at-target',
    expectedTree: 'matching-tree',
  });
  assert.equal(res.alreadyApplied, true);
  assert.equal(patchCalled, false);
});

