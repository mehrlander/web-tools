// lib/kits/md-proposals.js — the join between a document's blocks and the
// retained proposals, the composition that hands md-diff a second text, and
// the provenance line under each container.
//
// The index is hand-built in the shape text-proposals.js produces, since what
// is under test is how this kit reads that shape, not how the collection is
// read (tools/test/text-proposals.test.mjs holds that). Render runs under
// jsdom against the real marked and jsdiff, as md-diff's own test does: the
// container count and the provenance join are DOM facts.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot, makeWindow } from './bootstrap.mjs';
import { marked } from 'marked';
import * as Diff from 'diff';

const { window } = makeWindow();
window.marked = marked;
window.Diff = Diff;
global.DOMParser = window.DOMParser;
for (const kit of ['guide-render.js', 'swipe-deck.js', 'md-diff.js', 'text-proposals.js', 'md-proposals.js']) {
  new Function('window', 'document', readFileSync(path.join(repoRoot, 'lib/kits', kit), 'utf8'))(window, window.document);
}
const K = window.mdProposals;

const P1 = 'The lanes answer to different authorities, and a schedule that adds them\nhas produced a figure nobody recognises.';
const P1_CLARITY = 'The two lanes answer to different authorities. A schedule that adds them produces a figure nobody recognises.';
const P1_HALF = 'The lanes answer to different authorities; adding them misleads.';
const P3 = 'Carry-forward level is the base a request is measured against.';
const P3_NEW = 'Carry-forward level is the base a request is measured against, not the base an agency spends from.';
const DOC = `# Reading fund 600\n\n${P1}\n\nAn untouched paragraph between the two.\n\n${P3}\n\n\`\`\`sh\npython3 tools/allotment.py --fund 600\n\`\`\`\n`;

function index() {
  return {
    proposals: [
      { id: 'p-clarity', from: 't1', to: 't1c', author: 'Ollama mistral:7b', purpose: 'clarity' },
      { id: 'p-half', from: 't1', to: 't1h', author: 'Chief of Staff (Grok)', purpose: 'half-length' },
      { id: 'p-audit', from: 't3', to: 't3n', author: 'doc-audit', purpose: 'qualify' },
      { id: 'p-elsewhere', from: 'tx', to: 'txn', author: 'x', purpose: 'y' },
    ],
    texts: { t1: P1, t1c: P1_CLARITY, t1h: P1_HALF, t3: P3, t3n: P3_NEW, tx: 'Not in this document.', txn: 'Still not.' },
  };
}

test('plan finds the blocks with proposals, in document order, and skips the rest', () => {
  const p = K.plan(DOC, index());
  assert.equal(p.count, 2);
  assert.equal(p.proposals, 3, 'two on the first block and one on the third');
  assert.deepEqual(p.blocks.map((b) => b.proposals.map((v) => v.id)), [['p-clarity', 'p-half'], ['p-audit']]);
  assert.deepEqual(p.blocks.map((b) => b.pick), [0, 0]);
  assert.ok(p.blocks[0].block.start < p.blocks[1].block.start);
});

test('the join is on flattened text, so a rewrap still matches and a different paragraph never does', () => {
  const rewrapped = DOC.replace(P1, P1.replace('\n', ' '));
  assert.equal(K.plan(rewrapped, index()).count, 2);
  const edited = DOC.replace(P1, P1.replace('nobody', 'no one'));
  assert.equal(K.plan(edited, index()).count, 1, 'an edited paragraph has lost its proposals');
});

test('picks choose which alternative is substituted and are clamped', () => {
  const p = K.plan(DOC, index(), { picks: { 0: 1 } });
  assert.equal(p.blocks[0].pick, 1);
  assert.equal(K.plan(DOC, index(), { picks: { 0: 7 } }).blocks[0].pick, 1, 'clamped to the last alternative');
  assert.equal(K.plan(DOC, index(), { picks: { 0: -2 } }).blocks[0].pick, 0);
});

test('compose substitutes the picked proposal per block and leaves everything else byte-identical', () => {
  const p = K.plan(DOC, index());
  const out = K.compose(DOC, p);
  assert.equal(out, DOC.replace(P1, P1_CLARITY).replace(P3, P3_NEW));
  const half = K.compose(DOC, K.plan(DOC, index(), { picks: { 0: 1 } }));
  assert.ok(half.includes(P1_HALF) && !half.includes(P1_CLARITY));
  assert.equal(K.compose(DOC, K.plan('# Nothing here\n\nNo proposals.\n', index())), DOC, 'no blocks means no change');
});

test('compose keeps a block\'s indentation and its trailing newline', () => {
  const listed = `- item\n\n  ${P3}\n\nafter\n`;
  const out = K.compose(listed, K.plan(listed, index()));
  assert.equal(out, `- item\n\n  ${P3_NEW}\n\nafter\n`);
});

test('render draws one md-diff container per planned block, each with the right provenance', async () => {
  const host = window.document.createElement('div');
  window.document.body.append(host);
  const h = await K.render(host, DOC, index());
  assert.equal(h.count, 2);
  assert.equal(h.plan.count, 2);
  const boxes = [...host.querySelectorAll('.md-diff-change')];
  assert.equal(boxes.length, 2);
  const who = boxes.map((b) => b.querySelector('.md-proposals-who'));
  assert.ok(who.every(Boolean), 'every container carries a provenance line');
  assert.match(who[0].textContent, /Ollama mistral:7b/);
  assert.match(who[0].textContent, /clarity/);
  assert.match(who[0].textContent, /\d+% of the words/, 'the length against the original is computed from the two texts');
  assert.match(who[1].textContent, /doc-audit/);
  assert.match(who[1].textContent, /qualify/);
  const lab = who[1].querySelector('a');
  assert.equal(lab.getAttribute('href'), `${K.LAB}?proposal=p-audit`);
  assert.equal(who[0].querySelectorAll('[data-md-proposals-pick]').length, 2, 'the block with two proposals offers both');
  assert.equal(who[1].querySelectorAll('[data-md-proposals-pick]').length, 0, 'a block with one offers no picker');
  host.remove();
});

test('picking an alternative re-renders with that substitution', async () => {
  const host = window.document.createElement('div');
  window.document.body.append(host);
  const picked = [];
  await K.render(host, DOC, index(), { onPick: (i, k) => picked.push([i, k]) });
  const before = host.textContent;
  assert.ok(before.includes('The two lanes answer'), 'opens on the first alternative');
  host.querySelector('[data-md-proposals-pick="1"]').click();
  await new Promise((r) => setTimeout(r, 50));
  assert.deepEqual(picked, [[0, 1]]);
  assert.ok(host.textContent.includes('adding them misleads'), 'the half-length text is on screen');
  assert.ok(!host.textContent.includes('The two lanes answer'));
  const alts = [...host.querySelectorAll('[data-md-proposals-pick]')];
  assert.ok(alts[1].className.includes('font-medium') && !alts[0].className.includes('font-medium'), 'the lit stop moved');
  host.remove();
});

test('a document with no proposals renders as prose with no containers', async () => {
  const host = window.document.createElement('div');
  window.document.body.append(host);
  const h = await K.render(host, '# Plain\n\nNothing retained here.\n', index());
  assert.equal(h.count, 0);
  assert.equal(host.querySelectorAll('.md-diff-change').length, 0);
  assert.match(host.textContent, /Nothing retained here/);
  host.remove();
});
