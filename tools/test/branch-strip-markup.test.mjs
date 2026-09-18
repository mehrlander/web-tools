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

test('estate.js branchRowBody renders frisbee dropdown button and omits staging button', () => {
  // Extract branchRowBody definition
  const startMatch = estateSrc.match(/const branchRowBody = \(opts = \{\}\) => `([\s\S]*?)`;\s*return {/);
  assert.ok(startMatch, 'branchRowBody function found in estate.js');
  const body = startMatch[1];

  // 1. Toss render pages frisbee button
  assert.ok(body.includes('branchPages(row).length'), 'has branchPages conditional');
  const frisbeeMatch = body.match(/<template x-if="branchPages\(row\)\.length">([\s\S]*?)<\/template>/);
  assert.ok(frisbeeMatch, 'frisbee template block found');
  const frisbeeBtn = frisbeeMatch[1];
  assert.ok(
    frisbeeBtn.includes("@click.stop=\"openRowCard(row, 'renders', $event)\"") &&
    frisbeeBtn.includes('select-none leading-none">🥏</span>'),
    'has interactive frisbee button opening renders row card'
  );
  assert.ok(
    !frisbeeBtn.includes('ph ph-caret-down'),
    'dispenses with the dropdown caret on the frisbee button'
  );
  assert.ok(
    !body.includes('ph-stack'),
    'dispenses with the icon button for staging session/branch files'
  );
  assert.ok(
    estateSrc.includes("rowCard.kind === 'renders'"),
    'estate.js contains panel card support for renders kind'
  );
  assert.ok(
    !estateSrc.includes('Pages this branch changed, rendered via toss.'),
    'estate.js dispenses with redundant subtitle paragraph in renders card'
  );
  assert.ok(
    !estateSrc.includes('btn btn-xs btn-primary gap-1 font-mono shrink-0 normal-case'),
    'estate.js dispenses with bulky blue button in renders card'
  );
  assert.ok(
    !estateSrc.includes('x-show="row.failures" @click.stop="openSessionCard(row, \'tools\', $event)"'),
    'session rows omit standalone failure button'
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
