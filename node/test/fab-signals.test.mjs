// docs/fab-signals.csv: what the FAB says about the view in front of the
// reader, one row per tint, glyph and badge. The Map's FAB tab renders every
// row, and docs/fab.md points there rather than restating it.
//
// A live row is held to the FAB's own markup in lib/alpineComponents/fab.js,
// in both directions: its glyph, its colour and its corner must be what the
// markup draws, and every glyph the markup draws must have a live row, so a
// signal cannot be added to the FAB, or built from a proposal, without the
// table saying what it means. A proposed row is held only to its shape: a
// Phosphor class that exists, or a drawn SVG that does.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';
import { parseCsv } from '../build/registries-load.mjs';

const rows = parseCsv(readFileSync(path.join(repoRoot, 'docs', 'fab-signals.csv'), 'utf8'));
const fab = readFileSync(path.join(repoRoot, 'lib', 'alpineComponents', 'fab.js'), 'utf8');
const phosphor = readFileSync(path.join(repoRoot, 'node_modules', '@phosphor-icons', 'web', 'src', 'regular', 'style.css'), 'utf8');

// The FAB's markup: from its button's label to the menu that follows it.
const start = fab.indexOf(`'Note the selected text' : 'Web-tools panel'`);
const end = fab.indexOf(`<!-- The launcher's second gesture`);
const markup = fab.slice(start, end);
const live = rows.filter(r => r.status === 'live');
const CORNER = { 'top-right': /-top-[\d.]+ -right-[\d.]+/, 'bottom-right': /-bottom-[\d.]+ -right-[\d.]+/ };

test('the FAB markup is where the gate looks for it', () => {
  assert.ok(start > 0 && end > start, 'the FAB button and the menu after it are both found in fab.js');
});

test('every glyph the FAB draws has a live row', () => {
  const drawn = [...new Set([...markup.matchAll(/\bph (ph-[a-z-]+)/g)].map(m => m[1]))];
  assert.ok(drawn.length >= 5, 'the markup draws the glyphs it is known to');
  for (const c of drawn) assert.ok(live.some(r => r.icon === c), `${c} is drawn by the FAB but no live row says what it means`);
});

test('a live glyph or badge is drawn where its row says', () => {
  for (const r of live.filter(r => r.icon)) {
    const at = markup.indexOf('ph ' + r.icon);
    assert.ok(at > 0, `${r.key}: the FAB draws ${r.icon}`);
    if (!CORNER[r.part]) continue;
    // The badge's own element: the nearest opening tag before its icon that
    // places something in a corner.
    const tag = markup.slice(0, at).split(/<(?=div|button)/).reverse().find(t => /-right-/.test(t)) || '';
    assert.match(tag, CORNER[r.part], `${r.key}: its badge sits in the ${r.part} corner`);
    assert.ok(tag.includes('bg-' + r.tone), `${r.key}: its badge is drawn in ${r.tone}`);
  }
});

test('a live tint is a colour the FAB wears', () => {
  for (const r of live.filter(r => r.part === 'tint'))
    assert.ok(markup.includes(`var(--color-${r.tone})_10%,var(--color-base-100))] border-${r.tone}/20`), `${r.key}: the FAB is tinted ${r.tone} at rest`);
});

test('a glyph or badge names a mark that exists, and a tint names none', () => {
  for (const r of rows) {
    if (r.part === 'tint') { assert.equal(r.icon, '', `${r.key}: a tint has no mark`); continue; }
    if (r.icon.endsWith('.svg')) assert.ok(existsSync(path.join(repoRoot, r.icon)), `${r.key}: ${r.icon} exists`);
    else assert.ok(phosphor.includes(`.${r.icon}:before`), `${r.key}: ${r.icon} is a Phosphor glyph`);
  }
});

// The FAB tab lists each signal by its label; the meaning, when and note are
// on the signal's card.
test('a signal\'s tile fits: a label of two words and a meaning of five', () => {
  const words = v => String(v || '').split(/\s+/).filter(Boolean).length;
  for (const r of rows) {
    assert.ok(words(r.label) <= 2, `${r.key}: label "${r.label}" runs past two words`);
    assert.ok(words(r.gloss) <= 5, `${r.key}: gloss "${r.gloss}" runs past five words`);
  }
});
