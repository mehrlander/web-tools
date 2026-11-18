// text-lab-exemplars.test.mjs: the Exemplars pane reads home's pieces as their
// README states the format (YAML front matter, then the text verbatim), finds a
// piece's focus and caption from its standoff, and shows the piece on two
// faces: Text, from the text proper on with the focus marked over the render,
// and Context, everything about the piece, the caption included.
//
// The standoff counts offsets in code points, as Python does, and the page
// slices in UTF-16, so the fixture carries an astral character ahead of its
// focus: without the conversion every span lands one place early. A standoff
// that no longer pins the piece's bytes must mark nothing rather than the
// wrong text, and a ref that predates `short` and `caption` must still read.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { marked } from 'marked';
import { repoRoot as root } from '../repo-root.mjs';

const SRC = readFileSync(path.join(root, 'pages/text-lab.html'), 'utf8');
const start = SRC.indexOf("document.addEventListener('alpine:init'");
const stop = SRC.indexOf("await gh.load('alpine-bundle.js')", start);
assert.ok(start >= 0 && stop > start, 'the Text Lab Alpine model is extractable');
const MODEL = SRC.slice(start, stop);

// One jsdom document for the render; the kits run against a plain window
// holding the real guide renderer, standoff kit, list kit and address grammar.
const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>');
globalThis.DOMParser = dom.window.DOMParser;   // guide-render's render() parses with the global
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
// A speech engine that records what it is given and never finishes, so a
// test reads the player's state where it stands.
const spoken = [];
globalThis.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
globalThis.speechSynthesis = { speak(u) { spoken.push(u.text); }, cancel() {}, getVoices: () => [] };
const kit = (win, name) => new Function('window', readFileSync(path.join(root, 'lib/kits', name), 'utf8'))(win);
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

// A piece as the exemplars README describes one, its values escaped the way
// the real front matter escapes them, opening on a caption as an opinion does.
const PIECE = [
  '---',
  'title: "A Fixture: Its Subtitle"',
  'short: "Fixture"',
  'author: "Ann Writer, Clerk"',
  'year: "1999"',
  'genre: "opinion"',
  'publisher: "The Press"',
  'source_page: "https://press.example/fixture (image: https://press.example/img/page.png)"',
  'acquired: "2026-11-17"',
  'extent: "Part I only (pages 1-2)"',
  'focus: "Part I, from \\"The facts\\""',
  'recognized_by: "First Reader, A Blog; Second Reader, Another"',
  'recognition: "First: \\"plain\\" | Second: \\"clear\\""',
  'recognition_source: "https://a.example/one | https://b.example/two"',
  'note: "Kept as found (1\\\\.)."',
  '---',
  '',
  'NOTICE: a caption, with an astral mark 𝔄 ahead of the focus.',
  '',
  'COURT OF FIXTURES',
  '',
  'The Court delivered the opinion.',
  '',
  '## I',
  '',
  'The facts are these.',
  '',
  'And more facts, with a footnote.[^1]',
  '',
  '## II',
  '',
  'The law, Doe v. Roe, 2 U.S. 2, is plain (Smith v. Jones, 1 U.S. 1).',
  '',
  '[^1]: A note.',
  '',
].join('\n');

// A piece as main still has them: no `short`, no standoff.
const PLAIN = [
  '---',
  'title: "A Short Piece (in a series)"',
  'author: "Bo Other"',
  'year: "1885-1886"',
  'genre: "essay"',
  'extent: "whole"',
  'recognized_by: "none found"',
  'recognition: "none found"',
  'recognition_source: "none found"',
  'note: "Nothing to say."',
  '---',
  '',
  'Only a paragraph.',
  '',
].join('\n');

const FOCUS = [['## I', '## II']];
const CAPTION = [['NOTICE:', 'The Court delivered the opinion.']];

