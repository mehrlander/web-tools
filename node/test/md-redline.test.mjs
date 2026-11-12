// lib/kits/md-diff.js: the redline, the whole document with its changes
// marked in place, which the viewer's Changes mode draws.
//
// What is held here is WHICH blocks are marked and HOW, since that is rules a
// reader cannot see being applied: a block mostly rewritten is drawn as two,
// what left stands before what arrived, a list is read by its items and a
// table by its rows, a stretch added or removed is one band, and an unchanged
// block is the host's direct child.
// Run against the real marked and the real jsdiff, as node/test/md-diff.test.mjs
// is and for its reason.
//
// Where a bar sits is layout, and node/render/scenarios/md-redline.mjs
// measures it in a browser.

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
for (const kit of ['guide-render.js', 'swipe-deck.js', 'md-diff.js']) {
  new Function('window', 'document', readFileSync(path.join(repoRoot, 'lib/kits', kit), 'utf8'))(window, window.document);
}
const mdDiff = window.mdDiff;

const draw = async (oldMd, newMd, opts = {}) => {
  const host = window.document.createElement('div');
  const handle = await mdDiff.redline(host, oldMd, newMd, { html: (md) => marked.parse(md), ...opts });
  return { host, handle };
};
// The marked elements in document order, as `kind: text`.
const read = (host) => [...host.querySelectorAll('[data-md-redline]')]
  .map((e) => e.dataset.mdRedline + ': ' + e.textContent.replace(/\s+/g, ' ').trim());

// ── blocks(…, { lists }) ───────────────────────────────────────────────────

test('lists: a loose list and an indented continuation stay one block', () => {
  const md = '- a\n\n- b\n\n  more of b\n\npara\n\n1. x\n2. y\n';
  assert.deepEqual(mdDiff.blocks(md, { lists: true }).map((b) => b.text),
                   ['- a\n\n- b\n\n  more of b', 'para', '1. x\n2. y']);
  // And every block is still its own stretch of the source.
  for (const b of mdDiff.blocks(md, { lists: true })) assert.equal(md.slice(b.start, b.end).trimEnd(), b.text);
});

test('lists: a list of another kind, after a blank line, is another block', () => {
  assert.deepEqual(mdDiff.blocks('- a\n- b\n\n1. x\n\n2. y\n', { lists: true }).map((b) => b.text),
                   ['- a\n- b', '1. x\n\n2. y']);
});

test('lists: without the option a loose list is still a block per item', () => {
  assert.equal(mdDiff.blocks('- a\n\n- b\n').length, 2);
});

// ── redline ────────────────────────────────────────────────────────────────

test('an unchanged document draws as the document, with nothing marked', async () => {
  const md = '# T\n\nOne.\n\n- a\n- b\n';
  const { host, handle } = await draw(md, md);
  assert.equal(handle.count, 0);
  assert.deepEqual([...host.children].map((e) => e.tagName), ['H1', 'P', 'UL']);
});

test('a small edit is word marks inside one changed block', async () => {
  const { host, handle } = await draw('A paragraph with one small word in it.\n', 'A paragraph with one tiny word in it.\n');
  assert.deepEqual(handle.counts, { changed: 1, added: 0, removed: 0 });
  const block = host.querySelector('[data-md-redline="changed"]');
  assert.equal(block.querySelector('del').textContent, 'small');
  assert.equal(block.querySelector('ins').textContent, 'tiny');
  assert.equal(block.dataset.mdRedlineMark, 'bar', 'an edited block carries a bar');
});

test('a block mostly rewritten is the old block, then the new one, unmarked', async () => {
  const was = 'The first survey covered the northern plots only, since the road south was closed.\n';
  const now = 'Both halves of the site were reached this time, and every plot was visited once.\n';
  const { host, handle } = await draw('Stays.\n\n' + was, 'Stays.\n\n' + now);
  assert.deepEqual(handle.counts, { changed: 0, added: 1, removed: 1 });
  assert.deepEqual(read(host), ['removed: ' + was.trim(), 'added: ' + now.trim()]);
  assert.equal(host.querySelectorAll('ins, del').length, 0, 'neither half carries word marks');
});

test('rewrite: the share that splits a block is the caller\'s to set', async () => {
  const pair = ['One two three four five six.\n', 'One two three four nine ten.\n'];
  assert.equal((await draw(...pair)).handle.counts.changed, 1);
  assert.deepEqual((await draw(...pair, { rewrite: 0.1 })).handle.counts, { changed: 0, added: 1, removed: 1 });
});

