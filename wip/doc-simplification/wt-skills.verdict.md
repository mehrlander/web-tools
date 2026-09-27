# Verdicts: wt-skills

## 1. Delete the nine vendored built-in skills from the library

**Verdict:** revise

**Checked:** Word counts match `wc -w` exactly for all nine (28,622 total). Files on disk total 3.67 MB, close to the claimed 4 MB. Manifest rows 6, 8, 10, 20, 24, 30, 33, 37, 46 are correct. The library has 45 skills, not 46 (`ls -d skills/*/`, and `manifest.csv` has 46 lines including the header). The estate grep is clean; the one hit in `consolidate-memory` is the word "restates" matching `estate`. The synced account copies carry a `source` field in `/root/.claude/skills/synced/*/manifest.json`: docx, pdf, pptx and xlsx are `anthropic`, skill-creator and doc-coauthoring are `anthropic-example`, and all six are newer than the library copies (docx updated 2026-09-23, pptx 2026-09-22). So the six are supplied by Anthropic in this venue and the library copies are stale. The three Cowork skills are **not** in the synced set, so the claim that "the platform already supplies every one of them" is false for Claude Code on the web. It does not change the outcome: `schedule` calls `create_scheduled_task` and `update_scheduled_task`, and `setup-cowork` calls a role-picker tool, and both exist only in Cowork, where the skills are built in. `consolidate-memory` assumes an auto-memory section in the system prompt. Loaded anywhere else, the three do nothing useful. Non-Claude consumers: `AGENTS.md` and `GEMINI.md` do not mention `skills/` or `load-skill`, and no page, test or script reads the nine folders. `tools/test/map-federated.test.mjs:174` asserts more than 20 library rows, and 36 remain.

