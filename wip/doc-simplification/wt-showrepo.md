# Slice: wt-showrepo

**Summary.** This slice is the web-tools product documentation for the Web Tools app (show-repo): `docs/APP.md` (1,434 words), `docs/show-repo.md` (1,419), `docs/manifest.md` (7,985), `docs/stage.md` (7,376) and `docs/branch-overlay.md` (7,283), about 25,500 words in all. The eleven `docs/views/*.md` and two `docs/forms/*.md` files (4,082 words together) were read as the comparison: they were split from show-repo.md on 2026-09-24 and are terse behavior references of 70 to 520 words each. The three large docs were split out on 2026-08-16 and have grown since as design diaries. They record each shape a control took, the day it changed, and the measurement that justified the change. The dominant bloat is that diary. A shingle test (any 8-word run of the doc also found in `lib/`, `app/` or `pages/`) finds 28% of stage.md, 22% of branch-overlay.md and 21% of manifest.md verbatim in code comments, mostly `lib/alpineComponents/stage.js`, `branch-brief.js`, `repo-proposals.js`, `repo-menu.js` and `app/index.html`. The rationale therefore already has an owner at the code it justifies. Layering has also left stale claims and contradictions that no reader has caught: a Save control that no longer exists, a retired `?view=activity` address, panes that became a scroll, a link to a `docs/manifest.json` that does not exist, and a token caveat that denies a feature stage.md documents.

Method note: the shingle script is `scratchpad/para.py` in this session (8-word shingles, paragraphs of 30 or more words flagged at 40% or higher overlap). Its flagged paragraphs are listed per proposal. Word counts use `sed -n A,Bp | wc -w`.

## 1. Rewrite stage.md's bench section as a behavior reference

**Repo:** web-tools

**Targets:** `docs/stage.md:1-512` (5,751 words, everything above "Standoff notes").

**Kind:** rewrite-shorter

**Proposal:** Replace lines 1-512 with a reference of about 1,000 words in the shape of `docs/views/branches.md`: one intro sentence, then short headed lists for **Intake** (drop, paste, the flavor bar and its tick, the per-flavor menu Copy / Markdown / Base64 / Decoded, derived pills dashed, the iOS tap path through `StageIntake.takeClipboard`), **Add** (the Browse / Recent / Search table at lines 249-253, kept), **Rename** (locals only, sniffed extension underlined, ref items never rename), **Reader** (a walkable position, fixed height held by `npm run test:reader-height`, the comparison as a drill with the Unified / Split / Patch table at lines 360-364 kept, side A is the position and side B a pick held by key, subject-channel announcement with no `base`), **Transform workbench** (the three kinds, bundle opens directly, host loads PapaParse and Tabulator), **Layout** (the one 42rem split), and **Out** (bundle, send, persistent link). Delete every "was X until DATE", "for an afternoon", "shipped and was withdrawn the same day" and "took a fix on 2026-08-19" passage. Delete the stale **Save** bullet at lines 505-509, which describes "the pin on the Staged header, opening the dialog above": no such dialog exists in the doc, and `lib/alpineComponents/stage.js` has no save control besides the note editor's "Save note" (stage.js:1870). Lines 15-38 on the retired Saved sub-view collapse to one sentence: "`?view=surfaces` is a retired alias for `?view=stage`; the surface format is [envelopes/surface.md](envelopes/surface.md)." Update the docs.csv row 77 description, which still says "bench and Saved ... save-as-surface".

**Rationale:** The doctrine asks whether another document owns a statement. Here the code does. stage.js carries the same reasoning in its own comments, often word for word, so the doc is a second copy that drifts. The Save bullet is the proof: the doc still describes a control the code dropped on 2026-08-27, and line 15 of the same doc says "The stage does not save." A reader who wants to know what the Stage does gets it in a fifth of the words. A reader who wants to know why a line of stage.js is shaped the way it is finds the reason next to that line.

**Evidence:** Paragraphs at 40% or more verbatim overlap with `lib/alpineComponents/stage.js`: lines 72-81, 89-101 (78%), 118-127 (81%), 129-137, 139-147, 149-156, 180-188, 190-198, 200-204, 213-217, 219-224, 260-264, 266-271, 336-343, 413-427 (86%), 466-471. That is 2,216 words in flagged paragraphs across the whole doc. Narrative examples: line 52 "Until 2026-08-28 it listed only the LEFTOVERS"; lines 67-70 "a split pill with an eye and a panel for an afternoon, then a daisyUI tooltip for another"; lines 103-109 conversions "had a pill of their own for a day"; lines 259-263 "briefly folded into a single query box (2026-08-04, same day)"; lines 314-326 the modal height history; lines 392-404 the 2026-08-19 slide-compare bug; lines 439-447 the withdrawn compare-with-clipboard. Contradiction: line 15 "The stage does not save" against line 505 "**Save**: the pin on the Staged header, opening the dialog above".

