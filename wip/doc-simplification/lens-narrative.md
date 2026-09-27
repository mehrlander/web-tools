# Lens: history in living docs

## Summary

Living guidance across the four repos carries a large layer of incident narrative: what a session did on a date, what a sentence used to say, how a measurement was taken, and why a paragraph exists. Most of it sits beside a rule that would stand without it. home already decided on 2026-09-21 that git holds what a sentence used to say ([`chron/2026/09/2026-09-21-retiring-the-markers.md`](../../../home/chron/2026/09/2026-09-21-retiring-the-markers.md)). The same logic applies to justification by anecdote: the rule belongs in the living doc, and the story belongs in git, a snag entry, or a chron record that already exists.

**Estimate: about 20,000 words of embedded history in living docs, out of roughly 1.0 million living words.** Method. A script walked every `.md` in the four repos, excluding `chron/`, `archive/`, tracker task files, `data/source/`, assignments, probes, runs, `wip/`, dated-filename records, `SNAGS.md`, `LOG.md` and generated indexes. It split each file into blank-line paragraphs and flagged any paragraph matching a narrative pattern (`until 20YY-`, `since 20YY-`, `on 20YY-MM-DD`, `measured 20YY`, `Wrong 20YY`, `used to (say|read|be|carry|live)`, `this section said`, `which is why this`, `a session (did|reasoned|shipped)`, `happened again`, `were retired`). Flagged paragraphs totalled 61,056 words: web-tools 13,610, home 34,602, shortcut-tools 10,842, web-tools-private 2,002. Two outliers inflate that: home's `projects/budget-drs/app/workshop/DECISIONS.md` (8,224 flagged of 8,285) is a decision log and legitimately historical, and `shortcut-tools/workflows/README.md` is one giant table, so each row counts as one paragraph. Without them the total is about 44,600 words in 404 prose paragraphs. A seeded random sample of eight flagged paragraphs read at 30 to 50 percent history by word, the rest being the rule the history props up. That gives 13,000 to 22,000 words, before counting unflagged history that uses no dated phrase. The ten proposals below target about 6,500 words of it, concentrated where it costs most: the three `CLAUDE.md` files that load into every session.

