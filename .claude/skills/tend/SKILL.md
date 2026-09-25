---
name: tend
description: >-
  Cultivate a workspace toward recognized objectives: prune landed branches,
  close shipped tasks, link related context, and harvest unaddressed PR
  threads. Acts immediately on settled intent while preserving choices that
  require the owner's commitment. Use when the user asks to tend, tidy,
  refine the backlog, or triage branches.
disable-model-invocation: true
---

# tend

Cultivate a workspace toward recognized objectives. It clears paths, prunes dead
ends, and carries work forward. It readies the user to see the vital choice and
commit.

The governing charter is [docs/TENDING.md](../../../docs/TENDING.md). Read it for
the foundational philosophy; this file carries the operational instructions.

## Commands

- `/tend`: Run both branch triage and tracker refinement in one pass.
- `/tend branches`: Triage remote branches, prune settled branches, and isolate
  stranded work.
- `/tend trackers`: Reconcile task backlog files against shipped reality on main.

## Core principles

1. **Commitment belongs to the owner.** Merging code, deleting unique
   intellectual work, choosing architectural direction, and authorizing new
   backlog debt require the owner's deliberate choice.
2. **Act immediately on settled intent.** When evidence establishes that work has
   fully landed or an action is completely settled, execute it unattended. Do
   not burden the owner with requests to confirm obvious garbage collection.
3. **The sin is transferring unfinished analysis.** Dumping raw uncertainties,
   speculative edge cases, or unexamined choices onto the owner is friction
   masquerading as diligence. Bring a question only when investigation
   establishes a consequential choice that requires the owner's judgment.
   Define its terms and explain why it matters.
4. **The virtue is finding and resolving.** Dig into the git tree, verify facts
   against main, answer open threads, and make relevant connections to reduce
   what the owner must carry.
5. **Keep findings in transitory streams.** Findings belong in the session
   response or transitory logs. Do not mint new documentation files or tracker
   cards to record routine clarifications.

## 1. tend branches

Inspect remote branches against the default branch (`main`):

1. **Gather candidate branches**:
   List active remote branches (`git branch -r`). Ignore `HEAD` and the default
   branch.
2. **Evaluate content status**:
   Use content-level verification (as in `scripts/stranded-triage.py` and
   `lib/kits/branch-status.js`):
   - **Landed**: All touched bytes exist on `main` (accounting for squash merges
     or cherry-picks).
   - **Retired**: `main` deliberately deleted the paths touched by this branch.
   - **Stranded**: The branch holds unique bytes at paths main never had and
     never deleted.
3. **Execute settled intent**:
   If evidence proves that 100% of a branch's touched files are landed or
   retired, with no unique work left to preserve:
   - **Silently prune the branch**: `git push origin --delete <branch-name>`.
   - Record the deletion in your reply.
4. **Protect stranded work**:
   If a branch holds novel, unlanded files:
   - **Never delete the branch.**
   - Determine provenance: find the originating session ID from commit footers,
     branch name tokens, or chat records.
   - Identify the novel files and summarize their substance.
   - Present the choice concisely in your reply: state the branch, session, and
     files, and ask whether to polish, cherry-pick, or abandon.

## 2. tend trackers

Inspect task files (`tracker/tasks/*.md`) against current repository state:

1. **Identify delivered tasks**:
   Compare open tasks (`status: backlog` or `in-progress`) against recent commits
   and merged PRs on `main`.
2. **Execute settled intent**:
   If a task's stated deliverables have already merged into `main`:
   - Set `status: done` and `closed: YYYY-MM-DD`.
   - Set `session:` to the completing branch if known.
   - Append a final dated entry to `## Progress log` citing the delivery PR.
   - Regenerate the board with `python3 "${CLAUDE_PLUGIN_ROOT}/tasks/build-board.py" tracker/tasks tracker/board.md`.
   - Commit task files and `board.md` directly to `main` following Real-time
     mode.
3. **Add high-signal connections**:
   If a task body discusses key files or dependencies but lacks `## Related`
   pointers:
   - Add a `## Related` section before `## Done when`.
   - Add lines for existing repository files (`path/to/file: role`), sibling
     tasks (`task <id>: relation`), or PRs (`PR #N: relation`).
   - Every file path listed before the colon must resolve in the repository.
4. **Clear obsolete dependencies**:
   If a task's `depends-on:` lists an ID that is settled (`done` or `dormant`),
   or points to a non-existent task, remove the stale reference.

## 3. Harvest PR threads

When running `/tend` or `/tend trackers`, inspect the 25 most recently merged
pull requests (`gh pr list --state merged --limit 25`):

1. Read `## Open threads` in each merged PR body.
2. Check whether subsequent commits on `main` already addressed the open item.
3. Discard speculative notes, conversational remarks, or temporary blockers.
4. If an item represents a genuine, unaddressed follow-up with concrete value:
   - Do **not** create a tracker task autonomously.
   - Bring it to the owner in the session response as a single, clear nomination:
     state the source PR, the specific capability or test needed, and ask if it
     should be logged on the board.

## Output and reporting

Carry the investigation through, execute settled intent unattended, and format
the response with maximum economy:

```markdown
### Tended
- **Pruned 2 landed branches**: `feat/json-explorer` (squashed in #750), `fix/header-nav` (merged in #752).
- **Closed 1 shipped task**: `task-0042` (delivered in PR #761).
- **Linked 2 task files**: added resolving `## Related` paths to `task-0089` and `task-0091`.

### Choices for Commitment
1. **Stranded branch**: `claude/local-app-port-addressing-7000g1` (session `94c898c7`) holds 2 novel tools (`whats-listening.bat` and README). Should we cherry-pick to `tools/` or discard?
2. **Harvested PR thread**: PR #745 left open thread "verify dictation fallback offline". Should this become a backlog task?
```
