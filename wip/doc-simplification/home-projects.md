# Slice: home-projects

## Summary

This slice is home's projects other than budget-drs (doc-audit, text, local-models, term-migration, surfacer, wps, bills, workbooks, wa-budget-landscape), plus `news/`, `links/`, `app/`, `repos/` and `code/` READMEs. Excluding dated records, run folders and tracker tasks, the authored documentation is about 93,000 words: doc-audit 29,400, text 18,700 (10,100 of it the concept-lab `findings.md` experiment log, left alone as a record), wps 12,100, local-models 9,100, surfacer 6,800, term-migration 4,400, and 9,200 across news, repos, app, links and code. `wa-budget-landscape` adds 118,000 words, but those state, governor and actor READMEs are the project's research product rather than documentation about the estate, so they are out of this pass.

The dominant bloat is **documents that outlived their job but stayed at living paths**: skill drafts copied byte for byte from the shipped skill library, superseded plans and planning documents for parked or finished work, a manual for a retired method, and hand-maintained summaries of READMEs. The second source is **restated measurements and incidents**: one 2026-08-18 story told four times, and a catalog that copies numbers from the logs that own them. Thirteen proposals below remove or move roughly 29,000 words, about 30 percent of the slice, with no loss of a fact that lacks another owner.

## 1. Delete the four doc-audit files that are byte-identical copies of shipped skills

**Repo:** mehrlander/home

**Targets:** `projects/doc-audit/atomic-decomposition.md` (2,792 words), `projects/doc-audit/source-anchoring.md` (918), `projects/doc-audit/source-anchored-writing.md` (934), `projects/doc-audit/source-anchored-xlsx.md` (1,706); the "Skill framings" section of `projects/doc-audit/README.md` (lines 64 to 81).

**Kind:** delete, link-to-owner

**Proposal:** Delete the four files. In the README's "Skill framings" list, replace each local link with a link to `mehrlander/web-tools/skills/<name>/SKILL.md`. Keep `source-manifest.md` and `source-manifest-example.md`, which have no shipped counterpart. Handle `outlining.md`, `outlining-revised.md` and `source-anchoring-revised.md` separately (proposal 2).

**Rationale:** The skill library in web-tools is the owner of these texts. The plugin ships them to every session. A second copy in home can only drift, and it gives a session two candidates to edit.

**Evidence:** A word-level diff ratio of 1.00 between each file and `web-tools/skills/<name>/SKILL.md`, with equal word counts (2,792 / 918 / 934 / 1,706 on both sides). The README itself calls them "a draft developed elsewhere" (README "Skill framings" intro).

**Words removed:** 6,350.

**Inbound dependencies:** Links from `projects/doc-audit/README.md`, `full-picture.md`, `source-anchoring-revised.md`, `source-manifest.md`, `2026-06-23-one-machine-three-questions.md` (a dated record; leave its links to break or repoint them to the web-tools copies), `projects/local-models/README.md` and `projects/local-models/corpus-analysis.md` (atomic-decomposition). Also listed in `data/doc-growth.json` and in run output under `projects/local-models/runs/` and `projects/term-migration/runs/`, which are dated results and need no change. No script or check loads these files.

**Risk:** Low. The dated record `2026-06-23-one-machine-three-questions.md` reads these drafts as its patients; a repointed link to the web-tools skill at a pinned commit keeps its meaning.

## 2. Resolve the three unshipped skill revisions: promote or delete, not park

**Repo:** mehrlander/home

**Targets:** `projects/doc-audit/outlining.md` (757), `projects/doc-audit/outlining-revised.md` (1,015), `projects/doc-audit/source-anchoring-revised.md` (1,444).

**Kind:** delete (after one decision each)

**Proposal:** For each revision, the owner decides whether it replaces the shipped skill. If yes, move its text into `web-tools/skills/<name>/SKILL.md` by PR and delete the home copy. If no, delete it; git holds it. `outlining.md` is an older draft of a skill that has since shipped with a different text, so it goes either way.

**Rationale:** A "revised" draft parked beside the thing it revises is an open proposal with no owner and no deadline. The README frames these as "parked here as they accumulate", which is how they stayed parked from June to September.

