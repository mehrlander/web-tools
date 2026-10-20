// Every Python script that lists tracked files asks git for NUL-separated
// output (`git ls-files -z`). Without -z, git quotes and octal-escapes any path
// that is not plain ASCII, so a script receives a name that is not on disk:
// web-tools-private held fifteen such paths on 2026-10-20 (an emoji in three
// shortcut names, Danish in another), and ten of the fourteen wrappers here
// read them that way. dead-links.py also split on any whitespace, so a path
// with a space came back in pieces.
//
// The scripts stay self-contained rather than sharing a helper: the portable
// ones are fetched one file at a time into another repo's .web-tools-scripts/,
// where a sibling import would not resolve. So the rule is checked here, in
// each file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from '../repo-root.mjs';

test('every python ls-files call passes -z', () => {
  const files = execFileSync('git', ['ls-files', 'python/*.py', 'python/**/*.py'], { cwd: repoRoot, encoding: 'utf8' })
    .split('\n').filter(Boolean);
  const offenders = [];
  for (const f of new Set(files)) {
    readFileSync(path.join(repoRoot, f), 'utf8').split('\n').forEach((line, i) => {
      if (/["']ls-files["']/.test(line) && !/["']-z["']/.test(line)) offenders.push(`${f}:${i + 1}`);
    });
  }
  assert.deepEqual(offenders, [], 'these list files without -z; a non-ASCII path comes back quoted and escaped');
});
