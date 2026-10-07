// The derived half of docs/harness.csv, the harness registry.
// (docs/tools.csv was taken: it is the curated Tools gallery manifest,
// the app's Tools view.)
//
// node/ and python/ are the two code layers docs/code-layers.md could name
// but not account for: at the 2026-08-08 count, 57 of the repo's 94 harness
// files were scenario drivers of which prose named 9. This module derives the
// part a machine can see, so the registry only has to author the part it
// cannot: what each file is FOR (`role`), scaffolded blank and counted, the
// same ledger discipline docs/tests.csv applies to `protects`.
//
// Derived here, never authored:
//
//   invocation  the route execution arrives on. The pull routes (someone
//               asks):
//                 npm:<script>  a package.json script invokes it
//                 driver        lives in node/render/scenarios/, the --script
//                               argument to `npm run shot`; drivers are passed
//                               by path, so no other route will ever name one
//                 imported      another harness file imports or invokes it
//                 argv          carries a shebang; run by hand
//               The push routes (an event asks), added 2026-09-10:
//                 env:build     the environment's setup script, fetched and
//                               piped to bash by the claude.ai environment
//                               settings when a snapshot is built. Those
//                               settings live outside the repo, so the file is
//                               recognized by the curl line in its own header
//                               that fetches its own path into bash
//                 git:<name>    lives in .githooks/; the filename is the event
//                 session:SessionStart  a .claude/hooks/session-*.sh, run by
//                               the plugin's dispatcher at session start
//                 hook:<event>  a plugin hook script; the event comes from the
//                               declaration in skills/hooks/hooks.json
//                 ci:<events>   a .github/workflows/ file; the events come from
//                               its top-level `on:` block, '+'-joined
//                 none found    no route the derivation can see
//   emits       writes a file (a generator rather than a reader)
//   named       its path or basename appears in any tracked .md file
//   tested      its basename appears in a file under node/test/
//   layer, lines
//
// node/test/ is deliberately absent: docs/tests.csv is that folder's registry,
// and one file must not answer to two registries. Skill-bundle scripts under
// skills/ (corpus_search.py and kin) are absent for a different
// reason: they are the internals of skills that travel to other repos, not
// this repo's machinery, and no warning state applies to them. The plugin's
// hook bundle at skills/hooks/ is the one exception: it runs HERE,
// on platform events, in every session.
//
// Run `npm run tools-index` to restamp; `--check` compares instead of writing.

import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { parseCsv, writeCsv } from './registries-load.mjs';

// Fixed here so a restamp cannot reorder the file.
const HARNESS_COLS = ['path', 'role', 'layer', 'lines', 'invocation', 'emits', 'named', 'tested'];
import { fileURLToPath } from 'node:url';

const CODE_EXT = ['.mjs', '.js', '.cjs', '.py', '.sh'];

function tracked(repoRoot) {
  return execFileSync('git', ['ls-files'], { cwd: repoRoot, encoding: 'utf8' })
    .split('\n').filter(Boolean);
}

const read = (repoRoot, rel) => readFileSync(path.join(repoRoot, rel), 'utf8');

/** path -> npm script name, for files a package.json script invokes. */
function npmScriptMap(repoRoot) {
  const out = new Map();
  const scripts = JSON.parse(read(repoRoot, 'package.json')).scripts || {};
  for (const [name, cmd] of Object.entries(scripts)) {
    for (const m of cmd.matchAll(/[\w./-]+\.(?:mjs|js|cjs|py|sh)/g)) {
      if (!out.has(m[0])) out.set(m[0], name);
    }
  }
  return out;
}

/**
 * Files another node file imports, so a helper is not read as dead. The
 * importers include node/test/, which is not itself a subject: a derivation
 * a gate imports has a route, and reading it as `none found` would report the
 * warning state on a file the suite runs on every push. It changes exactly one
 * row today, the other four helpers imported only by tests having an npm
 * script that outranks `imported` anyway.
 */
function importedSet(repoRoot, files) {
  const imported = new Set();
  for (const rel of files) {
    if (!/\.(mjs|js|cjs)$/.test(rel)) continue;
    const src = read(repoRoot, rel);
    for (const m of src.matchAll(/from\s+['"](\.[^'"]+)['"]/g)) {
      imported.add(path.posix.normalize(path.posix.join(path.posix.dirname(rel), m[1])));
    }
  }
  return imported;
}

/** basename -> event, from the plugin's hook declaration. A script in the
 *  bundle that hooks.json never names falls through to the later rules and
 *  usually lands on `imported` (the dispatcher or another hook invokes it). */
