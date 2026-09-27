# Verdicts: shortcut-tools

Checked against shortcut-tools at `203b562` (2026-09-26). The slice totals match: `wc -w` gives 44,793 words across the nine files, and `CLAUDE.md` is 4,558.

## 1. Replace the 86-row chain table with the catalog it duplicates

**Verdict:** revise

**Checked:** The table runs `workflows/README.md:34-119` and is 7,546 words (`wc -w`). There are 84 chain files, and `catalog.json` has 84 rows with the keys `file, label, name, actions, build, settings, targets, sketch`. The labels total 1,069 words. `test/chain-table.test.js` matches `^\| \`name\` \|`, as the reader says. `test/docs-repetition.test.js:19` splits on blank lines, so a table counts as one paragraph. The "Ends on the log page" cell text appears 3 times verbatim. `tools/catalog.py:7-11` and `web-tools/pages/shortcuts.html:15-22` both describe the README as the surface that the catalog replaced.

The claim that only about 300 words of facts need to move does not hold. Many rows carry design rules and platform measurements that are recorded nowhere else:
- `check-api-reply` (`:85`) is the only place that says the failure channel is a local notification because every other channel needs the token. `CLAUDE.md` never names `Check-ApiReply`.
- `copy-github-token` (`:61`) says the chain must not log. This is the one exception to the rule that a probe reports itself.
- `library-move` (`:97`) records that `CreateFolderAction` output fills a folder slot and that the action refuses a folder that already exists. It also records the 23-of-51 run. The format notes still call this "untested" (`docs/shortcuts-format-notes.md:1804`).
- `choose-claude` records the rule that the op guarantees a non-empty `menu`, and why.
- The duplicate-finder row explains why the match is `contains` and not `is`. It also records that `SearchShortcutsAction` exists and that `actions.json` spells it `searchinshortcuts`.
- `route-gesture` records its fallback and the reason for it.

A grep of the rows for measured or confirmed claims finds 7 such rows. At least 15 rows carry a bolded "never / must / not" design rule. Most of these are too long for a one-clause `label`.

The reader also missed an inbound dependency. `docs/SNAGS.md:113` points "→ `workflows/README.md`, the `run-backtap` row", and the suite requires every snag to have a `→` line (`test/snags-index.test.js`).

**Revised proposal:** Keep the direction and change where the rationale goes. Delete from every row the dated histories, the `Wrong` markers (rows at `:65`, `:82`, `:97`) and the three copies of the log-page passage. Move per-chain rationale out of prose and into the chain itself: add an optional `why` field to each chain JSON and have `catalog.py` carry it, so that `pages/shortcuts.html` can render it. Then delete the table and `test/chain-table.test.js` together. `catalog.py --check` already enforces the "every chain is listed" guarantee that the test was written for. Move platform measurements, such as the `CreateFolderAction` result and the empty-filter Repeat halt, into the format notes. Put the `Check-ApiReply` rule in `CLAUDE.md`, where proposal 5 merges the return-channel sections. Retarget `SNAGS.md:113` to `workflows/run-backtap.json` or to the format-notes splice section.

**Corrected words removed:** about 4,000, not 7,000. Roughly 3,500 words of rationale move into `why` fields and the format notes instead of being deleted.

## 2. Delete the probe diaries and dated build notes from workflows/README.md

**Verdict:** revise

**Checked:** Most deletions hold up.
- `docs/shortcuts-format-notes.md:209` owns the Run Shortcut result.
- `tools/manifest-delta.py:19,84-98,159-167` already carries the column-major manifest, the dropped empty values, and the `/` to `:` swap.
- `tools/read-incoming.py:78-81` already carries the whole-line split.

So the sentences the reader wants to add to "The precise form" are also unnecessary, because the docstrings own them. `workflows/README.md:229-250` and `docs/idioms.md:238-250` do repeat the self-name and trace examples.

