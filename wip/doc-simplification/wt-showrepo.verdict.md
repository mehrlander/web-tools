# Verdicts: wt-showrepo

Shingle claims re-run with the reader's own scripts (`scratchpad/shingle.py`, `scratchpad/para.py`) against the current tree. Whole-doc coverage reproduces exactly: stage.md 28%, branch-overlay.md 22%, manifest.md 21%, show-repo.md 5%, APP.md 1%. Flagged-paragraph totals reproduce: stage.md 2,216 words, branch-overlay.md 1,546, manifest.md 1,605. File sizes reproduce (25,497 words across the five). The overlap is verbatim 8-word runs, so it proves a copy exists; it does not prove the other 70 to 80% is held anywhere.

## 1. Rewrite stage.md's bench section as a behavior reference

**Verdict:** revise

**Checked:** `docs/stage.md:1-512` is 5,751 words. The Save contradiction is real: stage.md:15 says "The stage does not save" and stage.md:505 describes "the pin on the Staged header, opening the dialog above". No dialog precedes it (the only "dialog" hits are stage.md:50 and :317, both unrelated). stage.js has no save control besides "Save note" (stage.js:1870). The two kept tables exist at stage.md:254-258 and :360-364. `npm run test:reader-height` exists (package.json:80), and `StageIntake.takeClipboard` exists (stage.js:835, :3312). The retired-alias sentence is correct against show-repo.md:31. The envelope-field rule at stage.md:34-38 is already owned by envelopes/surface.md:312, so it can go. docs.csv:77 still says "bench and Saved ... save-as-surface". Inbound list checked; nothing reads the content.

**Revised proposal:** Split it in two. First, a separate small edit now: delete the Save bullet (stage.md:505-509), and fix every other stale "save" claim in the same commit: docs.csv:77 (docs/README.md:69 regenerates from it), `.claude/skills/show-repo/SKILL.md:48` ("save-as-surface"), APP.md:123 ("save a surface"), and the component description at stage.js:1098 ("one send/save/mint deposit"), which the Map view renders. Second, the rewrite, gated on an inventory rather than a word target. The shingle test finds only about 40% of the section verbatim in code, so the remaining 60% needs a line-by-line pass that sorts each behavior into kept, already at its code, or dropped. The reader's heading list omits some behavior that must survive, for example "a form field keeps its native paste untouched, ticks nothing, and still names what it could not hold" (stage.md:57-58) and the subject-channel rule that a local item announces `local` plus its label (stage.md:461-466). Name the target as "whatever the inventory leaves", with 1,000 words as an expectation, not a commitment.

**Corrected words removed:** about 4,750 at the stated 1,000-word target; unproven until the inventory is done. The Save fix alone removes about 90.

## 2. Rewrite branch-overlay.md as a reference and fix its stale addresses

**Verdict:** revise

**Checked:** Section word counts reproduce exactly (722, 2,406, 3,039, 923, 193). Stale items confirmed: `show-repo.html?overlay=` at branch-overlay.md:12 and :70 (it still works through the redirect stub at pages/show-repo/show-repo.html, which preserves query and hash, but the doc should name `app/`); `?view=activity&detail=` at :100 and :103, which now lands on Sessions (show-repo.md:31); "Guide pane", "the tab", "Files or Commits", "The Files tab" at :257-262, :372, :393, against the scroll at :156-162; "frame vocabulary above" at :651 and "Inbox and outbox below" at :662, neither in this doc (Inbox and outbox is manifest.md:280). One claimed defect is not stale: line 82 "the Activity view's Open list" names a live nav stop, since app-routes.csv:11 puts Branches under the Activity stop and views/branches.md:3 says "a pane of the Activity stop". It should read "the Branches view's Open scope", but it does not send a reader to a dead route. forms/branch.md:12-13 (not :11) carries the pointer.

