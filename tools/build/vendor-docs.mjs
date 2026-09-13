#!/usr/bin/env node
// The plugin's copies of the traveling docs, under .claude/skills/default/.
//
// docs/ is authoritative and these are copies by design: a session that
// installed the portable plugin has them on disk, so loading the conventions
// costs no fetch and works with the network down. The cost is the usual cost of
// a copy, and it has already been paid once (the copies drifted and were
// resynced by hand in 2b785b2).
//
// UNTIL 2026-09-11 NOTHING HELD THEM. Three places said otherwise: both
// surfacing rows in docs/docs.csv named "vendored copy byte-gated
// (portable-manifest.test.mjs)", tools/README.md's refresh table listed a `cp`
// leg, and portable-manifest.test.mjs itself carried a comment about the
// failure mode of an ungated copy directly above a test that checks link
// targets instead. The copies happened to be identical, which is the only
// reason the claim was never caught being false. Adding a third traveling doc
// (QUALIFIED-WRITING.md) is what made the gap worth closing rather than noting.
//
// --check compares bytes and writes nothing, which is what
// derived-artifacts.test.mjs runs.

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// Every doc that ships inside the default skill. A doc added here must also be
// linked as an absolute hub URL unless its target travels too: the
// SHIPPED_TOGETHER check in portable-manifest.test.mjs holds that separately.
export const VENDORED = ['SURFACING.md', 'surfacing-course.md', 'QUALIFIED-WRITING.md'];

const src = (name) => path.join(repoRoot, 'docs', name);
const dst = (name) => path.join(repoRoot, '.claude', 'skills', 'default', name);

const check = process.argv.includes('--check');
const behind = [];

for (const name of VENDORED) {
  const want = readFileSync(src(name), 'utf8');
  let have = null;
  try { have = readFileSync(dst(name), 'utf8'); } catch { /* not vendored yet */ }
  if (have === want) continue;
  if (check) { behind.push(name); continue; }
  writeFileSync(dst(name), want);
}

if (check && behind.length) {
  console.error('vendored copies behind docs/: ' + behind.join(', ') +
    "\nrun 'npm run vendor-docs' and commit the result");
  process.exit(1);
}
