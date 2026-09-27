# Slice: home-budgetdrs

**Summary.** The slice is the living documentation of `home/projects/budget-drs` outside `data/source/`, dated records, probes, research, and tracker tasks. That leaves about 190 Markdown files and roughly 192,600 words (`find ... | xargs wc -w`, with dated names, `probes/`, `research/`, `source-docs/`, `companion-docs/` and `request-development/2026-*` excluded). The dominant bloat is not restated rules. It is **records living as if they were contracts**: shipped proposals, retired fan-out briefings, and change logs kept beside the code they describe, each carrying a status banner that says "this is history now" and then thousands of words of the history. The second source is **incident narrative inside living docs**, where a rule arrives with its dated backstory attached.

(Proposals below are added as they firm up.)

## 1. Retire the eight shipped proposals and briefings in app/view

**Repo:** home

**Targets:** `projects/budget-drs/app/view/acfr-subcategory-proposal.md` (1,518 w), `appendix-proposal.md` (853), `bill-tab-proposal.md` (2,794), `pension-sections-proposal.md` (2,947), `redesign-proposal.md` (1,706), `walkthrough.md` (1,873), `VIEW-PRIOR-WORK.md` (1,688), `VIEW-SESSION-PROMPT.md` (1,322).

**Kind:** delete

**Proposal:** Delete all eight from `app/view/`. Git holds them. Where a living doc links one as "the reasoning behind", replace the link with a pinned-SHA permalink or drop it. Keep `app/view/README.md` as the one living document in the folder. Its "Working on one view" section (README.md:44-53) already states the one rule `VIEW-SESSION-PROMPT.md` exists to carry, so change its first sentence to stop pointing at the prompt file.

**Rationale:** Every one of these self-declares as a record, not a contract:
- `acfr-subcategory-proposal.md:3` "Status: implemented in the view on this branch, 2026-08-11."
- `appendix-proposal.md:4,9` "status: superseded 2026-07-28 ... This proposal lost."
- `bill-tab-proposal.md:8` "Status: delivered 2026-08-05 ... This file stays as the reasoning behind it."
- `pension-sections-proposal.md:5,11` "status: built 2026-08-17 ... [../bill/README.md] is the living account", and what was built was option one, not the recommended option three.
- `redesign-proposal.md:5` "Progress (2026-06-24)" over phases long since landed; it still says "nine views".
- `walkthrough.md:8-10` "narrates the nine-view nav of June 2026 and has not been renarrated since."
- `VIEW-PRIOR-WORK.md:4` "A briefing for the June 2026 fan-out, kept as its record."
- `VIEW-SESSION-PROMPT.md` is the June per-view fan-out brief; `README.md:46-53` restates its only binding rule.

The project's own rule (home `CLAUDE.md`, status markers retired 2026-09-21) is that git holds what a document used to say. A folder of eight banners saying "superseded" is the marker estate in another form. They also mislead: `walkthrough.md` and `redesign-proposal.md` describe a nine-view nav that `data/design/views.csv` no longer matches.

**Evidence:** Status lines quoted above. `wc -w` on the eight files totals 14,701.

**Words removed:** about 14,700.

**Inbound dependencies:**
- `app/bill/README.md:346` links `pension-sections-proposal.md`; `data/source/2026-06-25-enacted-bill-sections-drs/_pages.py:127` and that folder's `README.md` name it in a comment (supplied-source folder, out of scope for editing here; a stale comment is harmless, or use a SHA permalink).
- `app/view/README.md:48` links `VIEW-SESSION-PROMPT.md`.
- `app/workshop/data-asks/README.md` links `redesign-proposal.md`.
- `app/workshop/consolidation-orchestration/README.md` links `VIEW-PRIOR-WORK.md`.
- `tools/lint-conventions.py:226,228` exempts `redesign-proposal.md` and `VIEW-PRIOR-WORK.md` by path; remove those two ignore lines.
- `projects/doc-audit/fact-census/recall.py:31` cites `redesign-proposal.md:14` as a recall fixture. That fixture must be repointed at a SHA or dropped, or the census recall test loses a case.
- Tracker tasks (`reconcile-appendix-designs-w11yek`, `appendix-mount-reductions-explorer-vq3n8d`, `bill-window-before-2015-3ah1sc`, others) cite by path. They are out of scope and are records; leave them.
- `data/doc-growth.json` and dated chron CSVs mention the paths as history; no action.

