# Verdicts: wt-lib

## 1. Delete the per-kit sections of `lib/kits/README.md`

**Verdict:** revise

**Checked:** The self-description holds: `lib/kits/README.md:63-64` says the sections "cover only some kits" and that "Each kit is documented in its own header comment." `ls lib/kits/*.js | wc -l` is 100 and `docs/kits.csv` has 101 lines. The `build.js` drift is real: README lines 408-409 say `bake` rewrites "the page's gh-api.js import to a data: URL", line 427 says it rewrites the `lib/entry.js` import call, and the `lib/build.js` header (lines 23-28) says `blob:`. The `lib/build.js` header itself still says "same strip+wrap+execute" at line 11, so the header is not a clean owner either. There are 24 `###` kit sections, not 23. `sed -n '56,$p' | wc -w` gives 11,788, which matches.

The fold-in is badly under-scoped. I compared each kit's leading comment block to its README section. The reader names three thin headers (`io.js` 3 lines, `treemap.js` 4, `messaging.js`). But several more headers carry none of the API the README carries:
- `xlsx.js`: 21 header lines, no API. The README section (1,026 words) holds the whole `readZip`, `sheetLayout`, `workbookNotes`, `cellStyle`, `dxfStyle`, `cfApplies` surface, plus the "three boundaries" (expression rules skipped, VML not read, defined-name lists return null), the legacy-comments rels walk, and the 2026-09-14 formula-text contract. None of that is in the header.
- `pdf.js`: 28 header lines naming only `open, geom, stream, lattice, doc, config`. The README (892 words) holds the `loadPdfjs`/`loadPdfLib` split, the rule that a viewer should not call `open()`, and the full `d.items`/`d.paths` shape.
- `wring.js`: 18 lines with three example calls, and its own last line says "Documented in lib/kits/README.md" (`wring.js:18`). The reader lists it as a header that "already carries the API". It does not; the README section is 417 words.
- `persistence.js`: the header covers `save`/`load` and path syntax. The README's "Collections" and "IndexedDB introspection" subsections are not in the header block (there is an inline comment at `persistence.js:210`).
- `data-shelf.js` (9 lines), `wsl.js` (10) and `wsl-core.js` (13) are also thin.

Missed inbound claims that become false: `docs/code-layers.md:103` says "`lib/kits/README.md` carries the per-kit table", and root `README.md:255-257` says the file holds "What each kit exposes on `window`, with usage examples; the full list lives there". `archive/wring/export/README.md:13,24` tells a reader to append a section to "Current kits"; it is archive, so it can stay. No test or script parses the file (`grep` over `tools/test`, `tools/build`, `scripts`, `.githooks`).

**Revised proposal:** Delete the 24 sections and "Salvage status", but first fold the API blocks and the stated boundaries into the headers of at least `xlsx.js`, `pdf.js`, `wring.js`, `persistence.js`, `io.js`, `treemap.js`, `data-shelf.js`, `wsl.js` and `wsl-core.js`. Leave the headers that already carry their design (`annotate`, `md-doc`, `peek`, `docx`, `dictate`, `export`, `brief`) alone and drop the README history. Fix the stale "strip+wrap+execute" line in `lib/build.js:11` in the same pass. Retarget `docs/code-layers.md:103` and `README.md:218,255-257` to the Kits tab and `docs/kits.csv`. Drop the "documented in lib/kits/README.md" lines in `io.js:3` and `wring.js:18`.

**Corrected words removed:** about 11,790 from the README. Roughly 3,000 to 3,500 of those move into code headers (the xlsx, pdf, wring and persistence sections alone are about 2,660), so the net reduction is about 8,300, not 10,800.

## 2. Collapse `console/README.md`'s per-mod sections to a table

**Verdict:** revise

**Checked:** `sed -n 55,343p console/README.md | wc -w` gives 1,707. There are 19 `###` mod sections (lines 57-332), not 18. Every mod in `console/mods/` has a header of 9 to 31 lines, and `console/suite.js` keeps all 20 headers (`grep -c '^// console/mods' console/suite.js` is 20), so the claim that the header is what a user sees holds. The `scan` overlap is real (`scan.js:1-22` against `README.md:214-243`). The only inbound references are root `README.md`, `tools/test/tests-registry.test.mjs:200` (a comment about the Testing section, which stays) and the generated `docs/themes.csv`.

