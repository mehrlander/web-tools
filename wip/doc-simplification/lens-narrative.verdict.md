# Verdicts: lens-narrative

## 1. Retire the `Wrong` blocks in shortcut-tools, and fix the live contradiction two of them preserve

**Verdict:** revise

**Checked:** The contradiction is real. `shortcut-tools/workflows/README.md:452-458` says "Take the offer … Nothing has to be deleted first," and `:460-465` defends it. `CLAUDE.md:117-130` says an import over a held name leaves both copies and a replace goes through `Library-Replace`, and the README's own table row at `:96` agrees with `CLAUDE.md`. The `grep` count holds: 9 `**Wrong` blocks in shortcut-tools living docs, plus `web-tools/scripts/annotate/LOG.md:384`. It missed a tenth form in code, `shortcut-tools/tools/plist.py:44` (`# Wrong until 2026-09-19`). No script parses the blocks.

Three table-row blocks are not stories. They are the only statement of live facts. `:82` says `SearchShortcutsAction` exists, that whether it returns matches is unsettled, and that `OpenWorkflowAction` returns the original rather than the duplicate. `:97` says an omitted parameter comes back as no key at all, and that the `CreateFolderAction` feed is the one unproven shape. `:65` is pure history. The budget of "about 120 words folded back" across nine blocks is too small for this.

Two headings also contradict the text the blocks correct, and the proposal edits only the bodies. `docs/idioms.md:155` is titled "5. A menu is the API surface", and the block at `:157` says "It is not." `docs/shortcuts-format-notes.md:1603` is titled "The device lists apps, and never lists actions", and the warning at `:1608` says there is no route to the app list on iOS. `shortcuts-format-notes.md:531-534` also still states the wrong claim in live text: the page keeps "the localStorage partition the stored GitHub token lives in". That sentence has to be rewritten, not just have its block removed.

The README replacement sentence drops two live points that the section should carry or link: `Library-Import` is for a name the library does not hold, and the paste route through `Library-Paste` is the fallback when the signing worker is down.

**Revised proposal:** Keep the direction. Fix `workflows/README.md:452-465` first, as a separate correction: "Importing over a name the library holds leaves two copies, and the original keeps the name and the index. Replace through `Library-Replace`; `Library-Import` is for a new name. See `CLAUDE.md`." Delete the `:65` clause and `CLAUDE.md:138-145` outright. At `:82` and `:97`, rewrite each row in the present tense and keep the facts listed above. Retitle idioms section 5 (for example, "5. Menus are how imported shortcuts present themselves") and the format-notes heading (for example, "Find Apps is Mac-only; iOS has no route to the app list"). Rewrite `shortcuts-format-notes.md:531-534` so it says the page keeps its origin but not the Safari token.

**Corrected words removed:** about 650 net. About 850 gross, less about 200 folded back (the two table rows need about 80, the format notes about 70, the README about 40).

## 2. Collapse home's render-path investigation to the rule and a snag link

**Verdict:** revise

**Checked:** Word counts match: `home/CLAUDE.md:153-181` 310, `:184-196` 159, `:198-202` 57, `:149-151` 36. The web-tools snag at `docs/SNAGS.md:274-297` repeats the 46 files, the 9,692,313 bytes, the console line, and "hand over the framed page on its own." The anchor in the proposed link matches that heading.

The replacement sentence loses two live instructions. First, "Until that is run, do not state a cause" (`:170`). Second, and more important, that `showing.py` does not know about the exception (`:153`) and still prints the app route. The bold rule just above tells the reader to run `showing.py` and not decide by reading. Without the second clause, a session that obeys the bold rule hands over the broken link. The snag states this at `SNAGS.md:293-296`, but the proposal relies on a link a session may not follow. "Say that the app route is the broken one" is kept. The `:184-196` replacement drops "the app is the truer one" for screenshots, which is a preference, not only history.

**Revised proposal:** Replace `:153-181` with two sentences: "Until [`app-frame-outruns-the-inliner`](…) is resolved, the app route renders an empty pane for this private repo, and `showing.py` still prints it: hand over the framed page on its own, addressed with `#pkg=<id>`, and say the app route is the broken one. Do not state a cause until the console check in that snag has been run." Replace `:184-196` with: "`?tab=` reaches a framed page's own tabs, and `tools/screenshot.mjs` can shoot a framed view headless; prefer the app route for pixels, since it shows the frame as a reader meets it." The rest stands.