**Words removed:** about 4,700 (5,751 down to about 1,000).

**Inbound dependencies:** `tools/test/state-the-rule.test.mjs:750` reads `docs/stage.md` as a corpus for the segmenter agreement test; any well-formed Markdown passes, so a shorter file still serves. `.claude/skills/show-repo/SKILL.md:52` curls the file (still valid). `docs/app-routes.csv` row `stage` and `docs/properties.csv:129` name it as a shared reference (unchanged path). `tools/render/scenarios/stage-flavor-bar.mjs:30` uses its URL as fixture text only. `docs/branch-overlay.md:491` links it.

**Risk:** Some rationale exists only in the doc and not in stage.js (the shingle test finds about 40% of the section in code). Before cutting, a pass should move any paragraph whose reason is not already at its code into a comment there. The cost of losing one is low, since git keeps the text.

## 2. Rewrite branch-overlay.md as a reference and fix its stale addresses

**Repo:** web-tools

**Targets:** `docs/branch-overlay.md` whole (7,283 words): overlay 1-79 (722), takeover 80-286 (2,406), "One mechanism, two levels" 287-550 (3,039), sidebar second ref 551-642 (923), drop a file 643-end (193).

**Kind:** rewrite-shorter

**Proposal:** Rewrite to about 1,300 words in four sections. (a) **The overlay** (about 300 words): the `?overlay=<branch>` address, the manifest splice, browse at the branch, the preview chip, the write classification (crawls pinned at main; the Config save warns), the toss form for an unmerged shell, and the limits. (b) **The takeover** (about 500 words): address, header versus page identity, the Look row and its two limits, files-then-guide scroll with the 20-row cap, the verdict filter, deferred compare with `facts` as the switch, and `kind`-driven file rendering. (c) **The sidebar owns the ref** (about 350 words): the up and down channels, the three facts dropped when the base moves (keep that list), and `__deckNavigate`. (d) **Drop a file** (about 120 words). Cut: the pre-2026-08-13 iframe history (lines 377-402), the hand-rolled drag measurements (391-402), the DOM node counts (434-446), the removed Commits pane (440-452), the two-panel scroller argument (387-393), the crumb-budget verification widths (534-542), the cache-skew note on `gh.bytes` (620-631), and every "wrong first" story. Fix these stale statements during the rewrite:
- Lines 12 and 70 give the address as `show-repo.html?overlay=`; the page moved to `app/` (APP.md:101). Use `…/app/?overlay=<branch>`.
- Lines 100 and 103 give the takeover address as `?view=activity&detail=`; show-repo.md:27 and views/branches.md:5 put `&detail=` on `?view=branches`, and show-repo.md:31 says `activity` is a retired key.
- Line 82 says "the Activity view's Open list"; line 454 and line 545 describe "the Guide pane", "the tab", and "when the reader taps Files or Commits"; lines 156-162 say the panes became a scroll on 2026-08-31, and lines 440-452 say Commits was removed.
- Line 651 says "In the frame vocabulary above" and line 662 says "per Inbox and outbox below"; neither exists in this doc. The first is a leftover from show-repo.md; the second lives in manifest.md.
Then decide whether (b) belongs in `docs/forms/branch.md`, which already says "the takeover's panes ... are documented in branch-overlay.md" (forms/branch.md:11). Recommendation: move (b) there and keep branch-overlay.md for the overlay, the ref channel and the drop, so the branch form has one document.

**Rationale:** Half the doc is the history of how the takeover was built. Code comments already hold much of that reasoning (overlap below), and git holds the rest. The stale addresses show that nobody reads this doc as a reference: a reader who follows line 100 lands on a retired route.

**Evidence:** Flagged overlap paragraphs: 100-107, 118-128 (57%, branch-brief.js / estate.js), 130-135, 137-144, 188-193 (76%, branch-brief.js), 195-200 (66%), 289-294, 296-301, 434-443 (file-review.js), 476-485 (76%, subject-channel.js / fab.js), 528-536, 566-574, 579-590, 592-594 (79%), 616-620 (80%, file-deck.js). That is 1,546 words in flagged paragraphs. Section headings "And the ref bar acts in place too" (line 614) and "That closes the three steps this section has been tracking since the deck first announced" (line 640) are narrative, not reference.

