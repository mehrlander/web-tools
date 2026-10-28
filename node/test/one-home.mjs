// A rule with one home in lib/: what the *-one-owner gates share. A gate names
// the file that keeps the rule, the files it excuses and why, and the line
// shape a copy of the rule takes; these walk the tracked sources for that
// shape and hold each excuse to still being needed.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../repo-root.mjs';

const SKIP = /^(pages\/drop\/|pages\/scratch\/|lib\/vendor\/)|\.min\.js$/;

// The page and library sources a copy could hide in, less the excused.
export const sources = (excused) => execFileSync('git', ['ls-files', '-z', 'lib', 'pages', 'app', 'popups'], { cwd: repoRoot, encoding: 'utf8' })
  .split('\0').filter((f) => /\.(js|html)$/.test(f) && !SKIP.test(f) && !excused.has(f));

// `file:line` for each line `hit` matches; `read` lets a gate test its shape on
// lines it makes up.
export const linesMatching = (hit) => (paths, read = (f) => readFileSync(join(repoRoot, f), 'utf8')) =>
  paths.flatMap((f) => read(f).split('\n').flatMap((line, i) => hit(line) ? [`${f}:${i + 1}`] : []));

// An excuse outlives its reason when the file stops matching: it then waits
// to excuse the next copy, so the gate fails instead.
export function excusesHold(excused, home, offendersIn, doing) {
  for (const [f, why] of excused) {
    if (f === home) continue;
    assert.ok(offendersIn([f]).length > 0, `${f} is excused (${why}) but no longer ${doing}`);
  }
}
