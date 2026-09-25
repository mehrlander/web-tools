// tools/test/tend.test.mjs
// Verifies the /tend portable skill (.claude/skills/tend/SKILL.md) and its cross-registration.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';
import { parseCsv } from '../build/registries-load.mjs';

const SKILL_PATH = path.join(repoRoot, '.claude', 'skills', 'tend', 'SKILL.md');
const REPO_REVIEW_PATH = path.join(repoRoot, '.claude', 'skills', 'repo-review', 'SKILL.md');

test('.claude/skills/tend/SKILL.md exists, has valid frontmatter, zero em dashes, and green-light workflow', () => {
  assert.ok(existsSync(SKILL_PATH), '.claude/skills/tend/SKILL.md must exist on disk');
  const content = readFileSync(SKILL_PATH, 'utf8');
  assert.ok(content.length > 200, 'tend SKILL.md must have substantive content');
  assert.ok(!content.includes('\u2014'), 'tend SKILL.md must contain zero em dashes');
  assert.match(content, /^---\r?\nname:\s*tend\b/, 'frontmatter must declare name: tend');
  assert.match(content, /description:\s*>-?\s+Cultivate a workspace/, 'frontmatter must declare description');
  assert.match(content, /disable-model-invocation:\s*true/, 'frontmatter must disable unprompted invocation');
  assert.match(content, /Phase 1: Survey and propose plan with green light/, 'must define Phase 1 plan with green light');
  assert.match(content, /Phase 2: Execute on green light and offer more/, 'must define Phase 2 execution and offer more');
});

test('relative markdown links in tend SKILL.md resolve on disk', () => {
  const text = readFileSync(SKILL_PATH, 'utf8');
  const dir = path.dirname(SKILL_PATH);
  const LINK_RE = /\[[^\]]*\]\(([^)\s]+)\)/g;

  for (const [, target] of text.matchAll(LINK_RE)) {
    if (/^(?:https?:|mailto:|#)/.test(target)) continue;
    const cleanTarget = target.split('#')[0];
    if (!cleanTarget) continue;
    const resolved = path.resolve(dir, cleanTarget);
    assert.ok(existsSync(resolved),
      `${path.relative(repoRoot, SKILL_PATH)} links to non-existent path: ${target} (resolved to ${resolved})`);
  }
});

test('docs/docs.csv does not contain docs/TENDING.md (relocated to home chron)', () => {
  const docsCsv = parseCsv(readFileSync(path.join(repoRoot, 'docs', 'docs.csv'), 'utf8'));
  const row = docsCsv.find(d => d.path === 'docs/TENDING.md');
  assert.equal(row, undefined, 'docs/docs.csv must not contain docs/TENDING.md');
});

test('docs/portable.csv registers tend skill', () => {
  const portableCsv = parseCsv(readFileSync(path.join(repoRoot, 'docs', 'portable.csv'), 'utf8'));
  const skillRow = portableCsv.find(p => p.path === '.claude/skills/tend/SKILL.md');
  assert.ok(skillRow, 'docs/portable.csv must contain a skill row for .claude/skills/tend/SKILL.md');
  assert.equal(skillRow.kind, 'skill');
  assert.equal(skillRow.command, '/portable:tend');
  assert.equal(skillRow.use, 'plugin');

  const docRow = portableCsv.find(p => p.path === 'docs/TENDING.md');
  assert.equal(docRow, undefined, 'docs/portable.csv must not contain docs/TENDING.md');
});

test('.claude-plugin/marketplace.json registers ./tend in portable plugin skills', () => {
  const marketplace = JSON.parse(readFileSync(path.join(repoRoot, '.claude-plugin', 'marketplace.json'), 'utf8'));
  const portable = marketplace.plugins.find(p => p.name === 'portable');
  assert.ok(portable, 'portable plugin must be declared in marketplace.json');
  assert.ok(portable.skills.includes('./tend'), 'portable plugin skills must include ./tend');
});

test('.claude/skills/repo-review/SKILL.md sweep section points to /tend', () => {
  const content = readFileSync(REPO_REVIEW_PATH, 'utf8');
  assert.match(content, /superseded by `\/tend`/, 'sweep section must note supersession by /tend');
});
