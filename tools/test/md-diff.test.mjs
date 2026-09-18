// lib/kits/md-diff.js — the pure half of the rendered-difference kit:
// segmentation, block alignment, word runs, and the standoff marking that lays
// those runs over rendered HTML.
//
// Marking is the part worth a test rather than a look. It resolves every offset
// against the text nodes BEFORE mutating any of them and applies the edits back
// to front, which is exactly the kind of bookkeeping that works on the example
// in front of you and fails on the second change in the same paragraph. So the
// assertions below are mostly about a change that is not the first one, a
// change that crosses an element boundary, and a deletion that has no place in
// the new text to sit in.
//
// Run against the REAL marked and the REAL jsdiff, since what is being pinned
// is the join between their two answers: jsdiff measures the rendered text and
// the walker has to land on the same characters. A stub renderer would agree
// with itself and prove nothing.
//
// What is not here is layout. The swipe track, the container chrome and the
// jump strip are browser measurements; tools/render/scenarios cover those.

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
// swipe-deck too, because the render-level cases below build a real container
// and a container is a deck. The kit is framework-free and does not mind jsdom;
// what it cannot do there is lay anything out, which is why the assertions ask
// which readings a block offers rather than where they sit.
for (const kit of ['guide-render.js', 'swipe-deck.js', 'md-diff.js']) {
  new Function('window', 'document', readFileSync(path.join(repoRoot, 'lib/kits', kit), 'utf8'))(window, window.document);
}
const mdDiff = window.mdDiff;

// Render the way the kit's inline view does, so the text the diff measures and
// the text the walker walks come from one tree.
const renderBox = (md) => {
  const box = window.document.createElement('div');
  box.innerHTML = window.GuideRender.render(md, {}).html;
  return box;
};
// Both sides RENDERED, which is the kit's contract: the diff is over what a
// reader sees. Handing it raw markdown on one side and rendered text on the
// other measures the markup too, and the first thing it finds is the newline
// marked puts after every block.
const markPair = (oldMd, newMd) => {
  const box = renderBox(newMd);
  mdDiff.mark(box, mdDiff.runs(renderBox(oldMd).textContent, box.textContent));
  return box;
};

// ── Segmentation ────────────────────────────────────────────────────────────

test('blocks split on blank lines and keep a fence whole', () => {
  const md = [
    'First paragraph.',
    '',
    '```js',
    'const a = 1;',
    '',
    'const b = 2;',
    '```',
    '',
    'Last paragraph.',
  ].join('\n');
  const out = mdDiff.blocks(md).map((b) => b.text);
  assert.equal(out.length, 3);
  assert.equal(out[0], 'First paragraph.');
  assert.match(out[1], /^```js\nconst a = 1;\n\nconst b = 2;\n```$/);
  assert.equal(out[2], 'Last paragraph.');
});

test('blocks ignore leading and trailing blank lines', () => {
  assert.deepEqual(mdDiff.blocks('\n\n  \nOne.\n\n\n').map((b) => b.text), ['One.']);
  assert.deepEqual(mdDiff.blocks(''), []);
});

// ── Alignment ───────────────────────────────────────────────────────────────

const DOC = ['# Title', '', 'Alpha stands first.', '', 'Beta follows.', '', 'Gamma last.'].join('\n');

test('an unchanged document has no changes', () => {
  const seq = mdDiff.align(DOC, DOC);
  assert.equal(seq.length, 4);
  assert.ok(seq.every((s) => s.kind === 'same'));
  assert.equal(mdDiff.changes(DOC, DOC).length, 0);
});

test('a rewrap that changes no words is not a change', () => {
  const rewrapped = DOC.replace('Alpha stands first.', 'Alpha stands\nfirst.');
  assert.equal(mdDiff.changes(DOC, rewrapped).length, 0);
});

test('a reworded block is one changed entry carrying both sides', () => {
  const after = DOC.replace('Beta follows.', 'Beta follows Alpha closely.');
  const chg = mdDiff.changes(DOC, after);
  assert.equal(chg.length, 1);
  assert.equal(chg[0].kind, 'changed');
  assert.equal(chg[0].old, 'Beta follows.');
  assert.equal(chg[0].new, 'Beta follows Alpha closely.');
});

test('an inserted block is an addition, a dropped one a removal', () => {
  const added = DOC.replace('Gamma last.', 'Delta arrives.\n\nGamma last.');
  const [a] = mdDiff.changes(DOC, added);
  assert.equal(a.kind, 'added');
  assert.equal(a.new, 'Delta arrives.');
  assert.equal(a.old, '');

  const [r] = mdDiff.changes(DOC, DOC.replace('Beta follows.\n\n', ''));
  assert.equal(r.kind, 'removed');
  assert.equal(r.old, 'Beta follows.');
});