function pluginHookEvents(repoRoot) {
  const out = new Map();
  let decl;
  try { decl = JSON.parse(read(repoRoot, 'skills/hooks/hooks.json')).hooks || {}; }
  catch { return out; }
  for (const [event, entries] of Object.entries(decl)) {
    for (const e of entries) {
      for (const h of e.hooks || []) {
        const m = (h.command || '').match(/([\w.-]+\.(?:sh|py|mjs|js))/);
        if (m) out.set(m[1], event);
      }
    }
  }
  return out;
}

/** Whether a file's source carries the one-line install that fetches the file's
 *  own path and pipes it to bash, which is how the environment settings run the
 *  setup script. Without this rule the script read as `imported`, because the
 *  environment-report hook names it to compare its text, not to run it. */
function fetchesItselfIntoBash(rel, src) {
  const own = rel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('curl\\b[^\\n]*/' + own + '\\s*\\|\\s*bash\\b').test(src);
}

/** The top-level `on:` events of a workflow, '+'-joined. Reads the two YAML
 *  shapes the platform accepts (a nested block, or `on: [a, b]`) with a line
 *  scan rather than a YAML library, which the suite deliberately does not
 *  carry. */
function workflowEvents(src) {
  const lines = src.split('\n');
  const i = lines.findIndex(l => /^(['"]?)on\1:/.test(l));
  if (i < 0) return 'unknown';
  const inline = lines[i].match(/^\S+:\s*\[([^\]]+)\]/);
  if (inline) return inline[1].split(',').map(s => s.trim()).join('+');
  const events = [];
  for (let j = i + 1; j < lines.length; j++) {
    const m = lines[j].match(/^  (\w+):/);
    if (lines[j].trim() && !lines[j].startsWith('  ') && !lines[j].startsWith('#')) break;
    if (m) events.push(m[1]);
  }
  return events.join('+') || 'unknown';
}

/**
 * Derive the machine-visible fields for every harness file on disk.
 * @param {string} repoRoot
 * @returns {Map<string, object>} path -> derived row fields
 */
export function deriveTools(repoRoot) {
  const files = tracked(repoRoot);
  const subjects = files.filter(f =>
    ((f.startsWith('node/') || f.startsWith('python/') ||
      f.startsWith('.claude/') || f.startsWith('skills/hooks/')) &&
     !f.startsWith('node/test/') &&
     CODE_EXT.some(e => f.endsWith(e))) ||
    // Git hooks are extensionless by contract; the folder is the filter.
    (f.startsWith('.githooks/') && !path.posix.basename(f).includes('.')) ||
    (f.startsWith('.github/workflows/') && /\.ya?ml$/.test(f)));
  const hookEvents = pluginHookEvents(repoRoot);
  const npm = npmScriptMap(repoRoot);
  const imported = importedSet(repoRoot, [...subjects, ...files.filter(f => f.startsWith('node/test/'))]);
  const prose = files.filter(f => f.endsWith('.md')).map(f => read(repoRoot, f)).join('\n');
  const tests = files.filter(f => f.startsWith('node/test/')).map(f => read(repoRoot, f)).join('\n');

  // A subject another subject invokes by name (a shell hook calling its
  // python half, the dispatcher running the injector) has a route the node
  // import scan cannot see.
  const srcs = new Map(subjects.map(rel => [rel, read(repoRoot, rel)]));
  const invoked = new Set();
  for (const rel of subjects) {
    const base = path.posix.basename(rel);
    for (const [other, osrc] of srcs) {
      if (other !== rel && osrc.includes(base)) { invoked.add(base); break; }
    }
  }

  const out = new Map();
  for (const rel of subjects.sort()) {
    const src = srcs.get(rel);
    const base = path.posix.basename(rel);
    let invocation;
    if (rel.startsWith('node/render/scenarios/')) invocation = 'driver';
    else if (fetchesItselfIntoBash(rel, src)) invocation = 'env:build';
    else if (rel.startsWith('.githooks/')) invocation = 'git:' + base;
    else if (rel.startsWith('.claude/hooks/session-')) invocation = 'session:SessionStart';
    else if (hookEvents.has(base)) invocation = 'hook:' + hookEvents.get(base);
    else if (rel.startsWith('.github/workflows/')) invocation = 'ci:' + workflowEvents(src);
    else if (npm.has(rel) || npm.has(base)) invocation = 'npm:' + (npm.get(rel) || npm.get(base));
    else if (imported.has(rel)) invocation = 'imported';
    else if (invoked.has(base)) invocation = 'imported';
    else if (src.startsWith('#!')) invocation = 'argv';
    else invocation = 'none found';
    out.set(rel, {
      layer: path.posix.dirname(rel),
      lines: src ? src.split('\n').length : 0,
      invocation,
      // yes/no rather than a raw boolean, which is the estate's CSV spelling
      // (manifest-fields.required, properties.exclusive) and is declared as a
      // closed domain so the gate holds it. Letting a JS boolean stringify
      // itself was how this column came out `true` while its one reader tested
      // for 'yes', and the Harness strip read 0 named of 147 for two days.
      // Both fs spellings, because the async one is the estate's default in
      // node/build/ and the sync-only pattern reported `no` for seven files
      // that plainly write, docs-readme, pages-index and snags-index among
      // them: three of the generators whose output the derived-artifacts gate
      // exists to hold. A field claiming "writes a file" was wrong about the
      // files most depended on being right.
      emits: /writeFileSync|\bwriteFile\(|open\([^)]*['"][wa]/.test(src) ? 'yes' : 'no',
      named: (prose.includes(rel) || prose.includes(base)) ? 'yes' : 'no',
      tested: tests.includes(base) ? 'yes' : 'no',
    });
  }
  return out;
}

/**
 * A MOVED FILE KEEPS ITS ROLE. Rows are keyed by path, so a move reads as one
 * row dropped and one added blank, and the authored half is lost without a
 * word: moving the plugin's hooks into skills/hooks/ on 2026-09-27 blanked nine
 * roles that way. Carry a role across when exactly one dropped row and exactly
 * one added row share a basename, and never when either side is ambiguous,
 * since a guessed role is worse than a blank one.
 * @param {Map<string, {role?: string}>} byPath  registry rows by path, mutated
 * @param {string[]} added  paths new to the registry this run
 * @param {string[]} gone   paths no longer on disk
 * @returns {string[]} one "from -> to" line per carried role
 */
export function carryMovedRoles(byPath, added, gone) {
  const byBase = (list) => {
    const m = new Map();
    for (const p of list) {
      const b = path.posix.basename(p);
      m.set(b, m.has(b) ? null : p);
    }
    return m;
  };
  const goneByBase = byBase(gone), addedByBase = byBase(added);
  const carried = [];
  for (const [b, to] of addedByBase) {
    const from = goneByBase.get(b);
    if (!to || !from || !byPath.get(from)?.role) continue;
    byPath.get(to).role = byPath.get(from).role;
    carried.push(`${from} -> ${to}`);
  }
  return carried;
}

// ── CLI: restamp (or --check) docs/tools.csv ───────────────────────────────

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const file = path.join(repoRoot, 'docs', 'harness.csv');
  const checkOnly = process.argv.includes('--check');
  let registry;
  try { registry = { tools: parseCsv(readFileSync(file, 'utf8')) }; }
  catch { registry = { tools: [] }; }
  const derived = deriveTools(repoRoot);

  const byPath = new Map((registry.tools || []).map(t => [t.path, t]));
  const added = [];
  for (const [p] of derived) {
    if (!byPath.has(p)) {
      const row = { path: p, role: '' };
      byPath.set(p, row);
      added.push(p);
    }
  }
  const gone = [...byPath.keys()].filter(p => !derived.has(p));

  const carried = carryMovedRoles(byPath, added, gone);

  const rows = [...byPath.values()].filter(t => derived.has(t.path));

  for (const t of rows) {
    const d = derived.get(t.path);
    const ordered = { path: t.path, role: t.role || '', ...d };
    for (const k of Object.keys(t)) delete t[k];
    Object.assign(t, ordered);
  }
  rows.sort((a, b) => a.path.localeCompare(b.path));
  registry.tools = rows;

  const bytes = writeCsv(registry.tools, HARNESS_COLS);
  if (checkOnly) {
    let current = null;
    try { current = readFileSync(file, 'utf8'); } catch { /* absent counts as stale */ }
    if (current !== bytes) {
      console.error('docs/harness.csv is behind its sources; run: npm run tools-index');
      process.exit(1);
    }
    process.exit(0);
  }
  writeFileSync(file, bytes);

  const layers = {};
  for (const t of rows) layers[t.layer] = (layers[t.layer] || 0) + 1;
  const named = rows.filter(t => t.named === 'yes').length;
  const tested = rows.filter(t => t.tested === 'yes').length;
  const blank = rows.filter(t => !t.role).length;
  console.log(`tools-index: ${rows.length} files (` +
              Object.entries(layers).map(([l, n]) => `${n} ${l}`).join(', ') + `); ` +
              `${named} named, ${tested} tested`);
  for (const p of added) if (!byPath.get(p).role) console.log('  added   ' + p + '  (role is blank; say what it is for)');
  for (const p of gone) console.log('  dropped ' + p);
  for (const c of carried) console.log('  carried role ' + c);
  if (blank) console.log(`  ${blank} row(s) do not say what they are for`);
}