**Two dependencies the reader missed.** `docs/text-content.md:642-643` says the slide-retention DOM counts are held by `swipe-deck-stack.test.mjs` and branch-overlay.md. The rewrite cuts that passage (branch-overlay.md:345-357). The test also holds the counts (swipe-deck-stack.test.mjs:155-157), so the cut is safe, but text-content.md must drop its branch-overlay.md citation in the same commit. And the SNAGS pointer is already hollow: `viewport-rule-blind-to-a-docked-pane` (SNAGS.md:1159-1171, snags.csv:63) points to branch-overlay.md for a `@container` fix, and branch-overlay.md contains no `@container` or docked-pane text at all. The rewrite should retarget that pointer to wherever the Docs tab's container rule lives, not "check the anchor".

**Revised proposal:** As written, with line 82 reworded rather than listed as stale, text-content.md:643 updated, and the snag pointer retargeted. The move of section (b) into forms/branch.md is sound.

**Corrected words removed:** about 6,000 (7,283 to about 1,300), confirmed.

## 3. Take the repo menu and Proposals out of the manifest doc

**Verdict:** keep

**Checked:** Section ranges and counts reproduce: Proposals manifest.md:363-557 is 2,044 words, the repo menu 558-672 is 1,280. app-routes.csv:22 names `docs/manifest.md` as the `proposals` doc; no manifest-fields.csv row concerns proposals. Overlap reproduces: 566-577 at 82%, 591-597 at 85%, 653-658 at 87%. I checked the one history that could break this: text-content.md:175-185 once found the repo-menu rationale unique and absent from code. That has since changed; the sentences "tapping the row itself opens the repo", "three lines down" and "Nothing expands, so nothing carries a chevron" are now at app/index.html:5034-5038, :5156 and :5165. views/estate.md:26-28 already covers the repo dialog. The routes test answers the reader's open question: tools/test/app-routes.test.mjs:462-472 requires every named doc to exist and every file in docs/views/ to be named by a row, so the new file and the app-routes row must land together, which the proposal already says. No inbound anchor links to `#proposals` or `#the-repo-menu` were found in any of the four repos.

**Corrected words removed:** about 2,470 (1,130 plus 1,344), confirmed.

## 4. Stop restating manifest-fields.csv in manifest.md's opening

**Verdict:** revise

**Checked:** `docs/manifest.json` does not exist, and manifest.md:88 links it. The other lines are also stale in a way the reader did not note: manifest.md:22-23 says "There are 46" rows, and manifest-fields.csv now has 75. The `landing` and `pages` rows (manifest-fields.csv:9-10) do carry manifest.md:122-125. The `links` paragraph (176-187) is not held by the `links` row alone, but its extra behavior is held elsewhere: the desktop-only rail at show-repo.md:50, and the snippet skip at app/index.html:1965 and :2826. The `hidden` row (manifest-fields.csv:58) does not carry the optout distinction or the reason `estate: false` is the wrong tool (manifest.md:114-120), so one sentence must stay, as the reader said. The citation "themes.csv:15" is wrong: themes.csv regenerates, and the APP.md and manifest.md pair is now at themes.csv:27.

**Revised proposal:** As written, plus two fixes in the kept app-view paragraph (manifest.md:127-138): it lists **Surfaces** and **Activity** as shell views; Surfaces is a retired alias and Activity is a nav stop, not a view. Keep the hidden-versus-optout sentence, including why `estate: false` loses group, note, icon and order.

**Corrected words removed:** about 1,000. The spans are 12-26 (185, not 278), 87-97 (123), 102-125 (282, not about 450), 176-187 (168), 189-208 less two kept sentences (about 190 of 240), and 210-213 (46), less about 40 kept for the hidden sentence.

## 5. Collapse APP.md's name-split history to the rule

**Verdict:** keep

**Checked:** APP.md:24-106 is 926 words and Provenance (133-142) is 89. The self-corrections are at the cited places (APP.md:42-45, 57-62, 75-86, 93-96). The line-number tests are safe: annotate-section.test.mjs:206 asserts "§ First (lines 5-11)" against a fixture (APP.md has no "First" heading), and md-doc.test.mjs:245 and :418 compute lines from the parsed section rather than hard-coding them. aims-reading.csv:5 quotes only the doc's one-line purpose. The stub facts dropped from the doc (query and fragment preserved, 151 external files, no expiry) are all stated in the stub's own comment at pages/show-repo/show-repo.html. The rule sentence keeps the one principle a reader needs.

