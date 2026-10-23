// Programs are declared in a repo's .web-tools.json (docs/manifest-fields.csv,
// programs[]). A declaration is the one list the Programs tab, the programs
// skill and the program-files hook all read, so a path in it that no longer
// exists misleads all three at once. This holds every declaration to the
// files on disk: the program's folder and its README.md charter exist, every
// governed path exists, no file answers
// to two programs, and every reviewer is an agent docs/agents.csv lists.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';
import { parseCsv } from '../build/registries-load.mjs';

const SIBLINGS = ['home', 'chat-histories', 'web-tools-private', 'shortcut-tools', 'fun'];

function declarations() {
  const found = [];
  const read = (repo, root) => {
    const p = path.join(root, '.web-tools.json');
    if (!existsSync(p)) return;
    let m;
    try { m = JSON.parse(readFileSync(p, 'utf8')); } catch { return; }
    for (const e of Array.isArray(m.programs) ? m.programs : []) found.push({ repo, root, e });
  };
  read('mehrlander/web-tools', repoRoot);
  for (const name of SIBLINGS) read('mehrlander/' + name, path.join(repoRoot, '..', name));
  return found;
}

const agents = new Set(parseCsv(readFileSync(path.join(repoRoot, 'docs', 'agents.csv'), 'utf8')).map(r => r.id));

test('the hub declares at least one program', () => {
  assert.ok(declarations().some(d => d.repo === 'mehrlander/web-tools'));
});

test('every program names itself, an icon and a folder whose README.md is its charter', () => {
  const gaps = [], names = new Set();
  for (const { repo, root, e } of declarations()) {
    const id = `${repo}: ${e?.name || '(unnamed)'}`;
    if (typeof e?.name !== 'string' || !/^[a-z0-9-]+$/.test(e.name)) gaps.push(`${id} needs a lowercase name`);
    else if (names.has(e.name)) gaps.push(`${id} is declared twice`);
    else names.add(e.name);
    // A ph- glyph, or an SVG file in the program's repository, as a project's icon may be.
    const icon = typeof e?.icon === 'string' ? e.icon : '';
    if (!icon.startsWith('ph-') && !(icon.endsWith('.svg') && existsSync(path.join(root, icon)))) gaps.push(`${id} needs a ph- icon or an SVG file`);
    if (typeof e?.path !== 'string' || !existsSync(path.join(root, e.path, 'README.md'))) gaps.push(`${id}'s charter ${e?.path}/README.md is missing`);
  }
  assert.deepEqual(gaps, []);
});

test('every governed path exists, and no file answers to two programs', () => {
  // An entry ending in / governs everything under it, so two entries collide
  // when one equals the other or sits inside it.
  const gaps = [], seen = [];
  const inside = (a, b) => a === b || (b.endsWith('/') && a.startsWith(b));
  for (const { repo, root, e } of declarations()) {
    const governs = Array.isArray(e?.governs) ? e.governs : [];
    if (!governs.length) gaps.push(`${repo}: ${e?.name} governs nothing`);
    for (const g of governs) {
      if (typeof g !== 'string' || !existsSync(path.join(root, g))) { gaps.push(`${repo}: ${e?.name} governs missing ${g}`); continue; }
      const clash = seen.find(s => s.repo === repo && (inside(g, s.g) || inside(s.g, g)));
      if (clash) gaps.push(`${repo}:${g} is governed by both ${clash.name} (${clash.g}) and ${e.name}`);
      seen.push({ repo, g, name: e.name });
    }
  }
  assert.deepEqual(gaps, []);
});

test('reviewers are listed agents, measures are paths or locators, views are app addresses', () => {
  const gaps = [];
  for (const { repo, root, e } of declarations()) {
    for (const r of e?.reviewers || []) if (!agents.has(r)) gaps.push(`${repo}: ${e.name} reviewer ${r} is not in docs/agents.csv`);
    for (const m of e?.measures || []) {
      const qualified = /^[\w.-]+\/[\w.-]+(@[\w./-]+)?:[^\s]+$/.test(m);
      if (!qualified && !existsSync(path.join(root, m))) gaps.push(`${repo}: ${e.name} measure ${m} is neither a locator nor a file`);
    }
    for (const v of e?.views || []) if (!/^\?view=[\w-]+/.test(v)) gaps.push(`${repo}: ${e.name} view ${v} is not an app address`);
  }
  assert.deepEqual(gaps, []);
});
