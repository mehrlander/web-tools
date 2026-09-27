# Slice: wt-contract

## Summary

This slice is the web-tools cross-repo contract: the files every session loads (`docs/SURFACING.md` 804 words, `docs/QUALIFIED-WRITING.md` 224, the `default` skill's `SKILL.md` 379, and web-tools `CLAUDE.md` 1,497 in this repo), the file delivered when a PR opens (`docs/surfacing-course.md` 1,003), and the reference docs the contract points at (`docs/APP.md` 1,434, `docs/showing.md` 1,490, `docs/MARKETPLACE.md` 651, `docs/venues.md` 798, `docs/portable.csv` 748). Total 9,028 words, of which about 2,900 load at session start in web-tools and about 1,400 in every other repo. The session-start files are already fairly tight; the core rules in `SURFACING.md` and `QUALIFIED-WRITING.md` are dense and mostly load-bearing. The dominant bloat is elsewhere, in two forms. First, **delivery history told in the files being delivered**: three documents each explain, at length, how they used to arrive and why that stopped (the 2026-09-12 import cut, the 2026-09-13 closed loop). Second, **correction narratives kept in living docs**: `APP.md` spends 870 words on how a list of name holdings was wrong three times, and `CLAUDE.md` spends 558 words restating `tools/README.md`. Two findings are plain defects rather than bloat: web-tools `CLAUDE.md:5` tells every session to run `/markers`, a skill retired on 2026-09-21, and `docs/venues.md:8` cites `docs/CONVENTIONS.md` as "always in context", a file that does not exist. Proposals below total roughly 3,000 words removed, about 700 of them from text that loads at session start.

## 1. Collapse the delivery paragraph in web-tools CLAUDE.md, and drop the dead `/markers` default

**Repo:** web-tools

**Targets:** `CLAUDE.md:5` (241 words, one paragraph).

**Kind:** collapse-narrative

**Proposal:** Replace line 5 with three sentences: "The contract arrives through the `portable` plugin: its `invoke-default` hook prods every session to run `/portable:default`, here as in every repo. If the conventions are missing, the prod is broken; report it. `docs/surfacing-course.md` arrives with the `pr-subscribe-hint` hook when a PR opens." Keep the three live one-line defaults (venues, "link instead", hypothetical problems) and the two pointers to `portable.csv` and `MARKETPLACE.md`. Delete the `/markers` default. Delete the history of the `@`-import and why cutting it mattered; that history is the subject of web-tools PR #652 and home's `chron/2026/08/2026-08-26-the-injection-delivers-five-percent.md`.

**Rationale:** The paragraph loads every session in web-tools and spends about 130 words on why a channel that no longer exists was removed. A session needs the current channel and the failure signal, not the argument. The `/markers` default is wrong: it sends every session to a skill that no longer exists.

**Evidence:** `ls .claude/skills/` has no `markers` directory. `docs/estate-span.md:41` records "the markers skill and `status.py`, their only reader, were retired". `docs/SNAGS.md:1987` records `markers/status.py` "retired 2026-09-21 with the rest of the status system". home `CLAUDE.md` ("Status markers are retired as of 2026-09-21") agrees. The same history is told again in home `CLAUDE.md` (Working style, second bullet) and in the default skill (proposal 3), so it has at least three copies.

**Words removed:** about 150 of 241.

**Inbound dependencies:** `tools/test/claude-md.test.mjs` asserts only that `CLAUDE.md` links `docs/showing-mechanisms.csv` and `docs/showing.md` and stays under 1,600 words; neither is on this line. `.claude/skills/hooks/invoke-default.sh` parses `@`-imports, not this prose. `.claude-plugin/marketplace.json` still lists the keywords `markers` and `frozen`; remove them in the same change.

**Risk:** Low. The only content lost is history, which the PR and chron entry keep.

## 2. Replace the build-on-commit section of CLAUDE.md with the rules and a link

**Repo:** web-tools

**Targets:** `CLAUDE.md:32-48` (558 words), plus `CLAUDE.md:24-26` (75 words) which it cross-references.

**Kind:** link-to-owner

**Proposal:** Reduce lines 32-48 to five imperative lines under one heading: (a) `dist/web-tools.js` and `dist/app.js` are tracked pre-builds, see `tools/README.md#the-pre-build`; before adding a file to `lib/` read `docs/loader.md` and `docs/code-layers.md`. (b) `.githooks/pre-commit` regenerates every deterministic derived artifact; do not hand-edit its output. (c) Run `npm run setup` once per checkout; `npm run ready` checks. (d) If `derived-artifacts.test.mjs` fails, run `npm run artifacts:refresh`. (e) Keep the suite browser-free: Playwright checks are named without `.test.`. Fold the thumbnail rule from lines 24-26 into (b) as one sentence. Delete the "third owner" paragraph's argument (line 48, 165 words) except rule (e); the workflow file and `tools/README.md#the-refresh-model` own the rest.

**Rationale:** `tools/README.md` already owns the refresh model, the order of the hook's legs, the pre-build, and `npm run setup` (`tools/README.md:169`, `:213`, `:261-300`). `docs/environment/extending.md:18-27` owns why the hook moved out of Claude's `PreToolUse`. The CLAUDE.md section restates both and adds an essay on why CI exists ("a hook that may not fire, guarded by a test that may not be run"). A session needs the commands and the prohibitions, which fit in five lines.

**Evidence:** `CLAUDE.md:38` and `:46` both say "`tools/README.md` lists the legs ... and why"; the file points at its owner twice and restates it in between. `CLAUDE.md:36` (106 words) defends the `gh.load` chain as "not a legacy path" and cites 36 page files, a count no check holds.

**Words removed:** about 450 of 633.

**Inbound dependencies:** `CLAUDE.md:26` and `:40` cross-reference each other ("see Build-on-commit hook below", "see Per-session refresh above"); merging removes both. No test reads these sections by heading. `claude-md.test.mjs` benefits (word ceiling).

**Risk:** Low. The CI caveat about the gitignored `package-lock.json` is the one fact not stated elsewhere; move it to `tools/README.md` rather than lose it.

## 3. Shrink the default skill to its instruction, and drop the provenance headers from the two contract docs

**Repo:** web-tools

**Targets:** `.claude/skills/default/SKILL.md:17-27` (124 words) and `:36-49` (fallback instructions, about 90 words); `docs/SURFACING.md:3-10` (58 words); `docs/QUALIFIED-WRITING.md:3-10` (57 words). The two docs are vendored byte-for-byte into `.claude/skills/default/`, so each cut lands twice.

**Kind:** collapse-narrative

**Proposal:** In `SKILL.md`, replace lines 17-27 with one sentence: "Load both files even when a web-tools checkout is present; no repo imports them." Replace the curl block and the MCP fallback (lines 36-49) with one line: "If the copies beside this file are missing, fetch them from `mehrlander/web-tools/main/docs/`." Keep the sentence on when to load `surfacing-course.md` and the precedence rule (local `CLAUDE.md` wins). In `SURFACING.md` and `QUALIFIED-WRITING.md`, delete the header paragraph and the `---` rule under it; the skill already says where the canonical copy lives and that local rules win.

**Rationale:** All four spans load at the start of every session in every repo. The skill spends a third of its words on a failure mode (2026-09-13) that the one-sentence rule already prevents. The "canonical source / byte-matched copy / local overrides" statement appears three times in one load: `SKILL.md:29-34,51-52`, `SURFACING.md:3-8`, `QUALIFIED-WRITING.md:3-8`. The plugin always ships the copies, so the three-route fallback serves a case the install rules out.

**Evidence:** `cmp docs/SURFACING.md .claude/skills/default/SURFACING.md` reports identical, same for the other two, and `tools/README.md:300` shows `npm run vendor-docs` keeps them in sync on commit.

**Words removed:** about 280 per session (skill about 170, the two headers about 115).

**Inbound dependencies:** `tools/test/surfacing-manifest.test.mjs:25` slices `SURFACING.md` from `## Surfacing primitives` to the next `\n---`. Deleting the header's `---` (line 10) is safe because the split takes the text after the heading, but confirm the section still ends at the right place (there is no later `---` today, so the slice runs to end of file either way). `.claude/skills/hooks/invoke-default.sh` matches the markers `## Surfacing primitives` and `# Qualified writing`; keep both headings. `tools/test/state-the-rule.test.mjs:750` uses `SURFACING.md` as a corpus; it reads whatever is there.

**Risk:** Low. The `invoke-default.sh` hook's own comments (lines 3-30, 66-80, 118-132) carry the same history at greater length, so nothing is lost from the estate.

## 4. Remove the duplicated wake and merge rules inside SURFACING.md, and make its showing line portable

**Repo:** web-tools

**Targets:** `docs/SURFACING.md:31` (second sentence), `:57`, `:63-65`.

**Kind:** rewrite-shorter

**Proposal:** State the no-reply rule once. Line 31 says "a base branch moving is a wake, and a wake that leaves the reader nothing to do gets no reply at all"; line 65 says "A base branch that moved is not work. If a wake changes nothing, do not reply." Keep line 31's version and delete line 65's two sentences. Line 65 also restates the 🟣 and 🔴 closing states already defined at lines 24-25, and "Include a state when no files changed" is already in line 31; cut those too, leaving line 65 as: "Treat each event separately. `go:` expresses intent, not write authorization. Address failing checks only when relevant to this session. Never schedule a check-in." Replace line 57's `npm run showing`, which exists only in web-tools, with "Run web-tools `scripts/showing.py` from the checkout before handing over a render link", which is what home's `CLAUDE.md` already has to tell its sessions separately.

**Rationale:** This file loads every session. Three statements of one rule in 35 lines is the kind of internal repetition `routes-manifest.test.mjs:276` forbids in `showing.md`. The `npm run` form is wrong in every repo but web-tools, and home carries a paragraph partly to correct it.

**Evidence:** `SURFACING.md:24-25` (merged, closed), `:31` ("Include a state when no files changed", wake rule), `:65` (both again). home `CLAUDE.md`, "Render path": "run it, from this checkout: `python3 ../web-tools/scripts/showing.py`".

**Words removed:** about 55.

**Inbound dependencies:** `docs/surfacing.csv` indexes primitives by bold lead-in (`surfacing-manifest.test.mjs:42-52`); no lead-in changes. `.claude/skills/hooks/pr-subscribe-hint.sh:84` quotes the heading "Subscribe the workstream PR"; unchanged.

**Risk:** Low. Small in words, but it is the most-loaded file in the estate.

## 5. Move the assistant attribution table out of the surfacing course

**Repo:** web-tools (touches home `AGENTS.md`)

**Targets:** `docs/surfacing-course.md:15-31` (342 words); its copies in web-tools `AGENTS.md:11-24` and home `AGENTS.md:9-22`; `docs/surfacing-course.md:3-6` (52 words).

**Kind:** merge

**Proposal:** Make web-tools `AGENTS.md` the owner of the four-assistant table, the "unclassified, not human" rule, the preflight rule for non-Claude assistants, and the batch-output rule. Delete lines 15-31 from `surfacing-course.md`, keeping one line: "Branch prefixes and commit trailers per assistant: [AGENTS.md](../AGENTS.md)." home `AGENTS.md` links to web-tools `AGENTS.md` instead of repeating the table. Rewrite `surfacing-course.md:3-6` to one sentence that drops "is injected into every session" (injection was retired 2026-09-09) and the explanation of when the hook fires.

**Rationale:** The course is delivered to Claude sessions when a PR opens. Claude's trailer is added by the harness (the table's own Notes column says so), and Codex, Gemini and Grok do not run the plugin; they read `AGENTS.md` or `GEMINI.md`. So the section reaches the one reader who does not need it. The table already has three copies and they have drifted: `AGENTS.md:19` says "`antigravity/` reads as Gemini", which the course lacks, and the Codex notes differ between the course (line 22) and `AGENTS.md:18`. The code that actually classifies branches, `lib/kits/assistant-mark.js:97-106`, also accepts `chatgpt/` and `-grok`, which no copy mentions. `AGENTS.md:13` says "change it there first", pointing at the course: the owner is declared backwards from the audience.

