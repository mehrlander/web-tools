# Claude Code web environment and persistence

This page describes the Claude Code web environment and the state that persists across sessions. See [capabilities.md](capabilities.md) for installed tools and network access.

*Verified locally 2026-05-30; documentation checked 2026-07-20.*

## Environment

Claude Code web sessions run in an [isolated Anthropic-managed VM with a fresh repository clone](https://code.claude.com/docs/en/claude-code-on-the-web#the-cloud-environment).

- Working directory: `/home/user/web-tools`.
- Approximate limits: [4 vCPU, 16 GB RAM, and 30 GB disk](https://code.claude.com/docs/en/claude-code-on-the-web#resource-limits).
- Memory-intensive builds and tests may be terminated.
- The environment is [reclaimed after inactivity](https://code.claude.com/docs/en/claude-code-on-the-web#environment-expired).
- Reopening an expired session provisions a fresh environment and restores the conversation history.

## Persistent state

Project changes persist through GitHub. Files must be committed and pushed before the environment is reclaimed or before another session can use them.

Local machine state is separate. Files, configuration, dependencies, and unpushed commits on a laptop are not available to the web session. The laptop and web environment are independent Git checkouts.

Environment configuration has a separate persistence mechanism. A cloud [setup script](https://code.claude.com/docs/en/claude-code-on-the-web#setup-scripts) installs tools and dependencies before Claude Code starts. Anthropic [snapshots the resulting filesystem](https://code.claude.com/docs/en/claude-code-on-the-web#environment-caching) and uses that snapshot as the starting point for later sessions in the same environment.

The environment cache includes files, packages, tools, and Docker images installed by the setup script. It does not include running processes. The cache is rebuilt when the setup script or network configuration changes and after its approximate seven-day expiry.

Packages installed during a session do not transfer to other sessions unless their installation is added to the setup script. Repository `SessionStart` hooks run separately at their configured lifecycle events.

### What `~/.claude` carries

*(measured 2026-07-30; layout re-checked 2026-10-06)*

The home directory is two layers with different lifetimes, and the modification
times separate them cleanly. Written fresh at boot: `skills/` (the account's own
skills, under `skills/synced/<id>/`), `session-env/`, and the harness's three
hook scripts, which sit at the top of `~/.claude` with no `hooks/` folder:
`stop-hook-git-check.sh`, `stop-hook-reply-gate.py` and
`user-prompt-submit-reply-reminder.py`. Restored from the environment snapshot,
carrying the timestamp of the day that snapshot was built: `settings.json` and
`plugins/`, including `plugins/installed_plugins.json` and the plugin cache
below it. There is no `~/.claude/CLAUDE.md`.

`projects/` is not written fresh at boot: a session's own material, subagent
transcripts included, persists across a restart of its VM with mtimes intact.

So **account skills sync every container and account plugins do not.** A plugin is
pinned at the commit it held when the snapshot was built, and nothing surfaces
that from inside a session: the plugin is present, enabled, and stale, so a fix
merged since runs nowhere. The same lifetime governs a hook installed by hand
into `~/.claude/settings.json`: it covers exactly the session that wrote it,
because a session's filesystem changes never enter the snapshot.


### A session's own files outlive its VM

*(measured 2026-09-08)*

**A VM restart keeps the disk.** A session 50 hours old whose `/proc/uptime`
read 26 minutes still held its `~/.claude/projects/<id>/subagents/` files with
their original mtimes, and its `/tmp` scratchpad. The machine restarts; the
filesystem it restarts onto is the one the session had.

**A session idle for days keeps them too.** Sessions woken after about 35, 50
and 62 hours still had every per-agent transcript.

**The environment snapshot is a third thing entirely** and never carried session
material: it holds what the setup script installed (the section above).

**The reclaim boundary sits somewhere between three days and three weeks.** A
session woken after 25 days came back with a fresh VM and no `subagents/` at
all, the
[documented](https://code.claude.com/docs/en/claude-code-on-the-web#environment-expired)
reclaim. The operating rule does not change with the number: do not tell a
reader their fan-out is unrecoverable without asking the session, which costs
one wake and one `ls`.

**A woken session may return only part of its own transcript, and that is the
sharper hazard.** The 25-day probe came back with 13 of 76 prompts and a start
two days later than the session's own. So a resume restores *some*
conversation history, not necessarily all of it, and anything rebuilt from the
transcript inherits that exposure; the session store's guards are
`record_path()` and `merge_captured()` in `web-tools-private
sessions/tools/record.py`.

Two commands freshen a running container:

```bash
claude plugin marketplace update <marketplace>
claude plugin update <plugin>@<marketplace>
```

The CLI answers "Restart to apply changes," and the [plugin documentation](https://code.claude.com/docs/en/discover-plugins) offers `/reload-plugins` as the in-session equivalent; treat it as the fallback for an update that does not take.

**Putting that update in the setup script does not solve it.** The setup script
runs when the snapshot is built, not when a session starts, so its `claude
plugin update` pins the version current on build day and every later session
restores that result *(measured 2026-07-30)*.

What runs every session is a `SessionStart` hook. The setup script installs the
plugin once; the plugin's refresher, `skills/hooks/refresh-plugin.sh`, moves it
to the tip every session. Its hooks match `startup|resume`, not `startup` alone,
because reopening an expired session provisions a fresh environment and fires
`resume`.

**The documentation and the measurement disagree about what a mid-session update
reaches.** The hooks reference says plugins load once at startup and that
`SessionStart`'s `reloadSkills` does not reload plugin-provided skills; if that
held strictly, a refresher would take effect only at the next boot, which in a
one-session-per-container environment means never. Measured twice on
2026-07-30, CLI 2.1.220, it did not hold: after `claude plugin update` ran
mid-session, a skill only the newer version had appeared on the following turn,
and the newer version's `Stop` hook fired later, with no restart and no
`/reload-plugins`. Treat that as measured on one version, not as a guarantee:
to check, change something visible on the plugin's `main`, start a fresh
session, and see whether it is present or arrives one session late. A
refresher should say what it did, since `SessionStart` stdout reaches the
session's context.

Editing the setup script at all invalidates the snapshot, so the next session
rebuilds rather than waiting out the roughly seven-day expiry. That makes the
first fix free and is worth knowing whenever an environment looks stuck.

The pin reaches the repository checkout as well, by the same route. `node_modules/`
is gitignored, so it cannot arrive with the fresh clone; the setup script installs
it and the snapshot preserves it. A dependency added to `package.json` after the
snapshot was built is therefore missing in a session that has the commit adding
it, and `npm test` fails on `ERR_MODULE_NOT_FOUND` while CI, which installs
fresh, passes *(measured 2026-07-30)*. When a suite fails locally on a missing package, check the dates
before believing the failure.

### What the account's setup script must do

The environment settings in claude.ai hold two lines. The first fetches and runs
[`.claude/environment-setup.sh`](../../.claude/environment-setup.sh) from this
repo's `main`; the second checks that the plugin installed:

```
curl -fsSL --retry 5 --retry-all-errors -o /tmp/s https://raw.githubusercontent.com/mehrlander/web-tools/main/.claude/environment-setup.sh && bash /tmp/s
claude plugin list | grep -q portable || echo 'If `claude plugin list` lacks portable, tell the user and run: bash /home/user/web-tools-private/sessions/tools/install-hook.sh' > ~/.claude/CLAUDE.md
```

The first line retries the fetch and runs the script only if the download
succeeded; a bare `curl … | bash` reports success when the fetch fails, and a
resumed container skips the setup step, so nothing would retry it. The
second line writes `~/.claude/CLAUDE.md` only when the plugin is still missing,
and the session reads that note at its first turn. It is the one channel from
the build to the session that does not depend on the plugin.

The script lives here because the setup script cannot reach a private repo. It
installs `portable` at user scope, because plugins load at session start and a
session rooted above the checkouts reads no project settings. It then saves its
own text, the commit it came from and when it ran to
`~/.claude/environment-setup.ran`, which the plugin's environment report prints
from at every session start
([extending.md](extending.md#sessionstart-the-environment-report)). The script
writes no `~/.claude/CLAUDE.md` and no `AskUserQuestion` deny.

Changing the script does not rebuild the environment. A rebuild runs whatever
is on `main` at that moment, and happens when the owner edits the environment
settings or the cached build expires.

**If the installed plugin fails to load, its refresher cannot run.** Recover the
session with `claude plugin marketplace update web-tools`, then
`claude plugin update --scope user portable@web-tools` and `/reload-plugins`.
For later sessions the owner edits the environment settings, which forces a
rebuild.

A build from this script announces itself at session start with a line
beginning `Environment built`, and leaves neither `~/.claude/env-manifest.txt`
nor a `~/.claude/hooks/` folder; finding either means the environment predates
it.

## The session transcript

*(measured 2026-07-29)*

Each session writes a JSONL transcript at
`~/.claude/projects/<slug>/<session-id>.jsonl`, appended turn by turn. A `Stop`
hook receives its path as `transcript_path`. Every line carries `timestamp`,
`cwd`, `sessionId`, and the CLI `version`; assistant lines add `message.model`
and `message.usage`, so per-session model and token totals are readable without
instrumenting anything.

**It does not persist.** The container holds exactly one transcript, the running
session's. There is no on-disk history of prior sessions, no session list in the
CLI config, and no MCP tool that enumerates them. The session's own
`claude.ai/code/session_...` URL is not fetchable from inside the box. So a
transcript not copied out before the container is reclaimed is gone, and the copy
has to be made by the session that produced it.

**Most of it is tool output.** On one working session, dropping tool results
took the raw JSONL from 691 KB to 24 KB (3%); the rest is file reads, command
output and search results, largely reconstructable from the repo.

**It is as sensitive as the most sensitive thing the session read.** Tool results
are recorded verbatim, so a transcript inherits whatever secrets, private file
contents, and API responses passed through it. Archiving one is a disclosure
decision, not a backup.

**Two fields do not mean what their names suggest.** `gitBranch` reads `HEAD`
rather than a branch name, so a branch has to be read from the repo instead. And
the user role carries harness-injected turns, a retry notice being the common
one, so counting user messages overstates how many times the user actually said
something.

## Repository observations

*Observed 2026-05-30.*

- `origin` used a loopback URL of the form `http://local_proxy@127.0.0.1:PORT/git/<owner>/<repo>`.
- The repository was shallow, indicated by `.git/shallow`.
- The `.git` modification time predated the VM boot time.
- Local `main` differed from `origin/main` after a remote history rewrite.
- Git objects removed from the remote remained present in that running environment.
- Concurrent sessions could not see each other's uncommitted files.

**A shallow clone truncates history silently.** `git log` returns a truncated history with no error and no marker: a file's apparent first commit is the graft boundary rather than its creation, and `git log -S` finds nothing earlier. Do not read that truncation as a rewritten history: a rewrite replaces commits; a shallow clone omits them. Run `git rev-parse --is-shallow-repository` before drawing any conclusion from `git log`, and `git fetch --unshallow` when the answer is `true` and the question needs real history.

Anthropic documents the [GitHub proxy](https://code.claude.com/docs/en/claude-code-on-the-web#github-proxy) as the authentication boundary for Git and GitHub API operations. Credentials remain outside the VM. The proxy supports cloning, fetching, pushing, and pull-request operations while restricting pushes to the current working branch and limiting operations to repositories attached to the session.

The current documentation specifies a fresh clone for each session. What these observations do and do not establish about persistence is set out under [Evidence limits](#evidence-limits) rather than restated here.

```bash
stat -c '%y %n' .git
uptime -s
git remote -v
git rev-parse --is-shallow-repository
git rev-parse main origin/main
```

## Concurrent sessions

Each web session runs in an [isolated VM](https://code.claude.com/docs/en/claude-code-on-the-web#security-and-isolation).

A file created but not committed in one session was not visible in a concurrent session. Changes transfer between sessions only after commit, push, and fetch or clone.

Session isolation does not establish whether a particular session retains its writable filesystem when its environment is reprovisioned. Expired environments are documented as being replaced.

## Added repositories

*Reported 2026-07-10 during cross-repository work. Not independently reproduced here.*

A session begins with one primary repository and branch. The web interface tracks that branch and displays its diff and pull-request controls.

The connected GitHub account can provide cloud sessions with access to [other repositories it can read](https://code.claude.com/docs/en/claude-code-on-the-web#github-authentication-options). A repository added during the session with `add_repo` receives a clone and Git access through the [GitHub proxy](https://code.claude.com/docs/en/claude-code-on-the-web#github-proxy).

In the reported session:

- The added repository could fetch and push its current branch.
- Its uncommitted files remained inside that session.
- The web interface did not display branch or pull-request controls for it.

The observed difference concerned web-interface integration, not Git access or filesystem persistence. The internal metadata mechanism responsible for that difference is not documented. For how to surface an added repository's work without those controls, see [github-surfacing.md](../github/github-surfacing.md#surfacing-an-added-repositorys-work).

## Evidence limits

Documented behavior and observed behavior are separate evidence.

- Documentation states the supported operating model.
- Filesystem and Git checks establish the state of a particular running environment.
- Concurrent-session tests establish isolation between those sessions.
- None of these observations establishes undocumented persistence across reprovisioning.

The stale local `main` established that the observed checkout contained older repository state. It did not establish that state from one session had persisted into another.

A result that matches the documented design is weak evidence about the mechanism, since it cannot separate understanding from recitation. Prefer an anomaly over a tidy match: the stale local `main` was useful precisely because it should not have been present.