**The distinction applied throughout.** History that carries a live rule gets collapsed: keep the rule, drop the story, link the record if one exists. History that carries nothing gets deleted. Measurement stamps on volatile environment facts (`docs/environment/*.md`, the format notes' `*Measured …*` provenance lines) are not targeted: a date on a sandbox fact tells the reader how stale the fact may be, which is a live property. The target is the narrative of how the doc came to say what it says.

**A caution from inside the estate.** web-tools' own pilot of this kind of cut found that "a fast pass takes the load-bearing clause with the story around it," and that seven of eleven defects in a history-stripping rewrite were claims the rewrite added ([`web-tools/docs/text-content.md:576-582`](../../docs/text-content.md) and `:689-700`). Each proposal below names the clause that must survive.

## 1. Retire the `Wrong` blocks in shortcut-tools, and fix the live contradiction two of them preserve

**Repos:** shortcut-tools

**Targets:** `CLAUDE.md:138-145`; `workflows/README.md:452-465` (the "Take the offer" paragraph and its `Wrong 2026-08-15` block), `:480-483`, and the `Wrong` clauses inside table rows at `:65`, `:82`, `:97`; `docs/shortcuts-format-notes.md:436-441`, `:537-542`, `:1608-1614`; `docs/idioms.md:157-161`.

**Kind:** delete, plus one correction.

**Proposal:** Delete every `**Wrong YYYY-MM-DD → …**` block and fold any fact it still carries into the sentence it corrects. Specifically: in `shortcuts-format-notes.md:436`, the corrected sentence should just say the sheet blocks the next action until dismissed, citing `Probe-SheetBlocks`; at `:537`, state that the sheet's `WKWebView` has its own data store, so a Safari token is absent; at `:1608`, move "`Find Apps` is Mac-only; there is no route to the installed-app list on iOS" into the heading paragraph. In `idioms.md:157`, open section 5 with the narrower claim ("54 of the 79 menu files are imported; only 8 are core") and drop the first-draft story. In `workflows/README.md:452-465`, replace both paragraphs with: "Importing over a name the library holds leaves two copies, and the original keeps the index. Replace through `Library-Replace`; see `CLAUDE.md`."

**Rationale:** home retired this exact form on 2026-09-21 because a marker on a living doc is the wrong place for a correction. shortcut-tools never adopted the retirement and still writes the arrow grammar. Worse, the form hid a live contradiction. `workflows/README.md:452-458` still tells the reader to take Apple's save-over offer and says "Nothing has to be deleted first," and its `Wrong 2026-08-15` block defends that reading. `CLAUDE.md:117-130` says the opposite: importing over a name leaves both copies, and a replace must go through `Library-Replace`. `CLAUDE.md:138-145` is a `Wrong 2026-08-26` block about that very disagreement. The README's own block even names the cause ("the cost of stating one rule in two places") and then kept the second statement.

**Evidence:** 10 `Wrong` blocks found by `grep -rnE '\*\*Wrong( until)? 20'` across the four repos' living docs; 9 are in shortcut-tools, 1 in `web-tools/scripts/annotate/LOG.md:384` (a log, left alone).

**Words removed:** about 850 across the nine blocks (94 + 67 + 95 + 65 + 82 + 86 + 62, plus about 300 in the three table rows), less about 120 folded back as corrected sentences. Net about 730.

**Inbound dependencies:** `shortcut-tools/docs/SNAGS.md` entries point by `→` at documents, not at `Wrong` blocks. No check parses the blocks. The `Library-Replace` row at `workflows/README.md:96` already states the correct rule and survives.

**Risk:** Low. The one judgment call is the format-notes `[!WARNING]` at `:1608`, which currently guards a section whose body argues the wrong conclusion; the fold must land above that body or the section reads as a recommendation again.

## 2. Collapse home's render-path investigation to the rule and a snag link

**Repos:** home

**Targets:** `home/CLAUDE.md:149-151` ("This replaced a paragraph…"), `:153-181` (the observed exception, the 46 files and 9,692,313 bytes, the two candidates, the console line, "Meanwhile…"), `:184-196` ("Two former limits, and neither holds now"), `:198-202` (`appendix-render`), and the dates inside `:204-215` ("2026-09-02", "since 2026-09-11", "2026-09-10", "which is what `?piece=` cost").

**Kind:** collapse.

**Proposal:** Replace `:153-181` with one sentence: "Until [`app-frame-outruns-the-inliner`](https://github.com/mehrlander/web-tools/blob/main/docs/SNAGS.md#app-frame-outruns-the-inliner-the-shell-draws-and-every-view-is-empty) is resolved, the app route renders an empty pane for this private repo: hand over the framed page on its own, addressed with `#pkg=<id>`, and say the app route is the broken one." Replace `:184-196` with: "`?tab=` reaches a framed page's own tabs, and `tools/screenshot.mjs` can shoot a framed view headless." Delete `:149-151` and `:198-202`. Keep the `SUBMITTAL_OPEN` param list in `:204-215` without its dates.

**Rationale:** The exception paragraph is a debugging session transcribed into the contract. Its figures, its two candidate causes and its console one-liner already appear nearly word for word in web-tools `docs/SNAGS.md:274-297`, which is the store the estate designates for trips. So this is a second copy of a claim with an owner, in the file that loads into every home session. "Two former limits, and neither holds now" is by its own words about limits that no longer exist; the present-tense capability is one clause. `appendix-render` "stays a gated skip … for its own reasons rather than this one" answers a question no reader of the render rule asks. The dates inside the param list record when each rung was built, which git blame on `renderSubmittal` already holds.

**Evidence:** Word counts by `sed -n | wc -w`: `:153-181` 310, `:184-197` 159, `:198-203` 57, `:149-152` 36, dated clauses in `:204-218` about 30. The SNAGS entry's text at `web-tools/docs/SNAGS.md:280-293` repeats "46", "9,692,313 bytes", "6 files and 1.8 MB", the `data-inline-error` console line, and "hand over the framed page on its own."

**Words removed:** about 550 of 592, net of the two replacement sentences (about 60 words).

**Inbound dependencies:** The paragraph says itself that "when the cause is known … this paragraph goes." The collapse makes that removal a one-sentence edit instead of a 310-word one. `showing.py` does not read the prose.

**Risk:** Low to medium. The console one-liner is a live diagnostic step; it survives in the snag entry, which is one link away. If owner sessions habitually act from `CLAUDE.md` without following links, keep the one-liner as a second sentence.

## 3. Strip the incident stories out of shortcut-tools `CLAUDE.md`, keeping every rule

**Repos:** shortcut-tools

**Targets:** `shortcut-tools/CLAUDE.md` at `:34-42` (the table "had it the other way round until 2026-09-14" plus the owner quote), `:50-54` (rung 0's "On 2026-09-14 a session reasoned…"), `:199-201` ("which is how a 21-action chain was hand-built on 2026-09-03"), `:237-244` ("The reason this needed fixing on 2026-08-27 is worth more than the fix"), `:253-274` (the `Back-DoubleTap` and `Repo-Viewer` case), `:303-308` (the `Get-ShortcutJson` story), `:320`/`:325-326` ("hid four names until 2026-09-14", "Four live targets were therefore invisible"), `:344-347` ("That asymmetry cost this session hours"), `:373-374` ("Getting this by hand cost a checkout…"), `:414-421` (the "Come on" exchange), `:445-449` ("This is why `Probe-Step` was not enough").

**Kind:** collapse.

**Proposal:** Keep each bold rule and its operational sentences; delete the story that follows it. Four examples of the surviving form:
- `:34-42` becomes: "**Running is cheap and installing is dear.** A repeat is fine; a repeat that asks for an observation each time is not (rule 5)."
- `:253-274` becomes the existing `:276-279` alone: "A stale by-name target is resolved by asking what the library *has* that does the job, not by recovering what the name used to mean; a rename leaves no record on the device."
- `:237-244` becomes: "Where two checks state one invariant, the cheaper one must not be weaker: `--check` reports an orphan in the same breath as a stale file."
- `:414-421` becomes: "This is judgment and stays prose: no check can read a question and tell whether the repo holds its answer."

**Rationale:** The file's rules are strong and short. The stories double its length around them and are already filed where the estate files trips: `docs/SNAGS.md` carries `install-shipped-where-a-tap-would-do` (the `:34-42` story), `corpus-not-searched-before-asking` x3 (the `:50-54` story, naming `Check-🎟️GitHubToken`), `success-asserted-without-reading-the-log` x4 (the `:344-347` and `:414-421` family), and `gate-narrower-than-its-own-claim`. The SNAGS header says a trip "goes there rather than into a narrative paragraph" (`CLAUDE.md:~390`), so `CLAUDE.md` is breaking its own rule in these paragraphs. The owner quote at `:36-38` is the most persuasive sentence in the file and is still a quote about one afternoon; the rule it produced is the table row.

**Evidence:** `sed -n | wc -w` per span: 121, 106, 90, 119, 285, 78, 93, 102, 62, 111, 57. The history share of each, read by hand: 90, 70, 50, 80, 240, 50, 40, 50, 30, 90, 57. The file is 4,561 words.

**Words removed:** about 850, about 19 percent of the file.

**Inbound dependencies:** SNAGS entries link to `CLAUDE.md` as a document, not to these paragraphs. The name-audit Python snippet and the `#BUILD#` rules are untouched. `workflows/README.md` and `docs/idioms.md` cite `CLAUDE.md` sections by heading, and every heading survives.

**Risk:** Medium. This repo's rules are unusual (running beats installing, a probe must return itself), and the stories are what made past sessions believe them. The mitigation is that each collapsed rule gets the snag slug in parentheses, so the evidence is one click away rather than gone.
