# Slice: wt-lib

**Summary.** This slice is the web-tools library and build documentation: `lib/kits/README.md` (12,210 words), `docs/text-content.md` (6,311), `docs/loader.md` (5,313), `scripts/annotate/LOG.md` (4,423), `tools/README.md` (3,813), `console/README.md` (2,204), `docs/code-layers.md` (1,718), and the smaller READMEs under `lib/`, `pages/`, `gold-set/`, `sites/` and `data/`. The total is about 44,000 words. The main source of bloat is **API documentation copied out of code headers**. The kit shelf and the console mods each carry a header comment per file, and the READMEs repeat those headers at length. The kits README says so itself at line 64: "Each kit is documented in its own header comment." The second source is **one contract stated three or four times**: the loadable-file rules, the load-versus-build split, and the commit-hook legs. The copies have already drifted apart. The third is **dated research written up as a living doc**: `docs/text-content.md` is a measurement report that keeps gaining dated sections. The ten proposals below remove about 22,000 words. `scripts/annotate/LOG.md` is left alone: it is an append-only dated log with its own rule for when a lesson moves out ("a third time earns a change to `SKILL.md`"), so it counts as a dated record.

## 1. Delete the per-kit sections of `lib/kits/README.md`

**Repo:** web-tools

**Targets:** `lib/kits/README.md:56-1445` ("Current kits" and its 23 `###` sections) and `:1446-end` ("Salvage status").

**Kind:** delete (with a small fold-in to code headers)

**Proposal:** Keep "Concept" (reduced further by proposal 5) and the three-line pointer to the Map view's Kits tab and `docs/kits.csv` (lines 58-62). Delete every `###` kit section and the "Salvage status" table. Before deleting, check each of the 23 sections against its kit's header. If the section's ```` ```js ```` API block is missing from the header, move it into the header. Three headers are thin enough to need this: `io.js` (3 comment lines), `treemap.js` (4) and `messaging.js`. Headers that already carry the API need nothing: `build.js`, `annotate.js`, `wring.js`, `persistence.js`. After the move, change the headers that say "documented in lib/kits/README.md" (`lib/kits/io.js:3`, `lib/kits/wring.js:18`) to say nothing, since the header is now the doc.

**Rationale:** The README states its own obsolescence at lines 63-64: "The sections below cover only some kits. They were written before the 2026-08-08 migration. Each kit is documented in its own header comment." The sections cover 23 of the 100 kits, and the "Salvage status" table covers 21. `docs/kits.csv` already has one row per kit with namespace, gloss (taken from the header), demo, users and tested. `tools/build/kits-index.mjs:10` and `lib/alpineComponents/map.js:336-340` both say the header is authoritative "so the tab reads it rather than keeping a second sentence that would age beside it." The README sections are that second copy, and they have aged:
- `build.js` is documented three times, and the copies disagree. The README section says `bake` rewrites "the page's gh-api.js import to a data: URL" (line ~410). Its own later paragraph says `bake` rewrites the `lib/entry.js` import call. The `lib/build.js` header says the build becomes a `blob:` URL.
- The `annotate.js` section (1,880 words) is mostly UI history ("It used to be on screen twice", "measured 2026-08-30, a 260px scroll produced exactly 260px of drift", "The FAB drawer's Notes tab is retired (2026-08-25)"). The `annotate.js` header (5,116-line file) carries the same design at greater length.

**Evidence:** Per-section word counts: annotate 1,880, docx 1,047, xlsx 1,032, pdf 896, peek 823, md-doc 807, xlsx-write 738, xlsx-extract 575, export 434, wring 426, build.js 379, persistence 334, brief 330, dictate 305, and nine more under 210. `ls lib/kits/*.js | wc -l` gives 100. `grep -c . docs/kits.csv` gives 101 (one header row plus 100 kits).

**Words removed:** about 11,790 (`sed -n 56,2000p lib/kits/README.md | wc -w`, minus the kept pointer). Roughly 1,000 of these words move into code headers as API blocks, so the net reduction across the repo is about 10,800.