**Evidence:** `docs/repetitions.csv:19` already registers "the assistant attribution table, AGENTS.md, copy". The Gemini incident narrative (line 26, "on 2026-09-18 four Gemini branches ...") and the preflight statistic (line 30, "Twelve of fifteen Gemini branches") collapse to their rules.

**Words removed:** about 330 from the course, about 150 from home `AGENTS.md`.

**Inbound dependencies:** `docs/SNAGS.md:246` links `surfacing-course.md#assistant-identity-and-attribution`; repoint to `AGENTS.md`. `docs/SURFACING.md:35` says "Include assistant commit trailers per surfacing-course.md"; repoint. web-tools `GEMINI.md:16` links the course for the two modes, which stay. `.claude/skills/hooks/pr-subscribe-hint.sh:91` prints "Session start injects SURFACING.md's primitives", the same stale claim; fix the string in the same change. `docs/repetitions.csv:19` updates its `where`.

**Risk:** Medium. The owner should confirm that `AGENTS.md` is read by every non-Claude assistant in both repos before the course stops carrying the table.

## 6. Collapse the APP.md name split to a rule and a table

**Repo:** web-tools

**Targets:** `docs/APP.md:13-106` (1,021 words), of which `:24-99` (870 words) is correction history; `docs/APP.md:133-142` Provenance (89 words).

