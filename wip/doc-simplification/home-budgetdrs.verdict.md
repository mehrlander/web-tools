# Verdicts: home-budgetdrs

## 1. Retire the eight shipped proposals and briefings in app/view

**Verdict:** revise

**Checked:** Word counts hold (`wc -w`, total 14,701). The eight files split into two kinds. Four are stale briefs for a June architecture that no longer exists: `VIEW-SESSION-PROMPT.md`, `VIEW-PRIOR-WORK.md`, `walkthrough.md`, `redesign-proposal.md`. The brief names `renderForward`, `order`, `viewForUrl` and `statBox` in a single `app.html`; `grep -c` finds 0 of each, and the views now live as 18 modules in `app/view/views/*.js`. The other four are decision records. `appendix-proposal.md` and `pension-sections-proposal.md` carry `date:` and `type: proposal` frontmatter, and `docs/README.md:40-43` classes "design notes" as dated records that "stay put". `pension-sections-proposal.md` is also a working reference for two **open** tasks: `grid-membership-remaining-families-cv0o2a.md:48,148` and `bill-window-before-2015-3ah1sc.md:56,98`, both `status: backlog`. `bill-tab-proposal.md:8-10` says it "stays as the reasoning behind" the tab. Deleting these strands open work and path citations in six tasks.

The proposal's premise about `README.md:44-53` is wrong. That section does not "already state the one rule". It repeats the same stale single-file rule (`render<Key>`, `order`, `views`, `viewForUrl`), so it is also wrong now.

The `recall.py` risk is overstated. Lines 30 and 31 both cite a target (`walkthrough.md` and `redesign-proposal.md`), not only line 31. The script's docstring (lines 2-4) marks an item whose file is gone as `out-of-scope`, and it is not in `tools/verify-artifacts.sh`, so nothing fails. `tools/lint-conventions.py:227` already carries a dead ignore for `IMPRESSIONS.md`, which shows a stale ignore line is harmless.

**Revised proposal:** Delete the four stale briefs: `VIEW-SESSION-PROMPT.md`, `VIEW-PRIOR-WORK.md`, `walkthrough.md`, `redesign-proposal.md`. Rewrite `app/view/README.md` "Working on one view" to the current rule: one view is one `views/<key>.js` module, confirmed with `node tools/smoke-view.mjs <view>`. Keep `acfr-subcategory-proposal.md`, `appendix-proposal.md`, `bill-tab-proposal.md` and `pension-sections-proposal.md` in place as dated records. Update these links: `app/workshop/data-asks/README.md:128`, `app/workshop/consolidation-orchestration/README.md:56` (use a SHA permalink, since that retrospective is a record), and `tools/lint-conventions.py:226,228`. Optionally drop the dead line at 227 too.

**Corrected words removed:** about 6,600.

## 2. Cut SOURCES.md to the registry and the model; drop the three re-presentations of the same datasets

**Verdict:** revise

**Checked:** The atlas parser is safe. `build-atlas.py:153-184` matches only the five header sets in lines 267-323, and all of them are kept. `unattached-data.sh` reads SOURCES.md as part of its reference corpus. Every CSV basename in lines 338-494 is also named in another corpus file, so the detector is unaffected.

The acquisition table is not a duplicate. 0 of the 23 URLs in lines 338-371 appear verbatim in `catalog/data-catalog.csv`. Seven appear nowhere else in budget-drs, for example `OperatingAgencyDetailPrior.aspx`, `OperatingAgencyDetailSupp.aspx`, `web.archive.org/cdx/search/cdx` and the `drs.wa.gov/wp-content/uploads` pattern. `docs/README.md` also lists "acquisition record" as SOURCES.md's job.

Two dependencies are missing from the proposal's list. `data/build/build-model.py:259` cites `(SOURCES.md, "The basis flag")`, a section the proposal deletes. `data/build/verify-model.py:414` cites SOURCES.md for the plan basis. SCHEMA.md:48-94 does cover the basis and the swappable binding (SCHEMA lines 35-41 of that span), so repointing both comments to SCHEMA.md is enough.

The word count is off. Naming, basis and principles total 489 words (91+152+246), not about 600. The "Supplied data" duplicate is confirmed: SOURCES.md:379-381 defers to `catalog/README.md` "Supplied data". The six spend datasets each have a row in `data-catalog.csv`.

**Revised proposal:** Delete "Supplied data", "Spend data", "By publisher", "Naming is keyed...", "The basis flag" and "Principles". Shrink "Provenance classes" as proposed. Repoint the `build-model.py:259` and `verify-model.py:414` comments to SCHEMA.md, and edit `catalog/README.md:36-42`. Delete "Where to find each dataset online" only after its 23 URLs have moved into `data-catalog.csv` `host`/`pull` for the matching rows. Until then, keep the table and reword the `docs/README.md` row to match whatever SOURCES.md still holds.

