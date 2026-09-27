# Slice: shortcut-tools

**Summary.** The slice is the nine living documents in `mehrlander/shortcut-tools`: `CLAUDE.md` (4,558 words, loaded every session), `README.md` (3,438), `workflows/README.md` (14,396), `docs/shortcuts-format-notes.md` (16,867), `docs/idioms.md` (2,587), `docs/SNAGS.md` (1,755), `docs/dataflow.md` (639), `menus/README.md` (458) and `proposals/README.md` (95). Together they hold 44,793 words. The dominant bloat is incident narrative stored inside rules: a fact is stated, then the story of how it was learned, then a `Wrong <date> →` correction of an earlier wording, often in two files at once. The second source is restatement: the chain table repeats what `catalog.json` already derives, the README repeats tool docstrings, and three rules (install/replace, the diagnostic return channel, the name audit) each live in two or three places. One of those restated rules has already drifted into a live contradiction (proposal 3). The nine proposals below remove an estimated 14,000 to 15,000 words, about a third of the slice, and about 1,900 words from `CLAUDE.md` alone.

## 1. Replace the 86-row chain table with the catalog it duplicates

**Repo:** shortcut-tools

**Targets:** `workflows/README.md:34-119` (the chain table), `test/chain-table.test.js`.

**Kind:** move-to-data-or-check

**Proposal:** Delete the table. In its place write two sentences: "Every chain here is listed, with its label, install name, build, action count, targets and sketch, in [`catalog.json`](../catalog.json), rendered by web-tools' [`pages/shortcuts.html`](https://github.com/mehrlander/web-tools/blob/main/pages/shortcuts.html). A chain's one-line purpose is its `label` field." Keep only facts that change how a chain is used and that no file states elsewhere. Move each into that chain's `label` if it fits in one clause, or into the relevant format-notes section if it is a platform fact. Examples: the `copy-github-token` rule that it must not log, and the `route-gesture` fallback. Delete the rest: dated histories, `Wrong` markers (rows 65, 82, 97), and corpus counts. Retire `test/chain-table.test.js`, because `tools/catalog.py --check` already fails when `catalog.json` falls behind `workflows/`.

**Rationale:** The table is the index of the directory, and the estate already built a derived index to replace it. `tools/catalog.py:7-11` says why it exists: a reader otherwise has to read "`workflows/README.md`, which is 12,500 words organised by the date each thing was discovered". `web-tools/pages/shortcuts.html:15-22` says the same. Every chain already carries a `label` (84 of 84 files), and the labels total 1,069 words against the table's 7,546. The table has also started repeating itself inside cells, where `test/docs-repetition.test.js` cannot see it, because the test splits on blank lines and a table is one paragraph.

**Evidence:** `workflows/README.md:46`, `:50` and `:52` each carry the same 70-word "**Ends on the log page** (2026-09-25): on a confirmed write it logs ..." passage verbatim. Row 65 (`choose-claude`) is about 600 words and ends in "**Wrong 2026-09-08 → the row above:**". Rows 82 and 97 carry "**Wrong 2026-09-14 → here**". Sample catalog row: `{'file': 'ask-report.json', 'label': 'Ask-Report: walk a list of questions, commit every answer in one trip (10 actions)', 'name': 'Ask-Report', 'actions': 10, 'build': ..., 'targets': ['Log-Repo'], 'sketch': [...]}`.

**Words removed:** about 7,000 (table 7,546, less about 300 of facts moved into labels or format notes, less the 2-sentence pointer).

**Inbound dependencies:** `test/chain-table.test.js` reads the table (`^\| \`name\` \|` rows) and must be retired in the same commit. `tools/doc-index.py:31` indexes `workflows/README.md` and regenerates on `--publish`. `tools/catalog.py:9` and `web-tools/pages/shortcuts.html:17` describe the README as the old surface, and their comments should drop that clause. No anchor links point at individual rows.

**Risk:** Medium. The table is the only place some per-chain rationale is written in prose. Mitigation: before deleting, sweep the rows for any sentence of the form "do X, never Y" and move each one to a label or a format-notes section. Git keeps everything else.

