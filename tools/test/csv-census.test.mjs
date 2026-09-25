import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  chmodSync, copyFileSync, mkdtempSync, mkdirSync, readFileSync,
  writeFileSync, rmSync, symlinkSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';
import { parseCsv } from '../build/registries-load.mjs';

const script = path.join(repoRoot, 'scripts/csv-census.py');
const python = 'python3';
const output = 'data/csv-census.csv';
const git = (root, ...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
const run = (root, ...args) => spawnSync(python, [script, '--root', root, ...args],
  { cwd: repoRoot, encoding: 'utf8' });
const generate = root => {
  const r = run(root);
  assert.equal(r.status, 0, r.stderr || r.error?.message);
  return readFileSync(path.join(root, output));
};
const rows = root => parseCsv(readFileSync(path.join(root, output), 'utf8'));
const declare = (root, census = output) =>
  writeFileSync(path.join(root, '.web-tools.json'), JSON.stringify({ data: { census } }) + '\n');

function fixture(t) {
  const box = mkdtempSync(path.join(os.tmpdir(), 'csv-census-'));
  const root = path.join(box, 'repo');
  mkdirSync(root);
  t.after(() => rmSync(box, { recursive: true, force: true }));
  git(root, 'init', '-q');
  git(root, 'config', 'core.autocrlf', 'false');
  git(root, 'config', 'core.hooksPath', '.disabled-hooks');
  declare(root);
  return { box, root };
}

test('the committed hub census is the repeatable tracked-CSV population', () => {
  const r = run(repoRoot, '--check');
  assert.equal(r.status, 0, r.stderr || r.error?.message);
  const inventory = rows(repoRoot);
  const tracked = git(repoRoot, 'ls-files', '-z', '--', '*.csv').split('\0').filter(Boolean).sort();
  assert.deepEqual(inventory.map(r => r.path).sort(), tracked);
  const own = inventory.find(r => r.path === output);
  assert.ok(own, 'the census accounts for itself');
  assert.equal(Number(own.rows), tracked.length);
  assert.equal(Number(own.bytes), readFileSync(path.join(repoRoot, output)).length);
});

test('a repository can declare an empty census, and check catches stale measurements and population', t => {
  const { root } = fixture(t);
  generate(root);
  assert.notEqual(run(root, '--check').status, 0, 'a new census must be tracked before checking');
  git(root, 'add', '.web-tools.json', output);
  assert.equal(run(root, '--check').status, 0);
  assert.deepEqual(rows(root).map(r => r.path), [output]);
  assert.equal(Number(rows(root)[0].rows), 1, 'the inventory has one data row: itself');

  writeFileSync(path.join(root, 'sample.csv'), 'a,b\n1,2\n');
  git(root, 'add', 'sample.csv');
  assert.notEqual(run(root, '--check').status, 0, 'new tracked CSV makes the inventory stale');
  generate(root);
  assert.equal(run(root, '--check').status, 0);
  assert.deepEqual(rows(root).map(r => r.path), [output, 'sample.csv']);
  assert.deepEqual(JSON.parse(rows(root)[1].headers), ['a', 'b']);
  assert.equal(Number(rows(root)[1].rows), 1);
  writeFileSync(path.join(root, 'sample.csv'), 'a,b\n1,2\n3,4\n');
  git(root, 'add', 'sample.csv');
  assert.notEqual(run(root, '--check').status, 0, 'changed physical measurements fail');
});

test('CSV records preserve quoted, multiline, blank, duplicate and Unicode headers', t => {
  const { root } = fixture(t);
  const raw = Buffer.from('\uFEFF"comma,name","multi\nline",,dup,dup,é\r\n"first\r\nrecord",2\r\n,,3,4,5,6\r\n');
  writeFileSync(path.join(root, 'sample.csv'), raw);
  writeFileSync(path.join(root, 'empty.csv'), '');
  writeFileSync(path.join(root, 'untracked.csv'), Buffer.from([0xff]));
  git(root, 'add', 'sample.csv', 'empty.csv');
  const first = generate(root);
  const inventory = rows(root);
  const sample = inventory.find(r => r.path === 'sample.csv');
  assert.deepEqual(JSON.parse(sample.headers), ['comma,name', 'multi\nline', '', 'dup', 'dup', 'é']);
  assert.equal(Number(sample.rows), 2, 'embedded newlines do not create extra records');
  assert.equal(Number(sample.columns), 6, 'the header sets width even when a data record is shorter');
  assert.equal(Number(sample.bytes), raw.length, 'byte count includes BOM and original line endings');
  assert.deepEqual(inventory.find(r => r.path === 'empty.csv'),
    { path: 'empty.csv', rows: '0', columns: '0', bytes: '0', headers: '[]' });
  assert.ok(!inventory.some(r => r.path === 'untracked.csv'));
  assert.deepEqual(generate(root), first, 'identical indexed inputs emit identical bytes');
});

test('valid CSV cells can exceed the Python parser default field limit', t => {
  const { root } = fixture(t);
  const raw = Buffer.from('text\n' + 'x'.repeat(131073) + '\n');
  writeFileSync(path.join(root, 'large.csv'), raw);
  git(root, 'add', 'large.csv');
  generate(root);
  assert.deepEqual(rows(root).find(r => r.path === 'large.csv'),
    { path: 'large.csv', rows: '1', columns: '1', bytes: String(raw.length), headers: '["text"]' });
});

test('measurements follow staged source bytes while check verifies the working inventory', t => {
  const { root } = fixture(t);
  writeFileSync(path.join(root, 'sample.csv'), 'a\n1\n');
  git(root, 'add', 'sample.csv');
  generate(root);
  git(root, 'add', output);
  // Simulate checkout newline conversion and a separate unstaged edit.
  writeFileSync(path.join(root, 'sample.csv'), 'a\r\n1\r\n2\r\n');
  generate(root);
  assert.equal(Number(rows(root)[1].rows), 1);
  assert.equal(Number(rows(root)[1].bytes), 4);
  assert.equal(run(root, '--check').status, 0);

  git(root, 'add', 'sample.csv');
  assert.notEqual(run(root, '--check').status, 0, 'staging the edit invalidates the old inventory');
  generate(root);
  assert.equal(Number(rows(root)[1].rows), 2);
  assert.equal(Number(rows(root)[1].bytes), 9);
  assert.equal(run(root, '--check').status, 0, 'regenerated output can be checked before staging it');
  assert.notEqual(git(root, 'show', ':' + output), readFileSync(path.join(root, output), 'utf8'));
  git(root, 'add', output);
  assert.equal(run(root, '--check').status, 0);
});

for (const [name, contents, error] of [
  ['invalid UTF-8', Buffer.from([0xff]), /decode/],
  ['malformed quoting', Buffer.from('header\n"unterminated'), /unexpected end of data/],
]) {
  test(`${name} fails without overwriting an existing census`, t => {
    const { root } = fixture(t);
    const before = generate(root);
    writeFileSync(path.join(root, 'invalid.csv'), contents);
    git(root, 'add', 'invalid.csv');
    const r = run(root);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, error);
    assert.deepEqual(readFileSync(path.join(root, output)), before);
  });
}

