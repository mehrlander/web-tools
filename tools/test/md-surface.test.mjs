// The rendered editing face: a tap on the rendered document has to land at the
// offset in the markdown that holds the word under the finger.
//
// Layout is out of reach here (jsdom has no caretRangeFromPoint and no boxes),
// so what is held is the half that decides WHERE an offset lives: the render,
// the map Standoff.mapText stamps over it, and pointAt, which every caret, pin
// and selection box in kits/md-surface.js is drawn from. The repo's own
// markdown is the corpus, since it is what file mode is for.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import jsdomPkg from 'jsdom';
import { marked } from 'marked';
import { repoRoot } from './bootstrap.mjs';

const { JSDOM } = jsdomPkg;
const dom = new JSDOM('<!doctype html><body><div id="box"><div id="host"></div></div></body>');
const window = dom.window;
window.mdDoc = { html: (t) => marked.parse(t) };
// No layout in jsdom: ranges measure nothing, which leaves the overlay empty and
// the map, the part under test, untouched.
window.Range.prototype.getClientRects = () => [];
window.Range.prototype.getBoundingClientRect = () => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 });
for (const kit of ['standoff.js', 'md-surface.js']) {
  new Function('window', 'document', readFileSync(path.join(repoRoot, 'lib/kits', kit), 'utf8'))(window, window.document);
}
const host = window.document.getElementById('host');
const render = (text) => { host.__mdText = null; window.MdSurface.paint(host, { text, overlay: window.document.getElementById('box') }); };

// archive/ is left out for time: its dumps are the slowest files to render in
// jsdom and the least likely to be opened in file mode.
const SKIP = new Set(['node_modules', '.git', 'dist', '.preview', 'archive']);
function mdFiles(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) mdFiles(p, acc);
    else if (name.endsWith('.md')) acc.push(p);
  }
  return acc;
}
const DOCS = mdFiles(repoRoot);
// A run may differ from its source only where a whitespace run was swapped one
// for one: a line break inside a code span renders as a space, and a break in a
// block quote carries its `>` marker.
const same = (a, b) => a.replace(/\s/g, ' ') === b.replace(/\s/g, ' ')
  || a.replace(/\n[\s>]*/g, (m) => ' '.repeat(m.length)) === b.replace(/\s/g, ' ');

// The share of a rendered document a tap can reach is checked in the same pass.
// The floor is per file and low, since a file of raw HTML or entities has text
// nothing can find; the median is what says the map works, and a cascade (one
// match landing a copy too far, stranding everything after it) pulls a file
// toward zero.
test('every stamped run is its source text, and nearly all text is stamped', () => {
  assert.ok(DOCS.length > 100, `expected the repo's markdown, found ${DOCS.length}`);
  const shares = [];
  for (const f of DOCS) {
    const text = readFileSync(f, 'utf8');
    render(text);
    const stamped = [...host.querySelectorAll('[data-src]')];
    for (const sp of stamped) {
      const s = +sp.dataset.src, t = sp.firstChild.data;
      assert.ok(same(text.slice(s, s + t.length), t), `${path.relative(repoRoot, f)} at ${s}: ${JSON.stringify(t.slice(0, 40))}`);
    }
    const all = host.textContent.replace(/\s/g, '').length;
    if (all < 200) continue;
    const mapped = stamped.map((sp) => sp.textContent).join('').replace(/\s/g, '').length;
    shares.push(mapped / all);
    assert.ok(mapped / all >= 0.75, `${path.relative(repoRoot, f)}: ${mapped} of ${all} visible characters are tappable`);
  }
  shares.sort((a, b) => a - b);
  assert.ok(shares[shares.length >> 1] >= 0.99, `median share ${shares[shares.length >> 1]}`);
});