test('what left stands before what arrived', async () => {
  // Two blocks out and two in that share no words, so nothing pairs them:
  // align() alone orders these added, added, removed, removed.
  const { host } = await draw(
    'Keep.\n\n## Old heading\n\nAlpha beta gamma delta.\n\nEnd.\n',
    'Keep.\n\n## New title\n\nEpsilon zeta eta theta.\n\nEnd.\n');
  // And each stretch of one kind is one band and one change.
  assert.deepEqual(read(host), ['removed: Old heading Alpha beta gamma delta.', 'added: New title Epsilon zeta eta theta.']);
});

test('a stretch added or removed is one band, and its struck text keeps its colour', async () => {
  const { host, handle } = await draw('Keep.\n\n## Going\n\nThis leaves.\n\nEnd.\n', 'Keep.\n\nEnd.\n\n## Arriving\n\nThis is new.\n');
  assert.deepEqual(handle.counts, { changed: 0, added: 1, removed: 1 });
  const [gone, came] = handle.marks;
  for (const m of handle.marks) assert.equal(m.dataset.mdRedlineMark, 'band');
  assert.deepEqual([...gone.children].map((e) => e.tagName), ['H2', 'P'], 'both blocks sit in the one band');
  assert.deepEqual([...came.children].map((e) => e.tagName), ['H2', 'P']);
  // The band is a wash with a line above and below; the bar is its left edge.
  for (const m of handle.marks) {
    assert.match(m.className, /after:border-y/);
    assert.match(m.className, /after:border-l-\[6px\]/);
    assert.match(m.className, /after:bg-\[color-mix\([^\]]*_var\(--rl-wash,6%\),transparent\)\]/);
  }
  assert.match(gone.className, /line-through/);
  assert.doesNotMatch(gone.className, /opacity-|text-\[color/, 'struck, and at its own colour');
  assert.doesNotMatch(came.className, /line-through/);
});

test('a changed list marks its items, and stays one list', async () => {
  const { host, handle } = await draw(
    '- first stays\n- second gets edited slightly\n- third goes\n',
    '- first stays\n- second gets changed slightly\n- a fourth arrives here\n');
  assert.equal(host.querySelectorAll('ul').length, 1);
  assert.equal(host.firstElementChild.tagName, 'UL', 'the list is the host\'s own child, not wrapped');
  assert.deepEqual(read(host), [
    'changed: second gets editedchanged slightly', 'removed: third goes', 'added: a fourth arrives here']);
  assert.deepEqual(handle.counts, { changed: 1, added: 1, removed: 1 });
  assert.deepEqual([...host.querySelectorAll('li[data-md-redline]')].map((li) => li.dataset.mdRedlineMark), ['bar', 'band', 'band']);
  assert.equal(host.querySelector('li:not([data-md-redline])').textContent, 'first stays');
});

test('consecutive list items of one kind are one change, banded from the first', async () => {
  const { host, handle } = await draw('- stays\n', '- stays\n- new one\n- new two\n');
  assert.deepEqual(handle.counts, { changed: 0, added: 1, removed: 0 });
  const added = [...host.querySelectorAll('li[data-md-redline="added"]')];
  assert.equal(added.length, 2);
  assert.equal(added[0].dataset.mdRedlineMark, 'band');
  assert.ok(added[1].hasAttribute('data-md-redline-run'));
  assert.equal(added[1].dataset.mdRedlineMark, undefined, 'the second item rides the first one\'s band');
});

test('a removed numbered item keeps its number and the next takes the new one', async () => {
  const { host } = await draw('1. one\n2. two\n3. three\n', '1. one\n2. three\n');
  assert.deepEqual([...host.querySelectorAll('ol > li')].map((li) => li.getAttribute('value') + ' ' + (li.dataset.mdRedline || 'same')),
                   ['1 same', '2 removed', '2 same']);
});

test('a changed table is one marked block, read by its rows', async () => {
  const head = '| Plot | Samples |\n|---|---|\n';
  const { host, handle } = await draw(head + '| One | 2 |\n| Two | 1 |\n| Three | 0 |\n',
                                      head + '| One | 2 |\n| Two | 3 |\n| Four | 1 |\n');
  assert.deepEqual(handle.counts, { changed: 1, added: 0, removed: 0 });
  assert.deepEqual([...host.querySelectorAll('tr')].map((tr) => tr.dataset.mdRedlineRow || 'same'),
                   ['same', 'same', 'changed', 'removed', 'added']);
  assert.equal(host.querySelector('tr[data-md-redline-row="changed"] del').textContent, '1');
});

