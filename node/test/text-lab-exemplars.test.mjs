// text-lab-exemplars.test.mjs: the Exemplars pane reads home's pieces as their
// README states the format (YAML front matter, then the text verbatim), finds a
// piece's focus from its standoff, and marks that passage over the render.
//
// The standoff counts offsets in code points, as Python does, and the page
// slices in UTF-16, so the fixture carries an astral character ahead of its
// focus: without the conversion every span lands one place early. A standoff
// that no longer pins the piece's bytes must mark nothing rather than the
// wrong text.

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
// holding the real guide renderer, standoff kit and address grammar.
const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>');
globalThis.DOMParser = dom.window.DOMParser;   // guide-render's render() parses with the global
const kit = (win, name) => new Function('window', readFileSync(path.join(root, 'lib/kits', name), 'utf8'))(win);
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

// A piece as the exemplars README describes one, its values escaped the way
// the real front matter escapes them.
const PIECE = [
  '---',
  'title: "A Fixture: Its Subtitle"',
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
  'Caption, with an astral mark 𝔄 ahead of the focus.',
  '',
  '## I',
  '',
  'The facts are these.',
  '',
  'And more facts, with a footnote.[^1]',
  '',
  '## II',
  '',
  'The law.',
  '',
  '[^1]: A note.',
  '',
].join('\n');

const PLAIN = [
  '---',
  'title: "A Short Piece"',
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

// standoffs.py's partition, in code points: a paragraph is a run of non-blank
// lines, and `focus` runs from the paragraph a bound starts with up to the one
// another bound starts with.
function standoff(text, bounds) {
  const cp = i => [...text.slice(0, i)].length;
  const paras = [...text.matchAll(/[^\n]*\S[^\n]*(?:\n[^\n]*\S[^\n]*)*/g)].map(m => [m.index, m.index + m[0].length]);
  const label = paras.map(() => 'context');
  for (const [first, after] of bounds) {
    const i = paras.findIndex(([s, e]) => text.slice(s, e) === first || text.slice(s, e).startsWith(first + '\n'));
    const j = paras.findIndex(([s, e], k) => k > i && (text.slice(s, e) === after || text.slice(s, e).startsWith(after + '\n')));
    for (let k = i; k < j; k++) label[k] = 'focus';
  }
  const bytes = Buffer.from(text, 'utf8');
  return {
    kind: 'standoff/1',
    target: { path: 'p.md', repo: 'mehrlander/home', bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') },
    vocabulary: [{ label: 'focus' }, { label: 'context' }],
    verdicts: [{ verdict: 'KEEP' }],
    units: paras.map(([s, e], k) => ({ uid: `u${k + 1}`, start: cp(s), end: cp(e), label: label[k], verdict: 'KEEP',
                                       words: text.slice(s, e).split(/\s+/).filter(Boolean).length })),
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
  'fixture.standoff.json': JSON.stringify(standoff(PIECE, [['## I', '## II']])),
  'short.md': PLAIN,
});

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
  assert.equal(fields.title, 'A Fixture: Its Subtitle');
  assert.equal(fields.focus, 'Part I, from "The facts"', 'an escaped quote is a quote');
  assert.equal(fields.note, 'Kept as found (1\\.).', 'an escaped backslash is one backslash');
  assert.equal(fields.recognition, 'First: "plain" | Second: "clear"');
  assert.ok(PIECE.slice(bodyAt).startsWith('\nCaption'), 'the body starts after the closing fence');
  assert.deepEqual(model.exemplarFields('No front matter here.'), { fields: {}, bodyAt: 0 });
  assert.equal(model.shortTitle(fields.title), 'A Fixture');
  assert.equal(model.shortAuthor(fields.author), 'Ann Writer');
  assert.equal(model.shortYear('1885-1886'), '1885 → 1886');
  assert.equal(model.shortYear('2026 (award year; the document’s own date was not found)'), '2026');
  assert.equal(model.shortExtent(fields), 'Part I only');
  assert.equal(model.shortExtent({ extent: 'Whole opinion of the Court, with its footnotes' }), '', 'a whole piece names no part');
});

test('the focus is found in UTF-16 from a standoff counted in code points', async () => {
  const { model } = harness();
  const bytes = new Uint8Array(Buffer.from(PIECE, 'utf8'));
  const so = standoff(PIECE, [['## I', '## II']]);
  assert.notEqual(so.units[3].start, PIECE.indexOf('## I'), 'the fixture really does put the two counts apart');
  const { spans, stale } = model.exemplarFocus(so, PIECE, await model.sha256(bytes), bytes.length);
  assert.equal(stale, false);
  assert.equal(spans.length, 1, 'consecutive focus units are one passage');
  const passage = PIECE.slice(spans[0].start, spans[0].end);
  assert.ok(passage.startsWith('## I\n'), JSON.stringify(passage.slice(0, 12)));
  assert.ok(passage.endsWith('with a footnote.[^1]'));
  assert.equal(spans[0].words, 12);
  const two = model.exemplarFocus(standoff(PIECE, [['## I', 'The facts are these.'], ['## II', 'The law.']]), PIECE);
  assert.deepEqual(two.spans.map(s => PIECE.slice(s.start, s.end)), ['## I', '## II'], 'separate runs stay separate');
});

