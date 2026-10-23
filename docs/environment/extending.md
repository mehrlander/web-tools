# Claude Code extension model

Claude Code supports [skills](https://code.claude.com/docs/en/skills), [subagents](https://code.claude.com/docs/en/sub-agents), [MCP servers](https://code.claude.com/docs/en/mcp), [hooks](https://code.claude.com/docs/en/hooks), [LSP servers](https://code.claude.com/docs/en/plugins-reference#lsp-servers), and [plugins](https://code.claude.com/docs/en/plugins). This file covers the hooks this repository and its `portable` plugin run, the settings they depend on, and what the plugin costs in context.

## Hooks

Hooks come from three places: git hooks in `.githooks/`, which `npm run setup` activates; this repo's `.claude/hooks/session-*.sh` scripts, which the plugin's [dispatcher](#the-session-dispatcher) runs; and the plugin's own hooks, registered in [`skills/hooks/hooks.json`](../../skills/hooks/hooks.json). Each script's header comment is its full account.

| Hook | Event | File | Purpose | Test |
|---|---|---|---|---|
| pre-commit | git `pre-commit` | [`.githooks/pre-commit`](../../.githooks/pre-commit) | regenerates and stages the deterministic derived artifacts the staged changes touch; legs and order in the [refresh model](../../node/README.md#the-refresh-model) | `derived-artifacts.test.mjs` |
| pre-merge-commit | git `pre-merge-commit` | [`.githooks/pre-merge-commit`](../../.githooks/pre-merge-commit) | runs the same refresher on an automatic merge; when it changes the index, the merge pauses for `git -c core.editor=true merge --continue` | |
| commit-msg | git `commit-msg` | [`.githooks/commit-msg`](../../.githooks/commit-msg) | the consent gate and the machine-path gate (engines in `skills/hooks/commit-consent.py` and `machine-paths.py`) | |
| session-start | `SessionStart`, dispatched | [`.claude/hooks/session-start.sh`](../../.claude/hooks/session-start.sh) | remote sessions only: the dependency half of `node/checkout-setup.mjs` | |
| session-githooks | `SessionStart`, dispatched | [`.claude/hooks/session-githooks.sh`](../../.claude/hooks/session-githooks.sh) | every session: the git half (hooks path, CSV merge driver) | |
| refresh-plugin | `SessionStart` | [`refresh-plugin.sh`](../../skills/hooks/refresh-plugin.sh) | moves `portable` to the tip of web-tools `main`; log at `/tmp/refresh-plugin.log` | `plugin-setup-hooks.test.mjs` |
| session-dispatch | `SessionStart` | [`session-dispatch.sh`](../../skills/hooks/session-dispatch.sh) | runs every checkout's `.claude/hooks/session-*.sh` | `session-dispatch.test.mjs` |
| invoke-default | `SessionStart`, also on compact | [`invoke-default.sh`](../../skills/hooks/invoke-default.sh) | tells the session to invoke `/portable:default` when no checkout carries a resolved `@`-import of the conventions; a repo opts out with `"conventions": "optout"` in `.web-tools.json` | `invoke-default.test.mjs` |
| invoke-sessions | `SessionStart` | [`invoke-sessions.sh`](../../skills/hooks/invoke-sessions.sh) | tells the session to invoke `/portable:sessions` when no session store is checked out | `invoke-sessions.test.mjs` |
| environment-report | `SessionStart` | [`environment-report.sh`](../../skills/hooks/environment-report.sh) | says which setup script built the environment and whether it changed on `main` | `environment-report.test.mjs` |
| account-skills | `SessionStart` | [`account-skills.py`](../../skills/hooks/account-skills.py) `--hook` | the account's skills against what they should be; silent unless something needs attention | |
| reading-column-guard | `PreToolUse` on Edit, Write | [`reading-column-guard.sh`](../../skills/hooks/reading-column-guard.sh) | refuses a class that narrows text to a reading column | |
| send-later-guard | `PreToolUse` on `send_later` | [`send-later-guard.sh`](../../skills/hooks/send-later-guard.sh) | refuses a scheduled self check-in | `send-later-guard.test.mjs` |
| ask-question-guard | `PreToolUse` on `AskUserQuestion` | [`ask-question-guard.sh`](../../skills/hooks/ask-question-guard.sh) | denies the tool and says to ask in prose; an `AskUserQuestion` prompt appearing means the guard is not firing | `plugin-setup-hooks.test.mjs` |
| pr-subscribe-hint | `PostToolUse` on `create_pull_request` | [`pr-subscribe-hint.sh`](../../skills/hooks/pr-subscribe-hint.sh) | prompts a subscription to the PR just opened | |
| wake-quiet-hint | `PostToolUse` on `ReadNotifications` | [`wake-quiet-hint.sh`](../../skills/hooks/wake-quiet-hint.sh) | says whether the PR events just read call for a reply | `wake-quiet-hint.test.mjs` |
| warn-governing-docs | `PostToolUse` on Edit, Write | [`warn-governing-docs.sh`](../../skills/hooks/warn-governing-docs.sh) | warns after an edit to documentation | `warn-governing-docs.test.mjs` |
| mcp-fail-hint | `PostToolUseFailure` on MCP tools | [`mcp-fail-hint.sh`](../../skills/hooks/mcp-fail-hint.sh) | turns the `-32003` approval error into its diagnosis | |
| session-record | `Stop` | [`session-record.sh`](../../skills/hooks/session-record.sh) | records the session into the checkout that declares a session store | `session-record-hook.test.mjs` |
| reply-check | `Stop` | [`reply-check.py`](../../skills/hooks/reply-check.py) | sends a reply back once when the turn changed a page and gave no render link | `reply-check.test.mjs` |

Tests are under `node/test/`. `hook-events.test.mjs` holds every registration to an event in [`docs/hook-events.csv`](../hook-events.csv).

### SessionStart checkout delegates

Git does not discover a committed hooks folder or a custom merge driver on
clone. `npm run setup` is now the owner of those checkout settings and the
development dependencies; `npm run ready` checks them without writing.
`session-githooks.sh` calls [`node/checkout-setup.mjs`](../../node/checkout-setup.mjs)
with `--git-only` in every Claude session; `session-start.sh` exits unless
[`CLAUDE_CODE_REMOTE`](https://code.claude.com/docs/en/env-vars) is `true`
(set in cloud sessions, so local sessions install nothing) and calls it with
`--dependencies-only`. The two halves are separate so the dispatcher's parallel
runs cannot race two full setups. Both wrappers stay silent on success, print
the failure plus `npm run setup` / `npm run ready` recovery on failure, and
always exit zero, so a setup problem never stops a session from opening.

The packages are repository `devDependencies` in `package.json`, not supplied
by the environment. `jsdom`, `alpinejs`, `fake-indexeddb` and `idb-keyval`
support browser-logic tests under Node; `playwright` is pinned to `1.56.0` to
match the Chromium build the web environment supplies
([capabilities.md](capabilities.md)); most of the rest are local copies of the
libraries pages load at runtime, which the render tools serve in place of CDN
requests ([testing.md](testing.md)). Installation needs package-registry
access, which Claude Code's default
[Trusted network configuration](https://code.claude.com/docs/en/claude-code-on-the-web#network-access-and-security)
permits. A resumed session reuses `node_modules` only when npm reports it
usable. A cloud [setup script](https://code.claude.com/docs/en/claude-code-on-the-web#environment-caching)
is the cached alternative ([container.md](container.md)). The delegates apply
only to sessions on a branch that contains them.

What no hook covers: a clone whose setup was skipped runs no committed hooks,
`git commit --no-verify` is the deliberate local bypass, and a GitHub API, MCP,
or server-side merge has no local checkout in which a hook can run. So
`node/test/derived-artifacts.test.mjs` re-runs the generators in `--check` mode
inside `npm test`, and a stale artifact fails the suite wherever it runs.

**A gated note** is a `session-*.sh` script that runs every session and prints
only while its condition is unmet, which is how to leave a check for a future
session rather than hold it in mind. A one-shot check also speaks once on
success, reporting that it is finished and naming itself for deletion.

### Stop: the session recorder

`session-record.sh` is found by **default discovery**: `hooks/hooks.json` in the
plugin root, and the plugin root is the marketplace entry's `source`. **The
marketplace entry declares nothing, and must not.** A `hooks` key on the entry
refuses the whole plugin (only an inline object is supported there), and the
suite pins the key's absence.

A plugin install is the only channel that repeats in every container, because
the platform performs it at session start; a hook written by hand into
`~/.claude/settings.json` lasts only as long as its container. So a hook that
must run in *every* session, rather than in one repo's, belongs in the plugin.

Stop fires when the session idles, not once per assistant message, and a turn
the harness auto-continues produces no Stop. A record is therefore at risk
until the next idle, and a long autonomous run can end its container before it
idles once. A session with something worth keeping should end a turn
deliberately.

### SessionStart: the sessions-store directive

The store name defaults to `mehrlander/web-tools-private` for every consumer of
the marketplace, so a session with no access to that repo is told to fetch a
store it cannot reach. The order of the overrides is in the header of
[`invoke-sessions.sh`](../../skills/hooks/invoke-sessions.sh).

### SessionStart: the environment report

`environment-report.sh` reads `~/.claude/environment-setup.ran`, which the
setup script writes ([container.md](container.md)), and prints a line such as
`Environment built 2026-10-03T02:23:58Z from .claude/environment-setup.sh at 701b3ef.`
When the saved script differs from the one on `main`, it says to edit the
environment settings to rebuild.

### Adding a plugin hook

- Give the hook its own entry in `hooks.json`. The harness caps output per
  hook entry, not across the event, so a line folded into another hook's
  output is the first thing truncated on a heavy session
  ([capabilities.md](capabilities.md#sessionstart-hooks-a-per-hook-size-ceiling-and-where-the-cut-lands)
  has the measurement).
- **The delivered copy is not executable.** The plugin is installed by copy
  into `~/.claude/plugins/cache/<marketplace>/<plugin>/<sha>/` with files
  `rw-r--r--`, so the declaration invokes the interpreter explicitly
  (`bash "${CLAUDE_PLUGIN_ROOT}/..."`).
- **`claude plugin list` is the command that shows a load failure.** `claude
  plugin validate` does not read the hooks file (it passes `--strict` with a
  missing or wrongly shaped one), and `claude plugin details` reports the
  declared inventory, not the loader's verdict. Its skill count still confirms
  that `hooks/` is not picked up as an extra skill.
- Status is per directory, so run the check where the plugin is meant to be
  enabled.
- `refresh-plugin.sh` moves the pin during the session: skills from the new pin
  appear at once, but hooks that already fired at session start ran from the
  old pin. It cannot recover a pin that fails to load;
  [container.md](container.md#what-the-accounts-setup-script-must-do) has the
  recovery.

### The session dispatcher

A Claude Code hook has to be named individually in `.claude/settings.json`,
and that file is read **only when the session's project root is that repo**.
A session spanning several checkouts has its root above all of them (primary
working directory `/home/user`, repos below it), so none of their declared
hooks fire, and nothing reports it; `ls ~/.claude/projects/` names the root a
session is using. This is why the commit refresher is a git hook and why the
plugin carries every hook that must run everywhere.

The dispatcher supplies the missing glob. The plugin registers it once, at user
scope, for every session; discovery is then by filename:

```
.claude/hooks/session-*.sh   ->  runs at session start
anything else in that folder ->  ignored
```

So a repo adopts it by **naming a file**, with nothing declared anywhere, and
opts a script out the same way, by calling it something else. The executable
bit is not required, so a lost mode bit does not quietly turn a script off. An
inline command has no filename, so it needs a file of its own.

Each script runs with its own checkout as both cwd and `CLAUDE_PROJECT_DIR`, so
a script written for `.claude/settings.json` moves under the dispatcher
unchanged. Scripts run in parallel under a per-script timeout of 120s
(`WEB_TOOLS_SESSION_BUDGET` overrides it), and a script that hangs is stopped
and named.

**Adopting it is a migration, not an addition.** A repo renames its scripts to
`session-*.sh` **and drops the `SessionStart` block from its own
`.claude/settings.json`**; keeping both runs each script twice whenever that
repo is the project root. Keep the `settings.json` entry only where a repo
disables the plugin. Entries that were an ordered list now run in parallel, so
a script that depends on another has to do that work itself. The dispatcher
reports both mistakes at session start: a `SessionStart` declaration with no
`session-*.sh` to discover, and scripts present alongside the declaration.

**Keeping session start cheap is the script's job**: gate on file reads, do
expensive work only when the gate says it is due, and background anything that
needs minutes. Every dispatched script gets **`$WEB_TOOLS_HOOKS`**, the
directory the plugin's own hooks live in; no dispatched script uses it today.

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

- [`.claude/settings.json`](../../.claude/settings.json): denies `AskUserQuestion` and registers no hooks. A session rooted above the checkouts does not read it (see [the dispatcher](#the-session-dispatcher)), so there the plugin's `ask-question-guard.sh` is the only guard.
- `~/.claude/settings.json`: registers the `web-tools` marketplace and enables `portable@web-tools`, and nothing else. *(verified 2026-10-06)*

The Local scope is per-user and stays uncommitted.

## Components

- **Skills**: a directory with a `SKILL.md`; its description is always listed and its full contents load when invoked, automatically or as `/name`. `.claude/commands/` still works, but new extensions go in `.claude/skills/`.
- **Subagents**: a separate Claude instance with its own context, tools and permissions, given a bounded task.
- **MCP servers**: external tools and data. Their tool definitions consume context; Claude Code can defer them through tool search.
- **LSP servers**: language diagnostics and navigation, configured through language plugins; the server executable must be installed.
- **Plugins**: a package of the components above. Plugin skills are invoked as `/plugin-name:skill-name` and never conflict with project or user skills. Subagent precedence is managed, command line, project, user, then plugin ([feature layering](https://code.claude.com/docs/en/features-overview#understand-how-features-layer)).

## Context cost

Skill and agent descriptions consume context even when their full contents are not invoked. Full skill contents enter the conversation when the skill runs and remain there for the session.

`claude plugin details <plugin>` reports the plugin inventory and two cost estimates: **always-on** (listing text in every session: skill and agent descriptions, command names) and **on-invoke** (context added when a component runs).

Measured 2026-09-27: `portable`, carrying every skill, costs about 10,400 always-on tokens, against about 3,700 for the two plugins it replaced.
