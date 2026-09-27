# Slice: wt-skills

**Summary.** This slice is web-tools' skill text: the 18 plugin skills under `.claude/skills/` (shipped as `portable` through `.claude-plugin/marketplace.json`), the 46-skill library under `skills/` (fetched by `/load-skill`, two of them also published as their own plugins), and their reference files. It holds 83 Markdown files and 93,891 words (`find skills .claude/skills -name '*.md' | xargs wc -w`). The largest source of bloat is not estate prose. It is vendored third-party skill text: nine library skills are unmodified or lightly modified copies of Anthropic or Cowork built-ins, 28,622 words, 31% of the slice. The next largest is measurement narrative inside plugin skills ("measured on 14 domains", "measured 2026-09-10") that duplicates the bundled scripts' own docstrings or `docs/environment/`. Third are loader skills (`load-skill`, `show-repo`) that still carry pre-plugin install instructions and restated reference content. Two dead links to the retired `docs/CONVENTIONS.md` turned up along the way.

## 1. Delete the nine vendored built-in skills from the library

**Repo:** web-tools

**Targets:** `skills/docx/`, `skills/pdf/`, `skills/pptx/`, `skills/xlsx/`, `skills/skill-creator/`, `skills/doc-coauthoring/`, `skills/consolidate-memory/`, `skills/schedule/`, `skills/setup-cowork/`, and their nine rows in `skills/manifest.csv` (rows 6, 8, 10, 20, 24, 30, 33, 37, 46).

**Kind:** delete

**Proposal:** Remove the nine folders and their manifest rows in one commit. Add one sentence to `skills/README.md`: "Anthropic's own document and authoring skills (docx, pdf, pptx, xlsx, skill-creator, doc-coauthoring) and Cowork's session skills come with the platform; this library holds only skills written or adapted here."

**Rationale:** None of the nine carries estate content. `grep -l "mehrlander\|web-tools\|Marcus\|estate"` over docx, pdf, pptx, xlsx and skill-creator returns nothing, and the three Cowork skills score 0 on the same grep. docx, pdf, pptx and xlsx declare `license: Proprietary. LICENSE.txt has complete terms` in frontmatter. The platform already supplies every one of them: the session's own skill list shows `anthropic-skills:docx`, `:pdf`, `:pptx`, `:xlsx`, `:skill-creator` and `:doc-coauthoring`. Keeping a snapshot here gives a second copy that goes stale. The copies have already drifted. The account-synced docx `SKILL.md` is 981 words against the library's 2,674, with 609 differing lines, and its description adds `.dotx` and a rule to defer to a document connector that the library copy lacks. A session that runs `/load-skill docx` gets the older text. The README's own lesson (skills/README.md:45, "Editing here therefore leaves the stale version in charge") argues against keeping a second copy of a skill that someone else maintains.

**Evidence:** `diff` of `/root/.claude/skills/synced/*/<name>/SKILL.md` against `skills/<name>/SKILL.md`: identical for skill-creator, doc-coauthoring and pdf; differs by 609 lines for docx, 363 for xlsx and 170 for pptx. Mentions across 494 session records in `web-tools-private/sessions/` (a path listing counts, so these are upper bounds on use): consolidate-memory 1 record, setup-cowork 2, schedule 3, pdf 5, pptx 6, xlsx 29, skill-creator 24.

**Words removed:** 28,622 (docx 2,674, pdf 4,548, pptx 5,116, xlsx 1,637, skill-creator 10,268, doc-coauthoring 2,466, consolidate-memory 315, schedule 341, setup-cowork 1,257). About 4 MB of bundled scripts and XSD schemas go with them.

**Inbound dependencies:** `tools/test/skills-registry.test.mjs` requires one manifest row per folder, both ways, so the manifest rows must go in the same commit. `docs/themes.csv` and `tools/render/fixtures/tree-web-tools.json` mention the paths; both appear generated or fixture data and should be regenerated, not hand-edited. The Map view's Skills tab reads `skills/manifest.csv` (`docs/app-routes.csv:18`) and will show nine fewer rows. No doc, hook or skill links into these folders.