**Revised proposal:** Delete the nine folders and rows as proposed, but state the reason per group: the six Anthropic skills are supplied by the account in Claude Code web and claude.ai (verified by the synced manifest's `source` field), and the three Cowork skills only function in Cowork, which ships them. Add these dependencies, which the reader missed. (a) `data/design/content.csv:5` says "117 vendored .xsd schemas sit alongside it and are supplied; not yet isolated". Deleting xlsx, docx and pptx removes those schemas, so that row must be rewritten in the same commit or it states something false. (b) `skills/source-anchored-xlsx/SKILL.md:12,114` (and its copy at `home/projects/doc-audit/source-anchored-xlsx.md`) tells the reader to "lean on the xlsx skill" and run its `recalc.py`. That now resolves only to the account's built-in, so a Claude Code CLI session on a machine without account skill sync loses it. Name that in the README sentence. (c) `home/chron/2026/09/2026-09-14-the-checks-that-passed-while-being-wrong.md:137` names `skills/xlsx/scripts/office/schemas/sml.xsd` as "the obvious next instrument" for validating workbooks. It is a dated record and may go stale, but if anyone builds that validator it needs the schema from the built-in or from `anthropics/skills`. Correct the README count ("16 directories") while editing it, since the plugin now registers 18. Treat the daisyUI `llms.txt` follow-on as a separate proposal, not part of this commit.

**Corrected words removed:** 28,622.

## 2. Reduce the `show-repo` skill to a loader

**Verdict:** revise

**Checked:** `wc -w` gives 686 for the file. The four targeted spans hold 410 words (204, 43, 58, 105), so about 390 net after a one-line fallback. The fallback it would point to exists at `.claude/skills/default/SKILL.md:48-49`. `grep -n "Stage a fileset" docs/SURFACING.md` returns nothing; the entry is at `docs/surfacing-extended.md:16`. The token caveat drift is real but located wrongly. The owner that contradicts it is `docs/surfacing-extended.md:18`, which documents a stage `#gz=` form for pasted text that "opens for a reader with no token". `docs/stage.md:603-608` says the same through `&gz=`. So `docs/show-repo.md:17-18` ("A token-less `#gz=` form for the stage is not built") is stale too, and that is the file the trimmed skill will tell every session to fetch. `docs/stage.md:6-7` repeats the dead pointer to SURFACING.md ("Stage a fileset"). The install section is superseded: `marketplace.json` lists `./show-repo` under `portable`. Inbound references are `docs/portable.csv:5` (file only), tracker task history, and a dated home term-lab report. None anchors a section.

**Revised proposal:** Cut the skill as proposed. In the same commit, fix the owner, or the cut only moves the stale claim: rewrite `docs/show-repo.md:17-18` to say the ref half is token-gated and pasted text rides `#gz=` without a token, linking `docs/surfacing-extended.md` for the handoff rule. Repoint `docs/stage.md:6-7` from SURFACING.md to `surfacing-extended.md`.

**Corrected words removed:** about 390 from the skill.

## 3. Fix and shorten `load-skill`, and cut `skills/README.md` to what only it says

**Verdict:** revise

**Checked:** The JSON "Shape" block at `.claude/skills/load-skill/SKILL.md:28-36` is wrong: `skills/manifest.csv:1` is `name,group,description`. The reader's column list is correct. `tools/test/skills-registry.test.mjs:49` asserts only that the loader names `mehrlander/web-tools/main/skills`, so lines 12-14 must stay. Word counts: the three load-skill spans hold 34, 71 and 144 words; the README spans hold 83 ("How this gets loaded"), 112 (the account-copy paragraph) and 57 ("Snapshot lineage"). The "Why this exists" claim that "only this one mechanism is registered anywhere" is now false, since `marketplace.json` publishes `daisy-alpine` and `google-style-clarity` as their own plugins. The claude.ai account install (line 97) is not currently in use: `load-skill` is absent from `/root/.claude/skills/synced/*/manifest.json`. But claude.ai chat receives no plugin, so that line is the only written route by which a chat session reaches the library. Deleting it outright removes a venue rather than a duplicate. "Snapshot lineage" also carries one live rule: "this folder is the source of truth".

**Revised proposal:** Make the load-skill changes as proposed, with two exceptions. Keep one sentence on the account route that names its cost: "A claude.ai chat has no plugin; uploading this skill at account scope reaches it, and the upload must be redone when this file changes." Keep the sentence "Do not fire on general topic overlap", since the description implies it but does not state it. In the README, collapse "Snapshot lineage" to its rule ("This folder is the source of truth for the library skills") rather than deleting it. Apply the other README cuts as proposed, and correct "16 directories" at README:14 to 18, which is what `marketplace.json` registers.

**Corrected words removed:** about 210 from load-skill and about 200 from the README, about 410 in total rather than 610.

## 4. Collapse `in-flight`'s Premise and Key insights to operator rules

**Verdict:** revise

**Checked:** `wc -w` gives 1,522. Premise (lines 8-14) is 197 words, Key insights (56-80) is 747, Extending (82-86) is 79, not 107. The script does carry the rationale: `is_shallow()` docstring at `in-flight.py:86-94` holds the 24-second unshallow measurement, `sessions_for()` at 244-262 holds the constant signing key and own-commits rule, lines 14-15 and 228-229 hold the squash rule, 395 holds "a claim decays", and the rendered output warns about squash (630-631) and an unfed claim layer (576). Inbound references are `docs/portable.csv:7` (file only) and `tend/SKILL.md:88` (skill name). The reader's four rules drop two that change what a session does and that no run-time output tells it. "Claims come from the base branch, not the checked-out files" explains the `--worktree` flag, and without it a session that sees a surprising claim list has no reason to reach for the flag. "Do not run content forensics over the whole estate" stops a session hand-rolling a path-overlap scan outside the script, which the script cannot warn about because it is not running.

**Revised proposal:** As proposed, but keep six one-line rules, not four: add "claims are read from the base branch; `--worktree` reads the checkout instead" and "check path overlap only on live branches, never across the whole estate". Do not delete Extending. `skills/skill-prefs/SKILL.md:26-33` sets Premise, Goal and output, Process, Key insights and Extending as the library's default skill sections, with Extending kept "when there is" a growth path, and in-flight names two (the unused `--json` output and a future `--fix` flag). Cut Extending to one sentence naming both. Its second paragraph ("the repair step is deliberately manual") repeats step 4.

**Corrected words removed:** about 770.

## 5. Cut `tree` to the generator, the two formats, and the Major folders block

**Verdict:** revise

**Checked:** `wc -w` gives 1,448. The targeted spans hold 143, 56, 133, 29 and 81 words. The boundary does appear twice (17-29 and 188-196). `docs/markdown-in-chat.md:85-91` names the tree skill as operator of `scripts/build-tree.py`. The flaw is delivery. The skill ships in the `portable` plugin, and the plugin cache (`~/.claude/plugins/cache/web-tools/portable/<sha>/`) holds only the skill folders, not `docs/` or `scripts/`. The skill's existing relative links (`../../../docs/SURFACING.md`, `../../../docs/markdown-in-chat.md`, `../../../scripts/build-tree.py`) therefore resolve only inside a web-tools checkout. Replacing the four rendering rules with another relative link removes the only copy a session in home or shortcut-tools can read. The same problem applies to "icons are set in `build-tree.py`'s `ICONS` map" if written as a relative path.

**Revised proposal:** Make the cuts, but write every pointer that replaces text as an absolute `https://github.com/mehrlander/web-tools/blob/main/...` URL, and convert the skill's existing relative links to the same form in the same commit. Keep the one rendering rule that governs hand edits to generated output ("a code span cannot hold a link, so the prefix goes in backticks and the name stays outside"), since a session touching up a table needs it and the generator does not enforce it.

**Corrected words removed:** about 380.

## 6. Delete `scour/PRIOR-ART.md` and shorten scour's measurement narratives

**Verdict:** revise

**Checked:** `wc -w` gives 2,298 for SKILL.md and 1,129 for PRIOR-ART.md. The only live inbound link is SKILL.md:94. The two fact-census rows in home (`chron/2026/09/2026-09-06-hand-typed-fact-census.csv:4273-4274`) cite `docs/PORTABLE.md` line 53, not SKILL.md as the reader says; they are dated and harmless either way. The duplicate "Keep a superseded pass" is confirmed at 250-251 and 266-267 (28 words). The "7 of 776" figure is itself stated twice, at 194 and 204. Two reasons to keep PRIOR-ART.md. First, it is a companion file read on demand, so deleting it saves no context in any session; it only shrinks the tree. Second, its Sources section (lines 130 onward) holds the only citations for HITS, focused crawling, tunneling, harvest rate and respondent-driven sampling, which the skill invokes as authority. The four failure shapes (154-173, 178 words) are already operator rules with specific actions: budget a search per 403 domain, budget two fetches through the readability proxy, diagnose client-rendered pages separately, and watch for the WebFetch summarizer returning "Anthropic" as page content. One-line bullets would drop those actions.

**Revised proposal:** Keep PRIOR-ART.md. In SKILL.md: delete the duplicate at 266-267; shorten the capabilities paragraph (26-33, 79 words) to its link; drop the 14-domain table and keep the organisational-form rule with one clause giving the range ("10x to 93x on associations, near zero on agencies"); in Instrumentation, state 7 of 776 once and drop the recovery narrative, keeping the transcript path and the "require of every fetched page" list. Leave the failure shapes as written.

**Corrected words removed:** about 300.

## 7. Merge `shortcut-links` into `apple-shortcuts-actions`, and make shortcut-tools link instead of restate

**Verdict:** revise

**Checked:** `wc -w` gives 862 and 672 (1,534 together). The handoff link at `.claude/skills/apple-shortcuts-actions/SKILL.md:77` is worse than the reader says. `../../skills/shortcut-links/SKILL.md`, resolved from `.claude/skills/apple-shortcuts-actions/`, lands on `.claude/skills/shortcut-links/SKILL.md`, which does not exist in web-tools either, so the link is broken in every repo, not only outside web-tools. The gesture rule and both `prefs:` URLs are duplicated between `skills/shortcut-links/SKILL.md:54-69` and `shortcut-tools/CLAUDE.md:147-173`. Missed inbound dependencies: `shortcut-tools/tools/run.py:43` and `:204` both tell a reader that the card format "is in web-tools skills/shortcut-links", so deleting the folder breaks two docstrings in the tool that emits the cards. The span the reader targets in shortcut-tools overshoots: lines 147-179 include "Replacing a generated receiver is free" (175-178), which shortcut-links does not carry; the gesture material is 147-173, 229 words, not about 330. The two documents also disagree on the install route. shortcut-links:40 says "Prefer `Library-Fetch`", while shortcut-tools CLAUDE.md never names `Library-Fetch` and routes installs through `Library-Import` and `Library-Replace`. `workflows/library-fetch.json` exists. A merge that copies shortcut-links' table into the plugin skill makes the plugin the owner of an install rule that the repo's own contract contradicts.

**Revised proposal:** Merge as proposed, keeping shortcut-links' trigger phrases in the merged description. Before merging, settle which install route is current and correct whichever document is wrong. Repoint `shortcut-tools/tools/run.py:43,204` and `docs/markdown-in-chat.md:136` in the same change. In shortcut-tools CLAUDE.md, replace lines 147-173 only, and keep the generated-receiver paragraph. If the merge is deferred, at least fix line 77 to an absolute GitHub URL, since it is broken today.

**Corrected words removed:** about 250 inside the merged skill and about 200 from shortcut-tools CLAUDE.md.

## 8. Stop `tasks` restating the TRACKER.md schema

**Verdict:** revise

**Checked:** `wc -w` gives 1,930. Lines 127-141 hold 142 words and 142-172 hold 152. `docs/TRACKER.md` does carry every item: status values at 31, `size` and `awaiting` at 37-38 and 80-84, `depends-on` at 33 and 145, `runner` and `action` at 98-108, and a runnable-task template at 110-121. So the runnable-task template in the skill is a true duplicate. The key definitions are a weaker case. The skill ships in the plugin to every repo, and TRACKER.md reaches a session only by a fetch (`tasks/SKILL.md:26`). Every filing needs the `status` values and the `size` scale, so replacing a 40-word enumeration with a fetch adds a network call to the most common operation to save a few lines. "Absence means no dependency; never write a value meaning none" is a filing behavior, and the skill says it owns behavior (line 24).

**Revised proposal:** Delete the runnable-task template and its prose except the one behavioral rule the reader names. Delete the `track:` migration note. Keep the status enumeration and a one-line `size` scale; replace the `awaiting` and `depends-on` definitions with the link to TRACKER.md's "Recognized keys", keeping "never write a value meaning none".

**Corrected words removed:** about 170.

## 9. Sweep the incident narratives and dead links out of the plugin skills

**Verdict:** revise

**Checked:** `ls docs/CONVENTIONS.md` fails. The concept-index dead hub is worse than cosmetic: `vocab.py` treats `--hub` as set membership (`build_index`, line 210), so a missing hub is ignored silently and the canonical tier shrinks with no error. The daisy-alpine dead link is at line 17 and the `build-board.py:156` comment is confirmed. The `mcp-fail-hint.sh` hook is registered at `.claude/skills/hooks/hooks.json:78`. Word counts: default 16-28 is 124; sandbox-traps spans are 103, 127 and 49 (279); concept-index 51-59 is 89; daisy-alpine 14-23 and 50-61 are 94 and 134 (228, not 282). One part conflicts with the estate's own skill standard. `skills/skill-prefs/SKILL.md:26-31` makes Premise, Goal and output, and Process the default sections, and says "The skill may offer reference material only... If so, that's the process." sandbox-traps' "Reference. Match the symptom, run the test, apply the rule." is that rule applied, not empty scaffold; 12 skills carry `## Premise`. For daisy-alpine rule 3, the `reading-column` hook ships in the `portable` plugin (`.claude/skills/hooks/reading-column-guard.sh`), so enforcement does reach consuming repos. But the arbitrary-value paragraph states what the hook counts (any `ch` cap; absolute caps from 42rem to 64rem), and without it a session learns the rule only by being refused.

**Revised proposal:** Apply the default, concept-index and dead-link fixes as proposed, and fix `build-board.py:156` in the same pass. In sandbox-traps, keep the three section headings with Premise cut to one sentence, and apply the other two collapses. In daisy-alpine, cut the dataviz story to its rule, and cut the 920px/64ch paragraph to one sentence that keeps the thresholds: "Arbitrary values count: any `ch` cap, and an absolute cap from 42rem to 64rem."

**Corrected words removed:** about 480 (default about 100, sandbox-traps about 170, concept-index about 70, daisy-alpine about 140).

## 10. Replace home's copy of google-style-clarity with the plugin it copies

**Verdict:** revise

**Checked:** `home/.claude/settings.json:10-13` enables only `portable` and `daisy-alpine`; the user-scope `~/.claude/settings.json` enables the same two. The `google-style-clarity` entry exists in `marketplace.json` with the model-invocable description quoted. The home block is 484 words; the skill is 1,179. The risk the reader rates medium is the one this estate has already measured. `web-tools/docs/SNAGS.md:1795-1800` (`house-style-not-consulted`, seen twice) records that `daisy-alpine`, installed as an ambient plugin so it would "fire on artifact work unprompted", did not fire, and a page shipped against its first rule. home CLAUDE.md's HTML rule exists for the same reason: it is "the one instruction guaranteed to fire". An ambient plugin is not an equivalent for an always-on block; it is the channel that failed.

**Revised proposal:** Enable the plugin, and keep an always-on block in home CLAUDE.md, cut to the opening directive, the link to the skill, and the seven "Clarity principles" bullets (159 words). Drop the role paragraph, the Execution section and the example table, which the plugin supplies on invocation.

**Corrected words removed:** about 300.
