// Git's automatic merge-commit path, which skips pre-commit. This fixture uses
// a tiny deterministic generator so the test can prove both entry paths without
// copying web-tools' whole artifact graph: ordinary commits invoke pre-commit;
// automatic merges invoke pre-merge-commit, pause when the delegated refresher
// changes Git's cached tree, then finish through pre-commit and commit-msg.

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SETUP = path.join(repoRoot, 'tools', 'checkout-setup.mjs');
const PRE_MERGE = readFileSync(path.join(repoRoot, '.githooks', 'pre-merge-commit'), 'utf8');
const CSV_DRIVER = readFileSync(path.join(repoRoot, 'scripts', 'derived-csv-merge.mjs'), 'utf8');
const CSV_LOADER = readFileSync(path.join(repoRoot, 'tools', 'build', 'registries-load.mjs'), 'utf8');

function run(command, args, cwd) {
  return spawnSync(command, args, { cwd, encoding: 'utf8', windowsHide: true });
}

function git(root, ...args) {
  const r = run('git', ['-C', root, ...args], root);
  assert.equal(r.status, 0, r.stderr || r.stdout);
  return r.stdout.trim();
}

function write(root, rel, contents, executable = false) {
  const file = path.join(root, rel);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, contents);
  if (executable) {
    try { chmodSync(file, 0o755); } catch {}
  }
}

