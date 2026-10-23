// skills/programs/program.py report: the changes section counts the commits to
// the governed files since a date, a commit once for each governed entry it
// touched, a folder entry covering the files under it, and leaves out the
// commits that touch nothing governed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const SCRIPT = join(repoRoot, 'skills/programs/program.py');
const env = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' };

test('the report counts governed commits per entry and lists the latest', () => {
  const base = mkdtempSync(join(tmpdir(), 'program-report-'));
  const origin = join(base, 'origin.git'), work = join(base, 'work');
  const git = (...args) => spawnSync('git', args, { cwd: work, env, encoding: 'utf8' });
  try {
    spawnSync('git', ['init', '-q', '--bare', '-b', 'main', origin]);
    spawnSync('git', ['clone', '-q', origin, work]);
    const commit = (files, msg) => {
      for (const [p, text] of Object.entries(files)) {
        mkdirSync(join(work, dirname(p)), { recursive: true });
        writeFileSync(join(work, p), text);
      }
      git('add', '-A');
      git('commit', '-q', '--no-verify', '-m', msg);
    };
    commit({ '.web-tools.json': JSON.stringify({ programs: [{ name: 'demo', label: 'Demo', path: 'programs/demo',
      governs: ['docs/a.md', 'docs/forms/'] }] }), 'programs/demo/README.md': '# Demo' }, 'declare');
    commit({ 'docs/a.md': '1' }, 'touch a');
    commit({ 'docs/forms/x.md': '1', 'docs/a.md': '2' }, 'touch a and a form');
    commit({ 'docs/other.md': '1', 'docs/forms-old.md': '1' }, 'touch nothing governed');
    git('push', '-q', 'origin', 'HEAD:main');

    const r = spawnSync('python3', [SCRIPT, 'report', 'demo', '--since', '2000-01-01'], { cwd: work, env, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /^2 commits\./m);
    assert.match(r.stdout, /\| `docs\/a\.md` \| 2 \|/);
    assert.match(r.stdout, /\| `docs\/forms\/` \| 1 \|/);
    assert.match(r.stdout, /- \w+ \d{4}-\d{2}-\d{2} touch a and a form/);
    assert.doesNotMatch(r.stdout, /touch nothing governed/);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});
