// kits/repo-mark.js — a repository's mark, from its manifest, drawn one way.
//
// The kit exists so the scope pill, the checkouts panel, the Sessions rows and
// the sidebar cannot draw one repository two ways; those consumers are tested
// beside their own markup (session-brief.test.mjs, estate-session-table.test.mjs).
// What is pinned here is the kit's half:
//
//   A MANIFEST WITH ONLY AN ICON DRAWS WHAT IT DREW. Every manifest in the
//   estate on 2026-10-28 declares a Phosphor class and nothing else, so the
//   untoned glyph must come out exactly `ph <glyph>`, with no colour.
//
//   ONE WEIGHT CLASS. Phosphor's `.ph` and `.ph-duotone` collide at equal
//   specificity, settled by stylesheet order, so the kit never writes two.
//
//   ONE COLOUR. The caller's resting colour, the tone and a state tint are
//   ranked, and only the winner is written.
//
//   AN SVG IS READ ONCE, AND A BAD ONE DRAWS THE GLYPH.
//
// Driven over a fake GH; no network, no pixels.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, tick, repoRoot } from './bootstrap.mjs';

const KIT = 'lib/kits/repo-mark.js';
const src = readFileSync(path.join(repoRoot, KIT), 'utf8');

const INK = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="1.5 1.75 29 29"><g fill="currentColor"><rect x="2" y="2" width="28" height="28"/></g></svg>';
const OWN = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="4.5 4.5 23 23"><path fill="#2563eb" d="M5 5 H27 V27 Z"/></svg>';

