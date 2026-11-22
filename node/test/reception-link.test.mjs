// node/reception-link.mjs mints the link pages/reception.html reads: the
// payload {label?, note, fn, dest?, file?} gzipped and base64url in #gz=,
// which kits/gz-payload.js decodes. These hold the minter to that contract.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { repoRoot } from '../repo-root.mjs';

const mint = (...args) => execFileSync('node', [path.join(repoRoot, 'node/reception-link.mjs'), ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
const payload = (url) => JSON.parse(gunzipSync(Buffer.from(new URL(url).hash.replace(/^#gz=/, ''), 'base64url')).toString('utf8'));
const dir = mkdtempSync(path.join(tmpdir(), 'reception-'));
const fn = path.join(dir, 'fn.js');
writeFileSync(fn, '(rows) => rows.length\n');

test('the link carries the label, the note and the function, and opens the page', () => {
  const url = mint(fn, '--label', 'Counts', '--note', 'Paste a sheet');
  assert.match(url, /^https:\/\/mehrlander\.github\.io\/web-tools\/pages\/reception\.html#gz=[A-Za-z0-9_-]+$/);
  assert.deepEqual(payload(url), { label: 'Counts', note: 'Paste a sheet', fn: '(rows) => rows.length' });
});

test('the note is required and the label optional', () => {
  assert.deepEqual(payload(mint(fn, '--note', 'N')), { note: 'N', fn: '(rows) => rows.length' });
  assert.throws(() => mint(fn));
});

test('--dest and --file ride as an errand names them', () => {
  const p = payload(mint(fn, '--note', 'N', '--dest', 'mehrlander/home@main:projects/x/dump', '--file', 'out.tsv'));
  assert.deepEqual([p.dest, p.file], ['mehrlander/home@main:projects/x/dump', 'out.tsv']);
});

test('a malformed --dest, a --file without --dest, and a file that is not a function are refused', () => {
  assert.throws(() => mint(fn, '--note', 'N', '--dest', 'projects/x/dump'));
  for (const d of ['/repo:x', 'me/repo:', 'me/repo@main:']) assert.throws(() => mint(fn, '--note', 'N', '--dest', d), d);
  assert.throws(() => mint(fn, '--note', 'N', '--file', 'out.tsv'));
  const bad = path.join(dir, 'bad.js');
  writeFileSync(bad, 'rows => {');
  assert.throws(() => mint(bad, '--note', 'N'));
});

test('nonfunction source is refused without evaluating supplied expressions', async t => {
  const marker = path.join(dir, 'source-was-executed');
  const cases = [
    ['object', '{"label":"Counts"}'],
    ['primitive', '42'],
    ['class', 'class Counts {}'],
    ['factory call', `(() => { process.getBuiltinModule('node:fs').writeFileSync(${JSON.stringify(marker)}, 'executed'); return rows => rows.length; })()`],
    ['trailing expression', 'rows => rows.length, () => 0'],
    ['trailing statements', 'rows => rows.length); return (rows => 0'],
  ];
  for (const [name, source] of cases) {
    await t.test(name, () => {
      const file = path.join(dir, `not-function-${name.replaceAll(' ', '-')}.js`);
      writeFileSync(file, source);
      const result = spawnSync(process.execPath,
        [path.join(repoRoot, 'node/reception-link.mjs'), file, '--note', 'N'], { encoding: 'utf8' });
      assert.equal(existsSync(marker), false, 'validation must not execute a function factory');
      assert.notEqual(result.status, 0, 'a nonfunction definition must not mint a reception link');
      assert.equal(result.stdout.trim(), '', 'a refused source emits no link');
      assert.match(result.stderr, /function/i);
    });
  }
});

test('function syntax remains intact in the minted payload', async t => {
  const cases = [
    ['named function', 'function counts(rows) { return rows.length; }'],
    ['anonymous function', 'function (rows) { return rows.length; }'],
    ['async arrow', 'async (rows) => rows.length'],
    ['parenthesized commented async generator', '/* Count rows */ ((async function* counts(rows) { yield rows.length; })) /* End */'],
    ['arrow using wrapper new.target', '() => new.target'],
  ];
  for (const [name, source] of cases) {
    await t.test(name, () => {
      const file = path.join(dir, `function-${name.replaceAll(' ', '-')}.js`);
      writeFileSync(file, source);
      assert.equal(payload(mint(file, '--note', 'N')).fn, source);
    });
  }
});
