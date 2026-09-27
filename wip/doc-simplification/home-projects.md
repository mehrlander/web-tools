# Slice: home-projects

## Summary

(Filled in at the end.)

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

