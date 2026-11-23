import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as nodeModule from 'node:module';
import { collectObservations, buildRunRecord, dependencyFingerprint, gitSource, writeRecord, relativePath, repositoryName } from '../testing/records.mjs';
import { boundSelection, childProfile, createOwnedTemp, removeOwnedTemp, verifyModuleMisses } from '../testing/run.mjs';

const cli = fileURLToPath(new URL('../testing/run.mjs', import.meta.url));
const observer = fileURLToPath(new URL('../testing/observe.cjs', import.meta.url));
const workerPath = 'node/test/a.test.mjs';
const environmentUnchanged = before => Object.keys(before).length === Object.keys(process.env).length &&
  Object.entries(before).every(([key, value]) => process.env[key] === value);
const observation = (extra = {}) => ({ schema: 'web-tools-test-observation/1', path: workerPath,
  pid: 123, started_at: '2026-11-23T00:00:00Z', finished_at: '2026-11-23T00:00:01Z',
  elapsed_ms: 1000, exit_code: 0, complete: true,
  files: ['lib/a.js'], directories: [], missing: [], opaque: [], ...extra });

function box(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'test-run-records-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function record(extra = {}) {
  return buildRunRecord({ source: { checkout_sha: 'a'.repeat(40), dirty: false },
    runtime: { node: process.versions.node, platform: process.platform }, mode: 'full',
    run: { id: 'fixture' }, startedAt: '2026-11-23T00:00:00Z', finishedAt: '2026-11-23T00:00:02Z',
    wallMs: 2000, exitCode: 0, observations: [observation()], expectedTests: [workerPath], ...extra });
}

test('records retain passing and failed complete runs with distinct wall and aggregate elapsed time', () => {
  const passing = record();
  assert.equal(passing.schema, 'web-tools-test-run/1');
  assert.equal(passing.complete, true);
  assert.equal(passing.wall_ms, 2000);
  assert.equal(passing.sum_process_wall_ms, 1000);
  const failed = record({ exitCode: 1, observations: [observation({ exit_code: 1 })] });
  assert.equal(failed.exit_code, 1);
  assert.equal(failed.tests[0].exit_code, 1);
  assert.equal(failed.complete, true);
});

test('missing, duplicate, unexpected and malformed workers cannot produce complete reach', () => {
  const missing = record({ expectedTests: [workerPath, 'node/test/b.test.mjs'] });
  assert.equal(missing.complete, false);
  assert.deepEqual(missing.tests[1].opaque, ['missing-observation']);
  const duplicate = record({ observations: [observation(), observation({ pid: 124 })] });
  assert.equal(duplicate.complete, false);
  assert.match(duplicate.observation_errors.join(' '), /Duplicate/);
  const unexpected = record({ observations: [observation({ path: 'node/test/foreign.test.mjs' })] });
  assert.equal(unexpected.complete, false);
  assert.match(unexpected.observation_errors.join(' '), /Unexpected/);
  const malformed = record({ observations: [observation({ files: ['../secret'] })] });
  assert.equal(malformed.complete, false);
});

test('optional external module misses are canonicalized and retained without changing older observations', t => {
  const canvas = { specifier: 'canvas', parent: 'node_modules/jsdom/lib/jsdom/utils.js' };
  const scoped = { specifier: '@example/optional/feature.js', parent: 'node_modules/@example/consumer/index.cjs' };
  const nested = { specifier: 'optional-package', parent: 'node_modules/consumer/node_modules/dependency/index.js' };
  const directory = box(t);
  fs.writeFileSync(path.join(directory, 'worker.json'), JSON.stringify(observation({ module_misses: [canvas, scoped, canvas, nested] })));
  const collected = collectObservations(directory);
  assert.deepEqual(collected.errors, []);
  assert.deepEqual(collected.observations[0].module_misses, [scoped, nested, canvas]);
  const captured = record({ observations: collected.observations });
  assert.equal(captured.complete, true);
  assert.deepEqual(captured.tests[0].module_misses, [scoped, nested, canvas]);
  assert.deepEqual(record({ observations: [observation({ module_misses: [] })] }).tests[0].module_misses, []);
  const older = record({ observations: [observation({ opaque: ['module-resolution-failed'] })] });
  assert.equal(Object.hasOwn(older.tests[0], 'module_misses'), false);
  assert.deepEqual(older.tests[0].opaque, ['module-resolution-failed']);
});

