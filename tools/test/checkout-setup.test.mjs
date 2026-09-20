// The explicit checkout setup and its read-only readiness report, exercised in
// real disposable Git repositories rather than by stubbing git/npm. The local
// file dependency makes npm prove installation and version metadata without a
// registry request.

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
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
const NPM_CLI = [
  process.env.npm_execpath,
  path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  path.resolve(path.dirname(process.execPath), '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
].filter(Boolean).find(existsSync);

assert.ok(NPM_CLI, 'the setup tests need npm beside the Node test runtime');

function run(command, args, cwd, env = process.env) {
  return spawnSync(command, args, { cwd, env, encoding: 'utf8', windowsHide: true });
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

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'"'"'`)}'`;
}

function writeNpmLauncher(box, { failing = false } = {}) {
  const bin = path.join(box, 'bin');
  mkdirSync(bin, { recursive: true });
  write(bin, 'npm', failing
    ? '#!/bin/sh\nexit 23\n'
    : `#!/bin/sh\nexec ${shellQuote(process.execPath)} ${shellQuote(NPM_CLI)} "$@"\n`, true);
  write(bin, 'npm.cmd', failing
    ? '@ECHO OFF\r\nexit /b 23\r\n'
    : `@ECHO OFF\r\n"${process.execPath}" "${NPM_CLI}" %*\r\n`);
  return bin;
}

function fixture({ dependency = true } = {}) {
  const box = mkdtempSync(path.join(tmpdir(), 'checkout-setup-'));
  const root = path.join(box, 'repo');
  mkdirSync(root);

  const devDependencies = dependency ? { 'fixture-dep': 'file:./fixture-dep' } : {};
  write(root, 'package.json', JSON.stringify({ private: true, devDependencies }, null, 2) + '\n');
  write(root, '.gitignore', 'node_modules/\npackage-lock.json\n');
  if (dependency) {
    write(root, 'fixture-dep/package.json', '{"name":"fixture-dep","version":"1.0.0"}\n');
    write(root, 'fixture-dep/index.js', 'module.exports = 1;\n');
  }
  for (const hook of ['pre-commit', 'pre-merge-commit', 'commit-msg']) {
    write(root, `.githooks/${hook}`, '#!/bin/sh\nexit 0\n', true);
  }
  write(root, 'scripts/derived-csv-merge.mjs', '// fixture driver\n');
  write(root, '.gitattributes', 'docs/docs.csv merge=derived-csv\n');
  write(root, 'docs/docs.csv', 'path,key\ndocs/a.md,a\n');
  write(root, 'source.txt', 'new source\n');
  write(root, 'derived.txt', 'deliberately stale\n');
  write(root, 'scripts/verify-derived.mjs', `
import { readFileSync } from 'node:fs';
const source = readFileSync('source.txt', 'utf8');
const derived = readFileSync('derived.txt', 'utf8');
if (derived !== source.toUpperCase()) {
  console.error('derived.txt is stale');
  process.exitCode = 1;
}
`.trimStart());

  git(root, 'init', '-b', 'main');
  git(root, 'config', 'user.name', 'Checkout Setup Test');
  git(root, 'config', 'user.email', 'checkout@example.invalid');
  git(root, 'add', '-A');
  git(root, 'commit', '--no-verify', '-m', 'fixture');
  writeNpmLauncher(box);
  return { box, root };
}

function checkoutWithEnv(root, extraEnv, ...args) {
  const env = { ...process.env };
  delete env.CLAUDE_CODE_REMOTE;
  delete env.CLAUDE_PROJECT_DIR;
  const pathKey = Object.keys(env).find(key => key.toLowerCase() === 'path') || 'PATH';
  env[pathKey] = [path.join(path.dirname(root), 'bin'), env[pathKey]].filter(Boolean).join(path.delimiter);
  Object.assign(env, extraEnv);
  return run(process.execPath, [SETUP, '--root', root, ...args], root, env);
}

function checkout(root, ...args) {
  return checkoutWithEnv(root, {}, ...args);
}

const output = r => `${r.stdout || ''}${r.stderr || ''}`;
const samePath = (a, b) => {
  const norm = p => path.resolve(p).replace(/\\/g, '/').toLowerCase();
  return norm(a) === norm(b);
};
const python310 = run('python', [
  '-c',
  'import sys; raise SystemExit(sys.version_info < (3, 10))',
], repoRoot).status === 0;

test('fresh setup works without Claude variables, is repeatable, and leaves tracked files alone', () => {
  const { box, root } = fixture();
  try {
    const stale = readFileSync(path.join(root, 'derived.txt'), 'utf8');
    assert.notEqual(run(process.execPath, ['scripts/verify-derived.mjs'], root).status, 0,
      'the independent fixture verifier starts red');
    const first = checkout(root);
    assert.equal(first.status, 0, output(first));
    assert.equal(git(root, 'config', '--get', 'core.hooksPath'), '.githooks');
    assert.equal(git(root, 'config', '--get', 'merge.derived-csv.driver'),
      'node scripts/derived-csv-merge.mjs %O %A %B %P');
    assert.ok(existsSync(path.join(root, 'node_modules', 'fixture-dep', 'package.json')),
      'the declared development dependency was installed');
    assert.equal(readFileSync(path.join(root, 'derived.txt'), 'utf8'), stale,
      'setup does not repair or regenerate tracked artifacts');
    assert.notEqual(run(process.execPath, ['scripts/verify-derived.mjs'], root).status, 0,
      'setup does not make a stale artifact pass independent verification');
    assert.equal(git(root, 'status', '--porcelain'), '');

    const configBefore = readFileSync(path.join(root, '.git', 'config'), 'utf8');
    const second = checkout(root);
    assert.equal(second.status, 0, output(second));
    assert.equal(readFileSync(path.join(root, '.git', 'config'), 'utf8'), configBefore,
      'the second setup does not rewrite already-correct checkout config');
    assert.equal(git(root, 'status', '--porcelain'), '');

    const configAtCheck = readFileSync(path.join(root, '.git', 'config'), 'utf8');
    const ready = checkout(root, '--check');
    assert.equal(ready.status, 0, output(ready));
    assert.equal(readFileSync(path.join(root, '.git', 'config'), 'utf8'), configAtCheck,
      'readiness is read-only');
    assert.equal(readFileSync(path.join(root, 'derived.txt'), 'utf8'), stale);
  } finally { rmSync(box, { recursive: true, force: true }); }
});

test('an empty dependency directory is not mistaken for usable dependencies', () => {
  const { box, root } = fixture();
  try {
    const setup = checkout(root);
    assert.equal(setup.status, 0, output(setup));
    rmSync(path.join(root, 'node_modules', 'fixture-dep'), { recursive: true, force: true });
    mkdirSync(path.join(root, 'node_modules', 'fixture-dep'));
    const ready = checkout(root, '--check');
    assert.notEqual(ready.status, 0);
    assert.match(output(ready), /dependencies: (?:missing|invalid) fixture-dep/);
  } finally { rmSync(box, { recursive: true, force: true }); }
});

test('setup upgrades an older checkout-created python3 shim', { skip: !python310 }, () => {
  const { box, root } = fixture({ dependency: false });
  try {
    write(root, 'node_modules/.bin/python3', '#!/bin/sh\nexec python "$@"\n', true);
    write(root, 'node_modules/.bin/python3.cmd', '@ECHO OFF\r\npython %*\r\n');

    const setup = checkout(root);
    assert.equal(setup.status, 0, output(setup));
    assert.match(readFileSync(path.join(root, 'node_modules', '.bin', 'python3'), 'utf8'),
      /export PYTHONUTF8=1 PYTHONIOENCODING=utf-8\nexec python -X utf8/);
    assert.match(readFileSync(path.join(root, 'node_modules', '.bin', 'python3.cmd'), 'utf8'),
      /set PYTHONUTF8=1\r?\nset PYTHONIOENCODING=utf-8\r?\npython -X utf8/);
  } finally { rmSync(box, { recursive: true, force: true }); }
});

test('an npm-reported dependency graph problem is not mistaken for readiness', () => {
  const { box, root } = fixture();
  try {
    const setup = checkout(root);
    assert.equal(setup.status, 0, output(setup));
    const manifest = path.join(root, 'package.json');
    const pkg = JSON.parse(readFileSync(manifest, 'utf8'));
    pkg.peerDependencies = { 'fixture-missing-peer': '*' };
    writeFileSync(manifest, JSON.stringify(pkg, null, 2) + '\n');

    const ready = checkout(root, '--check');
    assert.notEqual(ready.status, 0);
    assert.match(output(ready), /dependencies:.*fixture-missing-peer/);
  } finally { rmSync(box, { recursive: true, force: true }); }
});

test('readiness rejects a broken terminal npm launcher even when the direct CLI is usable', () => {
  const { box, root } = fixture();
  try {
    const setup = checkout(root);
    assert.equal(setup.status, 0, output(setup));

    writeNpmLauncher(box, { failing: true });
    const ready = checkout(root, '--check');
    assert.notEqual(ready.status, 0);
    assert.match(output(ready), /runtime npm launcher:/);
    assert.doesNotMatch(output(ready), /runtime npm CLI:/,
      'direct npm discovery still supports inspection and installation');
  } finally { rmSync(box, { recursive: true, force: true }); }
});

test('a failed config write exits nonzero and readiness names every unset setting', () => {
  const { box, root } = fixture({ dependency: false });
  const lock = path.join(root, '.git', 'config.lock');
  try {
    writeFileSync(lock, 'held by test\n');
    const setup = checkout(root, '--git-only');
    assert.notEqual(setup.status, 0);
    assert.match(output(setup), /git config core\.hooksPath/);
    assert.match(output(setup), /checkout readiness: NOT READY/);

    const ready = checkout(root, '--check');
    assert.notEqual(ready.status, 0);
    assert.match(output(ready), /core\.hooksPath: expected/);
    assert.match(output(ready), /merge\.derived-csv\.driver: expected/);
  } finally { rmSync(box, { recursive: true, force: true }); }
});

test('a linked worktree resolves the relative hooks path inside that worktree', () => {
  const { box, root } = fixture();
  const linked = path.join(box, 'linked');
  try {
    git(root, 'worktree', 'add', '-b', 'linked-checkout', linked);
    const setup = checkout(linked);
    assert.equal(setup.status, 0, output(setup));
    const hooks = git(linked, 'rev-parse', '--path-format=absolute', '--git-path', 'hooks');
    assert.ok(samePath(hooks, path.join(linked, '.githooks')),
      `expected linked hooks under ${linked}, found ${hooks}`);
    assert.equal(checkout(linked, '--check').status, 0);
  } finally { rmSync(box, { recursive: true, force: true }); }
});

test('setup repairs worktree config when the extension uses another true spelling', () => {
  const { box, root } = fixture();
  const linked = path.join(box, 'linked');
  try {
    git(root, 'config', 'extensions.worktreeConfig', 'yes');
    git(root, 'worktree', 'add', '-b', 'linked-worktree-config', linked);
    git(linked, 'config', '--worktree', 'core.hooksPath', 'wrong-hooks');
    git(linked, 'config', '--worktree', 'merge.derived-csv.name', 'wrong-name');
    git(linked, 'config', '--worktree', 'merge.derived-csv.driver', 'wrong-driver');

    const setup = checkout(linked);
    assert.equal(setup.status, 0, output(setup));
    assert.equal(git(linked, 'config', '--worktree', '--get', 'core.hooksPath'), '.githooks');
    assert.equal(git(linked, 'config', '--worktree', '--get', 'merge.derived-csv.driver'),
      'node scripts/derived-csv-merge.mjs %O %A %B %P');
    assert.equal(checkout(linked, '--check').status, 0);
  } finally { rmSync(box, { recursive: true, force: true }); }
});

test('readiness rejects a hook Git cannot execute', { skip: process.platform === 'win32' }, () => {
  const { box, root } = fixture();
  try {
    const setup = checkout(root);
    assert.equal(setup.status, 0, output(setup));
    chmodSync(path.join(root, '.githooks', 'pre-merge-commit'), 0o644);
    const ready = checkout(root, '--check');
    assert.notEqual(ready.status, 0);
    assert.match(output(ready), /hook pre-merge-commit: not executable/);
  } finally { rmSync(box, { recursive: true, force: true }); }
});

test('Claude startup hooks delegate their separate halves to the shared entry point', () => {
  const gitHook = readFileSync(path.join(repoRoot, '.claude', 'hooks', 'session-githooks.sh'), 'utf8');
  const depHook = readFileSync(path.join(repoRoot, '.claude', 'hooks', 'session-start.sh'), 'utf8');
  assert.match(gitHook, /checkout-setup\.mjs.*--git-only/);
  assert.doesNotMatch(gitHook, /git\s+-C[^\n]+config/);
  assert.match(depHook, /checkout-setup\.mjs.*--dependencies-only/);
  assert.doesNotMatch(depHook, /npm\s+install/);
});