test('the sequence is the new document in order, so unchanged blocks still render', () => {
  const after = DOC.replace('Beta follows.', 'Beta trails.');
  const seq = mdDiff.align(DOC, after);
  assert.deepEqual(seq.map((s) => s.kind), ['same', 'same', 'changed', 'same']);
  assert.deepEqual(seq.filter((s) => s.kind === 'same').map((s) => s.new),
    ['# Title', 'Alpha stands first.', 'Gamma last.']);
});

// ── Word runs ───────────────────────────────────────────────────────────────

test('a short equal run between two changes is absorbed', () => {
  // "one" sits between two edits and is four characters with its space, so the
  // three runs fuse rather than reading as two separate marks.
  const r = mdDiff.runs('alpha one beta', 'gamma one delta');
  const changed = r.filter((x) => x.type === 'change');
  assert.equal(changed.length, 1);
  assert.match(changed[0].o, /alpha.*one.*beta/s);
  assert.match(changed[0].n, /gamma.*one.*delta/s);
});

test('a long equal run between two changes is kept, so far-apart edits stay apart', () => {
  const r = mdDiff.runs('alpha the quick brown fox beta', 'gamma the quick brown fox delta');
  assert.equal(r.filter((x) => x.type === 'change').length, 2);
});

// ── Standoff marking ────────────────────────────────────────────────────────

test('an inserted word is wrapped where it reads, and the text is unchanged by marking', () => {
  const oldMd = 'The fund is reported as one number.';
  const newMd = 'The fund is reported as one large number.';
  const box = renderBox(newMd);
  const before = box.textContent;
  mdDiff.mark(box, mdDiff.runs(renderBox(oldMd).textContent, before));
  assert.equal(box.querySelectorAll('ins').length, 1);
  assert.match(box.querySelector('ins').textContent, /large/);
  assert.equal(box.textContent, before, 'an insertion-only change adds no text');
});

test('a deletion is placed in the new text, which is the one node this invents', () => {
  const oldMd = 'The fund is reported as one large number.';
  const newMd = 'The fund is reported as one number.';
  const box = markPair(oldMd, newMd);
  const del = box.querySelector('del');
  assert.ok(del, 'the removed run is shown');
  assert.match(del.textContent, /large/);
  assert.match(box.textContent, /one\s*large\s*number/);
});

test('the second change in a block lands on its own words, not on shifted ones', () => {
  // The bug this exists for: mark the first run, and every offset after it has
  // moved. Two insertions, far enough apart that the coalescing pass leaves
  // them separate.
  const oldMd = 'Alpha holds the line and omega closes the argument here.';
  const newMd = 'Alpha firmly holds the line and omega quietly closes the argument here.';
  const box = markPair(oldMd, newMd);
  const marks = [...box.querySelectorAll('ins')].map((n) => n.textContent.trim());
  assert.equal(marks.length, 2);
  assert.match(marks[0], /firmly/);
  assert.match(marks[1], /quietly/);
});

test('a change inside emphasis stays inside it, so the markup survives', () => {
  const oldMd = 'The **appropriated lane** carries recordkeeping.';
  const newMd = 'The **appropriated operating lane** carries recordkeeping.';
  const box = markPair(oldMd, newMd);
  const ins = box.querySelector('ins');
  assert.ok(ins, 'the added word is marked');
  assert.equal(ins.closest('strong')?.tagName, 'STRONG',
    'the mark sits inside the strong rather than around it');
  assert.equal(box.querySelectorAll('strong').length, 1);
});

test('a run crossing an element boundary is marked once per text node', () => {
  // The added run "street bears" starts inside the strong and ends outside it,
  // so it is two wraps rather than one range lifted out of the markup.
  const oldMd = 'The **appropriated lane** carries recordkeeping.';
  const newMd = 'The **appropriated street** bears recordkeeping.';
  const box = markPair(oldMd, newMd);
  assert.equal(box.querySelectorAll('strong').length, 1, 'the strong is still one element');
  const ins = [...box.querySelectorAll('ins')];
  assert.equal(ins.length, 2);
  assert.equal(ins[0].closest('strong')?.tagName, 'STRONG');
  assert.equal(ins[1].closest('strong'), null);
  assert.equal(ins.map((n) => n.textContent).join(''), 'street bears');
});

