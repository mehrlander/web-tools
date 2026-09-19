// tools/test/assistant-guess.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot, makeWindow } from './bootstrap.mjs';

const GUESS_KIT = 'lib/kits/assistant-guess.js';
const TABLE = 'data/assistant-attribution/branches.csv';

const load = () => {
  const { window } = makeWindow();
  new window.Function(readFileSync(path.join(repoRoot, GUESS_KIT), 'utf8'))();
  return window.assistantGuess;
};

// The check that matters most. feats() exists twice, in Python and in
// JavaScript, and the browser scores with weights the Python fitted. A feature
// that drifts on one side would not throw anywhere; it would quietly score a
// different branch. The generated fixtures carry probabilities computed in
// Python, and this recomputes them here.
test('the JavaScript features reproduce the Python fit', () => {
  const g = load();
  assert.ok(g.MODEL.fixtures.length >= 4, 'the model block carries fixtures');
  for (const f of g.MODEL.fixtures) {
    const p = g.score(f.title, f.slug);
    for (const c of g.MODEL.classes) {
      assert.ok(Math.abs(p[c] - f.p[c]) < 1e-4,
        `${c} on "${f.title}": browser ${p[c].toFixed(4)} vs fitted ${f.p[c]}`);
    }
  }
});

test('a probability distribution, not a score', () => {
  const g = load();
  const p = g.score('fix(thing): do a thing', 'fix-a-thing');
  assert.ok(Math.abs(g.MODEL.classes.reduce((a, c) => a + p[c], 0) - 1) < 1e-9);
  for (const c of g.MODEL.classes) assert.ok(p[c] >= 0 && p[c] <= 1);
});

// Stage 1 is evidence and outranks stage 2, whatever the prose looks like.
test('a harness first commit decides it, whatever the style says', () => {
  const g = load();
  // The real title, not a shortened one: title LENGTH carries as much weight
  // as the conventional-commit head (Gemini writes long, Codex writes short),
  // so trimming this line drops it under the threshold on its own.
  const styled = { name: 'fix/header-container-consistency',
                   subject: 'fix(branch-brief): unify top and bottom containers with matching curved header caps' };
  assert.equal(g.predict(styled).assistant, 'gemini');
  const same = { ...styled, firstAuthor: 'Claude <noreply@anthropic.com>' };
  assert.equal(g.predict(same).assistant, 'claude');
  assert.equal(g.predict(same).basis, 'identity');
});

// The four branches that started this, from 2026-09-18. They are the reason
// the kit exists, so they are the regression: a refit that stops reading them
// as Gemini has lost the thing it was built to catch.
test('the 2026-09-18 unprefixed Gemini branches read as Gemini', () => {
  const g = load();
  const rows = [
    ['feat/rev-arrow-keys-banner-swipe', 'feat(branch-brief): desktop arrow keys, review card banner, and top half swipe'],
    ['fix/top-swipe-and-rev-banner', 'fix(branch-brief): full-width top swipe panels and persistent review card banner'],
    ['fix/header-container-consistency', 'fix(branch-brief): unify top and bottom containers with matching curved header caps'],
    ['fix/rev-pager-pill-and-button-sizes', 'fix(branch-brief): refine container border radius, remove swiper dots, add n/m pill and enlarge buttons'],
  ];
  for (const [name, subject] of rows) {
    const v = g.predict({ name, subject });
    assert.equal(v?.assistant, 'gemini', `${name} should read as gemini`);
    assert.ok(v.p > 0.8, `${name} at ${v.p}`);
    assert.equal(v.basis, 'style');
  }
});

test('it declines rather than guessing at nothing', () => {
  const g = load();
  assert.equal(g.predict(null), null);
  assert.equal(g.predict({ name: '', subject: '' }), null);
  // Whatever the model says about an ambiguous row, a caller must be able to
  // trust that a returned answer cleared the threshold.
  for (const title of ['x', 'update', 'Tabular explorer: interactive Data and Pivot views']) {
    const v = g.predict({ name: 'some-branch', subject: title });
    if (v) assert.ok(v.p >= g.MODEL.threshold, `${title} answered below threshold`);
  }
});

test('every answer carries its grounds', () => {
  const g = load();
  const v = g.predict({ name: 'fix/rev-pager-pill-and-button-sizes',
                        subject: 'fix(branch-brief): refine container border radius, remove swiper dots, add n/m pill' });
  assert.ok(Array.isArray(v.why) && v.why.length, 'a guess names what drove it');
  assert.ok(['identity', 'style'].includes(v.basis));
});

// The scorecard rides in the artifact so a reader meets the model's accuracy
// at the same moment as its answer. These floors are the measured values less
// a margin: a refit that falls under them is a regression worth stopping.
test('the fitted scorecard is present and beats its baseline', () => {
  const g = load();
  const f = g.MODEL.fitted;
  assert.ok(f.examples >= 30, `fitted on ${f.examples} examples`);
  assert.ok(f.loo_accuracy > f.loo_baseline + 0.2,
    `leave-one-out ${f.loo_accuracy} against baseline ${f.loo_baseline}`);
  assert.ok(f.loo_accuracy >= 0.8, `leave-one-out ${f.loo_accuracy}`);
  assert.ok(f.identity_base_rates.claude.harness >= 100, 'stage 1 rests on a real sample');
});

// The training table is the model's structured stage: the weights are derived
// from it and nothing else, so it is committed and its shape is held here.
test('the training table is present and labeled', () => {
  const rows = readFileSync(path.join(repoRoot, TABLE), 'utf8').trim().split('\n');
  assert.equal(rows[0], 'repo,number,head,prefix,label,identity,created,title');
  assert.ok(rows.length > 150, `${rows.length - 1} rows`);
});
