// lib/kits/md-variants.js: the join between a document's blocks and the
// retained variants, the composition that hands md-diff a second text, the
// provenance line under each container, and the marker on a variant proposed
// for the open file.
//
// The index is hand-built in the shape text-collection.js produces, since what
// is under test is how this kit reads that shape, not how the collection is
// read (node/test/text-collection.test.mjs holds that). Render runs under
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
for (const kit of ['guide-render.js', 'swipe-deck.js', 'md-diff.js', 'text-collection.js', 'md-variants.js']) {
  new Function('window', 'document', readFileSync(path.join(repoRoot, 'lib/kits', kit), 'utf8'))(window, window.document);
}
const K = window.mdVariants;

const P1 = 'The lanes answer to different authorities, and a schedule that adds them\nhas produced a figure nobody recognises.';
const P1_CLARITY = 'The two lanes answer to different authorities. A schedule that adds them produces a figure nobody recognises.';
const P1_HALF = 'The lanes answer to different authorities; adding them misleads.';
const P3 = 'Carry-forward level is the base a request is measured against.';
const P3_NEW = 'Carry-forward level is the base a request is measured against, not the base an agency spends from.';
const DOC = `# Reading fund 600\n\n${P1}\n\nAn untouched paragraph between the two.\n\n${P3}\n\n\`\`\`sh\npython3 tools/allotment.py --fund 600\n\`\`\`\n`;

const FILE = { repo: 'mehrlander/home', path: 'skills/drs-funds/fund-600.md' };
const BASIS = 'https://github.com/mehrlander/home/pull/9';

function index() {
  return {
    variants: [
      { id: 'p-clarity', from: 't1', to: 't1c', author: 'Ollama mistral:7b', purpose: 'clarity' },
      { id: 'p-half', from: 't1', to: 't1h', author: 'Chief of Staff (Grok)', purpose: 'half-length' },
      { id: 'p-audit', from: 't3', to: 't3n', author: 'doc-audit', purpose: 'qualify' },
      { id: 'p-elsewhere', from: 'tx', to: 'txn', author: 'x', purpose: 'y' },
    ],
    passages: { t1: P1, t1c: P1_CLARITY, t1h: P1_HALF, t3: P3, t3n: P3_NEW, tx: 'Not in this document.', txn: 'Still not.' },
    proposals: [
      { from: 't1', to: 't1h', ...FILE, basis: BASIS },
      { from: 't3', to: 't3n', repo: 'mehrlander/home', path: 'somewhere/else.md', basis: BASIS },
    ],
  };
}

test('plan finds the blocks with variants, in document order, and skips the rest', () => {
  const p = K.plan(DOC, index());
  assert.equal(p.count, 2);
  assert.equal(p.variants, 3, 'two on the first block and one on the third');
  assert.deepEqual(p.blocks.map((b) => b.variants.map((v) => v.id)), [['p-clarity', 'p-half'], ['p-audit']]);
  assert.deepEqual(p.blocks.map((b) => b.pick), [0, 0]);
  assert.ok(p.blocks[0].block.start < p.blocks[1].block.start);
});

test('the join is on flattened text, so a rewrap still matches and a different paragraph never does', () => {
  const rewrapped = DOC.replace(P1, P1.replace('\n', ' '));
  assert.equal(K.plan(rewrapped, index()).count, 2);
  const edited = DOC.replace(P1, P1.replace('nobody', 'no one'));
  assert.equal(K.plan(edited, index()).count, 1, 'an edited paragraph has lost its variants');
});

test('picks choose which alternative is substituted and are clamped', () => {
  const p = K.plan(DOC, index(), { picks: { 0: 1 } });
  assert.equal(p.blocks[0].pick, 1);
  assert.equal(K.plan(DOC, index(), { picks: { 0: 7 } }).blocks[0].pick, 1, 'clamped to the last alternative');
  assert.equal(K.plan(DOC, index(), { picks: { 0: -2 } }).blocks[0].pick, 0);
});