**Corrected words removed:** about 1,900 now. About 2,500 once the URLs have moved.

## 3. Replace the authored README's file table with the registry it duplicates, and strip its backstory

**Verdict:** revise

**Checked:** Word counts hold (table 816, lines 15-26 129, EVIDENCE 128-end 349). The table has 27 rows, not 29 (29 lines including the header and separator), and it matches the 27 CSVs in the folder, so it has not drifted. `authored-files.csv` has a `maps` column but no landing column. The "Where it lands" column is only partly recoverable from `lineage/pipeline.csv`: `vocabularies.csv` has 0 rows there, and its consumers are the submittal and CEM vocab tools. A bare link therefore loses the landing information. The dated asides were confirmed at README.md:49, 61, 69 and 106. `DECISIONS.md:12` does tell the 2026-09-04 story. No script parses the table, and `build-submittal.py:35` cites the placement rule, which stays.

**Revised proposal:** Strip the backstory, the dated asides and the EVIDENCE narrative as proposed. For the table, do not replace it with a bare link. Either generate it into a managed region from `authored-files.csv` (`name`, `maps`) joined to `pipeline.csv` consumers, adding the missing `vocabularies.csv` consumers to the manifest first, or keep it as it is. It is currently accurate.

**Corrected words removed:** about 550 certain. About 1,400 if the table is generated.

## 4. Generate or delete the request-development contents table; it has already drifted

**Verdict:** keep

**Checked:** 1,248 words for the Contents span, confirmed. `grep -c` returns 0 for `2026-09-10-core-pam-summary-by-object.md`, `2026-09-11-edit-text.md`, `core-pam-model.md` and `2026-09-10-core-portals-filing-package-revised`. Every dated `.md` file has a `summary:` line in its first 10 lines. No script reads the README. Only the term-migration run CSVs and the fact-census CSV cite it, and both are dated records. A second drift sits in the kept part: line 6 says "Two ground rules" over three bullets. Fix that in the same edit.

**Corrected words removed:** about 1,200.

## 5. Rewrite app/search/README.md as a contract; strip the build-story and bug-story paragraphs

**Verdict:** revise

**Checked:** 7,404 words and 13 ISO dates, confirmed. Some spans are miscounted: 456-end is 2,804 words (not 2,561), 108-222 is 1,225 and 223-317 is 1,051. The direction is right. The keep list is wrong, and so is the dependency claim ("None found by path in scripts"):
- `app/view/README.md:121` says the rail's tally and filter are "owned and explained by `app/search/README.md` under 'The bucket rail'". The proposal's keep list drops that section.
- `search.js:503-505` quotes this README's rule "a copy in prose can only be the stale one" from "Coverage is data". That section is not in the keep list.
- `app.html:1097` and `app.html:1187` point readers at this README.

The keep list also drops rules the code relies on:
- the tokenizer twin (`TOKEN_RE` in Python and JS, held by `verify-search.mjs`)
- `rows` against `inHead`
- the page-unit rules: form feed first, blank-line fallback, the `pages` count, and the build dying on a mismatch
- the splitter in two languages (`doc_units`/`blocksOf`)
- extraction is not registration
- the braided-line rule running to a fixed point
- the header and footer thresholds (more than half the pages, documents of 8 pages or more, digits normalized)
- static markup only
- `deckSpecs` checks and left truncation
- the deck is every hit
- `bucketOf`/`focus` treated as opaque strings, the two bucket taxonomies, counts taken before limits and focus, and the cap of 8
- the `tool` view kind and its `build-views.py` constraints
- chapter grain for fan-in
- the per-section `limit`
- the `name_mirrors` drop
- the peek's `like` filter, its cache key per grid, and measuring after `tableBuilt`

**Revised proposal:** Keep every section heading, including the two cited as owners. In each section, keep the bolded rule and its reason as one or two sentences, and cut the "until", "measured", "it replaced" and "it has found" narration. That covers the probe's two found bugs, the 2026-08-29 method deletion, the 2026-09-14 attribution measurement, the "items" 46-hit story and the page 53 to 35 drift. Target about 4,300 words, not 2,500.

**Corrected words removed:** about 3,000.

## 6. Collapse the layered history in lifecycle/DESIGN.md and the dated sections in bill/README.md

**Verdict:** revise

