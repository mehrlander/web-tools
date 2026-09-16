---
id: surfacing-gate-content-okwnp6
title: Hold SURFACING.md to surfacing.csv by content, not by lead-in
status: backlog
opened: 2026-09-10
size: S
---
# Hold SURFACING.md to surfacing.csv by content, not by lead-in

`tools/test/surfacing-manifest.test.mjs` holds membership two ways: every
primitive bullet in the prose has a manifest row, and every row points at a
real bullet. It matches on the bold lead-in only. The summaries are paraphrases
and are deliberately unchecked, which `docs/docs.csv` says out loud.

That leaves a hole this repo has now fallen into once. On 2026-09-07 a
shortening pass cut "a wake that changed nothing says nothing at all" from the
`Close in one order` bullet. The `close-order` row in `docs/surfacing.csv` kept
the clause, byte for byte, and still carries the stronger form of it ("no
state, no restated list"). The lead-in never moved, so the suite stayed green
for three days while the prose and its index disagreed on a rule. The prose is
the copy a session reads, so the delivered rule was the weaker one, and 338 of
2,056 closing states in that window were surplus.

21 primitives carry the same exposure in both directions.

## Done when
A drift between a bullet and its row is loud, and the mechanism is written
down. What it must not become is a demand that the paraphrase match the prose
word for word: the summaries are deliberately looser than the rule, and a gate
that forbids that would be reverted within a month.

## Notes
Three shapes worth weighing before picking one.

- Store a hash of the bullet body in the row and fail when it moves. Cheap and
  certain, but it fires on every wording change including harmless ones, so it
  is a nag rather than a finding.
- Check that each row's declared `boundary` clauses still appear in the bullet,
  as a set of required phrases rather than as prose. Narrower, and it is the
  field that actually carried the lost clause.
- Report drift rather than failing: a `--check` mode listing rows whose bullet
  no longer contains their boundary text, run in the suite as a warning and by
  hand during a doc pass.

The second is the closest fit to what went wrong, since `boundary` is where the
clause lived and where it survived.

## Progress log
- 2026-09-10: Filed out of PR #646, which restored the lost clause but left the
  gate that missed it unchanged.
