---
id: cross-repo-edit-proposals-evo1ml
title: Confirm-gated cross-repo edit proposals via a web-tools-private channel
status: backlog
track: independent
opened: 2026-07-23
next: Design the proposal record + the show-repo pending panel; reuse gh-transfer's confirm gate
---
# Confirm-gated cross-repo edit proposals via a web-tools-private channel

A way for an agent session (limited repo scope) to propose a change to a repo it
cannot reach, and have show-repo apply it later with the user's full-access
token, behind a manual confirm. The write-side counterpart to the existing
read-only mailbox: "farm out" an edit as a specified diff, hold it until the
user approves it in the app.

The motivating case: adding the per-repo `scope` field to the roster repos the
Map view lists (chat-histories, wa-bills, fn-data, shortcut-tools). A session
bound to home + web-tools + web-tools-private cannot write those repos, so today
it can only hand the user drafts to paste. This mechanism would let the session
drop the drafts as proposals and let the user apply them from show-repo.

## Starting points (all already in the codebase)

- **The mailbox is deliberately read-only.** `lib/repo-mailbox.js` +
  `web-tools-private/mailbox/` fulfill `tree | branches | fetch` on load, chosen
  so auto-fulfilling never spends write access on agent-authored instructions
  (see `web-tools-private/DESIGN.md`). A write channel is a real security-surface
  change and must not auto-apply; the whole safety hinge is the manual confirm.
- **The apply path exists.** `lib/gh-transfer.js` (show-repo's "Copy to repo")
  already writes files cross-repo via the token, with a two-tap confirm. A
  proposal apply is the same write behind the same gesture.
- **The config cache already reads the estate**, so the panel can show a
  proposal against a repo's current file.

## Shape (sketch, not settled)

- Agent writes `proposals/<id>.json` into web-tools-private: target `owner/repo`,
  path, new content or a patch, and a one-line why.
- show-repo, on load with a token, surfaces a **pending proposals** panel
  (never auto-applies): each proposal shows a diff against the target's current
  file.
- On the user's confirm, it commits to the target via `gh-transfer`; the
  proposal moves to a `results/`-style done state, the way the mailbox does.

## Open questions

- Patch vs whole-file content (whole-file is simpler and matches gh-transfer;
  a patch needs a 3-way apply).
- Where the panel lives: an estate view, or folded into the Map / a repo dialog.
- Batching several proposals into one confirm vs one-at-a-time.
- Whether this subsumes or sits beside the mailbox (both are agent-to-app
  channels; one reads, one proposes writes).

## Progress log
- 2026-07-23: Filed. Surfaced while adding `scope` to the roster from a session
  that could not reach those repos (the Map view work, web-tools PRs #281/#282).
  The read-only mailbox and gh-transfer are the two halves to build between.
