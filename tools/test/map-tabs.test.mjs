// lib/alpineComponents/map.js — the Map view's tab strip, and the one sentence
// each tab opens with.
//
// WHAT THIS HOLDS is a writing convention, which is an unusual thing to gate, so
// the reason has to be exact. Before 2026-08-31 eleven of the twelve views opened
// straight into cards with nothing saying what the cards were, and the twelfth
// opened with three sentences whose last one was mechanics. The Owners tab had a
// framing sentence and it was deleted on 2026-08-26 under the repo's own rule
// against prose that describes state, on the argument that "the cards say what
// the registry holds". That argument is wrong in a way worth catching: the cards
// say what a ROW is and never what the SET is, and a reader arriving cold needs
// the second one first.
//
// So the convention is narrow enough to be checkable. A lede says what the tab's
// rows ARE. It never says what the reader can do with them, which is the line
// between a lede and a manual, and it is the line prose on a page crosses when it
// starts to rot. The shape assertions below are the whole of it: one sentence,
// bounded, no second person, no imperative pointing at a control.
//
// The sentences live in docs/map-tabs.csv, one row per address, since
// 2026-09-28; the keys, labels and icons stay in the TABS and SUBVIEWS arrays the
// strip is generated from. A tab still cannot be added without a sentence, but
// the reason is now a gate rather than a shared literal: the CSV's row set must
// equal the shell's MAP_ROUTES in both directions. That is the load-bearing part:
// a convention nothing renders from is a convention that lasts one session.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';
import { parseCsv } from '../build/registries-load.mjs';

const src = readFileSync(path.join(repoRoot, 'lib', 'alpineComponents', 'map.js'), 'utf8');
const shell = readFileSync(path.join(repoRoot, 'app', 'index.html'), 'utf8');
const ROWS = parseCsv(readFileSync(path.join(repoRoot, 'docs', 'map-tabs.csv'), 'utf8'));

// The literals live in a component that needs a browser to evaluate, so read
// just their source blocks. Scoping matters now that Purpose, Growth, and Tests
// are addressable subviews rather than entries in the top-level strip.
const tabsBlock = src.match(/TABS:\s*\[([\s\S]*?)\r?\n\s*\],\r?\n\s*SUBVIEWS:/)?.[1] || '';
const subviewsBlock = src.match(/SUBVIEWS:\s*\{([\s\S]*?)\r?\n\s*\},\r?\n\s*SUBVIEW_PARENT:/)?.[1] || '';
const optionPattern = /\{ k: '([a-z]+)', n: '([A-Za-z]+)', i: '(ph-[a-z-]+)'/g;
const TABS = [...tabsBlock.matchAll(optionPattern)].map(m => ({ k: m[1], n: m[2], i: m[3] }));
const SUBVIEWS = [...subviewsBlock.matchAll(optionPattern)]
  .map(m => ({ k: m[1], n: m[2], i: m[3] }));
const parentBlock = src.match(/SUBVIEW_PARENT:\s*\{([^}]+)\}/)?.[1] || '';
const SUBVIEW_PARENT = Object.fromEntries(
  [...parentBlock.matchAll(/(?:^|,)\s*([a-z]+): '([a-z]+)'(?=\s*(?:,|$))/g)]
    .map(m => [m[1], m[2]]));
