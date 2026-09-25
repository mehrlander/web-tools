---
name: tend
description: >-
  Cultivate a workspace toward recognized objectives: identify settled
  branches and shipped tasks, formulate an action plan for user approval,
  execute approved steps on green light, and surface stranded work or next
  opportunities. Use when the user asks to tend, tidy, refine the backlog,
  or triage branches.
disable-model-invocation: true
---

# tend

Cultivate a workspace toward recognized objectives. It clears paths, prunes dead
ends, and carries work forward. It readies the user to see the vital choice and
commit.

The foundational doctrine lives in `mehrlander/home` at
`chron/2026/09/2026-09-24-the-doctrine-of-tending.md`. This skill carries the
operational instructions for cultivating repositories.

## Commands

- `/tend`: Run branch triage, tracker reconciliation, and PR thread inspection.
- `/tend branches`: Triage remote branches, identify settled branches, and formulate a pruning plan.
- `/tend trackers`: Reconcile task backlog files against shipped reality on main and formulate a closing and linking plan.

## Core principles

1. **Commitment belongs to the owner.** Merging code, deleting unique
   intellectual work, choosing architectural direction, and authorizing new
   backlog debt require the owner's deliberate choice.
2. **The ethic of questions: answering versus minting.** The sin is transferring
   unfinished analysis. Dumping raw uncertainties, speculative edge cases, or
   unexamined choices onto the owner is friction masquerading as diligence.
   Bring a question only when investigation establishes a consequential choice
   that requires the owner's judgment. Define its terms and explain why it
   matters.
3. **The virtue is finding and resolving.** Dig into the git tree, verify facts
   against main, answer open threads, and make relevant connections to reduce
   what the owner must carry.
4. **Plan first, execute on green light, then offer more.** Propose clear batches
   of settled maintenance. Once approved, execute cleanly and present the next
   opportunities or commitment choices.
5. **Keep findings in transitory streams.** Findings belong in the session
   response or transitory logs. Do not mint new documentation files or tracker
   cards to record routine clarifications.

## The two-beat tending cadence

Tending operates in a clear two-beat rhythm:

```
[Phase 1: Survey & Propose Plan]  --->  User gives Green Light  --->  [Phase 2: Execute & Offer More]
```

### Phase 1: Survey and propose plan (request green light)

When invoked, survey the estate without making destructive or durable changes:

1. **Survey branches**:
   - List remote branches (`git branch -r`), excluding `HEAD` and default branch.
   - Classify each branch touched files against `main`:
     - **Landed**: Touch bytes exist on `main` (accounting for squash merges).
     - **Retired**: `main` deliberately deleted the touched paths.
     - **Stranded**: Holds novel files never present on `main`.
   - Identify candidate branches where 100% of touched files are proved landed or
     retired.
2. **Survey trackers**:
   - Compare open tasks (`tracker/tasks/*.md` with `status: backlog` or
     `in-progress`) against recent commits and merged PRs on `main`.
   - Identify tasks whose stated deliverables have already merged.
   - Identify tasks lacking `## Related` links for key files mentioned in the
     task body.
   - Identify obsolete or non-existent task IDs listed in `depends-on:`.
3. **Formulate the plan**:
   - Assemble high-confidence items into a concise, numbered plan.
   - Present the plan directly and request a green light:

   ```markdown
   ### Tending Plan

   Ready to execute with your green light:
   1. **Prune 2 settled branches**:
      - `feat/json-explorer` (squashed into main in PR #750)
      - `fix/header-nav` (merged in PR #752)
   2. **Close 1 shipped task**:
      - `task-0042` (delivered in PR #761)
   3. **Add resolving file links**:
      - `task-0089`: link `lib/kits/branch-status.js`
      - `task-0091`: link `pages/branch.html`

   Give the green light to proceed, or adjust the plan.
   ```

### Phase 2: Execute on green light and offer more

When the user responds with approval ("green light", "go", "proceed", "yes"):

1. **Execute approved branch prunes**:
   - Delete remote branches: `git push origin --delete <branch-name>`.
2. **Execute approved task closures**:
   - In each delivered task file, set `status: done`, `closed: YYYY-MM-DD`, and
     `session:` to the completing branch if known.
   - Append a final dated entry to `## Progress log` citing the delivery PR.
   - Regenerate the board:
     `python3 "${CLAUDE_PLUGIN_ROOT}/tasks/build-board.py" tracker/tasks tracker/board.md`
   - Commit task files and `board.md` directly to `main` following Real-time
     mode.
3. **Execute approved links and cleanups**:
   - Add resolving file paths to `## Related`.
   - Remove obsolete dependencies from `depends-on:`.
4. **Offer more**:
   Inspect the next layer and present higher-order opportunities or choices for
   commitment:
   - **Stranded novel work**: If a branch holds unmerged work, identify the
     originating session ID from commit footers or branch tokens, summarize the
     novel files, and ask whether to polish, cherry-pick, or abandon. Never
     delete stranded novel code without explicit instruction.
   - **Harvest PR threads**: Inspect the 25 most recently merged pull requests
     (`gh pr list --state merged --limit 25`). If `## Open threads` in a merged
     PR body contains a genuine, unaddressed follow-up, nominate it for owner
     decision (do not file autonomously).
   - If no further opportunities exist, confirm that the workspace is clean and
     step back.
