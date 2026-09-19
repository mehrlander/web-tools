#!/usr/bin/env node
// One checkout entry point for every development venue.
//
//   npm run setup   configure this checkout, install dev dependencies, verify
//   npm run ready   report readiness without writing anything
//
// The Claude SessionStart wrappers call the two narrow internal modes because
// the dispatcher runs sibling session scripts in parallel. Keeping git setup
// and dependency installation separate there avoids two setup processes racing
// each other while the ordinary explicit command still performs both.

import { spawnSync } from 'node:child_process';
import {
  accessSync,
  chmodSync,
  constants as fsConstants,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ownRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOOK_PATH = '.githooks';
const DRIVER_NAME = 'registry CSVs: union the rows, let the deriver own its own columns';
const DRIVER_COMMAND = 'node scripts/derived-csv-merge.mjs %O %A %B %P';
const REQUIRED_HOOKS = ['pre-commit', 'pre-merge-commit', 'commit-msg'];

function run(command, args, { cwd, env = process.env } = {}) {
  return spawnSync(command, args, {
    cwd,
    env,
    encoding: 'utf8',
    windowsHide: true,
  });
}

function text(result) {
  return `${result?.stdout || ''}${result?.stderr || ''}`.trim();
}

function git(root, args, options = {}) {
  return run('git', ['-C', root, ...args], options);
}

function findNpmCli() {
  const candidates = [
    process.env.npm_execpath,
    path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    path.resolve(path.dirname(process.execPath), '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  ].filter(Boolean);

  const names = process.platform === 'win32' ? ['npm.cmd', 'npm'] : ['npm'];
  for (const dir of String(process.env.PATH || '').split(path.delimiter)) {
    if (!dir) continue;
    for (const name of names) {
      const command = path.join(dir.replace(/^"|"$/g, ''), name);
      if (!existsSync(command)) continue;
      try { candidates.push(realpathSync.native(command)); } catch {}
      candidates.push(path.join(path.dirname(command), 'node_modules', 'npm', 'bin', 'npm-cli.js'));
    }
  }

  return candidates.find(candidate => {
    if (!existsSync(candidate)) return false;
    if (/\.(?:c?js|mjs)$/i.test(candidate)) return true;
    try { return /^#!.*\bnode\b/.test(readFileSync(candidate, 'utf8').slice(0, 160)); }
    catch { return false; }
  });
}

function npm(root, args, extraEnv = {}) {
  const cli = findNpmCli();
  if (!cli) {
    return { status: 1, stdout: '', stderr: 'npm CLI not found beside Node or on PATH' };
  }
  return run(process.execPath, [cli, ...args], {
    cwd: root,
    env: { ...process.env, ...extraEnv },
  });
}

// Setup can invoke npm's JavaScript CLI directly so a broken launcher does not
// prevent dependency repair. Readiness has to answer a different question too:
// will the documented npm command work from an ordinary terminal? On Windows
// that command is `npm.cmd`, which needs cmd.exe; elsewhere npm's shebang is
// directly executable. The command text is fixed, so no checkout path enters
// a shell.
function terminalNpm(root) {
  if (process.platform === 'win32') {
    const command = process.env.ComSpec || process.env.COMSPEC || 'cmd.exe';
    return run(command, ['/d', '/s', '/c', 'npm.cmd --version'], { cwd: root });
  }
  return run('npm', ['--version'], { cwd: root });
}

function canonical(p) {
  let value = path.resolve(p);
  try { value = realpathSync.native(value); } catch {}
  return process.platform === 'win32' ? value.toLowerCase() : value;
}

function repoFailure(root) {
  const r = git(root, ['rev-parse', '--show-toplevel']);
  if (r.status !== 0) return `git checkout: ${text(r) || `${root} is not a Git worktree`}`;
  const actual = r.stdout.trim();
  if (canonical(actual) !== canonical(root)) {
    return `git checkout: expected ${path.resolve(root)}, but Git resolves ${actual}`;
  }
  return null;
}

function getConfig(root, key, scope = null) {
  const args = ['config'];
  if (scope) args.push(scope);
  args.push('--get', key);
  const r = git(root, args);
  return r.status === 0 ? r.stdout.trim() : '';
}

function checkoutConfigScope(root) {
  // A repository with multiple worktrees refuses --worktree until
  // extensions.worktreeConfig is enabled. Ask Git to normalize every accepted
  // boolean spelling (true/yes/on/1); when enabled, honor this checkout's
  // overrides, and otherwise use the shared local scope Git permits.
  const enabled = git(root, ['config', '--type=bool', '--get', 'extensions.worktreeConfig']);
  return enabled.status === 0 && enabled.stdout.trim() === 'true' ? '--worktree' : '--local';
}

function writeConfig(root, key, value) {
  const scope = checkoutConfigScope(root);
  if (getConfig(root, key, scope) === value) return null;
  const r = git(root, ['config', scope, key, value]);
  return r.status === 0 ? null : `git config ${key}: ${text(r) || 'write failed'}`;
}

export function configureGit(root) {
  const failures = [];
  const invalid = repoFailure(root);
  if (invalid) return [invalid];

  for (const [key, value] of [
    ['core.hooksPath', HOOK_PATH],
    ['merge.derived-csv.name', DRIVER_NAME],
    ['merge.derived-csv.driver', DRIVER_COMMAND],
  ]) {
    const failure = writeConfig(root, key, value);
    if (failure) failures.push(failure);
  }
  return failures;
}

function readPackage(root) {
  try { return JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')); }
  catch (error) { return { __error: error.message }; }
}

function dependencyFailures(root) {
  const pkg = readPackage(root);
  if (pkg.__error) return [`package.json: ${pkg.__error}`];

  const wanted = Object.keys(pkg.devDependencies || {});
  const r = npm(root, ['ls', '--depth=0', '--include=dev', '--json']);
  let tree;
  try { tree = JSON.parse(r.stdout || '{}'); }
  catch { return [`dependencies: npm ls did not return JSON (${text(r) || 'no output'})`]; }

  const missing = [];
  const invalid = [];
  for (const name of wanted) {
    const dep = tree.dependencies?.[name];
    if (!dep || dep.missing) missing.push(name);
    else if (dep.invalid) invalid.push(`${name}${dep.version ? ` (${dep.version})` : ''}`);
  }
  const problems = [];
  if (missing.length) problems.push(`missing ${missing.join(', ')}`);
  if (invalid.length) problems.push(`invalid ${invalid.join(', ')}`);
  if (r.error) problems.push(r.error.message);
  if (r.status !== 0 && !missing.length && !invalid.length && !r.error) {
    const reported = Array.isArray(tree.problems) ? tree.problems.join('; ') : '';
    problems.push(reported || text(r) || `npm ls exited ${r.status}`);
  }
  return problems.map(p => `dependencies: ${p}`);
}

function pythonVersion(command, env = process.env) {
  const r = run(command, [
    '-c',
    'import sys; print(".".join(map(str, sys.version_info[:3]))); raise SystemExit(sys.version_info < (3, 10))',
  ], { env });
  return r.status === 0;
}

function writeIfChanged(file, contents, mode) {
  let current = null;
  try { current = readFileSync(file, 'utf8'); } catch {}
  const changed = current !== contents;
  if (changed) writeFileSync(file, contents, 'utf8');
  if (mode) {
    try { chmodSync(file, mode); } catch {}
  }
  return changed;
}

// npm scripts put node_modules/.bin first, and the git hooks do the same. A
// few Windows Python distributions expose Python 3 only as `python`; create
// the command spelling this repository already uses rather than rewriting
// every npm script and hook per operating system. The shim is an ignored
// development dependency artifact, never a tracked generated artifact.
function ensurePython3Command(root) {
  const bin = path.join(root, 'node_modules', '.bin');
  const shellPath = path.join(bin, 'python3');
  const cmdPath = path.join(bin, 'python3.cmd');
  const localShimExists = existsSync(shellPath) || existsSync(cmdPath);

  // npm puts the local bin directory first. An older checkout-created shim can
  // therefore make `python3` look usable while preventing setup from updating
  // that very shim. Prefer a native python3 only when there is no local shim to
  // maintain; otherwise rewrite the local pair to the current contract.
  if (!localShimExists && pythonVersion('python3')) return { failure: null, changed: false };
  if (!pythonVersion('python')) {
    return { failure: 'runtime python3: neither python3 nor a Python 3.10+ `python` command is usable', changed: false };
  }

  try { mkdirSync(bin, { recursive: true }); }
  catch (error) { return { failure: `runtime python3 shim: ${error.message}`, changed: false }; }

  try {
    const shell = '#!/bin/sh\nexport PYTHONUTF8=1 PYTHONIOENCODING=utf-8\nexec python -X utf8 "$@"\n';
    const cmd = '@ECHO OFF\r\nset PYTHONUTF8=1\r\nset PYTHONIOENCODING=utf-8\r\npython -X utf8 %*\r\n';
    const changed = writeIfChanged(shellPath, shell, 0o755) |
      writeIfChanged(cmdPath, cmd);
    return { failure: null, changed: Boolean(changed) };
  } catch (error) {
    return { failure: `runtime python3 shim: ${error.message}`, changed: false };
  }
}

export function ensureDependencies(root) {
  const failures = [];
  if (dependencyFailures(root).length) {
    const r = npm(root, ['install', '--include=dev', '--no-audit', '--no-fund'], {
      PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1',
    });
    if (r.status !== 0) failures.push(`npm install: ${text(r) || 'failed'}`);
  }

  const python = ensurePython3Command(root);
  if (python.failure) failures.push(python.failure);
  failures.push(...dependencyFailures(root));
  return { failures, pythonShimChanged: python.changed };
}

function hookEnvironment(root) {
  const shell = git(root, ['var', 'GIT_SHELL_PATH']);
  if (shell.status !== 0) return { env: process.env, shell: '', error: text(shell) || 'git var GIT_SHELL_PATH failed' };
  const shellPath = shell.stdout.trim();
  const dirs = [path.join(root, 'node_modules', '.bin'), path.dirname(shellPath), process.env.PATH || ''];
  return {
    shell: shellPath,
    env: {
      ...process.env,
      PATH: dirs.join(path.delimiter),
      PYTHONUTF8: '1',
      PYTHONIOENCODING: 'utf-8',
    },
    error: null,
  };
}

function shellHas(shell, env, command, check = '') {
  const quoted = command.replace(/'/g, `'"'"'`);
  const script = `command -v '${quoted}' >/dev/null 2>&1${check ? ` && ${check}` : ''}`;
  return run(shell, ['-c', script], { env }).status === 0;
}

function runtimeFailures(root) {
  const failures = [];
  const major = Number(process.versions.node.split('.')[0]);
  if (!Number.isInteger(major) || major < 22) {
    failures.push(`runtime node: ${process.version}; Node 22+ is required by the test glob`);
  }

  const npmVersion = npm(root, ['--version']);
  if (npmVersion.status !== 0) failures.push(`runtime npm CLI: ${text(npmVersion) || 'not usable'}`);

  const npmLauncher = terminalNpm(root);
  if (npmLauncher.status !== 0) {
    const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    failures.push(`runtime npm launcher: ${text(npmLauncher) || `the terminal command \`${command}\` is not usable`}`);
  }

  const hook = hookEnvironment(root);
  if (hook.error || !hook.shell || !existsSync(hook.shell)) {
    failures.push(`runtime git shell: ${hook.error || `${hook.shell || '(empty)'} is unavailable`}`);
    return failures;
  }

  const checks = [
    ['bash', 'bash', "bash -c 'exit 0'"],
    ['git', 'git', 'git --version >/dev/null 2>&1'],
    ['node 22+', 'node', "node -e 'process.exit(Number(process.versions.node.split(\".\")[0]) >= 22 ? 0 : 1)'"],
    ['npm', 'npm', 'npm --version >/dev/null 2>&1'],
    ['python3 3.10+', 'python3', "python3 -c 'import sys; raise SystemExit(sys.version_info < (3, 10))'"],
    ['grep', 'grep', "printf x | grep -q x"],
    ['sed', 'sed', "printf x | sed 's/x/x/' >/dev/null"],
  ];
  for (const [label, command, check] of checks) {
    if (!shellHas(hook.shell, hook.env, command, check)) {
      failures.push(`runtime ${label}: unavailable in Git's hook environment`);
    }
  }
  return failures;
}

function gitReadinessFailures(root) {
  const failures = [];
  const invalid = repoFailure(root);
  if (invalid) return [invalid];

  for (const [key, wanted] of [
    ['core.hooksPath', HOOK_PATH],
    ['merge.derived-csv.name', DRIVER_NAME],
    ['merge.derived-csv.driver', DRIVER_COMMAND],
  ]) {
    const actual = getConfig(root, key);
    if (actual !== wanted) failures.push(`${key}: expected ${JSON.stringify(wanted)}, found ${JSON.stringify(actual || '(unset)')}`);
  }

  const hooks = git(root, ['rev-parse', '--path-format=absolute', '--git-path', 'hooks']);
  if (hooks.status !== 0) {
    failures.push(`hooks path: ${text(hooks) || 'Git could not resolve it'}`);
  } else {
    const actual = hooks.stdout.trim();
    const wanted = path.join(root, HOOK_PATH);
    if (canonical(actual) !== canonical(wanted)) failures.push(`hooks path: expected ${wanted}, found ${actual}`);
    for (const name of REQUIRED_HOOKS) {
      const file = path.join(actual, name);
      if (!existsSync(file)) {
        failures.push(`hook ${name}: missing from ${actual}`);
        continue;
      }
      try { accessSync(file, fsConstants.X_OK); }
      catch { failures.push(`hook ${name}: not executable at ${file}`); }
    }
  }

  if (!existsSync(path.join(root, 'scripts', 'derived-csv-merge.mjs'))) {
    failures.push('merge driver: scripts/derived-csv-merge.mjs is missing');
  }
  const attr = git(root, ['check-attr', 'merge', '--', 'docs/docs.csv']);
  if (attr.status !== 0 || !/: merge: derived-csv\s*$/.test(attr.stdout.trim())) {
    failures.push(`merge attribute: expected docs/docs.csv -> derived-csv, found ${JSON.stringify(attr.stdout.trim() || text(attr) || '(unset)')}`);
  }
  return failures;
}

export function readiness(root, sections = ['git', 'runtime', 'dependencies']) {
  const failures = [];
  if (sections.includes('git')) failures.push(...gitReadinessFailures(root));
  if (sections.includes('runtime')) failures.push(...runtimeFailures(root));
  if (sections.includes('dependencies')) failures.push(...dependencyFailures(root));
  return failures;
}

function parseArgs(argv) {
  const options = { mode: 'setup', root: ownRoot, quiet: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--check') options.mode = 'check';
    else if (arg === '--git-only') options.mode = 'git-only';
    else if (arg === '--dependencies-only') options.mode = 'dependencies-only';
    else if (arg === '--quiet') options.quiet = true;
    else if (arg === '--root' && argv[i + 1]) options.root = path.resolve(argv[++i]);
    else throw new Error(`unknown argument: ${arg}`);
  }
  return options;
}

function report(failures, quiet) {
  if (failures.length) {
    console.error('checkout readiness: NOT READY');
    for (const failure of [...new Set(failures)]) console.error(`  - ${failure}`);
    return 1;
  }
  if (!quiet) console.log('checkout readiness: ready');
  return 0;
}

export function main(argv = process.argv.slice(2)) {
  let options;
  try { options = parseArgs(argv); }
  catch (error) { console.error(`checkout setup: ${error.message}`); return 2; }

  const { root, mode, quiet } = options;
  if (mode === 'check') return report(readiness(root), quiet);

  const failures = [];
  let sections;
  if (mode === 'git-only') {
    failures.push(...configureGit(root));
    sections = ['git'];
  } else if (mode === 'dependencies-only') {
    failures.push(...ensureDependencies(root).failures);
    sections = ['runtime', 'dependencies'];
  } else {
    failures.push(...configureGit(root));
    failures.push(...ensureDependencies(root).failures);
    sections = ['git', 'runtime', 'dependencies'];
  }
  failures.push(...readiness(root, sections));
  return report(failures, quiet);
}

if (process.argv[1] && canonical(process.argv[1]) === canonical(fileURLToPath(import.meta.url))) {
  process.exitCode = main();
}
