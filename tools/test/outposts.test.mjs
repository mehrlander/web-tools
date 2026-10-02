// docs/outposts.csv, docs/account-skills.csv and skills/hooks/account-skills.py:
// the outposts registry, the account outpost's declaration, and the check that
// compares the account with it. The check is run against a fixture account
// and a fixture plugin, so nothing here reads the account of whoever runs the
// suite.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';
import { parseCsv } from '../build/registries-load.mjs';

const TOOL = path.join(repoRoot, 'skills/hooks/account-skills.py');
const HOOKS = JSON.parse(readFileSync(path.join(repoRoot, 'skills/hooks/hooks.json'), 'utf8')).hooks;
const read = (f) => parseCsv(readFileSync(path.join(repoRoot, 'docs', f), 'utf8'));
const outposts = read('outposts.csv');
const declared = read('account-skills.csv');

function withFixture(fn) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'outposts-'));
  const put = (rel, text) => {
    mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    writeFileSync(path.join(dir, rel), text);
  };
  try { return fn(dir, put); } finally { rmSync(dir, { recursive: true, force: true }); }
}
// An account of three skills: an upload matching its plugin twin, an upload
// that has drifted, and one of Anthropic's with a vendored copy that matches.
function account(put, extra = []) {
  const skills = [
    { name: 'alpha', source: 'plugin', updatedAt: '2026-07-01T00:00:00Z' },
    { name: 'beta', source: 'plugin', updatedAt: '2026-07-01T00:00:00Z' },
    { name: 'pdf', source: 'anthropic', updatedAt: '2026-09-01T00:00:00Z' },
    ...extra,
  ];
  put('synced/manifest.json', JSON.stringify({ skills }));
  put('synced/alpha/SKILL.md', 'alpha\n');
  put('synced/beta/SKILL.md', 'beta, as uploaded in July\n');
  put('synced/pdf/SKILL.md', 'pdf\n');
  for (const s of extra) put(`synced/${s.name}/SKILL.md`, `${s.name}\n`);
  put('plugin/alpha/SKILL.md', 'alpha\n');
  put('plugin/beta/SKILL.md', 'beta, edited since\n');
  put('plugin/pdf/SKILL.md', 'pdf\n');
}
const decl = (rows) => 'name,want,twin,note\n' + rows.map(r => r.join(',')).join('\n') + '\n';
const run = (dir, args, declaration) => {
  if (declaration !== undefined) writeFileSync(path.join(dir, 'declared.csv'), declaration);
  return execFileSync('python3', [TOOL, '--synced', path.join(dir, 'synced'), '--plugin', path.join(dir, 'plugin'),
    '--declared', path.join(dir, 'declared.csv'), ...args], { input: '{}', encoding: 'utf8' }).trim();
};
const BASE = [['alpha', 'on', 'alpha', ''], ['beta', 'on', 'beta', ''], ['pdf', 'on', 'pdf', '']];

test('the hook is silent where no account has synced', () => {
  const home = mkdtempSync(path.join(os.tmpdir(), 'outposts-home-'));
  try {
    const out = execFileSync('python3', [TOOL, '--hook'], { input: '{}', encoding: 'utf8', env: { ...process.env, HOME: home } });
    assert.equal(out, '');
  } finally { rmSync(home, { recursive: true, force: true }); }
});

test('the hook is silent when the account matches its declaration and the plugin', () => {
  withFixture((dir, put) => {
    account(put);
    put('synced/beta/SKILL.md', 'beta, edited since\n');
    assert.equal(run(dir, ['--hook'], decl(BASE)), '');
  });
});

test('the hook names a drifted upload and a skill declared off, in one line', () => {
  withFixture((dir, put) => {
    account(put, [{ name: 'retired', source: 'plugin', updatedAt: '2026-06-01T00:00:00Z' }]);
    const out = run(dir, ['--hook'], decl([...BASE, ['retired', 'off', '', 'gone']]));
    assert.equal(out.split('\n').length, 1);
    assert.match(out, /1 skill declared off is still on \(retired\)/);
    assert.match(out, /1 upload differs from the plugin \(beta\)/);
    assert.doesNotMatch(out, /alpha|pdf/, 'matching skills are not reported');
  });
});