test('an offset resolves to the run holding it, and one in markup to the run before', () => {
  const text = 'Some **bold words** and `code` here.\n\n- item one\n- item two';
  render(text);
  const at = (i) => { const p = window.MdSurface._pointAt(host, i); return p.node.data.slice(p.offset, p.offset + 4); };
  assert.equal(at(text.indexOf('bold')), 'bold');
  assert.equal(at(text.indexOf('code')), 'code');
  assert.equal(at(text.indexOf('item two')), 'item');
  // Inside the `**` that closes the bold: the caret belongs to the words it ends.
  const p = window.MdSurface._pointAt(host, text.indexOf('** and') + 1);
  assert.equal(p.node.data, 'bold words');
  assert.equal(p.offset, p.node.length);
});

test('the document re-renders only when the text changes', () => {
  render('# One\n\ntwo');
  const first = host.firstElementChild;
  window.MdSurface.paint(host, { text: '# One\n\ntwo', overlay: window.document.getElementById('box') });
  assert.equal(host.firstElementChild, first, 'a repaint for a scroll or a tap must not rebuild the document');
  window.MdSurface.paint(host, { text: '# One\n\nthree', overlay: window.document.getElementById('box') });
  assert.notEqual(host.firstElementChild, first);
});

// The typing rules, as pure functions over the markdown and a caret.
const M = () => window.MdSurface;
test('a wrapper goes when its last character does, and not before', () => {
  assert.equal(M().tidy('a **b** c', 5), null, 'one character left: the markers stay');
  assert.deepEqual(M().tidy('a **** c', 4), { text: 'a  c', caret: 2 });
  assert.deepEqual(M().tidy('a `` c', 3), { text: 'a  c', caret: 2 });
  assert.deepEqual(M().tidy('see [](https://x.test) now', 5), { text: 'see  now', caret: 4 });
});

test('backspace at a line start drops its marker, or joins the block before', () => {
  assert.deepEqual(M().backspace('## Head', 3), { text: 'Head', caret: 0 });
  assert.deepEqual(M().backspace('- item', 2), { text: 'item', caret: 0 });
  assert.deepEqual(M().backspace('one\n\ntwo', 5), { text: 'one two', caret: 4 },
    'two paragraphs join with a space, not glued into one word');
  assert.deepEqual(M().backspace('one \n\ntwo', 6), { text: 'one two', caret: 4 },
    'and a space already there is not doubled');
  assert.equal(M().backspace('## Head', 5), null, 'mid-line is an ordinary backspace');
});

test('Enter continues a list, ends it on an empty item, and otherwise makes a paragraph', () => {
  assert.deepEqual(M().enter('- one', 5), { text: '- one\n- ', caret: 8 });
  assert.deepEqual(M().enter('9. x', 4), { text: '9. x\n10. ', caret: 9 });
  const end = M().enter('- one\n- ', 8);
  assert.equal(end.text, '- one\n\n');
  assert.equal(end.text.slice(0, end.caret), '- one\n\n', 'a blank line stands between the list and what comes next');
  assert.deepEqual(M().enter('para', 2), { text: 'pa\n\nra', caret: 4 });
});

// What the change marks draw. jsdiff is the same library md-diff loads from the
// CDN; the vendored copy stands in for it here.
test('changes are inserted runs and removal points, with a replacement paired', async () => {
  window.Diff = (await import('diff')).default ?? (await import('diff'));
  const base = 'the only output channel, shipped beside it and here';
  const text = 'the single output channel, here';
  const { ins, del } = M().changes(base, text);
  assert.deepEqual(ins.map(([a, b]) => text.slice(a, b)), ['single']);
  const swap = del.find((d) => d.text === 'only');
  assert.ok(swap && text.slice(swap.with[0], swap.with[1]) === 'single', 'the removal knows what replaced it');
  const gone = del.find((d) => d.text.includes('shipped'));
  assert.ok(gone && !gone.with, 'a pure removal replaces nothing');
  assert.equal(text.slice(gone.at - 2, gone.at + 4), ', here');
  assert.deepEqual(M().changes(text, text), { ins: [], del: [] });
});

