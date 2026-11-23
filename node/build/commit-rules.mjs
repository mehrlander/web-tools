// node/build/commit-rules.mjs: run the rules in docs/commit-rules.csv.
//
//   node node/build/commit-rules.mjs                 what .githooks/pre-commit runs
//   node node/build/commit-rules.mjs --all           every rule whose repair is yes
//   node node/build/commit-rules.mjs --kind <kind>   only that kind's rules
//
// A rule is a Make rule: sources, a command, outputs. Without --all a rule runs
// when `git status --porcelain -- <sources>` lists anything, asked again before
// each rule so a rule sees what earlier rules staged; a rule with no sources
// runs every time. Rules run in file order. When a command succeeds its outputs
// are staged. A check has no outputs, and its command's output is printed when
// the command exits nonzero. Nothing here blocks a commit: every failure is a
// warning and the exit code is 0.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { repoRoot } from '../repo-root.mjs';
import { parseCsv } from './registries-load.mjs';

export const RULES_FILE = 'docs/commit-rules.csv';
export const KINDS = ['build', 'generate', 'package', 'check'];

const list = (s) => String(s || '').split(';').map(x => x.trim()).filter(Boolean);

export function readRules(root = repoRoot) {
  return parseCsv(readFileSync(path.join(root, RULES_FILE), 'utf8'))
    .map(r => ({ ...r, sources: list(r.sources), outputs: list(r.outputs) }));
}

const warn = (msg) => process.stderr.write('commit-rules: ' + msg + '\n');
const git = (...args) => spawnSync('git', args, { cwd: repoRoot, encoding: 'utf8' });
const pending = (sources) => (git('status', '--porcelain', '--', ...sources).stdout || '').trim() !== '';
// Through a shell, so `npm` and a python3 shim resolve on Windows as they do in a terminal.
const sh = (command, stdio) => spawnSync(command, { cwd: repoRoot, shell: true, encoding: 'utf8', stdio });

// A missing output is reported rather than skipped: `git add X || true` cannot
// tell "nothing to stage" from "the generator writes somewhere else now".
function stage(rule) {
  for (const f of rule.outputs) {
    if (existsSync(path.join(repoRoot, f))) git('add', '--', f);
    else warn(`${rule.rule}: nothing at ${f} to stage; was it renamed, or does '${rule.command}' write elsewhere now?`);
  }
}

export function run({ all = false, kind = '' } = {}) {
  for (const rule of readRules()) {
    if (kind && rule.kind !== kind) continue;
    if (all ? rule.repair !== 'yes' : rule.sources.length && !pending(rule.sources)) continue;
    if (rule.kind === 'check') {
      const r = sh(rule.command, 'pipe');
      if (r.status !== 0) {
        for (const line of ((r.stdout || '') + (r.stderr || '')).split('\n')) if (line.trim()) warn(line);
      }
    } else if (sh(rule.command, 'ignore').status === 0) stage(rule);
    else warn(`${rule.rule}: '${rule.command}' failed; ${rule.outputs.join(', ')} may be stale`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const at = args.indexOf('--kind');
  const kind = at >= 0 ? args[at + 1] : '';
  // npm adds node_modules/.bin to PATH and git does not, and checkout-setup can
  // put a python3 shim there.
  process.env.PATH = path.join(repoRoot, 'node_modules', '.bin') + path.delimiter + process.env.PATH;
  process.env.PYTHONUTF8 = '1';
  process.env.PYTHONIOENCODING = 'utf-8';
  try {
    if (kind && !KINDS.includes(kind)) throw new Error(`--kind is one of ${KINDS.join(', ')}`);
    run({ all: args.includes('--all'), kind });
  } catch (e) {
    warn(e.message);
  }
}