The sections are not pure copies. Facts in the README that the headers lack: for `tap`, "Requests pass through untouched (responses are cloned)", `walk`'s `delay` default of 250 ms, and "GETs only, tap doesn't record request bodies" (`README.md:137-162` against `tap.js:1-23`). For `scan`, `scan.db(name)` and the `glom-scan` default database, `{compress:true}`, `scan.chat()`, and the key-stability advice (`README.md:228-243`). The larger README sections (`query` 189 words, `templates` 122, `tap` 159) are likely to hold more of this.

**Revised proposal:** Before replacing the sections with the table, diff each section against its mod header and move any fact the header lacks into the header. Then replace lines 55-343 with the one-line-per-mod table. The layout paragraph at lines 34-41 already gives the find, dance, grab loop across mods, so the table needs no prose of its own.

**Corrected words removed:** about 1,400 (1,707 minus a table of about 250, minus a few dozen words moved into headers).

## 3. Cut the kit rows out of `docs/loader.md`'s ambient-surface table, and the BOOT copy

**Verdict:** revise

**Checked:** The table is at `docs/loader.md:166-196`. The BOOT copy at lines 107-114 has already drifted: it says "as of 2026-09-08 it runs eight", but `lib/gh-boot.js:24-72` now lists nine entries, adding `kits/assistant-mark.js`. That strengthens the case for cutting the copy. All seven page-loaded kit namespaces the proposal names have a row in `docs/kits.csv`.

One row is misclassified. `Traffic` comes from `kits/traffic.js`, which is in `BOOT` (`gh-boot.js:53`: "this cannot be a lazy load"). The proposal both says it keeps "only the rows that the boot chain installs" and lists `Traffic` for removal. Removing it would contradict its own rule. The table also already omits four boot-installed namespaces (`SourcePeek`, the repo-address kit, the Claude mark, the assistant mark), so "A new global with no row here is a doc bug", even scoped to boot globals, is already broken today. `TransformWorkbench` is an Alpine component and has no `kits.csv` row, so the kits pointer does not cover it. The row for `chatRender` names `chat-render.js`, whose real path is `lib/kits/chat-render.js`.

**Revised proposal:** Remove the rows for `proof`, `chatRender`, `sessionRender`, `swipeDeck`, `TransformWorkbench`, `Annotate` and `Dictate`. Keep `Traffic`. Point the last row at the Kits tab and `docs/kits.csv` for kit namespaces, and at `lib/alpineComponents/` for components. Replace the BOOT list with "the `BOOT` array at the top of `lib/gh-boot.js`". Either add rows for the four missing boot-installed kit namespaces or reword the rule to "every global installed by `gh-api.js` or `gh-boot.js` itself has a row; kit namespaces in `BOOT` are listed in `kits.csv`, where `boot` is `yes`". The second is cheaper and uses a column that already exists.

**Corrected words removed:** about 330 (300 in the seven rows plus 70 in the BOOT list, minus about 40 of replacement text).

## 4. Delete `docs/loader.md`'s "Options" and "Alp-style capability" sections

**Verdict:** keep

**Checked:** `sed -n 463,575p docs/loader.md | wc -w` gives 737. The stale claims hold: no `compression/` folder exists (`ls -d compression` fails), `lib/kits/compression.js` and `lib/kits/demos/compression.html` exist, and `persistence.js` wraps idb-keyval (`persistence.js:1-3`). No inbound anchors: the only `loader.md#` links across web-tools, home and shortcut-tools are `#consumers-in-other-repos` (`docs/SNAGS.md:837`) and `#previewing-branch-html` (home `projects/doc-audit/viewer/`, a dated packet, and that heading no longer exists in `loader.md` anyway). The "Option A" hit in `tracker/tasks/lib-root-kit-migration-dind5t.md:60` refers to that task's own options, not these.

Two small things to carry: the Option B placement rule (read helpers in `gh-fetch.js`, writes in `gh-store.js`, only plumbing in `gh-api.js`) is already described at `loader.md:97-99`, so nothing is lost. `loader.md:410-413` ("the ESM-vs-`gh.load` choice in the options below") points at these sections, so that clause must go in the same edit. Proposal 6 cuts that paragraph anyway.

**Corrected words removed:** about 710.

## 5. State the loadable-file contract once

**Verdict:** revise

