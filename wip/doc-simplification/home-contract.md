# Slice: home-contract

**Summary.** This slice is the home repo's standing contract and doctrine: `CLAUDE.md` (5,999 words, loaded in every home session), `README.md` (3,335), `me/` (about 8,500 across prose and CSV), the `created/` doctrine essays (about 38,000), the living chron guidance files (`chron/assignments/README.md` 772, `chron/blog/drafts.md` 1,902, `chron/sweeps.md` 2,334), `tools/README.md` (2,103) and `.claude/skills/**` (15,941). The dominant bloat in `CLAUDE.md` is project-specific operating detail and incident narrative sitting in the one file every session pays for: the budget-drs render exception and fragment params alone are 895 words, and a further 1,000 or so restate documents that web-tools or a budget-drs README already owns. Taken together, proposals 1, 2, 3, 5, 7 and 8 remove about 2,200 words (37%) from home's `CLAUDE.md`; proposals 4, 6, 7 and 10 remove about 3,900 from the READMEs; proposal 9 moves about 7,600 words of superseded doctrine from `living` to `record`. Proposals are ordered by words saved per unit of risk.

## 1. Move the budget-drs render routing out of CLAUDE.md

**Repo:** home

**Targets:** `CLAUDE.md:132-215` (the three paragraphs after "Render path" that begin "A page the budget-drs app frames", "The exception is observed", "Two candidates remain", "Meanwhile hand over", "A branch preview", "Two former limits", "`appendix-render` stays", "One level down").

**Kind:** link-to-owner

**Proposal:** Keep `CLAUDE.md:127-131` (private repo, so 🥏 toss in owner mode, `[new]` otherwise). Replace lines 132-215 with two sentences: "A page the budget-drs app frames is linked through the app: run `python3 ../web-tools/scripts/showing.py` and paste what it prints. While the app route renders an empty pane (web-tools SNAGS `app-frame-outruns-the-inliner`), hand over the framed page on its own with `#pkg=<id>` and say the app route is the broken one." Move anything in the fragment-param and headless-shot paragraphs that `projects/budget-drs/app/view/README.md` lacks into that README (it already carries the `SUBMITTAL_OPEN` params at lines 71-74 and the inliner mechanics and `data-inline-error` at lines 252-262).

**Rationale:** Every home session loads 895 words about one project's app shell, its inliner's byte count, a console diagnostic, and the `msTab` hash gap. A session doing chron, news or `me/` work never needs it, and a session doing budget-drs work reads the app README anyway. The "exception" paragraphs are an open bug report, which is what SNAGS is for, and SNAGS already has it verbatim.

**Evidence:** Duplicate 1, the diagnosis: `CLAUDE.md:153-176` and web-tools `docs/SNAGS.md:274-297` state the same 46 files, 9,692,313 bytes, `VIEWS` inline, the two candidates, and the identical console one-liner. Duplicate 2, the fragment params: `CLAUDE.md:204-215` and `projects/budget-drs/app/view/README.md:69-75` both list `?pkg=`, `?piece=`, `?track=`, `?diag=` and "every param present is forwarded". Duplicate 3, the showing rule: `CLAUDE.md:132-151` restates web-tools `CLAUDE.md` "Showing" (run `showing.py`, do not decide by reading). The paragraph's own text says it goes "when the cause is known", so it was written as temporary.

**Words removed:** about 850 of 895 (`sed -n 132,215p CLAUDE.md | wc -w` = 895).

**Inbound dependencies:** None mechanical. `grep` for `SUBMITTAL_OPEN`, `inlineRelativeDeps` and `app-frame-outruns-the-inliner` in living docs finds only `CLAUDE.md`, the view README, web-tools `SNAGS.md`, and two tracker tasks (out of scope, untouched). No script reads `CLAUDE.md`.

While editing the section intro, fix `CLAUDE.md:121`, which says the surfacing contract is "operated by `/caption`"; no `caption` skill exists in web-tools `.claude/skills/` or `docs/portable.csv`.

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

## 8. Move the Prose clarity block out of home's CLAUDE.md

**Repo:** home (and web-tools `docs/QUALIFIED-WRITING.md` if the owner chooses the merge)

**Targets:** `CLAUDE.md:37-66`.

**Kind:** link-to-owner

**Proposal:** Two options, and the choice is the owner's. (a) Replace the block with one line: "Prose clarity: the `google-style-clarity` skill (web-tools), loaded before any drafting or review pass." (b) If every-session placement is the point, move the seven principles and the table into web-tools `docs/QUALIFIED-WRITING.md`, which `/portable:default` already loads in every repo, merging the two rules that overlap (resolve pronouns, define jargon), and delete the block here. Either way home's `CLAUDE.md` loses it.

**Rationale:** The block is not home-specific. It says itself that it is "a repetition, not a second authority" of the skill. Its two most important principles already sit in `QUALIFIED-WRITING.md`, which every session loads, so home sessions carry three statements of "introduce before you refer": QUALIFIED-WRITING rule 1, this block's "Resolve pronouns", and the global `~/.claude/CLAUDE.md` "use common words in their common meanings". Web-tools and shortcut-tools sessions get none of the block, which is the inconsistency option (b) fixes.

**Evidence:** `CLAUDE.md:39-41` names the skill as the owner. web-tools `docs/QUALIFIED-WRITING.md` rules 1 ("Introduce before you refer") and 2 ("Use plain language ... pin terms to what you mean by them") against `CLAUDE.md:46-47`. The placement was chosen deliberately on 2026-08-28 (session record `web-tools-private/sessions/2026/08/2026-08-28-54923707.json`, turn at line 248): `CLAUDE.md` was picked because the session-hook channel was over its byte budget. That hook channel was retired on 2026-09-09 and the plugin skill channel replaced it, so the constraint that selected `CLAUDE.md` no longer holds.

