# Slice: home-contract

**Summary.** This slice is the home repo's standing contract and doctrine: `CLAUDE.md` (5,999 words, loaded in every home session), `README.md` (3,335), `me/` (about 8,500 across prose and CSV), the `created/` doctrine essays (about 38,000), the living chron guidance files (`chron/assignments/README.md` 772, `chron/blog/drafts.md` 1,902, `chron/sweeps.md` 2,334), `tools/README.md` (2,103) and `.claude/skills/**` (15,941). The dominant bloat in `CLAUDE.md` is project-specific operating detail and incident narrative sitting in the one file every session pays for: the budget-drs render exception and fragment params alone are 895 words, and a further 1,000 or so restate documents that web-tools or a budget-drs README already owns. Proposals below are ordered by words saved per unit of risk.

## 1. Move the budget-drs render routing out of CLAUDE.md

**Repo:** home

**Targets:** `CLAUDE.md:132-215` (the three paragraphs after "Render path" that begin "A page the budget-drs app frames", "The exception is observed", "Two candidates remain", "Meanwhile hand over", "A branch preview", "Two former limits", "`appendix-render` stays", "One level down").

**Kind:** link-to-owner

**Proposal:** Keep `CLAUDE.md:127-131` (private repo, so 🥏 toss in owner mode, `[new]` otherwise). Replace lines 132-215 with two sentences: "A page the budget-drs app frames is linked through the app: run `python3 ../web-tools/scripts/showing.py` and paste what it prints. While the app route renders an empty pane (web-tools SNAGS `app-frame-outruns-the-inliner`), hand over the framed page on its own with `#pkg=<id>` and say the app route is the broken one." Move anything in the fragment-param and headless-shot paragraphs that `projects/budget-drs/app/view/README.md` lacks into that README (it already carries the `SUBMITTAL_OPEN` params at lines 71-74 and the inliner mechanics and `data-inline-error` at lines 252-262).

**Rationale:** Every home session loads 895 words about one project's app shell, its inliner's byte count, a console diagnostic, and the `msTab` hash gap. A session doing chron, news or `me/` work never needs it, and a session doing budget-drs work reads the app README anyway. The "exception" paragraphs are an open bug report, which is what SNAGS is for, and SNAGS already has it verbatim.

**Evidence:** Duplicate 1, the diagnosis: `CLAUDE.md:153-176` and web-tools `docs/SNAGS.md:274-297` state the same 46 files, 9,692,313 bytes, `VIEWS` inline, the two candidates, and the identical console one-liner. Duplicate 2, the fragment params: `CLAUDE.md:204-215` and `projects/budget-drs/app/view/README.md:69-75` both list `?pkg=`, `?piece=`, `?track=`, `?diag=` and "every param present is forwarded". Duplicate 3, the showing rule: `CLAUDE.md:132-151` restates web-tools `CLAUDE.md` "Showing" (run `showing.py`, do not decide by reading). The paragraph's own text says it goes "when the cause is known", so it was written as temporary.

**Words removed:** about 850 of 895 (`sed -n 132,215p CLAUDE.md | wc -w` = 895).

**Inbound dependencies:** None mechanical. `grep` for `SUBMITTAL_OPEN`, `inlineRelativeDeps` and `app-frame-outruns-the-inliner` in living docs finds only `CLAUDE.md`, the view README, web-tools `SNAGS.md`, and two tracker tasks (out of scope, untouched). No script reads `CLAUDE.md`.

**Risk:** Low. The one behaviour that must survive in always-loaded context is "the app route is currently broken, hand over the page alone", and the two-sentence replacement keeps it. When the cause is fixed, one sentence goes instead of 700 words.

## 2. Retire the retired-markers paragraph into the linter

**Repo:** home

**Targets:** `CLAUDE.md:74-76` ("Status markers are retired as of 2026-09-21" and "What survives is the frozen path declaration"); `tools/lint-conventions.py` retired-terms block (starts line 172).

**Kind:** move-to-data-or-check

