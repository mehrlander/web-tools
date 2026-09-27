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

**Rationale:** The file's rules are strong and short. The stories double its length around them and are already filed where the estate files trips: `docs/SNAGS.md` carries `install-shipped-where-a-tap-would-do` (the `:34-42` story), `corpus-not-searched-before-asking` x3 (the `:50-54` story, naming `Check-🎟️GitHubToken`), `success-asserted-without-reading-the-log` x4 (the `:344-347` and `:414-421` family), and `gate-narrower-than-its-own-claim`. The SNAGS header says a trip "goes there rather than into a narrative paragraph" (`CLAUDE.md:383-384`), so `CLAUDE.md` is breaking its own rule in these paragraphs. The owner quote at `:36-38` is the most persuasive sentence in the file and is still a quote about one afternoon; the rule it produced is the table row.

**Evidence:** `sed -n | wc -w` per span: 121, 106, 90, 119, 285, 78, 93, 102, 62, 111, 57. The history share of each, read by hand: 90, 70, 50, 80, 240, 50, 40, 50, 30, 90, 57. The file is 4,561 words.

**Words removed:** about 850, about 19 percent of the file.

**Inbound dependencies:** SNAGS entries link to `CLAUDE.md` as a document, not to these paragraphs. The name-audit Python snippet and the `#BUILD#` rules are untouched. `workflows/README.md` and `docs/idioms.md` cite `CLAUDE.md` sections by heading, and every heading survives.

**Risk:** Medium. This repo's rules are unusual (running beats installing, a probe must return itself), and the stories are what made past sessions believe them. The mitigation is that each collapsed rule gets the snag slug in parentheses, so the evidence is one click away rather than gone.

## 4. Cut the retirement notices and origin stories from home's Working style and Conventions

**Repos:** home

**Targets:** `home/CLAUDE.md:20-29` (the parenthetical "Two earlier channels are retired…"), `:30` (the parenthetical "The rules lived in `docs/HTML-STYLE.md` until 2026-08-31…"), `:32` ("Naming only the first is how a page … happened three times…"), `:73` ("as of 2026-07-05" in the `seam` sentence), `:74` (from "A label at the head of a paragraph…" through "The measured case for retiring them…"), `:76` ("The `record` key is gone with the markers; it existed only to license a `Wrong` banner."), `:91` (the parenthetical "Reusable prompt templates lived in a top-level `prompts/` folder until 2026-09-05…").

**Kind:** collapse.

**Proposal:** Delete each parenthetical and origin sentence; keep the rule and, where one exists, the record link. The `:20-29` parenthetical becomes: "Earlier channels are retired; see [`chron/2026/08/2026-08-26-the-injection-delivers-five-percent.md`](../../../home/chron/2026/08/2026-08-26-the-injection-delivers-five-percent.md)." The status-marker bullet at `:74` ends after "…link the successor, with the date inside the sentence. No dated lead-in replaces the markers. Record: `chron/2026/09/2026-09-21-retiring-the-markers.md`." The `seam` sentence keeps "The umbrella word `seam` is retired from living prose" and drops the date, since `tools/lint-conventions.py` enforces it and carries the list.

**Rationale:** These are the retired-convention explanations the lens names. Each tells a reader where a rule used to live or how it came to be, which a reader following the rule does not need. The HTML-STYLE path is a pointer file that still exists for search, so the parenthetical adds nothing a search does not already find. The stat-card story is the snag `house-style-not-consulted` (web-tools `docs/SNAGS.md:93`, x2), which the sentence itself cites. The markers bullet is the sharpest case: it retires annotation-as-history and then spends 105 words on the history of the retirement, including "the measured case" and the reasoning against a replacement label, both of which its own record link says live in the record's "What the audit found" section.

**Evidence:** Word counts: `:20-29` 87; the `:30` parenthetical 22; `:32` about 60; `:74` from "A label at the head" 105; `:76` 17; the `:91` parenthetical 28; date clause in `:73` 5.

**Words removed:** about 300, net of about 25 words of replacement.

**Inbound dependencies:** The Working style bullet's claim "one visibly wrong reply beats a silent channel" is the live rule and stays. `tools/lint-conventions.py` reads its retired-terms list from code, not from this prose.

