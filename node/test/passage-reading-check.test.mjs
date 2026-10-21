// skills/passage-reading/scripts/check.py: the worked example passes, and a
// link end that cuts an atom short is refused. A link end is a whole atom or
// a mention (docs/envelopes/passage-reading.md, "A sentence").

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const SKILL = path.join(repoRoot, 'skills', 'passage-reading');
const CHECK = path.join(SKILL, 'scripts', 'check.py');
const EXAMPLE = path.join(SKILL, 'references', 'skill-prefs-description.json');
const check = (file) => spawnSync('python3', ['-I', CHECK, file, '--no-context'], { encoding: 'utf8' });

test('the worked example passes the check', () => {
  const r = check(EXAMPLE);
  assert.equal(r.status, 0, r.stderr);
});

test('a link end that is part of an atom is refused', () => {
  const reading = JSON.parse(readFileSync(EXAMPLE, 'utf8'));
  const link = reading.sentences.find((s) => s.n === 8).links.find((l) => l.here === 'Aim for 150 characters');
  link.here = 'Aim for 150';
  const file = path.join(mkdtempSync(path.join(tmpdir(), 'passage-reading-')), 'reading.json');
  writeFileSync(file, JSON.stringify(reading));
  const r = check(file);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /s8 link here: 'Aim for 150' is not an atom's or a mention's quote in s8/);
});
