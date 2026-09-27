# Slice: wt-meta

## Summary

This slice is web-tools' process and environment documentation: the five files under `docs/environment/`, `docs/TRACKER.md`, `docs/registries.md`, and the top-level and subfolder `docs/*.md` files not assigned to another slice (artifacts, headless-vendoring, doc-growth, HTML-STYLE, the doc-craft study and specimens, the `github/` folder, markdown-in-chat, and others). web-tools has no `tracker/README.md`; the root tracker holds only `tasks/`, `assessments/` and the generated board, so that target is absent. The environment files alone are 14,337 words (extending 4,472, capabilities 3,552, testing 3,159, container 2,846, README 308), TRACKER.md is 4,363, and registries.md is 2,223. The main source of bloat is **restatement of an owner that already exists**. The environment files still carry the operative core that `sandbox-traps` took over on 2026-07-30. extending.md paraphrases Claude Code's public docs and the header comments of its own hook scripts. TRACKER.md repeats the operating rules its own line 5 assigns to the `tasks` skill. artifacts.md repeats `showing-mechanisms.csv` and the platform's documentation. The second source is **incident narrative kept after the fix shipped**: "measured on", "the bug worth remembering", "this corrects an earlier entry", "I argued against the tab first". Some of that narrative is now wrong. container.md contradicts itself about whether transcripts persist, headless-vendoring.md's premise contradicts capabilities.md's 2026-08-05 re-measurement, and artifacts.md describes a platform that no longer matches the Artifact tool.

## 1. Let `sandbox-traps` own the trap rules, and cut their restatements from environment/

**Repo:** web-tools

**Targets:** `docs/environment/capabilities.md:11-24` (the probing-discipline callout), `:75-95` (HTTP 413), `:200-219` (two gates and the deny header); `docs/environment/container.md:257` (shallow clone), `:279-293` (added repositories).

**Kind:** link-to-owner

**Proposal:** Replace each span with one sentence that links to `.claude/skills/sandbox-traps/SKILL.md`, and keep only the evidence the skill does not carry: the measured batch sizes, the list of hosts probed, and the verification dates. The 413 section, for example, becomes: "A single push over roughly 130 MB is refused with HTTP 413; the rule and the test are in `sandbox-traps` (measured 2026-07-20: 90 to 130 MB cleared, 757 MB did not)." Delete the probing-discipline callout completely. Its first rule (read the header, not the status) is already stated three times: in the callout, in `capabilities.md:207-213`, and in `SKILL.md:84-87`. Its second rule is `testing`/`headless-vendoring` material, and its third rule repeats the first.

**Rationale:** The skill's own closing section (`SKILL.md:115-121`) splits the work: the skill "carries only what a session acts on", and the evidence stays in `docs/environment/`. The environment docs never cut their copy of the "acts on" half. The tracker task `skillify-orphan-docs-izv20p` (log entry 2026-07-30) says the source docs were kept "because the claim that a skill replaces them is untested until it catches a real failure". Since then the skill has gained a machine delivery path, the `mcp-fail-hint.sh` hook (`SKILL.md:53-58`), so that test has been met.

**Evidence:** The 413 fix appears in `capabilities.md:88-95` and again in `SKILL.md:78-82`, with the same numbers (90 to 130 MB, 757 MB). The deny-header rule appears at `capabilities.md:15-18`, `capabilities.md:207-213` and `SKILL.md:84-92`. The two-gates rule and the "repository not authorized (502)" text appear at `capabilities.md:200-205` and `SKILL.md:89-92`. The shallow-clone rule appears at `container.md:257` and `SKILL.md:60-66`, with the same commands. The added-repo behaviour appears at `container.md:283-293`, `SKILL.md:94-104` and `github/github-surfacing.md`.

**Words removed:** about 650 of 793 (182 + 172 + 179 + 120 + 140, keeping roughly 140 words of dated evidence).

**Inbound dependencies:** `testing.md:8` and `container.md:3` link to `capabilities.md` as a whole, not to these anchors. `testing.md:321` links to `#browsers--headless-rendering-available`, which this proposal leaves in place. `SKILL.md:120` points back at `docs/environment/`, so keep the dated evidence lines. No test reads these spans.

**Risk:** Low. A reader who opens `capabilities.md` to learn the rule gets a link instead of the text, and the skill is the copy that loads when the symptom appears.

## 2. container.md: resolve its self-contradiction and hand the setup script to its owner

**Repo:** web-tools (the owner of the setup script is in web-tools-private)

**Targets:** `docs/environment/container.md:29-162` (what `~/.claude` carries, files outliving the VM, the plugin-refresh measurement), `:164-204` (what the setup script writes), `:206-244` (the session transcript), `:295-306` (evidence limits); `docs/environment/capabilities.md:387-406` (subagent transcripts).

**Kind:** restructure

