---
name: sandbox-traps
description: >-
  Diagnose a Claude Code web sandbox failure that impersonates a different
  problem. Use when a tool call returns MCP error -32003 or unexpectedly
  requires approval, when git log looks truncated or history appears rewritten,
  when a check reports that a pinned commit is missing from the checkout, when
  git push is rejected with HTTP 413, when an outbound request fails and it is
  unclear whether the host is blocked, or when a repo hook that should have
  fired did not. Read before concluding anything from git history in a web
  session.
---

# Sandbox traps

## Premise

The web sandbox fails in a small number of enumerable ways. Each one presents as
a larger and more alarming problem than it is, and each has a one-line test that
separates the two. Match the symptom, run the test, apply the rule, rather than
reasoning from a plausible wrong diagnosis.

## Key insights

**`-32003`, or a call that suddenly needs approval.** A session carries built-in
MCP servers and claude.ai connectors. Both expose the same tool names and
discovery returns either. Connector calls fail in a web session because
server-level approval validation fires before Claude Code's permission logic and
no approval UI is reachable. Re-approving does not clear the errored call, so the
approval itself looks broken.

The rule: call the built-in equivalent rather than whatever discovery returned.
`ToolSearch select:mcp__github__<tool>`, then reissue. A connector is surfaced
under a UUID that names nothing; resolve it from `mcp-logs-<id>/` under
`~/.cache/claude-cli-nodejs/<root>/`, which records each call under the server's
real name. A capability existing only on a connector has no fallback.

After an environment restart, the resume notice may announce the built-in
names as *no longer available* and list UUID-named replacements; ask ToolSearch
for the built-in name anyway, since it still resolves. The error text
("requires approval") is not a permission wall the user has to clear. The
`portable` plugin's `PostToolUseFailure` hook (`hooks/mcp-fail-hint.sh`)
injects this rule when `-32003` hits an `mcp__*` tool; `PostToolUse` does not
fire on a failed call at all.

**A short `git log`.** The checkout is shallow. `git log` truncates with no
error and no marker, so a file's apparent first commit is the graft boundary
rather than its creation, and `git log -S` finds nothing earlier. This is not a
rewritten history: a rewrite replaces commits, a shallow clone omits them.

    git rev-parse --is-shallow-repository   # true means stop
    git fetch --unshallow                   # when the question needs real history

The same shallow clone presents a second way, naming an object rather than a
depth: a check that pins a baseline commit fails with *the pinned commit `<sha>`
is not in this checkout*, which reads as a deleted or corrupted object. `git
cat-file -e <sha>` confirms only that it is absent; the shallow test above gives
the reason. No pinned-baseline check passes in a web session until the clone is
deepened; `--unshallow` on `mehrlander/home` took under a minute.

**`HTTP 413` on push.** The proxy is refusing the request body, not a client
buffer, so `http.postBuffer` changes nothing. A push carries only the objects the
remote lacks, so a smaller commit is a smaller push: split a large addition
across commits and push after each. Batches of 90 to 130 MB cleared; 757 MB did
not. The branch and any draft PR come up on the first small push.

**A failed outbound request.** The status does not tell you. A blocked host
returns the `x-deny-reason: host_not_allowed` header with its 403; an allowed
host returns whatever the origin says, including the origin's own 403, and
carries no deny header. Probe with `curl -D -` and read the header.

Two gates, not one. General traffic goes through the allowlist proxy; GitHub git
traffic goes through a separate proxy scoped to the authorized repo, which
answers `Proxy error: repository not authorized` (502). Different failure, same
appearance.

**No create-PR button on an added repo.** A repository attached mid-session
with `add_repo` has no web-interface pull-request controls. This is a missing
affordance, not a failure: commit to a branch other than the default, push, and
hand the owner the compare URL,
`https://github.com/<owner>/<repo>/compare/<default-branch>...<branch>`. The
MCP write path opens the PR under the integration identity, so it follows an
explicit request
([`docs/github/github-surfacing.md`](https://github.com/mehrlander/web-tools/blob/main/docs/github/github-surfacing.md#surfacing-an-added-repositorys-work)).

**A hook that never fired.** `.claude/settings.json` is read only when the
session's project root is the repository. In a multi-repo session the root sits
above it, so every hook it declares silently never runs: no build-on-commit, no
dependency install, no `SessionStart` git-hook install. Nothing reports this and
it looks exactly like everything working. Restore the recoverable part with
`git config core.hooksPath .githooks`, and run by hand whatever else those hooks
did. A check that must not be skipped belongs in a test suite, which runs
wherever it is invoked.

## Extending

When a new sandbox failure costs a session real time, add it here in the same
shape: the symptom as it presents, the test that separates it from what it
resembles, and the rule. Evidence and dated measurements go in the
`docs/environment/` and `docs/github/` records in `mehrlander/web-tools`.
