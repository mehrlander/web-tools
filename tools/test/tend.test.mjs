// tools/test/tend.test.mjs
// Verifies The Doctrine of Tending (docs/TENDING.md) and the /tend portable skill (.claude/skills/tend/SKILL.md).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';
import { parseCsv } from '../build/registries-load.mjs';

const TENDING_PATH = path.join(repoRoot, 'docs', 'TENDING.md');
const SKILL_PATH = path.join(repoRoot, '.claude', 'skills', 'tend', 'SKILL.md');
const REPO_REVIEW_PATH = path.join(repoRoot, '.claude', 'skills', 'repo-review', 'SKILL.md');

test('docs/TENDING.md exists, has content, and contains zero em dashes', () => {
  assert.ok(existsSync(TENDING_PATH), 'docs/TENDING.md must exist on disk');
  const content = readFileSync(TENDING_PATH, 'utf8');
  assert.ok(content.length > 200, 'docs/TENDING.md must have substantive content');
  assert.ok(!content.includes('\u2014'), 'docs/TENDING.md must contain zero em dashes');
  assert.match(content, /^# The Doctrine of Tending/m, 'must start with title');
  assert.match(content, /The Core Boundary: Commitment vs\. Clarification/, 'must have Section 1');
  assert.match(content, /The Ethic of Questions: Answering vs\. Minting/, 'must have Section 2');
  assert.match(content, /The Action in Practice \(`tend`\)/, 'must have Section 3');
});

test('.claude/skills/tend/SKILL.md exists, has valid frontmatter, and contains zero em dashes', () => {
  assert.ok(existsSync(SKILL_PATH), '.claude/skills/tend/SKILL.md must exist on disk');
  const content = readFileSync(SKILL_PATH, 'utf8');
  assert.ok(content.length > 200, 'tend SKILL.md must have substantive content');
  assert.ok(!content.includes('\u2014'), 'tend SKILL.md must contain zero em dashes');
  assert.match(content, /^---\r?\nname:\s*tend\b/, 'frontmatter must declare name: tend');
  assert.match(content, /description:\s*>-?\s+Cultivate a workspace/, 'frontmatter must declare description');
  assert.match(content, /disable-model-invocation:\s*true/, 'frontmatter must disable unprompted invocation');
});

test('relative markdown links in docs/TENDING.md and tend SKILL.md resolve on disk', () => {
  const files = [TENDING_PATH, SKILL_PATH];
  const LINK_RE = /\[[^\]]*\]\(([^)\s]+)\)/g;

  for (const filePath of files) {
    const text = readFileSync(filePath, 'utf8');
    const dir = path.dirname(filePath);
    for (const [, target] of text.matchAll(LINK_RE)) {
      if (/^(?:https?:|mailto:|#)/.test(target)) continue;
      const cleanTarget = target.split('#')[0];
      if (!cleanTarget) continue;
      const resolved = path.resolve(dir, cleanTarget);
      assert.ok(existsSync(resolved),
        `${path.relative(repoRoot, filePath)} links to non-existent path: ${target} (resolved to ${resolved})`);
    }
  }
});

test('docs/docs.csv registers docs/TENDING.md with valid metadata', () => {
  const docsCsv = parseCsv(readFileSync(path.join(repoRoot, 'docs', 'docs.csv'), 'utf8'));
  const row = docsCsv.find(d => d.path === 'docs/TENDING.md');
  assert.ok(row, 'docs/docs.csv must contain a row for docs/TENDING.md');
  assert.equal(row.status, 'living');
  assert.ok(row.subject && row.subject.length > 5);
  assert.ok(+row.words > 0);
  assert.ok(row.maintenance && row.maintenance.length > 5);
});

test('docs/portable.csv registers tend skill and TENDING.md doc', () => {
  const portableCsv = parseCsv(readFileSync(path.join(repoRoot, 'docs', 'portable.csv'), 'utf8'));
  const skillRow = portableCsv.find(p => p.path === '.claude/skills/tend/SKILL.md');
  assert.ok(skillRow, 'docs/portable.csv must contain a skill row for .claude/skills/tend/SKILL.md');
  assert.equal(skillRow.kind, 'skill');
  assert.equal(skillRow.command, '/portable:tend');
  assert.equal(skillRow.use, 'plugin');

  const docRow = portableCsv.find(p => p.path === 'docs/TENDING.md');
  assert.ok(docRow, 'docs/portable.csv must contain a doc row for docs/TENDING.md');
  assert.equal(docRow.kind, 'doc');
  assert.equal(docRow.title, 'Tending');
});

test('.claude-plugin/marketplace.json registers ./tend in portable plugin skills', () => {
  const marketplace = JSON.parse(readFileSync(path.join(repoRoot, '.claude-plugin', 'marketplace.json'), 'utf8'));
  const portable = marketplace.plugins.find(p => p.name === 'portable');
  assert.ok(portable, 'portable plugin must be declared in marketplace.json');
  assert.ok(portable.skills.includes('./tend'), 'portable plugin skills must include ./tend');
});

test('.claude/skills/repo-review/SKILL.md sweep section points to /tend and docs/TENDING.md', () => {
  const content = readFileSync(REPO_REVIEW_PATH, 'utf8');
  assert.match(content, /superseded by `\/tend`/, 'sweep section must note supersession by /tend');
  assert.match(content, /docs\/TENDING\.md/, 'sweep section must link to docs/TENDING.md');
});
