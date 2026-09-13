// The two documents the portable plugin loads into every session: the
// conventions-nudge hook prods and /portable:default reads them. A word in
// either is a cost paid at every session start, which is the argument PR #509
// made when it cut the injected documents to their declarations, and PR #634
// extended when it retired the injection hook and CONVENTIONS.md. What remains
// always-loaded is CLAUDE.md (ceilinged in claude-md.test.mjs) and these two.
//
// The mechanism changed on 2026-09-12 and the cost did not. web-tools
// @-imported both until then; nothing imports them now and the plugin delivers
// them instead, so the per-session price is the same and so is the ceiling.
// QUALIFIED-WRITING.md gained one here the same day: it had been a section of
// CLAUDE.md, covered by that file's ceiling, and splitting it out had quietly
// moved always-loaded words out from under any limit at all.
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

// 216 words when set (2026-09-12), four rules and a scope line; the ceiling
// leaves room to explain a rule without room to grow a second document.
const WRITING_LIMIT = 600;

test('docs/QUALIFIED-WRITING.md stays under its ceiling', () => {
  const n = words(read('docs/QUALIFIED-WRITING.md'));
  assert.ok(n < WRITING_LIMIT,
    `docs/QUALIFIED-WRITING.md is ${n} words, over its ${WRITING_LIMIT}-word ` +
    'ceiling. It loads at every session start beside SURFACING.md. Trim, or ' +
    'move material to a document the plugin does not push. Raising the limit ' +
    'requires user approval.');
});

test('docs/SURFACING.md stays under its ceiling', () => {
  const n = words(read('docs/SURFACING.md'));
  assert.ok(n < LIMIT,
    `docs/SURFACING.md is ${n} words, over its ${LIMIT}-word ceiling. It loads ` +
    'at every session start. Trim or move material to surfacing-extended.md. ' +
    'Raising the limit requires user approval.');
});