test('the same words in other markup is a change with no word to mark', async () => {
  const { host, handle } = await draw('See the guide for more.\n\n- plain item\n', 'See the **guide** for more.\n\n- [plain item](x.md)\n');
  assert.equal(handle.counts.changed, 2);
  assert.equal(host.querySelectorAll('ins, del').length, 0);
});

test('the current change has full-strength lines, a deeper left line and a stronger wash', async () => {
  const { host, handle } = await draw('One.\n\nTwo goes away.\n\nThree.\n', 'One edited.\n\nThree.\n');
  const [edited, gone] = handle.marks;
  const deep = (hue) => `color-mix(in_oklab,var(--color-${hue})_75%,var(--color-base-content))`;
  const full = (m) => m.classList.contains('[--rl-wash:10%]');
  for (const m of handle.marks) {
    assert.match(m.className, /_50%,transparent\)/, 'at rest, the half-strength mix');
    assert.equal(full(m), false, 'at rest, the wash keeps its 6% default');
  }
  handle.next();
  assert.ok(edited.classList.contains(`after:bg-[${deep('warning')}]`), 'a bar is the left line, so it deepens');
  assert.doesNotMatch(edited.className, /_50%,transparent\)/);
  assert.equal(full(edited), true);
  assert.match(gone.className, /_50%,transparent\)/, 'the others stay at rest');
  handle.next();
  assert.ok(gone.classList.contains('after:border-[color:var(--color-error)]'), 'a band\'s lines above and below are the plain hue');
  assert.ok(gone.classList.contains(`after:border-l-[color:${deep('error')}]`), 'and its left line is deeper');
  assert.equal(full(gone), true);
  assert.match(edited.className, /_50%,transparent\)/);
  assert.equal(full(edited), false);
  assert.doesNotMatch(edited.className, /base-content/);
  // The word marks are md-diff's own, at their own strength.
  assert.match(host.querySelector('ins').className, /bg-success\/20/);
});

test('set marks the current change without scrolling, and -1 clears it', async () => {
  const { handle } = await draw('One.\n\nTwo.\n\nThree.\n', 'One edited.\n\nTwo.\n\nThree edited.\n');
  let scrolled = 0;
  for (const m of handle.marks) m.scrollIntoView = () => { scrolled++; };
  handle.set(1);
  assert.equal(handle.at, 1);
  assert.ok(handle.marks[1].hasAttribute('data-md-redline-here'));
  assert.equal(scrolled, 0);
  handle.set(-1);
  assert.equal(handle.at, -1);
  assert.equal(handle.marks.filter((m) => m.hasAttribute('data-md-redline-here')).length, 0);
  handle.set(99);
  assert.equal(handle.at, -1, 'an index past the marks is none');
  handle.goto(0);
  assert.equal(scrolled, 1, 'goto scrolls');
});

test('a reference link resolves in every block, changed or not', async () => {
  const refs = '\n\n[guide]: https://example.com/guide\n';
  const { host } = await draw('Read the [guide] first.\n\nThen the old part.' + refs,
                              'Read the [guide] first.\n\nThen the new part, per the [guide].' + refs);
  assert.equal(host.querySelectorAll('a[href="https://example.com/guide"]').length, 2);
  assert.ok(!host.textContent.includes('[guide]'), 'no block shows the link as literal brackets');
});

test('the handle steps through the marks in document order, and wraps', async () => {
  const { handle } = await draw('One.\n\nTwo.\n\nThree.\n', 'One edited.\n\nTwo.\n\nThree edited.\n');
  assert.equal(handle.at, -1);
  handle.next();
  assert.equal(handle.at, 0);
  assert.ok(handle.marks[0].hasAttribute('data-md-redline-here'));
  handle.next();
  handle.next();
  assert.equal(handle.at, 0, 'past the last change is the first');
  assert.equal(handle.marks.filter((m) => m.hasAttribute('data-md-redline-here')).length, 1);
});

test('without opts.html the kit renders with guide-render', async () => {
  const host = window.document.createElement('div');
  const handle = await mdDiff.redline(host, 'A line.\n', 'A longer line.\n');
  assert.equal(handle.counts.changed, 1);
  assert.equal(host.querySelector('ins').textContent, 'longer');
});
