// lib/gh-boot.js — the boot step that tells Tailwind daisyUI's colours are
// colours.
//
// WHY IT EXISTS. Pages here load daisyUI as a prebuilt stylesheet next to
// Tailwind's browser JIT, so the two share no theme registry. daisyUI ships
// each colour's `hover:` rule at full opacity only and no `group-hover:` rules
// at all, and Tailwind, never told that `primary` names a colour, cannot
// compose one with an opacity modifier. The result is that a theme colour with
// an opacity modifier generates NOTHING under a variant: `bg-primary/10` paints
// and `hover:bg-primary/10` does not. Measured in Chromium either side of a
// real hover; 103 live instances across 16 files were silently dead.
//
// What is pinned here is the pair of invariants a reader cannot see by looking
// at either file alone: the registration must cover every colour the
// dead-opacity scanner knows about, and it must use `@theme inline`. Inline is
// load-bearing rather than stylistic, so it gets its own assertion.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const boot = readFileSync(path.join(repoRoot, 'lib', 'gh-boot.js'), 'utf8');
const scanner = readFileSync(path.join(repoRoot, 'scripts', 'dead-opacity.py'), 'utf8');

const registered = () => {
  const block = boot.match(/const NAMES = \[([\s\S]*?)\];/);
  assert.ok(block, 'gh-boot declares a NAMES list for the theme registration');
  return new Set([...block[1].matchAll(/'([a-z0-9-]+)'/g)].map(m => m[1]));
};

const known = () => {
  const block = scanner.match(/THEME_COLOURS = \[([\s\S]*?)\]/);
  assert.ok(block, 'the scanner declares THEME_COLOURS');
  return new Set([...block[1].matchAll(/'([a-z0-9-]+)'/g)].map(m => m[1]));
};

test('the registration covers every theme colour the scanner knows about', () => {
  const have = registered(), want = known();
  const missing = [...want].filter(c => !have.has(c));
  assert.deepEqual(missing, [],
    'a colour the scanner polices but the boot never registers is dead again under ' +
    'every variant, silently, which is the whole bug this step exists to close');
});

test('it registers nothing the scanner does not police, so the two lists stay one list', () => {
  const have = registered(), want = known();
  const extra = [...have].filter(c => !want.has(c));
  assert.deepEqual(extra, [],
    'an extra name is not harmful, but the lists drifting apart is how the ' +
    'missing-colour check above stops meaning anything');
});

test('the block is @theme inline, which is what keeps daisyUI in charge of the values', () => {
  assert.match(boot, /@theme inline \{/,
    'a plain @theme publishes these names at :root and fights the theme it describes; ' +
    'inline emits no value of its own, so daisyUI per-theme rules keep winning');
  assert.doesNotMatch(boot, /@theme \{/);
});

test('it is self-referencing, so no colour value is restated in this repo', () => {
  assert.match(boot, /--color-' \+ n \+ ': var\(--color-' \+ n \+ '\)/,
    'the registration names the colours and never their values: a literal here ' +
    'would be a second source for something daisyUI owns');
});

test('it runs in the shared boot rather than in page heads', () => {
  // 79 pages load Tailwind and daisyUI, and almost every dead class lives in a
  // component that renders into whichever page hosts it. One boot step reaches
  // all of them; 79 head edits would reach the ones somebody remembered.
  assert.match(boot, /gh-daisy-theme/);
  assert.match(boot, /document\.head\.appendChild\(style\)/);
});
