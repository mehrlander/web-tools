// node/reception-link.mjs mints the link pages/reception.html reads: the
// payload {label?, note?, fn, dest?, file?} gzipped and base64url in #gz=,
// which kits/gz-payload.js decodes. These hold the minter to that contract.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
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

test('the label and the note are optional', () => {
  assert.deepEqual(payload(mint(fn)), { fn: '(rows) => rows.length' });
});

test('--dest and --file ride as an errand names them', () => {
  const p = payload(mint(fn, '--dest', 'mehrlander/home@main:projects/x/dump', '--file', 'out.tsv'));
  assert.deepEqual([p.dest, p.file], ['mehrlander/home@main:projects/x/dump', 'out.tsv']);
});

test('a malformed --dest, a --file without --dest, and a file that is not a function are refused', () => {
  assert.throws(() => mint(fn, '--dest', 'projects/x/dump'));
  assert.throws(() => mint(fn, '--file', 'out.tsv'));
  const bad = path.join(dir, 'bad.js');
  writeFileSync(bad, 'rows => {');
  assert.throws(() => mint(bad));
});