**Corrected words removed:** about 520.

## 3. Strip the incident stories out of shortcut-tools `CLAUDE.md`, keeping every rule

**Verdict:** revise

**Checked:** The file is 4,558 words by `wc -w` (the lens says 4,561). I read each span. The rationale says the stories "are already filed where the estate files trips." That holds for about half. `docs/SNAGS.md` has `install-shipped-where-a-tap-would-do` (`:47`, the `:34-42` story) and `corpus-not-searched-before-asking` (`:37`, the `:50-54` story). `success-asserted-without-reading-the-log` covers `Synced.`/`Dumped.` claims, not the `:344-347` asymmetry and not the `:414-421` "Come on" exchange, which is a question the repo already answered. `gate-narrower-than-its-own-claim` (`SNAGS.md:55-59`) is about `run.py`'s audit on the `--pick` path, not the 2026-08-27 `--check` orphan story at `:237-244`. The `Back-DoubleTap`/`Repo-Viewer` case, the `Get-ShortcutJson` case, the 2026-08-23 "Come on" exchange and the 2026-08-27 `--check` story have no snag and no chron record. `grep` finds them only in `CLAUDE.md`, in a test, and in raw session JSON. So the mitigation "each collapsed rule gets the snag slug" cannot be applied to them.

Two spans carry live content the proposal does not keep. `:259-261` states a format fact: "a `.wflow` does not carry its own identifier and only a *caller* records a target's." I found it nowhere else in `docs/`. It is the reason the identifier cannot resolve a stale name. `:445-449` is the only place that tells a session not to use `Probe-Step` for an observation, because it asks about the previous tap. The proposal lists the span as a target and gives no replacement.

The four sample replacements are sound: `:34-42`, `:237-244` and `:414-421` keep their rules.