test('an indexed CSV symlink is rejected even when Git checks it out as a regular file', t => {
  const { root } = fixture(t);
  const before = generate(root);
  git(root, 'config', 'core.symlinks', 'false');
  writeFileSync(path.join(root, 'linked.csv'), 'target.csv');
  const blob = execFileSync('git', ['hash-object', '-w', '--stdin'],
    { cwd: root, input: 'target.csv', encoding: 'utf8' }).trim();
  git(root, 'update-index', '--add', '--cacheinfo', '120000', blob, 'linked.csv');
  assert.equal(git(root, 'diff', '--name-only'), '', 'the regular file is a valid Git checkout of the link');
  const r = run(root);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /linked CSV in index: linked\.csv/);
  assert.deepEqual(readFileSync(path.join(root, output)), before);
});

test('census output rejects traversal, absolute and Windows drive paths before writing', t => {
  const { box, root } = fixture(t);
  const outside = path.join(box, 'outside.csv');
  writeFileSync(outside, 'sentinel\n');
  for (const census of ['../outside.csv', outside.replaceAll('\\', '/'), 'C:/outside.csv', 'C:outside.csv']) {
    declare(root, census);
    const r = run(root);
    assert.notEqual(r.status, 0, `accepted ${census}`);
    assert.match(r.stderr, /relative \.csv path/);
    assert.equal(readFileSync(outside, 'utf8'), 'sentinel\n');
  }
});