// One lede per address, named by its key: the same string the shell validates
// ?tab= against, so a failure names the address a reader would type.
const LEDES = ROWS.map(r => ({ n: r.tab, g: r.gloss, narrative: r.narrative }));
const routeKeys = name => (shell.match(new RegExp(`const ${name} = \\[([^\\]]+)\\]`))?.[1] || '')
  .split(',').map(x => x.trim().replace(/'/g, '')).filter(Boolean);
const MAP_ROUTES = [...routeKeys('MAP_TABS'), ...routeKeys('MAP_SUBVIEWS')];

test('every tab in the strip is one entry in the array that generates it', () => {
  // 12 to 13 on 2026-09-05: the Kits tab. 13 to 14 on 2026-09-08: the Views tab.
  // 14 to 13 on 2026-09-09: the Injection tab retired with the injection hook,
  // which is the Routes pane arriving from the Activity view. It reads one
  // repo's own registry about one repo's own destinations, which is what every
  // other tab in this strip already does.
  // 13 to 11 on 2026-09-11: Growth moved inside Docs and Tests inside Harness.
  // 11 to 12 on 2026-09-27: Context left Harness to become its own tab.
  // 11 to 10: Aims became Docs/Purpose, still addressable as ?tab=aims.
  // 10 to 11: Data aggregates the declared CSV inventories.
  assert.equal(TABS.length, 13, 'thirteen top-level tabs, or this test is reading the wrong literal');
  // 5 to 6 on 2026-10-01: Policy joined Docs, the rules the documentation settles.
  assert.equal(SUBVIEWS.length, 6, 'Docs carries four choices and Harness two');
  assert.deepEqual(SUBVIEW_PARENT, { aims: 'docs', growth: 'docs', policy: 'docs', tests: 'harness' });
  assert.deepEqual(SUBVIEWS.slice(0, 3).map(s => [s.k, s.n]),
    [['docs', 'Inventory'], ['aims', 'Purpose'], ['growth', 'Growth']],
    'Docs leads with its inventory; Purpose and Growth keep their established route keys');
  // One x-for per level, not hand-copied buttons: the copies are what let a tab
  // ship without a sentence, and what let the Injection tab ship without an icon.
  const buttons = src.match(/role="tab" @click="setTab\(/g) || [];
  assert.equal(buttons.length, 2, 'the top-level strip and subview strip each generate one button shape');
  assert.match(src, /<template x-for="t in TABS"/, 'the strip loops over the array');
  assert.match(src, /<template x-for="s in subviews"/, 'the nested strip loops over the current parent subviews');
  assert.match(src, /@click="setTab\(t\.k\)"/,
    'a top-level stop opens its own route, so Docs opens Inventory');
  assert.match(src, /displayTab === t\.k/, 'a selected subview keeps its parent highlighted');
  assert.match(src, /x-for="\(s, i\) in ledeParts"/, 'the lede is rendered from the selected tab, in runs');
});

test('docs/map-tabs.csv holds one row per Map address, and no other', () => {
  assert.ok(MAP_ROUTES.length >= 15, 'MAP_ROUTES parsed short: ' + MAP_ROUTES.length);
  const keys = ROWS.map(r => r.tab);
  assert.equal(new Set(keys).size, keys.length, 'a tab key appears twice');
  assert.deepEqual([...keys].sort(), [...MAP_ROUTES].sort(),
    'every address the shell accepts has a row, and every row is an address');
  for (const r of ROWS) assert.ok(r.narrative, `${r.tab}: no narrative`);
});

test('the lede comes from the CSV and links to its own row', () => {
  assert.doesNotMatch(tabsBlock + subviewsBlock, /\bg: '/,
    'a sentence is back in the array; it belongs in docs/map-tabs.csv');
  assert.match(src, /const TAB_LEDES = 'docs\/map-tabs\.csv'/);
  assert.match(src, /get tabGloss\(\)\{ return this\.tabLedes\?\.\[this\.mapTab\]\?\.gloss/,
    'one row per address, so the lede is a lookup with no parent fallback');
  // A landing, not a filter: the sentence is read among the others, so every
  // row stays and this one is scrolled to and marked.
  assert.match(src, /openFile\(TAB_LEDES, \{ col: 'tab', row: this\.mapTab \}\)/,
    'the link lands on the row among the others');
});

test('the Map description points at the CSV instead of restating it', () => {
  const desc = src.match(/description: '((?:[^'\\]|\\.)*)'/)?.[1] || '';
  assert.match(desc, /docs\/map-tabs\.csv/);
});

test('a narrative is bounded, so the manual does not regrow in a cell', () => {
  for (const t of LEDES) {
    const words = t.narrative.split(/\s+/).length;
    assert.ok(words <= 120, `${t.n}: narrative is ${words} words; cut it or move it to docs/views/map.md`);
  }
});

test('reader labels clarify the stable route keys', () => {
  const distribution = TABS.find(t => t.k === 'set');
  assert.ok(distribution, 'the long-lived ?tab=set route remains declared');
  assert.equal(distribution.n, 'Distribution',
    'the reader sees the cross-repository purpose rather than the internal Portable name');

  const kits = ROWS.find(r => r.tab === 'kits');
  assert.match(kits?.gloss || '', /browser JavaScript/i,
    'the Kits lede names the runtime that distinguishes a kit from a standalone script');
  assert.match(kits?.gloss || '', /lib\/kits\/\*\.js/,
    'the lede names the exact shelf boundary the kits registry builds');
});

// View-local searches are siblings under mapTab, so only one has layout at a
// time. That keeps the shell's first-visible data-find-box rule deterministic
// while letting each large inventory use the same `/` interaction.
const sectionSource = (key) => {
  const start = src.indexOf(`<section x-show="mapTab==='${key}'">`);
  if (start < 0) return '';
  const end = src.indexOf('</section>', start);
  return src.slice(start, end < 0 ? undefined : end);
};

test('Distribution is a searchable delivery crosswalk, not a second artifact inventory', () => {
  const section = sectionSource('set');
  assert.ok(section, 'the stable set route has a section');
  assert.match(section, /<input\b[^>]*\bdata-find-box\b[^>]*\bx-model="setQ"/s,
    'Distribution participates in the app-wide finder convention');
  assert.match(section, /x-for="sec in setSections"/,
    'delivery-mode groups come from the component rather than duplicated markup');
  assert.match(section, /kindLabel\(it\)/,
    'each cross-kind row says whether it is a skill, document, directory, or standalone tool');
  assert.match(section, /openSetOwner\(it\)/,
    'a row can cross-reference the owning Skills, Docs, or Automation inventory');
});

test('Docs Inventory carries its own scoped finder', () => {
  const section = sectionSource('docs');
  assert.ok(section, 'the Inventory route has a section');
  assert.match(section, /<input\b[^>]*\bdata-find-box\b[^>]*\bx-model="docQ"/s,
    'Inventory exposes the same visible search contract as Skills and Distribution');
  assert.match(section, /@input="docSearchDir = ''"/,
    'typing starts corpus-wide; choosing a folder is a separate, explicit scope');
});

test('every tab key the view dispatches on has an entry', () => {
  // x-show="mapTab==='k'" is how each section decides to render, so the set of
  // keys in the markup is the set of tabs that exist, whatever the array claims.
  const shown = new Set([...src.matchAll(/x-show="mapTab==='([a-z]+)'"/g)].map(m => m[1]));
  const declared = new Set([...TABS.map(t => t.k), ...Object.keys(SUBVIEW_PARENT)]);
  for (const [child, parent] of Object.entries(SUBVIEW_PARENT))
    assert.ok(TABS.some(t => t.k === parent), `${child} names missing top-level parent ${parent}`);
  for (const k of shown) assert.ok(declared.has(k), `section "${k}" has no top-level or subview route`);
  for (const k of declared) assert.ok(shown.has(k), `route "${k}" has no section`);
});

test('every icon is a name the installed Phosphor carries', () => {
  // The Injection tab shipped a blank glyph for want of this. blank-icons.py
  // scans the file wholesale; this holds the array specifically, so a bad name
  // fails beside the tab it belongs to.
  const sheet = readFileSync(
    path.join(repoRoot, 'node_modules', '@phosphor-icons', 'web', 'src', 'regular', 'style.css'), 'utf8');
  const carried = new Set([...sheet.matchAll(/\.ph\.ph-([a-z0-9-]+)/g)].map(m => m[1]));
  for (const t of [...TABS, ...SUBVIEWS])
    assert.ok(carried.has(t.i.slice(3)), `${t.n}: ${t.i} is not an icon the font carries`);
});

test('a lede is one sentence and stays one', () => {
  for (const t of LEDES) {
    assert.ok(t.g, `${t.n}: no lede`);
    // Sentence-final punctuation, counted outside the abbreviations and decimals
    // that would otherwise read as an end.
    const ends = (t.g.match(/[.!?](\s|$)/g) || []).length;
    assert.equal(ends, 1, `${t.n}: a lede is one sentence, found ${ends}`);
    assert.match(t.g, /[.!?]$/, `${t.n}: a lede ends in a full stop`);
    assert.match(t.g, /^[A-Z]/, `${t.n}: a lede starts a sentence`);
  }
});

test('a lede is bounded, because the ones that rot are the ones that grew', () => {
  for (const t of LEDES) {
    const words = t.g.split(/\s+/).length;
    assert.ok(words >= 12, `${t.n}: ${words} words is a label, not a lede`);
    assert.ok(words <= 30, `${t.n}: ${words} words; say what the rows are and stop`);
  }
});

test('a lede says what the rows are, never what the reader can do', () => {
  // The line between a lede and a manual. Second person and control-naming are
  // the two ways the second one gets in, and both are mechanical to spot.
  const forbidden = [
    [/\byou\b|\byour\b/i, 'second person'],
    [/\buse (this|it|the)\b/i, 'telling the reader to use something'],
    [/\bclick\b|\btap\b|\bdrag\b|\bselect\b/i, 'naming an interaction'],
    [/\bbelow\b|\babove\b|\bthis (tab|view|page)\b/i, 'pointing at the page it sits on'],
    [/\bhere\b/i, 'deixis; the lede should read away from its own placement'],
  ];
  for (const t of LEDES)
    for (const [re, why] of forbidden)
      assert.doesNotMatch(t.g, re, `${t.n}: ${why} — a lede states its subject`);
});

test('the ledes are distinct, so none is a template somebody filled in', () => {
  const opens = LEDES.map(t => t.g.split(/\s+/).slice(0, 3).join(' ').toLowerCase());
  assert.equal(new Set(opens).size, opens.length,
    'two ledes open with the same three words; write the second one about its own subject');
});

// A lede's links are data beside the sentence: `refs` is phrase=path pairs,
// separated by ';'. Every phrase must occur in the sentence verbatim, or the
// link silently never renders; every path must exist, or it opens nothing. A
// folder ends in '/' because it opens the tree, not a file.
test("a lede's links name phrases it contains and paths that exist", () => {
  for (const r of ROWS) {
    const pairs = (r.refs || '').split(';').filter(Boolean);
    assert.ok(pairs.length <= 3, `${r.tab}: ${pairs.length} links; a lede is a sentence, not an index`);
    let last = -1;
    for (const p of pairs) {
      const i = p.indexOf('=');
      assert.ok(i > 0, `${r.tab}: '${p}' is not phrase=path`);
      const [ph, to] = [p.slice(0, i), p.slice(i + 1)];
      const at = r.gloss.indexOf(ph);
      assert.ok(at >= 0, `${r.tab}: '${ph}' is not in the lede`);
      assert.ok(at > last, `${r.tab}: '${ph}' overlaps or precedes the link before it`);
      last = at + ph.length - 1;
      assert.ok(existsSync(path.join(repoRoot, to.replace(/\/$/, ''))), `${r.tab}: ${to} does not exist`);
    }
  }
});