test('ordinary commits and automatic merges refresh computed CSV cells without losing authored cells', () => {
  const box = mkdtempSync(path.join(tmpdir(), 'merge-refresh-'));
  const root = path.join(box, 'repo');
  mkdirSync(root);
  try {
    write(root, 'package.json', '{"private":true,"devDependencies":{}}\n');
    write(root, '.gitignore', 'node_modules/\npackage-lock.json\nhook.log\n');
    write(root, '.gitattributes', 'docs/docs.csv merge=derived-csv\n');
    write(root, 'docs/registries.csv', 'id,path,key\ndocs,docs/docs.csv,path\n');
    write(root, 'docs/properties.csv', [
      'registry,property,mode',
      'docs,path,recorded',
      'docs,subject,recorded',
      'docs,total,computed',
      '',
    ].join('\n'));
    write(root, 'docs/docs.csv', 'path,subject,total\nsource/base.txt,Base authored,1\n');
    write(root, 'scripts/derived-csv-merge.mjs', CSV_DRIVER, true);
    write(root, 'tools/build/registries-load.mjs', CSV_LOADER);
    write(root, 'tools/repo-root.mjs', `
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
`.trimStart());
    write(root, 'scripts/refresh.mjs', `
import { readFileSync, writeFileSync } from 'node:fs';
const file = 'docs/docs.csv';
const rows = readFileSync(file, 'utf8').trim().split(/\\r?\\n/).slice(1)
  .map(line => {
    const [path, subject] = line.split(',');
    return { path, subject };
  })
  .sort((a, b) => a.path.localeCompare(b.path));
const total = String(rows.length);
writeFileSync(file, ['path,subject,total', ...rows.map(row =>
  [row.path, row.subject, total].join(','))].join('\\n') + '\\n');
`.trimStart());
    write(root, 'source/base.txt', 'base\n');
    write(root, '.githooks/pre-commit', `#!/bin/sh
root="$(git rev-parse --show-toplevel)" || exit 1
block="$(git rev-parse --git-path block-pre-commit)" || exit 1
if [ -f "$block" ]; then
  printf '%s\\n' blocked >> "$root/hook.log"
  printf '%s\\n' 'fixture pre-commit gate blocked' >&2
  exit 23
fi
node "$root/scripts/refresh.mjs" || exit 1
git add docs/docs.csv || exit 1
printf '%s\\n' pre-commit >> "$root/hook.log"
`, true);
    write(root, '.githooks/pre-merge-commit', PRE_MERGE, true);
    write(root, '.githooks/commit-msg', `#!/bin/sh
root="$(git rev-parse --show-toplevel)" || exit 1
printf '%s\\n' commit-msg >> "$root/hook.log"
`, true);

    git(root, 'init', '-b', 'main');
    git(root, 'config', 'user.name', 'Merge Refresh Test');
    git(root, 'config', 'user.email', 'merge@example.invalid');
    git(root, 'add', '-A');
    git(root, 'commit', '--no-verify', '-m', 'base');
    const base = git(root, 'rev-parse', 'HEAD');

    const setup = run(process.execPath, [SETUP, '--root', root], root);
    assert.equal(setup.status, 0, `${setup.stdout}${setup.stderr}`);

    git(root, 'switch', '-c', 'left');
    write(root, 'source/left.txt', 'left\n');
    write(root, 'docs/docs.csv', [
      'path,subject,total',
      'source/base.txt,Base authored,999',
      'source/left.txt,Left authored,999',
      '',
    ].join('\n'));
    git(root, 'add', 'source/left.txt', 'docs/docs.csv');
    git(root, 'commit', '-m', 'left source');
    assert.equal(git(root, 'show', 'HEAD:docs/docs.csv'), [
      'path,subject,total',
      'source/base.txt,Base authored,2',
      'source/left.txt,Left authored,2',
    ].join('\n'), 'the ordinary source commit includes restamped computed cells');

    git(root, 'switch', '-c', 'right', base);
    write(root, 'source/right-a.txt', 'right a\n');
    write(root, 'source/right-b.txt', 'right b\n');
    write(root, 'docs/docs.csv', [
      'path,subject,total',
      'source/base.txt,Base authored,999',
      'source/right-a.txt,Right A authored,999',
      'source/right-b.txt,Right B authored,999',
      '',
    ].join('\n'));
    git(root, 'add', 'source/right-a.txt', 'source/right-b.txt', 'docs/docs.csv');
    git(root, 'commit', '-m', 'right source');

    git(root, 'switch', 'left');
    const leftHead = git(root, 'rev-parse', 'HEAD');
    writeFileSync(path.join(root, 'hook.log'), '');
    const merge = run('git', ['-C', root, 'merge', '--no-ff', 'right', '-m', 'Merge right'], root);
    assert.notEqual(merge.status, 0, 'the first merge command stops before caching stale computed cells');
    assert.match(`${merge.stdout}${merge.stderr}`, /git -c core\.editor=true merge --continue/);
    assert.equal(git(root, 'rev-parse', 'HEAD'), leftHead, 'no merge commit exists before continuation');
    assert.ok(git(root, 'rev-parse', '--verify', 'MERGE_HEAD'), 'the clean merge remains in progress');
    assert.equal(git(root, 'show', ':docs/docs.csv'), [
      'path,subject,total',
      'source/base.txt,Base authored,4',
      'source/left.txt,Left authored,4',
      'source/right-a.txt,Right A authored,4',
      'source/right-b.txt,Right B authored,4',
    ].join('\n'), 'the stopped merge has the refreshed combined CSV staged');

    git(root, '-c', 'core.editor=true', 'merge', '--continue');

    assert.equal(git(root, 'rev-list', '--parents', '-n', '1', 'HEAD').split(/\s+/).length, 3,
      'the continued result is a merge commit with two parents');
    assert.equal(readFileSync(path.join(root, 'hook.log'), 'utf8'),
      'pre-commit\npre-commit\ncommit-msg\n',
      'pre-merge refreshes once, then the ordinary commit path keeps both gates');
    assert.equal(git(root, 'show', 'HEAD:docs/docs.csv'), [
      'path,subject,total',
      'source/base.txt,Base authored,4',
      'source/left.txt,Left authored,4',
      'source/right-a.txt,Right A authored,4',
      'source/right-b.txt,Right B authored,4',
    ].join('\n'), 'the driver unions authored rows and the hook restamps combined computed cells');
    assert.equal(git(root, 'status', '--porcelain'), '');

    const mergedBase = git(root, 'rev-parse', 'HEAD');
    git(root, 'switch', '-c', 'gate-left');
    write(root, 'gate-left.txt', 'left\n');
    git(root, 'add', 'gate-left.txt');
    git(root, 'commit', '-m', 'gate left');
    git(root, 'switch', '-c', 'gate-right', mergedBase);
    write(root, 'gate-right.txt', 'right\n');
    git(root, 'add', 'gate-right.txt');
    git(root, 'commit', '-m', 'gate right');
    git(root, 'switch', 'gate-left');

    const markerName = git(root, 'rev-parse', '--git-path', 'block-pre-commit');
    const marker = path.isAbsolute(markerName) ? markerName : path.join(root, markerName);
    writeFileSync(marker, 'block\n');
    writeFileSync(path.join(root, 'hook.log'), '');
    const gateHead = git(root, 'rev-parse', 'HEAD');
    const blocked = run('git', ['-C', root, 'merge', '--no-ff', 'gate-right', '-m', 'blocked merge'], root);
    assert.notEqual(blocked.status, 0, 'a delegated blocking gate prevents the merge commit');
    assert.match(`${blocked.stdout}${blocked.stderr}`, /fixture pre-commit gate blocked/);
    assert.equal(git(root, 'rev-parse', 'HEAD'), gateHead);
    assert.ok(git(root, 'rev-parse', '--verify', 'MERGE_HEAD'), 'the blocked clean merge is recoverable');
    assert.equal(readFileSync(path.join(root, 'hook.log'), 'utf8'), 'blocked\n',
      'commit-msg never runs after the delegated pre-commit gate blocks');
  } finally { rmSync(box, { recursive: true, force: true }); }
});
