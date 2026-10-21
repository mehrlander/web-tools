// kits/gz-payload.js, the one #gz= codec, and the gate that keeps it the one.
//
// On 2026-10-20 seventeen pages and components decoded the payload and nine
// encoded it, each with its own copy. The format agreed; the edges did not:
// six re-padded the base64 and the rest relied on atob forgiving it, and only
// the renderer tolerated the whitespace a chat client wraps into a long link.
// What is pinned below is the codec the copies now share, and that a payload
// minted by any of the old encoders still opens.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { loadKit, repoRoot } from './bootstrap.mjs';

const { GzPayload: G } = loadKit('gz-payload.js');

test('text and JSON round-trip, Unicode included', async () => {
  const text = 'héllo 🌳\r\n'.repeat(50);
  assert.equal(await G.decode(await G.encode(text)), text);
  const value = { items: [{ name: 'a.md', text: '# A\n' }], n: 3 };
  assert.deepEqual(await G.decodeJson(await G.encodeJson(value)), value);
});

test('an encoded payload is base64url: safe in a fragment read by URLSearchParams', async () => {
  const s = await G.encode('?'.repeat(4000) + '>'.repeat(4000));
  assert.match(s, /^[A-Za-z0-9_-]+$/, 'no +, / or = padding');
  assert.equal(new URLSearchParams('gz=' + s).get('gz'), s);
});

test('a payload any of the old encoders minted still opens', async () => {
  // Node's gzip, as stage-link.mjs and the build scripts mint it.
  const bytes = gzipSync(Buffer.from('{"ok":true}'));
  const std = Buffer.from(bytes).toString('base64');            // standard, padded
  const url = std.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  for (const s of [std, url, url.replace(/(.{20})/g, '$1\n  ')]) {
    assert.deepEqual(await G.decodeJson(s), { ok: true }, JSON.stringify(s.slice(0, 30)));
  }
});

test('a large payload encodes without overflowing the argument limit', async () => {
  const big = Array.from({ length: 300000 }, (_, i) => String.fromCharCode(33 + (i * 7919) % 90)).join('');
  assert.equal(await G.decode(await G.encode(big)), big);
});

// The files that keep a gzip stream of their own, each for a reason the codec
// cannot answer. A new one fails here.
const ALLOWED = {
  'lib/kits/gz-payload.js': 'the codec itself',
  'pages/toss-render.html': 'its critical render path loads no lib',
  'pages/shortcut-edit.html': 'loads no lib',
  'pages/wsl-sync/pension-map.html': 'loads no lib',
  'lib/kits/compression.js': 'the GZ64: protocol, a different format for a different reader',
  'lib/alpineComponents/transform-workbench.js': 'its pasted bundles are standard base64, which its paste detector tests for',
  'lib/alpineComponents/file-review.js': 'inflates a .gz file being reviewed, not a link',
  'pages/chat-results.html': 'sample chat turns that quote the API, not code that runs',
};

test('only gz-payload.js carries the #gz= codec', () => {
  const files = execFileSync('git', ['ls-files', 'lib', 'pages', 'app', 'popups'], { cwd: repoRoot, encoding: 'utf8' })
    .split('\n').filter((f) => /\.(js|html)$/.test(f) && !f.startsWith('pages/scratch/') && !(f in ALLOWED));
  const offenders = files.filter((f) =>
    /new (?:De)?[Cc]ompressionStream\(\s*['"]gzip['"]/.test(readFileSync(path.join(repoRoot, f), 'utf8')));
  assert.deepEqual(offenders, [], 'these gzip a link payload themselves; use window.GzPayload instead');
});
