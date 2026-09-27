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