One addition: Durable goals, APP.md:123, says the app can "save a surface", which the stage stopped doing on 2026-08-27. Fix it in the same edit, or in the Save fix under proposal 1.

**Corrected words removed:** about 920 (926 plus 89, less about 75 and about 20 kept). The reader's 870 undercounts slightly.

## 6. One owner for the `#stage=` grammar, and fix show-repo.md's token caveat

**Verdict:** revise

**Checked:** The contradiction is real. show-repo.md:17-18 says "A token-less `#gz=` form for the stage is not built"; stage.md:620-645 documents it as built, and `tools/test/stage-gz-review.mjs` exists. The anchor slug `content-the-gz-param` is correct for stage.md:620. The reader missed the worse copy. `.claude/skills/show-repo/SKILL.md:32-39`, "The honesty caveat (state it on every stage handoff)", says at :38 "The token-less `#gz=`-style bundle form is contemplated, not built", and tells every session to state it on every handoff. That file is the plugin-shipped skill (docs/portable.csv:5), so the stale caveat reaches every repo. SKILL.md:48 also says "save-as-surface". surfacing-extended.md:17-19 is the one correct copy. The cite "SURFACING.md:59" is wrong; SURFACING.md links surfacing-extended.md at :41, :47 and :51.

**Revised proposal:** Fix show-repo.md:13-19 as written. In SKILL.md, rewrite the honesty-caveat section to the same two sentences (or a pointer to show-repo.md's caveat), and drop "save-as-surface" from :48; the grammar bullet at :29 can shrink to the one-line form with a link. In surfacing-extended.md, drop only the `&prompts=` and `&mode=` detail. Keep its "Pasted text needs no token" sentence and the boundary line: that file is where a session decides how to hand something over, so the `#gz=` choice belongs there as a pointer-sized statement.

**Corrected words removed:** about 120 (show-repo.md about 25 net, SKILL.md about 60, surfacing-extended.md about 35).

## 7. Rule for the slice: rationale lives at the code, docs state behavior

**Verdict:** reject

**Checked:** The placement rule already has an owner. docs/text-content.md:33-40 is a table that assigns commentary (read by whoever edits the file) to the source file, and text-content.md:622-627 records the 2026-09-08 rule from PR #625: "a comment keeps its criterion and sends the date, the measurement and the incident here." Adding a line to code-layers.md or the doc-craft skill would create a second statement of an owned rule, which is the defect this fan-out is removing. The check does not fit the tool it names. scripts/duplicated-claims.py:1-10 describes itself as "mechanical, advisory, and never blocking", and it shingles markdown pairs at 10 words (line 19-21); it does not read code. A doc-to-code threshold gate is a new script with a new failure policy, not an extension. The claim that the young views/ docs prove the method is weak: they are three days old (split 2026-09-24).

**Corrected words removed:** none. If anything is wanted, add a link from the three docs' headers to text-content.md's table.

## Missed

**Stale "save" claims across the slice.** The stage lost its save on 2026-08-27, and five places still offer it: stage.md:505, docs.csv:77 (and generated docs/README.md:69), SKILL.md:48, APP.md:123, and the component description string at stage.js:1098, which the Map view shows to readers. stage.js:4 also mentions "saved surfaces the estate component renders". One commit fixes all of them for about 100 words, independent of any rewrite.

**The shipped skill carries the stale token caveat.** SKILL.md:38 is covered under proposal 6 above; it is the highest-reach error in the slice, since the plugin installs it everywhere and it instructs sessions to repeat the error on every handoff.

**A hollow snag pointer.** SNAGS.md:1171 sends `viewport-rule-blind-to-a-docked-pane` to branch-overlay.md, which says nothing about docked panes or `@container`. This predates any rewrite.

**manifest.md keeps two more sections that are not manifest fields.** Errands (manifest.md:258-279) and Config cache (237-257) are channels and caches like Proposals. They are small, so moving them is not a large win, but note that web-tools-private/errands/README.md:9 links `manifest.md#errands-errandsrequests--errandsresults`, so any move of Errands needs that link updated.

No large simplification was missed. The three big docs are the whole of the slice's weight, and proposals 1 to 4 cover them.
