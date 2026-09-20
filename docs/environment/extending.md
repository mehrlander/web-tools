# Claude Code extension model

Claude Code supports [skills](https://code.claude.com/docs/en/skills), [subagents](https://code.claude.com/docs/en/sub-agents), [MCP servers](https://code.claude.com/docs/en/mcp), [hooks](https://code.claude.com/docs/en/hooks), [LSP servers](https://code.claude.com/docs/en/plugins-reference#lsp-servers), and [plugins](https://code.claude.com/docs/en/plugins).

This repository uses local Git hooks, two Claude startup delegates, and one
plugin hook:

* Two Claude Code `SessionStart` scripts that delegate checkout configuration
  and remote dependency installation to the shared setup entry point.
* Commit-time `pre-commit` and `pre-merge-commit` hooks that stage deterministic
  derived artifacts when their sources change. A merge whose combined refresh
  changes the index pauses for `git -c core.editor=true merge --continue`, so
  the final tree is written through the ordinary commit path. See the
  [`tools/README.md`](../../tools/README.md#the-refresh-model) refresh model.
* A `Stop` hook carried by the `portable` plugin, which records the session where a checkout declares a store. It runs in every session that installs the plugin, not only in sessions on this repo, which is the point of putting it there. See [Stop: the session recorder](#stop-the-session-recorder) below.

**Do not assume the `PreToolUse` hook ran** *(observed 2026-07-25, cause found 2026-07-27)*. `git commit` calls completed with `dist/web-tools.js` left stale, while `.claude/hooks/build-on-commit.sh` exited 0 and behaved correctly when piped its JSON payload by hand. The script was sound and the harness did not invoke it.

The cause is **where the session's project root sits**, which is not something this repository controls. A session can open with the repo one level *below* the root: primary working directory `/home/user`, repo at `/home/user/web-tools`, arriving as an additional directory. Claude Code then reads project settings from `/home/user/.claude/settings.json`, which does not exist, so this repo's `.claude/settings.json` is never loaded and none of its hooks are registered. Confirmed three ways: the session transcript is written to `~/.claude/projects/-home-user/`, naming the root; `/home/user/.claude/` is absent; and a probe at line 1 of the hook script never wrote its log, for a `$CLAUDE_PROJECT_DIR`-relative command and an absolute one alike. Repo-side settings edits cannot reach it, because the file holding them is the file that is not read. The tell is cheap: `ls ~/.claude/projects/` names the root the session is using.

Two consequences worth carrying. Any repo whose hooks matter has to treat them as best-effort, not as a guarantee. And a silent guarantee needs a backstop that does not depend on the harness: `tools/test/derived-artifacts.test.mjs` re-runs the generators in `--check` mode inside `npm test`, so a stale artifact fails the suite wherever it is run. Regenerating by hand (`npm run build:lib`, `npm run pages-index`) after touching a source is still the fast path; the test is what makes forgetting loud.

**Resolved 2026-08-06 by leaving the harness, and made explicit 2026-09-18.** The two paragraphs above stand as the diagnosis, and the fix follows from them: a hook that must not depend on the project root should not be a Claude Code hook. Git resolves its hooks from the repository being committed to and has no notion of a session root, so the refresher moved to `.githooks/pre-commit` and the `PreToolUse` block came out of `.claude/settings.json`. The stdin JSON parse and the `git commit` gate came off with it, both being scaffolding for the event it no longer listens to.

Git still does not discover a committed hooks folder or a custom merge driver
on clone. `npm run setup` is now the owner of those checkout settings and the
development dependencies. It stores a relative `.githooks` path, uses
worktree-specific config only when the repository already enabled that Git
extension, and otherwise uses the shared local config that linked worktrees
support. `npm run ready` asks Git for the effective hook path and driver config,
then checks runtimes and npm's dependency metadata without writing. Neither
command assumes `.git` is a directory. Claude's `session-githooks.sh` and
`session-start.sh` delegate the git-only and dependency-only halves so their
parallel dispatch cannot race two full setup runs.

The remaining boundary is worth naming: a clone whose setup was skipped runs no
committed hooks, `git commit --no-verify` is the deliberate local bypass, and a
GitHub API, MCP, or server-side merge has no local checkout in which a hook can
run. The derived-artifacts gate therefore keeps its independent job. The
generalization also does not follow: a `PreToolUse` hook that is not about
committing has no Git event to move to and would need a dispatcher of its own,
with sequential execution, a small budget, and an any-deny-wins rule.

## Components

### Skills

A [skill](https://code.claude.com/docs/en/skills) is a directory containing a `SKILL.md` file and optional supporting files. Its description is included in the available-skills listing. Its full contents are loaded when invoked.

Skills may be invoked automatically or explicitly as `/name`. Files under `.claude/commands/` remain supported and are handled as skills, but new extensions should use `.claude/skills/`.

[`CLAUDE.md`](https://code.claude.com/docs/en/memory) contains persistent project instructions loaded at session start.

### Subagents

A [subagent](https://code.claude.com/docs/en/sub-agents) is a separate Claude instance with its own context window, system prompt, tools, and permissions. It receives a bounded task and returns its result to the main session.

### MCP servers

[MCP servers](https://code.claude.com/docs/en/mcp) provide access to external tools and data sources such as APIs, databases, calendars, and issue trackers.

MCP tool definitions consume context. Claude Code can defer loading them through MCP tool search.

### Hooks

[Hooks](https://code.claude.com/docs/en/hooks) run configured actions at Claude Code lifecycle events.

[`SessionStart`](https://code.claude.com/docs/en/hooks#sessionstart) fires at startup, resume, clear, and compaction. Other events cover tool use, file changes, subagents, notifications, and session termination.

#### SessionStart checkout delegates

`.claude/hooks/session-start.sh` runs at session start. Nothing registers it: the `portable` plugin's dispatcher discovers it by its `session-*.sh` filename, from whatever project root the session has. This repo's `.claude/settings.json` declared it as a `SessionStart` hook until 2026-07-31 and no longer does, because the two together ran it twice whenever web-tools was the root. `session-githooks.sh` rides the same discovery, and since 2026-08-06 they are the only two, so `settings.json` declares no hooks at all.

**A gated note is what that discovery is most useful for, and it is how you leave a check for a future session rather than holding it in mind.** The script runs every session and prints only while its condition is unmet, so a satisfied check is invisible and an unmet one reaches whichever session comes next. home carries three of them (the submittal deadline note, the news fetch, the memory manifest) and the plugin's own `invoke-default` is the same shape. A one-shot check clears itself by also speaking on success: it reports that it is finished and names itself for deletion, which is a one-line commit for the session that sees it. [`session-check-manifest.sh`](../../.claude/hooks/session-check-manifest.sh) is the worked example, and it stays silent on a snapshot older than the thing it verifies so it never nags about a condition that cannot yet be true. *(2026-09-14)*

`session-start.sh`:

1. Exits unless `CLAUDE_CODE_REMOTE=true`.
2. Calls `tools/checkout-setup.mjs --dependencies-only`.
3. Stays silent on success and prints the shared command's concrete failure plus
   `npm run setup` / `npm run ready` recovery on failure.

`session-githooks.sh` calls the same entry point with `--git-only` in every
Claude session. That half is cheap and has no remote-only gate. Both wrappers
always exit zero so a setup problem does not prevent the session from opening,
but neither swallows a failed configuration write and calls it success.

[`CLAUDE_CODE_REMOTE`](https://code.claude.com/docs/en/env-vars) is set to `true` in Claude Code cloud sessions. The check prevents the hook from installing dependencies in local sessions.

The shared dependency check runs `npm ls --depth=0 --include=dev --json`, so an
empty, obsolete, or invalid package directory does not satisfy it. Setup runs
`npm install --include=dev` only when that metadata is not usable, with
`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`. Browser installation belongs to the
pixel-render path, not the browser-free build and test path. A local ignored
`python3` command shim is created when a host supplies Python 3 only as
`python`, preserving the command spelling used by the hooks and npm scripts.

The packages are repository `devDependencies`. They are declared in
`package.json` and installed by the shared entry point. They are not supplied
as part of the Claude Code environment.

`jsdom`, `alpinejs`, `fake-indexeddb`, and `idb-keyval` support browser-logic tests under Node. `playwright` drives the Chromium installation supplied by the web environment. It is pinned to `1.56.0` to match that browser build. See [capabilities.md](capabilities.md).

The remaining packages are local copies of libraries used by the pages at runtime: `@tailwindcss/browser`, `@tailwindcss/typography`, `daisyui`, `@phosphor-icons/web`, `@alpinejs/collapse`, and `@alpinejs/sort`. The render tools use these copies in place of CDN requests.

The dependencies support:

* `npm run preview <page-path>` through `tools/render/preview.mjs`.
* `npm run shot`, `build`, `bake`, and `verify-build`.
* jsdom and Alpine logic tests.

The preview harness runs the page under jsdom, executes the `gh.load` chain, mounts Alpine, and reports mounted components. Because jsdom does not run module scripts or dynamic imports, the harness rewrites the boot block as an async IIFE and shims the `gh-api.js` import. Failure to mount `kits/cm6.js` is reported but nonfatal. Pixel verification uses `npm run shot`.

The render tools serve the working tree over loopback and replace CDN requests with files from `node_modules`.

The dependency delegate runs synchronously. `npm install` requires
package-registry access. Claude Code's default
[Trusted network configuration](https://code.claude.com/docs/en/claude-code-on-the-web#network-access-and-security)
permits access to npm and other common package registries.

A fresh web session normally runs the check and installation. A resumed session
may reuse the existing `node_modules` directory only when npm reports it usable.

A cloud [setup script](https://code.claude.com/docs/en/claude-code-on-the-web#environment-caching) is the cached alternative. Claude Code runs the setup script when building an environment snapshot and reuses the resulting filesystem in later sessions. Repository hooks remain in source control and run at their configured lifecycle events.

The hook applies only to sessions using a branch that contains its configuration.

#### SessionStart: the invoke-default directive

*Added 2026-09-10.* [`.claude/skills/hooks/invoke-default.sh`](../../.claude/skills/hooks/invoke-default.sh), a second `SessionStart` entry in the plugin's [`hooks.json`](../../.claude/skills/hooks/hooks.json). It prints one instruction, and only when the surfacing conventions did not arrive on their own: no checkout the session read carries a resolved `@`-import of them.

**It asks whether they ARRIVED, not whether a repo intends them**, and the two answers differ. home's `CLAUDE.md` names `/web-tools` in prose and imports nothing, so a session on home alone starts without the primitives while looking configured. `lib/kits/portable-align.js`'s `conventionsWired()` answers the intent question for the app's adoption column and is deliberately not reused here; they are different claims, so no `owners.csv` repetition is owed.

**Why a hook rather than a skill that fires on its own.** A skill enters context only when the user types `/name` or the model elects it from the description. No frontmatter field loads one at session start: `disable-model-invocation` and `user-invocable` govern who may invoke, never whether it fires unprompted (checked against the skills reference 2026-09-10). So the reliable form is an instruction delivered at the moment it applies.

**Why its own entry rather than a line inside the dispatcher.** The output cap applies per hook entry, not across the event: measured 2026-08-30, the dispatcher's 28,670 characters were cut while a separate 298-character `SessionStart` hook in the same session arrived whole. Folded in, the directive would be the first thing truncated on a heavy session, which is the failure that retired the injection channel. The directive also leads the message, so it survives a truncated preview.

A repo opts out with `"conventions": "optout"` in its `.web-tools.json`, the field declared in [`docs/manifest-fields.csv`](../manifest-fields.csv) since PR #222. A checkout with no `CLAUDE.md` is never named: the import is the delivery channel, so a directory without one has no channel to be missing. Coverage is [`tools/test/invoke-default.test.mjs`](../../tools/test/invoke-default.test.mjs), which asserts both directions, since a directive that never fires and one that always fires look equally like success from outside.

#### Stop: the session recorder

*Added 2026-07-30.* The `portable` plugin carries a [`Stop`](https://code.claude.com/docs/en/hooks) hook in [`.claude/skills/hooks/hooks.json`](../../.claude/skills/hooks/hooks.json), running [`.claude/skills/hooks/session-record.sh`](../../.claude/skills/hooks/session-record.sh). It is found by **default discovery**: `hooks/hooks.json` in the plugin root, and the plugin root is the entry's `source`, so the file already sits where the loader looks.

**The marketplace entry declares nothing, and must not.** A `hooks` key on the entry refuses the whole plugin: the file-path and array forms are not supported there, only an inline object. The suite pins the key's **absence**, because adding it reads as diligence.

**The distribution channel is the whole point, and the alternative was measured failing.** `mehrlander/web-tools-private` holds a session recorder that writes one JSON record per session. Its own installer writes `~/.claude/settings.json`, correctly avoiding a repo hook for the project-root reason above. But that file is provisioned fresh for every container, carrying the account's marketplace and plugin configuration and nothing else, so a hand-installed hook survives exactly as long as the container. On 2026-07-30 the store held one record, dated 2026-07-29, the session that built the recorder. At least four other sessions ran that day and merged pull requests; none was recorded, and nothing reported the gap. The installed-by-hand hook records the session that installs it and no other.

A plugin install is the only channel that repeats, because the platform performs it at session start. That makes plugin-shipped hooks the right home for anything that must run in *every* session rather than in one repo's sessions.

**Finding the target without naming it.** The hook holds no repo name and no knowledge of the record format. A checkout whose `.web-tools.json` declares `"sessions": "<dir>"` owns the store, and `<store>/tools/on-stop.sh` does the recording and publishing, so the store can change its schema without a plugin release. Discovery is a bounded candidate list, since this runs on every turn: the project root, its children, and its siblings, which are the three shapes a session takes (root above the checkouts, root is the store, root is one checkout beside the store). `SESSIONS_STORE` names a store directly and skips the search.

**Cost, since it fires on every turn of every session.** No store checked out means one `grep` over whatever manifests exist, measured at 10 ms, then exit. With a store, the delegate parses the transcript, measured at roughly 100 ms on a 400 KB transcript and growing with session length. Every path exits 0: a logger that cannot find its store is an ordinary state, not an error to report into someone's session.

Two states are deliberately quiet rather than loud. A checkout can declare the store on a branch that predates the tooling, so a declaration whose `tools/on-stop.sh` is absent is declined rather than reported. And a malformed manifest is skipped, not raised.

Coverage is [`tools/test/session-record-hook.test.mjs`](../../tools/test/session-record-hook.test.mjs): the three discovery shapes, byte-identical payload hand-off, the quiet paths, the override, and the assertion that the hook sits at the default location with no redeclaration on the entry. A script present on disk but not wired to the loader is the failure this change exists to fix, so that last one is not ceremony.

**Three things measured while wiring it, all worth knowing before trusting a plugin hook.**

`claude plugin validate` does not read the hooks file. It passed `--strict` with `"hooks"` pointing at a nonexistent path, and passed again with valid JSON of the wrong shape (`"Stop": "not-an-array"`) at the real path. So a passing validation says nothing about whether the hook will load, and the structural check has to live in the repo's own suite. It also passed cleanly on the entry that the loader refused outright, which is how the broken wiring shipped.

**`claude plugin details` does not report the truth either, and this section used to say it did.** It reads the declared inventory, not the loader's verdict, so on 2026-07-30 it reported `Skills (10)` and `Hooks (1) Stop` for a plugin that `claude plugin list` was simultaneously refusing to load. Both commands were run against the same install, seconds apart. The earlier verification here (a local-path install into a scratch `HOME`, reporting `Hooks (1)` alongside `Skills (9)`) was real but was reading intent, and a local-path install is a different channel from the delivered github-marketplace one. **`claude plugin list` is the command that shows a load failure**, and it is the one to run.

The skill count remains the useful second half of a `details` check, confirming a `hooks/` directory inside the plugin's skills-directory source is not picked up as an extra skill.

**Status is per-directory, so run the check where the plugin is meant to be enabled.** The same `claude plugin list` reported `× failed to load` from `/home/user` and `/home/user/home` and `× disabled` from `/home/user/web-tools`, because this repo does not enable a plugin it *is* the source of. A status read in the wrong directory answers a different question than the one asked.

**The delivered copy is not executable.** A plugin is installed by copy into `~/.claude/plugins/cache/<marketplace>/<plugin>/<sha>/`, and the cached files arrive `rw-r--r--`. A hook command written as a bare path would therefore fail on the permission bit, so the declaration invokes the interpreter explicitly (`bash "${CLAUDE_PLUGIN_ROOT}/..."`). Verified by running the cached copy through the declared command line, which recorded a real session.

### LSP servers

[LSP servers](https://code.claude.com/docs/en/plugins-reference#lsp-servers) provide language-aware diagnostics, symbol lookup, references, and code navigation. Claude Code configures them through language-specific plugins. The corresponding language-server executable must be installed in the environment.

### Plugins

A [plugin](https://code.claude.com/docs/en/plugins) is a self-contained package of extension components. It may contain skills, subagents, hooks, MCP servers, LSP servers, monitors, executables, and default settings.

Plugins provide distribution, versioning, installation, and updates. Plugin skills use `/plugin-name:skill-name`.

Plugin skills are namespaced and do not conflict with project or user skills. Ordinary skill precedence is managed, user, then project. Subagent precedence is managed, command-line definition, project, user, then plugin. See [feature layering](https://code.claude.com/docs/en/features-overview#understand-how-features-layer).

## Settings

[`settings.json`](https://code.claude.com/docs/en/settings) configures permissions, environment variables, hooks, model selection, plugins, and MCP servers.

| Scope | Location | Applies to |
| --- | --- | --- |
| Managed | OS policy path (`/etc/claude-code/` on Linux) | Organization or machine |
| User | `~/.claude/settings.json` | User across all projects |
| Project | `.claude/settings.json` | Everyone in the repository |
| Local | `.claude/settings.local.json` | User in this repository |

**Precedence, highest → lowest:** managed → command line → local → project → user.

`permissions` and `hooks` merge across scopes instead of overriding. Precedence otherwise varies by feature: settings prefer project over user; skills prefer user over project.

This setup uses:

- [`.claude/settings.json`](../../.claude/settings.json): denies `AskUserQuestion`, and registers no hooks. Both of this repo's are `session-*.sh` files the dispatcher finds by name, which is what makes them fire from any project root. *(as of 2026-08-06)*

  **A multi-repo session does not read that file at all.** Project scope resolves against the session's project root, and a session carrying home, web-tools and web-tools-private roots at `/home/user`, above all three, where no `.claude/` exists. The proof is one line of the same file: web-tools' project settings set `portable@web-tools` to `false`, project outranks user, and the plugin loads regardless. So in that session shape the user-scope deny is the one in force and the project row is dormant, which is the same cause that put this repo's hooks in `session-*.sh` rather than in settings. *(measured 2026-09-14)*
- `~/.claude/settings.json`: registers the `web-tools` marketplace and enables `portable@web-tools`. *(verified 2026-07-20)*

The Local scope (`.claude/settings.local.json`) is per-user and meant to stay uncommitted, so the repository carries only the project file above.

## Context cost

Skill and agent descriptions consume context even when their full contents are not invoked. Full skill contents enter the conversation when the skill runs and remain there for the session.

The [`claude plugin inspect`](https://code.claude.com/docs/en/plugins-reference#plugin-inspect) command reports the plugin inventory and two cost estimates:

* **Always-on:** listing text included in every session, including skill descriptions, agent descriptions, and command names.
* **On-invoke:** context added when a component runs.

| Component  | Function                                             |
| ---------- | ---------------------------------------------------- |
| Skill      | Instructions and reference material loaded on demand |
| Subagent   | Separate bounded Claude instance                     |
| MCP server | External tools and data                              |
| Hook       | Lifecycle-triggered action                           |
| LSP server | Language diagnostics and navigation                  |
| Plugin     | Installable component package                        |

## The session dispatcher (as of 2026-09-09, moved from the retired PORTABLE.md)

The harness has no glob for session-start scripts. `npm test` finds its whole
suite from `tools/test/**/*.test.mjs`, and git finds its hooks from a folder
once `core.hooksPath` is set, but a Claude Code hook has to be named
individually in `.claude/settings.json`, and that file is read **only when the
session's project root is that repo**. A session spanning several checkouts has
its root above all of them, so none of their session hooks fire, and nothing
reports it. Measured 2026-07-31: a session rooted at `/home/user` ran none of
the four `SessionStart` hooks a checkout below it had registered.

The dispatcher supplies the missing glob at the one layer that can. The plugin
registers it once, at user scope, for every session; discovery is then by
filename, the same contract the test suite already uses:

```
.claude/hooks/session-*.sh   ->  runs at session start
anything else in that folder ->  ignored
```

So a repo adopts it by **naming a file**, with nothing declared anywhere, and
opts a script out the same way, by calling it something else. web-tools' own
`session-start.sh` and `session-githooks.sh` are picked up, while their shared
`tools/checkout-setup.mjs` implementation is called only by those wrappers,
exactly as `tools/test/bootstrap.mjs` stays out of `node --test`. The name is
the whole declaration, which is why the executable bit is not also required: a
lost mode bit should not quietly turn a script off.

Each script runs with its own checkout as both cwd and `CLAUDE_PROJECT_DIR`, so
a script already written for `.claude/settings.json` moves under the dispatcher
unchanged. Scripts run in parallel under a per-script timeout, so the wall clock
is the slowest one rather than the sum, and a script that hangs is stopped and
named instead of holding the session open. The budget defaults to 120s
(`WEB_TOOLS_SESSION_BUDGET` overrides it), matching the longest internal timeout
the existing scripts already set for themselves, so adopting the dispatcher does
not change what any repo was already willing to wait for.

**Adopting it is a migration, not an addition.** The dispatcher replaces the
declaration mechanism rather than sitting beside it, so a repo renames its
scripts to `session-*.sh` **and drops the `SessionStart` block from its own
`.claude/settings.json`**. Keeping both means each script runs twice whenever
that repo is the project root; keep the `settings.json` entry only where a repo
disables the plugin and so has no dispatcher at all. Parallel execution is the
other thing a migration has to look at: entries that were an ordered list in
`settings.json` no longer have an order, so a script depending on an earlier one
has to do that work itself. home's `session-news-fetch.sh` sets `core.hooksPath`
rather than assuming `session-git-config.sh` won the race.

An inline command has no filename, so it cannot be discovered and needs a file
of its own. That is not a technicality: home's `SessionStart` carried a bare
`git config core.hooksPath .githooks`, and it was the entry whose silent absence
actually cost something, leaving the repo's pre-commit lint and size guard off
for any session rooted above it.

Both mistakes are reported rather than left silent. When a checkout's
`.claude/settings.json` still declares `SessionStart`, the dispatcher says so at
session start, naming which case it is: no `session-*.sh` to discover (so
nothing of that repo's ran) or scripts present alongside the declaration (so they
double-run at that root). The check keys on the repo's own `SessionStart`
declaration, not on an empty hooks folder, because a repo whose only hook is
`PreToolUse` is correct rather than misconfigured.

The dispatcher bounds what a script costs; it does not police it, any more than
`node --test` polices a slow test. **Keeping session start cheap is the script's
job**, and the convention is: gate on file reads, and do expensive work only
when the gate says it is due. A repo whose script genuinely needs minutes should
background it rather than hold the session open.

Every dispatched script gets **`$WEB_TOOLS_HOOKS`**, the directory the plugin's
own hooks live in, so a repo can call something the plugin ships without knowing
where the cache put it or which commit it is pinned at. There is one such script
today, and it is the reason the variable exists.