test('malformed external module misses make worker observations incomplete', t => {
  const parent = 'node_modules/jsdom/lib/jsdom/utils.js';
  const miss = { specifier: 'canvas', parent };
  const invalid = [null, {}, 'canvas', undefined, [null], [miss, { specifier: 'canvas' }],
    [{ ...miss, unexpected: true }],
    ...['', './canvas', '../canvas', '/canvas', 'C:/canvas', 'node:fs', 'https://example.test/canvas',
      '#canvas', '@scope', '@scope/', 'canvas/', 'canvas/../outside', 'canvas/./feature',
      'canvas\\feature', 'canvas\0feature', 'canvas%2ffeature', 'canvas?query'].map(specifier => [{ specifier, parent }]),
    ...['lib/utils.js', 'node_modules/jsdom', 'node_modules/@scope/jsdom', '../node_modules/jsdom/file.js',
      '/node_modules/jsdom/file.js', 'C:/node_modules/jsdom/file.js', 'node_modules/jsdom/../file.js',
      'node_modules\\jsdom\\file.js', 'node_modules//jsdom/file.js'].map(parent => [{ ...miss, parent }]),
  ];
  for (const module_misses of invalid) {
    const captured = record({ observations: [observation({ module_misses })] });
    assert.equal(captured.complete, false, JSON.stringify(module_misses));
    assert.match(captured.observation_errors.join(' '), /module_misses|repository-relative path/);
  }
  const directory = box(t);
  fs.writeFileSync(path.join(directory, 'malformed.json'), JSON.stringify(observation({ module_misses: [{ ...miss, parent: '../outside.js' }] })));
  const collected = collectObservations(directory);
  assert.deepEqual(collected.observations, []);
  assert.equal(collected.errors.length, 1);
});

test('shadow cost sums current picked worker elapsed time and leaves missing observations unknown', () => {
  const candidate = { schema: 'web-tools-test-selection/1', mode: 'selected', tests: [{ path: workerPath }], total: 2, selected: 1 };
  const full = record({ expectedTests: [workerPath, 'node/test/b.test.mjs'],
    observations: [observation(), observation({ path: 'node/test/b.test.mjs', elapsed_ms: 2000 })],
    candidateSelection: candidate });
  assert.equal(full.mode, 'full');
  assert.equal(full.tests.length, 2);
  assert.equal(full.sum_process_wall_ms, 3000);
  assert.equal(full.candidate_sum_process_wall_ms, 1000);
  assert.deepEqual(full.candidate_selection, candidate);
  assert.equal(record({ observations: [], candidateSelection: candidate }).candidate_sum_process_wall_ms, null);
});

test('collector retains valid workers while reporting corrupt records and rejecting traversal', t => {
  const directory = box(t);
  fs.writeFileSync(path.join(directory, 'good.json'), JSON.stringify(observation()));
  fs.writeFileSync(path.join(directory, 'partial.json'), '{');
  fs.writeFileSync(path.join(directory, 'escape.json'), JSON.stringify(observation({ missing: ['C:/outside'] })));
  const collected = collectObservations(directory);
  assert.equal(collected.observations.length, 1);
  assert.equal(collected.errors.length, 2);
  assert.equal(collectObservations(path.join(directory, 'absent')).errors.length, 1);
  assert.equal(relativePath('node\\test\\a.test.mjs'), workerPath);
  assert.equal(relativePath('.', { directory: true }), '.');
  for (const invalid of ['/absolute', '../outside', 'a/../outside', 'C:\\secret', '//server/share', 'a\0b']) {
    assert.throws(() => relativePath(invalid));
  }
});

