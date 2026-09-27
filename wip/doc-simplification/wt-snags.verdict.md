# Verdicts: wt-snags

## 1. Cap every entry at the index shape, and make the cap a check

**Verdict:** revise

**Checked:** Word and line totals hold: docs/SNAGS.md is 2,350 lines, 24,926 words, 110 `### ` entries. Per-entry counts hold: median 176.5, p90 305, max 757 (`daisy-divide-paints-black`, SNAGS.md:1677-1753), 77 over 150. Cut-to-80 gives 13,766 and cut-to-60 gives 15,922, as stated. The recurrence figure is wrong. The generator itself prints "110 snags, 129 sightings, 22 seen more than once" (`node tools/build/snags-index.mjs --check`), and snags.csv has 70 rows at count 1, 18 at count 0 and 22 above 1. The proposal says 40.

I sampled twelve long entries against their `→` targets. The target holds the rule in five: `daisy-divide-paints-black` (skills/daisy-alpine/references/mechanics.md, Key Convention 7), `ci-run-silently-not-started` (.github/workflows/test.yml header), `touch-synthesises-a-hover` (lib/kits/session-export.js:399-462), `subtree-touch-guard-kills-the-anchor` (fab.js:89 `TAPPABLE`), and `use-ref-stale-bundle` (docs/loader.md:72, one hop from showing.md). In the other seven the entry carries facts the target lacks:
- `link-sha-not-resolved` (1202-1252): "re-run it for every link, on every commit" and "append nothing; use `--query`" are in no doc. SURFACING.md:51,57 has only `git rev-parse` and "paste the line".
- `x-data-scope-shadows-component-names` (1373-1400): neither docs/show-repo.md nor the daisy-alpine skill mentions that Alpine injects registered component names into `x-data` scope.
- `backtick-in-an-html-comment-ends-the-template` (923-960): not in docs/loader.md, as the reader noted.
- `derived-field-conflicts-per-branch` (2098-2143): the do-not-try note ("dropping the `words` column breaks the Map view's Docs tab") is not in scripts/derived-csv-merge.mjs or anywhere else.
- `shell-pin-kills-the-tab` (2294-2351): the list of eight withdrawn theories and two instrument defects exists only here, and docs/showing.md:63-65 defers to this entry for the measurement.
- `shallow-clone-has-no-merge-base` (839-867): its link `../skills/sandbox-traps/SKILL.md` (SNAGS.md:865) is dead. The skill lives at .claude/skills/sandbox-traps/SKILL.md.
- `mcp-body-escaping` (1852-1886): the entry's rule ("three query parameters get wrapped") is superseded by docs/surfacing-extended.md:54 ("150 characters or more is wrapped"). A mechanical cut would keep the stale rule.

So "the rule is already stated in the `→` target" holds for about half the sample. The cut is a migration first and a deletion second.

The format also does not match the proposal's assumed four-part shape. 18 entries have no `seen` line, 6 have no `→` line at all, and `csv-rewrite-restamps-every-line` uses `&rarr;` (SNAGS.md:400), which the parser's `^→ ` regex misses. 26 of 110 rows in docs/snags.csv have an empty `targets` cell. A length check alone would pass entries that have no date and no pointer.

Readers: nothing but tools/build/snags-index.mjs parses the prose. tools/test/snags-index.test.mjs uses fixtures plus one live-file test (entries > 25, all slugged, all titled), and a cap breaks neither. tools/test/derived-artifacts.test.mjs:92-94 runs `--check`, so a length rule added there would fail `npm test` and CI. The pre-commit leg (.githooks/pre-commit:257-260) runs the writer, not `--check`. Slug citations: headings kept, so they resolve. The home corpus at home/projects/text/passages.jsonl and the 2026-09-16 paragraph-rewrite run (home/projects/text/runs/2026-09-16-web-tools-paragraphs, 147 SNAGS.md drafts) are keyed by paragraph index and will go stale. That does not matter, but a rewriter could reuse those drafts.

The test at snags-index.test.mjs:60 is a fixture, not a separate parser path. `parse` collects every `*(seen: …)*` in an entry's range with one rule. Keep the test or turn it into a check that fails on a second seen line. Dropping it removes nothing from the parser.

**Revised proposal:** Do it in two steps. First, for each entry over 80 words, confirm that its `→` target holds the corrected move. Where the target lacks it, move the missing sentence into the target. This covers at least the six named above, and for `mcp-body-escaping` it means taking the target's newer rule, not the entry's. For `shell-pin-kills-the-tab`, move the investigation to a tracker task and link it. Second, cut each entry to its heading, one paragraph of at most 80 words, one `seen` line and one `→` line. Then extend `--check` into a shape gate, not only a length gate: every entry has a date line, a `→` line with at least one link, and a body of 80 words or fewer. shortcut-tools already runs this gate (shortcut-tools/test/snags-index.test.js:22-37). Merge `conflicted-pr-queues-no-ci` into `ci-run-silently-not-started` as proposed, with its date added to the seen line. Correct the rationale to 22 of 110 seen more than once.