test('compose substitutes the picked variant per block and leaves everything else byte-identical', () => {
  const p = K.plan(DOC, index());
  const out = K.compose(DOC, p);
  assert.equal(out, DOC.replace(P1, P1_CLARITY).replace(P3, P3_NEW));
  const half = K.compose(DOC, K.plan(DOC, index(), { picks: { 0: 1 } }));
  assert.ok(half.includes(P1_HALF) && !half.includes(P1_CLARITY));
  assert.equal(K.compose(DOC, K.plan('# Nothing here\n\nNo variants.\n', index())), DOC, 'no blocks means no change');
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
  const who = boxes.map((b) => b.querySelector('.md-variants-who'));
  assert.ok(who.every(Boolean), 'every container carries a provenance line');
  assert.match(who[0].textContent, /Ollama mistral:7b/);
  assert.match(who[0].textContent, /clarity/);
  assert.match(who[0].textContent, /\d+% of the words/, 'the length against the original is computed from the two texts');
  assert.match(who[1].textContent, /doc-audit/);
  assert.match(who[1].textContent, /qualify/);
  const lab = who[1].querySelector('a');
  assert.equal(lab.getAttribute('href'), `${K.LAB}?variant=p-audit`);
  assert.equal(who[0].querySelectorAll('[data-md-variants-pick]').length, 2, 'the block with two variants offers both');
  assert.equal(who[1].querySelectorAll('[data-md-variants-pick]').length, 0, 'a block with one offers no picker');
  host.remove();
});

test('picking an alternative re-renders with that substitution', async () => {
  const host = window.document.createElement('div');
  window.document.body.append(host);
  const picked = [];
  await K.render(host, DOC, index(), { onPick: (i, k) => picked.push([i, k]) });
  const before = host.textContent;
  assert.ok(before.includes('The two lanes answer'), 'opens on the first alternative');
  host.querySelector('[data-md-variants-pick="1"]').click();
  await new Promise((r) => setTimeout(r, 50));
  assert.deepEqual(picked, [[0, 1]]);
  assert.ok(host.textContent.includes('adding them misleads'), 'the half-length text is on screen');
  assert.ok(!host.textContent.includes('The two lanes answer'));
  const alts = [...host.querySelectorAll('[data-md-variants-pick]')];
  assert.ok(alts[1].className.includes('font-medium') && !alts[0].className.includes('font-medium'), 'the lit stop moved');
  host.remove();
});

test('a document with no variants renders as prose with no containers', async () => {
  const host = window.document.createElement('div');
  window.document.body.append(host);
  const h = await K.render(host, '# Plain\n\nNothing retained here.\n', index());
  assert.equal(h.count, 0);
  assert.equal(host.querySelectorAll('.md-diff-change').length, 0);
  assert.match(host.textContent, /Nothing retained here/);
  host.remove();
});

test('a variant proposed for the open file is the default pick and carries a marker linking its basis', async () => {
  const p = K.plan(DOC, index(), { file: FILE });
  assert.deepEqual(p.blocks.map((b) => b.pick), [1, 0], 'the proposed half-length variant leads its block');
  assert.equal(K.plan(DOC, index(), { file: FILE, picks: { 0: 0 } }).blocks[0].pick, 0, 'an explicit pick still wins');
  const host = window.document.createElement('div');
  window.document.body.append(host);
  await K.render(host, DOC, index(), { file: FILE });
  const who = [...host.querySelectorAll('.md-variants-who')];
  const marks = who.map((w) => w.querySelector('[data-md-variants-proposal]'));
  assert.ok(marks[0], 'the proposal for this repo and path is marked');
  assert.equal(marks[0].getAttribute('href'), BASIS);
  assert.equal(marks[1], null, 'a proposal for another path is not marked here');
  host.remove();
});

test('without a file, no variant is marked and the first stays the default', async () => {
  assert.deepEqual(K.plan(DOC, index()).blocks.map((b) => b.pick), [0, 0]);
  const host = window.document.createElement('div');
  window.document.body.append(host);
  await K.render(host, DOC, index());
  assert.equal(host.querySelectorAll('[data-md-variants-proposal]').length, 0);
  host.remove();
});

