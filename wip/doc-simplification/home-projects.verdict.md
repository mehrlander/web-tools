# Verdicts: home-projects

## 1. Delete the four doc-audit files that are byte-identical copies of shipped skills

**Verdict:** keep

**Checked:** `cmp` says all four differ from `web-tools/skills/<name>/SKILL.md`, so "byte-identical" is false. The differences are layout only: blank lines carrying a trailing space in the home copies (`diff` at lines 5, 7, 9 onward), blank-line placement, and a missing final newline. The one content change is in `source-anchoring.md:61`, where the home copy has an em dash that the shipped skill removed. The shipped copy is the newer text, so the home copies are stale rather than equal. Word counts match (`wc -w`: 2,792, 918, 934, 1,706). Inbound links confirmed at `projects/doc-audit/README.md:68,71,75,76`, `source-manifest.md:43`, `source-anchoring-revised.md:76-79`, `full-picture.md:66`, `2026-06-23-one-machine-three-questions.md:120`, `projects/local-models/README.md:97,156` and `corpus-analysis.md:27`. No tool reads them: `tools/verify.sh`, `tools/segmenter-gate.py` and `demo/build-data.py` in doc-audit read other files, and `data/doc-growth.json` is a dated snapshot.

**Corrected words removed:** 6,350. Correct the evidence line to "same text, except for whitespace and one em dash the shipped copy removed".

## 2. Resolve the three unshipped skill revisions: promote or delete, not park

**Verdict:** revise

**Checked:** Word counts hold (757, 1,015, 1,444). `outlining.md` is a middle draft: its description differs from both `outlining-revised.md` and the shipped `skills/outlining/SKILL.md` (heads compared). The proposal misses that promotion is already a recorded decision for one file. `created/2026-07-19-source-anchoring-module-structure.md:111` lists "revised parent draft (PRODUCE/AUDIT) | home `projects/doc-audit/source-anchoring-revised.md` | promote to the web-tools skill (not yet done)". The synthesis record `2026-06-23-one-machine-three-questions.md:30-31` uses the two revised drafts, not the shipped skills, as the subjects of its table, so deleting them without promotion breaks the record's links to the things it analyzed.

**Revised proposal:** Delete `outlining.md` now. Treat `source-anchoring-revised.md` as an open promotion that the 2026-07-19 record already decided: open a web-tools PR carrying it, then delete the home copy and repoint the synthesis table at the pinned web-tools commit. Put `outlining-revised.md` to the owner as the one real decision. Do not delete either revision before its link in the 2026-06-23 record has a target.

**Corrected words removed:** 757 now. Up to 2,459 more leave home, of which 1,444 moves to web-tools rather than disappearing.

## 3. Delete doc-audit's full-picture.md; the README already carries it

**Verdict:** keep

**Checked:** `wc -w` gives 2,435. The frontmatter says "Hand-written, not generated; refresh it when the shape of the project changes" (`full-picture.md:5`). `grep -c "fact-census\|segmenter\|ANTIPATTERNS"` returns 0, so the omissions are real. The only live inbound link is `projects/doc-audit/README.md:21`. `tools/lint-conventions.py:76` and `tools/duplicated-claims.py:46` exclude the basename `full-picture.md`, which targets the root file and is unaffected. `tools/build-home-app.py` reads only `projects/*/README.md` from projects (line 14). No `content.csv` row names it. Its narrative sections ("How the concept evolved", "The seven-step architecture") restate the Lineage documents the README already indexes.

**Corrected words removed:** 2,435, plus the one README sentence.

## 4. Collapse the 2026-08-18 "rebuilt what existed" story to one sentence, in one place

**Verdict:** keep

**Checked:** `sed -n 7,47p INSTRUMENTS.md | wc -w` gives 407. "Two things the index makes visible" is at lines 501 to 515. The concept-lab section is at `instruments/concept-lab/README.md:34-45`, and the local-models retelling at `projects/local-models/README.md:61-66`. home `CLAUDE.md` already carries the rule. `web-tools/pages/text-lab.html:238-244` fetches the whole file and renders it with `GuideRender`, with no section anchors. Keep one clause of the diagnosis in the replacement, that tools are filed by the project that built them and named for their implementation, because it is the reason the file is organized by unit, and Text Lab's header comment (`text-lab.html:35-38`) repeats that rationale.

**Corrected words removed:** about 700.

## 5. Turn the instrument catalog into data, and stop restating measurements its sources own

**Verdict:** revise

