// lib/alpineComponents/map.js: the Map view's tab strip, and the one sentence
// each address has for what its rows are.
//
// WHAT THIS HOLDS is a writing convention, which is an unusual thing to gate, so
// the reason has to be exact. Before 2026-08-31 eleven of the twelve views opened
// straight into cards with nothing saying what the cards were. The cards say
// what a ROW is and never what the SET is, and a reader arriving cold needs the
// second one first. So every address has one sentence that says what its rows
// ARE, and never what the reader can do with them, which is the line between a
// description and a manual. The shape assertions below are the whole of it: one
// sentence, bounded, no second person, no imperative pointing at a control.
//
// WHERE IT SHOWS changed on 2026-10-12, by the owner's decision on PR #889. It
// used to head each tab; now the tab's controls and counts lead, and the
// sentence opens with the tab's files and builders in Sources and methods. The
// need it answers did not change, so it is still required of every address,
// and the reader arriving cold now meets every set at once: the Overview, the
// Map's front door, lists each address under its tab with this sentence.
//
// The sentences live in docs/map-tabs.csv, one row per address, since
// 2026-09-28. A tab still cannot be added without one, because the CSV's row set
// must equal the shell's MAP_ROUTES in both directions.

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
// The same block read per tab, the way node/ui-units.mjs reads it to label a
// unit: each group's key, then its options in strip order.
const SUBVIEW_GROUPS = [...subviewsBlock.matchAll(/(\w+):\s*\[([\s\S]*?)\]/g)]
  .map(m => ({ parent: m[1], options: [...m[2].matchAll(optionPattern)].map(o => [o[1], o[2]]) }));
// Addresses a subview draws inside itself (Automation's trigger views), each
// with the subview that hosts it.
const withinBlock = src.match(/WITHIN:\s*\[([\s\S]*?)\r?\n\s*\],/)?.[1] || '';
const WITHIN = [...withinBlock.matchAll(/\{ k: '([a-z]+)', n: '([^']+)', i: '(ph-[a-z-]+)', host: '([a-z]+)' \}/g)]
  .map(m => ({ k: m[1], n: m[2], i: m[3], host: m[4] }));
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

// The grouping the owner settled on 2026-10-07 (discussion around PR #887),
// in strip order, each tab with its subviews in strip order as [address key,
// label]. Every key but `reach` predates that regroup, so a published
// ?view=map&tab=<key> link still lands on the reading it named; `reach` is the
// routes diagram, added after it. Overview leads the strip since 2026-10-12.
// Since 2026-10-13 the Map has two doors: Overview (what the hub is and holds:
// Contents and Purpose) and Reach (what it covers: the routes diagram, which
// Reach lands on and so shares its key with, then Projects, Distribution,
// Outposts and Data).
const GROUPS = [
  ['Overview', [['overview', 'Contents'], ['aims', 'Purpose']]],
  ['Reach', [['reach', 'Routes'], ['projects', 'Projects'], ['distribution', 'Distribution'], ['outposts', 'Outposts'], ['data', 'Data']]],
  ['Research', [['research', 'Probes'], ['exploration', 'Exploration']]],
  ['Harness', [['harness', 'Automation'], ['set', 'Set'], ['tests', 'Tests'], ['skills', 'Skills'], ['agents', 'Agents'], ['peeves', 'Peeves'], ['context', 'Context'], ['lifetimes', 'Lifetimes'], ['surfacing', 'Surfacing']]],
  ['Browser', [['dimensions', 'Dimensions'], ['patterns', 'Gallery'], ['views', 'Views'], ['kits', 'Kits'], ['showing', 'Showing']]],
  ['Docs', [['docs', 'Inventory'], ['growth', 'Growth'], ['policy', 'Policy'], ['claims', 'Themes'], ['registries', 'Registries']]],
];

test('an address drawn inside a subview is routable and names a host on the strip', () => {
  assert.deepEqual(WITHIN.map(w => w.k), ['hooks', 'scheduled']);
  for (const w of WITHIN) {
    assert.ok(MAP_ROUTES.includes(w.k), `${w.k} is a shell route`);
    assert.ok(SUBVIEWS.some(v => v.k === w.host), `${w.k} is hosted by ${w.host}, a subview on the strip`);
    assert.ok(!SUBVIEWS.some(v => v.k === w.k), `${w.k} is not also a stop on the strip`);
  }
});

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
  // 13 to 4 on 2026-10-07: every address regrouped under GROUPS above.
  // 6 to 7 on 2026-10-12: Overview, the front door, leads the strip.
  // 7 to 6 on 2026-10-13: two doors. Purpose joined Overview, and Projects
  // joined Routes, Distribution, Outposts and Data under Reach.
  assert.equal(TABS.length, 6, 'six top-level tabs, Overview first and Reach second');
  assert.deepEqual(TABS.map(t => t.n), GROUPS.map(([n]) => n), 'the tabs, by label, in strip order');
  assert.deepEqual(SUBVIEW_GROUPS.map(g => [TABS.find(t => t.k === g.parent)?.n, g.options]), GROUPS,
    'each tab carries exactly its subviews, in order, under their established keys');
  for (const t of TABS)
    assert.equal(t.k, SUBVIEW_GROUPS.find(g => g.parent === t.k)?.options[0][0],
      `${t.n} shares its key with the subview it lands on`);
  // The parent map restates SUBVIEWS for the lookup displayTab makes, so it
  // must say exactly what the groups say, and nothing for a landing subview.
  const parents = Object.fromEntries(SUBVIEW_GROUPS.flatMap(g => g.options.slice(1).map(([k]) => [k, g.parent])));
  // 2026-10-20: Scheduled left the strip for Automation's trigger row, beside
  // the new Claude Code events view; both keep a top-level parent.
  for (const w of WITHIN) parents[w.k] = SUBVIEW_GROUPS.find(g => g.options.some(([k]) => k === w.host)).parent;
  assert.deepEqual(SUBVIEW_PARENT, parents, 'SUBVIEW_PARENT agrees with SUBVIEWS and WITHIN');
  assert.deepEqual(routeKeys('MAP_TABS'), TABS.map(t => t.k), 'the shell lists the tabs in strip order');
  // One x-for per level, not hand-copied buttons: the copies are what let a tab
  // ship without a sentence, and what let the Injection tab ship without an icon.
  const buttons = src.match(/role="tab" @click="setTab\(/g) || [];
  assert.equal(buttons.length, 2, 'the top-level strip and subview strip each generate one button shape');
  assert.match(src, /<template x-for="t in TABS"/, 'the strip loops over the array');
  assert.match(src, /<template x-for="s in subviews"/, 'the nested strip loops over the current parent subviews');
  assert.match(src, /@click="setTab\(t\.k\)"/,
    'a top-level stop opens its own route, so Docs opens Inventory');
  assert.match(src, /displayTab === t\.k/, 'a selected subview keeps its parent highlighted');
  assert.match(src, /x-for="\(s, i\) in ledeParts"/, 'the source panel renders the selected description, including its references');
});

