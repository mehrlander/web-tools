// docs/conversation.csv — the machine index of the conversation rules. Unlike
// routes.json, the PROSE is authoritative here: CONVERSATION.md is
// what sessions load and follow, and the manifest is its gated index for the
// Map view's Surfacing tab. This test holds membership two-way: every
// rule bullet's bold lead-in in CONVERSATION.md has a manifest row, and
// every row points at a real bullet. The summaries are paraphrases and stay
// unchecked, which docs/docs.csv's claims table says out loud.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseCsv } from '../build/registries-load.mjs';
import { repoRoot } from './bootstrap.mjs';

const manifest = { rules: parseCsv(readFileSync(path.join(repoRoot, 'docs', 'conversation.csv'), 'utf8')) };
// ONE document again since 2026-10-07. From 2026-09-07 the index also spanned
// surfacing-extended.md, a file created only to hold what would not fit under
// the injection channel's byte cap; that channel was retired on 2026-09-09, and
// each rule the file held either had an owning skill or document or was
// dropped.
const surfacing = readFileSync(path.join(repoRoot, 'docs', 'CONVERSATION.md'), 'utf8');

// The conventions: everything after the introduction's horizontal rule.
const section = surfacing.split('\n---\n')[1] || '';
const norm = (s) => s.replace(/[:.]\s*$/, '').trim();
const leadIns = [...section.matchAll(/^\* \*\*(.+?)\*\*/gm)].map(m => norm(m[1]));

test('the rules section parses and both sides are non-trivial', () => {
  assert.ok(leadIns.length > 10, 'found rule bullets in CONVERSATION.md');
  assert.ok(manifest.rules.length > 10, 'manifest has rows');
});

test('every CONVERSATION.md rule has a manifest row', () => {
  const rows = new Set(manifest.rules.map(p => norm(p.lead)));
  for (const lead of leadIns) {
    assert.ok(rows.has(lead), 'rule in CONVERSATION.md but not the manifest: ' + lead);
  }
});

test('every manifest row points at a real CONVERSATION.md rule', () => {
  const doc = new Set(leadIns);
  for (const p of manifest.rules) {
    assert.ok(doc.has(norm(p.lead)), 'in the manifest but not CONVERSATION.md: ' + p.lead);
    assert.ok(p.key && p.title && p.use, p.key + ': key/title/use');
  }
});