**Proposal:** Add a pattern to the retired-terms list in `tools/lint-conventions.py` for the forms the paragraph forbids in living prose: `**Frozen|Stale|Wrong YYYY-MM-DD`, `**Update YYYY-MM-DD:**`, with the existing dated-record exemption. Then cut the paragraph to one line: "Status markers are retired: fix a wrong sentence in a living document; in a dated record, say it was wrong in an ordinary sentence and link the successor (record: `chron/2026/09/2026-09-21-retiring-the-markers.md`, enforced by `lint-conventions.py`)." Move the `.paths.json` sentence to the Enforcement-split bullet (line 80), which already names "frozen-path declarations → a step of `tools/verify-artifacts.sh`".

**Rationale:** 247 words describe a convention that no longer exists, plus the audit numbers that justified dropping it. The chron record holds the audit. A pattern in the linter replaces a paragraph a session has to remember, which is the repo's own "when the same correction lands twice, promote it to a check" rule (line 80).

**Evidence:** `grep -rn '\*\*Update 20\|\*\*Wrong 20\|\*\*Frozen' --include=*.md` outside `chron/20*`, `archive/` and `source/` finds zero live uses in home, so the check lands clean. `lint-conventions.py:172-200` already hosts dated retired-term patterns with a dated-record exemption.

**Words removed:** about 205 of 247.

**Inbound dependencies:** `projects/doc-audit/fact-census/roster.py` and `data/design/tools/check-drift-list.py` read `.paths.json` itself, not the prose. No reader of the paragraph.

**Risk:** Low. The pattern must stay narrow (bold, a date, the four words) so it does not fire on ordinary uses of "wrong" or "update".

## 3. Cut "Cross-repo conventions" to the home-local facts

**Repo:** home

**Targets:** `CLAUDE.md:262-301`.

**Kind:** link-to-owner

**Proposal:** Keep three facts: the marketplace is subscribed in `.claude/settings.json` (enabling `portable` and `daisy-alpine`); non-ambient skills load via `/load-skill`; home declares no `SessionStart` hooks and adds a hook as a `session-*.sh` file. Replace the rest (no `version` so SHA pinning; one session late; marketplace clone versus plugin cache; `claude plugin list` as the only honest load check; per-directory status; `/tmp/refresh-portable.log`; "availability is not invocation") with one link: "Plugin mechanics and failure modes: web-tools `docs/MARKETPLACE.md` and `docs/environment/extending.md`."

**Rationale:** The section is mostly harness mechanics that apply to every consumer repo, so web-tools owns them. Restating them here means two copies that drift as the harness moves.

**Evidence:** Version and pinning: `CLAUDE.md:266-269` against web-tools `docs/MARKETPLACE.md:14`. `claude plugin list` as the only load check and status being per-directory: `CLAUDE.md:279-282` against web-tools `docs/environment/extending.md:165-169` and `container.md:187`. The one-session lag: `CLAUDE.md:269` against `container.md:129-148`. The dispatcher: web-tools `.claude/skills/hooks/session-dispatch.sh`, documented in `extending.md`. "Availability is not invocation" restates `CLAUDE.md:12-29`.

**Words removed:** about 230 of 319.

**Inbound dependencies:** `tools/verify-artifacts.sh` implements `plugin_script()`; it does not read the prose. The chron record `2026-08-27-plugin-marketplace-mechanics.md` stays as the dated source.

**Risk:** Low. The "two copies" warning is the one piece that caught real mistakes; keep it as a clause on the link if the owner wants it ("the marketplace clone tracks main, the plugin cache is pinned; `plugin_script()` prefers the newer").

## 4. Cut README.md to orientation: drop its Tools, Skills, Style and per-folder sections

**Repo:** home

**Targets:** `README.md:64-94` (the per-folder paragraphs after the tree, keeping the `full-picture.md` paragraph at line 62), `README.md:95-113` (Skills), `README.md:114-138` (Tools), `README.md:139-145` (Style).

**Kind:** link-to-owner

**Proposal:** Keep "Fast and slow layers", "Push and pull", "Ingress", the tree and the `full-picture.md` paragraph. Replace the per-folder paragraphs with one line: "What goes in each folder is the contract's job: see `CLAUDE.md`, Where things go." Replace Skills with "Skills: `.claude/skills/README.md`." Replace Tools with "Scripts: `tools/README.md`." Delete Style (the dash rule is `CLAUDE.md:71` and `lint-conventions.py`). Fix the tree while there: it places `assignments/` under `created/`, but the folder is `chron/assignments/`.