**Corrected words removed:** About 12,000 from SNAGS.md, of which roughly 1,000 to 1,500 move into target docs. Net for the estate: about 11,000.

## 2. Collapse gated entries to a pointer at their gate

**Verdict:** revise

**Checked:** Every gate file named exists: dead-family, blank-icons, claude-mark, untracked-carriers, showing-pick, lib-parses, dead-opacity, fab-menu and derived-csv-merge tests are under tools/test/. The ten word counts match my per-entry counts: 757, 313, 124, 253, 368, 449, 176, 614, 172, 208, total 3,434. For `untracked-file-invisible-to-the-suite` the entry names a different gate (tools/test/text-vocabulary-conformance.test.mjs, SNAGS.md:1030). Both files exist and untracked-carriers.test.mjs cites the slug, so either works. Two of the ten do not fit the pattern:
- `shell-pin-kills-the-tab` (2294-2351) has a gate only for the link shape (showing-pick.test.mjs). The mechanism is open, and docs/showing.md:63-65 points readers here for the measurement. Collapsing it deletes the only record of eight ruled-out theories.
- `derived-field-conflicts-per-branch` (2098-2143) carries a negative result ("do not drop the `words` column; map.js weights reach bands by it"). The driver at scripts/derived-csv-merge.mjs does not record it, so the next session could try it again.

**Revised proposal:** Apply the one-sentence collapse to the other eight. For `derived-field-conflicts-per-branch`, keep the do-not-try sentence or move it into the driver's header comment. For `shell-pin-kills-the-tab`, move the investigation to a tracker task (or a dated record) before collapsing, and update docs/showing.md:65 to point there. As the reader says, this is proposal 1 at its tightest, so its words are not additive.

**Corrected words removed:** About 2,300 (the eight entries minus about 150 kept), inside proposal 1's total.

## 3. Retire entries whose subject is gone, and move the latent bug to its code

**Verdict:** keep

**Checked:** docs/CONVENTIONS.md, skills/state-the-rule, .claude/skills/markers and markers/ are all absent. The entries say the instruments were retired (SNAGS.md:1555-1560, 1987). Word counts: 225, 176, 196, 180. The bug is real. scripts/annotate/segment.py:23-25 masks `e.g.`, `i.e.`, `etc.` and `vs.` with one-character tokens, and `prose_units` (segment.py:38-58) computes offsets on the masked string. The comment there covers the list-marker guard but not the width problem. No live file cites the four slugs. Citations exist only in session indexes, the home passages corpus and the dated record home/chron/2026/09/2026-09-21-retiring-the-markers.md. One small note: the annotation tool still exists (scripts/annotate/, with reanchor.py), so the cost lesson in `annotated-document-resists-edits` could go as one line in reanchor.py's header. It does not need to stay in the log.

**Corrected words removed:** 777, less about 40 for the segment.py comment.

## 4. Cut the header from about 660 words to about 150

**Verdict:** keep

**Checked:** Span counts with wc -w: 1-6 is 61, 8-11 is 48, 13-16 is 54, 18-28 is 130, 30-37 is 103, 39-50 is 133, 52-58 is 94, 60-62 is 27. The spike tracker/tasks/spike-snags-log-gobdyq.md has `status: done`, `closed: 2026-09-04`, so the provisional note is false. The history in 18-50 repeats snags-index.mjs:18-47. No file quotes the header. The kept sentences at 4-5 and 15-16 ("a one-liner", "cannot drift") are false today and become true only after proposal 1. Order the two together.

**Corrected words removed:** About 460.

## 5. Shrink the generator and test comment essays to their contract

**Verdict:** keep

**Checked:** snags-index.mjs:1-56 is 589 words. The file has 101 comment lines out of 251. The test header (snags-index.test.mjs:1-19) is 199 words. The narrative claims match lines 18-24, 36-47 and 52-56. The comment above `parse` (the "until 2026-08-14 ... Eleven of them were migrated" block) is also narrative and fits the same cut. An open backlog task already covers this kind of trim: tracker/tasks/comment-trim-rule-first-b0o3bu.md, "Finish commentary trim". Do this under that task instead of as a separate edit.

**Corrected words removed:** About 550 in the generator (header plus the narrative part of the `parse` comment) and about 170 in the test.

## 6. After the cap, make snags.csv the source and render the log (optional, bolder)

**Verdict:** reject