test('records write atomically and dependency fingerprints change with package or lockfile inputs', t => {
  const directory = box(t), output = path.join(directory, 'nested', 'run.json');
  fs.writeFileSync(path.join(directory, 'package.json'), '{}');
  const first = dependencyFingerprint(directory);
  fs.writeFileSync(path.join(directory, 'package-lock.json'), '{"lockfileVersion":3}');
  assert.notEqual(first, dependencyFingerprint(directory));
  writeRecord(output, record());
  assert.equal(JSON.parse(fs.readFileSync(output)).schema, 'web-tools-test-run/1');
  writeRecord(output, record({ exitCode: 1 }));
  assert.equal(JSON.parse(fs.readFileSync(output)).exit_code, 1);
  assert.deepEqual(fs.readdirSync(path.dirname(output)), ['run.json']);
});

test('external module misses are rechecked after a manual dependency install without executing package code', t => {
  const root = path.join(box(t), 'repo');
  const parent = 'node_modules/optional-host/index.cjs';
  const specifier = 'web-tools-optional-module-miss-fixture';
  fs.mkdirSync(path.dirname(path.join(root, parent)), { recursive: true });
  fs.writeFileSync(path.join(root, parent), '// Optional dependency consumer.\n');
  fs.writeFileSync(path.join(root, 'package.json'), '{}');
  const captured = record({ observations: [observation({ module_misses: [{ specifier, parent }] })] });
  const fingerprint = dependencyFingerprint(root);
  assert.doesNotThrow(() => verifyModuleMisses(root, record()), 'older rows can omit module miss metadata');
  assert.throws(() => verifyModuleMisses(root, { tests: [{ module_misses: null }] }), /Invalid observation module_misses/);
  assert.doesNotThrow(() => verifyModuleMisses(root, captured));
  const installed = path.join(root, 'node_modules', specifier), executed = path.join(root, 'executed.txt');
  fs.mkdirSync(installed);
  fs.writeFileSync(path.join(installed, 'package.json'), JSON.stringify({ name: specifier, main: 'index.cjs' }));
  fs.writeFileSync(path.join(installed, 'index.cjs'), `require('node:fs').writeFileSync(${JSON.stringify(executed)}, 'executed');\n`);
  assert.equal(dependencyFingerprint(root), fingerprint, 'manual install did not alter dependency manifests');
  assert.throws(() => verifyModuleMisses(root, captured), /dependency lookup changed/);
  assert.equal(fs.existsSync(executed), false, 'lookup revalidation resolves package paths without running package code');
});

test('large selected argument lists fall back to the portable full-suite glob', () => {
  const plan = { mode: 'selected', source_sha: 'a'.repeat(40), tests: [{ path: 'a'.repeat(25000), reasons: [] }] };
  const bounded = boundSelection(plan, [workerPath]);
  assert.equal(bounded.mode, 'full');
  assert.equal(bounded.source_sha, plan.source_sha);
  assert.match(bounded.reason, /command length/);
  assert.equal(boundSelection({ ...plan, tests: [] }, [workerPath]).mode, 'selected');
});

test('GitHub repository provenance drops URL credentials, query strings and fragments', () => {
  assert.equal(repositoryName('https://user:secret@github.com/example/project.git?token=secret#secret'), 'example/project');
  assert.equal(repositoryName('git@github.com:example/project.git'), 'example/project');
  assert.equal(repositoryName('ssh://git@github.com/example/project.git'), 'example/project');
  assert.equal(repositoryName('https://github.com.unrelated.invalid/example/project'), null);
  assert.equal(repositoryName('C:/local/checkout'), null);
});

