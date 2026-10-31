// node/paste-run-link.mjs mints the link pages/paste-run.html reads: the
// payload {title, ask, fn, send?} gzipped and base64url in #gz=, which
// kits/gz-payload.js decodes. These hold the minter to that contract.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { repoRoot } from '../repo-root.mjs';

const mint = (...args) => execFileSync('node', [path.join(repoRoot, 'node/paste-run-link.mjs'), ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
const payload = (url) => JSON.parse(gunzipSync(Buffer.from(new URL(url).hash.replace(/^#gz=/, ''), 'base64url')).toString('utf8'));
const dir = mkdtempSync(path.join(tmpdir(), 'paste-run-'));
const fn = path.join(dir, 'fn.js');
writeFileSync(fn, '(rows) => rows.length\n');

test('the link carries the title, the ask and the function, and opens the page', () => {
  const url = mint(fn, '--title', 'Counts', '--ask', 'Paste a sheet');
  assert.match(url, /^https:\/\/mehrlander\.github\.io\/web-tools\/pages\/paste-run\.html#gz=[A-Za-z0-9_-]+$/);
  assert.deepEqual(payload(url), { title: 'Counts', ask: 'Paste a sheet', fn: '(rows) => rows.length' });
});

test('--send splits into the stage target and the file name', () => {
  const p = payload(mint(fn, '--title', 'T', '--send', 'mehrlander/home@main:projects/x/dump/out.tsv'));
  assert.deepEqual(p.send, { to: 'mehrlander/home@main:projects/x/dump', file: 'out.tsv' });
});

test('a file that is not a function is refused', () => {
  const bad = path.join(dir, 'bad.js');
  writeFileSync(bad, 'rows => {');
  assert.throws(() => mint(bad, '--title', 'T'));
});
