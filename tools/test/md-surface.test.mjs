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
  assert.deepEqual(M().backspace('one\n\ntwo', 5), { text: 'onetwo', caret: 3 });
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