Three problems:
- **The "Emit both forms" sentence has a reader.** The `--url` span `:29-32` ends with "**Emit both forms, never type either.**" `CLAUDE.md:463-464` says that rule is something "[`workflows/README.md`] already says". Deleting the span breaks that reference unless the sentence stays.
- **Lines 121-145 are counted but not named.** The word count includes 267 words from 121-145, but that span is not in the target list, and it carries rules. It says what `Run-Html` is for as against `Show-Html`. It also says to inject the token in one place only, because the second injection "reads as load-bearing". Neither rule appears in the catalog labels.
- **The idioms copy is also cut.** Proposal 8 deletes the idioms copy of self-name and trace too. Together the two proposals leave only the chain labels, which is enough only if proposal 8 keeps its keep-list item 7.

Measured spans: 191, 138, 180, 145, 179, 255, 174, 362, 144 and 57 words, which total 1,825.

**Revised proposal:** Delete the ten listed sections. Keep "Emit both forms, never type either" beside the `--url` command, or change `CLAUDE.md:464` to state the rule itself. Leave 121-145 out of this cut. If proposal 1 adds `why` fields, move its two rules into the `run-html` and `gh-recent-branches` fields. Add no new sentences for manifest parsing, because the docstrings already state it.

**Corrected words removed:** about 1,800.

## 3. One owner for install and replace, and fix the live contradiction

**Verdict:** revise

**Checked:** The contradiction is real. `workflows/README.md:453-458` says "Take the offer ... Nothing has to be deleted first". `CLAUDE.md:118-129` says an import leaves both copies and that a replace goes through `Library-Replace`. `CLAUDE.md:138-141` quotes the README wording as the wrong one. `workflows/README.md:97` records the `CreateFolderAction` measurements, and `CLAUDE.md:185-190` still says "may remove". `README.md:298-300` states the one-tap setup. The measured spans are `CLAUDE.md:109-191` at 749 words, `:138-145` at 93, and `workflows/README.md:452-467` at 154.

The estimate is wrong because the span `CLAUDE.md:109-191` also holds lines 146-180, 280 words that proposal 3 does not touch:
- "Settings binds only `Double-BackTap` and `Triple-BackTap`", which `docs/SNAGS.md:107` cites by heading
- the bound-shortcut rule
- the prefs-key table
- "Replacing a generated receiver is free"

Cutting 749 words to 300 would delete them. The install material alone is about 470 words.

**Revised proposal:** As written, but scoped to `CLAUDE.md:109-145` and `:181-191`. Leave 146-180 alone, apart from the duplicate table named under Missed. Keep the heading text "Settings binds only `Double-BackTap` and `Triple-BackTap`" unchanged for `SNAGS.md:107`.

**Corrected words removed:** about 500 (`CLAUDE.md` about 320, `workflows/README.md` about 140, `README.md` about 40).

## 4. Replace the hand-run name audit with the tool that already exists

**Verdict:** revise

**Checked:** `tools/targets.py:1-34` exists and does what the reader says. It reads `catalog.json` targets, which include all three carriers per `tools/catalog.py:50,72-78`, and checks them against the newest manifest alone. A grep for `targets.py` finds no mention in any `.md` file in the slice, any test, or the web-tools skills. The span `CLAUDE.md:246-336` is 797 words. No anchor links point to the heading.

Two gaps:
- `targets.py` reads `catalog.json`, so a new chain is invisible to it until `python3 tools/catalog.py --publish` runs. The pasted snippet reads the chain file directly. The replacement text has to say to publish first.
- The `Repo-Viewer` story carries a standing method: resolve a stale by-name target by asking what the library has that does the job, not what the name used to mean. It is stated only in `CLAUDE.md:269-273` and would be lost.

The own-name collision check is still not mechanized in any tool.

**Revised proposal:** As written, plus two sentences. The first says to run `catalog.py --publish` before `targets.py` when a chain is new or changed. The second keeps the method for resolving a stale target. Prefer adding the own-name check to `targets.py` over keeping it as prose, because `targets.py` already builds the `authored` name set.

**Corrected words removed:** about 630.

## 5. Merge the four return-channel sections of CLAUDE.md into one

**Verdict:** revise