**Proposal:** Rebuild the persistence half of container.md as one short section with three lifetimes: the VM restart, which keeps the disk; environment expiry, which is somewhere between 3 and 25 days and replaces the disk; and the snapshot, which holds only what the setup script installed. Write one line of measurement for each lifetime. Then:
- Replace `:217-222` ("It does not persist... a transcript not copied out before the container is reclaimed is gone") with the three-lifetimes rule, because `:40-43` and `:55-90` of the same file measured the opposite.
- Replace `capabilities.md:401-402` ("they sit outside every repo and die with the environment") with a link to the same section.
- Cut `:164-204` to two sentences linking `web-tools-private/environment/README.md` and `setup.sh`, which are now the canonical copy. The claim at `:190-197`, that the script "leaves no trace of itself" and has no copy on disk, has been false since that copy was committed.
- Collapse the plugin-refresh discussion (`:104-162`, 630 words) to its three operative rules. First, `claude plugin update` in the setup script pins the version current on build day. Second, a `SessionStart` refresher matched on `startup|resume` is the fix. Third, a stale `node_modules` means checking the dates before believing a test failure. The documentation-versus-measurement debate at `:129-148` goes to git history.
- Delete "Evidence limits" (`:295-306`), a methodology essay about one 2026-05-30 observation.

**Rationale:** The file's own header discipline (`environment/README.md:27-30`) says "edit it in place... Don't stack stale entries". container.md stacked them instead: `:40` says "`projects/` was listed as written fresh at boot too, and it is not", and `:59-60` says "collapsing them is what produced the paragraph corrected above". Meanwhile `:217` still states the claim that was corrected. For the setup script, `web-tools-private/README.md:120-127` and `environment/README.md` now describe what it provisions and how to tell which build is running (`env-manifest.txt`). container.md repeats that list at `:168-173`.

**Evidence:** `container.md:217-222` ("There is no on-disk history of prior sessions") against `:62-73` ("248 files, 46 MB... 268 agent runs that had been written off as gone"). `capabilities.md:401` ("die with the environment") against `container.md:55-66`. `web-tools-private/environment/README.md:1-8` ("this file is the canonical copy") against `container.md:190-192` ("no copy on disk, no build log carrying it").

**Words removed:** about 1,700 of 2,846 in container.md (the spans total 2,151; the rebuilt section is about 400 words), plus 40 in capabilities.md.

**Inbound dependencies:** `github/github-surfacing.md:47` links `container.md#added-repositories`. Proposal 1 shrinks that section to a pointer, so repoint the link to `sandbox-traps` or keep the anchor. `SNAGS.md:479,487` names the shallow-clone trap "in `container.md`"; repoint it to `sandbox-traps`. `capabilities.md:5` and `environment/README.md:6,27` link the whole file. The partial-resume paragraph (`:92-102`) cites `record_path()`/`merge_captured()` in web-tools-private; keep it as one sentence with that pointer. No test reads container.md.

**Risk:** Medium. The partial-transcript-on-resume hazard (`:92-102`) is real and non-obvious. Keep it as one sentence rather than letting it go with the narrative around it.

## 3. extending.md: drop the Claude Code primer, replace per-hook essays with a table of the nine hooks

**Repo:** web-tools

**Targets:** `docs/environment/extending.md:3` and `:45-69`, `:185-199` (the Components and Settings primer); `:18-43` (the `PreToolUse`-did-not-fire diagnosis and its 2026-08-06 resolution); `:129-183` (the invoke-default, Stop and sessions-directive essays); `:5-16` (the inventory).

**Kind:** restructure

**Proposal:**
- Delete the Components and Settings sections. They paraphrase code.claude.com pages that are already linked at `:3`, and one sentence per component adds nothing to the link.
- Cut `:18-43` to two sentences. "Claude Code hooks in `.claude/settings.json` do not load when the session root sits above the repo (`ls ~/.claude/projects/` names the root), so this repo's commit-time work runs as git hooks installed by `npm run setup`, backed by `tools/test/derived-artifacts.test.mjs`." The `SessionStart` checkout-delegate section below it already carries the `npm run setup`/`ready` mechanics.
- Replace `:5-16` and the three hook essays with one table generated from `.claude/skills/hooks/hooks.json`, or written by hand and gated by a test that compares the two. The columns are event, matcher, script, and a one-line job. Point to each script's header comment for the reason. Keep, as a short "Plugin hook facts" list, the four measured loader facts that no script states: `claude plugin validate` does not read the hooks file; `claude plugin details` reports the declared inventory, not the loader's verdict; `claude plugin list` status is per directory; cached plugin files lose the executable bit.

**Rationale:** The hook scripts already carry their own rationale. `session-record.sh:1-22` states the "why a plugin hook" argument, the declarative store discovery and the silent-exit rule, and ends "See docs/environment/extending.md", so the two files cite each other with the same text. `invoke-default.sh` and `invoke-sessions.sh` each open with a comment block of about 25 lines. The narrative inventory is also stale. `hooks.json` registers nine plugin hooks (three `SessionStart`, two `PreToolUse`, two `PostToolUse`, one `PostToolUseFailure`, one `Stop`), and the doc describes three of them. It says nothing about `session-dispatch.sh`, `reading-column-guard.sh`, `send-later-guard.sh`, `pr-subscribe-hint.sh`, `warn-governing-docs.sh` or `mcp-fail-hint.sh`. Line 5 promises "one plugin hook" and then lists two. A table checked against `hooks.json` cannot drift in this way.