// Rejecting one change: mdDiff.revert over the entries align() returns, which
// carry where each change sits. The patch is held to git itself.
test('reverting one change restores exactly that block, blank lines included', async () => {
  window.Diff = (await import('diff')).default ?? (await import('diff'));
  new Function('window', 'document', readFileSync(path.join(repoRoot, 'lib/kits/md-diff.js'), 'utf8'))(window, window.document);
  const D = window.mdDiff;
  const base = '# Title\n\nFirst para.\n\nSecond para.\n\n- a\n- b\n';
  const text = '# Title\n\nFirst para, edited.\n\nA new one.\n\n- a\n- b\n';
  const cs = D.changes(base, text);
  assert.deepEqual(cs.map((c) => c.kind).sort(), ['added', 'changed', 'removed']);
  const by = (k) => cs.find((c) => c.kind === k);
  assert.equal(D.revert(base, text, by('changed')), '# Title\n\nFirst para.\n\nA new one.\n\n- a\n- b\n');
  assert.equal(D.revert(base, text, by('added')), '# Title\n\nFirst para, edited.\n\n- a\n- b\n');
  assert.equal(D.revert(base, text, by('removed')), '# Title\n\nFirst para, edited.\n\nA new one.\n\nSecond para.\n\n- a\n- b\n');
  let t = text;
  for (let c = D.changes(base, t)[0]; c; c = D.changes(base, t)[0]) t = D.revert(base, t, c);
  assert.equal(t, base, 'reverting every change, one at a time, gives back the base exactly');
  assert.equal(D.revert(base, text, D.changes(base, text)), base, 'and all of them at once, as a card does');
});

test('the patch applies with git and reproduces the edit byte for byte', async () => {
  const { mkdtempSync, writeFileSync, readFileSync: rd, mkdirSync } = await import('node:fs');
  const { execFileSync } = await import('node:child_process');
  const os = await import('node:os');
  const dir = mkdtempSync(path.join(os.tmpdir(), 'md-patch-'));
  const base = readFileSync(path.join(repoRoot, 'docs/SURFACING.md'), 'utf8');
  const text = base.replace('only output channel', 'single output channel') + '\nA closing line.\n';
  mkdirSync(path.join(dir, 'docs'));
  writeFileSync(path.join(dir, 'docs/SURFACING.md'), base);
  execFileSync('git', ['init', '-q'], { cwd: dir });
  writeFileSync(path.join(dir, 'edit.patch'), M().patch('docs/SURFACING.md', base, text));
  execFileSync('git', ['apply', 'edit.patch'], { cwd: dir });
  assert.equal(rd(path.join(dir, 'docs/SURFACING.md'), 'utf8'), text);
  assert.equal(M().patch('x.md', base, base), '', 'no edit, no patch');
});