**Inbound dependencies:** No script parses the README. `map.js:343` (`KITS_README`) only links it, and `map.js:2776` titles it "the shelf's admission rule and the shape a kit has to take", which still holds after the cut. Root `README.md:218` says "[kits/README.md] is the full list". That is already false and should point at the Kits tab instead. `README.md:339` ("The file-shape rules are in kits/README.md") still holds. `docs/loader.md:113` and `:195` link the README for kit namespaces; proposal 3 retargets these to `docs/kits.csv`. Nothing in the four repos links an anchor inside the file, apart from session transcripts in `web-tools-private/sessions/`, which are dated records. Tracker tasks `lib-root-kit-migration-dind5t` and `code-layer-taxonomy-q15jp2` mention the file by name only.

**Risk:** Low. The one content risk is an API block that exists only in the README. The fold-in step covers that. The `kits.csv` `words` stamp and `docs/docs.csv` update themselves through the commit hook.

## 2. Collapse `console/README.md`'s per-mod sections to a table

**Repo:** web-tools

**Targets:** `console/README.md:55-343` ("Mods", 18 `###` sections).

**Kind:** link-to-owner

**Proposal:** Replace the 18 sections with a one-line-per-mod table: the mod, a link to its file, and the first sentence of its header. The table can be hand-kept, or `kits-index.mjs`'s gloss extraction can generate it if the owner wants it held. Keep "Layout", "The working set" and "Testing".

**Rationale:** The kit-shelf pattern repeats here. Every mod has a header comment of 9 to 31 lines with a usage block. `console/mods/scan.js:1-20` and `console/README.md:214-243` are the same text: "Every other mod takes one snapshot of the DOM as it is now; scan adds the axis they lack, which is time", with the same `glom.scan.*` call list. The mods are pasted as source, so the header is what a user actually sees.

**Evidence:** `sed -n 55,343p console/README.md | wc -w` gives 1,707. Header comment lengths in the first 40 lines range from 9 lines (`core.js`, `deck.js`) to 31 (`scan.js`).

**Words removed:** about 1,450 (1,707 minus a table of about 250).

**Inbound dependencies:** No anchors into `console/README.md` exist in any of the four repos. `tools/test/tests-registry.test.mjs:200` mentions the README only for `playground-pass.mjs`, which lives in the kept Testing section. `console/suite.js` is built from `mods/`, not from the README.

**Risk:** Low.

## 3. Cut the kit rows out of `docs/loader.md`'s ambient-surface table, and the BOOT copy

**Repo:** web-tools

**Targets:** `docs/loader.md:166-199` (the "ambient surface" table rows for `Traffic`, `proof`, `chatRender`, `sessionRender`, `swipeDeck`, `TransformWorkbench`, `Annotate`, `Dictate`). Also `docs/loader.md:107-114`, the list of the eight `BOOT` entries, which the file itself calls "a copy".

**Kind:** link-to-owner

**Proposal:** Keep only the rows that the boot chain installs on every bootstrap page: `gh`/`GH`, `__bundleRef`, `__consoleLogs`, `__loadedScripts`, `__reads`, `__traffic*`, `__ghFiles`, `ghAuth`, `console.history`, `html` and the DOM helpers, the Alpine stores, and `__builtOffline`. Replace the eight page-loaded kit rows with the existing last row, pointed at the Kits tab and `docs/kits.csv`, whose `namespace` column is derived from each kit's `window.<name> =`. Replace the inline BOOT list at lines 107-113 with "the `BOOT` array at the top of `lib/gh-boot.js`". Keep the rule "A new global with no row here is a doc bug", but scope it to boot-installed globals.

**Rationale:** The table's own premise is "what the boot chain leaves on window". Six of the eight kit rows are not boot-chain at all. `TransformWorkbench` says "Not boot-chain: page-loaded". `Annotate` and `Dictate` are loaded by the FAB on demand. These rows repeat, at length, what the kit headers and `kits.csv` already carry. The `Annotate` row alone is 70 words of UI detail ("the FAB drawer no longer carries a Notes tab"). The loader doc admits the BOOT list is a copy: "Read `BOOT` itself rather than this list, which is a copy."

