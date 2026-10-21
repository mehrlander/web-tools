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
//                               run by bash from the claude.ai environment
//                               settings when a snapshot is built. Those
//                               settings live outside the repo, so the file is
//                               recognized by the curl line in its own header
//                               that fetches its own path into bash, piped
//                               (`| bash`) or saved first (`-o f && bash f`)
//                 git:<name>    lives in .githooks/; the filename is the event
//                 session:SessionStart  a .claude/hooks/session-*.sh, run by
//                               the plugin's dispatcher at session start
//                 hook:<event>  a plugin hook script; the event comes from the
//                               declaration in skills/hooks/hooks.json
//                 ci:<events>   a .github/workflows/ file; the events come from
//                               its top-level `on:` block, '+'-joined
//                 none found    no route the derivation can see
//   callers     what runs the file, semicolon-joined (added 2026-10-20): a
//               harness file that imports it, runs it by path (python3,
//               node, bash), runs its npm script, or finds it through the
//               hooks' plugin_script; node/test/ when the suite imports it;
//               and a tracked .md that gives the command to run it, which
//               stands for a reader following that document. A file named
//               only in prose or a comment has no caller: a mention is not a
//               call. The Automation tab reads this to count a file under
//               the triggers of whatever runs it, so a helper the commit
//               hook calls counts as running on an event.
//   emits       writes a file (a generator rather than a reader); for a
//               workflow, runs `git push`, so its run lands a commit (added
//               2026-10-07: the file-write patterns below never match YAML, so
//               wsl-fetch.yml, which commits to main monthly, read as a reader)
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
const HARNESS_COLS = ['path', 'role', 'layer', 'lines', 'invocation', 'callers', 'emits', 'named', 'tested'];
import { fileURLToPath } from 'node:url';
import { repoRoot } from '../repo-root.mjs';

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
  return new RegExp('curl\\b[^\\n]*/' + own + '(?:\\s*\\|\\s*bash\\b|\\s+&&\\s*bash\\b)').test(src);
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

// ── The commit hook's steps: docs/hook-legs.csv ────────────────────────────
//
// The harness registry has one row for .githooks/pre-commit, and that row is
// the least informative in it: the file is nineteen steps, each watching some
// paths and regenerating some files, and which step keeps which file true is
// the question a reader of the Harness tab is actually asking. Since
// refresh-derived.yml (2026-10-07) runs the same steps on main after a write
// that skipped the hook, the list also says what main is repaired against.
//
// Read off the hook's own structure rather than authored: each step opens with
// a `# --- leg <name>: <gloss> ---` header, guards on `changed <paths>`, runs
// an `npm run` script or a python3 script, and passes what it wrote to
// `stage`. A step with nothing to stage only warns. A step guarded by
// `refresh_all = 0` is skipped by `npm run artifacts:refresh`, the repair
// pass, which is the one fact about a step that the header never states.
export const HOOK_LEG_COLS = ['order', 'leg', 'gloss', 'watches', 'runs', 'stages', 'mode', 'in_repair'];
const HOOK = '.githooks/pre-commit';