function fixture(t, failing = false) {
  const directory = box(t), root = path.join(directory, 'repo');
  fs.mkdirSync(path.join(root, 'node/test'), { recursive: true });
  fs.mkdirSync(path.join(root, 'docs'));
  fs.mkdirSync(path.join(root, 'lib'));
  fs.writeFileSync(path.join(root, '.gitignore'), 'node/.test-observations/\n');
  fs.writeFileSync(path.join(root, 'package.json'), '{"type":"module"}');
  fs.writeFileSync(path.join(root, 'docs/tests-authored.csv'), 'kind,path,protects\nbehavior,node/test/a.test.mjs,"A, with quoted prose"\n');
  fs.writeFileSync(path.join(root, 'node/test/runtime-command.cjs'), `require(${JSON.stringify(observer)});\n`);
  fs.writeFileSync(path.join(root, 'lib/a.js'), 'a');
  fs.writeFileSync(path.join(root, 'lib/b.js'), 'b');
  fs.writeFileSync(path.join(root, workerPath), `import test from 'node:test'; test('fixture A',()=>{${failing ? "throw new Error('expected fixture failure');" : ''}});\n`);
  fs.writeFileSync(path.join(root, 'node/test/b.test.mjs'), "import test from 'node:test'; test('fixture B',()=>{});\n");
  const git = args => {
    const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8', windowsHide: true });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  git(['init', '-q']); git(['add', '.']);
  git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'fixture']);
  return { directory, root, git };
}

function invoke(root, args, overrides = {}) {
  const env = { ...process.env, ...overrides };
  delete env.NODE_TEST_CONTEXT;
  delete env.WEB_TOOLS_TEST_OBSERVATIONS;
  return spawnSync(process.execPath, [cli, '--root', root, '--concurrency', '1', ...args],
    { env, encoding: 'utf8', timeout: process.platform === 'win32' ? 180000 : 90000, windowsHide: true });
}