**Checked:** The four statements exist: the numbered rules at `loader.md:249-270`, "What breaks the pattern" at `:346-374` (274 words), the checklist at `:576-606` (210 words), and the kits shape rules at `lib/kits/README.md:39-52` (101 words). The strip history at `:233-247` is 144 words. The duplication is real.

Two specifics are wrong. The `gh-auth.js` bullet is at `loader.md:130-145`, not `:97-113`; lines 97-113 are the `gh-api.js`, `entry.js` and `gh-boot.js` bullets. The boot-failure half does repeat invariant 7 (`:308-320`). The unpkg claim is misattributed: `tools/test/no-own-cdn.test.mjs` bans the jsDelivr `/gh/` route for own code (`no-own-cdn.test.mjs:29`) and says nothing about third-party imports, so unpkg in rule 4 breaks no test. It is only out of step with the house preference for jsDelivr and with what the kits actually do (`io.js:9`).

Content that must survive the merge: "Relying on `Alpine.store('…')` at file top level" appears only in "What breaks" (`:370-374`). The checklist's closing code block imports `.../compression/text.js`, a path that does not exist, and uses a bare `gh-api.js` import instead of `entry.js`, so it should be dropped, not merged.

**Revised proposal:** As written, with the `gh-auth.js` cite corrected to `:130-145`, the unpkg rationale replaced by "the house CDN is jsDelivr", the `Alpine.store` footgun kept in the merged list, and the checklist's mixing example deleted.

**Corrected words removed:** about 550.

## 6. Give "load versus build" one owner: `tools/README.md`

**Verdict:** revise

**Checked:** `loader.md:376-418` is 360 words. `tools/README.md` "Where the build sits" is 306, "Vocabulary" 147, "The pre-build" 353. The duplicated import pair is real (`tools/README.md:136-139` and `:184-187`). The stale `data:` claim is real: `tools/README.md:159-160` says `bake` rewrites the `gh-api.js` import to a `data:` module, while `lib/build.js:26,130-132` says it is a `blob:` URL and "It used to be a data: URL". The "same strip+wrap+execute" phrase is at `tools/README.md:111` and also in `lib/build.js:11`, which the proposal misses.

The anchor inventory is wrong in detail. `#load-and-build-are-one-contract` is linked from `loader.md:30` and `:362`, not `:412` or `:363`. `#the-pre-build` is linked from CLAUDE.md, `tools/README.md:61` and `docs/SNAGS.md:636`. `#the-apps-pre-build` is linked from `tools/README.md:62` and must survive the merge.

One rule is at risk. Web-tools CLAUDE.md says `docs/loader.md` "is also the argument that load and build are two readings of one set of rules, which is why the pre-build works at all". Cutting the section to its two consequences removes that argument from the file CLAUDE.md names.

Further stale text in the same span: the Vocabulary heading says "load → build → bake → pack" while its list's fourth verb is `export`. `tools/README.md:77` (and `:231`) says "`dist/` and `tools/.preview/` are gitignored", but `.gitignore:6-9` un-ignores `dist/web-tools.js`, `dist/app.js` and `dist/dictate.js`, and all three are tracked. `tools/build/bake.mjs:9` names `kits/bundle.js`, which does not exist.

**Revised proposal:** Cut the `loader.md` section to one sentence of the thesis (the build is the loader with `get` reading from a cache, so a loadable file is buildable) plus the two consequences and a link, about 100 words. Keep the heading. Merge the three `tools/README.md` sections as proposed, keeping `#the-pre-build` and `#the-apps-pre-build`. In the same pass, fix the `data:` claim, drop "strip+wrap+execute" from both `tools/README.md:111` and `lib/build.js:11`, fix the "pack" heading, correct the gitignore sentence, and fix `bake.mjs:9`.

**Corrected words removed:** about 600 (about 260 from `loader.md`, about 350 from `tools/README.md`).

## 7. Stop hand-copying the commit-hook legs in `tools/README.md`, and collapse its narratives

**Verdict:** revise

**Checked:** "The refresh model" is `tools/README.md:267-393`, 1,227 words. `grep '^# --- leg' .githooks/pre-commit` gives 18 legs against 13 table rows. The missing legs are as stated: `dist/dictate.js`, `dist/app.js`, the data census, reading columns and SUNSET markers. The hook header (`pre-commit:5-7`) lists three legs. The `stage()` story is told in both places. The thumbnails paragraph cites CLAUDE.md "Wrapping up", a section that does not exist; the owner is "Per-session refresh".

