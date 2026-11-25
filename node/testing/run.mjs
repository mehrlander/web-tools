import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { repoRoot as defaultRoot } from '../repo-root.mjs';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { parseCsv } from '../build/registries-load.mjs';
import { planSelection, changesSince, testFiles } from './select.mjs';
import { collectObservations, buildRunRecord, dependencyFingerprint, gitSource, writeRecord, normalizeModuleMisses } from './records.mjs';
import { baselineEligible } from './publish.mjs';

const pathKey = value => process.platform === 'win32' ? path.resolve(value).toLowerCase() : path.resolve(value);

export function createOwnedTemp(prefix) {
  const parent = fs.realpathSync(os.tmpdir());
  const directory = fs.mkdtempSync(path.join(parent, prefix));
  const marker = randomUUID();
  fs.writeFileSync(path.join(directory, '.test-run-owner'), marker, { flag: 'wx' });
  const identity = fs.lstatSync(directory);
  return { directory, parent, real: fs.realpathSync(directory), marker, dev: identity.dev, ino: identity.ino };
}

export function removeOwnedTemp(owned) {
  if (!owned) return true;
  try {
    const current = fs.lstatSync(owned.directory);
    const marker = () => fs.lstatSync(path.join(owned.directory, '.test-run-owner'));
    // A child can replace its temporary root with a junction. Never traverse
    // a replacement, even when the replacement still has the expected name.
    if (!current.isDirectory() || current.isSymbolicLink() || current.dev !== owned.dev || current.ino !== owned.ino ||
        pathKey(fs.realpathSync(owned.directory)) !== pathKey(owned.real) ||
        pathKey(fs.realpathSync(path.dirname(owned.directory))) !== pathKey(owned.parent) ||
        path.dirname(pathKey(owned.directory)) !== pathKey(owned.parent) ||
        !marker().isFile() || marker().isSymbolicLink() ||
        fs.readFileSync(path.join(owned.directory, '.test-run-owner'), 'utf8') !== owned.marker) {
      console.warn('Test runner retained a temporary directory whose ownership changed.');
      return false;
    }
    fs.rmSync(owned.directory, { recursive: true, force: true });
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return true;
    console.warn(`Test runner could not clean its temporary directory: ${error.message}`);
    return false;
  }
}