**Rationale:** README says of itself that it is "orientation, not rules", yet about 2,500 of its 3,335 words are a third copy of the folder rules, the skill inventory and the tool inventory. Each copy has already drifted, which is the evidence that nobody maintains three.

**Evidence:** Tools: `README.md:114-138` against `tools/README.md:34+`, which says at its top (line 4-6) that it is the reference and was moved out of `CLAUDE.md` for size. README's list is already stale: it still lists `stale-flags.sh` as the path to `/markers` (line 125), which the 2026-09-21 marker retirement ended, and it omits `build-home-app.py`, `common-ground-nodes.py`, `declare-skills.py` and `landed-workbook-sheets.py`, all in `tools/README.md`. Skills: `README.md:97` names `/caption` and `/web-tools` as portable skills; neither exists in web-tools `.claude/skills/` or `docs/portable.csv`. Folder rules: the threads paragraph (`README.md:72`) restates `CLAUDE.md:241-249` almost line for line; dump (`README.md:66-70`) restates `CLAUDE.md:84` and `233-240`; blog (`README.md:82`) restates `CLAUDE.md:254-261`; assignments (`README.md:84`) restates `CLAUDE.md:91`.

**Words removed:** about 2,350 (per-folder paragraphs about 900 of the 1,003 in lines 64-94, Skills and Tools 1,428, Style 42).

**Inbound dependencies:** `tools/generate-full-picture.sh:31` links `README.md` as "the full spec"; that sentence should read "orientation" after the cut. No inbound anchor links to `README.md#tools`, `#skills` or `#style` in living files (grep). `build-home-app.py` reads project READMEs, not the root one.

**Risk:** Low. A human reading on GitHub loses a one-page view of the tools, and gains a link to the maintained one.

## 5. One owner per procedure: let the skills own drain, blog and farm-out

**Repo:** home

**Targets:** `CLAUDE.md:228-240` ("When asked to bulk-add files", "Dump promotion"), `CLAUDE.md:254-261` ("Blog (beta)"), `CLAUDE.md:303-310` ("When asked to run a skill"), `chron/assignments/README.md` sections "Lifecycle", "Conventions" and "The analysis".

**Kind:** merge

**Proposal:** In `CLAUDE.md`, replace "Dump promotion" and "Blog (beta)" with one line each naming the skill that runs them (`/drain`, `/blog`), and delete "When asked to run a skill", which is generic harness behaviour. Move the one rule that lives only in `CLAUDE.md` ("a promoted file with no `# Title` stays without one; promoted files never get frontmatter", `CLAUDE.md:236`) into `.claude/skills/drain/SKILL.md`. Keep "When asked to add a chron entry" and "Threads", which no skill owns. In `chron/assignments/README.md`, keep the definition and the folder tree and let `.claude/skills/farm-out/SKILL.md` own the lifecycle and the analysis repertoire; the skill currently compresses the repertoire and then says "see README for the fuller description" (`farm-out/SKILL.md:28`), so the fuller text should move into the skill.

**Rationale:** Each procedure exists in two or three places. The skill is the copy a session executes, so it is the owner; the `CLAUDE.md` copy costs every session and adds nothing a `/drain` run does not load.

**Evidence:** Dump promotion: `CLAUDE.md:233-240` against `.claude/skills/drain/SKILL.md` (move and rename, route by content, trends toward empty, blog after a substantial drain, drafts entry shape). Blog: `CLAUDE.md:254-261` against `.claude/skills/blog/SKILL.md:22-59` (filename, `# Title`, frontmatter skipped, regenerate both indexes, never hand-edit, drafts promotion). Assignments: `chron/assignments/README.md` Lifecycle and "The analysis" against `farm-out/SKILL.md:16-28` (verbatim `prompt.md`, `claude-seed.md`, status `collecting`, the same four core and three extra analysis sections).