export function deriveHookLegs(src) {
  const lines = src.split('\n');
  const legs = [];
  let cur = null;
  const add = (list, xs) => { for (const x of xs) if (x && !list.includes(x)) list.push(x); };
  for (const line of lines) {
    const head = line.match(/^# --- leg ([\w-]+):\s*(.*?)\s*-*\s*$/);
    if (head) {
      cur = { leg: head[1], gloss: head[2].trim(), watches: [], runs: [], stages: [], skipRepair: false };
      legs.push(cur);
      continue;
    }
    if (!cur || /^\s*#/.test(line)) continue;
    // Two guard shapes: the `changed` helper, and (pages-catalogs) a
    // `git status --porcelain -- <paths>` it filters further itself.
    const guard = line.match(/\bchanged\s+(.+?);\s*then\b/) || line.match(/git status --porcelain -- (.+?)\s*\|/);
    // A shell variable (`"$thumb"`, the thumbnail check) is a computed path,
    // not a watched one.
    if (guard) add(cur.watches, guard[1].split(/\s+/).map(s => s.replace(/^['"]|['"]$/g, '')).filter(s => !s.startsWith('$')));
    // A command named inside a warning (`refresh at wrap-up: npm run
    // pages-shots`) is advice to the reader, not a step the hook runs.
    if (/^\s*echo\b/.test(line)) continue;
    add(cur.runs, [...line.matchAll(/\bnpm run ([\w:-]+)/g)].map(m => 'npm run ' + m[1]));
    add(cur.runs, [...line.matchAll(/\bpython3 ([\w./-]+\.py)/g)].map(m => m[1]));
    const st = line.match(/^\s*stage\s+(.+?)\s*$/);
    if (st) add(cur.stages, st[1].split(/\s+/));
    if (/\$refresh_all"?\s*=\s*0/.test(line)) cur.skipRepair = true;
  }
  return legs.map((l, i) => ({
    order: String(i + 1),
    leg: l.leg,
    gloss: l.gloss,
    watches: l.watches.join(';'),
    runs: l.runs.join(';'),
    stages: l.stages.join(';'),
    mode: l.stages.length ? 'regenerates' : 'warns',
    in_repair: l.skipRepair ? 'no' : 'yes',
  }));
}

// ── Callers: what runs each file ────────────────────────────────────────────
//
// Comments and docstrings are stripped first, because the file that most
// often names another in a comment is the one describing it, not calling it:
// this file names a dozen it never runs.
const stripJs = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
const stripPy = s => s.replace(/("""|\'\'\')[\s\S]*?\1/g, '').replace(/(^|\s)#[^\n]*/g, '$1');
const stripSh = s => s.replace(/(^|\s)#(?!!)[^\n]*/g, '$1');
function codeOf(rel, src) {
  if (rel.endsWith('.py')) return stripPy(src);
  if (/\.(sh|ya?ml)$/.test(rel) || rel.startsWith('.githooks/')) return stripSh(src);
  return stripJs(src);
}
// A command that runs a file by path, as code or a document writes it.
const RUN = /\b(?:python3?|node|bash|sh)\s+(?:-\S+\s+)*["']?\.?\/?((?:[\w.$\{\}-]+\/)*([\w.-]+\.(?:py|mjs|js|cjs|sh)))\b/g;

/**
 * path -> sorted callers, for every subject. See the header's `callers`.
 * @param {string} repoRoot
 * @param {string[]} subjects  the harness files
 * @param {string[]} files     every tracked file
 * @param {Map<string,string>} npm  file -> npm script
 */
export function deriveCallers(repoRoot, subjects, files, npm) {
  const known = new Set(subjects);
  const callers = new Map(subjects.map(p => [p, new Set()]));
  const add = (target, from) => {
    if (callers.has(target) && target !== from) callers.get(target).add(from.startsWith('node/test/') ? 'node/test/' : from);
  };
  const byScript = new Map();
  for (const rel of subjects) {
    const script = npm.get(rel) || npm.get(path.posix.basename(rel));
    if (script && !byScript.has(script)) byScript.set(script, rel);
  }
  const byRun = (from, ref, base) => {
    const plain = ref.replace(/^.*?\$\{?\w+\}?\//, '');
    for (const t of subjects) {
      if (t === ref || t.endsWith('/' + plain) || (ref.includes('$') && path.posix.basename(t) === base)) add(t, from);
    }
  };
  const sources = [...subjects, ...files.filter(f => f.startsWith('node/test/') && /\.(mjs|js|cjs)$/.test(f))];
  for (const from of sources) {
    const code = codeOf(from, read(repoRoot, from));
    const dir = path.posix.dirname(from);
    for (const m of code.matchAll(/(?:from\s+|import\s*\(\s*|require\(\s*)['"](\.{1,2}\/[^'"]+)['"]/g)) {
      add(path.posix.normalize(path.posix.join(dir, m[1])), from);
    }
    if (from.endsWith('.py')) {
      for (const m of code.matchAll(/^\s*(?:from\s+([\w.]+)\s+import|import\s+([\w.]+))/gm)) {
        const mod = (m[1] || m[2]).replace(/^\.+/, '').split('.');
        for (const base of [dir, 'python']) {
          const t = path.posix.join(base, ...mod) + '.py';
          if (known.has(t)) add(t, from);
        }
      }
      // A hyphenated name cannot be imported, so such a module is loaded by
      // path through importlib, with the file named in a string.
      if (code.includes('spec_from_file_location')) {
        for (const m of code.matchAll(/['"]([\w.-]+\.py)['"]/g)) {
          for (const t of subjects) if (t.endsWith('/' + m[1])) add(t, from);
        }
      }
    }
    // A command inside a string counts: checkout-setup.mjs registers git's
    // merge driver as a quoted command, and git runs it. The cost is that a
    // message telling a reader what to run counts too (showing.py's warning
    // names npm run build:app), which adds a caller that only advises.
    for (const m of code.matchAll(RUN)) byRun(from, m[1], m[2]);
    for (const m of code.matchAll(/npm (?:run(?: -s)? ([\w:.-]+)|test\b)/g)) {
      const t = byScript.get(m[1] || 'test');
      if (t) add(t, from);
    }
    for (const m of code.matchAll(/plugin_script\s+(hooks\/[\w.-]+)/g)) add('skills/' + m[1], from);
  }
  // A package.json script that runs another through npm run.
  const scripts = JSON.parse(read(repoRoot, 'package.json')).scripts || {};
  for (const [name, cmd] of Object.entries(scripts)) {
    const from = byScript.get(name);
    for (const m of cmd.matchAll(/npm run (?:-s )?([\w:.-]+)/g)) {
      const t = byScript.get(m[1]);
      if (from && t) add(t, from);
    }
  }
  // A document that gives the command stands for a reader running it.
  for (const doc of files.filter(f => f.endsWith('.md'))) {
    for (const m of read(repoRoot, doc).matchAll(RUN)) if (known.has(m[1])) callers.get(m[1]).add(doc);
  }
  return new Map([...callers].map(([p, c]) => [p, [...c].sort()]));
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
  const callers = deriveCallers(repoRoot, subjects, files, npm);
  const prose = files.filter(f => f.endsWith('.md')).map(f => read(repoRoot, f)).join('\n');
  const tests = files.filter(f => f.startsWith('node/test/')).map(f => read(repoRoot, f)).join('\n');

  // A subject another subject invokes by name (a shell hook calling its
  // python half, the dispatcher running the injector) has a route the node
  // import scan cannot see. The name match alone also catches a comment that
  // mentions a command-line tool, so it counts only where deriveCallers
  // found code that runs the file.
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
    else if (invoked.has(base) && (callers.get(rel) || []).some(c => !c.endsWith('.md'))) invocation = 'imported';
    else if (src.startsWith('#!')) invocation = 'argv';
    else invocation = 'none found';
    out.set(rel, {
      layer: path.posix.dirname(rel),
      lines: src ? src.split('\n').length : 0,
      invocation,
      callers: (callers.get(rel) || []).join(';'),
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
      emits: (/writeFileSync|\bwriteFile\(|open\([^)]*['"][wa]/.test(src) ||
              (rel.startsWith('.github/workflows/') && /^[^#\n]*\bgit push\b/m.test(src))) ? 'yes' : 'no',
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
  // The hook's steps ride the same generator, the same hook leg and the same
  // --check, so the derived-artifacts gate already holding harness.csv holds
  // this file too.
  const legsFile = path.join(repoRoot, 'docs', 'hook-legs.csv');
  const legs = deriveHookLegs(read(repoRoot, HOOK));
  const legBytes = writeCsv(legs, HOOK_LEG_COLS);
  if (checkOnly) {
    const stale = [];
    for (const [f, want] of [[file, bytes], [legsFile, legBytes]]) {
      let current = null;
      try { current = readFileSync(f, 'utf8'); } catch { /* absent counts as stale */ }
      if (current !== want) stale.push(path.relative(repoRoot, f));
    }
    if (stale.length) {
      console.error(stale.join(' and ') + (stale.length > 1 ? ' are' : ' is') + ' behind its sources; run: npm run tools-index');
      process.exit(1);
    }
    process.exit(0);
  }
  writeFileSync(file, bytes);
  writeFileSync(legsFile, legBytes);

  const layers = {};
  for (const t of rows) layers[t.layer] = (layers[t.layer] || 0) + 1;
  const named = rows.filter(t => t.named === 'yes').length;
  const tested = rows.filter(t => t.tested === 'yes').length;
  const blank = rows.filter(t => !t.role).length;
  console.log(`tools-index: ${legs.length} hook steps in docs/hook-legs.csv`);
  console.log(`tools-index: ${rows.length} files (` +
              Object.entries(layers).map(([l, n]) => `${n} ${l}`).join(', ') + `); ` +
              `${named} named, ${tested} tested`);
  for (const p of added) if (!byPath.get(p).role) console.log('  added   ' + p + '  (role is blank; say what it is for)');
  for (const p of gone) console.log('  dropped ' + p);
  for (const c of carried) console.log('  carried role ' + c);
  if (blank) console.log(`  ${blank} row(s) do not say what they are for`);
}
