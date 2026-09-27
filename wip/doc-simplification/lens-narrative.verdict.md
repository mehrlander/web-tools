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