**Evidence:** `grep -E '^\| \`(Traffic|proof|chatRender|sessionRender|swipeDeck|TransformWorkbench|Annotate|Dictate)\`'` over lines 166-199 gives 329 words. `docs/kits.csv` has `namespace` and `gloss` for all of these except `TransformWorkbench`, which is an Alpine component.

**Words removed:** about 380.

**Inbound dependencies:** None to the table. `swipeDeck`'s row links `#consumers-in-other-repos`, which stays. `tools/test/state-the-rule.test.mjs:748-750` uses `docs/loader.md` as corpus and requires more than 1,000 units across eight documents. A few hundred fewer words does not threaten that floor, but rerun the test.

**Risk:** Low.

## 4. Delete `docs/loader.md`'s "Options" and "Alp-style capability" sections

**Repo:** web-tools

**Targets:** `docs/loader.md:463-575` ("Options for adding new capability", Options A to D, and "Concrete framing for 'pulling in Alp-style capability'").

**Kind:** delete

**Proposal:** Delete both sections. Put one sentence where they were: "Which folder a new file goes in is `docs/code-layers.md`'s question; this doc covers only whether it can load."

**Rationale:** The sections predate `docs/code-layers.md`, which now owns placement ("One statement for the whole repo", `code-layers.md:3`). They contradict the current tree in at least four places:
- Option C recommends ESM for new capability ("ESM is better for anything with internal imports"). It proposes a `foo-kit.js` and `foo-register.js` naming scheme that nothing uses.
- The Alp framing says the compression helpers "can't go through `gh.load`" and belong in a `compression/` folder. They were salvaged as `lib/kits/compression.js`, a `gh.load` kit, and no `compression/` folder exists (`ls compression` fails).
- It proposes a Dexie `storage.js`. The shipped equivalent is `kits/persistence.js` on idb-keyval.
- Option B says `app/index.html` "currently" persists to the home repo. That is an assumption about a file that has since been rebuilt around `dist/app.js`.

The sections are a planning memo from the salvage period that was never retired.

**Evidence:** `sed -n 463,575p docs/loader.md | wc -w` gives 737. `lib/kits/README.md:69-71` records the compression salvage.

**Words removed:** about 720.

**Inbound dependencies:** No anchor links to either section. The only `loader.md#` link in the repo is `docs/SNAGS.md:837` → `#consumers-in-other-repos`, which stays.

**Risk:** Low. The pieces that are still true (keep load paths literal, register before `alpine-bundle.js`) are already stated in "What breaks the pattern".

## 5. State the loadable-file contract once

**Repo:** web-tools

**Targets:** `docs/loader.md:247-270` (the four numbered rules under "The load mechanism"), `:346-374` ("What breaks the pattern"), `:576-606` ("Quick checklist"), `:97-113` (the `gh-auth.js` bullet that repeats timing invariant 7), and `lib/kits/README.md:39-52` (the five "shape rules").

**Kind:** merge

**Proposal:** Keep the four numbered rules in "The load mechanism" as the one statement of what a loaded file must be. Merge "What breaks the pattern" and "Quick checklist" into one short list under that section. Each is currently a restatement of the other in a different shape: both cover no `import`/`export`, `load()` discards return values, keep paths literal, register before `alpine-bundle.js`, and the token sentinel. In `lib/kits/README.md`, replace the five shape rules with the two that are kit-specific (wrap the body in an IIFE; end by assigning `window.<name>`) and a link. In "The load mechanism", cut the history of the strip removal (lines 233-247: "the docs used to describe the opposite... commit `451f963`...") to one clause. In "What each piece contributes", cut the `gh-auth.js` bullet's boot-failure paragraph, which is invariant 7 almost word for word.

**Rationale:** The same six rules appear four times across two files. The checklist even says "End the file with `return X;`", which is the `read()` rule already stated as rule 4. The kits README rule 4 recommends `await import('https://unpkg.com/...')`. The repo test `tools/test/no-own-cdn.test.mjs` and the loader doc point own code to GitHub Pages, so a second copy is where drift like this appears.

