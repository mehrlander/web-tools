import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { planSelection, changesSince, testFiles } from '../testing/select.mjs';

const sha = 'a'.repeat(40);
const runtime = { node: 'v22.24.0', platform: 'linux', arch: 'x64' };
const alpha = 'node/test/alpha.test.mjs';
const beta = 'node/test/beta.test.mjs';
const gate = 'node/test/gate.test.mjs';
const row = (file, extra = {}) => ({
  path: file, elapsed_ms: 20, exit_code: 0, complete: true,
  files: [file], directories: [], missing: [], opaque: [], ...extra,
});
const snapshot = (extra = {}) => ({
  schema: 'web-tools-test-run/1', source: { checkout_sha: sha, dirty: false },
  runtime, mode: 'full', complete: true, exit_code: 0,
  tests: [row(alpha, { files: [alpha, 'lib/alpha.js'] }),
    row(beta, { files: [beta, 'lib/beta.js'] }), row(gate)], ...extra,
});
const plan = (extra = {}) => planSelection({
  snapshot: snapshot(), tests: [alpha, beta, gate], gates: [gate],
  changedPaths: ['lib/alpha.js'], runtime, ...extra,
});
const picked = result => result.tests.map(row => row.path);

test('a source change reaches its reader and the gates, without selecting an unrelated test', () => {
  const result = plan();
  assert.equal(result.mode, 'selected');
  assert.deepEqual(picked(result), [alpha, gate]);
  assert.ok(result.tests[0].reasons.includes('Reads: lib/alpha.js'));
  assert.equal(result.estimated_ms, 40);
  assert.equal(result.total, 3);
  assert.equal(result.source_sha, sha);
});

test('a changed test and a new test run even when no previous row reads them', () => {
  const fresh = 'node/test/fresh.test.mjs';
  const result = plan({ tests: [alpha, beta, gate, fresh], changedPaths: [beta, fresh] });
  assert.equal(result.mode, 'selected');
  assert.deepEqual(picked(result), [beta, fresh, gate]);
  assert.equal(result.tests.find(row => row.path === fresh).estimated_ms, null);
  assert.equal(result.estimated_ms, null);
});

test('directory membership and a formerly absent path select their observers', () => {
  const observed = snapshot({ tests: [
    row(alpha, { directories: ['lib/plugins'] }),
    row(beta, { missing: ['optional/feature.json'] }), row(gate),
  ] });
  for (const changedPaths of [['lib/plugins/new.js'], ['lib/plugins/deleted.js']]) {
    const result = plan({ snapshot: observed, changedPaths });
    assert.equal(result.mode, 'selected');
    assert.deepEqual(picked(result), [alpha, gate]);
  }
  const negative = plan({ snapshot: observed, changedPaths: ['optional/feature.json'] });
  assert.equal(negative.mode, 'selected');
  assert.deepEqual(picked(negative), [beta, gate]);
});

test('opaque and missing-row tests remain in the always-run population', () => {
  const observed = snapshot({ tests: [row(alpha, { opaque: ['spawn:python3'] }), row(gate)] });
  const result = plan({ snapshot: observed, changedPaths: [] });
  assert.equal(result.mode, 'selected');
  assert.deepEqual(picked(result), [alpha, beta, gate]);
  assert.ok(result.tests.find(row => row.path === alpha).reasons.some(reason => reason.includes('untracked')));
  assert.ok(result.tests.find(row => row.path === beta).reasons.some(reason => reason.includes('No observed')));
});

test('external module miss metadata permits selection while older opaque module failures stay selected', () => {
  const observed = snapshot({ tests: [
    row(alpha, { files: [alpha, 'lib/alpha.js'], opaque: ['module-resolution-failed'] }),
    row(beta, { module_misses: [{ specifier: 'canvas', parent: 'node_modules/jsdom/lib/jsdom/utils.js' }] }), row(gate),
  ] });
  const result = plan({ snapshot: observed, changedPaths: [] });
  assert.equal(result.mode, 'selected');
  assert.deepEqual(picked(result), [alpha, gate]);
  assert.ok(result.tests.find(row => row.path === alpha).reasons.some(reason => reason.includes('untracked')));
});