**Checked:** The catalog body (lines 72 to 489) is 4,113 words over 28 entries. The registerlab figures are all present in their owner: `grep` finds each of 0.759, 0.783, 0.574, 0.804, 0.344, 0.738 and 0.506 in `instruments/concept-lab/findings.md` and `registerlab.py`. The precedent is weaker than described. `projects/local-models/probes/build-index.py` has no `--check` flag and no `argv` handling at all, and neither `tools/verify-artifacts.sh` nor `.githooks/pre-commit` runs it. `probes.json` is 3,423 words because each record carries `method`, `result` and `verdict` prose, so the precedent moves prose into JSON rather than removing it. A JSON conversion of this catalog would do the same unless the headline field is kept numberless. Text Lab renders Markdown through `GuideRender`, so a generated file at the same path keeps working.

**Revised proposal:** Do the link-to-owner cut first, in the Markdown: replace restated figures with one-line descriptions plus a link to the measuring log, and drop the move history ("Lived in `web-tools/tools/` until ...", line 156). That removes the drift source with no builder. Convert to data plus a builder only as a second step, and if it is done, add the `--check` and the verify step as new work, since the precedent has neither.

**Corrected words removed:** about 1,500 to 2,000 from the entries. The data conversion itself removes nothing further.

## 6. Retire the dead pointer file local-models/INSTRUMENTS.md

**Verdict:** keep

**Checked:** `wc -w` gives 87. `text-lab.html:85` reads `projects/text/INSTRUMENTS.md`. A grep of home, web-tools and shortcut-tools for `local-models/INSTRUMENTS` finds no live Markdown link, script or page, only fact-census CSV rows about a different file and the proposal itself. No relative link to `INSTRUMENTS.md` from inside local-models remains outside dated run prose.

**Corrected words removed:** 87.

## 7. Cut local-models README to what is local: boundary, foothold, and pointers

**Verdict:** keep

**Checked:** Section counts by `wc -w`: Inference 237, batch work 78, pipelines 70, evaluation 118, pressure points 149, existing material 137, runs 346. `ls runs` returns four folders and "Runs" lists three, omitting `2026-08-19-model-voice`. The pipeline section's one local tie is a link to `instruments-and-analyst.md`, which "Workloads" already gives (line 98). Two dependencies to carry: "Existing material" links `../doc-audit/atomic-decomposition.md` (line 156), which proposal 1 deletes, so the surviving link must point at the web-tools skill; and "Next experiments" item 1 (line 199) cites "item 4 on document audit's Next list", which proposal 12 renumbers.

**Corrected words removed:** about 850.

## 8. Move term-migration's retired method out of the living project

**Verdict:** keep

**Checked:** `wc -w PASSES.md` gives 2,645. Only `README.md:109,148` link it. `tools/check.py` is the live check (`tools/verify-artifacts.sh:967` runs it on the dated run) and does not read `PASSES.md`. The lint exempts the whole `projects/term-migration/` prefix for the retired coinage (`tools/lint-conventions.py:374`), so the moved file stays exempt. "Run artifacts" (lines 95 to 110) is 184 words and "The catalog is a closed case study" with its subsections (lines 111 to 150) is 719 words.

**Corrected words removed:** 2,645 plus 184 moved out of the living set, and about 600 cut from the README narrative.

## 9. Close out surfacer's PLAN and DEPLOY; keep one runbook paragraph

**Verdict:** revise

**Checked:** Counts hold (2,282 and 1,993). `DEPLOY.md` "What is here today" is stale as stated. Two dependencies are missed. `projects/surfacer/app/.gitignore:12` says probe files are "kept out per DEPLOY.md", so the ignore rationale lives in DEPLOY's "Proposed layout in the repo" (lines 57 to 95). And the README does more than link PLAN: "What is here" and "Where it was left" (`README.md:29-35`) send a reader to PLAN.md for the open questions of a project the README says "may get picked up again". The setup and routine sections are 391 words.

**Revised proposal:** Delete PLAN.md and rewrite the README's "Where it was left" to one sentence: the question was answered when the Web Tools app absorbed the mission, with the APP.md link. From DEPLOY, keep the setup and routine sections, move them into the README, carry the ignore rationale into a comment in `app/.gitignore`, and delete the rest.

**Corrected words removed:** about 3,700.

## 10. Delete repo notes for repos the estate checks out, and one for home itself

**Verdict:** keep