**Risk:** Low. The one real loss is a pinned copy for an environment without the built-ins, such as a bare API session. If that case matters, keep a single line in the README naming the upstream repo (`anthropics/skills`) instead of the text. An optional follow-on in the same spirit: `skills/daisy-alpine/references/daisyui.md` (4,110 words) is daisyUI's published `llms.txt` verbatim ("Guide: How to use this file in LLMs and code editors", line 7). It could become a fetch of `https://daisyui.com/llms.txt`, but only after someone confirms that host is on the sandbox allowlist.

## 2. Reduce the `show-repo` skill to a loader

**Repo:** web-tools

**Targets:** `.claude/skills/show-repo/SKILL.md:26-40` ("What it enables" and "The honesty caveat"), `:63-72` (Fallbacks), `:74-80` ("Relationship to the conventions"), `:82-98` ("Installing this skill into another repo").

**Kind:** link-to-owner

**Proposal:** Keep the frontmatter, a two-sentence opening (what show-repo is, and that `docs/show-repo.md` and `docs/stage.md` own the mechanics), and the two `curl` commands with the one-line pointer to `docs/app-routes.csv` for view docs. Replace the fallback list with one line: "If `curl` is denied, use the fallbacks in the `default` skill." Delete the rest.

**Rationale:** The skill says it is a loader that "fetches [show-repo.md] fresh so any session in any repo has the current mechanics" (lines 19-20), then restates the mechanics anyway, and the restatement has already drifted. The honesty caveat (lines 37-38) says "the token-less `#gz=`-style bundle form is contemplated, not built". `docs/stage.md:603-608` now documents `&gz=` content that needs no token. The "Relationship" section cites a "Stage a fileset 🗂️" entry in `docs/SURFACING.md` that is no longer there: the entry moved to `docs/surfacing-extended.md:16`. The install section predates the plugin marketplace, which now delivers this skill to every repo that enables `portable`.

**Evidence:** `docs/show-repo.md:17-18` carries the same token caveat. `grep -n "Stage a fileset" docs/SURFACING.md` returns nothing. `.claude-plugin/marketplace.json` lists `./show-repo` under `portable`.

**Words removed:** about 410 of 686.

**Inbound dependencies:** `docs/portable.csv:5` names the file, not a section. No inbound anchor links were found.

**Risk:** Low. A session that loads the skill and does not fetch the doc loses the one-paragraph summary of link shapes. That is the case the skill already tells it to avoid.

## 3. Fix and shorten `load-skill`, and cut `skills/README.md` to what only it says

**Repo:** web-tools

**Targets:** `.claude/skills/load-skill/SKILL.md:26-37` (manifest shape), `:63-75` (trigger phrases), `:83-101` (install into another repo, install into the claude.ai account, "Why this exists"); `skills/README.md:30-36` ("How this gets loaded"), `:42-56` ("Editing skills", the 2026-08-10 narrative), `:52-56` ("Snapshot lineage").

**Kind:** rewrite-shorter

**Proposal:** In load-skill: replace the JSON example with "a CSV with columns `name,group,description`". Drop the trigger-phrase list, because the frontmatter `description` already carries it and that is the part that fires. Delete both install sections and fold "Why this exists" into the opening line. In the README: replace "How this gets loaded" with a link to load-skill. Collapse the account-copy paragraph to one rule: "A library skill also installed at claude.ai account scope has a second copy that fires unprompted; drop the account copy or re-upload after every edit." Delete "Snapshot lineage", which is history that git holds.