**Kind:** collapse-narrative

**Proposal:** Replace lines 13-106 with about 150 words: the rule ("**Web Tools** wherever a reader is addressed, including chat replies, captions, PR bodies and commit messages the app writes; **show-repo** on identifiers that name the shell"), the rule for keeping a name ("kept because it is accurate or held outside the estate, never because renaming is expensive"), and a four-row list of current holdings: the `consumer` column of `manifest-fields.csv`, the reference doc `show-repo.md`, the `/show-repo` skill, and the tracker project tag; plus the permanent redirect stub at `pages/show-repo/show-repo.html`. Delete the three correction narratives (route registry, test filenames, `via show-repo` commit strings) and the 2026-08-16 address-move story. Delete the Provenance section or reduce it to one sentence naming the Surfacer project.

**Rationale:** The section is 71% of the file and nearly all of it is the record of a list being wrong and fixed. The doc's own text names the failure: "a list of what holds a name goes wrong by not being recounted" (line 44). A living doc should state the current list; git and the PRs hold how it got there. The counts it cites (1,022 occurrences, 238 files, 151 files, 608 commits, 55 of 58 rows) are unchecked numbers that will go stale.

**Evidence:** `docs/docs.csv:2` describes APP.md as "mission, durable goals, and the name split". The rewrite has been drafted before: `docs/doc-craft-specimens/APP_living_spec_replacement.md` (459 words) and `docs/doc-craft-specimens/2026-09-08-naming-split.md` (the history as a dated record). Neither was adopted. Do not adopt the specimen's table verbatim: it lists "route registry keys in `app-routes.csv`" as a show-repo holding, which `APP.md:24-27` says is false.

