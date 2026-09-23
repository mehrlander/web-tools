// lib/kits/md-history.js — the walk back through a file's commits, the block
// pairing that names each paragraph's predecessor, the composition that hands
// md-diff the predecessors, and the chain drawn under each container. The git
// source is a fixture of three versions; render runs under jsdom against the
// real marked and jsdiff, as md-diff's own test does.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { repoRoot, makeWindow } from './bootstrap.mjs';
import { marked } from 'marked';
import * as Diff from 'diff';

const { window } = makeWindow();
window.marked = marked;
window.Diff = Diff;
global.DOMParser = window.DOMParser;
for (const kit of ['guide-render.js', 'swipe-deck.js', 'md-diff.js', 'text-collection.js', 'md-history.js']) {
  new Function('window', 'document', readFileSync(path.join(repoRoot, 'lib/kits', kit), 'utf8'))(window, window.document);
}
const K = window.mdHistory;
const sha = value => createHash('sha256').update(value, 'utf8').digest('hex');

const NOW = 'Carry-forward level is the base a request is measured against, not the base an agency spends from.';
const BEFORE = 'Carry-forward level is the base a request is measured against.';
const FIRST = 'CFL is the base.';
const PROPOSED_THEN = 'Carry-forward level is the base against which a request is measured.';
const UNTOUCHED = 'An untouched paragraph.';
const LATER = 'Added in the newest commit.';
const DOC = `# Reading fund 600\n\n${NOW}\n\n${UNTOUCHED}\n\n${LATER}\n`;

// Three commits touched docs/fund.md, newest first. C1 turned BEFORE into NOW
// and added LATER; C2 turned FIRST into BEFORE; C3 wrote the file.
const C1 = { sha: 'a'.repeat(40), date: '2026-09-20', message: 'fund: measured against, not spent from', url: 'https://github.com/mehrlander/home/commit/' + 'a'.repeat(40) };
const C2 = { sha: 'b'.repeat(40), date: '2026-09-10', message: 'fund: say carry-forward level', url: 'https://github.com/mehrlander/home/commit/' + 'b'.repeat(40) };
const C3 = { sha: 'c'.repeat(40), date: '2026-09-01', message: 'fund: first cut', url: 'https://github.com/mehrlander/home/commit/' + 'c'.repeat(40) };
const VERSIONS = {
  [C1.sha]: DOC,
  [C2.sha]: `# Reading fund 600\n\n${BEFORE}\n\n${UNTOUCHED}\n`,
  [C3.sha]: `# Reading fund 600\n\n${FIRST}\n\n${UNTOUCHED}\n`,
};
function source() {
  const calls = { commits: [], reads: [] };
  return {
    calls,
    async commits(p, ref, n) { calls.commits.push({ p, ref, n }); return [C1, C2, C3].slice(0, n); },
    async read(p, at) { calls.reads.push(at); return VERSIONS[at]; },
  };
}
function index() {
  const ID = { before: sha(BEFORE), then: sha(PROPOSED_THEN), now: sha(NOW), first: sha(FIRST) };
  return {
    passages: { [ID.before]: BEFORE, [ID.then]: PROPOSED_THEN, [ID.now]: NOW, [ID.first]: FIRST },
    proposals: [
      { id: 'p-then', from: ID.before, to: ID.then, author: 'doc-audit', purpose: 'repair' },
      { id: 'p-now', from: ID.now, to: ID.first, author: 'Chief of Staff (Grok)', purpose: 'half-length' },
    ],
  };
}
const opts = (extra = {}) => ({ source: source(), path: 'docs/fund.md', ref: 'main', ...extra });

test('walk traces each block back through the pairing, one read per commit, and stops when every block is placed', async () => {
  const o = opts();
  const w = await K.walk(DOC, o);
  assert.deepEqual(o.source.calls.commits, [{ p: 'docs/fund.md', ref: 'main', n: K.LIMIT }]);
  assert.deepEqual(o.source.calls.reads, [C2.sha, C3.sha], 'the open document stands for the newest commit; older versions are read');
  assert.equal(w.exhausted, true);
  assert.equal(w.truncated, false);
  const [title, now, untouched, later] = w.chains;
  assert.deepEqual(now.steps.map(s => s.text), [NOW, BEFORE, FIRST]);
  assert.equal(now.steps[1].revision.sha, C1.sha, 'each step carries the commit that produced the step above it');
  assert.equal(now.steps[2].revision.sha, C2.sha);
  assert.equal(now.origin.sha, C3.sha, 'and the oldest text is traced to the commit that first wrote it');
  assert.equal(untouched.steps.length, 1);
  assert.equal(untouched.origin.sha, C3.sha, 'a block nothing changed is first written where the list ends');
  assert.equal(later.steps.length, 1);
  assert.equal(later.origin.sha, C1.sha, 'a block added in the newest commit was first written there');
  assert.equal(title.origin.sha, C3.sha);
});

test('the limit bounds the reads, and what it cuts stays open rather than guessed', async () => {
  const o = opts({ limit: 2 });
  const w = await K.walk(DOC, o);
  assert.deepEqual(o.source.calls.reads, [C2.sha], 'two commits listed means one older version read');
  assert.equal(w.exhausted, false);
  assert.equal(w.truncated, true);
  const now = w.chains[1];
  assert.deepEqual(now.steps.map(s => s.text), [NOW, BEFORE]);
  assert.equal(now.origin, null, 'the oldest listed commit is not claimed as the origin when the list was cut');
  assert.equal(now.done, false);
  assert.equal(w.chains[3].done, true, 'a block born inside the window is still placed');
});