// standoffs.py's partition, in code points: a paragraph is a run of non-blank
// lines, and a label runs from the paragraph a bound starts with up to the one
// another bound starts with.
function standoff(text, focus, caption = []) {
  const cp = i => [...text.slice(0, i)].length;
  const paras = [...text.matchAll(/[^\n]*\S[^\n]*(?:\n[^\n]*\S[^\n]*)*/g)].map(m => [m.index, m.index + m[0].length]);
  const label = paras.map(() => 'context');
  const starts = (k, b) => { const p = text.slice(...paras[k]); return p === b || p.startsWith(b + '\n') || p.startsWith(b + ' '); };
  for (const [name, bounds] of [['focus', focus], ['caption', caption]]) {
    for (const [first, after] of bounds) {
      const i = paras.findIndex((_, k) => starts(k, first));
      const j = paras.findIndex((_, k) => k > i && starts(k, after));
      for (let k = i; k < j; k++) label[k] = name;
    }
  }
  const bytes = Buffer.from(text, 'utf8');
  return {
    kind: 'standoff/1',
    target: { path: 'p.md', repo: 'mehrlander/home', bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') },
    vocabulary: [{ label: 'focus' }, { label: 'context' }, ...(caption.length ? [{ label: 'caption' }] : [])],
    verdicts: [{ verdict: 'KEEP' }],
    units: paras.map(([s, e], k) => ({ uid: `u${k + 1}`, start: cp(s), end: cp(e), label: label[k], verdict: 'KEEP',
                                       words: text.slice(s, e).split(/\s+/).filter(Boolean).length })),
  };
}

// The citations standoff the brief describes: `text` and `citation` units at
// sub-paragraph grain, partitioning the file, in code points.
const CITES = ['Doe v. Roe, 2 U.S. 2', 'Smith v. Jones, 1 U.S. 1'];
function citations(text, cites = CITES) {
  const cp = i => [...text.slice(0, i)].length;
  const marks = cites.map(c => [text.indexOf(c), text.indexOf(c) + c.length]).sort((a, b) => a[0] - b[0]);
  const units = [];
  let at = 0;
  for (const [s, e] of marks) { if (s > at) units.push([at, s, 'text']); units.push([s, e, 'citation']); at = e; }
  units.push([at, text.length, 'text']);
  const bytes = Buffer.from(text, 'utf8');
  return {
    kind: 'standoff/1',
    target: { path: 'p.md', repo: 'mehrlander/home', bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') },
    vocabulary: [{ label: 'text' }, { label: 'citation' }],
    units: units.map(([s, e, label], k) => ({ uid: `c${k + 1}`, start: cp(s), end: cp(e), label })),
  };
}

function harness(search = '') {
  const address = new URL(`https://example.test/pages/text-lab.html${search}`);
  const location = { href: address.href, search: address.search, hostname: address.hostname };
  const history = { replaceState(_s, _t, value) { location.href = String(value); location.search = new URL(location.href).search; } };
  const loads = [];
  const gh = { load: async name => { loads.push(name); } };
  const window = { esc: s => String(s ?? '').replace(/[&<>"']/g, c => ESC[c]), marked };
  window.self = window; window.top = window; window.TOKEN = '';
  kit(window, 'guide-render.js');
  kit(window, 'standoff.js');
  kit(window, 'repo-address.js');
  kit(window, 'linked-swiper.js');
  kit(window, 'read-aloud.js');
  const doc = new Proxy(dom.window.document, {
    get(t, k) {
      if (k === 'addEventListener') return (_name, fn) => fn();
      const v = Reflect.get(t, k);
      return typeof v === 'function' ? v.bind(t) : v;
    },
  });
  let factory = null;
  const Alpine = { data(name, fn) { factory = fn; } };
  new Function('document', 'Alpine', 'window', 'params', 'location', 'history', 'gh', MODEL)(
    doc, Alpine, window, new URLSearchParams(location.search), location, history, gh);
  const model = factory();
  model.$nextTick = fn => fn();
  return { model, window, location, loads };
}

// home, as the contents API answers it: the folder, each piece's bytes and
// each standoff's text.
function home(files) {
  return {
    req: async p => {
      assert.match(p, /^contents\/projects\/text\/exemplars\/pieces\?ref=/);
      return Object.keys(files).map(name => ({ type: 'file', name }));
    },
    bytes: async p => ({ bytes: new Uint8Array(Buffer.from(files[p.split('/').pop()], 'utf8')) }),
    get: async p => ({ text: files[p.split('/').pop()] }),
  };
}
const FILES = () => ({
  'fixture.md': PIECE,
  'fixture.standoff.json': JSON.stringify(standoff(PIECE, FOCUS, CAPTION)),
  'fixture.citations.standoff.json': JSON.stringify(citations(PIECE)),
  'short.md': PLAIN,
});
const render = html => { const el = dom.window.document.createElement('div'); el.innerHTML = html; return el; };

test('the pane is a sixth tab, and ?exemplar= opens it unless ?pane= names another', () => {
  const plain = harness().model;
  assert.ok(plain.PANES.includes('exemplars'));
  assert.equal(plain.pane, 'probes', 'the landing is unchanged');
  const linked = harness('?exemplar=fixture').model;
  assert.equal(linked.pane, 'exemplars');
  assert.equal(linked.exemplarSel, 'fixture');
  assert.equal(harness('?pane=runs&exemplar=fixture').model.pane, 'runs', 'an explicit pane wins, as it does over ?run=');
});

test('front matter parses as the pieces write it, escapes included', () => {
  const { model } = harness();
  const { fields, bodyAt } = model.exemplarFields(PIECE);
  assert.equal(fields.short, 'Fixture');
  assert.equal(fields.focus, 'Part I, from "The facts"', 'an escaped quote is a quote');
  assert.equal(fields.note, 'Kept as found (1\\.).', 'an escaped backslash is one backslash');
  assert.equal(fields.recognition, 'First: "plain" | Second: "clear"');
  assert.ok(PIECE.slice(bodyAt).startsWith('\nNOTICE'), 'the body starts after the closing fence');
  assert.deepEqual(model.exemplarFields('No front matter here.'), { fields: {}, bodyAt: 0 });
  assert.equal(model.shortYear('1885-1886'), '1885 → 1886');
  assert.equal(model.shortYear('2026 (award year; the document’s own date was not found)'), '2026');
});

test('a row is one line: the short title, or the title\'s head where there is none, then surnames and year', () => {
  const { model } = harness();
  assert.equal(model.listTitle({ short: 'Snyder v. Phelps', title: 'Snyder v. Phelps, 562 U.S. 443 (2011): Opinion of the Court' }), 'Snyder v. Phelps');
  assert.equal(model.listTitle({ title: 'Snyder v. Phelps, 562 U.S. 443 (2011): Opinion of the Court' }), 'Snyder v. Phelps, 562 U.S. 443',
    'a ref without `short` still lists');
  const names = {
    'John G. Roberts Jr., Chief Justice': 'Roberts',
    'John G. Roberts Jr. (counsel of record, Hogan & Hartson L.L.P.), with Lorane F. Hebert': 'Roberts',
    'J. D. Watson and F. H. C. Crick': 'Watson & Crick',
    'Frank D. Graham and Thomas J. Emery': 'Graham & Emery',
    'R. P. Feynman': 'Feynman',
    'George Orwell': 'Orwell',
    'Health Literacy Media and Novartis Pharmaceuticals Corporation': 'Health Literacy Media & Novartis Pharmaceuticals Corporation',
  };
  for (const [author, want] of Object.entries(names)) assert.equal(model.surnames(author), want, author);
  const row = render(model.exemplarRowHtml({ id: 'x', short: 'Fixture', title: 'A Fixture', author: 'Ann Writer, Clerk', year: '1999' }));
  assert.equal(row.textContent, 'FixtureWriter · 1999');
  assert.equal(row.querySelectorAll('[data-part="title"]').length, 1);
  assert.doesNotMatch(row.innerHTML, /words/, 'no word count on a row');
});

test('the focus and the caption are found in UTF-16 from a standoff counted in code points', async () => {
  const { model } = harness();
  const bytes = new Uint8Array(Buffer.from(PIECE, 'utf8'));
  const at = PIECE.indexOf('## I');
  assert.notEqual([...PIECE.slice(0, at)].length, at, 'the fixture really does put the two counts apart');
  const { spans, captions, stale } = model.exemplarFocus(standoff(PIECE, FOCUS, CAPTION), PIECE, await model.sha256(bytes), bytes.length);
  assert.equal(stale, false);
  assert.equal(spans.length, 1, 'consecutive focus units are one passage');
  const passage = PIECE.slice(spans[0].start, spans[0].end);
  assert.ok(passage.startsWith('## I\n'), JSON.stringify(passage.slice(0, 12)));
  assert.ok(passage.endsWith('with a footnote.[^1]'));
  assert.equal(spans[0].words, 12);
  assert.equal(captions.length, 1);
  assert.equal(PIECE.slice(captions[0].start, captions[0].end), 'NOTICE: a caption, with an astral mark 𝔄 ahead of the focus.\n\nCOURT OF FIXTURES');
  const { bodyAt } = model.exemplarFields(PIECE);
  assert.ok(PIECE.slice(model.textStart(bodyAt, captions)).trimStart().startsWith('The Court delivered the opinion.'),
    'the text proper starts past the caption');
  assert.equal(model.textStart(bodyAt, []), bodyAt, 'without a caption the body is the text');
  const two = model.exemplarFocus(standoff(PIECE, [['## I', 'The facts are these.'], ['## II', 'The law,']]), PIECE);
  assert.deepEqual(two.spans.map(s => PIECE.slice(s.start, s.end)), ['## I', '## II'], 'separate runs stay separate');
});

test('a standoff that no longer pins the piece marks nothing, and says so', async () => {
  const { model } = harness();
  const bytes = new Uint8Array(Buffer.from(PIECE, 'utf8'));
  const so = standoff(PIECE, FOCUS, CAPTION);
  const edited = PIECE.replace('these', 'those');
  const changed = new Uint8Array(Buffer.from(edited, 'utf8'));
  assert.deepEqual(model.exemplarFocus(so, edited, await model.sha256(changed), changed.length), { spans: [], captions: [], stale: true });
  const short = { ...so, target: { ...so.target, sha256: '' } };
  assert.equal(model.exemplarFocus(short, PIECE + 'x', '', bytes.length + 1).stale, true, 'the byte count checks where no digest can');
  const gap = JSON.parse(JSON.stringify(so));
  gap.units.splice(5, 1);
  assert.equal(model.exemplarFocus(gap, PIECE, await model.sha256(bytes), bytes.length).stale, true,
    'units that do not partition the piece are refused');
  assert.deepEqual(model.exemplarFocus(null, PIECE), { spans: [], captions: [], stale: false }, 'no standoff is not a stale one');
});

test('the pane reads every piece and standoff once, and lists them by genre', async () => {
  const h = harness('?exemplar=gone');
  h.model.home = home(FILES());
  await h.model.loadExemplars();
  await h.model.loadExemplars();
  assert.equal(h.model.exemplarState, 'done');
  assert.deepEqual(h.loads.sort(), ['kits/guide-render.js', 'kits/read-aloud.js', 'kits/standoff.js']);
  assert.equal(h.model.exemplars.length, 2, 'a standoff is not a piece');
  assert.equal(h.model.exemplarSel, '', 'a slug the folder does not hold is dropped');
  const fixture = h.model.exemplarOf('fixture');
  assert.equal(fixture.focusSpans.length, 1);
  assert.equal(fixture.words, 38, 'the text proper is counted, not its caption');
  assert.deepEqual(h.model.exemplarOf('short').focusSpans, []);
  assert.deepEqual(h.model.exemplarGroups().map(g => g.name), ['essay', 'opinion'], 'equal groups fall back to the name');
  assert.deepEqual(h.model.exemplarIds(), ['short', 'fixture']);
  const list = render(h.model.exemplarListHtml());
  assert.deepEqual([...list.querySelectorAll('[data-exemplar]')].map(r => r.textContent),
    ['A Short PieceOther · 1885 → 1886', 'FixtureWriter · 1999']);
});

test('Text is the piece from the text proper on, with its focus marked over the render', async () => {
  const h = harness();
  h.model.home = home(FILES());
  await h.model.loadExemplars();
  const card = render(h.model.exemplarCardHtml('fixture'));
  const body = card.querySelector('[data-exemplar-body]');
  assert.equal(body.getAttribute('data-tab'), 'text', 'a card opens on Text');
  const text = card.querySelector('[data-pane="text"]');
  assert.doesNotMatch(text.textContent, /NOTICE|COURT OF FIXTURES/, 'the caption is not in Text');
  assert.match(text.querySelector('p').textContent, /^The Court delivered the opinion\.$/, 'Text opens on the text proper');
  const marks = text.querySelectorAll('[data-focus]');
  assert.equal(marks.length, 1);
  assert.deepEqual([...marks[0].querySelectorAll('[data-focus-text] h2, [data-focus-text] p')].map(e => e.textContent),
    ['I', 'The facts are these.', 'And more facts, with a footnote.[^1]'], 'the passage and nothing else');
  const ii = [...text.querySelectorAll('h2')].find(e => e.textContent === 'II');
  assert.ok(ii && !ii.closest('[data-focus]'), 'the next part stays outside');
  assert.match(marks[0].closest('.guide-body').className, /!text-xl !leading-8/, 'the text is set at reading size');
  const reading = text.cloneNode(true);
  reading.querySelectorAll('[data-focus-context]').forEach(e => e.remove());
  assert.doesNotMatch(reading.textContent, /First: "plain"|The Press/, 'nothing about the piece is in the text itself');
  assert.equal(card.querySelector('[data-exemplar-focus], [data-exemplar-source]'), null, 'no jump in the body and no panel-tip');
  assert.ok(h.model.exemplarOf('fixture').doc, 'the render is kept');
});

test('a focus passage is a change container: an outline, its number, and two readings, the text and the background', async () => {
  const h = harness();
  h.model.home = home(FILES());
  await h.model.loadExemplars();
  const host = dom.window.document.createElement('div');
  host.dataset.part = 'detail';
  host.innerHTML = h.model.exemplarCardHtml('fixture');
  dom.window.document.body.replaceChildren(host);
  const sec = host.querySelector('[data-focus]');
  assert.equal(sec.getAttribute('data-reading'), 'text', 'a passage opens on its own words');
  assert.match(sec.className, /\bring-1\b/);
  assert.match(sec.className, /-mx-2 px-2/, 'the outline sits outside the text, which keeps its left edge');
  assert.doesNotMatch(sec.className, /(^|\s)bg-/, 'an outline, not a fill: a fill is what a selected row wears');
  assert.match(sec.className, /data-\[reading=context\]:ring-/, 'the outline says which reading is on screen');
  assert.doesNotMatch(sec.className, /--color-(error|success|warning|info|primary)/, 'in the base colour: colour here is a standing');
  assert.match(sec.querySelector('.sticky').innerHTML, /ph-bookmark-simple"><\/i>1</, 'its number, top left');
  const stops = [...sec.querySelectorAll('[data-focus-reading]')];
  assert.deepEqual(stops.map(b => b.textContent), ['text', 'context']);
  assert.ok(sec.querySelector('.sticky').contains(stops[0]), 'the stops ride the sticky row, so a long passage keeps them in reach');
  const ctx = sec.querySelector('[data-focus-context]');
  assert.match(ctx.className, /hidden group-data-\[reading=context\]\/focus:grid/, 'the background shows only on its reading');
  assert.match(ctx.textContent, /Part I, from "The facts"/, 'what the passage is');
  assert.match(ctx.textContent, /12 words/);
  assert.match(ctx.textContent, /First: "plain"/, 'and the praise, which is the piece\'s');
  assert.deepEqual([...ctx.querySelectorAll('a[href^="https://"]')].map(a => a.getAttribute('href')), ['https://a.example/one', 'https://b.example/two']);
  // A tap on a stop shows that reading and keeps the reader at the passage.
  const went = [];
  h.model.scrollToMark = (b, el) => went.push(el.getAttribute('data-focus'));
  assert.equal(h.model.exemplarClick({ target: host.querySelector('[data-focus-reading="context"]') }), true);
  assert.equal(sec.getAttribute('data-reading'), 'context');
  assert.deepEqual(stops.map(b => b.getAttribute('aria-pressed')), ['false', 'true']);
  assert.deepEqual(went, ['0'], 'back to the top of the passage, since the box follows the reading');
  assert.ok(sec.hasAttribute('data-on'), 'the passage the reader picked is the one selected');
  assert.match(sec.className, /data-\[on\]:ring-2/, 'selected, its outline is heavier on either reading');
  assert.doesNotMatch(sec.querySelector('[data-focus-context]').textContent, /passage 1 of/, 'the count is the pill\'s and the pad\'s, not said again');
  assert.equal(h.model.focusAt.fixture, 0, 'and the passage is where the reader now is');
  h.model.exemplarClick({ target: host.querySelector('[data-focus-reading="text"]') });
  assert.equal(sec.getAttribute('data-reading'), 'text');
  assert.ok(sec.hasAttribute('data-on'), 'and it stays selected, not a flash');
  h.model.ringMark([]);
  assert.equal(sec.hasAttribute('data-on'), false, 'until another mark is chosen');
  dom.window.document.body.replaceChildren();
});

test('Context holds the title, the praise, the caption and where the copy came from', async () => {
  const h = harness();
  h.model.home = home(FILES());
  await h.model.loadExemplars();
  const ctx = render(h.model.exemplarCardHtml('fixture')).querySelector('[data-pane="context"]');
  assert.equal(ctx.querySelector('h3').textContent, 'A Fixture: Its Subtitle', 'the full title lives here');
  assert.match(ctx.textContent, /Ann Writer, Clerk · 1999 · opinion · 38 words/);
  const praise = [...ctx.querySelectorAll('a[href^="https://"]')].map(a => [a.textContent, a.getAttribute('href')]);
  assert.deepEqual(praise.slice(0, 2), [['First Reader, A Blog', 'https://a.example/one'], ['Second Reader, Another', 'https://b.example/two']]);
  assert.match(ctx.textContent, /NOTICE: a caption, with an astral mark 𝔄 ahead of the focus\.\s*COURT OF FIXTURES/, 'the caption, rendered');
  assert.deepEqual(praise.slice(2, 4).map(([label]) => label), ['press.example', 'page.png'], 'the source page, named by host and then by file');
  assert.match(ctx.textContent, /acquired 2026-11-17/);
  assert.match(ctx.textContent, /Part I only \(pages 1-2\)/, 'the extent, whole');
  assert.match(ctx.textContent, /Kept as found \(1\\\.\)\./, 'the conversion note');
  assert.deepEqual(praise.slice(4).map(([label]) => label), ['fixture.md', 'fixture.standoff.json']);
  const plain = render(h.model.exemplarCardHtml('short'));
  assert.doesNotMatch(plain.textContent, /none found/, 'a placeholder draws nothing');
  assert.equal(plain.querySelector('[aria-label="Praised"], [aria-label="Caption"]'), null);
  assert.equal(plain.querySelector('[data-pane="text"] p').textContent, 'Only a paragraph.');
});

test('one face for every card: the toggle switches each body, and the focus jump shows Text', async () => {
  const h = harness();
  h.model.home = home(FILES());
  await h.model.loadExemplars();
  const host = dom.window.document.createElement('div');
  host.dataset.part = 'detail';
  host.innerHTML = h.model.exemplarHead(1, 2, false) + h.model.exemplarCardHtml('short') + h.model.exemplarCardHtml('fixture');
  dom.window.document.body.replaceChildren(host);
  const bodies = () => [...host.querySelectorAll('[data-exemplar-body]')].map(b => b.getAttribute('data-tab'));
  assert.equal(h.model.exemplarClick({ target: host.querySelector('[data-exemplar-tab="context"]') }), true);
  assert.deepEqual(bodies(), ['context', 'context'], 'a swipe compares like with like');
  assert.equal(h.model.exemplarTab, 'context');
  assert.match(render(h.model.exemplarCardHtml('fixture')).innerHTML, /data-tab="context"/, 'a card drawn later opens on the same face');
  assert.deepEqual([...host.querySelectorAll('[data-exemplar-tab="context"]')].map(b => b.getAttribute('aria-selected')), ['true', 'true']);
  const frames = [];
  globalThis.requestAnimationFrame = fn => frames.push(fn);
  h.model.exemplarClick({ target: host.querySelector('[data-exemplar-focus] i') });
  assert.deepEqual(bodies(), ['text', 'text'], 'the focus is in Text, so the jump shows Text first');
  assert.equal(frames.length, 1, 'and then jumps');
  delete globalThis.requestAnimationFrame;
  dom.window.document.body.replaceChildren();
});

test('the focus control sits in the head beside the counter, and finds its own piece', async () => {
  const h = harness();
  h.model.home = home(FILES());
  await h.model.loadExemplars();
  // The door's look is swipe-deck's; only its presence is held here.
  h.window.swipeDeck = { entry: { cls: () => 'btn', title: n => `Read ${n} pieces one at a time`, icon: 'ph-cards-three' } };
  const head = render(h.model.exemplarHead(1, 2, false));
  const kids = [...head.children].map(e => e.tagName + (e.hasAttribute('data-exemplar-focus') ? ':focus' : e.hasAttribute('data-exemplar-speak') ? ':voice' : ''));
  assert.deepEqual(kids.slice(0, 3), ['H2', 'BUTTON:voice', 'BUTTON:focus'], 'after the title, before the counter and the door');
  assert.match(head.querySelector('h2').textContent, /Fixture$/, 'the head shows the short title');
  assert.ok(head.querySelector('[data-swipe-cards]'), 'the door stays');
  assert.match(head.querySelector('[data-exemplar-focus]').getAttribute('data-title-tip'), /12 of 38 words/);
  assert.equal(render(h.model.exemplarHead(0, 2, false)).querySelector('[data-exemplar-focus]'), null, 'a piece with no focus has none');
  const detail = dom.window.document.createElement('div');
  detail.dataset.part = 'detail';
  detail.innerHTML = head.innerHTML + '<section>' + h.model.exemplarCardHtml('short') + '</section><section>' + h.model.exemplarCardHtml('fixture') + '</section>';
  const jumped = [];
  h.model.jumpToFocus = body => jumped.push(body.getAttribute('data-exemplar-body'));
  assert.equal(h.model.exemplarClick({ target: detail.querySelector('[data-exemplar-focus] i') }), true);
  assert.deepEqual(jumped, ['fixture']);
});

test('a ref from before `caption`, or a stale standoff, shows the whole body and says nothing in its place', async () => {
  for (const [why, so] of [
    ['no caption label', standoff(PIECE, FOCUS)],
    ['stale', { ...standoff(PIECE, FOCUS, CAPTION), target: { path: 'p.md', bytes: 1, sha256: '0'.repeat(64) } }],
  ]) {
    const files = FILES();
    files['fixture.standoff.json'] = JSON.stringify(so);
    const h = harness();
    h.model.home = home(files);
    await h.model.loadExemplars();
    const card = render(h.model.exemplarHead(1, 2, false) + h.model.exemplarCardHtml('fixture'));
    assert.match(card.querySelector('[data-pane="text"] p').textContent, /^NOTICE/, `${why}: Text is the whole body`);
    assert.equal(card.querySelector('[aria-label="Caption"]'), null, `${why}: no caption in Context`);
    assert.doesNotMatch(card.textContent, /unmarked/);
    if (why === 'stale') assert.equal(card.querySelector('[data-focus], [data-exemplar-focus]'), null, 'stale: nothing marked');
    else assert.equal(card.querySelectorAll('[data-focus]').length, 1, 'no caption label: the focus still marks');
  }
});

test('the address keeps the open piece, and the deck keeps its place', async () => {
  const h = harness('?pane=exemplars');
  h.model.home = home(FILES());
  await h.model.loadExemplars();
  h.model.pane = 'exemplars';
  h.model.exemplarSel = 'fixture';
  h.model.syncSel();
  assert.equal(new URL(h.location.href).searchParams.get('exemplar'), 'fixture');
  h.model.pane = 'probes';
  h.model.syncSel();
  assert.equal(new URL(h.location.href).searchParams.has('exemplar'), false, 'another pane drops it');
  const opened = [];
  h.window.swipeDeck = { open: o => { opened.push(o); return {}; } };
  h.model.pane = 'exemplars';
  await h.model.openExemplarDeck(5);
  assert.equal(opened[0].count, 2);
  assert.equal(opened[0].start, 1, 'a slide past the end is clamped to the last one');
  assert.equal(opened[0].index(1).group, 'opinion');
  const chrome = [];
  opened[0].render(1, dom.window.document.createElement('section'), { setChrome: c => chrome.push(c) });
  assert.equal(chrome[0].actions.length, 1, 'the slide holds its focus control');
  opened[0].render(0, dom.window.document.createElement('section'), { setChrome: c => chrome.push(c) });
  assert.deepEqual(chrome[1].actions, [], 'a piece with no focus has none');
  opened[0].onSlide(0);
  const at = new URL(h.location.href).searchParams;
  assert.equal(at.get('deck'), 'exemplars');
  assert.equal(at.get('at'), '0');
  assert.equal(at.get('exemplar'), 'short', 'the list follows the deck, so closing returns to the piece last read');
  opened[0].onClose();
  assert.equal(new URL(h.location.href).searchParams.has('deck'), false);
  const again = harness('?pane=exemplars&deck=exemplars&at=1');
  again.window.swipeDeck = { open: o => { opened.push(o); return {}; } };
  again.model.home = home(FILES());
  await again.model.loadExemplars();
  await new Promise(r => setTimeout(r, 0));
  assert.equal(opened.length, 2, 'an addressed deck reopens once the pieces are read');
  assert.equal(opened[1].start, 1);
});

test('the deck header names the piece in view, and a swipe changes it', async () => {
  const h = harness('?pane=exemplars');
  h.model.home = home(FILES());
  await h.model.loadExemplars();
  const opened = [], header = [];
  h.window.swipeDeck = { open: o => {
    opened.push(o);
    return { setTitle: t => header.push(['title', t]), setSubtitle: t => header.push(['sub', t]) };
  } };
  await h.model.openExemplarDeck(1);
  assert.equal(opened[0].title, 'Fixture', 'it opens on the name of the slide it opens on, not the kind');
  assert.equal(opened[0].subtitle, 'Writer · 1999 · opinion');
  opened[0].onSlide(0);
  assert.deepEqual(header, [['title', 'A Short Piece'], ['sub', 'Other · 1885 → 1886 · essay']], 'a swipe renames it');
  opened[0].onSlide(1);
  assert.deepEqual(header.slice(2), [['title', 'Fixture'], ['sub', 'Writer · 1999 · opinion']]);
  // The setters are swipe-deck's own: a renamed one would leave the header
  // generic again, silently.
  const kitSrc = readFileSync(path.join(root, 'lib/kits/swipe-deck.js'), 'utf8');
  assert.match(kitSrc, /setTitle: t =>/);
  assert.match(kitSrc, /setSubtitle: t =>/);
});

test('reading aloud speaks Text only: no front matter, no caption, no citation, and tidies what a cut leaves', async () => {
  const h = harness();
  h.model.home = home(FILES());
  await h.model.loadExemplars();
  const fixture = h.model.exemplarOf('fixture');
  assert.equal(fixture.citationSpans.length, 2);
  const said = h.model.speech(fixture);
  assert.equal(said, 'The Court delivered the opinion.\n\nI\n\nThe facts are these.\n\nAnd more facts, with a footnote.\n\nII\n\nThe law, is plain.',
    'a doubled comma and an emptied parenthesis are tidied, and the footnote marker goes');
  assert.doesNotMatch(said, /NOTICE|COURT OF FIXTURES|A Fixture|Ann Writer|Doe|Smith/);
  assert.match(fixture.text, /The law, Doe v\. Roe, 2 U\.S\. 2, is plain \(Smith v\. Jones, 1 U\.S\. 1\)\./, 'the stored piece is untouched');
  const text = render(h.model.exemplarCardHtml('fixture')).querySelector('[data-pane="text"]').textContent;
  assert.match(text, /Doe v\. Roe/, 'and Text still shows the citations');
  assert.equal(h.model.tidySpeech('held, the rule'), 'held, the rule', 'punctuation away from a cut is left alone');
  for (const [why, files] of [
    ['no citations file', (() => { const f = FILES(); delete f['fixture.citations.standoff.json']; return f; })()],
    ['a stale one', (() => { const f = FILES(); f['fixture.citations.standoff.json'] = JSON.stringify({ ...citations(PIECE), target: { bytes: 1, sha256: '0'.repeat(64) } }); return f; })()],
  ]) {
    const g = harness();
    g.model.home = home(files);
    await g.model.loadExemplars();
    assert.match(g.model.speech(g.model.exemplarOf('fixture')), /The law, Doe v\. Roe, 2 U\.S\. 2, is plain \(Smith v\. Jones, 1 U\.S\. 1\)\./,
      `${why}: everything in Text is spoken`);
  }
});

// Cases met in home's real citation standoffs (Judulang, Commerce, the
// Alaska brief), each a cut beside a closing quote, an abbreviation or a dash.
test('the tidy mends what a cut leaves beside a closing quote, an abbreviation or a dash', () => {
  const { model } = harness();
  const t = s => model.tidySpeech(s.replace(/⌧/g, model.CUT));
  assert.equal(t('moral turpitude,” ⌧, and so fits'), 'moral turpitude,” and so fits', 'one comma, inside the quote');
  assert.equal(t('reasoned decisionmaking,” ⌧.\n\nThe District Court'), 'reasoned decisionmaking.”\n\nThe District Court',
    'a full stop takes the comma\'s place');
  assert.equal(t('the statutory text,’ ” ⌧. In the view'), 'the statutory text.’ ” In the view');
  assert.equal(t('Defense Council, Inc.⌧, to govern'), 'Defense Council, Inc., to govern', 'an abbreviation keeps its comma');
  assert.equal(t('held. ⌧, The next'), 'held. The next', 'a stray comma after a full stop goes');
  assert.equal(t('the generators⌧—even though'), 'the generators—even though', 'no space before a dash');
  assert.equal(t('the picketing. ⌧ The funeral'), 'the picketing. The funeral');
});

test('the card speaks the piece in view from its head, and the deck reads from the slide in view', async () => {
  const h = harness();
  h.model.home = home(FILES());
  await h.model.loadExemplars();
  spoken.length = 0;
  assert.match(h.model.exemplarHead(1, 2, false), /data-exemplar-speak="fixture"[^>]*aria-label="Read the text aloud"/);
  h.model.exemplarClick({ target: render(h.model.exemplarHead(1, 2, false)).querySelector('[data-exemplar-speak] i') });
  assert.equal(spoken[0], 'The Court delivered the opinion.', 'it starts at the text proper of the piece in view');
  assert.equal(h.model.voice.state, 'speaking');
  assert.match(h.model.exemplarHead(1, 2, false), /data-exemplar-speak="fixture"[^>]*aria-label="Pause"/, 'the head says it is speaking');
  h.model.speakCard('fixture');
  assert.equal(h.model.voice.state, 'paused', 'a second tap pauses');
  h.model.showPane('probes').catch(() => {});
  assert.equal(h.model.voice, null, 'leaving the pane quiets it');
  const opened = [];
  h.window.swipeDeck = { open: o => { opened.push(o); return {}; } };
  await h.model.openExemplarDeck(0);
  const action = opened[0].actions[0];
  assert.equal(action.title, 'Read the text aloud from this piece');
  spoken.length = 0;
  action.onClick({ active: () => 1, go() {} }, null);
  assert.equal(spoken[0], 'The Court delivered the opinion.', 'the deck reads from the slide in view, one item a slide');
  opened[0].onClose();
});

test('?marks= trials offer the piece\'s marks in file order, and the default offers none', async () => {
  const marked = async (q) => {
    const h = harness(q);
    h.model.home = home(FILES());
    await h.model.loadExemplars();
    h.model.pane = 'exemplars';
    h.model.exemplarSel = 'fixture';
    return h.model;
  };
  const plain = await marked('');
  assert.equal(plain.marks, null, 'without ?marks= the FAB is offered nothing');
  assert.equal(render(plain.exemplarCardHtml('fixture')).querySelector('[data-cite]'), null, 'and the render is unchanged');
  const a = await marked('?marks=a');
  assert.equal(a.marks.style, 'tab');
  assert.deepEqual(a.marks.items.map(m => m.key), ['caption', 'focus0', 'citations'], 'in the order the file has them');
  const cites = a.marks.items[2];
  assert.equal(cites.count, 2, 'every citation is one row');
  const card = render(a.exemplarCardHtml('fixture'));
  assert.deepEqual([...new Set([...card.querySelectorAll('[data-cite]')].map(e => e.dataset.cite))], ['0', '1']);
  assert.equal([...card.querySelectorAll('[data-cite="0"]')].map(e => e.textContent).join(''), 'Doe v. Roe, 2 U.S. 2', 'cut at its own edges');
  cites.choice.set('dim');
  assert.equal(a.citeMode, 'dim');
  assert.match(render(a.exemplarCardHtml('fixture')).innerHTML, /data-cites="dim"/, 'a card drawn later is drawn the same way');
  const went = [];
  a.goMark = (id, kind, k) => went.push([id, kind, k]);
  a.stepMark(1);
  a.stepMark(-1);
  assert.deepEqual(went.map(w => w.slice(0, 2).join(' ')), ['fixture caption', 'fixture cite'], 'a first step forward is the first mark; back is the last');
  const b = await marked('?marks=b');
  assert.equal(b.marks.style, 'stepper');
  const c = await marked('?marks=c');
  assert.equal(c.marks, null, 'the rail is the card\'s own, not the FAB\'s');
  assert.match(c.exemplarHead(1, 2, false), /focus 1\/1/, 'the head\'s chip says which passage');
  const cc = render(c.exemplarCardHtml('fixture'));
  assert.deepEqual([...cc.querySelectorAll('[data-exemplar-cites]')].map(b => b.dataset.exemplarCites), ['show', 'dim', 'hide'],
    'trial c draws the citations\' look beside the faces');
  c.exemplarClick({ target: cc.querySelector('[data-exemplar-cites="dim"] i') });
  assert.equal(c.citeMode, 'dim');
  assert.equal(render(a.exemplarCardHtml('fixture')).querySelector('[data-exemplar-cites]'), null, 'a and b keep it in the FAB');
});

test('under a FAB trial the page announces its marks to its own window and the one framing it', async () => {
  const h = harness('?marks=b&exemplar=fixture');
  const heard = [];
  const win = name => ({ CustomEvent: class { constructor(t) { this.type = t; } }, dispatchEvent: e => heard.push(name + ' ' + e.type) });
  Object.assign(h.window, win('page'));
  h.window.parent = win('shell');
  h.model.home = home(FILES());
  await h.model.loadExemplars();
  assert.deepEqual(heard, ['page fab:marks', 'shell fab:marks'], 'once the pieces are read, in both windows');
  assert.match(SRC, /\$watch\('marksSig', \(\) => \{ this\.announceMarks\(\);/, 'and again whenever the marks change');
  const c = harness('?marks=c');
  heard.length = 0;
  Object.assign(c.window, win('page'));
  c.model.announceMarks();
  assert.deepEqual(heard, [], 'the rail is the page\'s own; the FAB is not told');
});

test('trial d steps through the passages, or the citations once chosen, through the page\'s own pad', async () => {
  const h = harness('?marks=d&exemplar=fixture');
  h.model.home = home(FILES());
  await h.model.loadExemplars();
  h.model.pane = 'exemplars';
  assert.ok(h.loads.includes('kits/mark-pad.js'), 'the pad is the page\'s own, loaded under d alone');
  assert.equal(h.model.marks, null, 'the FAB is not involved');
  assert.deepEqual(h.model.padItems().map(m => m.label), ['caption', 'focus 1 of 1'], 'by default the passages, in file order');
  h.model.padKind = 'citations';
  assert.deepEqual(h.model.padItems().map(m => m.label), ['citation 1 of 2', 'citation 2 of 2'], 'then the citations, one at a time');
  const went = [];
  h.model.goMark = (id, kind, k) => went.push([kind, k]);
  h.model.padItems()[1].go();
  assert.deepEqual(went, [['cite', 1]]);
  // A mark reached another way is where the reader is, so the pad counts it.
  const placed = [];
  h.model.pad = { set: i => placed.push(i) };
  h.model.padKind = 'marks';
  h.model.padFollow('fixture', 'focus', 0);
  h.model.padFollow('another', 'focus', 0);
  assert.deepEqual(placed, [1], 'the passage is the second mark, after the caption; another piece is not the pad\'s');
  h.model.pad = null;
  h.model.pane = 'probes';
  assert.deepEqual(h.model.padItems(), [], 'no pad on another pane');
  assert.match(SRC, /\$watch\('marksSig', \(\) => \{ this\.announceMarks\(\); this\.pad\?\.refresh\(\); \}\)/, 'the pad follows every change of marks');
});

test('the header comment names the pane, its faces and its address', () => {
  const head = SRC.slice(0, SRC.indexOf('-->'));
  assert.match(head, /\n {4}exemplars {4}projects\/text\/exemplars\/pieces\//);
  assert.match(head, /two faces\. Text is the piece/);
  assert.match(head, /<slug>\.citations\.standoff\.json/);
  assert.match(head, /\?exemplar=<slug> opens one piece and implies the exemplars pane/);
  assert.match(head, /runs or exemplars/);
  assert.match(head, /\?marks=a\|b\|c\|d trials a way through a piece's marks/);
  assert.match(SRC, /x-ref="exemplarList" role="listbox"/);
  assert.doesNotMatch(SRC, /tip\.kind === 'exemplar'/, 'Context holds what the panel-tip did');
});