test('census output cannot write through a directory link or Windows junction outside the checkout', t => {
  const { box, root } = fixture(t);
  const outside = path.join(box, 'outside');
  mkdirSync(outside);
  writeFileSync(path.join(outside, 'csv-census.csv'), 'sentinel\n');
  symlinkSync(outside, path.join(root, 'data'), process.platform === 'win32' ? 'junction' : 'dir');
  const r = run(root);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /outside repository/);
  assert.equal(readFileSync(path.join(outside, 'csv-census.csv'), 'utf8'), 'sentinel\n');
});

test('census output rejects a file symlink even when its target is inside the checkout', t => {
  const { root } = fixture(t);
  const target = path.join(root, 'inside.csv');
  writeFileSync(target, 'sentinel\n');
  mkdirSync(path.join(root, 'data'));
  try {
    symlinkSync(target, path.join(root, output), 'file');
  } catch (e) {
    if (process.platform === 'win32' && e.code === 'EPERM') {
      t.skip('this Windows account cannot create file symlinks');
      return;
    }
    throw e;
  }
  const r = run(root);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /linked census output/);
  assert.equal(readFileSync(target, 'utf8'), 'sentinel\n');
});

test('the full refresh hook repairs and stages a census in a clean checkout', t => {
  const { box, root } = fixture(t);
  mkdirSync(path.join(root, 'scripts'));
  mkdirSync(path.join(root, '.githooks'));
  copyFileSync(script, path.join(root, 'scripts/csv-census.py'));
  copyFileSync(path.join(repoRoot, '.githooks/pre-commit'), path.join(root, '.githooks/pre-commit'));
  generate(root);
  writeFileSync(path.join(root, output), 'path,rows,columns,bytes,headers\n');
  git(root, 'add', '.');
  git(root, '-c', 'user.name=Census test', '-c', 'user.email=census@example.test',
    '-c', 'commit.gpgsign=false', 'commit', '-qm', 'stale census fixture');
  assert.equal(git(root, 'status', '--porcelain'), '');

  // Other generator legs belong to their own tests; this fixture exercises
  // the actual full hook and census script with those npm commands as no-ops.
  const bin = path.join(box, 'bin');
  mkdirSync(bin);
  const pythonExe = execFileSync(python, ['-c', 'import sys; print(sys.executable)'], { encoding: 'utf8' })
    .trim().replaceAll('\\', '/');
  const quote = s => "'" + s.replaceAll("'", "'\\''") + "'";
  writeFileSync(path.join(bin, 'npm'), '#!/bin/sh\nexit 0\n');
  writeFileSync(path.join(bin, 'python3'), `#!/bin/sh\nexec ${quote(pythonExe)} "$@"\n`);
  chmodSync(path.join(bin, 'npm'), 0o755);
  chmodSync(path.join(bin, 'python3'), 0o755);
  const env = { ...process.env };
  const pathKey = Object.keys(env).find(k => k.toLowerCase() === 'path') || 'PATH';
  env[pathKey] = bin + path.delimiter + env[pathKey];
  const r = spawnSync('bash', ['.githooks/pre-commit', '--all'], { cwd: root, env, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr || r.error?.message);
  assert.equal(run(root, '--check').status, 0, r.stderr);
  assert.equal(git(root, 'show', ':' + output), readFileSync(path.join(root, output), 'utf8'));
  assert.equal(git(root, 'diff', '--cached', '--name-only').trim(), output);
});