**Checked:** docs/snags.csv is already under `merge=derived-csv` (.gitattributes:29). The driver takes "ours" on columns that docs/properties.csv marks `computed`, and all five snags columns are `computed` (properties.csv:164-168). Making the CSV authored means re-declaring those rows as `recorded`, changing registries.csv:29, and rewriting the driver's assumptions for this file. The driver also runs only in clones where setup registered it. A GitHub server-side merge or an MCP write never runs it, and those are the phone-side paths this log is appended from. `csv-rewrite-restamps-every-line` (SNAGS.md:385-400) shows a whole-file diff from one row edited through Python's csv writer. A CSV cell would also have to hold markdown links for the `→` targets and prose with commas and quotes. That is the escaping surface the header rejects. Other readers are prose-shaped: lib/alpineComponents/estate.js:284 routes a `snag` jot to docs/SNAGS.md "in the repo the trip belongs to", and shortcut-tools runs the same markdown shape with its own generator. A CSV source in web-tools alone would split the estate's one snag format in two. The gain is about 150 lines of parser. The parser has been stable since 2026-08-26, and a shape gate (proposal 1, revised) removes its remaining miscount risk.

**Corrected words removed:** 0. Moving words from authored to generated does not remove them.

## 7. shortcut-tools: stop printing each entry twice

**Verdict:** revise

**Checked:** The duplication is real. shortcut-tools/tools/snags-index.py:35-58 takes the first non-empty body line as `summary`, and each entry is one line, so each table cell is the whole entry. The index block is 717 words and the entries 788. The cells alone are 562 words. The suite holds the file with shortcut-tools/test/snags-index.test.js:15-19 (`--check`) and :22-37 (entry shape). The "Backfilled 2026-09-14" paragraph is 35 words. The second option, deleting entry bodies, removes the generator's source, since the table is built from the bodies. The first option needs a title that entries do not carry (headings are bare `## slug`, snags-index.py:38).

**Revised proposal:** In `entries()`, take the summary as the first sentence of the body line, not the whole line. That is a one-line change and needs no format change. Trim the backfill paragraph to one clause. If a shorter cell is wanted later, add `## slug: title` headings as web-tools does and update the heading regex at snags-index.py:38 and test/snags-index.test.js:31,42 together.

**Corrected words removed:** About 260 (230 from first-sentence cells, 30 from the backfill paragraph).

## 8. Keep one copy of `app-frame-outruns-the-inliner`

**Verdict:** revise

**Checked:** SNAGS.md:274-298 (258 words) and the home CLAUDE.md block carry the same figures (46 files, 9,692,313 bytes, 6 files and 1.8 MB) and the same console expression. The home block, from "The exception is observed" to "loses its exception", is 310 words by wc -w, not the 350 the proposal implies. The home-contract slice already proposes replacing that block with two sentences citing this slug (wip/doc-simplification/home-contract.md:13), and the budget-drs view README holds a third copy of the inliner mechanics (lines 252-262, per that file). So this proposal repeats home-contract's.

**Revised proposal:** Drop it from this slice and leave it to home-contract. On the web-tools side, cap the entry under proposal 1, and keep the console line, since the entry is where the open diagnosis lives.

**Corrected words removed:** 0 additional. About 270 are already counted in home-contract.

## Missed

**Merge debris inside the entries.** Three stray index-table rows and two stray `[//]: # (/snags-index)` closing markers sit inside entries at SNAGS.md:733-735 and 903-906. They are rows for `shell-pin-kills-the-tab`, `line-clamp-is-not-a-height` and `safari-button-sizes-from-unclipped-content`, left by merges of the generated block. The generator replaces only the first OPEN to first CLOSE span (snags-index.mjs, `md.indexOf(CLOSE)`) and parses from the first CLOSE, so the debris never regenerates and nothing reports it. On GitHub it renders as literal pipe text at the end of two entries. Fix: delete five lines, and have `--check` fail when CLOSE appears more than once. That is a check on the one shape a merge of a generated block produces.

**The log has no shape gate, and the recurrence rule cannot see a sixth of it.** 18 entries have no `seen` line, so the header's rule "an entry tracks how often it bit" counts them as zero. 6 have no `→`, one uses `&rarr;` (SNAGS.md:400), and 26 of 110 snags.csv rows have no target. shortcut-tools already enforces seen plus `→` per entry (test/snags-index.test.js:22-37). Port that test, and backfill the 18 dates from `git log -S'### <slug>' -- docs/SNAGS.md`. That command works in this shallow clone: `tick-count-guesses-a-chain` and `shell-pin-kills-the-tab` both resolve to 2026-09-20. This is small and mechanical, and it is the precondition proposal 1's cap needs.

**Stale entries are worse than long ones.** `mcp-body-escaping` states a rule that surfacing-extended.md:54 has replaced, and `shallow-clone-has-no-merge-base` links a path that does not exist. A dead-link pass over SNAGS.md (all links, not only the `^→` lines the parser reads) is cheaper than the rewrite and should run first.

**Near-duplicates the generator already names.** Every run prints 8 slug pairs (for example `shot-of-a-prebuilt-page-ignores-lib`, `use-swaps-the-lib-not-the-page` and `page-skips-the-loader-ignores-use`). I read their openings and they are distinct trips in one family, not repeats, so I claim no merge. The rewrite pass should settle each pair once, though. Otherwise the advisory warning prints the same eight lines on every commit and teaches readers to ignore it.