// Pill rows stay on one line and scroll sideways. A filter row that wraps
// pushes the list down a line per wrap, which is what the Data tab's
// repository row did until 2026-10-12.
test('no filter row wraps', () => {
  const consts = Object.fromEntries([...src.matchAll(/const (map\w+) = '([^']*)'/g)].map(m => [m[1], m[2]]));
  assert.ok(consts.mapPillStrip, 'mapPillStrip not found as a plain string constant');
  const tags = [...src.matchAll(/<[a-z]+\b[^>]*data-slot="frame:(?:filters|count-chips)"[^>]*>/g)].map(m => m[0]);
  assert.ok(tags.length >= 8, 'filter rows parsed short: ' + tags.length);
  for (const tag of tags) {
    const classes = tag.replace(/\$\{(\w+)\}|' \+ (\w+) \+ '/g, (_, a, b) => ' ' + (consts[a || b] || '') + ' ');
    assert.doesNotMatch(classes, /(^|[\s:"'])flex-wrap\b/, 'a filter row wraps: ' + tag.slice(0, 140));
  }
});

// The house rule puts filters in a header dropdown, never in a chip row that
// consumes the viewport. Until 2026-10-12 a phone held the controls and every
// filter row too, about 310 of the Map pane's 583 pixels at 320 by 640, so the
// held layers are now named and nothing else may join them by accident.
test('a phone holds only the navigation and the current group heading', () => {
  const layers = new Set([...src.matchAll(/data-map-sticky="([a-z]+)"/g)].map(m => m[1]));
  assert.deepEqual([...layers].sort(), ['group', 'nav']);
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
  assert.match(src, /get ledeParts\(\)\{\s+const row = this\.tabLedes\?\.\[this\.mapTab\];/,
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
  const distribution = SUBVIEWS.find(t => t.k === 'distribution');
  assert.ok(distribution, 'Distribution is addressed by its own name');
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
  const section = sectionSource('distribution');
  assert.ok(section, 'the Distribution route has a section');
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

// The band was 12 to 30 words until 2026-10-06, when the owner asked for
// glosses of three to ten words: on a phone the lede sits above every tab's
// content, and the detail it used to carry lives in the row's narrative.
test('a lede is bounded, because the ones that rot are the ones that grew', () => {
  for (const t of LEDES) {
    const words = t.g.split(/\s+/).length;
    assert.ok(words >= 3, `${t.n}: ${words} words is a label, not a lede`);
    assert.ok(words <= 10, `${t.n}: ${words} words; say what the rows are and stop`);
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
