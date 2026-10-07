// Two rules TRACKER.md already states about task files, made checkable.
//
// The first is its own prose-style line ("no em dashes"). The second is the
// Related block's "prefer paths that exist on `main`". Both were stated and
// neither was enforced, so the 2026-09-17 grooming pass introduced two em
// dashes and rewrote a live cross-repo path into one that does not exist,
// inside the same pass that added the pointer convention. A pointer section
// whose pointers are not checked is worth less than the prose it replaced.
//
// The path rule keys on the shape TRACKER.md's own example shows: a Related
// bullet opening with backticked tokens before its first colon. Those are
// repository paths. A bullet opening with `task ` or `PR ` is a reference of
// another kind, and backticks after the colon are prose (a command, a field
// name, a heading), so neither is path-checked. Writing a path that does not
// exist yet is still possible; put it after the colon, where it reads as a
// description rather than as a pointer to open.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const dir = path.join(repoRoot, 'tracker', 'tasks');
const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.md')).sort() : [];
const read = (f) => readFileSync(path.join(dir, f), 'utf8');

test('no task file uses an em dash', () => {
  const hits = [];
  for (const f of files) {
    read(f).split('\n').forEach((line, i) => {
      if (line.includes('—')) hits.push(`${f}:${i + 1}: ${line.trim()}`);
    });
  }
  assert.deepEqual(hits, [], `TRACKER.md: "no em dashes. Use colons, commas, semicolons, or new sentences."\n${hits.join('\n')}`);
});

// Bullets of a `## Related` section, as [file, lineNumber, bulletText].
const relatedBullets = () => {
  const out = [];
  for (const f of files) {
    let inBlock = false;
    read(f).split('\n').forEach((line, i) => {
      if (line.startsWith('## ')) inBlock = /^## Related\s*$/.test(line);
      else if (inBlock && line.startsWith('- ')) out.push([f, i + 1, line.slice(2)]);
    });
  }
  return out;
};

test('every path a Related block points at resolves in the tree', () => {
  const missing = [];
  for (const [f, line, bullet] of relatedBullets()) {
    const head = bullet.split(':')[0];
    if (/^(task|PR)\b/.test(head)) continue;
    const paths = head.match(/`([^`]+)`/g);
    if (!paths) continue;
    // A head is a pointer only if backticks are all it holds, so a prose lead-in
    // that happens to quote something is not read as a path.
    if (head.replace(/`[^`]+`/g, '').replace(/[\s,]/g, '') !== '') continue;
    for (const p of paths.map((s) => s.slice(1, -1))) {
      if (!existsSync(path.join(repoRoot, p))) missing.push(`${f}:${line}: ${p}`);
    }
  }
  assert.deepEqual(missing, [], `TRACKER.md asks a Related pointer to be a path that exists. These do not:\n${missing.join('\n')}`);
});
