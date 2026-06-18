# Inter-session messaging (the "session census")

> [!WARNING]
> **Status: under consideration, not implemented.** This is a design sketch to
> hold the idea, its intention, and its open issues. Nothing here exists in the
> repo yet. Don't cite it as a feature; do edit it as thinking sharpens.

## The problem

A Claude Code web session lives in an isolated, ephemeral container and works on
one branch. Over time you accumulate many sessions and many branches, some
merged, some half-done, some abandoned. Two facts make this hard to manage:

- **You can't talk to a session directly.** There's no inbound channel into a
  running container, and no outside API to broadcast a prompt across all your
  sessions.
- **The durable unit is the branch, not the session.** Containers get reclaimed
  after inactivity; branches persist. So "reach a session" really means "reach
  whoever next resumes its branch."

The interface lets you group sessions, but grouping doesn't scale to "what is
each of these dozens of branches, and what should happen to it." We want a way
to make **order out of chaos** across the back catalog.

## The idea

Use the **repository itself as a message bus** (the only shared, persistent
medium every session can read and write), and use it to run a **back-catalog
census**:

1. A **conductor** session enumerates branches and drops a *generic
   interrogation* addressed to each one onto the bus.
2. You resume each old session and run **one uniform prompt** — the same prompt
   regardless of what the session was about.
3. That prompt makes the session **classify itself**, **take the matching
   cleanup action itself**, and **write its verdict back** to the bus.
4. The conductor later collects the verdicts into a single map.

### Why it points *backward*, and why that's the strong version

This is a message to a **predecessor**, not a successor. The leverage: when you
resume an old session, **its conversation context is restored**, so it remembers
its own intent — what it finished, what it punted on — in a way no external
observer could reconstruct from the diff. One generic prompt fits every session
because **each session supplies its own meaning**. You don't need to know what
session #47 was; you ask it, and it tells you.

This is the **load-bearing assumption**: that resuming a genuinely old/reclaimed
session restores its context. If resume returned a blank session, the whole
thing collapses back into cold-reading diffs. **This needs to be confirmed
early.**

### How it differs from the merge guide

The [merge guide](../MERGE-GUIDE.md) is **prospective, self-authored at wrap-up,
and survivorship-biased**: only sessions that exit cleanly ever write an entry.
The census is **retrospective** and reaches exactly the branches that *never*
wrote one — the unwrapped residue that is the actual source of the chaos. They
are complementary: the census can **retroactively produce** the missing
merge-guide entries (for done-but-unlogged branches) and a **kill-list** (for
abandoned ones), feeding straight back into existing conventions.

## Prior art (this is a known shape)

- **Blackboard pattern / stigmergy** — agents coordinate by reading and writing a
  shared medium, never addressing each other directly. The repo is the
  blackboard; commits are the pheromone trail.
- **Maildir / actor mailboxes** — one file per message, processed on the
  recipient's own schedule; no direct call.
- **Census / roll call / liveness probe** — broadcast one question, every node
  reports its own state (cf. Kubernetes readiness probes).
- **Reflection** — an object reports its own type and state rather than being
  inspected from outside.
- **GC mark phase** — you can't tell from outside whether an old thing is still
  needed, so you reach each one and let it answer.

## Design sketch (minimal slice)

- **Transport: an orphan `bus` branch.** Messages live only there, so they never
  pollute a feature diff and never reach `main`. (Git's native `git notes` is the
  purpose-built alternative; orphan branch is simpler to reason about.)
- **Format: maildir-style.** One file per message, unique name
  (`<timestamp>-<from>-<uuid>.md`), addressed by recipient branch (a `to:` field
  or a `to/<branch>/` subdirectory). Append-only files never merge-conflict.
- **`/check-census` skill** (recipient side): a resumed session runs it; it
  fetches `bus`, finds messages for the current branch, self-classifies, takes
  the matching action, and writes its verdict back.
- **Conductor side** (thin): enumerate branches (`list_branches`), drop the
  interrogation, later collect verdicts into a summary.

### Self-classification taxonomy

The verdict each session reports about itself:

| Verdict | Meaning | Self-action |
| --- | --- | --- |
| `done-merged` | Work shipped and merged | Confirm; nothing to do |
| `done-needs-PR` | Finished but never opened/merged | Fold branch guide → merge guide, open PR |
| `open-active` | Real work remaining | Refresh branch guide, report what's left |
| `abandoned` | Dead end, no value | Flag branch for deletion |
| `superseded` | Replaced by other work | Point at the successor, flag for deletion |

### The self-healing twist

The conductor shouldn't do the cleanup; it should **trigger each session to
clean itself up**, since each session is best positioned to. So the generic
prompt is not just "report status" but "assess yourself **and act**."

## Open issues / threads

- **Resume restores context?** The load-bearing assumption above. Confirm on a
  genuinely old/reclaimed session before building anything.
- **Push vs. poll.** The bus is inherently **poll-only**: a message waits until
  someone resumes the branch and checks. The one real push channel is the
  **PR-activity webhook** — a session parked on a PR can be woken by a comment.
  Live ones could be pinged that way; dormant ones need a manual resume.
- **The labor that remains.** The bus removes the need to *recall and decide*,
  but not the need to *visit*: there's no outside way to auto-run a prompt across
  dormant sessions. Realistic win is **cognitive load per session** (resume,
  paste one line, walk away), not the number of sessions touched.
- **Addressing.** Branches map roughly 1:1 to sessions and embed a slug
  (e.g. `claude/inter-session-messaging-hvn2g2`), so address by branch name. Good
  enough, but not a guaranteed bijection.
- **Conflict avoidance vs. discoverability.** Maildir solves write conflicts, but
  a sprawling `bus` branch needs its own hygiene (expiry? archive of processed
  messages?).
- **Trust.** Messages are just files anyone with push access wrote; for a
  single-owner repo that's fine, but worth noting before generalizing.

## Recommendation

Build the **minimal vertical slice** (orphan `bus` + `/check-census` +
thin conductor) and prove it on real branches before adding any automation.
Skip the push/webhook layer initially; accept poll-based and manual resume.
**First, cheaply confirm the resume-restores-context assumption** — everything
depends on it.