## 2. Delete the probe diaries and dated build notes from workflows/README.md

**Repo:** shortcut-tools

**Targets:** `workflows/README.md` sections:
- "Parameter shapes are load-bearing and only partly confirmed" (268-288)
- "Both probes ran, 2026-08-12" (289-304)
- "The two probes, and why they were worth a tap" (305-324)
- "`probe-step` ran, 2026-08-23" (357-372)
- "The two mechanisms the device library lacks" (223-251)
- "Converting the dispatcher by splicing" (612-639)
- "The caption path was five shortcuts and is now one" (640-659)
- "What the first device run changed" (773-807)
- "The dumper could not dump itself" (842-856)
- the `--url` backstory (29-32)

**Kind:** collapse-narrative

**Proposal:** Delete each section. For each one, keep only the durable fact as one sentence in the section that owns the topic:
- **Probes and parameter shapes:** "Run Shortcut resolves by `WFWorkflowName` alone, including from a variable". This is already stated at `docs/shortcuts-format-notes.md:209`, "Run Shortcut names its target twice, and the second half is optional", so it needs no new sentence.
- **Manifest parsing:** "The manifest is column-major and Shortcuts drops empty values when joining, so `folder` is excluded and the parser refuses unequal columns". Add this to "The precise form: manifest, then named".
- **Split markers:** "Record markers are split on whole lines only". Add this there too.
- **The rest:** the splice before/after table, the caption-path story and the `probe-step` run report describe one-time events that git holds.

**Rationale:** These sections record when and how something was learned, not what is true now. The two-probes sections argue for a probe that already ran and whose result has an owner in the format notes. "The two mechanisms the device library lacks" repeats `docs/idioms.md:234-251`, "What imported shortcuts do better": the same `vCard Menu Creator` self-name and `Multi-stop navigation` trace examples with the same counts. The `probe-step ran` section's second paragraph repeats `CLAUDE.md:414-421`, the 2026-08-23 "Come on, this is not what you should be asking me" episode, and links to it.

**Evidence:** `workflows/README.md:305-311` argues that "If the **name alone** resolves, that constraint disappears". `:291` says it did. `docs/shortcuts-format-notes.md:209` owns the result. `workflows/README.md:229-250` vs `docs/idioms.md:238-250`: both cite "twelve live instances" and "52 traces".

**Words removed:** about 2,100 (509 + 145 + 179 + 255 + 174 + 362 + 144 + 57 + 267 from the post-table "Both branch chains" paragraphs at 121-145, less about 80 of kept sentences).

**Inbound dependencies:** None found outside dated records. The grep covered `web-tools`, `home` and `web-tools-private` for anchors into these headings. `web-tools-private/sessions/*.json` mention the file, but those are session records, not links. `tools/doc-index.py` regenerates the section index.

**Risk:** Low. Every deleted fact is either restated in its owner or is history.

## 3. One owner for install and replace, and fix the live contradiction

**Repo:** shortcut-tools

**Targets:** `workflows/README.md:452-467` ("Importing over an existing name puts a choice on screen ... Take the offer ... Nothing has to be deleted first", plus "Wrong 2026-08-15"). `CLAUDE.md:109-145` (install, duplicate, Library-Replace, "Wrong 2026-08-26"). `CLAUDE.md:181-191` ("The one-time cost so far"). `README.md:298-300` (Library-Stage setup tap).

**Kind:** link-to-owner

**Proposal:**
- **Keep `CLAUDE.md` as the owner**, cut to three short paragraphs:
  - Import is the install route, because only a plist carries file-level settings.
  - Importing over an existing name leaves two copies and the old one keeps the name, so a replace goes through `Library-Replace`.
  - When the signing worker is down, use `pack.py --install`.
- **Delete `CLAUDE.md:138-145`**, the "Wrong 2026-08-26" paragraph. The home repo retired this marker form on 2026-09-21, and git holds the old wording.
- **In `workflows/README.md`**, replace 452-467 with one link line to that `CLAUDE.md` section.
- **Update the one-time-cost list.** `CLAUDE.md:181-191` and `README.md:298-300` should either drop the Library-Stage folder story or state the measured result: `CreateFolderAction` output fills the slot, but it refuses an existing folder, as `workflows/README.md:97` records.