**Checked:** Counts hold (465, 289, 415). `repos/web-tools.md` names `kits/` and `docs/CONVENTIONS.md`, and `ls` finds neither in web-tools. It also claims a live CONVENTIONS sync in its stamp line. `tools/generate-full-picture.sh:64` only counts files. The refresh task `refresh-repos-notes-nzg5zd` is `status: done`. One inbound link is missed: `chron/threads/apple-shortcuts.md:11` lists `repos/shortcut-tools.md`, so the thread entry must be repointed at the repo or dropped. The index row for shortcut-tools ("Reference dataset of 810 entries") is itself stale and should be fixed in the same edit. By `awk`, "Three things follow" through the table's end is 280 words and "Per-repo file format" is 217.

**Corrected words removed:** about 1,550.

## 11. Replace wps's model-written inventory with a generated one, and drop ORGANIZATION.md

**Verdict:** revise

**Checked:** Counts hold (4,945, of which 2,902 from line 231; ORGANIZATION 967). The per-function prose has no other home: `grep -rl "\.SYNOPSIS"` over the 54 `.ps1` and `.psm1` files in `app/` returns none, so there is no comment-based help to generate from. `projects/wps/README.md:144` names INVENTORY as the place to "Start there when looking for a capability", and that use depends on the one-line function descriptions, which a generated name list cannot supply. ORGANIZATION's commit groupings duplicate `INVENTORY.md:150-162`, and its README entry already calls it frozen (`README.md:13`). The "Next Steps for Organization" section (`INVENTORY.md:863` onward) proposes a `modules/<name>/` layout that has since been adopted as `app/Modules/<name>/`, so it is stale.

**Revised proposal:** Delete `ORGANIZATION.md` and move the BytesViewer sentence into INVENTORY's Forms section. Delete INVENTORY's "Next Steps for Organization". Keep the per-function descriptions until they have another home. If mechanizing is wanted, extend `inventory-counts.py --check` to flag function names in the prose that no longer exist in `app/`, rather than replacing the prose with a name list. Keep the Forms Overview table for `theme-consistency-pass-6weoqb`.

**Corrected words removed:** about 1,100.

## 12. Retire doc-audit's stale Next list and superseded concept statements

**Verdict:** revise

**Checked:** Items 1 and 2 are stale as described: `wc -w web-tools/README.md` gives 2,843, and `lib/kits/persistence.js` exists. The rename fails. Code and a live document cite both files by name: `audit.py:4,19` describe the tool relative to `tiers-and-build-plan.md`; `audit.py:440` writes that link into its output, which `tools/build-audit-demo.py --check` holds in `audit-demo.md` through `tools/verify.sh`; `tools/build-audit-demo.py:45` and `surprise.py:15` name them; and `ANTIPATTERNS.md` takes each entry's processing tier "from the prosthetics table in instruments-and-analyst.md" (README line 50), so that file is a live reference, not only a record. A rename is a code change plus a regenerated artifact for no reader benefit. Separately, dropping items 1 and 2 renumbers item 4, which `projects/local-models/README.md:199` cites by number.

**Revised proposal:** Cut items 1 and 2 from "Next" and update the "item 4" citation in local-models, or cite the item by title. Drop the rename.

**Corrected words removed:** about 170.

## 13. news/README: point at the skill and the page that now own the views

**Verdict:** keep

**Checked:** `wc -w` gives 1,260. The brief format restates `.claude/skills/news/SKILL.md:43-48`. The dashboard exists and does what the "planned" bullet describes: `web-tools/pages/news/news.html:18-22` reads the ledger and commits follow and unfollow edits to `news/sources.json`. That page cites `news/README.md` for the honesty rule and spec validation (lines 18 and 34), and both stay. No script parses the README.

**Corrected words removed:** about 280.

## Missed

**termlab is described twice in the slice.** `projects/text/instruments/concept-lab/README.md` "termlab.py" (lines 46 to 99, 402 words) and the termlab entry in `projects/text/INSTRUMENTS.md` (lines 85 to 108, 194 words) cover the same tool. Proposal 5 cites this as evidence but proposes nothing for it. The catalog entry should be one line linking the concept-lab README section, which is the tool's own documentation. The same check applies to the other concept-lab tools with entries in both files. This saves about 150 to 200 words, and more if the pattern repeats.

No other large simplification holds up. The remaining large files are generated (`local-models/probes/README.md`), dated records, or operational (`wps/docs/INSTALLATION.md` explains `data/installation.json`, which `tools/installation-check.py` gates).