**Words removed:** about 6,000 (7,283 down to about 1,300).

**Inbound dependencies:** `docs/forms/branch.md:11`, `docs/show-repo.md:167`, `docs/docs.csv:17`, `docs/README.md`, `docs/SNAGS.md` / `docs/snags.csv` (a `→` pointer; check the anchor it names), `docs/text-content.md`, `docs/themes.csv` (generated). The render scenarios `branch-page-cold.mjs`, `branch-file-card.mjs` and `branch-verdict.mjs` use the path as fixture data only. No code reads the content.

**Risk:** Low. If the SNAGS pointer targets a heading that the rewrite renames, update that entry in the same commit.

## 3. Take the repo menu and Proposals out of the manifest doc

**Repo:** web-tools

**Targets:** `docs/manifest.md:558-672` "The repo menu" (1,280 words) and `docs/manifest.md:363-557` "Proposals" (2,044 words).

**Kind:** restructure

**Proposal:** (a) **Repo menu.** Replace the section with about 150 words in `docs/views/estate.md`, which already documents the Repos view and the repo dialog: three lists (Actions, GitHub, Repo), what each carries, `lib/kits/github-links.js` as the one row builder, hover-open at about 140 ms with close at about 220 ms on a fine pointer, and tap everywhere. Delete from manifest.md the SVG viewBox arithmetic (lines 761-768), the rows that were removed and why (lines 587-594, 756-759), the "Flat, and flat again on purpose" history (746-754), the pixel sizes (775-781), and the retired three-icon cluster (797-808). None of it is about `.web-tools.json`. (b) **Proposals.** Move the section to a new `docs/views/proposals.md`, cut to about 700 words: the record fields, the four kinds (one line each, keep the literal-key limit and the "absent removal counts as done" rule), the three deliveries table, the preflight checks table, `expectSha` and Apply anyway, "only a success retires a proposal" with the `applied/` versus `attempts/` meaning, and the three prose fields table. Drop the history sentences ("A failed apply used to write the same tombstone", "The first attempt at that put everything in one `why`", "The list drops a row without waiting for the API"). Update `docs/app-routes.csv` row `proposals`, whose `doc` column names `docs/manifest.md`.

**Rationale:** manifest.md describes itself as the reference for `.web-tools.json`. The repo menu is a UI component, and Proposals is a registry channel with its own view and route. Neither is a manifest field. Every other view already has a `docs/views/` file named by app-routes.csv, so Proposals is the one route whose document is a section of an unrelated file. The repo-menu prose is also largely a copy of comments in `app/index.html` and `repo-menu.js`.

**Evidence:** The `doc` column in app-routes.csv names `docs/manifest.md` for `proposals` (shown by `cut` of app-routes.csv). Overlap: repo menu paragraphs 566-577 (82%), 591-597 (85%), 609-617, 619-622, 624-631, 638-644 (71%), 646-651, 653-658 (87%), all in `app/index.html` / `lib/alpineComponents/repo-menu.js`. Proposals paragraphs 380-401, 449-452, 454-460, 491-501, 529-537 overlap `lib/kits/repo-proposals.js`.

**Words removed:** about 1,130 (repo menu, net of 150 added to estate.md) plus about 1,340 (Proposals, net of 700 in the new file), so about 2,470.

**Inbound dependencies:** `docs/app-routes.csv` (proposals row), `lib/alpineComponents/config.js:21` and `repo.js:76` link `manifest.md` as the field-format doc (unchanged by this move), `app/index.html:4287` cites manifest.md for the projects convention (unchanged). `docs/views/estate.md` grows. `tools/test/app-routes.test.mjs` holds `VIEWS` and app-routes.csv to each other; check whether it asserts that the `doc` path exists, and add the new file in the same commit. Adding a file under docs/ needs a `docs/docs.csv` row.

**Risk:** Low. A new file slightly raises the file count, but each piece lands where its route already points.

## 4. Stop restating manifest-fields.csv in manifest.md's opening

**Repo:** web-tools