**Words removed:** about 900.

**Inbound dependencies:** `CLAUDE.md:9` summarises the split and stays accurate. `README.md:5` links the app, not the section. Tests naming `docs/APP.md` (`md-doc.test.mjs`, `x-blob.test.mjs`, `source-peek.test.mjs`, `fab-menu.test.mjs`, `swipe-deck-index.test.mjs`) use the path as a fixture string and do not read the file. `docs/docs.csv:2` carries a word count (1437) that the hook presumably regenerates.

**Risk:** Low. If the history is wanted, promote the existing dated specimen rather than keeping it in the living doc.

## 7. Cut the restated mechanisms from showing.md

**Repo:** web-tools

**Targets:** `docs/showing.md:32-40` "The drawer at depth 2" (193 words), `:42-69` "Three reasons a change resists preview" (287 words), `:71-75` (170 words).

**Kind:** link-to-owner

**Proposal:** Keep the inverse table (lines 9-20), the nesting section (22-30), Viewer context, and the subject section. Delete "A toss carries main's lib, including the FAB" and the `?use=` route (lines 38-40), "The document boundary" and "Never pin both documents" (54-65): each is already the `misses` or `trap` field of the `toss-gh` row in `docs/showing-mechanisms.csv:4`. Reduce "The bootstrap" (47-52) to its one fact not in any row: `lib/gh-api.js` cannot be loaded by the loader, so a change to the shell's preamble has no preview route. Reduce 71-75 to its rule: the FAB cross-checks `window.gh.ref` and reports an ignored `?use=`. Drop the second restatement of the honesty rule, which `CLAUDE.md:20-22` also states.

**Rationale:** The file's own contract, enforced by `tools/test/routes-manifest.test.mjs:240-266`, is that a mechanism, boundary or address is a row, and prose keeps only relations between rows. These sections restate rows. showing.md sits at 1,490 words against a 1,500-word ceiling, so it will fail its own test on the next addition.