**Revised proposal:** Keep the direction, with three changes. (a) Before cutting any story without a snag, either add a snag entry (one line each, in the repo's stated intake shape) or accept that the story is dropped, and say which. (b) Keep the identifier fact as one sentence in the stale-target paragraph. (c) Replace `:445-449` with: "`Probe-Step` asks before it fires, so its question is about the previous tap; use `Probe-Watch` for an observation."

**Corrected words removed:** about 780.

## 4. Cut the retirement notices and origin stories from home's Working style and Conventions

**Verdict:** revise

**Checked:** All three chron records the proposal links exist. The `:20-29` parenthetical is 87 words and safe to shrink. The `:30` parenthetical: `docs/HTML-STYLE.md` lives in web-tools, not home, and `home/me/README.md:39` and `home/projects/wa-budget-landscape/display/README.md:22` still link it as the style guide. The parenthetical is what tells a reader those links reach a pointer. Low value, but not zero.

The `:74` cut removes live rules along with the history. The proposed ending drops "`**Update YYYY-MM-DD:**` in particular is not a form here" and "where a word genuinely classifies what happened (`Corrected`, `Resolved`, `Outcome`) it belongs inside the writer's own sentence." Both are instructions. Only "The measured case for retiring them …" is history.

The rationale for dropping the `seam` date is wrong. `home/tools/lint-conventions.py:21-22` and `:190-191` say bare `seam` is deliberately not on the lint list. The five-word date can still go, but the sentence must keep its scope ("surviving only in physical names and dated records"), since no check stands behind it.

**Revised proposal:** As written, except at `:74`: cut only from "The measured case for retiring them" to "rather than fitness," and keep the `**Update` example and the `Corrected`/`Resolved`/`Outcome` sentence. Keep the `seam` sentence's scope clause. Optionally keep the HTML-STYLE parenthetical as six words: "(`docs/HTML-STYLE.md` is now a pointer.)"

**Corrected words removed:** about 220.

## 5. One sentence for the delivery rule in all three `CLAUDE.md` files, and no story of the import cut

**Verdict:** revise

**Checked:** `web-tools/CLAUDE.md` is 1,497 words. Line 5 reads as the lens says. The sentences about the import cut, the "1,589 words, 63%" line at `:13` and the 2026-08-22 clause at `:17-19` are history and can go. The 2026-08-22 incident is recorded in `docs/SNAGS.md:794`; the slug the lens cites, `showing-answers-commits-only` (`:134`), is a different trip (a staged branch read as empty), so the citation is loose but a record does exist.

Two problems. First, the proposal says web-tools `:30` "becomes" two sentences. Read literally, that drops "Body sync is manual and follows `docs/surfacing-course.md`; no hook or CI tracks it" and "delete any stray `BRANCH-GUIDE.md` on sight." Both are live rules. Only "(turned on 2026-07-10)", "a session predating the toggle" and "retired by PR #205" are history.

Second, one identical sentence in three files drops each file's local content. home's version names the failure signal ("a reply here arrives without a caption or a closing state") and "one visibly wrong reply beats a silent channel." web-tools and shortcut-tools both carry the one real rule behind the history: a web-tools checkout is not delivery. The proposed sentence keeps neither.

**Revised proposal:** Cut the history sentences only, in place. web-tools `:5` keeps "Every session, including one with this repo checked out, is prodded … by invoking `/portable:default`" and the "prod is broken" sentence. shortcut-tools `:9-11` becomes "A web-tools checkout is not delivery." web-tools `:30` keeps every sentence except the three history clauses named above.

**Corrected words removed:** about 170.

## 6. Finish the marker retirement: delete the notices it left behind, and the live instructions that still name it

**Verdict:** keep

**Checked:** `ls web-tools/.claude/skills` and `web-tools/skills` show no `markers` skill, and neither plugin cache copy under `~/.claude/plugins/cache/web-tools/portable/` carries one. `web-tools/CLAUDE.md:5` still says "run `/markers`." `tools/build/docs-readme.mjs:51` holds "corrected by markers, never rewritten" and `docs/README.md:8-10` renders it. `home/README.md:123` is worse than a notice: it says `/markers` inventories every marker and that `verify-artifacts.sh` runs its check as a gate, both false now. `home/tools/README.md:43` names no tool; the fact it carries (the `.paths.json` declaration and its readers) is also at `home/CLAUDE.md:76`. `web-tools/docs/docs.csv:47` classes `mcp-server-routing.md` as `record`, as claimed. Word counts are close.

One addition. There is no successor to `/markers` for frozen areas in the plugin, so the clause should be deleted, not renamed. `home/CLAUDE.md:17` says invoking `/portable:default` "also reports this repo's frozen paths," and `grep -ri frozen` over the default skill and both plugin cache copies finds nothing. That sentence is a third live defect of the same kind and belongs in this change. See Missed for the matching residue in `home/tools/verify-artifacts.sh`.

**Corrected words removed:** about 255 (adds the 15-word clause at `home/CLAUDE.md:17`).

## 7. Reduce web-tools `APP.md`'s name-split section to the rule and the current list

**Verdict:** revise

**Checked:** `APP.md` is 1,434 words. Span counts by `sed -n | wc -w`: `:24-33` 101, `:38-39` 28, `:42-49` 114, `:57-62` 75, `:64-86` 282 (the lens says `:64-83`, 246), `:88-99` 145. The spans are mostly correction narrative, as claimed.

The lens missed two things. First, this cut has been drafted before. `web-tools/docs/DOC_CRAFT_STUDY.md:44-45` diagnosed `APP.md:41-96` as a "palimpsest," and `docs/doc-craft-specimens/APP_living_spec_replacement.md` is a rewrite that `docs.csv:108` records as "not adopted." The study was superseded by the `doc-craft` skill, not rejected on the merits, but the proposal should start from that attempt. Second, a record for the history already exists: `docs/doc-craft-specimens/2026-09-08-naming-split.md` recasts this exact history as a dated record. That is the link the collapse needs.

The four statements drop one live instruction: the 608 existing commits keep `via show-repo`, because a record keeps the name it was written with (`:85-86`). Without it, a later session could try to "fix" history.

**Revised proposal:** As written, plus a fifth clause: "Commits already written keep `via show-repo`; a record keeps its name." Link `doc-craft-specimens/2026-09-08-naming-split.md` for the history, and note the earlier unadopted specimen in the change description.

**Corrected words removed:** about 580.

## 8. Delete the history dump in web-tools `text-content.md`, and the "how this doc came to be" openers

**Verdict:** revise

**Checked:** `text-content.md` sections at `:627` and `:689` exist, and the word counts are plausible. The claim of no inbound dependencies does not hold. The lens grepped only for `text-content.md#`. `tracker/tasks/comment-trim-rule-first-b0o3bu.md:73` and `:117` cite "What the pilot taught about running the pass" by section name, and that task is `status: backlog`. `skills/reduction-panel/SKILL.md` does not carry the "rewriter marking its own work" or "seven of eleven were added claims" findings. Moving the section therefore needs the task's pointers updated in the same change.

The "moved out" section is not all dead history. "What a constant was measured against" (`:646-654`) is the only rationale for `DIM_SATURATE`, `DIM_ALPHA`, `INK_TIE` and `GZ_MAX` (24k against Safari's roughly 80k URL ceiling). A person changing those constants needs this, and a PR diff is not where they will look. That is actionable rationale under the `doc-craft` skill's own rule.

`app/index.html:11-17` tells editors that "if a passage is not about the code it sits beside, it belongs in the doc," naming `text-content.md`. That instruction is what produced the dump. Deleting the dump without changing the instruction invites the next one.

The `code-layers.md` opener also carries a live rule: "Where a split turns out to have no rule behind it, this document says so rather than inventing one, and points at the task" (`:10-12`). Only the dates at `:12-14` and the "because the alternative is what happened" story are history.

**Revised proposal:** Delete `:627-688` except the constants paragraph, which goes back to the constants as one-line criterion comments. Move the pilot lesson into `reduction-panel` and update both pointers in `comment-trim-rule-first-b0o3bu.md` in the same change. Change `app/index.html:15-17` to send history to the PR or git rather than to a doc. In `code-layers.md`, keep the "says so rather than inventing one" sentence. The `estate-span.md` opener is as proposed.

**Corrected words removed:** about 950.

## 9. Keep the conclusions in web-tools-private `sessions/README.md` and send the measurement narratives to `record.py`

**Verdict:** revise

**Checked:** The README is 11,350 words. The spans read as the lens says. `:281-285` is a pure former-sentence story and can go.

The "move to `record.py`" half is partly done already. `sessions/tools/record.py:168-173` already carries the schema-2 measurement (97 percent `calls`, 64 percent bodies, 87 percent Bash, `Edit`'s 96 KB, 1 percent failures) beside the constants it justifies, and `:385-397` carries the redactor counts. So the schema-3 table at `:669-692` is a second copy and should be deleted, not moved. Only the 2026-09-08 agent-stream table (`:639-648`) is not in code; it belongs as a short comment beside the 1 KB cap. Moving 250 words of tables into the docstring would run against web-tools' own warning that a comment past a few hundred words is a design document.

`:1138-1144` should not be deleted outright. Its last clause is a known limit a reader can act on: a session that records nothing leaves nothing to diagnose, so a gap in the store cannot be attributed after the fact.

**Revised proposal:** Delete `:281-285` and the schema-3 table. Put the 2026-09-08 clip measurement beside the cap in `record.py` in four or five lines. Keep the three bold conclusions. Reduce `:1138-1144` to: "A session that records nothing leaves no trace, so a gap in the store cannot be attributed after the fact."

**Corrected words removed:** about 600.

## 10. Standing rule: a living doc states the rule, not the incident

**Verdict:** revise

**Checked:** The rule already exists. `web-tools/skills/doc-craft/SKILL.md:31-32` says: "State current reality … Omit debugging narratives, discovery steps, and authoring commentary," and "Retain actionable rationale: include reasons only when they define a boundary, exception, condition, consequence, or trigger for reconsideration." The lens does not mention it. The real gap is delivery: `doc-craft` is in the load-on-demand library, not in the portable plugin, so a session editing a `CLAUDE.md` never sees it.

`QUALIFIED-WRITING.md` is the wrong home. It is 224 words of sentence-level rules for every piece of prose, including commit messages and chat replies, and ships as a byte-matched copy inside the plugin. A document-genre rule of about 110 words grows every session's payload by half and does not fit its scope.

The wording over-reaches in one place. "It does not say … why a paragraph exists" forbids rationale, which `doc-craft` explicitly keeps. Tested against real paragraphs: `shortcut-tools/CLAUDE.md:118-119` and `:143-145` state that the import rule rests on first-hand observation and not on a manifest measurement. That is the evidence grade of a live rule, and it fits neither stated exception. `shortcut-tools/workflows/README.md:474-477` ("Measured 2026-09-08 … the notification naming `Run-BackTap` three levels above the failing card") is an incident, and it is also the symptom signature a reader needs to diagnose the failure. A reader applying "delete the story" could cut both.

The enforcement half does not work as written. `scripts/embedded-prose.py` reads only `.js`, `.mjs`, `.html` and `.py` (`EXTS`, `:78`). Its `--dated` mode lists code comment blocks that carry an ISO date and marks those with a figure. It finds dated measurements, the thing the rule wants to keep, not narrative. Adding Markdown narrative regexes makes it a different tool under a name about prose in code. `docs/docs.csv` lists only paths under `web-tools/docs/`, so a scan keyed on its `living` class would miss all three `CLAUDE.md` files, shortcut-tools and web-tools-private, which is where proposals 1 to 5 and 9 sit. The proposed gate cites home's lint as precedent, but `home/tools/lint-conventions.py` has no banner check, and shortcut-tools never retired markers, so a gate would fail on nine blocks in a repo that has not agreed to the rule.

**Revised proposal:** Do not add a paragraph to `QUALIFIED-WRITING.md`. Put one sentence in `SURFACING.md` or the `default` skill that names `doc-craft`'s living-document rules as binding when a session edits a living doc, or move `doc-craft` into the portable plugin. Tighten `doc-craft` with the one thing it lacks: "say what is true and what to do; not what the doc used to say or which session got it wrong; a date or evidence grade that tells a reader how far to trust a live claim stays." If a scan is wanted, make it a separate script over Markdown with its own path list, advisory only.

**Corrected words removed:** none directly, as the lens says.

## Missed

**The `doc-craft` skill and its study.** `web-tools/skills/doc-craft/SKILL.md` already states this lens's standing rule, and `web-tools/docs/DOC_CRAFT_STUDY.md` (970 words, classed `record`) plus two specimens already diagnosed `APP.md` as the lead case. A lens proposing this rule should start from why the skill did not stop the pattern, which is delivery (see proposal 10).

**`home/CLAUDE.md:17` claims a capability that does not exist.** "Invoking it also reports this repo's frozen paths." Nothing in the default skill or either plugin cache copy mentions frozen paths. This line loads in every home session. Same family as the `/markers` default in proposal 6.

**Marker residue in `home/tools/verify-artifacts.sh`.** `:102` cites "web-tools `.claude/skills/markers/SKILL.md`" as its recipe, a file that no longer exists. `:1126-1131` prints a warning about "frozen paths, markers, or arrow targets" when `status-tool` is in the skip log, and nothing in the script ever adds `status-tool`, so the branch is dead. This is code, not prose, but it is the same leftover as proposal 6.

**The estimate is looser than stated.** I re-ran the method and got close figures: 59,084 flagged words over 971,905 living words, and about 42,700 after the two outliers. But blank-line splitting treats a whole bullet list as one paragraph. `home/tools/README.md` has a single 1,804-word flagged list, `home/README.md` a 1,044-word one, and `web-tools/lib/kits/README.md` a 320-word table. The 30 to 50 percent rate from eight sampled paragraphs is then applied to those lists. "13,000 to 22,000" should read as an upper bound of uncertain size, not a range.

**shortcut-tools needs a local rule, or the blocks come back.** Proposal 1 deletes nine `Wrong` blocks, but shortcut-tools never adopted home's marker retirement. Nothing in its `CLAUDE.md` says not to write the form again, and `tools/plist.py:44` shows it in code comments too. One line in shortcut-tools' Snags section or its `CLAUDE.md` preamble would hold it.
