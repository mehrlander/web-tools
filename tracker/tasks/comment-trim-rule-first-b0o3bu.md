---
id: comment-trim-rule-first-b0o3bu
title: Finish commentary trim: accuracy pass or paired fan-out
status: backlog
opened: 2026-09-08
size: M
---
# Finish commentary trim: accuracy pass or paired fan-out

A census on 2026-09-08 measured comment density across this repo and home, and
three agents read six files in full. Findings in
[docs/text-content.md](../../docs/text-content.md), "Is it true? A read of six
files", and the run record in home at
`chron/2026/09/2026-09-08-code-comment-census.md`. The short version: comment
density roughly tripled between June and September (8.3% to 29.7% of lines in
`lib`, `pages` and `app`), restatement and debris are 1 to 3 percent of comment
words so there is nothing to tidy, and the removable mass is history and
rationale at length, all of it true.

Three pieces, one outcome, in this order because the later ones depend on the
earlier.

- **State the rule.** A comment keeps the condition, the threshold and the named
  exception; the date, the measurement and the incident go to a dated record; a
  header states the contract and points at the site rather than restating it; a
  figure in a surviving comment must be traceable to a file or it goes. This is
  the conventions' "Prose that describes state is unimplemented" applied to
  code, where it has never been written down. It goes first because this repo
  added roughly 20,000 comment lines in the month before the census, so a pass
  with no rule behind it is undone within weeks.
- **Pilot on the six files already read.** `lib/kits/swipe-deck.js`,
  `lib/alpineComponents/stage.js`, `pages/toss-render.html`,
  `tools/render/cdn.mjs`, and home's `views/spend.js` and `build-submittal.py`.
  The readers supplied the compressed residue for each block they would cut, so
  the pilot is a rewrite against a known target rather than a fresh judgment.
  A second reader then checks the removed text adversarially for a condition
  absent from what remains, which is the check that makes the operation safe.
- **Fan out, in a shape the pilot corrected.** One agent per file over the
  heaviest files per repo, ranked by comment mass, PLUS a second agent per file
  whose only job is to find where the first was wrong. That pairing is not
  optional and is not a review formality: unpaired, the six pilot rewrites
  introduced seven false statements, and the mechanical equivalence check cannot
  see one. Both agents want the stronger model, since the thing being hunted is
  a plausible sentence that is false. Exclude `archive/`, `dist/`, vendored skill
  scripts, generated payloads, and the paths frozen in home's
  `projects/budget-drs/.paths.json`.

  **Consider the cheaper operation first.** The four header-contract fixes and
  the five stale counts were most of what the pilot actually bought. An accuracy
  pass that touches nothing else, reading each header against its code and each
  figure against its file, costs a fraction of a trim and captures the larger
  share of the value. `embedded-prose.py --dated` lists half its worklist
  already.

## Residual
Steps 1 and 2 are on `main`. Step 3 is the whole of what is left, and the first
move is choosing which shape it takes:

1. **Accuracy-only pass**, which the pilot favors: headers read against their
   code, figures read against their files. `embedded-prose.py --dated` lists
   much of the worklist; header drift has no mechanical report and is logged as
   `header-essay-outlives-its-code` in SNAGS.
2. **Or the paired fan-out** over the heaviest remaining files: one rewriter
   plus one adversarial checker per file. The pairing is not optional.

Either shape includes `lib/alpineComponents/estate.js`, folded in from
`estate-js-commentary-read-mymt4u` on 2026-09-17. That file carries a question
the rest of the worklist does not: how much of its 25,643 comment words restate
`docs/show-repo.md`'s estate sections, and how much is rationale sitting where
it belongs. Do not answer it by token overlap; the reason is in
`docs/text-content.md` and is the lesson of PR #403.

Pilot lessons live in `docs/text-content.md`, "What the pilot taught about
running the pass".

## Related

