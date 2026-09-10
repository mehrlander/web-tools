// docs/SURFACING.md is @-imported by CLAUDE.md into every session with this
// repo checked out, and fetched whole by the default skill everywhere else.
// A word in it is a cost paid at every session start, which is the argument
// PR #509 made when it cut the injected documents to their declarations, and
// PR #634 extended when it retired the injection hook and CONVENTIONS.md:
// what remains always-loaded is CLAUDE.md (ceilinged in claude-md.test.mjs)
// and this one document.
//
// If the ceiling fails, look to trim redundant state details, enforced rules,
// or duplicated content, or move material to surfacing-extended.md, which
// loads only on demand. Raising the limit requires user approval.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const read = (p) => readFileSync(path.join(repoRoot, p), 'utf8');
const words = (s) => s.split(/\s+/).filter(Boolean).length;

// 1,461 words when set (2026-09-09, after the primitives leaned on
// surfacing-extended.md); the ceiling sits a stretch of growth above that.
const LIMIT = 1800;

test('docs/SURFACING.md stays under its ceiling', () => {
  const n = words(read('docs/SURFACING.md'));
  assert.ok(n < LIMIT,
    `docs/SURFACING.md is ${n} words, over its ${LIMIT}-word ceiling. It loads ` +
    'at every session start. Trim or move material to surfacing-extended.md. ' +
    'Raising the limit requires user approval.');
});