test('malformed external module miss metadata cannot narrow a baseline', () => {
  const miss = { specifier: 'canvas', parent: 'node_modules/jsdom/lib/jsdom/utils.js' };
  for (const module_misses of [null, {}, undefined, [null], [{ ...miss, specifier: '../outside' }],
    [{ ...miss, specifier: 'file:///outside.js' }], [{ ...miss, specifier: 'canvas/../outside' }],
    [{ ...miss, parent: 'lib/project.js' }], [{ ...miss, parent: '../node_modules/jsdom/utils.js' }],
    [{ ...miss, parent: 'node_modules\\jsdom\\utils.js' }], [{ ...miss, unexpected: true }]]) {
    const result = plan({ snapshot: snapshot({ tests: [row(alpha, { module_misses }), row(beta), row(gate)] }) });
    assert.equal(result.mode, 'full', JSON.stringify(module_misses));
    assert.match(result.reason, /malformed/);
    assert.deepEqual(picked(result), [alpha, beta, gate]);
  }
});

test('unobserved code and shared test infrastructure expand to the complete suite', () => {
  for (const changedPaths of [['lib/unseen.js'], ['node/test/bootstrap.mjs'],
    ['package.json'], ['nested/package.json'], ['nested/package-lock.json'], ['nested/.npmrc'],
    ['.github/workflows/test.yml'], ['node/testing/select.mjs']]) {
    const result = plan({ changedPaths });
    assert.equal(result.mode, 'full', changedPaths[0]);
    assert.deepEqual(picked(result), [alpha, beta, gate]);
  }
});

test('publishing only the reach snapshot still runs gates without forcing unrelated tests', () => {
  const result = plan({ changedPaths: ['data/tests/reach.json'] });
  assert.equal(result.mode, 'selected');
  assert.deepEqual(picked(result), [gate]);
  assert.equal(plan({ changedPaths: ['data/tests/other.json'] }).mode, 'full');
});

test('missing, selected, failed, dirty, malformed and partial snapshots cannot narrow a run', () => {
  const faults = [null, {}, snapshot({ mode: 'selected' }), snapshot({ complete: false }),
    snapshot({ exit_code: 1 }), snapshot({ source: { checkout_sha: sha, dirty: true } }),
    snapshot({ source: { checkout_sha: 'main', dirty: false } }),
    snapshot({ tests: [row(alpha, { complete: false })] }),
    snapshot({ tests: [row(alpha, { exit_code: 1 })] }),
    snapshot({ tests: [row(alpha, { elapsed_ms: -1 })] }),
    snapshot({ tests: [row(alpha), row(alpha)] })];
  for (const broken of faults) {
    const result = plan({ snapshot: broken });
    assert.equal(result.mode, 'full', JSON.stringify(broken));
    assert.deepEqual(picked(result), [alpha, beta, gate]);
  }
});

test('selection requires the same platform, architecture and exact Node version', () => {
  for (const other of [{ ...runtime, platform: 'win32' }, { ...runtime, node: 'v24.1.0' },
    { ...runtime, node: 'v22.24.1' }, { ...runtime, arch: 'arm64' }, {}])
    assert.equal(plan({ runtime: other }).mode, 'full');
  assert.equal(plan({ runtime: { ...runtime, node: '22.24.0' } }).mode, 'selected');
});

test('changed or missing dependency fingerprints cannot reuse an observed baseline', () => {
  const venue = { ...runtime, dependency_fingerprint: 'current-dependencies' };
  assert.equal(plan({ runtime: venue }).mode, 'full');
  const observed = snapshot({ runtime: { ...runtime, dependency_fingerprint: 'old-dependencies' } });
  assert.equal(plan({ snapshot: observed, runtime: venue }).mode, 'full');
  observed.runtime.dependency_fingerprint = venue.dependency_fingerprint;
  assert.equal(plan({ snapshot: observed, runtime: venue }).mode, 'selected');
});

test('untrusted snapshot dependencies cannot escape the repository path space', () => {
  for (const unsafe of ['../outside', '/outside', 'C:/outside', 'lib/../../outside', 'lib\\outside', 'lib/./outside']) {
    const broken = snapshot({ tests: [row(alpha, { files: [unsafe] })] });
    assert.equal(plan({ snapshot: broken }).mode, 'full', unsafe);
  }
  const rootReader = snapshot({ tests: [row(alpha, { directories: ['.'] }), row(beta), row(gate)] });
  assert.deepEqual(picked(plan({ snapshot: rootReader, changedPaths: ['some/new/file'] })), [alpha, gate]);
});