**Rationale:** Two files state one rule, and they now disagree. `workflows/README.md:452-458` still tells the reader to "Take the offer ... Nothing has to be deleted first." `CLAUDE.md:138-141` says exactly that wording "sent a session into routing every re-install through `Library-Import`" and was wrong. `workflows/README.md:460-464` already diagnoses the cause of the drift: "which is the cost of stating one rule in two places".

**Evidence:** Quoted lines above. `CLAUDE.md:126-129` owns the fix (`Library-Replace`, proven 2026-09-16). `CLAUDE.md:185-190` says create-then-move "may remove" the tap. `workflows/README.md:97` says the create refuses an existing folder, "which makes create-then-move single-use".

**Words removed:** about 650 (`CLAUDE.md` 749 → about 300 across 109-191. `workflows/README.md` 154 → 15. README 3 lines).

**Inbound dependencies:** None to these headings. `CLAUDE.md` is read every session, so the fix reaches every session at once.

**Risk:** Low, and deleting the stale copy is a correctness fix, not only a trim.

## 4. Replace the hand-run name audit with the tool that already exists

**Repo:** shortcut-tools

**Targets:** `CLAUDE.md:246-336`, "A name is not a reference until something checks it" (797 words).

**Kind:** move-to-data-or-check

**Proposal:** Cut the section to about 120 words:
- **The rule:** a by-name target is a string nothing validates.
- **Three commands:** `python3 tools/targets.py`, which checks every authored target against the newest device manifest. `run.py`, which audits every link it emits. `tools/catalog.py`, which reads all three target carriers: `WFWorkflowName`, dictionary values, and route blocks.
- **The collision check:** keep one sentence saying the chain's own `name` needs checking against the index before a link goes out. Or add that check to `targets.py`, which already loads the catalog's `name` column.
- **What to delete:** the inline Python audit snippet, the `Repo-Viewer`/`Show-Repo` elimination story, the `Get-ShortcutJson` 2026-08-30 story, and the "route block hid four names until 2026-09-14" backstory.

**Rationale:** `CLAUDE.md` hands the reader a Python snippet to paste, while `tools/targets.py` does the job and is never mentioned in any doc in the slice. A grep of `CLAUDE.md`, `README.md`, `workflows/README.md` and `docs/*.md` for `targets.py` returns nothing. Its docstring (`tools/targets.py:1-34`) also explains why the snippet's source set is the wrong one for this question: it uses the index plus the manifest, and a deleted name stays in the index. The "any future carrier must be added here" instruction (`CLAUDE.md:333-336`) belongs as a comment in `catalog.py`, the one reader of carriers.

**Evidence:** `CLAUDE.md:275-301` (the snippet). `tools/targets.py:19-29` ("It reads the newest manifest ALONE, and that is the whole point of it"). `tools/catalog.py:18-25` (two-pass target reading). `CLAUDE.md:320-328` (route-block carrier, now read by `catalog.py`).

**Words removed:** about 670.

**Inbound dependencies:** None found for this heading. `docs/SNAGS.md` entry `gate-narrower-than-its-own-claim` points at `tools/run.py`, not at this section.

**Risk:** Low. The one behavior not yet mechanized, the own-name collision check, is either kept as a sentence or added to `targets.py`.

## 5. Merge the four return-channel sections of CLAUDE.md into one

**Repo:** shortcut-tools

**Targets:** In `CLAUDE.md`:
- ladder rung 1 and its "fails silently" paragraph (44-76)
- rule 5 (102-103)
- "Every handover reports itself, with its build id" (338-377)
- "A diagnostic returns itself" (389-421)
- "A probe carries its own instructions" (423-459)

**Kind:** merge

**Proposal:** Replace the three H2 sections with one section, "A probe returns itself", of about 350 words, holding six rules:
1. End a probe with `Log-Repo` (or `run.py --log`), never with a question.
2. When the log has gone quiet, the token may be the fault, so the probe must end on screen.
3. Ask only what the repo cannot answer.
4. When an observation is needed, use `Probe-Watch`: brief, fire, ask.
5. Stamp `#BUILD#` and read verdicts with `tools/log.py`.
6. End the reply by showing the log rows.

