---
id: comment-trim-rule-first-b0o3bu
title: Trim code commentary to its criterion, rule first
status: in-progress
opened: 2026-09-08
size: L
session: claude/code-comments-assessment-sqzvrz
---
# Trim code commentary to its criterion, rule first

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
- **Fan out.** One agent per file over the heaviest twenty or so files per repo,
  ranked by comment mass. Exclude `archive/`, `dist/`, vendored skill scripts,
  generated payloads, and the paths frozen in home's
  `projects/budget-drs/.paths.json`. Use the stronger model: the expensive
  failure is a lost criterion, not a wasted word.

## Done when
The rule is stated where the conventions live, the six pilot files are rewritten
and adversarially checked, and either the fan-out has run or the pilot has shown
it is not worth running, said in one line here.

## Notes
`estate-js-commentary-read-mymt4u` is this same operation scoped to one file,
filed 2026-08-10 before the census existed. Folding it into this task's fan-out
step would be the tidier shape, but that is a reframing and needs the owner's
say-so, so both stand until then.

The trap the pilot must not fall into: the criterion is often the middle
sentence of a paragraph rather than the first, and the ALL-CAPS lead-in this
codebase favors reliably marks a keepable criterion rather than noise. A pass
that trims on tone or on position cuts the load-bearing half.

## Progress log
- 2026-09-08: Filed out of the census and the six-file read. Nothing trimmed
  yet; the session recorded findings only. `embedded-prose.py --dated` was added
  in the same pass and reports the dated-claim class (324 blocks in 69 files
  here, 408 in 157 in home), which is one of the two defects the read found. The
  other, a file header drifting from the code, has no mechanical report and is
  logged as `header-essay-outlives-its-code` in SNAGS.
- 2026-09-08: Steps 1 and 2 done on `claude/code-comments-assessment-sqzvrz`
  (web-tools PR #625, home PR #605). The rule is in `docs/CONVENTIONS.md` under
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