**Risk:** Low. Every dropped passage either points at a record that exists (both chron files were checked present) or duplicates a snag.

## 5. One sentence for the delivery rule in all three `CLAUDE.md` files, and no story of the import cut

**Repos:** web-tools, home, shortcut-tools

**Targets:** `web-tools/CLAUDE.md:5` (sentences 1b, 3 and 4: "This file `@`-imported both documents until 2026-09-12…", "The import was not part of the plugin…", "Two channels for one contract…"), `:13` ("This section used to be 1,589 words, 63% of this file…"), `:17-19` ("It happened again on 2026-08-22… which is why the last rule this section stated in prose is now executable"), `:30` ("turned on 2026-07-10", "a session predating the toggle…", "the toggle was probed not to fire retroactively"); `shortcut-tools/CLAUDE.md:9-11` ("A web-tools checkout is not delivery and has not been since 2026-09-12, when that repo cut the `@`-import that used to make it one."); the matching parenthetical in `home/CLAUDE.md:20-29` is counted in proposal 4.

**Kind:** collapse.

**Proposal:** In all three files the delivery statement becomes: "The portable conventions arrive through the `portable` plugin: its `invoke-default` hook prompts `/portable:default` at session start. If they are missing, the prompt failed; say so rather than working around it." web-tools `:13` ends at "…render in the app's **Map view, Showing tab**." web-tools `:17-19` becomes "**Do not decide it by reading. Run it:** `npm run showing` …" with the 2026-08-22 clause dropped. web-tools `:30` becomes: "Draft PRs are created automatically on first push. A session in an added repo opens the draft itself via the GitHub MCP."

**Rationale:** The 2026-09-12 import cut is told three times, once per repo, each with its own argument ("the hub was the one place that could not notice the prod failing"). That argument was the reason to cut the import; it is not something a session needs in order to load the conventions. Telling it three times is also the pattern it complains about: several copies of a statement that has an owner. The owner is web-tools PR #652, which home already cites. The "1,589 words, 63%" and "happened again on 2026-08-22" sentences argue for a decision already made; the executable `npm run showing` is the rule, and the snag `showing-answers-commits-only` (web-tools `docs/SNAGS.md:134`, 2026-08-22) holds the incident. The draft-PR clause about sessions that predate 2026-07-10 describes sessions that cannot exist now, eleven weeks later.

**Evidence:** Sentence word counts from splitting `web-tools/CLAUDE.md:5`: 13 of 19, 48, and 17 are history. `:13` about 30, `:17-19` about 30, `:30` about 35 of 92. `shortcut-tools/CLAUDE.md:9-11` about 30.

**Words removed:** about 200 across web-tools and shortcut-tools (the home share is in proposal 4). web-tools `CLAUDE.md` drops from 1,497 to about 1,330 words.

**Inbound dependencies:** None found. The `invoke-default` hook prints its own directive and does not read these files.

**Risk:** Low. The "if missing, the prod is broken" clause is the one live instruction in these passages, and it survives.

## 6. Finish the marker retirement: delete the notices it left behind, and the live instructions that still name it

**Repos:** web-tools, home

**Targets:** `web-tools/CLAUDE.md:5` ("run `/markers` before marking or editing near frozen areas"); `web-tools/tools/build/docs-readme.mjs:51`, which generates `web-tools/docs/README.md:8-10` ("A **record** preserves a moment and is corrected by markers, never rewritten"); `web-tools/docs/estate-span.md:36-49` (the `.paths.json` table row note and the paragraph "The declarations were 2, in 2 repos … until 2026-09-20 retired the `Frozen` marker word…"); `home/README.md:123` (the `stale-flags.sh` row: "retired 2026-07-29 … `/markers` … inventories every `Frozen`/`Stale`/`Wrong` marker"); `home/tools/README.md:43` ("Status markers are retired (2026-09-21). Nothing here inventories them…").

**Kind:** delete (three notices) and correct (two stale instructions).

**Proposal:** Delete the `/markers` clause from web-tools' four one-line defaults. Change the generator string to "A **record** preserves a moment and is not rewritten; a later correction is an ordinary sentence that links its successor," and regenerate. Delete `home/README.md:123` and `home/tools/README.md:43` outright: a tools inventory lists tools, and neither row names one. In `estate-span.md`, drop the chronology paragraph and state the current count: "`.paths.json` declarations: home (budget-drs), chat-histories, web-tools-private; the hub carries none."