**Evidence:** Word counts: "What breaks" 274, checklist 210 (lines 576-606), strip-history 144 (lines 233-247), kits shape rules about 110, `gh-auth` bullet boot-failure half about 90.

**Words removed:** about 500.

**Inbound dependencies:** `tools/test/lib-parses.test.mjs:17` cites `docs/loader.md` in a comment, not an anchor. Root `README.md:339` sends readers to the kits README for "file-shape rules". That still works if the README keeps two rules and a link. No anchors point into the removed sections.

**Risk:** Low. Merging needs care that each footgun survives once. The contract itself does not change.

## 6. Give "load versus build" one owner: `tools/README.md`

**Repo:** web-tools

**Targets:** `docs/loader.md:376-418` ("Load and build are one contract"). Also `tools/README.md:107-146` ("Where the build sits"), `:148-167` ("Vocabulary") and `:169-211` ("The pre-build"), which between them state the load/build split three times. And the kits README `build.js` section, already removed by proposal 1.

**Kind:** merge

**Proposal:** Cut `docs/loader.md`'s section to its two consequences for authors: dependency edges must be string literals, and a native `import()` file does not ride into a build. That is about 60 words plus a link to `tools/README.md#the-pre-build`. In `tools/README.md`, merge "Where the build sits", "Vocabulary" and the first half of "The pre-build" into one section. It should cover the four verbs, one two-line code block showing the `entry.js` import beside the `dist/*.js` import, and where each artifact lives. Delete the second copy of that code block (lines 135-140 and 183-188 are the same pair of imports). Correct "bake rewrites the page's `gh-api.js` import to a `data:` module" (line 159) to match the `lib/build.js` header, which rewrites the `entry.js` import to a `blob:` URL. Drop "same strip+wrap+execute" (line 112). `docs/loader.md:233-247` records that the strip was removed.

**Rationale:** The load/build split is currently explained in `loader.md`, three sections of `tools/README.md`, the kits README and the `lib/build.js` header. Two of those copies describe mechanisms that no longer exist: the `data:` module and the strip. CLAUDE.md already routes the pre-build to `tools/README.md#the-pre-build`, so that file is the owner in practice.

**Evidence:** `docs/loader.md:376-418` gives 364 words. `tools/README.md` sections: 303 + 147 + 355. `tools/README.md:159` versus `lib/build.js` header lines 23-28 show the stale `data:` description.

**Words removed:** about 650 (about 300 from `loader.md` and about 350 from `tools/README.md`).

**Inbound dependencies:** `lib/kits/README.md` (build section, deleted by proposal 1) and `docs/loader.md:412` link `#load-and-build-are-one-contract`. `docs/loader.md:363` and `:30` link the same anchor internally. Keep the heading so the anchor resolves. CLAUDE.md links `tools/README.md#the-pre-build` and `#the-refresh-model`. Keep both headings.

**Risk:** Low to medium. The anchors must be preserved.

## 7. Stop hand-copying the commit-hook legs in `tools/README.md`, and collapse its narratives

**Repo:** web-tools

**Targets:** `tools/README.md:267-393` ("The refresh model").

**Kind:** move-to-data-or-check, plus collapse-narrative