**Evidence:** `outlining.md` against the shipped `web-tools/skills/outlining/SKILL.md`: diff ratio 0.23, different descriptions. `outlining-revised.md`: 0.13. `source-anchoring-revised.md`: 0.45 against the shipped skill, which instead matches the unrevised draft exactly (proposal 1).

**Words removed:** 3,216 from home (some of it may move to web-tools instead).

**Inbound dependencies:** `projects/doc-audit/README.md`; `2026-06-23-one-machine-three-questions.md` (dated record); `created/2026-07-19-source-anchoring-module-structure.md` links `source-anchoring-revised.md`; `data/doc-growth.json` lists the paths.

**Risk:** Medium on content, since a revision may hold ideas the owner wants. The decision is the owner's; the proposal is only that each file leaves the park.

## 3. Delete doc-audit's full-picture.md; the README already carries it

**Repo:** mehrlander/home

**Targets:** `projects/doc-audit/full-picture.md` (2,435 words); the README paragraph that introduces it (`projects/doc-audit/README.md` line 21).

**Kind:** delete

**Proposal:** Delete `full-picture.md` and the README sentence pointing to it (line 21). If the README needs a narrative lead, add at most two sentences from full-picture's "What it is" section.

**Rationale:** The file is a hand-maintained restatement of the README, and its own frontmatter says so: "A read-once companion to the README's index. Hand-written, not generated; refresh it when the shape of the project changes." Nothing refreshed it. A duplicate that must be refreshed by hand has already drifted.

**Evidence:** Its Status section (`full-picture.md` lines 70 to 84) repeats README "Current state" (README lines 32 to 57) item for item, but omits `fact-census/`, `tools/segmenter-gate.py` and `ANTIPATTERNS.md`, all present in the README. Its "Where it sits" (lines 92 to 96) repeats README "Related". Its "Where it is going" (line 98 onward) summarizes README "Next". Dated 2026-07-02.

**Words removed:** 2,435.

**Inbound dependencies:** Only `projects/doc-audit/README.md`. Other hits for `full-picture` in home name the root `full-picture.md`, a different file. Term-migration run CSVs list it as scanned input (dated results, no change needed).

**Risk:** Low.

## 4. Collapse the 2026-08-18 "rebuilt what existed" story to one sentence, in one place

**Repo:** mehrlander/home

**Targets:** `projects/text/INSTRUMENTS.md` lines 7 to 47 (the verification-pass paragraph and "Why this file exists", 407 words) and "Two things the index makes visible" (lines 501 to 515, 159 words); `projects/text/instruments/concept-lab/README.md` "A sibling ran the same problem from the other end" (lines 34 to 45, 105 words); `projects/local-models/README.md` "What already exists", second paragraph (lines 61 to 66, about 60 words).

**Kind:** collapse-narrative

**Proposal:** Replace the INSTRUMENTS.md intro and "Why this file exists" with two sentences: "One row per mechanical text tool in the estate, by unit of analysis. Search here before building an instrument; sessions have rebuilt tools that were already here." Delete "Two things the index makes visible" and the concept-lab section. In local-models, keep only "Read it before building a text instrument."

**Rationale:** The same incident is told four times across three files, and home's `CLAUDE.md` ("Check the catalog before building one; sessions have repeatedly rebuilt what already existed") already states the rule the story justifies. The story belongs to the dated record; the rule is one line. "Two things the index makes visible" is commentary on findings whose owners are the run logs.

**Evidence:** The four-item table of tools "proposed as missing" (INSTRUMENTS.md lines 20 to 25); the same episode in concept-lab README line 36 ("On 2026-08-18 a claim-strength run ... built lexical measures ... without knowing this folder existed") and local-models README line 63 ("It exists because a 2026-08-18 session proposed four things as unbuilt"). The verification paragraph (lines 7 to 14) describes a one-time check made on 2026-08-18 and the four errors it fixed.

**Words removed:** about 700.

**Inbound dependencies:** `web-tools/pages/text-lab.html` renders `projects/text/INSTRUMENTS.md` (line 85) as a whole file; it does not anchor to these sections. No check reads them.

**Risk:** Low.

## 5. Turn the instrument catalog into data, and stop restating measurements its sources own

**Repo:** mehrlander/home

**Targets:** `projects/text/INSTRUMENTS.md` "Instruments by unit" (lines 72 to 489, the bulk of 5,141 words).