**Rationale:** Per `web-tools/docs/estate-span.md:40-42`, the markers skill and `status.py` were retired on 2026-09-21, and `ls .claude/skills/markers` confirms the skill is gone. Yet web-tools' `CLAUDE.md`, which loads every session, still tells a session to run it, and the generated docs index still defines a doc class by the correction mechanism that no longer exists. Those two are live defects, not history. The other three are the retired-convention explanations the lens targets: rows whose only content is that something was retired, which the retiring commit already records. The estate-span paragraph walks through three dates in six lines to arrive at a count the table beside it states.

**Evidence:** `grep -rln '/markers\|markers skill'` over living docs returns web-tools `CLAUDE.md`, `docs/estate-span.md`, `docs/envelopes/approval.md` (a worked example, left alone) and home `README.md`. `docs-readme.mjs:51` holds the "corrected by markers" string. Word counts: `home/README.md:123` 63, `home/tools/README.md:43` 56, `estate-span.md:38-49` about 110, the `/markers` clause about 10.

**Words removed:** about 240.

**Inbound dependencies:** `docs/README.md` is generated, so the edit is to `docs-readme.mjs` and `derived-artifacts.test.mjs` will require the regenerated file in the same commit. Two living docs still carry `Stale` banners, e.g. `web-tools/docs/github/mcp-server-routing.md:6` and `:32`; that file is classed `record` in `docs/docs.csv:47`, so its banners are allowed history under the new wording and need no edit.

**Risk:** Low. The only judgment is whether web-tools means to keep a successor to `/markers` for frozen areas; if so, the default should name it, and if not, the clause goes.

## 7. Reduce web-tools `APP.md`'s name-split section to the rule and the current list

**Repos:** web-tools

**Targets:** `web-tools/docs/APP.md:24-35` ("The route registry was on that list and never belonged there … Corrected the same day…"), `:38-39` ("Reading it as reader-facing … was proposed in this session and withdrawn…"), `:42-49` ("This sentence used to claim … The route registry above is the third correction of the same kind…"), `:57-62` ("The version of this passage written on 2026-08-27 said…"), `:64-83` ("a session used the internal name in a reply on 2026-08-27 … That count of two was wrong … Recounted 2026-09-08"), `:88-96` ("This doc first ruled … This sentence used to list the component name here…").

**Kind:** collapse.

**Proposal:** Keep four statements and the current holders list. (1) "A name is kept because it is accurate or because someone outside holds it; never because renaming is expensive." (2) "Anything a reader meets takes **Web Tools**: chat replies, captions, PR bodies, and commit messages the app writes (`via Web Tools`)." (3) "Identifiers that are still true keep **show-repo**: `?view=` keys, registry keys, the tracker tag, `/show-repo`." (4) "The address moved to `app/index.html`; the stub's path stays because 151 files and saved links hold it." Delete the correction narratives around them.

**Rationale:** `APP.md` is the product frame: "mission, goals, and the name split" (`web-tools/CLAUDE.md:9`). About half of its name-split section is the story of this section being wrong: "This sentence used to claim", "the third correction of the same kind", "The version of this passage written on 2026-08-27 said", "That count of two was wrong", "Recounted 2026-09-08". The section argues well that a list of holders goes wrong by not being recounted, and then keeps the history of each miscount rather than a recount method. Git holds the old versions, and the rule "an inaccurate name is a defect at any price" survives as one sentence.

**Evidence:** `sed -n | wc -w`: `:24-35` about 110, `:38-39` 28, `:42-49` 114, `:57-62` 75, `:64-83` 246, `:88-96` 115. About 690 words, against a file of 1,437. The figures 1,022 occurrences, 608 commits, 584/23/1 by repo, and "twenty-four string literals across six files" are measurements of a finished migration.

**Words removed:** about 550, net of about 110 words of rule.

**Inbound dependencies:** No `APP.md#anchor` links found by grep. `docs/docs.csv` describes the file as "mission, durable goals, and the name split," which still holds.

**Risk:** Medium. The "strings in code, not only prose" lesson (`:79-81`) is a real method point for any future name audit. Keep it as one clause of statement (2): "count strings in code as well as prose."