// Tracked: the edit drawn as cards in the document, one card per run of
// changed blocks, marked as a whole. Removed words are shown and never mapped,
// so every stamped run is still the buffer's text.
test('tracked render draws each changed paragraph as its own card and maps only the buffer', async () => {
  window.Diff = (await import('diff')).default ?? (await import('diff'));
  window.GuideRender = { render: (md) => ({ html: marked.parse(md) }) };
  new Function('window', 'document', readFileSync(path.join(repoRoot, 'lib/kits/md-diff.js'), 'utf8'))(window, window.document);
  const base = '# Title\n\nThe canonical source is here.\n\nGone para.\n\nSame para.\n';
  const text = '# Title\n\nThe official source is here.\n\nSame para.\n\nAdded para.\n';
  host.__mdKey = null; host.__readings = {};
  window.MdSurface.paint(host, { text, base, track: true, overlay: window.document.getElementById('box') });
  const cards = [...host.querySelectorAll('[data-md-card]')];
  assert.equal(cards.length, 3, 'a changed, a removed and an added paragraph that share no words are three cards');
  assert.deepEqual(window.MdSurface.cards(host).map((r) => r.map((e) => e.kind).join()), ['changed', 'removed', 'added']);
  assert.deepEqual([...host.querySelectorAll('del')].map((d) => d.textContent.trim()), ['canonical']);
  assert.equal(cards[1].querySelector('[data-md-reading="inline"] [data-md-ghost]').textContent.trim(), 'Gone para.',
    'a block taken out is struck whole in a card of its own, where it stood');
  assert.ok(![...host.querySelectorAll('del [data-src], [data-md-ghost] [data-src], [data-md-ui] [data-src]')].length,
    'removed words, removed blocks and card controls carry no offset');
  for (const sp of host.querySelectorAll('[data-src]')) {
    const s = +sp.dataset.src, t = sp.firstChild.data;
    assert.equal(text.slice(s, s + t.length), t, `run at ${s}`);
  }
  assert.deepEqual([...host.querySelectorAll('[data-md-card="0"] [data-md-card-read]')].map((b) => b.textContent),
    ['old', 'inline', 'new'], 'a run with both sides carries all three stops');
  assert.deepEqual(window.MdSurface.cardModes(host, 2), ['inline'], 'a run that only adds has one reading, and no pill');
  assert.ok(!host.querySelector('[data-md-card="2"] [data-md-card-read]'));
  window.MdSurface.setReading(host, 0, 'new');
  window.MdSurface.paint(host, { text, base, track: true, overlay: window.document.getElementById('box') });
  assert.ok(!host.querySelector('[data-md-card="0"] [data-md-reading="new"] del'), 'new is the text clean');
  assert.ok(host.querySelector('[data-md-card="0"] [data-md-track] > [data-md-reading="inline"][data-md-off]'),
    'the other readings stay in the card, side by side on its track, so it keeps the tallest one\'s height');
  assert.equal(host.querySelectorAll('[data-md-card="0"] [data-md-reading]:not([data-md-off]) [data-src]').length,
    host.querySelectorAll('[data-md-card="0"] [data-src]').length, 'only the reading on screen is mapped');
  assert.ok(host.querySelector('[data-md-card="0"] [data-src]'), 'and it takes the caret');
  const typedNew = text.replace('Added para.', 'Added para!');
  window.MdSurface.paint(host, { text: typedNew, base, track: true, overlay: window.document.getElementById('box') });
  assert.equal(window.MdSurface.readingOf(host, 0), 'new', 'an edit keeps a card on new, since typing there is reading it');
  window.MdSurface.setReading(host, 0, 'inline');
  window.MdSurface.paint(host, { text, base, track: true, overlay: window.document.getElementById('box') });
  window.MdSurface.setReading(host, 0, 'old');
  window.MdSurface.paint(host, { text, base, track: true, overlay: window.document.getElementById('box') });
  assert.equal(window.MdSurface.readingOf(host, 0), 'old');
  const ghost = host.querySelector('[data-md-card="0"] [data-md-ghost]').textContent;
  assert.ok(ghost.includes('canonical') && !ghost.includes('Gone para'), 'old shows the card\'s own paragraph from the base, unmapped');
  assert.ok(!host.querySelector('[data-md-card="0"] [data-src]'), 'the original takes no caret');
  const typed = text.replace('Same para.', 'Same para!');
  window.MdSurface.paint(host, { text: typed, base, track: true, overlay: window.document.getElementById('box') });
  assert.equal(window.MdSurface.readingOf(host, 0), 'inline', 'an edit returns a card on the original to the marked text');
  assert.equal(window.mdDiff.revert(base, text, window.MdSurface.cards(host)[0]),
    '# Title\n\nThe canonical source is here.\n\nSame para.\n\nAdded para.\n', 'a card goes back to the original as a whole');
  host.__mdKey = null;
  window.MdSurface.paint(host, { text, base: text, track: true, overlay: window.document.getElementById('box') });
  assert.equal(host.querySelectorAll('[data-md-card]').length, 0, 'no change, no cards');
});

