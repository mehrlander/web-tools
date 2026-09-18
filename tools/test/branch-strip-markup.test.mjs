// tools/test/branch-strip-markup.test.mjs: verify toss render page strips,
// changed views routes, and standard data-note tooltips.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

const estateSrc = readFileSync(path.join(repoRoot, 'lib/alpineComponents/estate.js'), 'utf8');
const branchBriefSrc = readFileSync(path.join(repoRoot, 'lib/alpineComponents/branch-brief.js'), 'utf8');
const sessionBriefSrc = readFileSync(path.join(repoRoot, 'lib/alpineComponents/session-brief.js'), 'utf8');

test('estate.js branchRowBody aligns toss render pages with a single leading frisbee icon', () => {
  // Extract branchRowBody definition
  const startMatch = estateSrc.match(/const branchRowBody = \(opts = \{\}\) => `([\s\S]*?)`;\s*return {/);
  assert.ok(startMatch, 'branchRowBody function found in estate.js');
  const body = startMatch[1];

  // 1. Toss render pages strip (branchPageStrip)
  assert.ok(body.includes('branchPageStrip(row).chips.length'), 'has branchPageStrip conditional');
  assert.ok(
    body.includes('data-note="Pages this branch changed, rendered via toss"') &&
    body.includes('data-note-bare>🥏</span>'),
    'has single leading frisbee icon with standard data-note and data-note-bare'
  );
  assert.ok(
    !body.includes('x-text="t.mark"'),
    'does not repeat t.mark (frisbee icon) inside individual page chips'
  );
  assert.ok(
    body.includes(':data-note="t.title" data-note-bare'),
    'uses :data-note and data-note-bare on individual page chips'
  );

  // 2. Changed views strip (branchRoutes)
  assert.ok(body.includes('branchRoutes(row)'), 'has branchRoutes conditional');
  assert.ok(
    body.includes('<i class="ph ph-signpost text-base text-base-content/40 shrink-0"') &&
    body.includes('data-note="Views this branch changes" data-note-bare></i>'),
    'signpost icon carries standard data-note and data-note-bare'
  );
  assert.ok(
    body.includes(':data-note="rt.label + (rt.url ? \', on this branch: \' : \', on main (no tip crawled): \')') &&
    body.includes('+ rt.hits.join(\', \')" data-note-bare'),
    'route chips use :data-note and data-note-bare instead of :title'
  );

  // 3. No title or :title attributes remain in branchRowBody
  const titleAttrMatches = body.match(/\b(?::?title)\s*=/g) || [];
  assert.deepEqual(
    titleAttrMatches,
    [],
    'all title and :title attributes in branchRowBody are replaced with data-note or aria-label'
  );

  // 4. No em dash in branchRowBody
  assert.ok(!body.includes('\u2014'), 'no em dash in branchRowBody');
});

test('branch-brief.js Look row aligns toss render pages and uses data-note tooltips', () => {
  assert.ok(
    branchBriefSrc.includes('data-note="What this branch changes, as something to open" data-note-bare'),
    'signpost icon in branch-brief uses data-note'
  );
  assert.ok(
    branchBriefSrc.includes(':data-note="c.title" data-note-bare'),
    'route chips in branch-brief use :data-note'
  );
  assert.ok(
    branchBriefSrc.includes('data-note="Pages this branch changed, rendered via toss"') &&
    branchBriefSrc.includes('data-note-bare>🥏</span>'),
    'leading frisbee icon before pageChips in branch-brief'
  );
  assert.ok(
    branchBriefSrc.includes(':data-note="t.title" data-note-bare'),
    'page chips in branch-brief use :data-note'
  );
  assert.ok(
    !branchBriefSrc.includes('x-text="t.mark"'),
    'no t.mark repeated in branch-brief page chips'
  );
});

test('session-brief.js page strip aligns toss render pages with leading frisbee icon and data-note', () => {
  assert.ok(
    sessionBriefSrc.includes('data-note="Pages this session changed, rendered via toss"') &&
    sessionBriefSrc.includes('data-note-bare>🥏</span>'),
    'leading frisbee icon in session-brief page chips'
  );
  assert.ok(
    sessionBriefSrc.includes(':data-note="t.title" data-note-bare'),
    'page chips in session-brief use :data-note'
  );
  assert.ok(
    !sessionBriefSrc.includes('x-text="t.mark"'),
    'no t.mark repeated in session-brief page chips'
  );
});