**Evidence:** `showing-mechanisms.csv:4` `misses`: "anything the SHELL contributes to the view: the FAB and the Alpine bundle come from the default branch ... needs the ?use= pin on a deployed page instead"; `trap`: "never add ?use= to the shell, which on an iPhone kills Safari's web process". `showing.md:38,58,62-65` say the same.

**Words removed:** about 450.

**Inbound dependencies:** `routes-manifest.test.mjs:255-278` requires links to `showing-mechanisms.csv` and `routes.json` (kept) and no repeated paragraph. `scripts/showing.py:34` cites "the failure docs/showing.md names" (the plausible-and-wrong render); keep one sentence of lines 71-75 for it. `tools/test/state-the-rule.test.mjs:750` uses the file as corpus only.

**Risk:** Low to medium. showing.md is reference, not session-start text, so the context saving is small; the value is getting the file off its ceiling and to one copy per fact.

## 8. Stop MARKETPLACE.md enumerating what the catalog already declares

**Repo:** web-tools

**Targets:** `docs/MARKETPLACE.md:5-14` (192 words), `:48-67` (159 words).

**Kind:** link-to-owner

**Proposal:** Replace the "What it publishes" table with two lines: "`portable`: the skills listed in `.claude-plugin/marketplace.json`, cross-referenced in `portable.csv`. `daisy-alpine`: the page style." Keep the versioning sentence (line 14) and the namespacing note (line 12). Replace "Why the hooks ship here" with one sentence: "The plugin also ships hooks, listed in its catalog description, because the per-container settings file is provisioned fresh each session; see `environment/extending.md`." Reduce "Relationship to the Distribution registry" to one sentence.

**Rationale:** The hook list has already drifted from the catalog. `MARKETPLACE.md:60` says "Eight pieces" and names eight; `.claude-plugin/marketplace.json` (the `portable` description) says "nine hooks" and adds the sessions-store directive; `.claude/skills/hooks/hooks.json` registers nine scripts, the ninth being `invoke-sessions.sh`, so the catalog is right and the doc is behind. The table row for `portable` spends 60 words explaining that it does not enumerate the roster.

**Evidence:** `docs/repetitions.csv:3` registers "the skill roster, docs/MARKETPLACE.md, pointer"; the hook list has no such row and no check.

**Words removed:** about 250.

**Inbound dependencies:** `marketplace.json` `homepage` points at the file (kept). `CLAUDE.md:5` and home `CLAUDE.md` link it by name. `docs/docs.csv:5` word count.

**Risk:** Low.

## 9. Fix and shorten venues.md

**Repo:** web-tools

**Targets:** `docs/venues.md:3-9` (about 100 words), `:17-20`, `:60-67` "The tracker's `runner:` tag" (about 100 words).

**Kind:** rewrite-shorter

**Proposal:** Replace lines 3-9 with one sentence: "A session sees only the venue it runs in; this map names the others so a session asks whether one fits." Delete the claim that the venues are "named again in one line of CONVENTIONS.md, which is always in context". Cut the `runner:` tag section to one sentence: "`runner:` in `TRACKER.md` names a machine, not a venue; say the venue in the task body when it matters." Keep the table, the two properties, the self-hosted-runner constraint, and the dated check line.

**Rationale:** The cited file does not exist: `ls docs/CONVENTIONS.md` fails. The line that does make venues ambient is `CLAUDE.md:5`, and only in web-tools, so the justification is wrong on both counts. `portable.csv:22` types this doc `live`, so it travels to other repos and carries the dead reference with it.

**Evidence:** `docs/venues.md:8`. The same dead `docs/CONVENTIONS.md` citation appears in `tools/test/claude-md.test.mjs:39,52`, whose failure message sends a session to a missing file; fix it in the same change (point it at `docs/registries.md` or at the doc-craft skill it also names).

**Words removed:** about 170.

**Inbound dependencies:** Linked from `CLAUDE.md:5`, `docs/inbound.md`, `docs/README.md`, `docs/portable.csv:22`, `lib/kits/prompt-link.js` (a comment), `tracker/tasks/laptop-self-hosted-runner-6a0n5f.md`. None link a section anchor.

**Risk:** Low.