test('plan keeps the blocks with a predecessor, in document order; compose puts each one in place', async () => {
  const w = await K.walk(DOC, opts());
  const p = K.plan(DOC, w);
  assert.equal(p.count, 1);
  assert.deepEqual(p.blocks[0].chain.map(s => s.text), [NOW, BEFORE, FIRST]);
  assert.equal(K.compose(DOC, p), `# Reading fund 600\n\n${BEFORE}\n\n${UNTOUCHED}\n\n${LATER}\n`);
});

test('render draws one container per changed block, with the chain, its proposals, and the origin underneath', async () => {
  const host = window.document.createElement('div');
  window.document.body.append(host);
  const h = await K.render(host, DOC, opts({ index: index() }));
  assert.equal(h.count, 1);
  assert.equal(h.plan.count, 1);
  const boxes = [...host.querySelectorAll('.md-diff-change')];
  assert.equal(boxes.length, 1);
  const chain = boxes[0].querySelector('.md-history-chain');
  assert.ok(chain, 'the container carries its chain');
  assert.match(chain.textContent, /became this in/);
  assert.match(chain.textContent, /and before that, in/);
  assert.match(chain.textContent, /first written in/);
  assert.match(chain.textContent, /2026-09-20/);
  assert.match(chain.textContent, /doc-audit/, 'the proposal made against the earlier text rides with it');
  assert.match(chain.textContent, /repair/);
  assert.doesNotMatch(chain.textContent, /half-length/, 'a proposal against the current text is the Proposals reading\'s business');
  const links = [...chain.querySelectorAll('a')].map(a => a.getAttribute('href'));
  assert.ok(links.includes(C1.url), 'the commit is the evidence, linked');
  assert.ok(links.includes(C3.url), 'so is the origin');
  assert.ok(links.includes(`${K.LAB}?proposal=p-then`), 'a proposal along the chain links to Text Lab');
  const bound = host.querySelector('.md-history-bound');
  assert.match(bound.textContent, /Read 3 commits back, to where every block was first written/);
  assert.equal(bound.querySelector('button'), null, 'nothing more to read');
  assert.deepEqual([...host.querySelectorAll('button')].filter(b => /^apply\b/i.test(b.textContent.trim())), [],
    'history inspection never applies anything');
  host.remove();
});

test('a cut walk says how far it read and offers the next twenty', async () => {
  const host = window.document.createElement('div');
  window.document.body.append(host);
  let asked = null;
  const h = await K.render(host, DOC, opts({ index: false, limit: 2, onMore: n => { asked = n; } }));
  assert.equal(h.count, 1);
  assert.equal(h.walked.truncated, true);
  const bound = host.querySelector('.md-history-bound');
  assert.match(bound.textContent, /Read 2 commits back; 3 blocks older than that/);
  const more = bound.querySelector('button');
  assert.match(more.textContent, new RegExp(`Read ${K.LIMIT} more`));
  more.click();
  assert.equal(asked, 2 + K.LIMIT, 'more means the same walk with a wider window');
  assert.match(host.querySelector('.md-history-chain').textContent, /older than the commits read/);
  host.remove();
});

test('a document no commit changed renders as prose with no containers', async () => {
  const host = window.document.createElement('div');
  window.document.body.append(host);
  const src = { async commits() { return [C3]; }, async read() { throw new Error('nothing older to read'); } };
  const h = await K.render(host, VERSIONS[C3.sha], { source: src, path: 'docs/fund.md', index: false });
  assert.equal(h.count, 0);
  assert.equal(h.walked.exhausted, true);
  assert.equal(host.querySelectorAll('.md-diff-change').length, 0);
  assert.match(host.textContent, /CFL is the base/);
  assert.match(host.querySelector('.md-history-bound').textContent, /Read 1 commit back/);
  host.remove();
});

test('gitSource asks GitHub for the path\'s commits on the ref and the file at a commit, through the client', async () => {
  const calls = [];
  const gh = { async req(p) {
    calls.push(p);
    if (p.includes('/commits?')) return [{ sha: C1.sha, commit: { committer: { date: '2026-09-20T10:00:00Z' }, message: 'subject\n\nbody' }, html_url: C1.url }];
    return { content: Buffer.from('# Été\n', 'utf8').toString('base64'), sha: 'blob' };
  } };
  const s = K.gitSource(gh, 'mehrlander/home');
  const commits = await s.commits('docs/fund.md', 'main', 5);
  assert.deepEqual(commits, [{ sha: C1.sha, date: '2026-09-20', message: 'subject', url: C1.url }]);
  assert.equal(await s.read('docs/fund.md', C1.sha), '# Été\n', 'bytes decode as UTF-8');
  assert.deepEqual(calls, [
    `/repos/mehrlander/home/commits?path=docs%2Ffund.md&sha=main&per_page=5`,
    `/repos/mehrlander/home/contents/docs/fund.md?ref=${C1.sha}`,
  ]);
});