**Words removed:** 482 from home `CLAUDE.md`; under option (b), about 300 added to `QUALIFIED-WRITING.md` after merging the overlap.

**Inbound dependencies:** None mechanical. The block is not linked from any other home file (grep for "Resolve pronouns" finds only `CLAUDE.md:46`).

**Risk:** Medium. The owner placed this on purpose, and the same 2026-08-28 turn flagged regressions in the compressed form (no citations, "strict technical editor" pushing toward over-application). Option (a) loses always-on placement; option (b) spends words in a file every repo loads.

## 9. Re-status the created/ doctrine that has been superseded, and stop citing it as current

**Repo:** home

**Targets:** `created/2026-06-27-constellation-architecture.md` (4,230 words, `status: living`), `created/2026-06-27-constellation-mechanics.md` (1,925, `status: living`), `created/2026-07-19-source-anchoring.md` (1,429, `status: draft; destined for web-tools/docs/SOURCE-ANCHORING.md once settled`); `CLAUDE.md:72` ("Full doctrine: ... constellation-architecture.md; mechanics ... constellation-mechanics.md").

**Kind:** restructure

**Proposal:** Set the two constellation documents to `status: record` (a dated snapshot of 2026-06-27 thinking) and point `CLAUDE.md:72` at `created/2026-07-23-organizing-the-constellation.md` for the living theory and web-tools `docs/MARKETPLACE.md` for the sync mechanism. The commit-discipline bullet at `CLAUDE.md:72` already states the surviving rules (small diffable source, gitignore-and-regenerate, LFS only for its narrow case, repo boundaries follow visibility, sync by pull), so nothing needs rescuing. Set `source-anchoring.md` to `status: superseded by web-tools skill source-anchoring` after confirming the skill carries its "Why parsimony lives inside" section and the worked-instances list; move either into the skill if it does not.

**Rationale:** A document marked `living` that describes a retired mechanism is worse than a record: `CLAUDE.md` sends every session to it as "full doctrine". Under the 2026-09-21 rule, a living claim that is wrong gets its sentence fixed; for 6,000 words about a mechanism that is gone, re-classing is the honest fix and costs one line each.

**Evidence:** `constellation-architecture.md:62-92` (Principle 3 and 4) prescribes "the same committed hook" that fetches conventions from the hub, "the fetch hook itself must be copied into each repo", and unpinned raw pulls; home's `CLAUDE.md:262-265` says conventions arrive through the plugin marketplace instead (migration record `chron/2026/07/2026-07-11-adopting-the-plugin-marketplace.md`). `constellation-mechanics.md` section 2 ("pull-hook vs subtree vs submodule") is the recipe for that retired hook. `source-anchoring.md` frontmatter names its own destination, and web-tools `skills/source-anchoring/SKILL.md` (920 words) now exists with the same premise, relation, chain, anti-patterns and tone sections.

**Words removed:** about 7,580 words leave the living doctrine set (4,230 + 1,925 + 1,429); nothing is deleted.

**Inbound dependencies:** `constellation-*` is linked from `CLAUDE.md`, `repos/home.md`, `repos/legal-data.md`, `organizing-the-constellation.md`, `chron/threads/repo-architecture.md`, `projects/budget-drs/app/workshop/DECISIONS.md` and several tracker tasks; all links keep resolving. `source-anchoring.md` is linked from `parsimony.md`, `favoring-the-mechanical.md`, `gold-sets.md`, `document-parsing-process.md`, `projects/doc-audit/*` and `chron/threads/source-anchoring.md`. `build-home-app.py` reads `created/` and shows `status`, so the app will display the new status.

**Risk:** Low for the constellation pair. Medium for source-anchoring until the skill is checked against the draft section by section.

## 10. Collapse tools/README.md bullets that narrate rather than describe

**Repo:** home

**Targets:** `tools/README.md:43` (the "Status markers are retired" bullet), `:48` (`duplicated-claims.py`), `:49` (the dead-link report), `:51` (`screenshot.mjs`), `:26-32` (the "Not swept" paragraph).

**Kind:** collapse-narrative

**Proposal:** Delete the markers bullet (it describes no tool; `verify-artifacts.sh` and `.paths.json` are covered in `CLAUDE.md`). Cut the dead-link bullet to: "Dead links: web-tools `scripts/dead-links.py`, run by `verify-artifacts.sh` via `hub_script()` for the cross-repo classes; the internal class is not gated." Cut `screenshot.mjs` to what it does, its two failure lines (`unvendored CDN misses`, `page errors`) and what each means, dropping the 2026-09-05 history. Cut `duplicated-claims.py` to its behaviour and scope (skills in, `.claude/agents/` out). Delete the "Not swept" paragraph, which records a one-time rename sweep.

**Rationale:** The file's stated job (line 3) is "what each does, and what it means when its output is wrong". The dead-link bullet spends most of its 317 words on how 25 links were fixed in August, which is a dated record's content.

**Evidence:** Dead-link bullet: the 8/10/3 split, the budget-wa hand-copy story and the "2 as of 2026-08-03" count are all history (`tools/README.md:49`). Markers bullet (`:43`) is about a convention, not a script. Word counts per bullet: dead-link 317, screenshot 303, duplicated-claims 127, markers 56; "Not swept" about 70.

**Words removed:** about 600.

**Inbound dependencies:** `CLAUDE.md:252` and `README.md` link `tools/README.md` as a whole; no anchor links into these bullets.

**Risk:** Low. The `screenshot.mjs` failure-reading advice is the one part worth keeping in full.

