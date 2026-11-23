// Exercise the optional preload with isolated processes and real filesystem work.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';

const observer = fileURLToPath(new URL('../testing/observe.cjs', import.meta.url));

function fixture(t) {
  const box = mkdtempSync(path.join(os.tmpdir(), 'test-observer-'));
  const root = path.join(box, 'repo'), output = path.join(root, '.observations');
  mkdirSync(root);
  t.after(() => rmSync(box, { recursive: true, force: true }));
  return { box, root, output };
}

function run(f, body, options = {}) {
  const file = path.join(f.root, options.name || 'sample.test.mjs');
  writeFileSync(file, body);
  const env = { ...process.env, WEB_TOOLS_TEST_ROOT: f.root, WEB_TOOLS_TEST_OBSERVATIONS: f.output, ...options.env };
  // A nested runner must establish its own worker context rather than inherit
  // the outer runner's internal child protocol.
  delete env.NODE_TEST_CONTEXT;
  const args = [...(options.before || []), '--require', observer, ...(options.testRunner ? ['--test', '--test-concurrency=1'] : []), file];
  return spawnSync(process.execPath, args, { cwd: f.root, env, encoding: 'utf8', timeout: 45000, windowsHide: true });
}

function rows(f) {
  try { return readdirSync(f.output).map(name => JSON.parse(readFileSync(path.join(f.output, name), 'utf8'))); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
}

test('records actual sync, callback and promise reads, missing probes and directory observations', t => {
  const f = fixture(t);
  mkdirSync(path.join(f.root, 'data'));
  writeFileSync(path.join(f.root, 'data', 'value.txt'), 'value');
  writeFileSync(path.join(f.root, 'copy-source.txt'), 'copy me');
  writeFileSync(path.join(f.box, 'outside.txt'), 'outside');
  mkdirSync(path.join(f.root, 'node_modules'));
  writeFileSync(path.join(f.root, 'node_modules', 'ignored.txt'), 'ignored');
  mkdirSync(f.output);
  writeFileSync(path.join(f.output, 'ignored.txt'), 'ignored');
  const r = run(f, `
    import assert from 'node:assert/strict';
    import fs, { readFileSync, existsSync, readdirSync } from 'node:fs';
    import { readFile } from 'node:fs/promises';
    assert.equal(readFileSync('data/value.txt', 'utf8'), 'value');
    assert.equal(readFileSync(Buffer.from('data/value.txt'), 'utf8'), 'value');
    assert.equal(readFileSync(new URL('./data/value.txt', import.meta.url), 'utf8'), 'value');
    assert.equal(await readFile('data/value.txt', 'utf8'), 'value');
    fs.copyFileSync('copy-source.txt', 'copied.txt');
    await new Promise((ok, fail) => fs.readFile('data/value.txt', 'utf8', (e, s) => e ? fail(e) : (assert.equal(s, 'value'), ok())));
    assert.equal(existsSync('optional.txt'), false);
    assert.throws(() => readFileSync('missing.txt'), { code: 'ENOENT' });
    await assert.rejects(readFile('missing-promise.txt'), { code: 'ENOENT' });
    await new Promise(ok => fs.stat('missing-callback.txt', e => { assert.equal(e.code, 'ENOENT'); ok(); }));
    readdirSync('data');
    await fs.promises.readdir('.');
    await new Promise(ok => {
      fs.stat('before-move.txt', e => { assert.equal(e.code, 'ENOENT'); process.chdir('..'); ok(); });
      process.chdir('data');
    });
    process.chdir('data');
    assert.equal(readFileSync('value.txt', 'utf8'), 'value');
    process.chdir('..');
    readFileSync('../outside.txt');
    readFileSync('node_modules/ignored.txt');
    readFileSync('.observations/ignored.txt');
  `);
  assert.equal(r.status, 0, r.stderr);
  // The intentional output input above is not a worker observation.
  rmSync(path.join(f.output, 'ignored.txt'));
  const [row] = rows(f);
  assert.equal(row.schema, 'web-tools-test-observation/1');
  assert.equal(row.path, 'sample.test.mjs');
  assert.equal(row.complete, true);
  assert.equal(row.exit_code, 0);
  assert.ok(row.files.includes('data/value.txt'));
  assert.ok(row.files.includes('copy-source.txt'));
  for (const name of ['optional.txt', 'missing.txt', 'missing-promise.txt', 'missing-callback.txt', 'before-move.txt']) assert.ok(row.missing.includes(name), name);
  assert.ok(row.directories.includes('data'));
  assert.ok(row.directories.includes('.'));
  assert.ok(row.files.every(p => !p.includes('outside') && !p.includes('node_modules') && !p.includes('.observations')));
  assert.ok(row.elapsed_ms >= 0);
  assert.ok(Date.parse(row.finished_at) >= Date.parse(row.started_at));
});

test('test-runner parent emits no row and repeated workers use unique output files', t => {
  const f = fixture(t);
  for (let i = 0; i < 2; i++) {
    const r = run(f, `import test from 'node:test'; test('works', () => {});`, { testRunner: true });
    assert.equal(r.status, 0, r.stderr);
  }
  const observations = rows(f);
  assert.equal(observations.length, 2);
  assert.equal(new Set(observations.map(r => r.pid)).size, 2);
  assert.deepEqual(observations.map(r => r.path), ['sample.test.mjs', 'sample.test.mjs']);
});

test('subprocess calls are opaque and preserve synchronous and asynchronous behavior', t => {
  const f = fixture(t);
  const r = run(f, `
    import assert from 'node:assert/strict';
    import { spawnSync, execFile, execSync, spawn } from 'node:child_process';
    assert.equal(spawnSync(process.execPath, ['-p', '6*7'], { encoding: 'utf8' }).stdout.trim(), '42');
    await new Promise((ok, fail) => execFile(process.execPath, ['-p', '2+3'], (e,s) => e ? fail(e) : (assert.equal(s.trim(), '5'),ok())));
    assert.equal(execSync('echo observer', { encoding: 'utf8' }).trim(), 'observer');
    await new Promise((ok, fail) => { const p = spawn(process.execPath, ['-e', '']); p.on('error', fail); p.on('close', c => c === 0 ? ok() : fail(new Error(String(c)))); });
  `);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(rows(f)[0].opaque.filter(s => s.startsWith('subprocess:')), ['subprocess:execFile', 'subprocess:execSync', 'subprocess:spawn', 'subprocess:spawnSync']);
});

test('worker failure is recorded without masking the original failure', t => {
  const f = fixture(t);
  const r = run(f, `throw new Error('the fixture failed');`);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /the fixture failed/);
  const [row] = rows(f);
  assert.equal(row.exit_code, r.status);
  assert.equal(row.complete, true);
});