**Kind:** move-to-data-or-check, link-to-owner

**Proposal:** Create `projects/text/instruments.json` (or `.csv`) with one record per instrument: name, path, unit, consumes, emits, a one-line headline result, and a link to the log that measured it. Generate `INSTRUMENTS.md` from it with a small builder, the way `projects/local-models/probes/build-index.py` generates `probes/README.md` from `probes.json`, and add the builder's `--check` to `tools/verify-artifacts.sh`. The measured detail (AUCs, counts, negatives, hedges) stays in the owners: `instruments/concept-lab/findings.md` and each run README. Drop the move history in entries ("Lived in `web-tools/tools/` until 2026-08-25, then in `projects/local-models/` until ...", line 156); git and the concept-lab README already record it.

**Rationale:** The file says of itself that "every number below is borrowed from a source that measured it" (line 7), and that borrowing already produced four misquotes that a manual pass had to fix. A copy of a number is a second statement of a fact with an owner. The sibling registers show the pattern already works in this estate: `probes.json` plus a generated README, and `resources.csv`. Text Lab would also gain a structured list to filter rather than a Markdown file to render.

**Evidence:** `projects/text/INSTRUMENTS.md` lines 7 to 14 (the misquote pass); the `registerlab.py` entry (lines 112 to 143) restates figures (0.759, 0.783, 0.574, 0.804, 0.344, 0.738, 0.506) from the findings log; `termlab.py` is described both here (lines 87 to 108) and in `instruments/concept-lab/README.md` "termlab.py" (lines 46 to 99). `projects/local-models/probes/build-index.py` line 1: "Generate probes/README.md from probes.json".

**Words removed:** about 2,500 to 3,000 of authored prose, replaced by a generated table of perhaps 1,500 words.

**Inbound dependencies:** `web-tools/pages/text-lab.html` line 85 reads the Markdown path; a generated file at the same path keeps it working. home `CLAUDE.md` "Where things go" and `projects/doc-audit/README.md` link the path. Sessions archived in `web-tools-private/sessions/` cite it (records, no change).

**Risk:** Medium. It needs a builder and one pass to write the records. The headline field must stay a short pointer, or the restatement returns inside the JSON.

## 6. Retire the dead pointer file local-models/INSTRUMENTS.md

**Repo:** mehrlander/home

**Targets:** `projects/local-models/INSTRUMENTS.md` (87 words).

**Kind:** delete

**Proposal:** Delete the file.

**Rationale:** Its own text says it exists only so Text Lab would not blank "between the two changes". Text Lab now reads `projects/text/INSTRUMENTS.md`, so that window has closed.

**Evidence:** `projects/local-models/INSTRUMENTS.md` lines 9 to 12. `web-tools/pages/text-lab.html` line 85: `INSTRUMENTS: 'projects/text/INSTRUMENTS.md'`. A grep of web-tools and home finds no other live reader.

**Words removed:** 87.

**Inbound dependencies:** Only dated material: `projects/text/runs/2026-09-16-import/` (`sources.json`, `import_experiment.py` name it as an import source, already copied), `projects/term-migration/runs/2026-08-29-register/instances.csv`, and passage text in `projects/text/passages.jsonl`. None needs the file to exist.

**Risk:** Low.

## 7. Cut local-models README to what is local: boundary, foothold, and pointers

**Repo:** mehrlander/home

**Targets:** `projects/local-models/README.md` (2,233 words): "Long-running batch work" (line 101, 78 words), "Role-specific model pipelines" (line 113, 70), "Model and runtime evaluation" (line 125, 118), "Pressure points" (line 138, 149), "Existing material" (line 151, 137), "Runs" (line 164, 346), "Inference, not training" (line 28, 237).

**Kind:** rewrite-shorter, link-to-owner

**Proposal:** Delete the four generic-advice sections (batch work, pipelines, evaluation, pressure points). Replace "Runs" with one line per run folder (title and link only), or a sentence that points at `runs/`. Cut "Existing material" to the links not already given elsewhere in the README. Cut "Inference, not training" to its first paragraph plus the link to the 2026-08-19 chron entry, which holds the reasoning.