The replacement is weaker than the proposal implies. The hook's own labels are not a clean list: two legs are both labelled `leg 1b` (`pre-commit:109` and `:134`), `1a` comes after the first `1b`, and the `3` legs run `3a, 3e, 3d, 3b`. A reader told to run the grep gets a confusing list. The labels need fixing if they are to be the owner.

The word count is overstated. The table and the two paragraphs after it are 239 words, not about 450. Those two paragraphs carry rules the proposal does not re-home: four registries are hand-edited except for stamped fields, and `docs-reach` runs twice because `docs/README.md` is both generated and a registry row. `docs/registries.md:109` covers computed fields in general but not this list. The `stage()`, tracker-board and thumbnails paragraphs are 89, 93 and 89 words.

**Revised proposal:** Replace the table with the pointer sentence, but first renumber the hook's legs so the labels are unique and in run order, and make the hook header say "see the `# --- leg` headings below" rather than listing three. Keep the stamped-fields sentence and the `docs-reach` cycle sentence. Keep the ordering rule. Collapse `stage()`, tracker-board and thumbnails as proposed, and point the thumbnails line at CLAUDE.md "Per-session refresh".

**Corrected words removed:** about 400 (about 170 from the table span, about 230 from the three narratives).

## 8. Strip `docs/code-layers.md` to the rule and the table

**Verdict:** revise

**Checked:** Word counts hold: intro 198, migration 76, "Why this rule" 171, `concept-lab`/`semsearch` 176. `pages/guides/code-layers.html:177,630-639` holds both retracted rules with figures.

The guide page is not a safe owner for the numbers, because the two copies already disagree. `code-layers.md:60` says "7 of 21 kits had one" hub runtime dependency; `pages/guides/code-layers.html:634` says "Five of twenty-one kits". The replacement sentence should not quote either figure without re-deriving it.

The kits README cut is mis-specified. The proposal deletes `lib/kits/README.md:17-36` and also keeps "the 'no Alpine and no DOM opinions' line and the component-wrapper sentence". Those sentences are at lines 30-37, inside the deleted range. The history to cut is lines 17-28 (about 130 words) plus the "This entry used to say 'no DOM rendering'" clause.

The `semsearch.py` paragraph ends on a rule that applies forward: "an exploratory folder with no stated exit condition is how a repo accumulates permanent prototypes" (`code-layers.md:175-177`). It is stated nowhere else in the slice, and it belongs in the `tools/` section that stays.

**Revised proposal:** As written for `code-layers.md`, but keep the exploratory-folder sentence in "tools/, which is the weak layer" and drop the retracted-rule figures rather than moving them. In `lib/kits/README.md`, delete lines 17-28 and the "used to say" clause, and keep lines 30-37 otherwise intact.

**Corrected words removed:** about 610 (about 480 from `code-layers.md`, about 130 from the kits README).

## 9. Turn `docs/text-content.md` into a dated record and keep a short living statement

**Verdict:** revise

**Checked:** 6,311 words. `docs/docs.csv:82` classes it `measured`, and `docs/README.md:8-10` defines that as "carries dated observations and is corrected by re-probing". The field table at `:345-359` has 13 names, and `docs/text-fields.csv` has 13 rows plus a header, so it is a real restatement.

The inbound list misses the readers that treat parts of this file as live instructions:
- `tracker/tasks/comment-trim-rule-first-b0o3bu.md` (status `backlog`) says at line 73 "Pilot lessons live in `docs/text-content.md`, 'What the pilot taught about running the pass'", and cites "Is it true?" at line 12.
- `docs/SNAGS.md:503,516` (`rewriter-marks-its-own-work`, `header-essay-outlives-its-code`, and `docs/snags.csv:36-37`) use `→ text-content.md` to name where the fix lives.
- `tracker/tasks/estate-js-commentary-read-mymt4u.md:24,37,40` and `split-stage-contract-74a7vh.md:19` cite the file for a method.

"What the pilot taught" (`:689` on) states rules for an open task: a rewriter marking its own work is not evidence, and the unit is a writer plus an adversary. Moving it to a dated record would leave two snag arrows and a backlog task pointing at a record for a live rule.