test('taking the removals back out returns the new document exactly', () => {
  // The invariant behind every case above, and the one that says the marking
  // is standoff rather than a rewrite: <ins> wraps text that is already there,
  // and <del> is the only node carrying text the document does not have. So
  // dropping the <del>s has to leave the render's own text untouched, whatever
  // the change did to the markup around it.
  const pairs = [
    ['One plain sentence.', 'One plainer sentence.'],
    ['The **appropriated lane** carries it.', 'The **appropriated street** bears it.'],
    ['- alpha\n- beta\n- gamma', '- alpha\n- beta changed\n- gamma'],
    ['| a | b |\n| --- | --- |\n| 1 | 2 |', '| a | b |\n| --- | --- |\n| 1 | 3 |'],
    ['Text with `code inline` in it.', 'Text with `code inlined` in it.'],
  ];
  for (const [oldMd, newMd] of pairs) {
    const want = renderBox(newMd).textContent;
    const box = markPair(oldMd, newMd);
    for (const d of box.querySelectorAll('del')) d.remove();
    assert.equal(box.textContent, want, newMd);
  }
});

// ── The side-by-side halves ─────────────────────────────────────────────────
// One run list, two coordinate systems. The old column indexes the OLD text
// and the new column the new, so a mode that reads the wrong one lands its
// marks on whatever happens to sit at those offsets, which is the failure a
// screenshot would show as "close enough".

test('the old column marks what left, in the old text', () => {
  const oldMd = 'The fund is reported as one large number.';
  const newMd = 'The fund is reported as one number.';
  const box = renderBox(oldMd);
  mdDiff.mark(box, mdDiff.runs(box.textContent, renderBox(newMd).textContent), 'old');
  const del = [...box.querySelectorAll('del')];
  assert.equal(del.length, 1);
  assert.equal(del[0].textContent.trim(), 'large');
  assert.equal(box.querySelectorAll('ins').length, 0, 'nothing arrived in the old text');
  assert.equal(box.textContent, renderBox(oldMd).textContent,
    'marking the old column adds no text to it');
});

test('the new column marks what arrived, and leaves the removals out', () => {
  // The difference from the inline reading: inline PUTS the removed words back
  // so the reader sees the swap in place, and the new column must not, because
  // the old column is already showing them.
  const oldMd = 'The fund is reported as one large number.';
  const newMd = 'The fund is reported as one small number.';
  const box = markPair(oldMd, newMd);
  assert.ok(box.querySelector('del'), 'the inline reading carries the removal');

  const side = renderBox(newMd);
  mdDiff.mark(side, mdDiff.runs(renderBox(oldMd).textContent, side.textContent), 'new');
  assert.equal(side.querySelectorAll('del').length, 0, 'the new column does not');
  assert.equal(side.querySelector('ins').textContent.trim(), 'small');
});

test('marking a block with no change leaves the tree alone', () => {
  const md = 'Nothing moved here at all.';
  const box = renderBox(md);
  const html = box.innerHTML;
  mdDiff.mark(box, mdDiff.runs(box.textContent, box.textContent));
  assert.equal(box.innerHTML, html);
});

test('a wholly new block has one reading, as a wholly removed one does', () => {
  // With no old text, `inline` and `new` are the same words twice: the marked
  // reading is the paragraph washed green and the other is the paragraph. A
  // reader met three such blocks and asked what the second stop was for, which
  // is the question a control earns when it changes nothing.
  const host = window.document.createElement('div');
  window.document.body.append(host);
  const stops = (kind) => [...host.querySelectorAll('.md-diff-change')]
    .map((b) => [...b.querySelectorAll('button')].map((x) => x.textContent.trim())
      .filter((t) => /^(old|inline|new|added|removed)$/.test(t)));

  return mdDiff.render(host,
    'Keep this paragraph.\n\nAnd keep this one too.\n',
    'Keep this paragraph.\n\nA paragraph that is wholly new.\n\nAnd keep this one too.\n',
  ).then(() => {
    assert.deepEqual(stops(), [['added']], 'an added block offers one reading, named');
    host.remove();
  });
});

test('a wholly removed block still has its one reading', () => {
  const host = window.document.createElement('div');
  window.document.body.append(host);
  return mdDiff.render(host,
    'Keep this paragraph.\n\nA paragraph that goes away.\n\nAnd keep this one too.\n',
    'Keep this paragraph.\n\nAnd keep this one too.\n',
  ).then(() => {
    const stops = [...host.querySelectorAll('.md-diff-change')]
      .map((b) => [...b.querySelectorAll('button')].map((x) => x.textContent.trim())
        .filter((t) => /^(old|inline|new|added|removed)$/.test(t)));
    assert.deepEqual(stops, [['removed']]);
    host.remove();
  });
});