Delete the 2026-08-23 "Come on" narrative (414-421). It is also in `workflows/README.md:366-371`, which proposal 2 removes. Delete the "This is why `Probe-Step` was not enough" paragraph (445-453) and the "Confirming an install was never the problem" backstory (340-347). Cut the ladder's rung-0 example (49-55, the `Check-🎟️GitHubToken` 2026-09-14 story) to its clause: "search the corpus for an existing probe first".

**Rationale:** Five places state one idea: a diagnostic must return its own answer through the repo. The "fails silently" warning in the ladder (64-76) and the "channel is a local notification on purpose" rationale are the same point, and `check-api-reply` now enforces it mechanically. `CLAUDE.md` is loaded every session, so each duplicated sentence has a per-session cost.

**Evidence:** `CLAUDE.md:64-76` vs `:389-402` (both explain `Log-Repo` writes the clipboard first). `:404-412` vs `:441-443` ("ask only what the repo cannot answer" stated twice). `:414-421` vs `workflows/README.md:366-371` (same episode).

**Words removed:** about 800 (1,243 across the spans → about 450).

**Inbound dependencies:** `workflows/README.md:371` links `CLAUDE.md#a-diagnostic-returns-itself`. Proposal 2 deletes that link, or else it must point at the new anchor. The grep found 3 hits for `CLAUDE.md#a-diagnostic-returns-itself`. The others are in `web-tools-private/sessions/` records, which are dated and out of scope. `docs/SNAGS.md` entries point at `CLAUDE.md` by file.

**Risk:** Low to medium. Keep the anchor name `a-diagnostic-returns-itself` for the merged heading, so existing links resolve.

## 6. README: turn the tool essays into a command table that links to the docstrings

**Repo:** shortcut-tools

**Targets:** `README.md` sections "Sending a page, not a chain" (64-101), "Running a shortcut, not sending anything" (103-152), "Menus with icons" (154-186), and the tool paragraph of "Reading a library back" (188-218).

**Kind:** link-to-owner

**Proposal:** Replace the four sections with one table of about 10 rows, "Tool | Sends or reads | Details in", pointing at each script's docstring (`tools/show.py`, `tools/run.py`, `tools/vcard.py` via `menus/README.md`, `tools/index-dump.py`, `tools/survey.py`, `tools/sketch.py`, `tools/restore.py`, `tools/harvest.py`). Keep two sentences from "Reading a library back": what an export cannot restore, which is why deletion is a decision. The "library as an app view" and "Deletion is the fourth step" sections stay, because `CLAUDE.md` and `web-tools-private/shortcuts/README.md:122` link to them.

**Rationale:** Each section restates its tool's docstring nearly word for word, so two copies drift. "Sending a page" repeats `tools/show.py:1-24`: the 1.7x cost, `DecompressionStream`, and placeholders surviving compression. It also repeats `docs/shortcuts-format-notes.md:400-425`. "Running a shortcut" repeats `tools/run.py:1-45`: `Run-Steps`, the first pass with no `Carry`, the `--pick` audit, "lost a fortnight to two of them going stale", and `--log`. "Menus with icons" repeats `docs/shortcuts-format-notes.md:596-597` verbatim ("Choose from List shows one plain line per row. Given **contacts** ...") and the same 2,594 / 1,172 / 425 encoder table (`:632-640`).

**Evidence:** Quoted spans above. `README.md:120-126` vs `tools/run.py:31-37`. `README.md:92-98` vs `tools/show.py:19-24`.

**Words removed:** about 1,150 (324 + 473 + 248 + about 150 of 269, less a table of about 100).

**Inbound dependencies:** `menus/README.md:14` links `../README.md#menus-with-icons`. Retarget it to `../docs/shortcuts-format-notes.md#a-menu-with-icons-is-a-list-of-contacts-coerced-in-place`. `README.md:296` links into the format notes and is unaffected. No external links to the other three anchors were found.

**Risk:** Low. Docstrings are the maintained copy, since they sit next to the code.

