import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';

export const RUN_SCHEMA = 'web-tools-test-run/1';
export const OBSERVATION_SCHEMA = 'web-tools-test-observation/1';

export function relativePath(value, { directory = false } = {}) {
  if (typeof value !== 'string' || !value || /[\0\r\n:]/.test(value)) throw new Error('Invalid repository-relative path');
  const normalized = value.replaceAll('\\', '/');
  if (directory && normalized === '.') return normalized;
  if (normalized.startsWith('/') || normalized.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new Error(`Invalid repository-relative path: ${value}`);
  }
  return normalized;
}

function validateObservation(row) {
  if (!row || row.schema !== OBSERVATION_SCHEMA) throw new Error('Unsupported observation schema');
  const result = { ...row, path: relativePath(row.path) };
  if (!Number.isInteger(row.pid) || row.pid <= 0) throw new Error('Invalid observation pid');
  if (typeof row.complete !== 'boolean' || !Number.isFinite(row.elapsed_ms) || row.elapsed_ms < 0) {
    throw new Error('Invalid observation completion or duration');
  }
  if (row.exit_code !== null && !Number.isInteger(row.exit_code)) throw new Error('Invalid observation exit code');
  if (!Number.isFinite(Date.parse(row.started_at)) || !Number.isFinite(Date.parse(row.finished_at))) {
    throw new Error('Invalid observation timestamps');
  }
  for (const key of ['files', 'directories', 'missing']) {
    if (!Array.isArray(row[key])) throw new Error(`Missing observation ${key}`);
    result[key] = [...new Set(row[key].map(value => relativePath(value, { directory: key === 'directories' })))].sort();
  }
  if (!Array.isArray(row.opaque) || row.opaque.some(value => typeof value !== 'string')) throw new Error('Invalid opaque reasons');
  result.opaque = [...new Set(row.opaque)].sort();
  return result;
}

export function collectObservations(directory) {
  const observations = [], errors = [];
  if (!directory) return { observations, errors };
  let names;
  try { names = fs.readdirSync(directory).sort(); }
  catch (error) { return { observations, errors: [`Cannot read observation directory: ${error.message}`] }; }
  for (const name of names) {
    if (!name.endsWith('.json')) continue;
    try {
      const file = path.join(directory, name);
      if (!fs.lstatSync(file).isFile()) throw new Error('Observation is not a regular file');
      observations.push(validateObservation(JSON.parse(fs.readFileSync(file, 'utf8'))));
    } catch (error) {
      errors.push(`${name}: ${error.message}`);
    }
  }
  return { observations, errors };
}

export function buildRunRecord({ source, runtime, mode, run, startedAt, finishedAt, wallMs,
  exitCode, signal = null, observations = [], errors = [], expectedTests = [], candidateSelection = null }) {
  const expected = [...new Set(expectedTests.map(value => relativePath(value)))].sort();
  const groups = new Map(), problems = [...errors];
  for (const input of observations) {
    try {
      const row = validateObservation(input);
      if (!expected.includes(row.path)) {
        problems.push(`Unexpected observation: ${row.path}`);
        continue;
      }
      const rows = groups.get(row.path) || [];
      rows.push(row);
      groups.set(row.path, rows);
    } catch (error) { problems.push(error.message); }
  }
  const tests = expected.map(testPath => {
    const rows = groups.get(testPath) || [];
    if (rows.length === 1) return rows[0];
    if (rows.length > 1) problems.push(`Duplicate observations: ${testPath}`);
    return { path: testPath, complete: false, exit_code: null, elapsed_ms: null,
      files: [], directories: [], missing: [], opaque: [rows.length ? 'duplicate-observations' : 'missing-observation'] };
  });
  let candidateElapsed = null;
  if (candidateSelection) {
    const current = new Map(tests.map(row => [row.path, row]));
    const picked = candidateSelection.tests.map(row => current.get(row.path));
    if (picked.every(row => row?.complete && Number.isFinite(row.elapsed_ms))) {
      candidateElapsed = picked.reduce((sum, row) => sum + row.elapsed_ms, 0);
    }
  }
  return {
    schema: RUN_SCHEMA, source, runtime, mode, run,
    started_at: startedAt, finished_at: finishedAt,
    wall_ms: Math.max(0, Math.round(wallMs)), exit_code: exitCode, signal,
    complete: expected.length > 0 && problems.length === 0 && tests.every(row => row.complete),
    tests,
    sum_process_wall_ms: tests.reduce((sum, row) => sum + (row.elapsed_ms || 0), 0),
    ...(candidateSelection ? { candidate_selection: candidateSelection, candidate_sum_process_wall_ms: candidateElapsed } : {}),
    ...(problems.length ? { observation_errors: problems } : {}),
  };
}

export function dependencyFingerprint(root) {
  const hash = createHash('sha256');
  for (const name of ['package.json', 'package-lock.json', 'npm-shrinkwrap.json', 'pnpm-lock.yaml', 'yarn.lock']) {
    const file = path.join(root, name);
    if (fs.existsSync(file)) hash.update(name).update('\0').update(fs.readFileSync(file)).update('\0');
  }
  return hash.digest('hex');
}

export function repositoryName(remote) {
  let repository = null, remotePath = null;
  try {
    const url = new URL(remote);
    if (url.hostname.toLowerCase() === 'github.com') remotePath = url.pathname;
  } catch {
    remotePath = /^(?:[^@/:]+@)?github\.com:([^?#]+)(?:[?#].*)?$/i.exec(remote)?.[1] || null;
  }
  if (remotePath) {
    const parts = remotePath.replace(/^\/+|\/+$/g, '').replace(/\.git$/i, '').split('/');
    if (parts.length === 2 && parts.every(part => /^[\w.-]+$/.test(part))) repository = parts.join('/');
  }
  return repository;
}

export function gitSource(root, base = null) {
  const git = args => {
    const result = spawnSync('git', ['-C', root, ...args], {
      encoding: 'utf8', windowsHide: true, env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
    });
    return result.status === 0 ? result.stdout.trim() : null;
  };
  const checkout = git(['rev-parse', 'HEAD']);
  const remote = git(['config', '--get', 'remote.origin.url']) || '';
  const status = git(['status', '--porcelain', '--untracked-files=normal']);
  return {
    repo: repositoryName(remote),
    checkout_sha: checkout,
    head_sha: process.env.WEB_TOOLS_TEST_HEAD_SHA || process.env.GITHUB_HEAD_SHA || checkout,
    base_sha: base ? git(['merge-base', 'HEAD', base]) : null,
    dirty: status === null || status.length > 0,
  };
}

export function writeRecord(file, record) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(record, null, 2)}\n`, { flag: 'wx' });
    fs.renameSync(temporary, file);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}