**Checked:** The overlap is real. `CLAUDE.md:64-76` and `:389-402` both explain the clipboard-first return path. "Ask only what the repo cannot answer" appears at `:404-412` and again at `:441-443`. The 2026-08-23 episode appears at `:414-421` and again at `workflows/README.md:366-371`. The only anchor link is `workflows/README.md:371` to `#a-diagnostic-returns-itself`.

The measured spans total 1,451 words (345, 437, 350 and 319), not 1,243.

The reader missed a dependency. `docs/SNAGS.md:65` points to `CLAUDE.md` by heading, "Every handover reports itself, with its build id", and that heading disappears in the merge. `SNAGS.md:71` cites "rung 0 of the diagnostic ladder", which survives.

The six-rule list also drops content that exists nowhere else in prose:
- `log.py` reads `origin/main` and fetches first, because the working tree can be days stale.
- `shortcut-log.html` is the phone-side half of the reader.
- A verification payload is JSON with `op`, `name` and `build`.
- `plists/builds.json` scores a build as current or stale, and the readers stay silent when the manifest is unknown.
- The "Send the instruction with the destination" bullets (`:455-459`).

The rationale cites `Check-ApiReply` as the mechanical enforcement, but `CLAUDE.md` never names it.

**Revised proposal:** Merge as proposed, but keep the six items above as clauses, since each one is a rule a session acts on. Name `Check-ApiReply` in rule 2. Keep the anchor `a-diagnostic-returns-itself`, and retarget `SNAGS.md:65` to it in the same commit.

**Corrected words removed:** about 800, which is unchanged, because keeping the extra clauses costs about what the larger base adds.

## 6. README: turn the tool essays into a command table that links to the docstrings

**Verdict:** keep

**Checked:** The spans measure 324, 473, 248 and 269 words. `README.md:118-126` restates `tools/run.py:28-40` and is already stale: the README says "Two false positives to expect ... the index being a snapshot", while the docstring says the manifest removed one of them. That proves the drift the reader predicts. `README.md:156` and `docs/shortcuts-format-notes.md:596` share the contacts sentence, and the 2,594-byte figure appears in both. `menus/README.md:15` (not `:14`) links `../README.md#menus-with-icons`. The retarget anchor `a-menu-with-icons-is-a-list-of-contacts-coerced-in-place` exists (`format-notes:592`). No other inbound anchors were found in web-tools, home or web-tools-private. A `## CLI` section already exists at `README.md:308` for the npm CLI, so name the new table something distinct, such as "Scripts".

**Corrected words removed:** about 1,100.

## 7. Format notes: collapse the library-management and coprocessor sections to their findings

**Verdict:** revise

**Checked:** The section runs `format-notes:1486-1815`. The `[!WARNING] Wrong 2026-08-30` banner is at `:1607-1613`, and the self-corrections are at `:1732`, `:1750` and `:1787`. Two inbound anchors must survive, and the reader named both: `web-tools-private/device/README.md` links `#the-platforms-field-is-not-a-runtime-claim`, and `README.md:296` links the section heading. The stale "untested" at `:1804` is confirmed.

Problems:
- **One subsection is left out of the keep-list.** The keep-list omits "No action can put actions into a shortcut" (`:1697-1727`), which sits inside the target range. It holds measured content with no other owner: the two `Create Shortcut` parameters, and the 115-candidate sweep across 71 tools. The same subsection is also stale. It calls the signed import "Untested here" (`:1725`), while `CLAUDE.md:109` records `Library-Import` confirmed on 2026-08-15. Fix it, don't just keep it.
- **The post-mortem carries a probe-design rule.** The coprocessor post-mortem (`:1134-1141`) says "a probe against a stage that can kill the run needs a control that runs first and logs first". No other file states it. The reader's replacement sentence covers only the `resolve` fix.
- **The Withdrawn paragraph names existing machinery.** The "Withdrawn 2026-08-29" paragraph lists library shortcuts that already do the job (`Get-FileContext`, `Get-FileInfo`, `Run-Choice`). One clause is worth keeping.

**Revised proposal:** As written. Add "No action can put actions into a shortcut" to the keep-list, corrected to say the signed import is confirmed and runs through `Library-Import`. Keep the control-leg rule as one sentence in the coprocessor section, or in `CLAUDE.md` rule 4 with the probe rules.