// What plan leaves out: every pair proposed for a file that no block stages,
// with the reason, so a queue counted by plan can say what it does not stage.
// One document, one proposal per reason, and one that stages.
test('unstaged names each proposed pair plan does not stage, and why', () => {
  const A = 'Alpha stands alone.', B = 'Beta opens a run.', C = 'Gamma closes it.';
  const L = 'A long paragraph whose middle sentence is proposed. It goes on after.';
  const doc = `# Doc\n\n${A}\n\n${B}\n\n${C}\n\n${L}\n\nApplied text now.\n`;
  const file = { repo: 'mehrlander/web-tools', path: 'docs/x.md' };
  const ix = {
    passages: { a: A, a2: 'Alpha, alone.', a3: 'Alpha, solo.', bc: `${B}\n\n${C}`, bc2: 'Beta and gamma.',
                m: 'whose middle sentence is proposed.', m2: 'with a middle.', o: 'Old text.', o2: 'Applied text now.',
                g: 'Edited away since.', g2: 'Never landed.', u: 'Unpaired.', u2: 'Unpaired two.' },
    variants: [
      { id: 'v1', from: 'a', to: 'a2', author: 'x', purpose: 'update' },
      { id: 'v2', from: 'a', to: 'a3', author: 'y', purpose: 'tighten' },
      { id: 'v3', from: 'bc', to: 'bc2', author: 'x', purpose: 'tighten' },
      { id: 'v4', from: 'm', to: 'm2', author: 'x', purpose: 'update' },
      { id: 'v5', from: 'o', to: 'o2', author: 'x', purpose: 'update' },
      { id: 'v6', from: 'g', to: 'g2', author: 'x', purpose: 'clarity' },
    ],
    proposals: [
      { from: 'a', to: 'a2', ...file, basis: 'b1' },   // staged: the block's pick
      { from: 'a', to: 'a3', ...file, basis: 'b2' },   // the same block, picked second
      { from: 'a', to: 'a3', ...file, basis: 'b2bis' },// the same pair again: one entry
      { from: 'bc', to: 'bc2', ...file, basis: 'b3' },
      { from: 'm', to: 'm2', ...file, basis: 'b4' },
      { from: 'o', to: 'o2', ...file, basis: 'b5' },
      { from: 'g', to: 'g2', ...file, basis: 'b6' },
      { from: 'g', to: 'g2', repo: 'mehrlander/web-tools', path: 'docs/other.md', basis: 'b7' },
    ],
  };
  const by = (xs) => Object.fromEntries(xs.map((u) => [u.from + '>' + u.to, [u.reason, u.kind]]));
  assert.deepEqual(by(K.unstaged(doc, ix, { file })), {
    'a>a3': ['behind', 'tighten'], 'bc>bc2': ['spans', 'tighten'], 'm>m2': ['inside', 'edit'],
    'o>o2': ['applied', 'edit'], 'g>g2': ['gone', 'tighten'],
  }, 'the staged pair is not named, a repeated pair is named once, and another file\'s proposal not at all');
  assert.deepEqual(Object.values(by(K.unstaged(null, ix, { file }))).map((x) => x[0]),
    ['file', 'file', 'file', 'file', 'file', 'file'], 'a file that cannot be read stages nothing, the would-be pick included');
  const planned = K.plan(doc, ix, { file });
  assert.deepEqual(K.unstaged(doc, ix, { file, planned }).map((u) => u.reason), K.unstaged(doc, ix, { file }).map((u) => u.reason),
    'a plan the caller already has gives the same answer');
  assert.deepEqual(K.unstaged(doc, { ...ix, variants: ix.variants.filter((v) => v.id !== 'v2') }, { file })
    .find((u) => u.to === 'a3').reason, 'unpaired', 'a block proposed with no variant holding the pair');
  assert.deepEqual(K.unstaged(doc, ix, { file: { repo: 'mehrlander/web-tools', path: 'docs/none.md' } }), [], 'no proposals, nothing to say');
});
