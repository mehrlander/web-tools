// No tracked text file holds a NUL byte. ripgrep, the engine behind an agent's
// Grep tool, treats a file with one as binary and leaves it out of results
// without a word: on 2026-10-25 lib/kits/read-aloud.js wrote its
// control-character class as raw bytes, and a search for speechText listed two
// other files and not the one that defines it. The snag nul-byte-truncates-grep
// recorded the first bite, in estate.js. Write such a byte as an escape.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const TEXT = new Set(['.js', '.mjs', '.cjs', '.ts', '.html', '.htm', '.css', '.md', '.csv', '.json', '.jsonl',
  '.py', '.sh', '.ps1', '.psm1', '.txt', '.yml', '.yaml', '.svg', '.xml', '.toml']);

test('no tracked text file holds a NUL byte', () => {
  const files = execFileSync('git', ['-C', repoRoot, 'ls-files', '-z'], { encoding: 'utf8' }).split('\0')
    .filter(f => f && TEXT.has(path.extname(f).toLowerCase()));
  const found = [];
  for (const f of files) {
    const full = path.join(repoRoot, f);
    let bytes;
    try { if (!statSync(full).isFile()) continue; bytes = readFileSync(full); }
    catch { continue; }
    const at = bytes.indexOf(0);
    if (at >= 0) found.push(`${f}:${bytes.subarray(0, at).toString('latin1').split('\n').length}`);
  }
  assert.deepEqual(found, [], 'write each NUL as an escape (\\u0000 in JavaScript, \\x00 in Python)');
});