// The native selection option reads the platform's Selection through this:
// its ends are DOM points, which have to land on the same offsets a tap does.
test('a DOM point maps to its source offset and back', () => {
  const host = window.document.getElementById('host');
  const text = '# T\n\nOne **two** three.\n\nFour.\n';
  host.__mdKey = null;
  window.MdSurface.paint(host, { text, overlay: window.document.getElementById('box') });
  for (const at of [text.indexOf('One'), text.indexOf('two') + 1, text.indexOf('three'), text.indexOf('Four.') + 5]) {
    const p = window.MdSurface.domPoint(host, at);
    assert.ok(p, `a point for ${at}`);
    assert.equal(window.MdSurface.offsetOf(host, p.node, p.offset), at, `round trip at ${at}`);
  }
  const para = host.querySelectorAll('p')[0];
  assert.equal(window.MdSurface.offsetOf(host, para, para.childNodes.length), text.indexOf(' three.') + 7,
    'past an element\'s last child is the end of its last run');
  assert.equal(window.MdSurface.offsetOf(host, window.document.body, 0), null, 'outside the host is nothing');
  // Found by review, 2026-09-27: a Selection's ends are often (element, k),
  // the point BEFORE child k. An end there must not take child k with it,
  // and a start there must not reach back into the block before.
  const four = host.querySelectorAll('p')[1];
  assert.equal(window.MdSurface.offsetOf(host, four, 0, 'end'), text.indexOf(' three.') + 7,
    'a selection ending at the head of the next paragraph ends where the last one did');
  assert.equal(window.MdSurface.offsetOf(host, para, 0, 'start'), text.indexOf('One'),
    'a selection starting at a paragraph\'s head starts at its first word');
  const strong = para.querySelector('strong');
  assert.equal(window.MdSurface.offsetOf(host, para, [...para.childNodes].indexOf(strong), 'start'), text.indexOf('two'),
    'a start before the bold starts at its word, not at the text before it');
  assert.equal(window.MdSurface.offsetOf(host, para, [...para.childNodes].indexOf(strong) + 1, 'end'), text.indexOf('two') + 3,
    'an end after the bold ends at its word');
  // A page-set range starting between blocks (the H key's `## ` sits there)
  // lands on the next word, not on the end of the block before.
  const at = text.indexOf('\n\nFour') + 1;
  const p = window.MdSurface.domPoint(host, at, 'start');
  assert.equal(window.MdSurface.offsetOf(host, p.node, p.offset, 'start'), text.indexOf('Four'), 'start between blocks goes forward');
  const q = window.MdSurface.domPoint(host, at, 'end');
  assert.equal(window.MdSurface.offsetOf(host, q.node, q.offset, 'end'), text.indexOf(' three.') + 7, 'an end there goes back');
});

// A one-word heading retyped shares no word with its old self; it is still
// one block edited, and pairs as one, with the typo struck inside it.
test('a retyped heading pairs with its old self, and a typo pairs by letters', () => {
  const one = window.mdDiff.align('# Surfacing\n\nBody.\n', '# Suacing\n\nBody.\n').filter((e) => e.kind !== 'same');
  assert.deepEqual(one.map((e) => e.kind), ['changed']);
  const two = window.mdDiff.align('# Surfacing\n\nA paragraph of prose.\n', '# Suacing\n\nSomething else entirely new.\n')
    .filter((e) => e.kind !== 'same');
  assert.ok(two.some((e) => e.kind === 'changed' && e.old === '# Surfacing'), 'same kind, close letters: paired');
  const cross = window.mdDiff.align('# Setup\n', '```\nsetap\n```\n').filter((e) => e.kind !== 'same');
  assert.deepEqual(cross.map((e) => e.kind).sort(), ['added', 'removed'], 'a heading never pairs with a fence');
});