function fixture(t, repository = true) {
  const temporary = mkdtempSync(path.join(os.tmpdir(), 'web-tools-test-selection-'));
  const root = path.join(temporary, 'repo');
  const globalConfig = path.join(temporary, 'gitconfig');
  mkdirSync(root);
  writeFileSync(globalConfig, '');
  t.after(() => rmSync(temporary, { recursive: true, force: true }));
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^GIT_/i.test(name)));
  const git = (...args) => execFileSync('git', ['-C', root,
    '-c', 'user.name=Test Selection', '-c', 'user.email=test-selection@example.invalid',
    '-c', 'core.autocrlf=false', '-c', 'commit.gpgSign=false', ...args], {
    encoding: 'utf8', windowsHide: true, timeout: 30000,
    env: { ...env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: globalConfig, GIT_CONFIG_COUNT: '0' },
  }).trim();
  if (repository) git('init', '--quiet');
  const write = (file, text = file) => {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), text);
  };
  return { root, git, write };
}

test('Git changes include baseline commits, both rename names, staged, unstaged and untracked files', t => {
  const { root, git, write } = fixture(t);
  for (const file of ['old name.js', 'staged.js', 'unstaged.js', 'deleted.js', 'committed.js']) write(file);
  git('add', '--all');
  git('commit', '--quiet', '-m', 'fixture baseline');
  const baseline = git('rev-parse', 'HEAD');
  write('committed.js', 'committed change');
  git('add', 'committed.js');
  git('commit', '--quiet', '-m', 'fixture branch change');
  renameSync(path.join(root, 'old name.js'), path.join(root, 'new name.js'));
  write('staged.js', 'staged change');
  git('add', '--all');
  write('unstaged.js', 'unstaged change');
  rmSync(path.join(root, 'deleted.js'));
  write('untracked space.js');
  const previousGitDir = process.env.GIT_DIR;
  process.env.GIT_DIR = path.join(root, 'not-the-repository');
  try {
    assert.deepEqual(changesSince(root, baseline), [
      'committed.js', 'deleted.js', 'new name.js', 'old name.js',
      'staged.js', 'unstaged.js', 'untracked space.js',
    ]);
  } finally {
    if (previousGitDir === undefined) delete process.env.GIT_DIR;
    else process.env.GIT_DIR = previousGitDir;
  }
});

test('an unknown or nonancestor baseline cannot silently produce an empty diff', t => {
  const { root, git, write } = fixture(t);
  write('file.js');
  git('add', '--all');
  git('commit', '--quiet', '-m', 'first fixture');
  const first = git('rev-parse', 'HEAD');
  write('file.js', 'second version');
  git('add', '--all');
  git('commit', '--quiet', '-m', 'second fixture');
  const later = git('rev-parse', 'HEAD');
  git('checkout', '--quiet', '--detach', first);
  assert.throws(() => changesSince(root, later), /not an available ancestor/);
  assert.throws(() => changesSince(root, 'f'.repeat(40)), /Cannot determine test changes/);
  assert.throws(() => changesSince(root, 'main'), /full source commit SHA/);
});

test('NUL-delimited Git changes preserve filenames containing newlines', { skip: process.platform === 'win32' }, t => {
  const { root, git, write } = fixture(t);
  write('baseline.js');
  git('add', '--all');
  git('commit', '--quiet', '-m', 'newline fixture');
  const baseline = git('rev-parse', 'HEAD');
  write('line\nbreak.js');
  assert.deepEqual(changesSince(root, baseline), ['line\nbreak.js']);
});

test('test discovery includes nested suite files and excludes browser scripts and unrelated files', t => {
  const { root, write } = fixture(t, false);
  for (const file of ['node/test/z.test.mjs', 'node/test/nested/a.test.mjs',
    'node/test/browser.mjs', 'node/test/not-a-test.js', 'other/other.test.mjs']) write(file);
  assert.deepEqual(testFiles(root), ['node/test/nested/a.test.mjs', 'node/test/z.test.mjs']);
});
