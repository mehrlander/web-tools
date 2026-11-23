// Observed reach narrows the inner work loop. Full preflight remains independent.
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const RUN_SCHEMA = 'web-tools-test-run/1';
const PLAN_SCHEMA = 'web-tools-test-selection/1';
const shaPattern = /^(?:[a-f\d]{40}|[a-f\d]{64})$/i;
const broadPaths = new Set([
  'package.json', 'package-lock.json', 'npm-shrinkwrap.json', '.npmrc',
  '.node-version', '.nvmrc', '.web-tools.json',
  'node/test/bootstrap.mjs', 'node/test/runtime-command.cjs',
  'node/repo-root.mjs', 'docs/tests-authored.csv',
]);

function relativePath(value, directory = false) {
  if (directory && value === '.') return true;
  return typeof value === 'string' && value.length > 0 &&
    !value.includes('\0') && !value.includes('\\') && !value.includes(':') &&
    !path.posix.isAbsolute(value) &&
    value.split('/').every(part => part && part !== '.' && part !== '..');
}

function nodeVersion(value) {
  return typeof value === 'string' && /^v?\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(value)
    ? value.replace(/^v/, '') : null;
}

function broadChange(value) {
  return broadPaths.has(value) || value.startsWith('node/testing/') ||
    value.startsWith('.github/') || value.startsWith('.githooks/') ||
    /(?:^|\/)(?:package\.json|package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?|\.npmrc)$/.test(value) ||
    /(?:^|\/)[^/]+\.config\.(?:[cm]?js|json|ts)$/.test(value);
}

function opaque(row) {
  return row.opaque === true || (Array.isArray(row.opaque) && row.opaque.length > 0);
}

function validRow(row) {
  return row && typeof row === 'object' && relativePath(row.path) &&
    (row.elapsed_ms === null || (Number.isFinite(row.elapsed_ms) && row.elapsed_ms >= 0)) &&
    row.exit_code === 0 && row.complete === true &&
    ['files', 'directories', 'missing'].every(key => Array.isArray(row[key]) &&
      row[key].every(value => relativePath(value, key === 'directories'))) &&
    (typeof row.opaque === 'boolean' || (Array.isArray(row.opaque) &&
      row.opaque.every(value => typeof value === 'string')));
}

/** Plan from an observed full run. Unknown inputs select the full current suite. */
export function planSelection({ snapshot, tests, gates = [], changedPaths = [], runtime } = {}) {
  if (!Array.isArray(tests) || tests.some(value => !relativePath(value)))
    throw new Error('Test selection requires repo-relative current test paths.');
  const current = [...new Set(tests)].sort();
  const gateSet = new Set(gates);
  const source = typeof snapshot?.source?.checkout_sha === 'string'
    ? snapshot.source.checkout_sha : null;
  const rows = new Map();
  const estimate = file => {
    const value = rows.get(file)?.elapsed_ms;
    return Number.isFinite(value) && value >= 0 ? value : null;
  };
  const result = (mode, reason, picks) => {
    const selected = picks.map(([file, reasons]) => ({ path: file, reasons, estimated_ms: estimate(file) }));
    return {
      schema: PLAN_SCHEMA, mode, reason, source_sha: source,
      tests: selected, total: current.length, selected: selected.length,
      estimated_ms: selected.every(row => row.estimated_ms !== null)
        ? selected.reduce((sum, row) => sum + row.estimated_ms, 0) : null,
    };
  };
  const full = reason => result('full', reason, current.map(file => [file, [reason]]));

  if (!snapshot || snapshot.schema !== RUN_SCHEMA) return full('No compatible full-run snapshot.');
  if (!snapshot.source || !shaPattern.test(source || '') || snapshot.source.dirty !== false)
    return full('Snapshot source is missing, invalid, or dirty.');
  if (snapshot.mode !== 'full' || snapshot.complete !== true || snapshot.exit_code !== 0)
    return full('Snapshot is not a completed, passing full run.');
  const previousVersion = nodeVersion(snapshot.runtime?.node);
  const currentVersion = nodeVersion(runtime?.node);
  if (previousVersion === null || currentVersion === null || previousVersion !== currentVersion ||
      !runtime?.platform || snapshot.runtime?.platform !== runtime.platform ||
      !runtime?.arch || snapshot.runtime?.arch !== runtime.arch)
    return full('Snapshot platform, architecture, or exact Node version does not match this venue.');
  if (runtime.dependency_fingerprint !== undefined &&
      (typeof runtime.dependency_fingerprint !== 'string' || !runtime.dependency_fingerprint ||
       snapshot.runtime?.dependency_fingerprint !== runtime.dependency_fingerprint))
    return full('Snapshot dependency fingerprint does not match this checkout.');
  if (!Array.isArray(snapshot.tests) || snapshot.tests.some(row => !validRow(row)))
    return full('Snapshot test records are malformed, failed, or incomplete.');
  for (const row of snapshot.tests) {
    if (rows.has(row.path)) return full('Snapshot contains duplicate test records.');
    rows.set(row.path, row);
  }
  if (!Array.isArray(changedPaths) || changedPaths.some(value => !relativePath(value)))
    return full('Changed paths are not valid repo-relative paths.');
  const changed = [...new Set(changedPaths)].sort();
  const broad = changed.find(broadChange);
  if (broad) return full(`Shared test infrastructure changed: ${broad}`);

  const picks = new Map();
  const add = (file, reason) => {
    if (!picks.has(file)) picks.set(file, new Set());
    picks.get(file).add(reason);
  };
  const covered = new Set();
  for (const file of current) {
    const row = rows.get(file);
    if (gateSet.has(file)) add(file, 'Always-run gate.');
    if (!row) add(file, 'No observed reach for this test.');
    else if (opaque(row)) add(file, 'Observed run has untracked dependencies.');
    for (const change of changed) {
      if (change === file) {
        covered.add(change);
        add(file, `Test changed: ${change}`);
      }
      if (!row) continue;
      if (row.files.includes(change)) {
        covered.add(change);
        add(file, `Reads: ${change}`);
      }
      for (const directory of row.directories) {
        if (directory === '.' || change === directory || change.startsWith(directory + '/')) {
          covered.add(change);
          add(file, `Lists directory: ${directory}`);
        }
      }
      for (const missing of row.missing) {
        if (change === missing || change.startsWith(missing + '/') || missing.startsWith(change + '/')) {
          covered.add(change);
          add(file, `Checks absent path: ${missing}`);
        }
      }
    }
  }
  // A removed test is no longer runnable; current gates still check inventory.
  // Every other unobserved change conservatively expands to the full suite.
  const unknown = changed.find(change => change !== 'data/tests/reach.json' && !covered.has(change) &&
    !(change.endsWith('.test.mjs') && rows.has(change) && !current.includes(change)));
  if (unknown) return full(`No observed reader accounts for changed path: ${unknown}`);
  return result('selected', 'Selected from observed reach; full preflight remains required.',
    [...picks].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([file, reasons]) => [file, [...reasons].sort()]));
}