// A word diff cannot see a paragraph break: two paragraphs joined have the
// same words as before. The card marks the break itself, struck where one was
// closed and green where one was opened, and neither mark takes the caret.
test('a paragraph break is traced by a seam in the reading that runs the paragraphs together', async () => {
  window.Diff = (await import('diff')).default ?? (await import('diff'));
  window.GuideRender = { render: (md) => ({ html: marked.parse(md) }) };
  new Function('window', 'document', readFileSync(path.join(repoRoot, 'lib/kits/md-diff.js'), 'utf8'))(window, window.document);
  const host = window.document.getElementById('host');
  const box = window.document.getElementById('box');
  const base = '# T\n\nOne ends here.\n\nTwo starts here.\n\nTail.\n';
  const joined = '# T\n\nOne ends here. Two starts here.\n\nTail.\n';
  host.__mdKey = null; host.__readings = {};
  window.MdSurface.paint(host, { text: joined, base, track: true, overlay: box });
  const closed = host.querySelector('[data-md-reading="inline"] [data-md-break="closed"]');
  assert.ok(closed, 'the join is marked');
  assert.equal(closed.closest('[data-md-seam]').textContent, 'Two', 'the seam rises at the first word after the old break');
  assert.ok(!closed.textContent && closed.hasAttribute('data-md-ui'), 'the mark holds no text, and is a control the caret skips');
  assert.ok(!host.querySelector('[data-md-reading="inline"] del'), 'no ¶ is struck, the seam says it');
  assert.equal(host.querySelectorAll('[data-md-reading="new"] [data-md-seam]').length, 1, 'new is traced too');
  assert.ok(!host.querySelector('[data-md-reading="old"] [data-md-seam], [data-md-gap]'), 'the original shows its break and marks nothing');
  const split = '# T\n\nOne ends\n\nhere.\n\nTwo starts here.\n\nTail.\n';
  host.__mdKey = null; host.__readings = {};
  window.MdSurface.paint(host, { text: split, base, track: true, overlay: box });
  const opened = host.querySelector('[data-md-reading="old"] [data-md-break="opened"]');
  assert.ok(opened, 'the split is marked');
  assert.equal(opened.closest('[data-md-seam]').textContent, 'here.', 'in the original, where it will divide');
  assert.ok(!host.querySelector('[data-md-reading="inline"] [data-md-seam], [data-md-reading="new"] [data-md-seam], [data-md-gap]'),
    'the readings that show the break mark nothing');
  assert.ok(!host.querySelector('[data-md-reading="inline"] .md-diff-ins'), 'no green ¶, and nothing else added');
  for (const sp of host.querySelectorAll('[data-src]')) {
    const s = +sp.dataset.src, t = sp.firstChild.data;
    assert.equal(split.slice(s, s + t.length), t, `run at ${s} is still the buffer's text`);
  }
});

// Found by review, 2026-09-27: a join is usually followed by lower-casing the
// word after it, and the join's mark has to survive that; and a break opened
// out of a list item is marked in the original at the word that left it.
test('a closed break is still marked when the word after it changed too', async () => {
  window.Diff = (await import('diff')).default ?? (await import('diff'));
  window.GuideRender = { render: (md) => ({ html: marked.parse(md) }) };
  new Function('window', 'document', readFileSync(path.join(repoRoot, 'lib/kits/md-diff.js'), 'utf8'))(window, window.document);
  const host = window.document.getElementById('host'), box = window.document.getElementById('box');
  const base = 'One two.\n\nThree four.\n';
  for (const text of ['One two. three four.\n', 'One two. four.\n']) {
    host.__mdKey = null; host.__readings = {};
    window.MdSurface.paint(host, { text, base, track: true, overlay: box });
    assert.equal(host.querySelectorAll('[data-md-break="closed"]').length, 1, JSON.stringify(text));
  }
  host.__mdKey = null; host.__readings = {};
  window.MdSurface.paint(host, { text: '- Para one\n\ntwo.\n\nTail.\n', base: 'Para one two.\n\nTail.\n', track: true, overlay: box });
  const opened = host.querySelector('[data-md-reading="old"] [data-md-break="opened"]');
  assert.ok(opened, 'the split is marked');
  assert.equal(opened.closest('[data-md-seam]').textContent, 'two.', 'at the word that left the item');
});
