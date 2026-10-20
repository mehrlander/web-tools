#!/usr/bin/env node
// The reply check's prompt, written into skills/hooks/hooks.json from the
// peeve list.
//
// The Stop hook of type prompt sends each final reply to Haiku with this
// prompt. Its checks are rows of skills/peeves/peeves.csv, quoted whole, so
// the peeve list stays the one statement of each rule. IDS names the peeves a
// reply's own text can show; the rest need the session or a page to judge.
//
// --check compares bytes and writes nothing, which is what
// derived-artifacts.test.mjs runs.

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv } from './registries-load.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PEEVES = path.join(repoRoot, 'skills', 'peeves', 'peeves.csv');
const HOOKS = path.join(repoRoot, 'skills', 'hooks', 'hooks.json');
const IDS = ['P03', 'P04', 'P06', 'P07', 'P10', 'P14', 'P15', 'P20', 'P22', 'P24', 'P28', 'P64'];

export function prompt(peeves) {
  const byId = new Map(peeves.map(p => [p.id, p]));
  const rows = IDS.map(id => {
    const p = byId.get(id);
    if (!p) throw new Error(`reply-check-hook: ${id} is not in skills/peeves/peeves.csv`);
    return `${p.id} ${p.name}. ${p.peeve} Look for: ${p.look_for}`;
  });
  return [
    "You check the reply a Claude Code session is about to end its turn with, against the owner's recorded peeves below. The hook input:",
    '$ARGUMENTS',
    'If stop_hook_active is true, answer {"ok": true}. Otherwise read last_assistant_message. A reply of one line passes.',
    rows.join('\n'),
    'If the reply trips none of them, answer {"ok": true}. Otherwise answer {"ok": false, "reason": "..."}, where the reason lists each peeve tripped by id, quotes the words that trip it, and says what to change. Answer with the JSON object only.',
  ].join('\n\n');
}

export function render(hooksText, peevesText) {
  const hooks = JSON.parse(hooksText);
  const found = (hooks.hooks.Stop || []).flatMap(e => e.hooks).filter(h => h.type === 'prompt');
  if (found.length !== 1) throw new Error(`reply-check-hook: expected one prompt hook under Stop, found ${found.length}`);
  found[0].prompt = prompt(parseCsv(peevesText));
  return JSON.stringify(hooks, null, 2) + '\n';
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const before = readFileSync(HOOKS, 'utf8');
  const after = render(before, readFileSync(PEEVES, 'utf8'));
  if (process.argv.includes('--check')) {
    if (after !== before) {
      console.error('reply-check-hook: skills/hooks/hooks.json is behind skills/peeves/peeves.csv; run npm run reply-check-hook');
      process.exit(1);
    }
  } else if (after !== before) {
    writeFileSync(HOOKS, after);
    console.log('reply-check-hook: wrote the reply check prompt into skills/hooks/hooks.json');
  }
}
