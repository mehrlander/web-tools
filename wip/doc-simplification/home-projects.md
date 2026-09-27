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