- `CLAUDE.md`: conventions home after PR #634; holds the commentary rule (was docs/CONVENTIONS.md)
- `docs/text-content.md`: census findings and pilot lessons for the residual pass
- `docs/SNAGS.md`: `header-essay-outlives-its-code` and `rewriter-marks-its-own-work`
- `scripts/embedded-prose.py`: `--dated` worklist for the accuracy-only shape
- `lib/alpineComponents/estate.js`: fold-in residual; PR #403 question lives here
- `lib/kits/swipe-deck.js`, `lib/alpineComponents/stage.js`: pilot files still named in the body
- task `estate-js-commentary-read-mymt4u`: folded source of the estate.js exit clause
- PR #625: steps 1 and 2 already on main

## Done when
Either the accuracy-only pass has run on the heavy files, or the paired fan-out
has, or a log line here records that neither is worth running and why. In every
case `lib/alpineComponents/estate.js` gets its PR #403 answer in a log line
here: the commentary is rationale in place, or the contract half is retired and
the rest sits at the code it explains. That clause arrived with the fold and
does not lapse if the pass itself is judged not worth running.

## Progress log
- 2026-09-08: Filed out of the census and the six-file read. Nothing trimmed
  yet; the session recorded findings only. `embedded-prose.py --dated` was added
  in the same pass and reports the dated-claim class (324 blocks in 69 files
  here, 408 in 157 in home), which is one of the two defects the read found. The
  other, a file header drifting from the code, has no mechanical report and is
  logged as `header-essay-outlives-its-code` in SNAGS.
- 2026-09-08: Steps 1 and 2 done on `claude/code-comments-assessment-sqzvrz`
  (web-tools PR #625, home PR #605). The rule is in `CLAUDE.md` (conventions home after PR #634; was `docs/CONVENTIONS.md`) under
  "Prose that describes state is unimplemented"; the six pilot files are
  rewritten and mechanically verified comment-only, by stripping comments and
  comparing the remainder rather than by reading the diff. Comment words fell
  about 8,400 of 57,000 across the six, each file landing where its read
  predicted. An adversarial second read is running against every diff, which is
  the gate that decides whether step 3 is worth starting.
  Two findings worth carrying into the fan-out. The file header was the least
  accurate prose in four of the six, so the accuracy fixes may be worth more
  than the word count. And stale counts are commoner than the sample showed:
  the readers found two, the rewriters found five.
- 2026-09-08: Step 2 finished and adversarially checked. Eleven defects came back
  across the six files and **seven were claims the rewrites added**, not text
  they lost; all are restored. The measured lesson and the corrected shape for
  step 3 are in [docs/text-content.md](../../docs/text-content.md), "What the
  pilot taught about running the pass", and indexed in SNAGS as
  `rewriter-marks-its-own-work`. The relocated history is recorded in the same
  document and in home's `chron/2026/09/2026-09-08-code-comment-census.md`,
  filtered against what a test or data file already holds.
  Step 3 is not started and should not start without the pairing above, or
  without first weighing the accuracy-only pass against it.
- 2026-09-10: Returned to the backlog. Steps 1 and 2 are on `main` (PR #625 here,
  home PR #605) and the owning branch `claude/code-comments-assessment-sqzvrz`
  merged on 2026-09-08, so the `in-progress` claim and its `session:` field
  outlived the work by two days and were the only stale claim on this board.
  Nothing about the task changed: step 3 is still unstarted, and the "Done when"
  clause it answers, whether the fan-out ran or the pilot showed it was not worth
  running, is still open. A session picking this up decides one thing first,
  weighing the accuracy-only pass (header contracts and stale figures, which the
  pilot found were most of the value) against the paired fan-out.
- 2026-09-17: Reframed to the residual only (size L to M). Folded
  `estate-js-commentary-read-mymt4u` in, taking the fold condition this task's
  Notes recorded on 2026-09-12: the same operation scoped to one file, tidier
  folded, held pending the owner's say-so. Its estate.js question and its
  do-not-use-token-overlap warning are carried above, and its exit condition is
  carried into "Done when" so the fold cannot swallow it.
- 2026-09-17: Rule home restamped after PR #634: `docs/CONVENTIONS.md` retired,
  conventions now in `CLAUDE.md`.
- 2026-09-18: Added ## Related (paths / sibling tasks / premise PRs).