## 7. Format notes: collapse the library-management and coprocessor sections to their findings

**Repo:** shortcut-tools

**Targets:** In `docs/shortcuts-format-notes.md`:
- "The library-management actions address an App Intents entity" (1486-1815, 2,588 words), including the subsections "The device lists apps" (1602-1648, with a `[!WARNING] Wrong 2026-08-30` banner), "The `platforms` field" (1649-1696), "The four sources checked before it" (1728-1760), and the `CreateFolderAction` "was wrong, and the way it was wrong is the point" passage (1778-1815)
- In "The browser is a coprocessor": the empty-run post-mortem (1117-1146), the "Withdrawn 2026-08-29" paragraph (1182-1189), and the entity-slot aside (1072-1085)

**Kind:** collapse-narrative

**Proposal:** Rewrite the library-management section to its measured content:
- the entity-key table
- the `AppIntentDescriptor` block
- find-then-act with the variable-binding XML
- one ToolKit paragraph: what it has (keys and types), what it lacks (serialization, third-party parameters), and the `coverage.py` command
- one "catalog presence is not runtime availability" rule, with the two-row disagreement table (`filter.apps`, `extracttextfromimage`)
- `CreateFolderAction` as current fact: plain-text `name`, output fills a Move folder slot, refuses an existing folder

Merge "The device lists apps" into the platforms rule. It becomes one sentence: there is no action inventory, and no route to the app list on iOS. Delete "The four sources checked before it" (history of a superseded search) and the Cherri correction. In the coprocessor section, replace the post-mortem with one sentence: "`plist.py` and `pack.py` share `resolve`, and `test/plist.test.js` fails on a shipped `$file` key". Delete the Withdrawn paragraph.

**Rationale:** The section is the longest in the file and argues with itself. A banner corrects the subsection it sits on, a subsection corrects the one above it "the same day it was written" (1650-1651), and a closing passage corrects an earlier claim about `folder`. It is also stale. It says `CreateFolderAction`'s output "is untested" (line 1804), while `workflows/README.md:97` records it measured on 2026-09-14, including that the create refuses an existing folder. The ToolKit counts (2,731 / 2,585 / 774) are restated in `CLAUDE.md:85-88`. Rule 1 there should keep the command and drop the counts.

**Evidence:** Line refs above. `docs/shortcuts-format-notes.md:1607-1613` (the WARNING banner). `:1732` ("the conclusion drawn from it ... was wrong"). `:1750` ("*Correcting an earlier claim in this file:*"). `:1787` ("**That was wrong, and the way it was wrong is the point.**"). `:1130-1136` (the orphans lesson, already stated in `CLAUDE.md:237-244`).

**Words removed:** about 1,900 (library-management 2,588 → about 1,000. Coprocessor about 550 → about 60. `CLAUDE.md` rule 1 about 50).

**Inbound dependencies:**
- `web-tools-private/device/README.md:11` links `#the-platforms-field-is-not-a-runtime-claim`. Keep that heading as the merged rule's heading.
- `README.md:296` links `#the-library-management-actions-address-an-app-intents-entity-not-a-name`. Keep that heading.
- Links to `#the-coercion-route-settled-on-device-2026-08-28` and `#the-browser-is-a-coprocessor-not-only-a-destination` appear only as branch URLs in dated or session records. Keep both headings anyway.
- `tools/doc-index.py` regenerates the index.
- `pages/library.html`'s Reference facet renders `docs/` and needs no change.

**Risk:** Low to medium. This is the format record, so every measured value must survive. The cut removes provenance and self-correction, not measurements.

## 8. Idioms: delete the stale findings list and the self-audit, keep the idioms

**Repo:** shortcut-tools

**Targets:** `docs/idioms.md` "What the corpus says is wrong" (252-295), "The recommendation, after checking" (296-316), and "What imported shortcuts do better" (234-251). Also the reach-audit paragraph in the intro (7-21).

**Kind:** delete