**Corrected words removed:** about 1,700.

## 8. Idioms: delete the stale findings list and the self-audit, keep the idioms

**Verdict:** revise

**Checked:** The findings list is stale as the reader says: `workflows/speak-text.json` exists, `CLAUDE.md:254-256` records the `Use-RecentShortcut` rename, and the struck-through `Combine-JsonList` item is at `docs/idioms.md:281-288`. `survey.py --dangling` exists (`tools/survey.py:344`). `README.md:216-218` states that the core is a floor. Keep-list item 7 (`idioms.md:330`) names rename-safety. No anchor links point to the deleted headings.

One error: the target "reach-audit paragraph (7-21)" is mostly the Reach table (`:12-18`, 167 words in all). That table is the only record of where each idiom's users sit (core, called, uncalled, residue, imported). It is also the evidence for the standing rule the reader wants to move into the intro. Idiom 5 repeats only the menus row.

**Revised proposal:** As written, but keep the Reach table and cut only its surrounding prose. The standing rule then sits directly above its evidence.

**Corrected words removed:** about 700.

## 9. SNAGS: stop generating the entry text twice

**Verdict:** revise

**Checked:** The duplication is real. `tools/snags-index.py:60-66` copies each entry's first line into the "what it was" column, which totals 562 words. The header paragraphs `SNAGS.md:3-25` are 247 words. `CLAUDE.md:379-387` is 85 words. One stated dependency is false: `snags-index.py` does not read `catalog.json`. It mentions `catalog.json` only in prose.

The proposal also misses why the column exists. The web-tools generator (`web-tools/tools/build/snags-index.mjs:10-16`) puts the index where a session appends, so that it can spot a repeat without reading the entries. Slugs alone fail at that, and the same file records the case: `headless-prose-unstyled` and `headless-shot-prose-flat` were one snag. The three-column shape is also shared with `web-tools/docs/SNAGS.md:72`. The difference is that web-tools entries lead with a short title, while shortcut-tools entries lead with a full sentence.

**Revised proposal:** Keep the column, and keep the shape the estate shares. Give each shortcut-tools entry a short title line (under 10 words) above its sentence, as web-tools does, so the column carries titles and not whole sentences. Cut the header to about 80 words and delete the backfill paragraph. Reduce `CLAUDE.md:379-387` to one line pointing at the header.

**Corrected words removed:** about 550 (column about 400, header about 170, `CLAUDE.md` about 50, less about 70 words of new titles).

## Missed

**Duplicate prefs table.** `CLAUDE.md:161-175` repeats the Back Tap and AssistiveTouch `prefs:` table and the `Fav-Settings` origin, which are also in `docs/shortcuts-format-notes.md:1362-1385`. Keep the rule in `CLAUDE.md` and link to the table, which saves about 70 words. `format-notes:1388-1390` also says the rule sits "next to the save-over offer it qualifies". That is the retired framing from proposal 3, so it should be reworded in the same commit.

**Broken anchor.** `README.md:369` links `#installing-a-generated-shortcut`, and no heading by that name exists.

**The markers in one sweep.** `Wrong <date>`, `Wrong until` and `Withdrawn` markers appear 11 times across the slice: `workflows/README.md` 5, `format-notes` 4, `CLAUDE.md` 1, `idioms.md` 1. There is one more in code, at `tools/plist.py:44`. The proposals remove most of them piecemeal. One pass under the home repo's rule of 2026-09-21 would catch the rest, including `workflows/README.md:470-475` (the op-fetch "Wrong until 2026-09-08" paragraph), which no proposal touches.

**Every fix is one owner per rule.** Proposals 1, 3, 5 and 7 all find the same failure. A rule lives in a chain-table cell or a narrative paragraph, and the owning document goes stale beside it: `CreateFolderAction` "untested", the signed import "untested", `Check-ApiReply` unnamed in `CLAUDE.md`, and the README copy of `run.py` behind its docstring. That shared cause argues for carrying out proposals 1, 3, 5 and 7 together, not one at a time.
