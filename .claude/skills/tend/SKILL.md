---
name: tend
description: >-
  Cultivate a workspace toward recognized objectives: prune settled branches,
  reconcile the tracker with what shipped, harvest open threads from merged
  pull requests, and nominate snags that still bite, acting on what is settled
  and bringing the owner only the choices that need commitment. Run when the
  owner invokes /tend.
disable-model-invocation: true
---

# tend

## Premise

Tending is the cultivation of a workspace toward recognized objectives. It
clears paths, prunes dead ends, and carries work forward. It readies the owner
to see the vital choice and commit. Branches outlive their merge, tasks their
delivery, open threads their pull request, snags the session they bit. Most of
this residue can be settled by investigation alone; what cannot is a
commitment. Doctrine: `mehrlander/home`,
`chron/2026/09/2026-09-24-the-doctrine-of-tending.md`.

## Principles

1. **Commitment belongs to the owner.** Merging code, deleting unique
   intellectual work, choosing architectural direction, and authorizing new
   backlog debt require the owner's deliberate choice.
2. **Clarification is reliably valuable.** Proving whether work has landed,
   connecting orphaned work to its origin, and testing relevant assumptions
   reduce what the owner must carry. Carry the investigation through.
3. **Answer questions; do not mint them.** Transferring unfinished analysis is
   the failure: raw uncertainties, speculative edge cases, or unexamined
   choices handed to the owner are friction masquerading as diligence. Bring a
   question only when investigation establishes a consequential choice that
   requires the owner's judgment. Define its terms and say why it matters.
4. **Findings stay in the reply.** Write no new documents for routine
   clarifications. Exempt: a snag entry (`docs/SNAGS.md` takes them without
   approval) and a task proposed through the `tasks` filing gate.

## Process

`/tend` runs the four streams below. `/tend <stream>` runs one, and a stream is
any body of work with a name and a boundary a reader can locate: `branches`,
`trackers`, `prs`, `snags`, but also a project folder, a pull request, or a
topic. A stream with no section here keeps the principles and tiers; an action
there goes unasked only when a check shows nothing is lost.

1. **Survey** every stream. Change nothing.
2. **Act** on each stream's *Act* tier, and report it.
3. **Propose** the *Propose* tier as one numbered batch; close 🟢 per
   `docs/SURFACING.md`.
4. **On green light,** execute, then offer the next layer: novel branches with
   origin and substance established, live threads, snags still biting. Close
   🟢 if anything is proposed, ⚪ if nothing remains.

Settled matters get a mechanical test, because the test is what licenses acting
unasked. Whether something deserves the owner's attention gets judgment: read
it and nominate with a one-line reason; no count or fixed window substitutes.
Tiers are a ceiling: where the venue restricts pushes (a Claude Code web
session pushes only to its own branch), every deletion is proposed. Read GitHub
through the GitHub MCP; cloud sessions have no `gh`, and `curl` to
`api.github.com` is refused.

## Branches

If `git rev-parse --is-shallow-repository` prints `true`, run
`git fetch --unshallow origin` first: a shallow clone reports settled work as
orphaned. Then `git fetch origin --prune`. The first test a branch passes names
its class:

| Class | Test |
| --- | --- |
| open | `head.ref` of an open pull request. Excluded. |
| merged-tip | Tip SHA equals `head.sha` of a merged pull request. |
| ancestor | `git rev-list --count origin/<b> --not origin/main` prints `0`. |
| content-settled | `python3 scripts/stranded-triage.py . origin/<b>` reports every path `landed`, `moved` or `retired`, or `differs` where the branch's blob appears at that path in `git log <merge-base>..origin/main -- <path>`. A bare branch name makes the script report `no merge base`. |
| novel | Anything else, including anything a shallow clone leaves undecided. |

- **Act:** delete a merged-tip branch, or an ancestor branch that heads a
  merged or closed pull request: re-read the tip with `git ls-remote`, since a
  fetched ref can trail the remote, then `git push origin --delete <b>`. Only
  once `git grep -q prFallback origin/main -- lib/kits/branch-brief.js`
  succeeds, so `pages/branch.html` still renders the pull request; until then,
  propose.
- **Propose:** delete a content-settled branch, or an ancestor with no pull
  request (possibly a session not yet pushed; give its last commit date).
- **Owner only:** a novel branch. Report its origin (`Claude-Session` trailer
  or pull request) and its novel files.

Link by pull request, `pages/branch.html#gh=<owner>/<repo>&pr=<n>`, which
survives deletion.

## Trackers

The `tasks` skill owns every tracker rule, including the filing gate and the
commit recipe. Read tasks from `origin/main`, and read each open task's
premises against the tree, not only its body.

- **Act:** close a task whose `## Done when` a merged pull request meets; add
  `## Related` entries; drop a `depends-on:` id that is done or missing.
- **Propose:** close a stale `in-progress` claim (`in-flight` skill); reframe,
  split, or supersede a task; file a new one.

## Pull requests

Read `## Open threads` in merged pull requests, back to the previous tend pass
or as far as threads stay live, and state the window. 🟢 and 🟡 items are open;
check each against `main`.

- **Act:** report threads `main` has since resolved.
- **Propose:** a task for a live thread.
- **Owner only:** design direction; closing or merging any pull request. Leave
  merged bodies unedited: MCP writes mangle their links.

## Snags

The `×N` count in `docs/SNAGS.md` orders the reading and triggers nothing.

- **Act:** log a trap this pass hits, as an entry or a date on its owner.
- **Propose:** a task for a snag that still bites: no task cites its slug
  (`git grep <slug> origin/main -- tracker/tasks`), its entry records no fix
  in place, and a later session would otherwise rediscover it. Also propose
  folding entries the index flags as overlapping.

## Example

```
x/alpha  tip = head of merged PR #N    -> deleted
x/beta   ancestor, no PR, pushed today -> proposed
x/gamma  4 novel files, trailer S      -> owner: polish, cherry-pick, or abandon?
task t1  Done when met by PR #N        -> closed
PR #M    thread 2 still live           -> proposed as a task
```