The kept statement also needs more than the proposal lists. "Conformance by declaration, not by rename" (`:369-404`) holds three rules for the vocabulary: an existing file conforms through `instead_of` aliases, a name is added only when a file holds a kind the set lacks and the test's count moves in the same commit, and aliases come from observed names via `--offvocab`. `text-fields-registry.test.mjs:69` tells a failing author to "say why in docs/text-content.md", which needs that section to exist. The opening "Three kinds" block alone is 319 words, so 400 is not realistic.

**Revised proposal:** Keep in the living file the instrument commands, the "Three kinds" table, the gate rule, the three conformance rules, and the pilot's two operating rules, about 800 words, with a link to `docs/text-fields.csv`. Move Part 1, Part 2, the violators, the worked example, the gate proposal, "Is it true?" and the history section to a dated record. Delete the 13-row field table. Retarget `app/index.html:15` and the "Is it true?" link in task `b0o3bu` to the record. Leave the snag arrows on the living file, since the rules they point to stay there. Set `docs.csv:82` to `living` and add a row for the record.

**Corrected words removed:** about 5,500 from the living doc, nearly all moved rather than deleted.

## 10. Remove the "full list" and demo claims that the Kits tab now answers

**Verdict:** revise

**Checked:** `README.md:218` says the kits README "is the full list". The Salvage table has 21 rows against 100 kits and uses `kits/demos/…` paths (`lib/kits/README.md:1455-1477`). `tools/build/kits-index.mjs:4-8` records the stale demo index.

The follow-through list is incomplete. Two code comments cite the README as the source of the header-is-authoritative rule: `tools/build/kits-index.mjs:10` ("lib/kits/README.md says so") and `lib/alpineComponents/map.js:336-340`. The sentence they cite is `lib/kits/README.md:63-64`, which proposal 1 deletes because it keeps only lines 58-62. Also missed: `README.md:255-257` ("What each kit exposes on `window`, with usage examples; the full list lives there") and `docs/code-layers.md:103` ("carries the per-kit table").

**Revised proposal:** Retarget `README.md:218`, `README.md:255-257`, `docs/code-layers.md:103` and `docs/loader.md:195` to the Kits tab and `docs/kits.csv`. Keep one sentence in the kits README stating that each kit's header comment is its authoritative doc, so the two code comments stay true.

**Corrected words removed:** 0 beyond proposal 1 (about 60 words rewritten).

## Missed

**The `lib/ops/` section of `docs/code-layers.md` restates `lib/ops/README.md`.** `code-layers.md:105-134` is 298 words. Its first paragraph is `lib/ops/README.md:3-7` reworded (one file, one value, one function expression, no `window` or `document`, the caller evaluates the text). Its second paragraph is `lib/ops/README.md:9-14` (the phone runner, `Run-Op`, `Get-FromJs`). Its third already defers to the README for the two derived rules. Proposal 8 keeps this section whole. The layers table at `code-layers.md:28` already carries the admission rule, so the section can shrink to the one argument the README lacks (why an op is a layer and not a stricter kit) plus the 27-of-66 measurement, and a link. That removes about 180 words.

**Proposals 1 and 2 move prose into the place the estate has measured as least accurate.** `docs/SNAGS.md:505-516` (`header-essay-outlives-its-code`, seen 2026-09-08) found that a module header was "the least accurate prose in each" of six files read, with `swipe-deck.js` documenting fourteen options where the code reads twenty. Its fix line: "A header states a contract, so check it against the code when the contract changes; a criterion belongs at the line it governs, not restated up top." Folding 3,000 or more README words into headers grows exactly those header essays. Folding should move the API block and the stated boundaries only, check each against the code as it lands, and drop the dated history rather than relocating it.

**Stale mechanism text sits in code headers the slice does not list.** `lib/build.js:11` still says "same strip+wrap+execute", which `loader.md:233-247` says was removed. `tools/build/bake.mjs:9` names `kits/bundle.js`, which does not exist. `lib/gh-boot.js:3` says entries live there so `gh-api.js` need not be purged "from the jsDelivr cache", a route `tools/test/no-own-cdn.test.mjs` now bans for own code. If the headers become the owners, as proposals 1 and 6 intend, these need the same correction pass.

No large simplification beyond these stands out. `pages/README.md` (1,300 words) is generated by `pages-index.mjs`. The `gold-set/` files are per-document results and records. `console/LINEAGE.md` is history by design and its README names it as such.
