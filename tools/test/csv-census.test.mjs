import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';
import { parseCsv } from '../build/registries-load.mjs';

const script = path.join(repoRoot, 'scripts/csv-census.py');
const python = process.platform === 'win32' ? 'python' : 'python3';

test('the committed hub census is the repeatable tracked-CSV population', () => {
  execFileSync(python, [script, '--check'], { cwd: repoRoot });
  const rows = parseCsv(readFileSync(path.join(repoRoot, 'data/csv-census.csv'), 'utf8'));
  const tracked = execFileSync('git', ['ls-files', '-z', '--', '*.csv'], { cwd: repoRoot })
    .toString('utf8').split('\0').filter(Boolean).sort();
  assert.deepEqual(rows.map(r => r.path).sort(), tracked);
  assert.ok(rows.some(r => r.path === 'data/csv-census.csv'), 'the census accounts for itself');
});

test('a repository can declare an empty census, and check catches stale measurements and population', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'csv-census-'));
  try {
    execFileSync('git', ['init', '-q'], { cwd: root });
    mkdirSync(path.join(root, 'data'));
    writeFileSync(path.join(root, '.web-tools.json'), '{"data":{"census":"data/census.csv"}}\n');
    execFileSync(python, [script, '--root', root], { cwd: repoRoot });
    execFileSync('git', ['add', '.web-tools.json', 'data/census.csv'], { cwd: root });
    execFileSync(python, [script, '--root', root, '--check'], { cwd: repoRoot });
    let rows = parseCsv(readFileSync(path.join(root, 'data/census.csv'), 'utf8'));
    assert.deepEqual(rows.map(r => r.path), ['data/census.csv']);
    assert.equal(Number(rows[0].rows), 1, 'the inventory has one data row: itself');

    writeFileSync(path.join(root, 'sample.csv'), 'a,b\n1,2\n');
    execFileSync('git', ['add', 'sample.csv'], { cwd: root });
    const check = () => spawnSync(python, [script, '--root', root, '--check'], { cwd: repoRoot });
    assert.notEqual(check().status, 0, 'new tracked CSV makes the inventory stale');
    execFileSync(python, [script, '--root', root], { cwd: repoRoot });
    assert.equal(check().status, 0);
    rows = parseCsv(readFileSync(path.join(root, 'data/census.csv'), 'utf8'));
    assert.deepEqual(rows.map(r => r.path), ['data/census.csv', 'sample.csv']);
    assert.deepEqual(JSON.parse(rows[1].headers), ['a', 'b']);
    assert.equal(Number(rows[1].rows), 1);
    writeFileSync(path.join(root, 'sample.csv'), 'a,b\n1,2\n3,4\n');
    execFileSync('git', ['add', 'sample.csv'], { cwd: root });
    assert.notEqual(check().status, 0, 'changed physical measurements fail');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
