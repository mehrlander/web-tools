// tools/test/tend.test.mjs
// Verifies the /tend portable skill (.claude/skills/tend/SKILL.md) and its cross-registration.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';
import { parseCsv } from '../build/registries-load.mjs';

const SKILL_PATH = path.join(repoRoot, '.claude', 'skills', 'tend', 'SKILL.md');

test('.claude/skills/tend/SKILL.md exists, has valid frontmatter, zero em dashes, and a tiered process', () => {
  assert.ok(existsSync(SKILL_PATH), '.claude/skills/tend/SKILL.md must exist on disk');
  const content = readFileSync(SKILL_PATH, 'utf8');
  assert.ok(!content.includes('\u2014'), 'tend SKILL.md must contain zero em dashes');
  assert.match(content, /^---\r?\nname:\s*tend\b/, 'frontmatter must declare name: tend');
  assert.match(content, /description:\s*>-?\s+Cultivate a workspace/, 'frontmatter must declare description');
  assert.match(content, /disable-model-invocation:\s*true/, 'frontmatter must disable unprompted invocation');
  assert.match(content, /Commitment belongs to the owner\./, 'must keep the doctrine\'s commitment boundary');
  for (const stream of ['Branches', 'Trackers', 'Pull requests', 'Snags']) {
    assert.match(content, new RegExp(`^## ${stream}$`, 'm'), `must define the ${stream} stream`);
  }
  for (const tier of ['Act', 'Propose']) {
    assert.match(content, new RegExp(`\\*\\*${tier}:\\*\\*`), `must place actions in the ${tier} tier`);
  }
  assert.match(content, /\*\*Owner only:\*\*/, 'must name what only the owner decides');
});

test('tend SKILL.md names commands and paths that exist', () => {
  const content = readFileSync(SKILL_PATH, 'utf8');
  for (const p of ['scripts/stranded-triage.py', 'lib/kits/branch-brief.js', 'docs/SNAGS.md']) {
    assert.ok(content.includes(p), `tend SKILL.md should name ${p}`);
    assert.ok(existsSync(path.join(repoRoot, p)), `${p} named by tend SKILL.md must exist`);
  }
});

test('tasks skill treats a met Done-when as a delivery close, which tend acts on', () => {
  const tasks = readFileSync(path.join(repoRoot, '.claude', 'skills', 'tasks', 'SKILL.md'), 'utf8');
  assert.match(tasks, /delivery close, unattended/, 'tasks skill must classify a met Done-when close as unattended');
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
