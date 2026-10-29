---
name: in-flight
description: "Check whether any branch, PR, or tracker task is already working on something before starting it, and report which claims have gone stale. Use when the user asks what is in flight, what is live, whether anything is already working on a topic or a set of files, whether a branch exists for this, what is safe to start, or whether the tracker board can be trusted. Also use when opening a session on a repo with many leftover branches, or when invoked as /in-flight."
---

# In flight

## Premise

Two sessions cannot see each other. What one leaves behind is a branch, a PR, and a tracker task, and the task and the branch both mislead. A tracker task says `in-progress` until someone edits it, so a claim outlives its work. Merging does not delete branches, so hundreds of refs can sit in a repo where two or three carry live work.

One measurement cuts through both. A branch with no commits outside the base branch cannot be in flight, whatever its name, age, or diff suggests. That reduces a stale estate to a handful of candidates, small enough to check honestly.

## Goal and output

A short report answering "is something already going on here?" It is meant to be read before work starts and to end in one of two conclusions: clear to proceed, or read these branches first.

Three findings, in descending reliability:

1. **Live branches.** Branches carrying commits the base branch lacks, with ahead-count, age, PR, authoring session, and claim.
2. **Claims.** Tracker tasks marked `in-progress`, each reconciled against the branch it names.
3. **Stale claims.** Claims whose branch has merged, vanished, or never shared history. These are the repair list.

## Process

**1. Run the script.** It is bundled with this skill, stdlib python, read-only, no network.

```
python3 "${CLAUDE_PLUGIN_ROOT}/in-flight/in-flight.py" <repo> [<repo> ...] --fetch
```

Pass every repo the session touches. Use `--fetch` unless refs were fetched in this session; a scan of stale refs is a reading of the past, and the report says how old they are.

**2. Scope it when the work is known.** If the coming work has a subject, name the paths:

```
--paths projects/budget-drs/ lib/gh-api.js
```

The report then ends in a collision verdict rather than a list. Only live branches are checked; do not compare paths across the whole estate yourself, since an old branch differs from the base branch mostly by the base branch's own forward drift.

**3. Overlay open PRs.** The script has no network by design. Fetch open PRs with the GitHub MCP (`list_pull_requests`, state `open`), write them to a JSON file, and pass `--prs`:

```json
[{"number": 337, "title": "…", "head": "claude/branch-name",
  "draft": false, "repo": "owner/repo", "html_url": "https://…",
  "body": "…"}]
```

`repo` keeps a branch name common to two repos from picking up the other's PR. `body` is optional and used only to recover a session link for a branch whose commits carry no trailer. Skip this step for a quick local check; the branch findings stand without it.

**4. Report, then offer the repair.** Give the verdict first: what is live, and whether it touches the coming work. Then, if there are stale claims, offer to fix them. A stale claim is a task-file edit (`status`, `closed`, a progress-log line) committed straight to the base branch per `docs/TRACKER.md`, not branch work. Do not fix them silently: closing a task is a statement about someone's work, and the reason it landed unnoticed may matter.

## Key insights

- **The ahead-count is the load-bearing measurement.** `git rev-list --count <branch> --not <base>` returning zero is proof, not an estimate. In a merge-commit repo it retires most of the estate in one pass.

- **A branch with no merge-base is not live, however recent it looks, on a complete clone.** A history rewrite orphans every branch cut before it, and those branches keep names and dates that look current. Report them as unrelated, never as live.

- **On a shallow clone that reading is worthless.** A missing ancestor and a rewritten one are indistinguishable, so the script tests `git rev-parse --is-shallow-repository` and reports that group undecidable. Run `git fetch --unshallow` before retiring anything as unrelated.

- **The ahead-count alone overstates a squash-merge repo.** After a squash the branch stays ahead forever. The correction is the content signal: of the paths the branch touched, how many still differ from the base branch. Zero means the work landed by another route. Report both numbers and let them disagree in the open rather than blending them into a verdict.

- **A claim is worth as much as the last time something checked it.** Reconcile every claim against its branch rather than list it: a board that says "3 in progress" when all three branches have merged is worse than one that says nothing.

- **Claims come from the base branch, not the checked-out files.** Reading the working tree reports a task closed on base as still in progress for every session on a feature branch. `--worktree` reads the checkout instead; the script falls back to it when base carries no tracker at all.

- **Report an unfed claim layer as a finding.** Zero claims across a hundred-plus tasks means the mechanism is unused, not that nothing is happening. Say so rather than reporting "nothing in progress."

- **Live but unclaimed and PR-less is the row to surface:** work that was pushed, never delivered, and never written down.

- **The `Claude-Session:` commit trailer is the only session identity git carries.** Commits are SSH-signed, but the key is Anthropic's and constant, and author and committer are a fixed `Claude <noreply@anthropic.com>`. The script reads the trailer from the branch's own commits, not a window back from the tip, which would count sessions from the base branch; a merged branch falls back to its tip. Prefer the trailer to the PR body: the trailer survives merge and close, where a PR body lasts only while the PR is open. Commits a human authored and GitHub merge commits carry none.

## Extending

`--json` emits a machine-readable finding for anything that renders the report, such as a Web Tools panel or a session-start check; nothing consumes it yet. The repair stays manual until closing stale claims is routine enough to justify a `--fix` flag.

## Bundled

- `in-flight.py`: the scan. Read it when changing what counts as live, or when adding a signal; the classification comments give each rule's reason, and the measurement behind it where one was taken.