**Rationale:** The four advice sections are general guidance about running local models. Nothing in them is measured here or specific to this estate, and none of it has been acted on. The "Runs" section restates findings each run README owns, and it has already drifted: it lists three runs while `runs/` holds four (`2026-08-19-model-voice` is missing). "Existing material" repeats links that "Boundary" and "Workloads" already give (document audit, tiers-and-build-plan, atomic decomposition).

**Evidence:** `ls projects/local-models/runs` returns `2026-08-04-pension-classification`, `2026-08-18-claim-strength`, `2026-08-19-model-voice`, `2026-08-26-scare-quote`; README "Runs" lists the other three only. The scare-quote entry (about 170 words) restates the run's numbers (137 flags, 3.42 a paragraph, 66, 115 added words), which its run README owns. "Inference, not training" defers its own argument to `chron/2026/08/2026-08-19-weights-context-and-a-cpu-laptop.md`.

**Words removed:** about 900.

**Inbound dependencies:** `projects/local-models/README.md` is linked from doc-audit, text and home `CLAUDE.md` by path, not by section anchor. The doc-audit README links `../local-models/README.md` only. No script reads sections.

**Risk:** Low. The generic sections might be wanted when an overnight run is finally built; git holds them.

## 8. Move term-migration's retired method out of the living project

**Repo:** mehrlander/home

**Targets:** `projects/term-migration/PASSES.md` (2,645 words); README "Run artifacts" (lines 95 to 110) and "If a term ever does need per-occurrence treatment" (lines 146 to 150).

**Kind:** restructure, collapse-narrative

**Proposal:** Move `PASSES.md` into `runs/2026-08-29-register/` beside the run it governed, or delete it. Move "Run artifacts" there too, since it lists the artifacts of the exhaustive method only. Reduce "The catalog is a closed case study" and its three subsections (lines 111 to 150) to one paragraph: the per-occurrence catalog was tried on `register`, migrated no occurrence, and was stopped on 2026-08-30; the durable output is the sense separation that the lint pattern uses; see the run README. Keep the Method section and the six rules, which are the live part.

**Rationale:** The README's own summary says "The per-occurrence catalog behind that conclusion is a closed case study", and the section on it ends "expect the answer to be that a sense-scoped lint plus the six rules is enough." A 2,645-word manual for the method the project retired, sitting at the project root, reads as current doctrine. Its home is the dated run.

**Evidence:** README frontmatter summary (line 3); README line 113 ("Stopped 2026-08-30 ... migrated no occurrence of the term"); README lines 146 to 150. `grep PASSES` over `projects/term-migration/tools/` returns nothing, so no tool reads the file.

**Words removed:** 2,645 moved out of the living set, plus about 600 from the README narrative.

**Inbound dependencies:** README lines 109 and 148 link `PASSES.md`. `runs/2026-08-29-register/README.md` refers to classes and passes; a relative link there becomes local after the move.

**Risk:** Low.

## 9. Close out surfacer's PLAN and DEPLOY; keep one runbook paragraph

**Repo:** mehrlander/home

**Targets:** `projects/surfacer/docs/PLAN.md` (2,282 words), `projects/surfacer/docs/DEPLOY.md` (1,993 words).

**Kind:** delete, collapse-narrative

**Proposal:** Delete `PLAN.md`; its question is answered and the README already says so. From `DEPLOY.md`, keep only "First-time setup on a new laptop" and "Routine updates" (396 words), moved into the README or `app/README.md`; delete the rest. Keep `REFERENCE.md`, which describes the app as built.

**Rationale:** The project is parked ("Not currently being worked on", README line 15). PLAN.md opens by saying planning stopped on 2026-08-16 and the question it held was "answered the second way": the Web Tools app absorbed the mission. DEPLOY.md is a plan for a move that has happened, and it still describes the pre-move state in the present tense.

**Evidence:** `docs/PLAN.md` lines 3 to 8. `docs/DEPLOY.md` "What is here today" (line 5 onward): "The actual application lives at `C:\Users\mehrl\Downloads\Surfacer\` ... Neither file contains a line of executable code", while README line 5 says "The app is checked in: `app/`". `git log` shows the project's only recent commit is a loader change on 2026-09-26.

**Words removed:** about 3,880.

**Inbound dependencies:** Only `projects/surfacer/README.md` lines 29 and 30. No script reads either file.

**Risk:** Low. If Surfacer is picked up again, PLAN.md is in git.

## 10. Delete repo notes for repos the estate checks out, and one for home itself

