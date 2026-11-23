import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { collectObservations, buildRunRecord, dependencyFingerprint, gitSource, writeRecord, relativePath, repositoryName } from '../testing/records.mjs';
import { boundSelection } from '../testing/run.mjs';

const cli = fileURLToPath(new URL('../testing/run.mjs', import.meta.url));
const observer = fileURLToPath(new URL('../testing/observe.cjs', import.meta.url));
const workerPath = 'node/test/a.test.mjs';
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

function invoke(root, args) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  delete env.WEB_TOOLS_TEST_OBSERVATIONS;
  return spawnSync(process.execPath, [cli, '--root', root, '--concurrency', '1', ...args],
    { env, encoding: 'utf8', timeout: 90000, windowsHide: true });
}

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