**Checked:** Word counts roughly hold (19-71 is 590, 185-199 is 523). The lifecycle premise is wrong. There is no "current rail" to describe. `DESIGN.md:10-17` and the note at 152-156 say `stream.html` and `inspect.html` were retired in July 2026, and `ls app/lifecycle` shows neither. Lines 151-199 (1,327 words: the stream chart, the inspector, the wage-lane check and v2) describe removed pages, and the file keeps them only "as the record". Git already holds them. "Known gaps" (208-214) says both conventions "stand as built", while the redesign section (lines 47-50) says the redesign resolves both. That is a live contradiction.

For bill, the findings span in "The two boards" is lines 270-322, about 550 words. It is not 949, because 322-347 is grid and render contract (`COMPANIONS`, `RENDER_FAMILIES`, the build failing on a band with no page). `data/findings/README.md` defines findings as authored CSVs with EVIDENCE column roles. Moving prose there means converting it to rows, not moving it. `bill/README.md:346` links `pension-sections-proposal.md`, which revised proposal 1 keeps.

**Revised proposal:** Lifecycle: delete lines 151-199 and the form-A cross-check (215-end). Delete "Known gaps" or fold it into one sentence, since the redesign resolves both. Merge the redesign section into Inputs, The two tables and Status rules so the file states one design. Bill: collapse "Past IX" (116-162) to its rule as proposed, and drop the dates from the headings. Either convert the VFF and LEOFF 2 earmark analysis (270-321) to rows in a `data/findings/` CSV or cut it to one sentence. Keep 322-347.

**Corrected words removed:** about 1,600 from lifecycle and about 950 from bill, about 2,550 in all.

## 7. Cut app/README.md to its folder map

**Verdict:** keep

**Checked:** 890 words from line 35 to the end, confirmed. `app/README.md:22` says the list "says only where things are", and the table at 50-67 re-describes the same folders. No anchor links point into the three sections. The product table is also stale in places: its lifecycle row calls the stream chart "the app's home view", and that page was retired. One dependency is missing. The `docs/README.md` row describes `app/README.md` as "what is in `app/` and what each product establishes", so that row needs the same edit.

**Corrected words removed:** about 870.

## 8. Retire CFL-FAQ.md; carry-forward level is stated three times

**Verdict:** reject

**Checked:** The overlap is real. The SB 5104 note and the supplemental and advisory points appear in all three files. But the FAQ has a declared job the other two do not have. `consolidate-cfl-documentation-jd9mg9.md:40` records it as proposed "an imagined-FAQ verification instrument the user can read for instant right/wrong". Line 42 records that the FAQ was deliberately given the review clarifications when the owner consolidated CFL into one canonical document. That is a settled owner decision with a stated reason, and the proposal offers no new fact against it. The dependency list is also incomplete: `chron/threads/wa-cfl.md` leads with the standing-documents set, and `.claude/skills/reading-cfl/SKILL.md` names the FAQ. If the owner wants to reopen the decision, raise it as a question. Do not make it a cut.

**Corrected words removed:** 0.

## 9. Fix the two genre rules that still prescribe the retired status markers

**Verdict:** keep

**Checked:** `docs/README.md:41-43` and `app/workshop/README.md:3-5` both prescribe marker correction, confirmed. More marker-shaped asides remain in living docs: `data/design/catalog/README.md:106` "(Corrected 2026-07-27: ...)", `app/bill/README.md:56` "**A claim corrected on 2026-08-05:**", `app/bill/README.md:116` and `data/authored/README.md:49`. Include all four.

**Corrected words removed:** about 80.

## Missed

**The view README's "Working on one view" section is wrong, not just redundant.** `app/view/README.md:44-53` tells a session to edit only its `render<Key>` in `app.html` and to avoid `order`, `views` and `viewForUrl`. None of those exist, and the views are 18 separate modules in `app/view/views/`. This is the one living contract in the folder, and it is the one the reader proposed to keep as the rule's owner. It is folded into revised proposal 1 above.

**The lifecycle design doc is mostly about two deleted pages.** About 1,300 of its 3,757 words describe `stream.html` and `inspect.html`, both removed in July. The reader treated this as a merge problem rather than a delete. It is folded into revised proposal 6.

**SOURCES.md's registry tables are data parsed out of Markdown.** The reader named this as a follow-on. It is the larger structural fix. `build-atlas.py` scrapes five tables by header set, and `verify-atlas.mjs` greps handles from prose. A `sources.csv` would remove the scraper and would give the 23 acquisition URLs a column, which is what makes the acquisition-table delete in proposal 2 safe.

No other large miss was found. `fund-balance/README.md` (4,500 words), `DESCENT.md` and `lineage/README.md` have lower narrative density (8, 5 and 12 dates). `DESCENT.md` is a dated proposal record by its own frontmatter.