**Risk:** Low. The loss is reading convenience for design reasoning, recoverable from git. The one mechanical dependency is the `recall.py` fixture.

## 2. Cut SOURCES.md to the registry and the model; drop the three re-presentations of the same datasets

**Repo:** home

**Targets:** `projects/budget-drs/data/design/SOURCES.md` (5,668 w). Sections "Where to find each dataset online" (lines 338-371), "Supplied data" (372-390), "Spend data" (391-411), "By publisher" (412-494), "Provenance classes" (139-195), "Naming is keyed to the systems of record" (196-207), "The basis flag" (208-226), and "Principles this registry encodes" (495-end).

**Kind:** link-to-owner

**Proposal:** Keep the parts that are data or definition-owner: the three-levels model (18-36), the bundle section (37-138), "The origin families" (227-260, the definition owner for `origin_family` per `properties.csv:16` and `app/lineage/README.md:144`), and the registry tables (261-337), which `app/atlas/tools/build-atlas.py:153-184` parses. Delete the four trailing sections (338-494). They list the same datasets a second, third and fourth time: by acquisition URL, by supplied status, by spend, by publisher. Replace them with one sentence: "Per-dataset host, pull recipe, class and notes are in [catalog/data-catalog.csv](catalog/data-catalog.csv); supplied data is explained in [catalog/README.md](catalog/README.md#supplied-data-a-closed-state-not-an-open-item)." Shrink "Provenance classes" to the four one-line definitions plus the carrier sentence (it is the `definition_owner` for `production_mode` in `properties.csv:3`, so a definition must stay here). Delete "Naming is keyed...", "The basis flag" and "Principles", which restate `SCHEMA.md` "The model in brief" (SCHEMA.md:48-94: three facts, three systems of record, the plan/enacted basis, "source binding is a swappable property"). Link SCHEMA.md instead.

**Rationale:** The doc's own opening (SOURCES.md:9-16) names four companions "each with one job", then re-does two of their jobs. `catalog/README.md:36-42` already calls SOURCES.md "the same datasets by handle and by publisher", which is the duplication stated as a feature. The "Supplied data" table repeats `catalog/README.md` "Supplied data" (185-235) row for row and says so at SOURCES.md:379-381. The basis-flag and three-systems prose appears in SCHEMA.md:48-94, SOURCES.md:196-226 and 495-end, and `data/README.md:147-160`, which already defers to SCHEMA.md as owner.

**Evidence:** `sed -n 338,494p SOURCES.md | wc -w` = 1,664. Provenance classes 530 w, of which about 380 are cuttable. Naming, basis and principles about 600 w.

**Words removed:** about 2,600.

**Inbound dependencies:** `app/atlas/tools/build-atlas.py:154` parses Markdown tables in SOURCES.md by header set (`Handle`+`Derived from`, `Handle`+`Would feed`, `Handle`+`Relation to the model`, `Handle`+`File(s)`, `What`+`Disposition`). None of the deleted sections uses those headers, so the atlas is unaffected. `app/atlas/tools/verify-atlas.mjs:112-114` checks handles appear in SOURCES.md; handles live in the kept registry tables. `data/design/tools/verify-properties.py:250`, `properties.csv:3,16` and `lineage/pipeline.csv:3` name the file, not the sections. `app/lineage/README.md:144` links `#the-origin-families`, which stays. `catalog/README.md:38-42` describes SOURCES.md as carrying the by-publisher view and must be edited to match.