**Proposal:** Replace the 13-row "Source dirty → Generator → Staged" table with one sentence and a link. The sentence: "`.githooks/pre-commit` lists every leg in order under `# --- leg N:` headings; run `grep '^# --- leg' .githooks/pre-commit` for the current list." Keep the one ordering rule (a leg that writes under `docs/` runs above leg 3a) as a single sentence. Collapse these narratives to their rules:
- The `stage()` story (PR #441, two renames, "a month") becomes "every add goes through `stage()`, which reports a missing path". The same story is already told at `.githooks/pre-commit:82-89`.
- The tracker-board paragraph ("the last to get an owner... 2026-08-05... hash randomization") becomes "the suite asserts each generator is deterministic".
- The thumbnails paragraph becomes a link to CLAUDE.md's "Per-session refresh", which owns it. The hook header (`pre-commit:10-16`) says the same thing a third time.

Also align the hook's own header comment (`pre-commit:5-7`), which lists only three legs.

**Rationale:** The table has already drifted. It omits leg 1a (`dist/app.js`), leg 1b (`dist/dictate.js`), leg 4a (the data census), leg 4b (reading columns) and leg 5 (SUNSET markers), all present in `grep '^# --- leg' .githooks/pre-commit`. It is a copy of a list whose owner is executable, and CLAUDE.md already routes readers here "for the legs, the order they run in". The honest fix is to point at the hook, not to add five rows.

**Evidence:** "The refresh model" is 1,225 words. The table and its three follow-on paragraphs are about 450. The `stage()`, tracker-board and thumbnails paragraphs are about 330 together. `grep '^# --- leg' .githooks/pre-commit` lists 18 legs; the table has 13 rows.

**Words removed:** about 650.

**Inbound dependencies:** CLAUDE.md links `tools/README.md#the-refresh-model`. Keep the heading. No script parses the table. `tools/test/derived-artifacts.test.mjs` checks generators directly, not this prose.

**Risk:** Low. A reader loses the at-a-glance table but gains a list that cannot drift. If a table is wanted, a generator over the hook's `# --- leg` lines could emit one, but that would be a new artifact, and the doctrine says to prefer the link.

## 8. Strip `docs/code-layers.md` to the rule and the table

**Repo:** web-tools

**Targets:** `docs/code-layers.md:3-20` (intro history), `:47-55` (migration counts), `:56-72` ("Why this rule and not a better-sounding one"), `:162-180` (the `concept-lab` and `semsearch.py` departure story). Also `lib/kits/README.md:17-36`, the Concept paragraphs that repeat the same history.

**Kind:** collapse-narrative, plus link-to-owner

**Proposal:**
- Keep the layers table, the attachment rule, "Watch the third spelling", "scaffolding wins", "Boot membership is not a folder", the `lib/ops/` section, the `render/scenarios/` rule and "What this document does not do".
- Replace "Why this rule..." with one sentence: attachment is the only property that is mechanical and stable, and the two retracted rules and their measurements are recorded in `pages/guides/code-layers.html`. That page already carries the medians (line 177, line 639) and the retraction text (line 632).
- Cut the migration paragraph to "The tree matches the rule; `tools/test/code-layers.test.mjs` holds it."
- Cut the intro to its first two sentences.
- Delete the `concept-lab` and `semsearch.py` paragraphs. They describe files that left the repo on 2026-08-25, and git and `home` hold that move.
- In `lib/kits/README.md` Concept, delete lines 17-36 (the retracted rules, the 22-kit migration, the old "no DOM rendering" wording) and keep the "no Alpine and no DOM opinions of its own" line and the component-wrapper sentence.

**Rationale:** The history is recorded in three places: `code-layers.md`, the kits README Concept section and the decision guide page. The decision guide is the right owner for rejected alternatives. The living doc needs the rule, not the story of how it was reached.

**Evidence:** Word counts: intro 198, migration 76, "Why this rule" 171, concept-lab and semsearch 176, kits README Concept history about 200. `pages/guides/code-layers.html:177,632,639` holds the retracted rules and their figures.

**Words removed:** about 700 (about 500 from `code-layers.md` and about 200 from the kits README).

**Inbound dependencies:** `docs/docs.csv:18` describes the file ("the layer counts... are re-derived by scripts/unclaimed-code.py rather than restated here"). That description still holds. `docs/repetitions.csv:12` records the kits Concept section as already a pointer. The cut makes that record true. `pages/guides/code-layers.html:145` links the kits README for "what a kit cannot do", which stays. No anchors into the removed spans.

**Risk:** Low.

## 9. Turn `docs/text-content.md` into a dated record and keep a short living statement

**Repo:** web-tools

**Targets:** `docs/text-content.md`, all 6,311 words.

**Kind:** restructure (move the measurement out, keep the rule)

**Proposal:** Move everything from "Part 1" onward (lines 48 to the end) to a dated record. A dated file under `docs/` or `data/` works, or a home `chron/2026/08/` entry, whichever the estate prefers for web-tools measurements. Leave `docs/text-content.md` as about 400 words holding:
- the "Three kinds, three different answers" table (lines 31-47),
- the gate rule: `text-carriers.py --check` fails on an undeclared text table and an off-vocabulary field name, and reports everything else,
- the two instrument commands,
- a link to `docs/text-fields.csv` for the vocabulary,
- a link to the dated record.

Delete the 13-row field table at lines 345-359 outright. It restates `docs/text-fields.csv` ("Thirteen sanctioned names"), which `tools/test/text-fields-registry.test.mjs` already gates.

**Rationale:** `docs/docs.csv:82` classes the file as `measured` and says "the date in the opening line is what the numbers are as of". The file then accretes dated sections: "Is it true? A read of six files, 2026-09-08", "The history the pilot moved out, 2026-09-08" and "What the pilot taught about running the pass, 2026-09-08". The middle one says what it is: a place where the history "went" when PR #625 cut it from code comments. That makes a living doc the dumping ground for incidents such as the 867px track, `DIM_ALPHA`, and the `paneWatch` merge. This is the pattern the estate retires elsewhere. The file's own advice ("Re-derive rather than cite. The numbers move as the repos do") argues for dating it.

**Evidence:** Section word counts: "Is it true?" 554, "history the pilot moved out" 554, "what the pilot taught" 392, "The outlier" 927, "Six registry rows" 237, "Proposed: what a gate can and cannot hold" 279, "What to do first" 279. The field table at lines 345-359 is the same 13 names as `docs/text-fields.csv`.

**Words removed:** about 5,900 from living docs. They move to a dated record rather than being deleted.

**Inbound dependencies:**
- `tools/test/text-fields-registry.test.mjs:7` (comment) and `:69` (assertion message "say why in docs/text-content.md"). The message still makes sense if the living file keeps a "Changing the vocabulary" line.
- `app/index.html:15` (comment "the measurement and the reasoning are in docs/text-content.md"). Retarget it to the dated record.
- `scripts/duplicated-claims.py:16`, `tools/build/docs-reach.mjs:134`, `docs/registries.md:228` and `docs/SNAGS.md:503,516` name the file only.
- In `home`: `projects/text/passages.jsonl`, `projects/text/runs/2026-09-16-*` and budget-drs probe `FINDINGS.md`. These are dated corpora or records that cite the file by path, and the path survives.

`docs/docs.csv:82` needs its status changed from `measured` to `living`, or a new row for the record.

**Risk:** Medium. `home/projects/text` runs index passages of this file by offset. A rewrite changes those passages, but they are dated snapshots, so they stay valid for their run date. Confirm with the owner where web-tools keeps dated measurements before moving.

## 10. Remove the "full list" and demo claims that the Kits tab now answers

**Repo:** web-tools

**Targets:** Root `README.md:218` ("[kits/README.md] is the full list"). The "Salvage status" demo column (`lib/kits/README.md:1446-end`, counted in proposal 1). And `docs/loader.md:195` (the `window.<kit>` row pointing at the kits README).

**Kind:** link-to-owner

**Proposal:** Point all three at the Map view's Kits tab (`app/?view=map&tab=kits`) and `docs/kits.csv`. This is a follow-through edit that keeps proposal 1 from leaving dangling claims, so no extra words are counted here.

**Rationale:** `kits.csv` has a derived `demo` column. The hand-kept demo table lists 21 of 100 kits and still names `kits/demos/…` paths without the `lib/` prefix. `tools/build/kits-index.mjs:5-8` notes that a hand-kept demo index "still linked kits/ at the repo root, a path that stopped existing on 2026-08-08".

**Evidence:** `README.md:218`. `lib/kits/README.md:1455-1477` (the table rows that use `kits/demos/…`).

**Words removed:** 0 beyond proposal 1 (about 20 words rewritten).

**Inbound dependencies:** None beyond those listed.

**Risk:** None.

## Total

About 22,700 words removed from living docs across proposals 1 to 9. About 5,900 of those move into a dated record rather than disappearing, and about 1,000 move into code headers.
