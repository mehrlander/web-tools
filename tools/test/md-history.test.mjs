// lib/kits/md-history.js — the join between a document's blocks and the
// collection's revisions, the composition that hands md-diff the predecessors,
// and the chain drawn under each container. The index is hand-built in the
// shape text-collection.js produces; render runs under jsdom against the real
// marked and jsdiff, as md-diff's own test does.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot, makeWindow, deckGeometry } from './bootstrap.mjs';
import { marked } from 'marked';
import * as Diff from 'diff';

const { window } = makeWindow();
deckGeometry(window);
window.marked = marked;
window.Diff = Diff;
global.DOMParser = window.DOMParser;
for (const kit of ['guide-render.js', 'swipe-deck.js', 'md-diff.js', 'text-collection.js', 'md-history.js']) {
  new Function('window', 'document', readFileSync(path.join(repoRoot, 'lib/kits', kit), 'utf8'))(window, window.document);
}
const K = window.mdHistory;

const NOW = 'Carry-forward level is the base a request is measured against, not the base an agency spends from.';
const BEFORE = 'Carry-forward level is the base a request is measured against.';
const FIRST = 'CFL is the base.';
const PROPOSED_THEN = 'Carry-forward level is the base against which a request is measured.';
const DOC = `# Reading fund 600\n\n${NOW}\n\nAn untouched paragraph.\n\n  ${NOW}\n`;
const COMMIT_A = 'a'.repeat(40);
const COMMIT_B = 'b'.repeat(40);

function index() {
  return {
    passages: { now: NOW, before: BEFORE, first: FIRST, then: PROPOSED_THEN, x: 'Elsewhere.', y: 'Elsewhere, revised.' },
    proposals: [
      { id: 'p-then', from: 'before', to: 'then', author: 'doc-audit', purpose: 'repair' },
      { id: 'p-now', from: 'now', to: 'first', author: 'Chief of Staff (Grok)', purpose: 'half-length' },
    ],
    revisions: [
      { from: 'first', to: 'before', repo: 'mehrlander/home', path: 'docs/fund.md', commit: COMMIT_A },
      { from: 'before', to: 'now', repo: 'mehrlander/home', path: 'docs/fund.md', commit: COMMIT_B },
      { from: 'x', to: 'y', repo: 'mehrlander/home', path: 'docs/other.md', commit: COMMIT_B },
    ],
  };
}

test('plan finds the blocks some revision led into, in document order, with their chains', () => {
  const p = K.plan(DOC, index());
  assert.equal(p.count, 2, 'the same text twice is two blocks, each with the history');
  assert.deepEqual(p.blocks[0].chain.map(s => s.text), [NOW, BEFORE, FIRST]);
  assert.equal(p.blocks[0].chain[1].revision.commit, COMMIT_B);
  assert.deepEqual(p.blocks[0].chain[1].proposals.map(v => v.id), ['p-then'], 'the proposal made against the earlier text rides with it');
  assert.equal(K.plan(`# Plain\n\n${BEFORE}\n`, index()).count, 1, 'an older text that a revision led into has its own shorter chain');
  assert.equal(K.plan('# Plain\n\nNothing revised here.\n', index()).count, 0);
});

test('compose puts each predecessor in place and leaves everything else byte-identical', () => {
  const p = K.plan(DOC, index());
  const out = K.compose(DOC, p);
  assert.equal(out, `# Reading fund 600\n\n${BEFORE}\n\nAn untouched paragraph.\n\n  ${BEFORE}\n`);
});

test('render draws one container per revised block, with the chain and its proposals underneath', async () => {
  const host = window.document.createElement('div');
  window.document.body.append(host);
  const h = await K.render(host, DOC, index());
  assert.equal(h.count, 2);
  assert.equal(h.plan.count, 2);
  const boxes = [...host.querySelectorAll('.md-diff-change')];
  assert.equal(boxes.length, 2);
  const chains = boxes.map(b => b.querySelector('.md-history-chain'));
  assert.ok(chains.every(Boolean), 'every container carries its chain');
  assert.match(chains[0].textContent, /became this in/);
  assert.match(chains[0].textContent, /and before that, in/);
  assert.match(chains[0].textContent, /doc-audit/);
  assert.match(chains[0].textContent, /repair/);
  const links = [...chains[0].querySelectorAll('a')].map(a => a.getAttribute('href'));
  assert.ok(links.includes(`https://github.com/mehrlander/home/commit/${COMMIT_B}`), 'the commit is the evidence, linked');
  assert.ok(links.includes(`${K.LAB}?proposal=p-then`), 'a proposal along the chain links to Text Lab');
  assert.deepEqual([...host.querySelectorAll('button')].filter(b => /^apply\b/i.test(b.textContent.trim())), [],
    'history inspection never applies anything');
  host.remove();
});

test('a document with no revised block renders as prose with no containers', async () => {
  const host = window.document.createElement('div');
  window.document.body.append(host);
  const h = await K.render(host, '# Plain\n\nNothing revised here.\n', index());
  assert.equal(h.count, 0);
  assert.equal(host.querySelectorAll('.md-diff-change').length, 0);
  assert.match(host.textContent, /Nothing revised here/);
  host.remove();
});