**Risk:** Low. The online URLs in the acquisition table should be confirmed present in `data-catalog.csv` `host`/`method`/`notes` before deletion; where one is missing, move it into the CSV row rather than keep the table. A follow-on worth considering: the registry tables are already data (the atlas parses them), so they could become `sources.csv` with the atlas reading CSV instead of scraping Markdown.

## 3. Replace the authored README's file table with the registry it duplicates, and strip its backstory

**Repo:** home

**Targets:** `projects/budget-drs/data/authored/README.md` (2,148 w): the 29-row "File | The call it records | Where it lands" table and its closing paragraph (816 w); the 2026-09-04 dual-read backstory paragraph (lines 15-26, 129 w); the "(Corrected 2026-09-10 ...)" parenthetical; "Chosen 2026-08-21 over 'jot'..."; "Adopted 2026-09-17 with one row, the 2026-08-26 email..."; "Until 2026-09-03 the submittal tray sat here...". Also `data/authored/EVIDENCE.md` sections "A rejected design, kept because the reasoning generalizes" and "The same error, three times in one day" (lines 128-end, 349 w).

**Kind:** link-to-owner, collapse-narrative

**Proposal:** In the README, replace the table with one line pointing at [`../design/catalog/authored-files.csv`](../design/catalog/authored-files.csv) as the per-file record (GitHub renders it as a table). If a Markdown table is wanted, generate it into a managed region, as `build-database-tables.py` already does for `data/README.md` and `GRAINS.md`. Reduce the 2026-09-04 paragraph to its rule, which is already bold: "A shared builder's read decides the home even when the folder's own build reads the file too." Delete the dated asides; git and `DECISIONS.md` hold them. In EVIDENCE.md, replace the two narrative sections with their closing rule in one sentence: "If a rule makes you relabel a column that was already right, the rule is wrong; the multi-column form (`acfr-traced-figures.csv`) is the reference."

**Rationale:** The table's middle column is `authored-files.csv`'s `maps` column (for example `lanes.csv`: "ACFR object lines to five spend lanes"), and "Where it lands" is the consumer side of `data/design/lineage/pipeline.csv`. Two hand-kept copies of one registry is the defect `data/design/README.md` rule 2 forbids ("independently maintained copies are the defect"). The 2026-09-04 story is told in full in `app/workshop/DECISIONS.md:12`. The "Corrected 2026-09-10" parenthetical is a status marker in prose, which home `CLAUDE.md` retired on 2026-09-21. EVIDENCE's two sections are incident narrative whose value is one sentence they already state in bold.

**Evidence:** `awk` over the table = 816 w; lines 15-26 = 129 w; EVIDENCE 128-end = 349 w; dated asides about 150 w.

**Words removed:** about 1,350.

**Inbound dependencies:** `submittal/tools/build-submittal.py:35` cites `data/authored/README.md` in a comment for the placement rule, which stays. No script parses the table. The home `CLAUDE.md` Working style rule links `EVIDENCE.md#one-result-column-per-authorship-event`, which stays.

**Risk:** Low. Readers lose a one-screen overview of "where each file lands" unless the generated-region route is taken. The generated route costs a builder change and keeps the view.

## 4. Generate or delete the request-development contents table; it has already drifted

**Repo:** home

**Targets:** `projects/budget-drs/submittal/request-development/README.md` (2,060 w), the "Contents" table (lines 11-37, 1,248 w).

**Kind:** move-to-data-or-check

**Proposal:** Delete the hand-kept table. Every dated file in the folder carries a `summary:` frontmatter line (all 23 checked), so the table is a hand copy of data the files already hold. Either replace it with one sentence ("Files are dated; each one's `summary:` frontmatter says what it is") or generate it from the frontmatter into a managed region, as `build-database-tables.py` does elsewhere in the project. Keep the ground rules (lines 3-10) and the four topical sections after the table.