**Evidence:** `extending.md:5-16` against the `hooks.json` listing above. `session-record.sh:4-10` against `extending.md:147-149`. `extending.md:163` ("validate does not read the hooks file") conflicts with `docs/MARKETPLACE.md:46`, which recommends `claude plugin validate .` before pushing with no caveat. That is a second copy of the plugin-health rule, and it gives the weaker check. Home `CLAUDE.md` ("Cross-repo conventions") already says "`claude plugin list` is the one command that shows a load failure".

**Words removed:** about 2,300 of 4,472 (primer 281, `PreToolUse` diagnosis about 500, hook essays about 1,700, less about 200 words of table and facts list).

**Inbound dependencies:** 92 files mention `extending.md`. Most are session records in web-tools-private. The live links are in the web-tools `CLAUDE.md` ("Details: extending.md") and home `CLAUDE.md` ("This repo declares no SessionStart hooks..."), both to the file, and in `container.md:180`, to the project-root proof. Four hook scripts cite the file in comments: `session-record.sh:10`, `pr-subscribe-hint.sh:17`, `reading-column-guard.sh:18` and `invoke-default.sh:145`. `reading-column-guard.sh:18` cites the project-root measurement specifically, which the two-sentence version keeps. No script or skill links an anchor inside the hook essays. Fix `MARKETPLACE.md:46` in the same change.

**Risk:** Medium. The measured loader facts are the one part of this file that exists nowhere else, and they must survive the cut.

## 4. TRACKER.md: cut the operating rules its own line 5 gives to the `tasks` skill

**Repo:** web-tools

**Targets:** `docs/TRACKER.md:98-128` (runner and action tags), `:205-211` (Conflicts), `:213-235` (Across repositories), `:80-84` (size and awaiting guidance), `:86-88` (id minting and legacy migration), and the incident tails at `:70` (last two sentences), `:74` (last sentence) and `:76` ("Measured 2026-09-17... Migrate one of the three").

**Kind:** link-to-owner

**Proposal:** Keep TRACKER.md as the schema and board contract: model, recognized keys, parser contract, graduation rule, board format, typed projection, and the `tracker-assessment/1` record. Cut the following:
- Runner and action tags: reduce `:98-128` to two lines. Both are open tags carried into `board-tags.csv`, and the `tasks` skill's "File a runnable task" section owns their use.
- Across repositories: reduce `:213-235` to two lines. References carry `owner/repo`, and `depends-on` does not cross a tracker. The correct-versus-file rule, the commit-message shape and the scope rule are in the skill's "Another repo's tracker" section.
- Conflicts: reduce `:205-211` to the id-collision rationale, one sentence placed next to the id scheme.
- Size and awaiting: reduce `:80-84` to the field definitions. The size scale and the "XL is a smell" advice are in `SKILL.md:130-134`.
- Id minting: cut the legacy-migration procedure at `:88`. It is an operating instruction, and every tracker it names has already migrated to slug ids.
- Incident tails: at `:70`, `:74` and `:76`, keep the rule and drop the "which is what happened on 2026-09-17" sentences.

**Rationale:** `TRACKER.md:5` says: "This file is the contract, not the instructions... Every rule about operating a tracker... has one owner, the `tasks` skill." These sections are operating rules. The skill restates each of them, and the two copies already differ in wording, so every edit has to be made twice.

**Evidence:** Runnable tasks: `TRACKER.md:102-126` against `.claude/skills/tasks/SKILL.md:142-171` (the same template, the same "if the procedure is not a skill yet, writing the skill is part of filing", the same "prefer a derivation", the same "belongs in a hook, a test, or CI"). Cross-repo: `TRACKER.md:221-233` against `SKILL.md:260-266`. Size: `TRACKER.md:82` against `SKILL.md:130-132`. Conflicts: `TRACKER.md:211` against the skill's "`board.md` is generated, so take either side and rerun".

**Words removed:** about 1,600 of 4,363 (574 + 584 + 231 + 219 + about 200 of incident tails, less about 200 of retained pointers).

**Inbound dependencies:** `tools/test/state-the-rule.test.mjs:748` uses TRACKER.md as segmenter corpus and needs more than 1,000 units in total across eight files. The remaining text keeps its fences and tables, so the count should still clear the threshold, but re-run the test. `tools/test/tracker-tasks.test.mjs` enforces the Related-path and no-em-dash rules that `:70` states; keep the statement and cut only the narrative. home's `tracker/tasks/cross-repo-tracker-convention-t2oesn.md:28` names the "Across repositories" section; it is a task file, out of scope to edit, but the reference goes stale. `swipe-deck-index.test.mjs:38` and `build-board.test.mjs` cite the file, not these sections.

**Risk:** Low. TRACKER.md is the adoption contract for other repos, so a reader adopting without the plugin loses the operating detail. The `tasks` skill ships in that same plugin, and TRACKER.md already sends such a reader to the skill.