**Rationale:** The load-skill "Shape" block (lines 28-37) shows a JSON object with `source` and `skills[]`. The file it describes is `skills/manifest.csv`, a CSV (`head -1`: `name,group,description`), so a session that follows the block parses the wrong format. The account-install section (line 97) tells a reader to paste the skill into claude.ai Settings, which is the dual-copy hazard the README warns against at line 45. The repo-install `curl` recipe is superseded by the plugin. The README's "How this gets loaded" restates load-skill's source URL and trigger rules.

**Evidence:** `.claude/skills/load-skill/SKILL.md:28-36`; `skills/manifest.csv:1`; `skills/README.md:36` against `load-skill/SKILL.md:12-14`. The duplication is measurable: 17 library skills are byte-identical to their account-synced copies and 13 have diverged (for example daisy-alpine by 187 lines, inspire-excellence by 43).

**Words removed:** about 280 from load-skill (571 → about 290) and about 330 from the README (644 → about 310).

**Inbound dependencies:** `tools/test/skills-registry.test.mjs:49` asserts that load-skill "names this repo and this folder". Keep the default source URL at lines 12-14. `docs/portable.csv:4` names the file only.

**Risk:** Low. The trigger list is the only part a reader might miss, and the description holds the same phrases.

## 4. Collapse `in-flight`'s Premise and Key insights to operator rules

**Repo:** web-tools

**Targets:** `.claude/skills/in-flight/SKILL.md:8-14` (Premise), `:56-80` (Key insights), `:82-86` (Extending).

**Kind:** collapse-narrative

**Proposal:** Replace the Premise with two sentences: tracker claims decay because nothing updates them at merge, and a branch with no commits outside base cannot be live. Cut Key insights to four one-line operator rules: a shallow clone makes "unrelated" undecidable (run `git fetch --unshallow`); in a squash-merge repo, trust the content count over the ahead-count; zero claims means the claim layer is unused, not that nothing is live; and live, unclaimed, PR-less work is the row to read first. Delete the measurement paragraphs on SSH signing keys, trailer windows and trailer coverage, and delete Extending. The last line already says that `in-flight.py`'s "classification comments carry the measurements behind each rule" (line 90).

**Rationale:** The script already owns these measurements, in docstrings that say the same things. `is_shallow()` (in-flight.py:87-97) carries the 21-day clone and 24-second unshallow measurement that SKILL.md:62 repeats. The docstring at in-flight.py:245-258 carries the "only session identity git carries" and constant-signing-key finding that SKILL.md:76 repeats. The script's rendered output at in-flight.py:561-566 already warns about a shallow clone at run time. The skill should tell a session how to run the tool and read its verdict, not why each rule in the tool is right.

**Evidence:** `grep -n "shallow\|signing key\|trailer\|squash" .claude/skills/in-flight/in-flight.py` finds 20 matching lines covering every insight named above.

**Words removed:** about 850 of 1,522 (Key insights 747 → about 90, Premise 197 → about 40, Extending 107).

**Inbound dependencies:** `docs/portable.csv:7` (file only). `tend/SKILL.md:88` names the skill, not a section.

**Risk:** Low. The rationale stays in the script, next to the code it justifies.

## 5. Cut `tree` to the generator, the two formats, and the Major folders block

**Repo:** web-tools

**Targets:** `.claude/skills/tree/SKILL.md:17-34` (the surfacing boundary, first copy), `:158-163` (ascii fallback), `:165-180` (Rendering rules), `:182-186` (Icon legend), `:188-196` (the boundary, second copy).

**Kind:** link-to-owner

**Proposal:** Replace lines 17-34 with one sentence: "Structure, not change: for what moved this session, follow SURFACING.md." Delete the second boundary section. Replace Rendering rules with a link to `docs/markdown-in-chat.md`, which owns those rules and which the skill already cites at line 32 as the place to "read that for *why*". Replace the icon legend with "icons are set in `build-tree.py`'s `ICONS` map". Fold the ascii fallback into the mode row of the parameter table.