**Rationale:** The table is already wrong. It omits `2026-09-10-core-pam-summary-by-object.md`, `2026-09-11-edit-text.md`, `core-pam-model.md` and the `2026-09-10-core-portals-filing-package-revised/` folder (grep count 0 for each). That is the failure the project's own genre rule predicts: `docs/README.md` says living contracts "carry no hand-typed counts that a builder prints". A per-file summary maintained in two places will drift again at the next filing cycle.

**Evidence:** `awk '/^## Contents/,/^## Relation/' README.md | wc -w` = 1,248. Frontmatter check: `head -8 <file> | grep -c '^summary:'` = 1 for all 23 dated files.

**Words removed:** about 1,200 (fewer if generated, but then none is hand-kept).

**Inbound dependencies:** No script reads the table. `projects/term-migration/runs/2026-08-29-register/*.csv` cite line numbers in this README (dated run records; they go stale regardless). `chron/2026/09/2026-09-06-hand-typed-fact-census.csv` checks the second ground rule, which stays.

**Risk:** Low. A reader loses one-glance browsing on GitHub unless the generated route is taken.

## 5. Rewrite app/search/README.md as a contract; strip the build-story and bug-story paragraphs

**Repo:** home

**Targets:** `projects/budget-drs/app/search/README.md` (7,404 w). Heaviest spans: "Files" plus its check narrative (361-455, including the `probe-search.mjs` history and the two bugs "it has found", about 700 w in 385-445), "The prose corpus" (108-222, 1,231 w), "The results as a deck" (223-317, 1,055 w), and the six sections from "Search is a view" to "Where it surfaces" (456-end, 2,561 w).

**Kind:** rewrite-shorter, collapse-narrative

**Proposal:** Rewrite to about 2,500 words that state the current contract: the three corpora and what a hit in each opens (lines 1-25 already do this well); grain; the six-sections table (545-592); the two ranking rules (593-625); the address formats (`?data=`, `?q=`, `#doc=...&page=...&find=`); the files table; the checks, one line each (`verify-search`, `verify-prose`, `smoke-search`, and the manual `probe-search` with its three gotchas as a bullet list). Remove every "it replaced...", "until 2026-08-29...", "measured 2026-08-29 on Part 1...", "It has found two things so far", and "reaching the arrival meant lifting a gate" paragraph. Each carries one rule; keep the rule as a sentence and drop the story. Example: the 2026-08-29 `mountPages` drift (lines 706-720) becomes "A page request is re-asserted after mount until the column agrees twice, because `pdf.flow`'s `start` does not survive background layout."

**Rationale:** The project's documentation map states the rule this file breaks: living contracts "do not narrate their own history" (`docs/README.md`, "Three genres, three rules"). The README is the longest living contract in budget-drs and reads as a build journal: 13 dated references, and whole sections open by describing the design they replaced (the bucket rail, 318ff: "It replaced a chip that could focus only the view..."; "Search is a view", 456ff: "The drawer could find a thing and had to close to show it"). The bug histories are what commit messages and PR bodies are for.

**Evidence:** Section word counts by `sed -n A,Bp | wc -w` as listed. 13 ISO dates in the file.

**Words removed:** about 4,500 (estimate; the target length is judgment).

**Inbound dependencies:** None found by path in scripts. Section anchors are not linked from other docs in the slice (grep for `search/README.md#` returned nothing).

**Risk:** Medium. Some backstory carries design rationale a future session would otherwise re-derive (why a mounted frame is addressed by hash write, why the probe serves over http). The rewrite must keep each such reason as one sentence. Needs a careful hand, not a mechanical cut.

## 6. Collapse the layered history in lifecycle/DESIGN.md and the dated sections in bill/README.md

**Repo:** home

**Targets:** `projects/budget-drs/app/lifecycle/DESIGN.md` (3,757 w); `projects/budget-drs/app/bill/README.md` (4,620 w).

**Kind:** restructure, collapse-narrative