const { window } = makeWindow();
const reads = [];
const files = {
  'me/a:.web-tools.json': JSON.stringify({ icon: 'ph-house', mark: 'icon.svg', tone: 'orange' }),
  'me/a:icon.svg': INK,
  'me/hub:marks/b.svg': OWN,
  'me/c:.web-tools.json': JSON.stringify({ group: 'core' }),
  'me/d:bad.svg': '<html><script>alert(1)</script></html>',
};
window.GH = class {
  constructor(conf = {}) { this.repo = conf.repo; this.conf = conf; }
  async get(p) {
    reads.push(this.repo + ':' + p + ('ref' in this.conf ? '@' + this.conf.ref : ''));
    const t = files[this.repo + ':' + p];
    if (t == null) throw Object.assign(new Error('404'), { status: 404 });
    return { text: t };
  }
};
// vanilla-bundle first, as gh-boot orders it: html() escapes through window.esc.
new window.Function(readFileSync(path.join(repoRoot, 'lib/vanilla-bundle.js'), 'utf8'))();
new window.Function(src)();
const M = window.RepoMark;
const classes = (html) => (html.match(/class="([^"]*)"/) || [])[1].split(/\s+/);
const weightsIn = (html) => classes(html).filter((c) => Object.values(M.WEIGHTS).includes(c));
const coloursIn = (html) => classes(html).filter((c) => /^text-(?!base$|lg$|xl$|sm$|\[)/.test(c));

test('a manifest with only an icon draws the glyph it always drew', () => {
  const out = M.html(M.spec({ icon: 'ph-lightning' }, 'me/x'));
  assert.match(out, /^<i class="ph ph-lightning /);
  assert.deepEqual(coloursIn(out), [], 'no colour, so the surrounding text colour and its hover reach it');
  assert.match(M.html(M.spec({}, 'me/x')), /ph ph-bookmark-simple/, 'none declared: the neutral glyph');
  assert.equal(M.spec({}, 'me/x').declared, false);
  assert.equal(M.spec({ icon: 'lib/x.svg' }).glyph, M.NEUTRAL, 'a path is never a glyph');
});

test('a tone draws duotone in that tone, and any weight can be asked for', () => {
  const toned = M.spec({ icon: 'ph-lightning', tone: 'yellow' });
  assert.equal(toned.weight, 'duotone');
  assert.deepEqual(weightsIn(M.html(toned)), ['ph-duotone']);
  assert.deepEqual(coloursIn(M.html(toned)), ['text-yellow-500']);
  for (const w of Object.keys(M.WEIGHTS)) {
    assert.deepEqual(weightsIn(M.html(M.spec({ icon: 'ph-house', tone: 'sky', weight: w }))), [M.WEIGHTS[w]],
      w + ': exactly one weight class');
  }
  const odd = M.spec({ icon: 'ph-house', tone: 'chartreuse', weight: 'heavy' });
  assert.deepEqual([odd.tone, odd.weight], ['', 'regular'], 'an unknown tone or weight falls back, untoned');
});

test('one colour is written: tint over tone over the caller\'s resting colour', () => {
  const s = M.spec({ icon: 'ph-house', tone: 'rose' });
  assert.deepEqual(coloursIn(M.html(s, { color: 'text-primary' })), ['text-rose-600']);
  assert.deepEqual(coloursIn(M.html(s, { tint: 'text-success' })), ['text-success']);
  assert.deepEqual(coloursIn(M.html(M.spec({ icon: 'ph-house' }), { color: 'text-primary' })), ['text-primary']);
});

test('the palette is spelled out in full, so a baked page keeps every tone', () => {
  // The browser build compiles any class it sees; a bake compiles only the
  // classes its source names. A tone assembled from parts would bake to nothing.
  for (const [k, cls] of Object.entries(M.TONES)) {
    assert.match(cls, /^text-[a-z]+-[1-9]00$/, k);
    assert.ok(src.includes("'" + cls + "'"), k + ' is a literal in the kit');
  }
});

test('a mark path resolves in its own repository, or where it names', () => {
  assert.deepEqual({ ...M.markRef('lib/favicon.svg', 'me/a') }, { repo: 'me/a', ref: '', path: 'lib/favicon.svg' });
  assert.deepEqual({ ...M.markRef('me/hub@dev:docs/b.svg', 'me/a') }, { repo: 'me/hub', ref: 'dev', path: 'docs/b.svg' });
  assert.equal(M.markRef('ph-house', 'me/a'), null, 'only an .svg is a mark');
  assert.equal(M.markRef('notes.md', 'me/a'), null);
});

test('only an SVG document is drawable, and currentColor decides the ink', () => {
  assert.equal(M.drawable(INK).ink, true);
  assert.equal(M.drawable(OWN).ink, false);
  assert.match(M.drawable(OWN).src, /^data:image\/svg\+xml;charset=utf-8,/);
  assert.equal(M.drawable('<html><body>no</body></html>'), null);
  assert.equal(M.drawable('<svg><g></svg>'), null, 'a parse error');
  assert.equal(M.drawable('<svg xmlns="http://www.w3.org/2000/svg">' + ' '.repeat(70000) + '</svg>'), null, 'too large');
});

test('a drawn mark: blank while read, a mask in one ink, an image in its own colours', async () => {
  const s = M.spec({ icon: 'ph-house', mark: 'icon.svg', tone: 'orange' }, 'me/a');
  assert.match(M.html(s), /^<span class="inline-block size-\[1em\] shrink-0 text-base" aria-hidden="true"><\/span>$/,
    'the slot holds its width and draws nothing yet');
  const ink = await M.load(s);
  const out = M.html(ink);
  assert.match(out, /bg-current \[mask:var\(--mark\)_center\/contain_no-repeat\]/, 'a one-ink file is a mask, filling the slot');
  assert.deepEqual(coloursIn(out), ['text-orange-600'], 'painted in the tone');
  const own = await M.load(M.spec({ icon: 'ph-toolbox', mark: 'me/hub:marks/b.svg', tone: 'blue' }, 'me/a'));
  assert.match(M.html(own), /^<img src="data:image\/svg\+xml/, 'a file with its own fills keeps them');
  assert.match(M.html(own, { tint: 'text-error' }), /\[mask:.*text-error/, 'unless a state colours it');
});

test('an SVG that cannot be read, or is not an SVG, draws the glyph', async () => {
  const gone = await M.load(M.spec({ icon: 'ph-scales', mark: 'nope.svg' }, 'me/z'));
  assert.equal(gone.svg, null);
  assert.match(M.html(gone), /ph ph-scales/);
  const bad = await M.load(M.spec({ mark: 'bad.svg' }, 'me/d'));
  assert.match(M.html(bad), /ph ph-bookmark-simple/, 'no glyph declared either: the neutral one');
  assert.ok(!M.html(bad).includes('script'));
});

test('each file and each manifest is read once, at the page\'s selection', async () => {
  reads.length = 0;
  const [a1, a2] = await Promise.all([M.of('me/a'), M.of('me/a')]);
  await M.load(M.spec({ mark: 'icon.svg' }, 'me/a'));
  await tick();
  assert.equal(a1, a2);
  assert.deepEqual([a1.glyph, a1.tone, !!a1.svg.ink], ['ph-house', 'orange', true], 'the manifest, its mark read');
  // icon.svg was read by the earlier test, which is the memo working.
  assert.deepEqual(reads, ['me/a:.web-tools.json'], 'no ref named, so refs= and ?use= decide');
  assert.equal(await M.of('me/c'), null, 'a manifest declaring no icon or mark is null, for the caller to count');
  assert.equal(await M.of('me/missing'), null);
  await M.load(M.spec({ mark: 'me/hub@dev:marks/b.svg' }, 'me/a'));
  assert.ok(reads.includes('me/hub:marks/b.svg@dev'), 'a ref the path names is the ref read');
});

// ── The render sites ────────────────────────────────────────────────────────
// THE GATE. Every place that draws a repository's mark goes through the kit, so
// a new site that reaches for `class="ph" :class="<a repo's icon>"` again is
// the drift this file exists to end. Listed by the expressions that hold a
// repository's icon in each file; the Map (map.js) still paints the hub's drawn
// marks itself and is outside the gate until it moves.
test('no render site draws a repository mark around the kit', () => {
  const sites = {
    'lib/alpineComponents/session-brief.js': [/:class="marks\[/, /:class="g\.icon"/],
    'lib/alpineComponents/estate.js': [/:class="repoIcon\(/, /:class="face\(e\)\.icon"/, /:class="e\.icon"/,
                                       /'<i class="ph[^']*'\s*\+[^;]*repoIcon\(/],
    'app/index.html': [/:class="r\.icon"/, /x-show="!?repoMarkSrc\(r\.repo\)"/],
  };
  const found = [];
  for (const [file, pats] of Object.entries(sites)) {
    const text = readFileSync(path.join(repoRoot, file), 'utf8');
    for (const re of pats) if (re.test(text)) found.push(file + ': ' + re);
  }
  assert.deepEqual(found, [], 'draw it with RepoMark.html (the component\'s markHtml or repoMarkHtml)');
});