test('temporary child profiles leave the parent environment and replaced cleanup roots untouched', t => {
  const parent = { ...process.env }, profile = childProfile(parent);
  t.after(() => removeOwnedTemp(profile.owned));
  for (const key of ['HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'XDG_CONFIG_HOME', 'CLAUDE_CONFIG_DIR', 'GIT_CONFIG_GLOBAL']) {
    assert.equal(path.relative(profile.owned.directory, profile.env[key]).startsWith('..'), false, key);
    assert.notEqual(profile.env[key], parent[key], key);
  }
  const envPath = Object.keys(parent).find(key => key.toLowerCase() === 'path');
  assert.equal(profile.env[envPath], parent[envPath]);
  assert.equal(profile.env.npm_execpath, parent.npm_execpath);
  assert.equal(profile.env.GIT_TERMINAL_PROMPT, '0');
  assert.equal(profile.env.GCM_INTERACTIVE, 'Never');
  assert.equal(environmentUnchanged(parent), true, 'parent environment is unchanged');

  const outside = box(t), sentinel = path.join(outside, 'keep.txt');
  fs.writeFileSync(sentinel, 'outside stays');
  const replaced = createOwnedTemp('wtr-');
  assert.equal(removeOwnedTemp(replaced), true);
  fs.symlinkSync(outside, replaced.directory, process.platform === 'win32' ? 'junction' : 'dir');
  t.after(() => fs.unlinkSync(replaced.directory));
  assert.equal(removeOwnedTemp(replaced), false);
  assert.equal(fs.readFileSync(sentinel, 'utf8'), 'outside stays');
});

test('Git source provenance ignores inherited checkout and index overrides', t => {
  const f = fixture(t), expected = f.git(['rev-parse', 'HEAD']);
  const overrides = { GIT_DIR: path.join(f.directory, 'wrong.git'), GIT_WORK_TREE: f.directory,
    GIT_INDEX_FILE: path.join(f.directory, 'wrong-index'), GIT_COMMON_DIR: path.join(f.directory, 'wrong-common') };
  const previous = Object.fromEntries(Object.keys(overrides).map(key => [key, process.env[key]]));
  try {
    Object.assign(process.env, overrides);
    const source = gitSource(f.root);
    assert.equal(source.checkout_sha, expected);
    assert.equal(source.dirty, false);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('CLI fixtures write USERPROFILE settings only inside the owned child profile', t => {
  const directory = box(t), root = path.join(directory, 'repo'), original = path.join(directory, 'original-profile');
  fs.mkdirSync(path.join(root, 'node/test'), { recursive: true });
  fs.mkdirSync(path.join(original, '.claude'), { recursive: true });
  const sentinel = path.join(original, '.claude/settings.json'), probe = path.join(directory, 'profile-probe.json');
  fs.writeFileSync(sentinel, 'original settings');
  fs.writeFileSync(path.join(root, 'node/test/runtime-command.cjs'), '');
  fs.writeFileSync(path.join(root, workerPath), `
import fs from 'node:fs'; import path from 'node:path'; import test from 'node:test';
test('profile write', () => {
  const target = path.join(process.env.USERPROFILE, '.claude/settings.json');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, 'fixture settings');
  fs.writeFileSync(process.env.PROFILE_PROBE_OUT, JSON.stringify({ target,
    home: process.env.HOME, userprofile: process.env.USERPROFILE,
    config: process.env.CLAUDE_CONFIG_DIR, git: fs.readFileSync(process.env.GIT_CONFIG_GLOBAL, 'utf8') }));
});
`);
  const before = { ...process.env }, output = path.join(directory, 'run.json');
  const result = invoke(root, ['--all', '--out', output], { HOME: original, USERPROFILE: original,
    CLAUDE_CONFIG_DIR: path.join(original, '.claude'), PROFILE_PROBE_OUT: probe });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(fs.readFileSync(sentinel, 'utf8'), 'original settings');
  const observed = JSON.parse(fs.readFileSync(probe));
  assert.notEqual(observed.userprofile, original);
  assert.equal(observed.home, observed.userprofile);
  assert.equal(observed.config, path.join(observed.userprofile, '.claude'));
  assert.match(observed.git, /test-runner@example.invalid/);
  assert.equal(fs.existsSync(observed.home), false, 'owned profile was cleaned after the run');
  assert.equal(JSON.parse(fs.readFileSync(output)).profile_isolation, 'temporary');
  assert.equal(environmentUnchanged(before), true, 'parent environment is unchanged');
});

test('CLI rejects incompatible reach and missing registries before attempting Git', t => {
  const directory = box(t), root = path.join(directory, 'repo'), snapshotFile = path.join(directory, 'reach.json');
  fs.mkdirSync(path.join(root, 'node/test'), { recursive: true });
  fs.mkdirSync(path.join(root, 'docs'));
  fs.writeFileSync(path.join(root, workerPath), '');
  fs.writeFileSync(path.join(root, 'docs/tests-authored.csv'), `path,kind,protects\n${workerPath},behavior,fixture\n`);
  writeRecord(snapshotFile, record({ runtime: { node: '0.0.0', platform: 'other' } }));
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  for (const key of Object.keys(env)) if (key.toLowerCase() === 'path') delete env[key];
  env.PATH = directory;
  const list = () => spawnSync(process.execPath, [cli, '--root', root, '--snapshot', snapshotFile, '--list'],
    { env, encoding: 'utf8', timeout: 90000, windowsHide: true });
  const incompatible = list();
  assert.equal(incompatible.status, 0, incompatible.stdout + incompatible.stderr);
  assert.match(incompatible.stdout, /full:/);
  assert.doesNotMatch(incompatible.stdout, /Cannot determine test changes/);
  assert.equal(fs.existsSync(path.join(root, 'node/.test-observations')), false);
  fs.unlinkSync(path.join(root, 'docs/tests-authored.csv'));
  const missing = list();
  assert.equal(missing.status, 0, missing.stdout + missing.stderr);
  assert.match(missing.stdout, /registry is missing/);
});

test('CLI lists fallback without writing, observes a full run, and preserves failed child status', t => {
  const passing = fixture(t);
  passing.git(['remote', 'add', 'origin', 'https://fixture-credential@github.com/example/project.git?token=fixture-secret']);
  const listed = invoke(passing.root, ['--list']);
  assert.equal(listed.status, 0, listed.stderr);
  assert.match(listed.stdout, /no observation baseline/);
  assert.equal(fs.existsSync(path.join(passing.root, 'node/.test-observations')), false);
  const output = path.join(passing.directory, 'full.json');
  const snapshotFile = path.join(passing.directory, 'reach.json');
  const baseline = record({ source: gitSource(passing.root),
    runtime: { node: process.versions.node, platform: process.platform, arch: process.arch,
      concurrency: 1, dependency_fingerprint: dependencyFingerprint(passing.root) },
    expectedTests: [workerPath, 'node/test/b.test.mjs'],
    observations: [observation(), observation({ path: 'node/test/b.test.mjs', files: ['lib/b.js'] })] });
  writeRecord(snapshotFile, baseline);
  const baselineBytes = fs.readFileSync(snapshotFile, 'utf8');
  fs.writeFileSync(path.join(passing.root, 'lib/a.js'), 'changed');
  const full = invoke(passing.root, ['--all', '--observe', '--snapshot', snapshotFile, '--out', output]);
  assert.equal(full.status, 0, full.stdout + full.stderr);
  const captured = JSON.parse(fs.readFileSync(output));
  assert.equal(captured.mode, 'full');
  assert.equal(captured.complete, true);
  assert.equal(captured.tests.length, 2);
  assert.equal(captured.source.checkout_sha, baseline.source.checkout_sha);
  assert.equal(captured.source.dirty, true);
  assert.equal(captured.selection.mode, 'full');
  assert.equal(captured.candidate_selection.mode, 'selected');
  assert.deepEqual(captured.candidate_selection.tests.map(row => row.path), [workerPath]);
  assert.equal(captured.candidate_sum_process_wall_ms, captured.tests.find(row => row.path === workerPath).elapsed_ms);
  assert.equal(fs.readFileSync(snapshotFile, 'utf8'), baselineBytes);
  assert.equal(captured.source.repo, 'example/project');
  assert.equal(JSON.stringify(captured.source).includes('fixture-credential'), false);
  assert.equal(JSON.stringify(captured.source).includes('fixture-secret'), false);
  const failing = fixture(t, true), failedOutput = path.join(failing.directory, 'failed.json');
  const failed = invoke(failing.root, ['--all', '--observe', '--out', failedOutput]);
  assert.equal(failed.status, 1, failed.stdout + failed.stderr);
  const failedRecord = JSON.parse(fs.readFileSync(failedOutput));
  assert.equal(failedRecord.exit_code, 1);
  assert.equal(failedRecord.candidate_selection.mode, 'full');
  assert.match(failedRecord.candidate_selection.reason, /no observation baseline/);
});

test('CLI selects only observed readers, preserves failure status, and retains local run history', t => {
  const f = fixture(t, true), snapshotFile = path.join(f.directory, 'reach.json');
  const output = path.join(f.root, 'node/.test-observations/run.json');
  const snapshot = record({ source: gitSource(f.root), runtime: { node: process.versions.node, platform: process.platform,
    arch: process.arch, concurrency: 1, dependency_fingerprint: dependencyFingerprint(f.root) },
    expectedTests: [workerPath, 'node/test/b.test.mjs'],
    observations: [observation(), observation({ path: 'node/test/b.test.mjs', files: ['lib/b.js'] })] });
  writeRecord(snapshotFile, snapshot);
  const before = fs.readFileSync(snapshotFile, 'utf8');
  fs.writeFileSync(path.join(f.root, 'lib/a.js'), 'changed');
  const result = invoke(f.root, ['--snapshot', snapshotFile]);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  const selected = JSON.parse(fs.readFileSync(output));
  assert.equal(selected.mode, 'selected');
  assert.deepEqual(selected.tests.map(row => row.path), [workerPath]);
  assert.equal(selected.complete, false, 'unobserved selected runs cannot become a baseline');
  assert.equal(selected.exit_code, 1);
  const history = fs.readdirSync(path.join(f.root, 'node/.test-observations/runs'));
  assert.equal(history.length, 1);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.root, 'node/.test-observations/runs', history[0]))), selected);
  assert.equal(fs.readFileSync(snapshotFile, 'utf8'), before);
});