**Rationale:** The surfacing boundary appears twice in one file (lines 17-29 and 188-196). The four rendering rules restate `docs/markdown-in-chat.md:18-62`: nested bullets, the whitespace trim, code spans that cannot hold a link, and U+2800. That doc names this skill as the operator at line 93, so the doc is the owner. The icon legend restates `scripts/build-tree.py:52-69` and itself says "extend it there, not per-render".

**Evidence:** `grep -n "U+2800\|nbsp\|code span\|nested" docs/markdown-in-chat.md` finds each rule. `scripts/build-tree.py:52` defines `ICON_DIR` and `ICONS`.

**Words removed:** about 440 of 1,448.

**Inbound dependencies:** `docs/markdown-in-chat.md:93` links the skill file; `docs/portable.csv:6`.

**Risk:** Low. The worked tables that show each format stay.

## 6. Delete `scour/PRIOR-ART.md` and shorten scour's measurement narratives

**Repo:** web-tools

**Targets:** `.claude/skills/scour/PRIOR-ART.md` (whole file); `.claude/skills/scour/SKILL.md:26-33` (budget facts), `:127-149` (hub table and prose), `:154-173` (four failure shapes), `:191-223` (Instrumentation), `:266-267` (duplicate rule).

**Kind:** delete, collapse-narrative

**Proposal:** Delete PRIOR-ART.md and change SKILL.md:94's "See PRIOR-ART.md" to cite the two named results inline: HITS hubs, and tunneling from the focused-crawling literature. Replace the capabilities paragraph at lines 26-33 with the link it already carries. Keep the hub rule ("the predictor is organisational form: associations yes, agencies no") and drop the 14-domain table. Cut the failure shapes to four one-line bullets. Keep Instrumentation's "require of every fetched page" list and its transcript path, and drop the 7-of-776 story. Delete the second "Keep a superseded pass" (lines 266-267), which repeats lines 250-251 almost word for word.

**Rationale:** PRIOR-ART.md is a 2026-08-13 literature review. SKILL.md has already absorbed every operative conclusion: hubs (lines 119-152), tunneling (87-94), homophily and RDS caps (175-189), anchor text and harvest rate (211-223). The file's own final paragraph says what to take from the literature, and the skill has taken it. One SKILL.md link is its only inbound reference. The budget paragraph lists facts that the same sentence says "live in docs/environment/capabilities.md". A method skill should keep the rule and let the measured case sit in a record.

**Evidence:** `grep -rn PRIOR-ART` across web-tools, home and shortcut-tools finds only SKILL.md:94, plus two rows in home's dated fact census (`chron/2026/09/2026-09-06-hand-typed-fact-census.csv:4273-4274`). Those rows cite the SKILL.md line numbers for the "10x to 93x" and "0 of 49 / 32 of 42" figures.