test('a standoff that no longer pins the piece marks nothing, and says so', async () => {
  const { model } = harness();
  const bytes = new Uint8Array(Buffer.from(PIECE, 'utf8'));
  const so = standoff(PIECE, [['## I', '## II']]);
  const edited = PIECE.replace('these', 'those');
  const changed = new Uint8Array(Buffer.from(edited, 'utf8'));
  assert.deepEqual(model.exemplarFocus(so, edited, await model.sha256(changed), changed.length), { spans: [], stale: true });
  const short = { ...so, target: { ...so.target, sha256: '' } };
  assert.equal(model.exemplarFocus(short, PIECE + 'x', '', bytes.length + 1).stale, true, 'the byte count checks where no digest can');
  const gap = JSON.parse(JSON.stringify(so));
  gap.units.splice(4, 1);
  assert.equal(model.exemplarFocus(gap, PIECE, await model.sha256(bytes), bytes.length).stale, true,
    'units that do not partition the piece are refused');
  assert.deepEqual(model.exemplarFocus(null, PIECE), { spans: [], stale: false }, 'no standoff is not a stale one');
});

test('the pane reads every piece and standoff once, and lists them by genre', async () => {
  const h = harness('?exemplar=gone');
  h.model.home = home(FILES());
  await h.model.loadExemplars();
  await h.model.loadExemplars();
  assert.equal(h.model.exemplarState, 'done');
  assert.deepEqual(h.loads.sort(), ['kits/guide-render.js', 'kits/standoff.js']);
  assert.equal(h.model.exemplars.length, 2, 'the standoff is not a piece');
  assert.equal(h.model.exemplarSel, '', 'a slug the folder does not hold is dropped');
  const fixture = h.model.exemplarOf('fixture');
  assert.equal(fixture.focusSpans.length, 1);
  assert.equal(fixture.words, 29);
  assert.deepEqual(h.model.exemplarOf('short').focusSpans, []);
  assert.deepEqual(h.model.exemplarGroups().map(g => g.name), ['essay', 'opinion'], 'equal groups fall back to the name');
  assert.deepEqual(h.model.exemplarIds(), ['short', 'fixture']);
  const list = dom.window.document.createElement('div');
  list.innerHTML = h.model.exemplarListHtml();
  assert.deepEqual([...list.querySelectorAll('[data-exemplar]')].map(r => r.getAttribute('data-exemplar')), ['short', 'fixture']);
  assert.match(list.textContent, /Ann Writer · 1999 · 29 words · Part I only/);
});

test('the card marks its focus over the render and pairs each praise with its source', async () => {
  const h = harness();
  h.model.home = home(FILES());
  await h.model.loadExemplars();
  const card = dom.window.document.createElement('div');
  card.innerHTML = h.model.exemplarCardHtml('fixture');
  const marks = card.querySelectorAll('[data-focus]');
  assert.equal(marks.length, 1);
  assert.deepEqual([...marks[0].querySelectorAll('h2, p')].map(e => e.textContent),
    ['I', 'The facts are these.', 'And more facts, with a footnote.[^1]'], 'the passage and nothing else');
  assert.match(marks[0].textContent, /focus · 12 words/);
  const ii = [...card.querySelectorAll('h2')].find(e => e.textContent === 'II');
  assert.ok(ii && !ii.closest('[data-focus]'), 'the next part stays outside');
  assert.ok(card.querySelector('[data-exemplar-focus]'), 'a piece with a marked focus offers the jump');
  const praise = [...card.querySelectorAll('a[href^="https://"]')].map(a => [a.textContent, a.getAttribute('href')]);
  assert.deepEqual(praise, [['First Reader, A Blog', 'https://a.example/one'], ['Second Reader, Another', 'https://b.example/two']]);
  assert.equal(card.querySelector('[data-exemplar-source]').getAttribute('data-exemplar-source'), 'fixture');
  assert.ok(h.model.exemplarOf('fixture').doc, 'the render is kept');
  assert.equal(h.model.exemplarCardHtml('fixture'), h.model.exemplarCardHtml('fixture'));
  const plain = dom.window.document.createElement('div');
  plain.innerHTML = h.model.exemplarCardHtml('short');
  assert.equal(plain.querySelector('[data-focus], [data-exemplar-focus]'), null, 'no focus, no mark and no jump');
  assert.doesNotMatch(plain.textContent, /none found/, 'a placeholder draws nothing');
  assert.deepEqual(h.model.links(PIECE.match(/source_page: "(.*)"/)[1]).map(l => l.label), ['press.example', 'page.png'],
    'a second address on one host is named by its file');
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

test('the header comment names the pane and its address', () => {
  const head = SRC.slice(0, SRC.indexOf('-->'));
  assert.match(head, /\n {4}exemplars {4}projects\/text\/exemplars\/pieces\//);
  assert.match(head, /\?exemplar=<slug> opens one piece and implies the exemplars pane/);
  assert.match(head, /runs or exemplars/);
  assert.match(SRC, /x-ref="exemplarList" role="listbox"/);
  assert.match(SRC, /tip && tip\.kind === 'exemplar'/, 'where the text came from is a panel-tip');
});