function git(root, args) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) =>
    !/^GIT_(?:DIR|WORK_TREE|INDEX_FILE|COMMON_DIR|OBJECT_DIRECTORY|ALTERNATE_OBJECT_DIRECTORIES|PREFIX|NAMESPACE|CEILING_DIRECTORIES)$/i.test(name)));
  const result = spawnSync('git', ['-C', root, '-c', 'core.fsmonitor=false', ...args], {
    encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024, timeout: 30000,
    env,
  });
  if (result.error || result.status !== 0) {
    const detail = result.error?.message || result.stderr?.trim() || `exit ${result.status}`;
    throw new Error(`Cannot determine test changes (git ${args[0]}): ${detail}`);
  }
  return result.stdout;
}

function nulPaths(value) {
  return value.split('\0').filter(Boolean);
}

/** Changes are based on the snapshot revision itself, never a newer merge base. */
export function changesSince(root, sha) {
  if (typeof sha !== 'string' || !shaPattern.test(sha))
    throw new Error('Test snapshot needs a full source commit SHA.');
  git(root, ['rev-parse', '--verify', `${sha}^{commit}`]);
  try {
    git(root, ['merge-base', '--is-ancestor', sha, 'HEAD']);
  } catch (error) {
    throw new Error(`Test snapshot source is not an available ancestor of HEAD. ${error.message}`);
  }
  // --no-renames exposes rename source and destination as deletion/addition.
  // NUL delimiters preserve whitespace and newlines in tracked and new names.
  return [...new Set([
    ...nulPaths(git(root, ['diff', '--name-only', '-z', '--no-renames', '--no-ext-diff', '--no-textconv', sha, 'HEAD', '--'])),
    ...nulPaths(git(root, ['diff', '--cached', '--name-only', '-z', '--no-renames', '--no-ext-diff', '--no-textconv', '--'])),
    ...nulPaths(git(root, ['diff', '--name-only', '-z', '--no-renames', '--no-ext-diff', '--no-textconv', '--'])),
    ...nulPaths(git(root, ['ls-files', '--others', '--exclude-standard', '-z', '--'])),
  ])].sort();
}

/** Match npm test's recursive .test.mjs population without following symlinks. */
export function testFiles(root) {
  const found = [];
  const walk = relative => {
    for (const entry of readdirSync(path.join(root, relative), { withFileTypes: true })) {
      const file = `${relative}/${entry.name}`;
      if (entry.isSymbolicLink())
        throw new Error(`Test discovery cannot safely account for symlink: ${file}`);
      if (entry.isDirectory()) walk(file);
      else if (entry.isFile() && entry.name.endsWith('.test.mjs')) found.push(file);
    }
  };
  walk('node/test');
  return found.sort();
}
