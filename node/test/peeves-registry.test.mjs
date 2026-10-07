// skills/peeves/peeves.csv — the owner's pet peeves, the list the peeves skill
// carries and the peeves-critic agent preloads. The rows are curated from the
// owner's own corrections in the recorded sessions; this gate holds their
// shape, not their truth, which only the owner can judge.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';
import { parseCsv } from '../build/registries-load.mjs';

const rows = parseCsv(readFileSync(path.join(repoRoot, 'skills', 'peeves', 'peeves.csv'), 'utf8'));
const agents = parseCsv(readFileSync(path.join(repoRoot, 'docs', 'agents.csv'), 'utf8'));

test('ids run P01 upward with no gap, so a cited id never shifts meaning', () => {
  rows.forEach((r, i) => assert.equal(r.id, 'P' + String(i + 1).padStart(2, '0'), `row ${i + 1}`));
});

test('every peeve can be checked: a statement, what tripping it looks like, a session count', () => {
  for (const r of rows) {
    assert.ok(r.peeve && r.look_for, `${r.id}: needs a peeve and a look_for`);
    assert.match(r.sessions, /^\d+$/, `${r.id}: sessions is a whole number`);
    assert.doesNotMatch(r.peeve + r.look_for, /[–—]/, `${r.id}: a dash joining ideas, in the list that forbids them`);
  }
});

test('a peeve a script or hook catches names the document or check that does', () => {
  for (const r of rows.filter(r => r.detector !== 'reader'))
    assert.ok(r.owner, `${r.id}: detector ${r.detector} with no owner naming it`);
});

test('the skill and its critic agree on where the list lives', () => {
  assert.ok(existsSync(path.join(repoRoot, 'skills', 'peeves', 'SKILL.md')));
  const critic = agents.find(a => a.id === 'portable:peeves-critic');
  assert.ok(critic, 'the peeves-critic agent has a roster row');
  assert.equal(critic.preloads, 'portable:peeves', 'the critic preloads the peeves skill');
  const body = readFileSync(path.join(repoRoot, critic.path), 'utf8');
  assert.match(body, /skills\/peeves\/peeves\.csv/, 'the critic names the list file for its fallback read');
});