**Words removed:** about 380 from `CLAUDE.md` (170 + 171 + 71, less two pointer lines) and about 300 net from `chron/assignments/README.md` (216 + 293 in the two sections, with the repertoire moving into the skill).

**Inbound dependencies:** `/drain` and `/blog` are `disable-model-invocation` or model-invocable skills loaded by command, so they carry their own text. No script reads these `CLAUDE.md` sections.

**Risk:** Medium-low. A direct write to `chron/blog/` from a non-Claude-Code agent (the Ingress channels in `README.md:25-40`) would lose the inline blog rules. The pointer line should name the file path of the skill so any agent can open it.

## 6. Trim .claude/skills/README.md to what no generated list carries

**Repo:** home

**Targets:** `.claude/skills/README.md:20-47` ("Current docs"), `:70-78` (three review passes narrative), `:87-100` (the `/scour` narrative), `:113-140` ("Pulled" and "Frameworks").

**Kind:** link-to-owner

**Proposal:** Delete "Pulled" and "Frameworks" and replace them with "Pulled skills: web-tools `docs/portable.csv`." Collapse the review-passes and `/scour` paragraphs to one sentence each ("The review passes are `/repo-review <depth>` from the plugin; home's extension points are in `CLAUDE.md`, Repo review." and "`/scour` is pulled; edit it upstream."). Cut "Current docs" to the two external links. Drop the hand counts ("six and six", "Six of the seven"), since `.web-tools.json`'s generated `skills` key and the `disable-model-invocation` lines in each `SKILL.md` are the record.

**Rationale:** The file restates an upstream inventory that moves on the hub's clock, and it has already gone wrong. It also carries two incident narratives whose rule is already stated in `CLAUDE.md` ("conventions sync by pull, never by copy").

**Evidence:** The Pulled table lists `/caption` (line 123), which does not exist in web-tools `.claude/skills/` or `docs/portable.csv`, and "35 skills" for the library, a hand count. `tools/declare-skills.py:7` records that "the hand-kept prose list in `.claude/skills/README.md` had already drifted twice", which is why the generated key exists. The `/scour` paragraph (lines 87-100) ends by pointing at the rule it illustrates.

**Words removed:** about 700 of 1,627 (Pulled and Frameworks 360, review-pass narrative 97, `/scour` narrative 150, Current docs about 120 of 191).

**Inbound dependencies:** `CLAUDE.md:305` and `README.md:97` link the file as "the full inventory"; both remain valid. `tools/declare-skills.py` names it only in a comment.

**Risk:** Low.

## 7. Replace me/README's governance table and its incident story with two sentences

**Repo:** home

**Targets:** `me/README.md:20-54` ("What governs a Claude Code session" and "Why this file exists"); `CLAUDE.md:32` (the second paragraph of the HTML bullet).

**Kind:** collapse-narrative

**Proposal:** Replace `me/README.md:20-54` with: "Nothing in `me/` is the operating contract. Two files are read by tooling: `claude-preferences`, whose HTML stack `CLAUDE.md` makes binding, and `common-ground.csv`, gated by `verify-artifacts.sh` and read by `concept-index check --known`." Delete `CLAUDE.md:32`, which tells the same stat-cards incident from the other side and cites a SNAGS entry for it.

**Rationale:** The table routes a reader to four places, and two of its four rows are now wrong. The incident is told twice to justify a pointer that is already fixed.

**Evidence:** `me/README.md:37` says SURFACING.md is "imported by that CLAUDE.md"; web-tools `CLAUDE.md` says the import was cut on 2026-09-12. `me/README.md:38` sends style questions to `docs/HTML-STYLE.md`, which `CLAUDE.md:30` says has been a pointer since 2026-08-31, with `daisy-alpine` as the real owner. The stat-cards story appears at `me/README.md:43-54` and `CLAUDE.md:32`.

**Words removed:** about 290 of 335 in `me/README.md`, and 54 in `CLAUDE.md`.

**Inbound dependencies:** None found; no living file links `me/README.md` (grep for `me/README` finds only unrelated `runs/.../README.md` hits). `build-home-app.py` reads `me/*` as content for the home app, so the shorter file simply shows shorter.

**Risk:** Low.