test('CLI retains and reuses a clean local full baseline without promoting a selected run', {
  skip: typeof nodeModule.registerHooks !== 'function' && 'Module observations need module.registerHooks',
}, t => {
  const f = fixture(t), baselinePath = path.join(f.root, 'node/.test-observations/baseline.json');
  fs.mkdirSync(path.join(f.root, 'data/tests'), { recursive: true });
  const publicSnapshot = path.join(f.root, 'data/tests/reach.json');
  fs.writeFileSync(publicSnapshot, '{"schema":"incompatible-public-snapshot"}\n');
  for (const name of ['a', 'b']) {
    fs.writeFileSync(path.join(f.root, `node/test/${name}.test.mjs`), `
import fs from 'node:fs'; import test from 'node:test';
test('observed ${name}', () => fs.readFileSync(new URL('../../lib/${name}.js', import.meta.url), 'utf8'));
`);
  }
  f.git(['add', '.']);
  f.git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'observe real fixture inputs']);
  const publicBytes = fs.readFileSync(publicSnapshot, 'utf8');
  const localRun = { GITHUB_RUN_ID: '', GITHUB_RUN_ATTEMPT: '', GITHUB_EVENT_NAME: 'local-fixture' };
  const full = invoke(f.root, ['--all', '--observe'], localRun);
  assert.equal(full.status, 0, full.stdout + full.stderr);
  const baselineBytes = fs.readFileSync(baselinePath, 'utf8'), baseline = JSON.parse(baselineBytes);
  assert.equal(baseline.mode, 'full');
  assert.equal(baseline.complete, true);
  assert.equal(baseline.source.dirty, false);
  assert.equal(baseline.tests.length, 2);
  for (const field of ['selection_wall_ms', 'preparation_wall_ms', 'wall_ms', 'total_wall_ms']) {
    assert.equal(Number.isFinite(baseline[field]) && baseline[field] >= 0, true, `${field} is a nonnegative duration`);
  }
  assert.equal(baseline.selection_wall_ms <= baseline.preparation_wall_ms, true);
  assert.equal(baseline.preparation_wall_ms + baseline.wall_ms <= baseline.total_wall_ms + 1, true);
  assert.equal(Date.parse(baseline.invoked_at) <= Date.parse(baseline.started_at), true);
  assert.equal(Date.parse(baseline.started_at) <= Date.parse(baseline.finished_at), true);

  fs.writeFileSync(path.join(f.root, 'lib/a.js'), 'changed');
  const selectedResult = invoke(f.root, ['--observe'], localRun);
  assert.equal(selectedResult.status, 0, selectedResult.stdout + selectedResult.stderr);
  const selected = JSON.parse(fs.readFileSync(path.join(f.root, 'node/.test-observations/run.json')));
  assert.equal(selected.mode, 'selected', 'the ignored baseline takes precedence over the incompatible public snapshot');
  assert.equal(selected.complete, true);
  assert.deepEqual(selected.tests.map(row => row.path), [workerPath]);
  assert.equal(selected.selection.source_sha, baseline.source.checkout_sha);
  assert.equal(fs.readFileSync(baselinePath, 'utf8'), baselineBytes, 'selected observations do not replace the full baseline');
  assert.equal(fs.readFileSync(publicSnapshot, 'utf8'), publicBytes);
  assert.equal(fs.readdirSync(path.join(f.root, 'node/.test-observations/runs')).length, 2);
});
