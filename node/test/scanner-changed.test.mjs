// `--changed` on python/dead-opacity.py and python/stranded-titles.py: the
// default roots are lib, app and pages, so a page built in dump/ was checked by
// nothing (tracker task enforce-house-style-ryz0z5). `--changed` scans what the
// branch changed against main, committed or not, in any folder. Pinned here on
// a scratch repository with one page outside the default roots.

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { repoRoot } from '../repo-root.mjs';

const BARE = '<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>\n';

function scratch(fn) {
  const dir = mkdtempSync(path.join(tmpdir(), 'scanner-changed-'));
  const git = (...a) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', '-c', 'core.hooksPath=/dev/null', ...a], { cwd: dir, encoding: 'utf8' });
  try {
    git('init', '-q', '-b', 'main');
    writeFileSync(path.join(dir, 'README.md'), 'x\n');
    git('add', '.');
    git('commit', '-qm', 'base');
    git('checkout', '-qb', 'work');
    mkdirSync(path.join(dir, 'dump'));
    writeFileSync(path.join(dir, 'dump', 'page.html'),
      BARE + '<div class="hover:bg-primary/10"><span title="only here">x</span></div>\n');
    return fn(dir, git);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

const py = (dir, script, args) =>
  execFileSync('python3', [path.join(repoRoot, 'python', script), ...args], { cwd: dir, encoding: 'utf8' });

test('--changed reaches an uncommitted page outside lib, app and pages', () => {
  scratch(dir => {
    assert.match(py(dir, 'dead-opacity.py', ['--changed']), /dump\/page\.html:2: hover:bg-primary\/10/);
    assert.match(py(dir, 'stranded-titles.py', ['--changed', '--all']), /dump\/page\.html[\s\S]*only here/);
  });
});

test('--changed reaches a committed page, and the default roots still do not', () => {
  scratch((dir, git) => {
    git('add', '.');
    git('commit', '-qm', 'page');
    assert.match(py(dir, 'dead-opacity.py', ['--changed']), /dump\/page\.html/);
    assert.match(py(dir, 'dead-opacity.py', []), /dead-opacity: none/);
  });
});