**Proposal:**
- **"What the corpus says is wrong"**: delete it. Point to `python3 tools/survey.py --dangling` for dangling names and to the survey's Sediment tier for duplicates.
- **"What imported shortcuts do better"**: delete it and keep the idea in one place. `workflows/self-name.json` and `workflows/trace.json` exist, and their labels plus one sentence in "What a core library has to keep" (item 7 already names rename-safety) cover it.
- **"The recommendation, after checking"**: cut it to its one standing rule, "a claim about the design cites shortcuts in the core; a claim about the corpus says so", and move that rule into the intro in place of the reach-audit paragraph.
- **The core-size caveat**: the "core is a floor, 42 / 48 / 57" point is already stated in `README.md:216-218`, so link it.

**Rationale:** The findings list is a 2026-08-13 snapshot, and parts of it are now false:
- It lists `Speak-Text` as a dangling name, but `workflows/speak-text.json` now fills it. The table row at `workflows/README.md:70` says "it fills a name `Show-Loop` has been calling all along".
- It lists `Use-RecentShortcut` as ambiguous, but `CLAUDE.md:254-256` records it renamed to `Open-RecentShortcut`.
- It carries a struck-through "Wrong 2026-08-13" item kept "because the lesson is the reusable part", the same annotation habit the home repo retired.

`CLAUDE.md:195-198` names this file as the specification for authoring chains. Only idioms 1-9 and the keep-list serve that purpose.

**Evidence:** Line refs above. `docs/idioms.md:281-288` (the strikethrough item). `docs/idioms.md:238-250` vs `workflows/README.md:229-250` (the duplicate, also cited in proposal 2).

**Words removed:** about 750 (400 + 143 + 207 → about 40, plus about 60 from the intro).

**Inbound dependencies:** `CLAUDE.md:195` and `README.md:47` link the file, not these sections. `README.md:47` says the file "records the four claims that did not survive being checked". Drop that clause. No anchor links to the deleted headings were found.

**Risk:** Low.

## 9. SNAGS: stop generating the entry text twice

**Repo:** shortcut-tools

**Targets:** `docs/SNAGS.md:28-49` (the generated index table's "what it was" column) and `tools/snags-index.py`. Also the "Backfilled 2026-09-14" paragraph (22-25).

**Kind:** restructure

**Proposal:** Change `snags-index.py` to emit only `snag` (linked to its `## slug` anchor), the count, and `last seen`, and drop the "what it was" column. That column copies each entry's first line verbatim, so every snag is written twice in one file. Cut the header's intake paragraphs (3-20) to about 60 words: the entry shape, the recurrence rule, and the generator command. Delete the backfill paragraph.

**Rationale:** The index exists to rank repeats. The entry below it already holds the sentence. For example, the table row at line 49 and the body at 57-59 are identical for `gate-narrower-than-its-own-claim`. The `CLAUDE.md` "Snags" section (379-387) also restates the intake rule, and can shrink to one line pointing at the file header.

**Evidence:** `docs/SNAGS.md:49` vs `:57`. The index block is 717 words and the bodies are 791.

**Words removed:** about 600 in `SNAGS.md` (a table column of about 500, the header about 100), plus about 50 in `CLAUDE.md`.

**Inbound dependencies:**
- `tools/snags-index.py` writes the block.
- `test/snags-index.test.js` checks it and must be updated with the generator.
- `tools/snags-index.py` also reads `catalog.json`.
- web-tools' snags readers, if any, parse the `## slug` bodies and not the table. Confirm this before the change.

**Risk:** Low. It is a generator change and a test update.

## Not proposed, and why

- **`docs/dataflow.md` (639 words), `menus/README.md` and `proposals/README.md`** are short, single-purpose, and not restated elsewhere, apart from the menu overlap handled in proposal 6.
- **`CLAUDE.md` "Generated artifacts"** keeps its rule. Its "reason this needed fixing on 2026-08-27" paragraph (237-244, 108 words) could collapse to its last sentence, "where two things state one invariant, the cheaper one being weaker is a wrong answer". This is a small trim, so it is listed here and not as a proposal.
- **`CLAUDE.md` opening paragraph (1-12)** restates the plugin delivery history that `home/CLAUDE.md` and `web-tools/CLAUDE.md` each already carry. It could shrink to one sentence ("the portable conventions arrive through `/portable:default`"), removing about 60 words.