**Repo:** mehrlander/home

**Targets:** `repos/home.md` (465 words), `repos/web-tools.md` (289), `repos/shortcut-tools.md` (415); `repos/index.md` "Three things follow" (lines 59 to 86, 280 words) and the "Per-repo file format" section.

**Kind:** delete, link-to-owner, collapse-narrative

**Proposal:** Delete the three notes. Their index rows keep a one-line description and link straight to the repo. In `repos/index.md`, keep the store dependency table and replace the four bold paragraphs after it with two sentences: "home and budget-wa read each other, as do home and spend-wa. A bare clone cannot run every check; suites name their skips." Cut "Per-repo file format" to one sentence. The remaining notes (the data stores, Wring, Alp and the small tool repos) stay, since no session has those checked out and a note is their only local orientation.

**Rationale:** The index says these notes are "pointer-grade" and that "each repo's own README is the real reference". For web-tools and shortcut-tools that README is always present in a session of this estate, and for home the note describes the repo it sits in, which `README.md` and `CLAUDE.md` "Where things go" already describe. All three are stale in ways that mislead.

**Evidence:** `repos/web-tools.md` describes a `kits/` folder and a `docs/CONVENTIONS.md` sync; neither path exists in the web-tools checkout. `repos/home.md` is stamped 2026-07-06, lists `projects/budget-wa/` (dissolved 2026-08-01, per the same note) and skills `/rounds` and `/update-full-picture`, which home `CLAUDE.md` now calls depths of `/repo-review`. `repos/shortcut-tools.md` gives the repo as "a reference dataset of 810 entries" in its index row and "What it is", while its own 2026-09-05 section says it holds 22 Python tools and the chain tooling.

**Words removed:** about 1,300.

**Inbound dependencies:** `tools/generate-full-picture.sh` line 64 counts `repos/*.md` files (the count changes; nothing breaks). `app/data.js` lists `repos/shortcut-tools.md` as a path in its generated payload; `tools/build-home-app.py` rebuilds it. `created/2026-06-12-the-recall-test/data/metrics.json` cites the paths as a dated result. `projects/doc-audit/README.md` links `repos/Wring.md`, which stays. A `refresh-repos-notes-nzg5zd` task exists in `tracker/tasks/`; this proposal shrinks its scope.

**Risk:** Low.

## 11. Replace wps's model-written inventory with a generated one, and drop ORGANIZATION.md

**Repo:** mehrlander/home

**Targets:** `projects/wps/docs/INVENTORY.md` (4,945 words), of which the per-file sections from line 231 on are 2,902 words; `projects/wps/docs/ORGANIZATION.md` (967 words).

**Kind:** move-to-data-or-check, delete

**Proposal:** Extend `tools/inventory-counts.py` (which already parses every `function` definition in `app/`) to emit the per-file function list, exported versus internal and its imports and dot-sources, as a generated section of `INVENTORY.md`. Keep the authored part as a short table of one-line purposes per file, in a CSV if it grows. Delete the model-written per-function prose. Delete `ORGANIZATION.md`: its commit groupings already appear in `INVENTORY.md` "Commit Groupings" (line 150), and its one kept finding, that BytesViewer is consumed by MainWindow and not Clipboard, is one sentence that can move into `INVENTORY.md`.

**Rationale:** `INVENTORY.md`'s own banner says the per-function prose "has not been re-verified line by line" and that "where the two disagree, the derived figures win." A document whose authority rests on a script should be the script's output. `ORGANIZATION.md` is described by its banner as a frozen arrival proposal that the adopted layout departs from, and the README holds the living layout.

**Evidence:** `projects/wps/docs/INVENTORY.md` lines 5 to 21 (the provenance note). `projects/wps/tools/inventory-counts.py` lines 22 to 26 (it already reads `app/` with a `function` regex). `projects/wps/docs/ORGANIZATION.md` line 2 (banner) and "Commit Groupings Summary" (line 211) against `INVENTORY.md` line 150. The closed task `reconcile-inventory-docs-udxhtg` records that only the counts were brought into agreement.

**Words removed:** about 3,500 of authored prose, replaced by generated output.

