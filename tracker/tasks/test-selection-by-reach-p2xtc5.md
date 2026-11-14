---
id: test-selection-by-reach-p2xtc5
title: Select tests by what each file reads, and log what each costs
status: backlog
opened: 2026-11-13
project: testing
size: L
awaiting: owner approval of the CLAUDE.md wording (step 4)
---
# Select tests by what each file reads, and log what each costs

`npm test` runs all 433 `node/test/**/*.test.mjs` files (about 6,300 tests) in
five to six minutes on every push and pull request (`.github/workflows/test.yml`)
and whenever a session runs it; nothing selects. On the evening of 2026-11-13,
builder subagents spent 48 minutes inside full runs, one of them four times. The
aim: during work a session runs only the tests its diff calls for, the whole
suite runs only where it is cheap (CI, where nobody waits), and the testing
program and the Map view's Tests tab can show what triggers each test, what it
costs, and when it last ran slow.

The design was assessed in a chat session on 2026-11-13 and approved in
outline by the owner, who asked for it to be built in a Claude Code session.
The findings below are that session's, from one traced full run on main at
`b3e7527`, in a 2-core sandbox with tracing on. Absolute seconds are inflated
by both; ratios are the usable part.

## Findings

**Reach can be traced by the run itself.** Every test process already loads
`node/test/runtime-command.cjs` through `--require`. A second hook in that
position, patching `fs` reads (then `module.syncBuiltinESMExports()`) and
noting ESM resolution through `module.registerHooks` (present in Node 22.23),
recorded each repo file a test process read or imported, plus the process's own
wall time from start to exit. Prototype, as run (it must key its output by pid,
because the parent `node --test` process also loads it and would overwrite the
child's record at exit):

```js
const fs = require('node:fs'), path = require('node:path'), mod = require('node:module'), { fileURLToPath } = require('node:url');
const root = process.cwd(), seen = new Set();
const note = p => { try { if (typeof p !== 'string' && !(p instanceof URL)) return; const a = path.resolve(p instanceof URL ? fileURLToPath(p) : p); if (a.startsWith(root + path.sep) && !a.includes('node_modules')) seen.add(path.relative(root, a)); } catch {} };
for (const n of ['readFileSync','readFile','existsSync','readdirSync','statSync','openSync']) { const o = fs[n]; fs[n] = function (p, ...r) { note(p); return o.call(this, p, ...r); }; }
const pr = fs.promises; for (const n of ['readFile','readdir','stat']) { const o = pr[n]; pr[n] = function (p, ...r) { note(p); return o.call(this, p, ...r); }; }
mod.syncBuiltinESMExports();
mod.registerHooks({ resolve(s, c, next) { const r = next(s, c); if (r.url?.startsWith('file:')) note(new URL(r.url)); return r; } });
process.on('exit', () => { if (process.argv[1]) fs.writeFileSync(`/tmp/probe/${path.basename(process.argv[1])}.${process.pid}.json`, JSON.stringify({ file: path.relative(root, process.argv[1]), ms: Math.round(performance.now()), reads: [...seen].sort() })); });
```

Examples: `look.test.mjs` read 6 files (its kit, `traffic.js`, `gh-api.js`,
`bootstrap.mjs`, `repo-root.mjs`, itself); `map-view.test.mjs` read 51. Most
read across the suite: `node/repo-root.mjs` (412 files), `lib/gh-api.js` (381),
`node/test/bootstrap.mjs` (374), `lib/kits/traffic.js` (253).

**Known gap: child processes.** Reads by a test's spawned Python or Node
children are not traced; only the spawned script's path is (88 files spawn).
Propagate the hook to Node children through `NODE_OPTIONS`, and to Python
children through a `sitecustomize` that registers `sys.addaudithook` on the
`open` event. Until then a CSV a Python script reads will not select the test
that spawns it.

**Start-up is a large share, as the earlier lead suggested.** Counted by
process wall time, start-up included, the twelve heavy files hold 34% of the
suite's time (not the 58% that summed top-level durations showed) and the 350
cheapest hold 31% (not 10%). The median file took 0.86 s. A test that only
imports `bootstrap.mjs` took 0.66 to 0.81 s across three runs, against 0.20 s
for an empty test file. `bootstrap.mjs` imports jsdom at module top; 364 files
import bootstrap and 182 of them use `makeWindow` or `startAlpine`. Importing
jsdom lazily, inside `makeWindow`, might save about 0.5 s on each of the other
~180 files, roughly 90 of the run's 996 traced CPU-seconds. That estimate is
unmeasured. Node 22's `--test-concurrency` defaults, per its documentation, to
`os.availableParallelism() - 1`, so a 4-core runner may use 3 workers; worth
checking against a CI run before relying on it.

**Selection would have been small on most merges.** Replaying the last 40
first-parent merges on main against today's trace, selecting (a) every test
whose trace read a changed path, (b) every changed test file, and (c) all 34
gates when the diff added, deleted or renamed a file: the median merge selected
45 files and 188 of 996 CPU-seconds, about a fifth; the range was 23 s to
465 s. A change to `gh-api.js` or `bootstrap.mjs` selects nearly every file, as
it should. Caveat: older merges were scored against today's reach, not their
own.

**One failing test in that run.** `map-view.test.mjs`, "a schedule edit
rewrites one registry row guarded by the sha it read": expected
`['weekly', 1, 14, 'dry']`, got `['weekly', 1, 6, 'dry']`. It looks
date-dependent; not investigated.

## Design

1. **Trigger catalog, derived.** A test runs when a path its trace read
   changes, when the test file itself changes, or always if it is a gate
   (`kind: gate` in `docs/tests-authored.csv`, 34 files, about 3% of suite
   cost; they hold the cross-file checks: derived artifacts, registries,
   routes, manifests). No new authored column for now; add one to
   `tests-authored.csv` only if the trace is found to miss a dependency in
   practice.
2. **Reach registry.** `docs/tests-reach.csv`, keyed by test path, identity
   `path`, `inherits: tests`, computed: per-file `ms` (process wall, start-up
   included) and `reaches` (paths read). It is a separate file because
   `docs/registries.md` keeps recorded and computed values apart and because
   `tests-index` writes `docs/tests.csv` whole from static analysis. Written by
   the test run on push to main and committed by a job that follows the
   `refresh-derived.yml` pattern (GITHUB_TOKEN push, which starts no workflow).
   Its gate checks shape and that every test file has a row, not equality with
   a fresh run. Add the rows to `docs/registries.csv` and `docs/properties.csv`
   per `docs/registries.md`.
3. **Run log, a stream.** One record per CI run on main (sha, date, venue,
   per-file ms, total wall), appended to
   `mehrlander/web-tools-private:data/tests/runs/YYYY-MM.jsonl` with the
   existing `REGISTRY_WRITE_TOKEN` (as `activity-cache.yml` uses it). Kept out
   of web-tools to avoid a 433-entry record per merge in its history. Session
   runs write the same record to a gitignored local cache only.
4. **`npm run test:diff`.** Changed files against the merge base with
   `origin/main`, plus staged, unstaged and untracked files; selects by the
   reach registry, changed tests and gates; prints each pick with its reason
   and expected seconds, then runs them. Flags: `--list` (print only),
   `--base <ref>`, `--all`. Then, for the owner's approval as wording: a line
   in `CLAUDE.md` (Environment & testing) and in
   `docs/environment/testing.md` saying to run `test:diff` during work and to
   rely on the CI check for the full suite; the same line for builder briefs.
   No new hook at first; let measure M3 show whether full in-session runs
   persist.
5. **Testing program.** First measures for `programs/testing/README.md`:
   M1, suite cost on main over time (wall and summed per-file), from the run
   log; M2, the share of the suite each merge would select, computed from git
   and the reach registry with no extra logging; M3, full runs inside sessions
   and their minutes, from the session archive (check first that it records
   command durations). The selector, the reach registry and the workflow
   change become governed files.
6. **Tests tab.** Per check: "runs when" (triggering paths, or "always" for a
   gate), "cost" (seconds on main, from the reach registry), "last slow" (from
   the run log, behind sign-in). Plus a reverse filter: pick a path, see the
   checks it triggers.
7. **Lazy jsdom import** in `bootstrap.mjs`, as its own measured change after
   M1 has a baseline.

## Related

- `node/test/runtime-command.cjs`: the `--require` hook every test process loads; the trace hook sits beside it
- `node/test/bootstrap.mjs`: eager jsdom import, the start-up lead
- `docs/tests-authored.csv`: `kind: gate` rows are the always-run set
- `node/build/tests-index.mjs`: writes `docs/tests.csv` whole; the reach registry stays separate from it
- `docs/registries.md`: rules for adding the reach registry
- `.github/workflows/test.yml`: the full-suite run on every push and PR; the reach and timing writer attaches to its main-push run
- `.github/workflows/refresh-derived.yml`: precedent for a main-push job committing derived files
- `.github/workflows/activity-cache.yml`: precedent for writing to web-tools-private with `REGISTRY_WRITE_TOKEN`
- `programs/testing/README.md`: charter with "Measures: None yet"
- `lib/alpineComponents/map.js`: Tests tab (`TESTS_MANIFEST`, `loadTestsReg`, `loadTestExecution`)

## Done when

`npm run test:diff --list` on a branch prints a selection with reasons and
costs; `docs/tests-reach.csv` is registered and refreshed by the main-push run;
the run log receives a record per main run; the testing charter lists M1 to
M3; the Tests tab shows runs-when, cost and last-slow; and the CLAUDE.md
wording has the owner's approval.

## Progress log
- 2026-11-13: Assessed and prototyped in a chat session (trace hook, one traced full run, replay of 40 merges); findings above. Owner asked to build it in a Claude Code session. Next: claim, then build in the order of the Design list.
