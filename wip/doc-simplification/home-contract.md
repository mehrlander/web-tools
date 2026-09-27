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