test('an account skill nobody declared is reported, and a declared one that is absent', () => {
  withFixture((dir, put) => {
    account(put, [{ name: 'stray', source: 'plugin', updatedAt: '2026-06-01T00:00:00Z' }]);
    put('synced/beta/SKILL.md', 'beta, edited since\n');
    const out = run(dir, ['--hook'], decl([...BASE, ['wanted', 'on', '', '']]));
    assert.match(out, /1 skill on the account is not declared \(stray\)/);
    assert.match(out, /1 declared skill is not on the account \(wanted\)/);
  });
});

test("for Anthropic's skills the account is the reference, and the label says the plugin's copy differs", () => {
  withFixture((dir, put) => {
    account(put);
    put('synced/beta/SKILL.md', 'beta, edited since\n');
    put('synced/pdf/SKILL.md', 'pdf, as Anthropic now ships it\n');
    const out = run(dir, ['--hook'], decl(BASE));
    assert.match(out, /1 plugin copy differs from Anthropic's \(pdf\)/);
    assert.doesNotMatch(out, /upload/);
  });
});

test('the comparison covers the whole folder, not only SKILL.md', () => {
  withFixture((dir, put) => {
    account(put);
    put('synced/beta/SKILL.md', 'beta, edited since\n');
    put('plugin/alpha/references/extra.md', 'added in the plugin\n');
    const table = run(dir, [], decl(BASE));
    assert.match(table, /alpha\s+upload\s+upload differs from the plugin's copy\s+\[1 only in the plugin\]/);
  });
});

test('--write records one row per skill with its state, and --zip packs the plugin copy under its folder name', () => {
  withFixture((dir, put) => {
    account(put);
    const csvPath = path.join(dir, 'out', 'observed.csv');
    run(dir, ['--write', csvPath, '--zip', path.join(dir, 'zips')], decl(BASE));
    const rows = parseCsv(readFileSync(csvPath, 'utf8'));
    assert.deepEqual(Object.keys(rows[0]), ['name', 'source', 'updated', 'files', 'digest', 'twin', 'state', 'label', 'attention', 'detail', 'observed']);
    assert.deepEqual(rows.map(r => r.attention), ['', 'yes', ''], 'only the drifted upload needs attention');
    assert.deepEqual(rows.map(r => `${r.name}:${r.state}`), ['alpha:matches', 'beta:upload-differs', 'pdf:anthropic-same']);
    const zip = path.join(dir, 'zips', 'beta.zip');
    assert.ok(existsSync(zip), 'only the upload that differs gets a zip');
    assert.ok(!existsSync(path.join(dir, 'zips', 'alpha.zip')));
    const listing = execFileSync('python3', ['-c', 'import sys,zipfile;print("\\n".join(zipfile.ZipFile(sys.argv[1]).namelist()))', zip], { encoding: 'utf8' });
    assert.equal(listing.trim(), 'beta/SKILL.md', 'claude.ai looks for <skill-name>/SKILL.md');
  });
});

test('the check is registered once at session start, in its own entry', () => {
  const entries = HOOKS.SessionStart.filter(e => e.hooks.some(h => h.command.includes('account-skills.py')));
  assert.equal(entries.length, 1);
  assert.equal(entries[0].hooks.length, 1);
  assert.match(entries[0].hooks[0].command, /--hook$/);
});

test('the declaration names each skill once, says on or off, and points every twin at a folder under skills/', () => {
  const names = declared.map(r => r.name);
  assert.equal(new Set(names).size, names.length, 'a skill is declared twice');
  for (const r of declared) {
    assert.ok(['on', 'off'].includes(r.want), `${r.name}: want is ${r.want}`);
    if (r.twin) assert.ok(existsSync(path.join(repoRoot, 'skills', r.twin, 'SKILL.md')), `${r.name}: twin skills/${r.twin} is not a skill`);
  }
});

test('every outpost declares each part, and every locator into this repo resolves', () => {
  const ids = outposts.map(r => r.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const r of outposts) {
    for (const k of ['title', 'gloss', 'declared', 'observed', 'reports', 'cadence', 'check', 'upkeep', 'doc']) {
      assert.ok(r[k], `${r.id}: ${k} is blank`);
    }
    assert.ok(['owner', 'outpost'].includes(r.reports), `${r.id}: reports is ${r.reports}`);
    for (const k of ['declared', 'observed', 'check', 'record', 'doc']) {
      const m = (r[k] || '').match(/^mehrlander\/web-tools:(.+)$/);
      if (m) assert.ok(existsSync(path.join(repoRoot, m[1].replace(/#.*$/, ''))), `${r.id}: ${k} ${r[k]} does not exist`);
    }
  }
});