export function childProfile(environment = process.env) {
  const owned = createOwnedTemp('wtp-');
  const home = path.join(owned.directory, 'home');
  const locations = {
    HOME: home, USERPROFILE: home,
    APPDATA: path.join(home, 'AppData/Roaming'), LOCALAPPDATA: path.join(home, 'AppData/Local'),
    XDG_CONFIG_HOME: path.join(home, '.config'), CLAUDE_CONFIG_DIR: path.join(home, '.claude'),
  };
  try {
    for (const directory of new Set(Object.values(locations))) fs.mkdirSync(directory, { recursive: true });
    const globalConfig = path.join(owned.directory, 'gitconfig');
    fs.writeFileSync(globalConfig, '[user]\n\tname = Test Runner\n\temail = test-runner@example.invalid\n');
    const env = { ...environment };
    const replaced = new Set([...Object.keys(locations), 'GIT_CONFIG_GLOBAL', 'GIT_CONFIG_SYSTEM', 'GIT_CONFIG_NOSYSTEM',
      'GIT_TERMINAL_PROMPT', 'GCM_INTERACTIVE'].map(key => key.toLowerCase()));
    for (const key of Object.keys(env)) if (replaced.has(key.toLowerCase())) delete env[key];
    Object.assign(env, locations, { GIT_CONFIG_GLOBAL: globalConfig, GIT_CONFIG_NOSYSTEM: '1',
      GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never' });
    return { owned, env };
  } catch (error) { removeOwnedTemp(owned); throw error; }
}

export function parseArguments(argv) {
  const options = { all: false, list: false, observe: false,
    concurrency: Math.max(1, Math.min(4, os.availableParallelism() - 1)), root: defaultRoot };
  for (let index = 0; index < argv.length; index++) {
    const flag = argv[index];
    if (['--all', '--list', '--observe', '--help'].includes(flag)) options[flag.slice(2)] = true;
    else if (['--out', '--snapshot', '--base', '--concurrency', '--root'].includes(flag)) {
      if (!argv[index + 1] || argv[index + 1].startsWith('--')) throw new Error(`${flag} needs a value`);
      options[flag.slice(2)] = argv[++index];
    } else throw new Error(`Unknown argument: ${flag}`);
  }
  options.concurrency = Number(options.concurrency);
  if (!Number.isInteger(options.concurrency) || options.concurrency < 1) throw new Error('--concurrency must be a positive integer');
  options.root = path.resolve(options.root);
  return options;
}

function gateFiles(root) {
  const file = path.join(root, 'docs/tests-authored.csv');
  if (!fs.existsSync(file)) throw new Error('Test registry is missing');
  const rows = parseCsv(fs.readFileSync(file, 'utf8'));
  if (!rows.length) throw new Error('Test registry has no test declarations');
  if (rows.some(row => !Object.hasOwn(row, 'path') || !Object.hasOwn(row, 'kind'))) throw new Error('Test registry needs path and kind columns');
  return rows.filter(row => row.kind === 'gate').map(row => row.path);
}

function fullPlan(tests, reason, sourceSha = null) {
  return { schema: 'web-tools-test-selection/1', mode: 'full', reason, source_sha: sourceSha,
    tests: tests.map(testPath => ({ path: testPath, reasons: [reason], estimated_ms: null })),
    total: tests.length, selected: tests.length, estimated_ms: null };
}

export function boundSelection(plan, tests, prefixLength = 0) {
  const commandLength = plan.tests.reduce((sum, test) => sum + test.path.length + 3, prefixLength);
  return plan.mode !== 'full' && commandLength > 24000
    ? fullPlan(tests, 'selection exceeds portable command length; using full-run glob', plan.source_sha) : plan;
}

function printPlan(plan, runtime, snapshot) {
  console.log(`Tests: ${plan.selected}/${plan.total}, ${plan.mode}: ${plan.reason}`);
  console.log(`Baseline: ${plan.source_sha || 'none'}; Node ${runtime.node}, ${runtime.platform}/${runtime.arch}; concurrency ${runtime.concurrency}`);
  if (snapshot?.runtime?.node) console.log(`Cost estimates: observed on Node ${snapshot.runtime.node}, ${snapshot.runtime.platform}/${snapshot.runtime.arch || 'unknown'}; concurrency ${snapshot.runtime.concurrency ?? 'unknown'}; baseline ${snapshot.source?.checkout_sha || 'unknown'}.`);
  for (const test of plan.tests) {
    console.log(`${test.path}: ${test.reasons.join('; ')}${Number.isFinite(test.estimated_ms) ? ` (~${(test.estimated_ms / 1000).toFixed(2)}s)` : ''}`);
  }
}

export function verifyModuleMisses(root, snapshot) {
  const checked = new Set();
  for (const row of snapshot.tests) {
    for (const miss of Object.hasOwn(row, 'module_misses') ? normalizeModuleMisses(row.module_misses) : []) {
      const key = miss.parent + '\0' + miss.specifier;
      if (checked.has(key)) continue;
      checked.add(key);
      let absent = false;
      try { createRequire(path.resolve(root, miss.parent)).resolve(miss.specifier); }
      catch (error) { absent = error.code === 'MODULE_NOT_FOUND'; }
      if (!absent) throw new Error(`dependency lookup changed: ${miss.specifier}`);
    }
  }
}

function choosePlan({ root, tests, runtime, snapshot, snapshotError, base }) {
  let source = null;
  let plan;
  if (snapshotError) plan = fullPlan(tests, snapshotError);
  else {
    try {
      const gates = gateFiles(root);
      plan = planSelection({ snapshot, tests, gates, changedPaths: [], runtime });
      // Reject an incompatible baseline before starting Git subprocesses.
      if (plan.mode !== 'full') {
        verifyModuleMisses(root, snapshot);
        const changedPaths = changesSince(root, snapshot.source.checkout_sha);
        if (base) {
          source = gitSource(root, base);
          if (!source.base_sha) throw new Error(`cannot resolve requested base: ${base}`);
          changedPaths.push(...changesSince(root, source.base_sha));
        }
        plan = planSelection({ snapshot, tests, gates, changedPaths, runtime });
      }
    } catch (error) { plan = fullPlan(tests, `unusable baseline: ${error.message}`, snapshot?.source?.checkout_sha); }
  }
  return { plan: boundSelection(plan, tests, process.execPath.length + root.length + 256), source };
}

export async function main(argv = process.argv.slice(2)) {
  const invokedAt = new Date(performance.timeOrigin).toISOString();
  const options = parseArguments(argv), root = options.root;
  if (options.help) {
    console.log('test:diff [--list] [--all] [--snapshot <run.json>] [--base <ref>] [--concurrency <n>] [--observe] [--out <run.json>]');
    console.log('Observed reach selects the inner work loop. Unknown or incompatible observations run the full suite. Full preflight remains required.');
    return { exitCode: 0 };
  }
  const runtime = { node: process.versions.node, platform: process.platform, arch: process.arch,
    concurrency: options.concurrency, dependency_fingerprint: dependencyFingerprint(root) };
  const tests = testFiles(root);
  let baseSource = null, candidateSelection = null;
  let snapshot = null, snapshotError = null;
  const shadow = options.all && options.observe && !options.list;
  if (!options.all || shadow) {
    const localBaseline = 'node/.test-observations/baseline.json';
    const baselinePath = options.snapshot || (fs.existsSync(path.join(root, localBaseline)) ? localBaseline : 'data/tests/reach.json');
    try { snapshot = JSON.parse(fs.readFileSync(path.resolve(root, baselinePath), 'utf8')); }
    catch (error) { snapshotError = error.code === 'ENOENT' ? 'no observation baseline' : `unreadable observation baseline: ${error.message}`; }
  }
  let plan;
  if (options.all) plan = fullPlan(tests, 'explicit full run');
  if (!options.all || shadow) {
    const chosen = choosePlan({ root, tests, runtime, snapshot, snapshotError, base: options.base });
    baseSource = chosen.source;
    if (shadow) candidateSelection = chosen.plan;
    else plan = chosen.plan;
  }
  printPlan(plan, runtime, snapshot);
  if (options.list) return { exitCode: 0, plan };

  const selectionWallMs = Math.round(performance.now());
  const source = baseSource || gitSource(root, options.base || null);
  const startedAt = new Date().toISOString(), start = performance.now();
  const raw = options.observe ? createOwnedTemp('wto-') : null;
  const rawDirectory = raw?.directory || null;
  let profile = null;
  let exitCode = 0, signal = null, spawnError = null;
  try {
    if (plan.tests.length) {
      profile = childProfile();
      const env = profile.env;
      delete env.WEB_TOOLS_TEST_OBSERVATIONS;
      if (rawDirectory) {
        env.WEB_TOOLS_TEST_OBSERVATIONS = rawDirectory;
        env.WEB_TOOLS_TEST_ROOT = root;
      }
      const args = ['--require', path.join(root, 'node/test/runtime-command.cjs'), '--test', '--test-reporter=spec',
        `--test-concurrency=${options.concurrency}`,
        ...(plan.mode === 'full' ? ['node/test/**/*.test.mjs'] : plan.tests.map(test => test.path))];
      const child = spawn(process.execPath, args, { cwd: root, env, stdio: 'inherit', windowsHide: true });
      const forward = received => child.kill(received);
      const onInterrupt = () => forward('SIGINT'), onTerminate = () => forward('SIGTERM');
      process.on('SIGINT', onInterrupt); process.on('SIGTERM', onTerminate);
      try {
        await new Promise(resolve => {
          child.once('error', error => { spawnError = error.message; exitCode = 127; resolve(); });
          child.once('close', (code, received) => {
            if (!spawnError) { signal = received; exitCode = code ?? (received === 'SIGINT' ? 130 : 143); }
            resolve();
          });
        });
      } finally {
        process.removeListener('SIGINT', onInterrupt); process.removeListener('SIGTERM', onTerminate);
      }
    }
    const { observations, errors } = collectObservations(rawDirectory);
    if (spawnError) errors.push(`Runner could not start: ${spawnError}`);
    const record = buildRunRecord({ source, runtime, mode: plan.mode,
      run: { id: process.env.GITHUB_RUN_ID || randomUUID(), attempt: process.env.GITHUB_RUN_ATTEMPT || '1', event: process.env.GITHUB_EVENT_NAME || 'local' },
      startedAt, finishedAt: new Date().toISOString(), wallMs: performance.now() - start,
      exitCode, signal, observations, errors, expectedTests: plan.tests.map(test => test.path), candidateSelection });
    record.selection = plan;
    record.invoked_at = invokedAt;
    record.selection_wall_ms = selectionWallMs;
    record.preparation_wall_ms = Math.round(start);
    record.total_wall_ms = Math.round(performance.now());
    record.profile_isolation = profile ? 'temporary' : 'not-needed';
    const output = path.resolve(root, options.out || 'node/.test-observations/run.json');
    if (!options.out) {
      const identifier = /^[A-Za-z0-9][A-Za-z0-9._-]{0,149}$/.test(record.run.id) ? record.run.id : randomUUID();
      writeRecord(path.join(root, 'node/.test-observations/runs', `${identifier}.json`), record);
    }
    writeRecord(output, record);
    if (options.observe && baselineEligible(record)) {
      writeRecord(path.join(root, 'node/.test-observations/baseline.json'), record);
    }
    console.log(`Captured ${observations.length} worker observations for ${record.tests.length} test files in ${output}; ${(record.wall_ms / 1000).toFixed(2)}s wall, ${(record.sum_process_wall_ms / 1000).toFixed(2)}s aggregate process elapsed; ${record.complete ? 'complete' : 'incomplete'} observations; exit ${exitCode}.`);
    if (candidateSelection) console.log(`Shadow selection: ${candidateSelection.selected}/${candidateSelection.total}, ${candidateSelection.reason}; ${record.candidate_sum_process_wall_ms === null ? 'unavailable' : `${(record.candidate_sum_process_wall_ms / 1000).toFixed(2)}s`} aggregate process elapsed in the selected workers; the full suite ran.`);
    return { exitCode, signal, record, plan };
  } finally {
    removeOwnedTemp(profile?.owned);
    removeOwnedTemp(raw);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await main();
    if (result.signal && process.platform !== 'win32') process.kill(process.pid, result.signal);
    else process.exitCode = result.exitCode;
  } catch (error) { console.error(`Test runner: ${error.message}`); process.exitCode = 1; }
}