**Targets:** `docs/manifest.md:1-214` (2,282 words), specifically 12-26 (the registry's own history), 87-97 (the field list "not listed here", linking `docs/manifest.json`), 99-125 (membership, `hidden`, landing and pages), 176-213 (links, projects, "two fields are not show-repo's").

**Kind:** link-to-owner

**Proposal:** Keep the lines 1-10 intro, the JSON example (38-57), the slug rule (59-72, cut its incident sentence), the fragment rule (74-83), the `declared-paths.py` paragraph (85), and the Checks probe-versus-verdict design (140-174), which the registry cannot carry. Delete lines 12-26 and 87-97: both explain that the field list moved to a registry, and 87-97 links `docs/manifest.json`, which does not exist (the registry is `docs/manifest-fields.csv`). Replace 102-125 and 176-187 with nothing: the `hidden`, `landing`/`pages`, and `links` rows of manifest-fields.csv already state the same behavior. Keep the projects paragraph's one unique fact (the estate reads the cache and the open repo reads its live manifest, so a branch-only `projects` change shows only when browsing the branch) as two sentences. Delete 210-213 ("Two fields are not show-repo's"), which the `consumer` column states. Also cut the stale "the **branch overlay** above" at line 208: the overlay is in another doc. In the app-view paragraph (127-138), drop the rule sentence that APP.md "The boundary" owns and keep its two consequences (two-thirds width, stand the masthead down when framed).

**Rationale:** The doc says in its first paragraph that it is "not a second copy" of the registry. Lines 99-213 are partly a second copy anyway, and it has already drifted: the doc points to a registry file that does not exist. The shared app-view sentence is flagged by the repo's own repetition finder (`docs/themes.csv:15`).

**Evidence:** `ls docs/manifest.json` fails; manifest.md:88 links it. manifest-fields.csv rows `hidden`, `landing`, `pages`, `links`, `projects` and `inbox` each carry the behavior the prose repeats: for example, the `landing` row states "Takes the front-door slot ahead of `pages`; the catalog then moves to a standalone Pages view rather than disappearing", which is manifest.md:122-125 in other words. The `inbox` row carries the declared-not-derived argument of manifest.md:334-342. themes.csv:15 records the APP.md and manifest.md shared sentence.

**Words removed:** about 1,100 (278 + 123 + about 450 + about 250).

**Inbound dependencies:** `lib/alpineComponents/config.js:21`, `repo.js:76` (DOCS_URL to the file, no anchor), `tools/test/config-form.test.mjs:312` (comment only), `docs/views/estate.md`, `docs/CONSTELLATION.md`, `pages/xlsx-picker.html`, home `projects/doc-audit/*` (path references). No reader depends on these paragraphs.

**Risk:** Low. The `hidden` against `conventions: optout` distinction (114-120) is not in either CSV row in full; keep one sentence of it if the rows do not cover it.

## 5. Collapse APP.md's name-split history to the rule

**Repo:** web-tools

**Targets:** `docs/APP.md:24-106` (926 words) and "Provenance" `docs/APP.md:133-142` (89 words).

**Kind:** collapse-narrative

**Proposal:** Keep lines 15-22 (the split itself). Replace lines 24-106 with three sentences: "Reader-facing text takes the product name: page titles, chat replies, captions, PR bodies, and the commit subjects the app writes (`via Web Tools`). An identifier keeps `show-repo` only while it is accurate or held outside the repo, never because renaming is expensive. The old page path `pages/show-repo/show-repo.html` is a permanent redirect stub to `app/index.html`, because links in other repos and on phones name it." Delete Provenance, or reduce it to one sentence naming home's `projects/surfacer/` as the predecessor.

**Rationale:** The section records four successive corrections of its own earlier wording ("This sentence used to claim", "The version of this passage written on 2026-08-27 said", "That count of two was wrong", "see the correction above"). A reader needs only the rule and the one permanent constraint. The estate already made this cut once as an experiment: `docs/doc-craft-specimens/APP_living_spec_replacement.md` is APP.md with the history removed (not adopted), and `docs/doc-craft-specimens/2026-09-08-naming-split.md` holds the deliberation as a record. Home's CLAUDE.md retired status markers on 2026-09-21 on the same principle: fix the sentence, and git keeps what it used to say.

**Evidence:** APP.md:42-45, 57-62, 75-86 and 93-96 each correct an earlier version of the same passage. The specimen at doc-craft-specimens/APP_living_spec_replacement.md exists but is marked "not current guidance". Note that the specimen has its own error (it lists `?view=show-repo` as a route key, which app-routes.csv does not contain), so write the three sentences fresh rather than adopting it.

**Words removed:** about 870 (926 + 89 minus about 75 and about 20 kept).

**Inbound dependencies:** Several tests use `docs/APP.md` as a fixture address (`md-doc.test.mjs`, `annotate-section.test.mjs`, `x-blob.test.mjs`, `source-peek.test.mjs`, `fab-menu.test.mjs`, `swipe-deck-index.test.mjs:38`). Check `md-doc.test.mjs:245` and `annotate-section.test.mjs:206`, which assert "§ First (lines 5-11)": if they read the real file rather than a fixture string, a heading-line change breaks them. Lines 1-22 are untouched by this proposal, so the first section's line numbers hold. `docs/aims-reading.csv` and `data/checks-reading/2026-09-05-reading.csv` may quote APP.md passages; check them. home `projects/surfacer/README.md` links APP.md.

**Risk:** Low. The only content lost is the self-correction record, which git and the specimen already keep.

## 6. One owner for the `#stage=` grammar, and fix show-repo.md's token caveat

**Repo:** web-tools

**Targets:** `docs/show-repo.md:13-19` (Token caveat, 62 words), `.claude/skills/show-repo/SKILL.md:29` (the grammar restated), `docs/surfacing-extended.md:17-19` (the grammar and `#gz=` restated), against the owner `docs/stage.md:579-715`.

**Kind:** link-to-owner

**Proposal:** Rewrite the show-repo.md caveat to two sentences: "A `#stage=` ref link and any private-repo browse need the viewer's stored `ghToken`, which the Claude app's in-app browser may lack. For a token-less reader, mint the `#gz=` form ([stage.md](stage.md#content-the-gz-param)) or send the downloaded bundle." In the skill, replace the grammar bullet with the one-line form and a pointer to stage.md, which the skill already curls at line 52. In surfacing-extended.md, keep the one-line form and the 🗂️ boundary and drop the restated `&prompts=`, `&mode=` and `#gz=` details in favor of the stage.md link it already carries.

**Rationale:** show-repo.md:17 says "A token-less `#gz=` form for the stage is not built", while stage.md:620-645 documents `&gz=` and `#gz=` as built and tested (`tools/test/stage-gz-review.mjs`), and surfacing-extended.md:18 advertises it. The stale copy is the one in the shell doc every session loads through the skill. Three copies of one grammar produced one wrong copy, which is the doctrine's case for a single owner.

**Evidence:** show-repo.md:17-19; stage.md:620-645 and its test link at 641; surfacing-extended.md:17-19; SKILL.md:29 and 49-52.

**Words removed:** about 150 across the three copies.

**Inbound dependencies:** The skill is shipped by the `portable` plugin (docs/portable.csv), so the SKILL.md edit reaches other repos one session late. surfacing-extended.md is loaded on demand by SURFACING.md:59.

**Risk:** Low. The anchor `#content-the-gz-param` depends on the stage.md heading "Content: the `&gz=` param"; check the generated slug.

## 7. Rule for the slice: rationale lives at the code, docs state behavior

**Repo:** web-tools

**Targets:** The method behind proposals 1 to 4. Applies to `docs/stage.md`, `docs/branch-overlay.md` and `docs/manifest.md`, and to future growth of `docs/views/*.md`.

**Kind:** move-to-data-or-check

**Proposal:** Add one line to `docs/code-layers.md` or the doc-craft skill (whichever owns doc-versus-comment placement; do not add a new doc): "An app feature doc states behavior, addresses and limits. Why a line of code is shaped the way it is goes in a comment at that line, not in both." Back it with a cheap check: run the 8-word shingle overlap between each `docs/views/*.md`, `docs/stage.md`, `docs/branch-overlay.md`, `docs/manifest.md` and `lib/` + `app/`, and fail when a doc exceeds a threshold (for example 15% of words). `scripts/duplicated-claims.py` already exists and names "show-repo.md against its page's" comments as a pair it compares (line 14). Extend it rather than writing a new script.

**Rationale:** The views split of 2026-09-24 produced eleven docs averaging about 340 words, and none of them has a flagged paragraph. The three docs split on 2026-08-16 had no such limit and each reached about 7,500 words, with about a quarter of their words copied into or from code comments. Without a check, a rewrite under proposals 1 to 4 will regrow the same way.

**Evidence:** The shingle results: stage.md 28%, branch-overlay.md 22%, manifest.md 21%, show-repo.md 5%, APP.md 1%. `scripts/duplicated-claims.py:14` names the doc-and-comment pair as a target already.

**Words removed:** none directly. It protects about 14,000 words of cuts.

**Inbound dependencies:** `scripts/duplicated-claims.py` and whatever runs it (home's CLAUDE.md lists `tools/duplicated-claims.py` as a deep-review probe; this is the web-tools script).

**Risk:** A threshold check can push prose out of docs into comments that are just as long. That is the intended owner for rationale, and code review sees comments, so the risk is acceptable. If the check is judged too blunt, keep only the one-line rule.