**Proposal:**
- **lifecycle/DESIGN.md.** The file is two designs stacked. Line 21-23 says "The sections below this one describe the artifact as first built and remain the record; this section is what changed" for the 2026-07-05 redesign. Merge the redesign section (19-71, 592 w) into the sections it supersedes so the file states one current design. Delete "v2: the hover rail (superseded v1 on 2026-06-12)" down to the v1 description it replaces (185-199, 532 w) in favor of a description of the current rail, and delete "Cross-check against form A (done for the seed case)" (215-end), a completed one-time check. "The wage-lane check (verified 2026-06-11)" becomes a sentence under Validation asserts, or is dropped if the build asserts it.
- **bill/README.md.** Four section headings carry dates (92, 163, 175, 255: "(2026-08-12)", "(2026-08-25)", "(2026-08-17)", "(2026-08-25)"), which marks them as changelog entries. Drop the dates from headings. Collapse "Past IX, not Parts XI ... (corrected 2026-08-25)" (in 92-162) to its rule: "A closing amendment is any part past IX; ESHB 1109 numbers its closing parts X to XVIII." Move the findings in "The two boards" (255-347, 949 w: the VFF earmark table and its analysis) out of the README. They are findings about the data, not the payload's contract, and `data/findings/` exists for exactly this ("what a reading of some material turned up, keyed by the material", `docs/README.md`).

**Rationale:** Same genre rule as proposal 5. A reader wanting the current lifecycle build has to read the 1st-build record and then apply a diff section to it by hand. The bill README mixes three genres: payload contract, changelog, and analytical findings.

**Evidence:** `wc -w` on the spans: lifecycle 19-71 = 592, 185-199 = 532, 208-end = 232; bill 255-347 = 949, 110-162 = 579.

**Words removed:** about 1,000 from lifecycle (after merging, not deleting, the redesign content) and about 1,300 from bill (findings moved, not lost, plus the correction narrative collapsed). Net from living contracts about 2,300.

**Inbound dependencies:** `app/README.md` and `docs/README.md` link `lifecycle/DESIGN.md` by file. `app/workshop/DECISIONS.md:16` links it (a record; file link survives). `app/view/pension-sections-proposal.md` is linked from `bill/README.md:346`, handled in proposal 1.

**Risk:** Medium for lifecycle, since merging two designs needs someone who knows which v1 statements still hold. Low for bill.

## 7. Cut app/README.md to its folder map

**Repo:** home

**Targets:** `projects/budget-drs/app/README.md` (1,404 w): "The two source forms", "What each product establishes", and "Ground rules carried in from provenance" (from line 35 to end, 890 w).

**Kind:** delete, link-to-owner

**Proposal:** Keep "The endeavor" and "How this folder is organized". Delete the three trailing sections. Add one line to the folder list pointing at `../research/README.md` for the two forms.

**Rationale:** The file contradicts itself. Line 22 says "Each folder's README owns its description; this list says only where things are", and then line 50ff re-describes every product a second time in a table. "The two source forms" describes the June budget-dive and spend-dive, which the same section calls "finished and no longer read by any build"; `research/README.md` is named as their map. The ground rules are June verification findings, several now closed in their own text ("The AEF05 extract closed it on 2026-06-24"), and their source records are `workshop/VERIFICATION.md` and `workshop/COMPARISON.md`.

**Evidence:** `awk '/^## The two source forms/,0' README.md | wc -w` = 890. Self-contradiction at `app/README.md:22` vs the table at `app/README.md:50-67`.

**Words removed:** about 850.

**Inbound dependencies:** No anchor links into the removed sections found (grep for `#the-two-source`, `#what-each-product`, `#ground-rules` returned nothing). `docs/README.md` and the project README link the file, not the sections.

**Risk:** Low. The product table is the one quick overview of what each product proves. If the owner values it, make the folder list carry a short gloss per entry and drop the separate table, so there is one list instead of two.