test('missing module hooks mark reach opaque instead of failing the worker', t => {
  const f = fixture(t);
  const disable = path.join(f.box, 'no-module-hooks.cjs');
  writeFileSync(disable, `require('node:module').registerHooks = undefined;`);
  const r = run(f, '', { before: ['--require', disable] });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(rows(f)[0].opaque.includes('module-resolution-unavailable'));
});

test('module resolution observes an imported repository module when hooks are available', t => {
  const f = fixture(t);
  writeFileSync(path.join(f.root, 'dependency.mjs'), 'export const answer = 42;');
  const r = run(f, `import { answer } from './dependency.mjs'; if (answer !== 42) throw new Error('wrong import');`);
  assert.equal(r.status, 0, r.stderr);
  const row = rows(f)[0];
  if (!row.opaque.includes('module-resolution-unavailable')) assert.ok(row.files.includes('dependency.mjs'));
});

test('failed optional module resolution cannot look like complete empty reach', t => {
  const f = fixture(t);
  const r = run(f, `try { await import('./optional-module.mjs'); } catch (e) { if (e.code !== 'ERR_MODULE_NOT_FOUND') throw e; }`);
  assert.equal(r.status, 0, r.stderr);
  const row = rows(f)[0];
  if (!row.opaque.includes('module-resolution-unavailable')) {
    assert.ok(row.opaque.includes('module-resolution-failed'));
    assert.ok(row.missing.includes('optional-module.mjs'));
  }
});

test('direct descriptor reads are explicitly opaque', t => {
  const f = fixture(t);
  writeFileSync(path.join(f.root, 'input.txt'), 'hello');
  const r = run(f, `import fs from 'node:fs'; const fd = fs.openSync('input.txt', 'r'); const b = Buffer.alloc(5); fs.readSync(fd, b, 0, 5, 0); fs.closeSync(fd); if (b.toString() !== 'hello') throw new Error('wrong read');`);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(rows(f)[0].opaque.includes('filesystem-descriptor'));
});

test('promisified filesystem and subprocess APIs retain their native result shapes', t => {
  const f = fixture(t);
  writeFileSync(path.join(f.root, 'input.txt'), 'hello');
  const r = run(f, `
    import assert from 'node:assert/strict';
    import fs from 'node:fs';
    import { execFile } from 'node:child_process';
    import { promisify } from 'node:util';
    assert.equal(await promisify(fs.exists)('optional.txt'), false);
    const fd = fs.openSync('input.txt', 'r');
    const answer = await promisify(fs.read)(fd, Buffer.alloc(5), 0, 5, 0);
    assert.equal(answer.bytesRead, 5);
    assert.equal(answer.buffer.toString(), 'hello');
    fs.closeSync(fd);
    const pending = promisify(execFile)(process.execPath, ['-p', '21*2']);
    assert.ok(pending.child);
    const childResult = await pending;
    assert.equal(childResult.stdout.trim(), '42');
    assert.equal(childResult.stderr, '');
  `);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(rows(f)[0].missing.includes('optional.txt'));
  assert.ok(rows(f)[0].opaque.includes('subprocess:execFile'));
});

test('observer is inactive without an absolute destination or outside a test worker', t => {
  const f = fixture(t);
  for (const options of [{ env: { WEB_TOOLS_TEST_OBSERVATIONS: '' } }, { env: { WEB_TOOLS_TEST_OBSERVATIONS: 'relative-output' } }, { name: 'script.mjs' }]) {
    const r = run(f, '', options);
    assert.equal(r.status, 0, r.stderr);
  }
  assert.deepEqual(rows(f), []);
});

test('observation destination failures preserve the test exit status', t => {
  const f = fixture(t);
  writeFileSync(f.output, 'not a directory');
  const r = run(f, '');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stderr, /test observation unavailable/);
});