**Inbound dependencies:** `tools/inventory-counts.py --check` reads `INVENTORY.md` (lines 23 and 128 to 203), and `tools/verify-artifacts.sh` line 216 runs it, so the builder change and the doc change must land together. `projects/wps/README.md` lines 12, 13 and 144 link both files. `docs/duplicate-definitions.md` links `INVENTORY.md#statistics`. The open wps task `theme-consistency-pass-6weoqb` cites the Forms Overview table (lines 18 to 36), so that authored table should survive or the task should be updated.

**Risk:** Medium. It is a small code change, and some purpose lines are worth keeping.

## 12. Retire doc-audit's stale Next list and superseded concept statements

**Repo:** mehrlander/home

**Targets:** `projects/doc-audit/README.md` "Next" (line 95 to end, 390 words); `projects/doc-audit/tiers-and-build-plan.md` (1,523) and `projects/doc-audit/instruments-and-analyst.md` (1,917), both superseded statements in the README's "Lineage".

**Kind:** rewrite-shorter, restructure

**Proposal:** Cut "Next" to the items still open, one line each. Drop item 1 (apply the web-tools README proposal) and item 2 (verify kit consumption because "this session could not reach web-tools at all"). Rename the two superseded statements to dated filenames (`2026-06-05-tiers-and-build-plan.md`, `2026-06-06-instruments-and-analyst.md`) so they read as records, which the Lineage section already treats them as.

**Rationale:** Item 1 proposes applying a condensed rewrite of the web-tools README, computed against a 2,016-word version pinned in June. That README is now 2,843 words and has been rewritten many times since, so the proposal no longer applies. Item 2's blocker (no access to web-tools) no longer holds: web-tools is checked out in every estate session, and `lib/kits/persistence.js` exists to load. The Lineage section says "The newest is current", which makes the two older statements records with undated names.

**Evidence:** `projects/doc-audit/README.md` lines 95 to 131; `wc -w web-tools/README.md` returns 2,843; `full-picture.md` "The one run" gives the patient as 2,016 words. README "Lineage" (lines 23 to 30). `projects/local-models/README.md` links both statements by current name (lines 98, 123 and 155).

**Words removed:** about 300 from "Next". The rename removes about 3,440 from the living set without deleting.

**Inbound dependencies:** For the rename: `projects/doc-audit/README.md`, `full-picture.md` (deleted under proposal 3), `projects/local-models/README.md` and `corpus-analysis.md`, and the dated `2026-06-09-tightening-revisited.md`. Every link would need repointing in the same commit. The lint's dated-filename check applies to the new names.

**Risk:** Low for "Next". The rename is optional; skip it if link churn outweighs the signal.

## 13. news/README: point at the skill and the page that now own the views

**Repo:** mehrlander/home

**Targets:** `news/README.md` (1,260 words): "Views" (lines 105 to 118), the "Why this hook acts" paragraphs in "Capture cadence" (lines 93 to 103, 160 words), and the "Design origin" paragraph (line 10).

**Kind:** link-to-owner, rewrite-shorter

**Proposal:** Replace the Briefs bullet with "Briefs: `briefs/YYYY-MM-DD.md`, written by the `/news` skill, which owns their format." Replace the Dashboard bullet, which calls the dashboard "planned", with a link to web-tools `pages/news/news.html`. Cut the cadence justification to one sentence: "Feeds roll items off in about three days, so the fetch runs at session start when two days have passed; the measurement is in task `rss-buffer-loss-k3n7pq`." Drop "Design origin".

**Rationale:** The brief format (title, topic headings, two to five KB, one-line brief when empty) is stated in both the README and `.claude/skills/news/SKILL.md`, which is the file a session executes. The dashboard exists, so "planned" is wrong. The cadence paragraphs argue a doctrine point that the README's own next sentence defers to the tracker task.

**Evidence:** `news/README.md` lines 111 to 114 against `.claude/skills/news/SKILL.md` lines 45 to 48 ("Start with `# Title` ... under the topic headings of `me/news-interests.md` ... Two to five KB"). `web-tools/pages/news/news.html` lines 12 to 25 describe the ledger and sources facets and cite `news/README.md` for the honesty rule. `app/README.md` line 11 says News "moved there".

**Words removed:** about 280.

**Inbound dependencies:** `web-tools/pages/news/news.html` line 18 cites `news/README.md` for the ledger's honesty rule, which stays. No script parses the README.

**Risk:** Low.