**Words removed:** about 1,650 (PRIOR-ART 1,129, plus about 520 from SKILL.md's 2,298).

**Inbound dependencies:** SKILL.md:94. `home/chron/threads/claude-code-environment.md:25` links scour/SKILL.md for the CDX probe rule, which stays. The fact-census rows are a dated record and can go stale without harm.

**Risk:** Medium-low. The measurements are the skill's credibility. If the owner wants them kept, move PRIOR-ART.md and the hub table into a dated home record rather than deleting them outright.

## 7. Merge `shortcut-links` into `apple-shortcuts-actions`, and make shortcut-tools link instead of restate

**Repo:** web-tools (skills), shortcut-tools (CLAUDE.md)

**Targets:** `skills/shortcut-links/SKILL.md` (whole file, 862 words); `.claude/skills/apple-shortcuts-actions/SKILL.md:24-46` and `:75-79`; `shortcut-tools/CLAUDE.md:147-179` (Back Tap binding, settings table).

**Kind:** merge, link-to-owner

**Proposal:** Move shortcut-links' command table, gesture-replacement rule, diagnostics note and display templates into apple-shortcuts-actions as a "Deliver" section after "Compose". Drop its copy-actions row, which duplicates apple-shortcuts-actions step 3, and drop the "Not this skill" section. Delete `skills/shortcut-links/` and its manifest row. In shortcut-tools CLAUDE.md, replace the Back Tap and AssistiveTouch paragraphs and the prefs table (lines 147-179) with one line that points at the skill's gesture section.

**Rationale:** The two skills split one flow, compose then deliver, across two channels. apple-shortcuts-actions ships in the `portable` plugin. shortcut-links is library-only. apple-shortcuts-actions links it at line 77 by the relative path `../../skills/shortcut-links/SKILL.md`, which does not exist inside the plugin cache, because the plugin's source is `./.claude/skills` (`marketplace.json`). So the handoff link breaks in every repo except web-tools. The Back Tap rule and the two prefs URLs appear in both shortcut-links (lines 54-69) and shortcut-tools CLAUDE.md (lines 147-169). shortcut-tools CLAUDE.md:476 already says the card shape is "owned upstream by web-tools' `shortcut-links` skill, not restated here", yet it restates the gesture rule.

**Evidence:** `.claude/skills/apple-shortcuts-actions/SKILL.md:77`; `skills/shortcut-links/SKILL.md:56-69`; `shortcut-tools/CLAUDE.md:147,155,168-169`.

**Words removed:** about 250 net inside the merged skill (1,534 → about 1,280) and about 330 from shortcut-tools CLAUDE.md.

**Inbound dependencies:** `docs/markdown-in-chat.md:136` links `skills/shortcut-links/SKILL.md`. Repoint it. `shortcut-tools/CLAUDE.md:476` names the skill. `docs/themes.csv:19` is generated. The skills-registry test requires the manifest row to go with the folder.

**Risk:** Medium. The merged skill loads more text when a session only composes actions, but the delivery half is roughly 800 words. The merged skill's description must keep shortcut-links' triggers (install, run, open Settings, diagnostic) or those asks stop matching.

## 8. Stop `tasks` restating the TRACKER.md schema

**Repo:** web-tools

**Targets:** `.claude/skills/tasks/SKILL.md:127-141` (status values and the size, awaiting and depends-on definitions), `:142-172` (runnable-task template and its prose).

**Kind:** link-to-owner

**Proposal:** Keep the task template (lines 103-125). Replace lines 127-141 with "Keys and their meanings: TRACKER.md, 'Recognized keys'." Cut the runnable-task section to its one behavioral rule: "if the method is not a skill yet, writing it is part of filing the task; work needing no session belongs in a hook, test, or CI." Link TRACKER.md's `runner`/`action` section for the rest.

**Rationale:** The skill's opening (lines 24-28) says TRACKER.md "is the contract behind it (file schema...)" and the skill "owns every rule about operating a tracker". The key definitions and the runner/action semantics are schema, and TRACKER.md states them in full: `size` and `awaiting` at lines 37-38 and 80-84, `depends-on` at 33 and 145, `runner` and `action` at 98-108. The migration note "Replaced `track:` on 2026-08-23" (skill line 136-137) is history.

**Evidence:** `grep -n "size:\|awaiting\|depends-on\|runner\|action:" docs/TRACKER.md`.

**Words removed:** about 230 of 1,930.

**Inbound dependencies:** The skill ships in the plugin and fetches TRACKER.md by raw URL (line 26), so the link already resolves outside web-tools. No inbound anchors.

**Risk:** Low. A session filing a task with `size:` reads one more file. That is the documented division of labor.

## 9. Sweep the incident narratives and dead links out of the plugin skills

**Repo:** web-tools

**Targets:** `.claude/skills/default/SKILL.md:16-28`; `.claude/skills/sandbox-traps/SKILL.md:16-31`, `:48-58`, `:72-76`; `.claude/skills/concept-index/SKILL.md:26`, `:49-59`; `skills/daisy-alpine/SKILL.md:14-23`, `:47-64`.

**Kind:** collapse-narrative

**Proposal:**
- **default:** Replace both opening paragraphs with one rule: "No repo imports these documents. Load both unless both are already in context. A checkout is not delivery."
- **sandbox-traps:** Delete the empty Premise, Goal and Process scaffold (lines 16-31; Process reads in full "Reference. Match the symptom, run the test, apply the rule."). Collapse the post-restart paragraph to "the `mcp-fail-hint` hook injects this rule on failure; ask ToolSearch for the built-in name even if a resume notice says it is gone". Cut the 2026-09-04 `mehrlander/home` measurement to its rule, "no pinned-baseline check passes until the clone is deepened".
- **concept-index:** Change `--hub docs/CONVENTIONS.md` at line 26 to a hub that exists; the file was retired by PR #634 and `ls docs/CONVENTIONS.md` fails. Cut "Why declaration and not statistics" to one sentence.
- **daisy-alpine:** Change the dead `CONVENTIONS.md#standing-decisions…` link at line 17. Cut the 2026-08-29 `dataviz` story to its rule ("these rules override any general design or charting skill"). Cut rule 3's second and third paragraphs (the 920px/64ch arbitrary-value story) to the one-sentence test, because the `reading-column` hook enforces it at edit time, as line 62 says.

**Rationale:** doc-craft, the library's own documentation skill, says: "Omit debugging narratives, discovery steps, and authoring commentary" (`skills/doc-craft/SKILL.md`, Living Documentation Rules). Each span above is a dated account of how a rule was learned, sitting in a living file that every session loads. The two dead links send readers to a file that no longer exists, and in concept-index the dead path is inside a command.

**Evidence:** `ls docs/CONVENTIONS.md` fails. `.claude/skills/tasks/build-board.py:156` has the same stale reference in a comment. The sandbox-traps hook is `hooks/mcp-fail-hint.sh`, registered in `.claude/skills/hooks/hooks.json`.

**Words removed:** about 700 (default 124 → about 25; sandbox-traps 279 → about 60; concept-index 93 → about 20; daisy-alpine 282 → about 70).

**Inbound dependencies:** None on these spans. daisy-alpine is also published as its own plugin (`marketplace.json`) and fires unprompted, so tokens cut there are saved on every page-building session in every repo that enables it.

**Risk:** Low. The dated accounts survive in git and in home's chron entries.

## 10. Replace home's copy of google-style-clarity with the plugin it copies

**Repo:** home (the block), web-tools (the skill). This crosses into the home slice and is noted here because the skill is the owner.

**Targets:** `home/CLAUDE.md`, section "### Prose clarity" (484 words); `home/.claude/settings.json` `enabledPlugins`.

**Kind:** link-to-owner

**Proposal:** Enable `google-style-clarity@web-tools` in home's `.claude/settings.json`. It is already published in `marketplace.json`, with the description "Model-invocable, so it triggers on drafting and review work without being asked." Then cut the CLAUDE.md block to two lines: "Before drafting, reviewing or rewriting prose, apply the `google-style-clarity` skill. It is enabled as a plugin here."

**Rationale:** The block calls itself "the compressed form of `google-style-clarity`... a repetition of it, not a second authority". The marketplace entry exists precisely to make that skill ambient in a consuming repo, and home enables `portable` and `daisy-alpine` but not this one. So the repo carries a hand-maintained 484-word copy of a 1,179-word skill instead of setting one flag.

**Evidence:** `grep enabledPlugins` output for home: `"portable@web-tools": true "daisy-alpine@web-tools": true`. `.claude-plugin/marketplace.json` includes the `google-style-clarity` plugin entry.

**Words removed:** about 450 from home/CLAUDE.md, which every home session loads.

**Inbound dependencies:** home CLAUDE.md is read by every session. No script parses the block.

**Risk:** Medium. The inline copy is guaranteed to be in context, while a plugin skill fires only when the model judges the task matches. If the always-on guarantee matters, keep one line naming the six principles, still far shorter than the table and examples.
