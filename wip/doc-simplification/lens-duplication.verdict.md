# Verdicts: lens-duplication

## 1. The plugin delivery story, told three times with its history

**Verdict:** revise

**Checked:** Word counts hold: web-tools `CLAUDE.md:5` is 241, home `CLAUDE.md:12-30` is 281, `:116-124` is 73, `:287-293` is 48, shortcut-tools `CLAUDE.md:1-12` is 87. The rot is real. home `CLAUDE.md:17` says `/portable:default` "also reports this repo's frozen paths"; neither `.claude/skills/default/SKILL.md` nor any plugin or home hook mentions `.paths.json` or frozen paths. No `caption` skill exists in web-tools `.claude/skills/`, `skills/`, `docs/portable.csv` or the catalog, so home `CLAUDE.md:121` is wrong. `/markers` was retired on 2026-09-21 (`docs/SNAGS.md:1555-1560`), and no `markers` skill directory remains, so web-tools `CLAUDE.md:5` tells every session to run a command that does not exist. No test asserts the text of these paragraphs: `tools/test/claude-md.test.mjs` checks only the two showing pointers and the 1,600-word ceiling, and `invoke-default.test.mjs` uses stub files.

Two specifics need fixing. First, the web-tools replacement drops the `docs/venues.md` pointer with no decision, and `CLAUDE.md:5` is one of only three living links to that doc (`docs/inbound.md`, `docs/README.md`). `tools/build/docs-reach.mjs` stamps a doc `project` reach when `CLAUDE.md` names it, so dropping the link demotes it in `docs/docs.csv`. Keep the venues pointer, or record that it is deliberately demoted. Second, the home replacement loses the one diagnostic the paragraph carries: a reply without a caption or closing state means the prod failed. Keep that clause.

**Revised proposal:** As written, with two changes. web-tools `CLAUDE.md:5` keeps the doc-growth line and a venues line ("This sandbox is one venue among several: [docs/venues.md](docs/venues.md).") and deletes the `/markers` default. home `CLAUDE.md:12-30` becomes: "The portable conventions arrive through the `portable` plugin; run `/portable:default` when the session-start directive asks. There is no fallback channel, by design: a reply without a caption or closing state means the prod failed ([record](chron/2026/08/2026-08-26-the-injection-delivers-five-percent.md))." Drop the frozen-paths claim; it is false.

**Corrected words removed:** about 500 (web-tools ~140, home ~315, shortcut-tools ~45).

## 2. Marketplace mechanics restated in home, with a drifting hook count upstream

**Verdict:** revise

**Checked:** home `CLAUDE.md:262-301` is 319 words. The hook drift is real and the catalog is right: `.claude/skills/hooks/hooks.json` registers nine hooks (three SessionStart, two PreToolUse, two PostToolUse, one PostToolUseFailure, one Stop), matching the catalog description; `MARKETPLACE.md:60-63` lists eight and omits the sessions-store directive (`invoke-sessions.sh`). The same file has a second drift the lens missed: `MARKETPLACE.md:9` says "the 16 skills", and `jq '.plugins[0].skills'` lists 18. home `README.md:97` names `/web-tools` and `/caption`; neither exists. `claude plugin list` and per-directory status are in `docs/environment/extending.md:165-169`; `session-*.sh` discovery and the run-twice trap are at `extending.md:73,278-279`.

One specific is wrong. The fact the lens proposes to move up, "a plugin change lands one session late", is already upstream at `docs/environment/container.md:140-148`, stated as measured on one version. Moving a stronger version into `MARKETPLACE.md:14` would create a new copy that overstates the measurement. The shrunk home paragraph also drops two home-local items worth one clause each: `/tmp/refresh-portable.log` as the place to look when a skill seems older than upstream, and the link to `chron/2026/08/2026-08-27-plugin-marketplace-mechanics.md`.

**Revised proposal:** home `CLAUDE.md:262-301` shrinks as proposed, plus "When a skill seems older than upstream, read `/tmp/refresh-portable.log`; measurements are in [the 2026-08-27 record](chron/2026/08/2026-08-27-plugin-marketplace-mechanics.md)." Move nothing into `MARKETPLACE.md:14`; link `container.md` instead. In `MARKETPLACE.md`, replace both the eight-hook list at `:60-63` and the "16 skills" count at `:9` with pointers to the catalog. home `README.md:97` as proposed.

**Corrected words removed:** about 330 (home CLAUDE ~220, home README ~45, MARKETPLACE ~65).

## 3. The assistant identity table, preflight rule and batch rule, five copies

**Verdict:** revise

**Checked:** The table sits in web-tools `docs/surfacing-course.md:15-31`, web-tools `AGENTS.md:13-24` and home `AGENTS.md:9-21`. The lens reads the drift backwards on one row. The copies' "`antigravity/` reads as Gemini" is true: `lib/kits/assistant-mark.js:96-97` classifies `antigravity/` as Gemini, and `tools/test/assistant-mark.test.mjs:33` asserts it. The owner is the copy that lacks a true fact. The Codex note is not a contradiction: the owner records when the trailer was requested, and the copies state the current rule. web-tools also declares this repetition in its own registry: `docs/repetitions.csv:19-20` records `AGENTS.md` as a `copy` and `GEMINI.md` as a `pointer`, read by `tools/test/owners-registry.test.mjs`. The lens did not mention that registry.

The GEMINI cut is the weak part. The two `GEMINI.md` files exist because Gemini reads that filename, and the prefix and trailer lines were added after four unprefixed Gemini branches were read as human work (`surfacing-course.md:26`). No evidence shows Gemini follows a link from `GEMINI.md` into `AGENTS.md` and then a cross-repo URL. For home, the table would become a link into another repo, which a non-Claude agent may not follow. The lens's own risk note says this.

**Revised proposal:** Add the `antigravity/` fact to the owner's Gemini row. Keep the table in both `AGENTS.md` files, and have the web-tools pre-commit hook generate them from the owner, as it already does for the plugin copy of `surfacing-course.md`. Set the `docs/repetitions.csv:19` check column to that gate. In `surfacing-course.md:30`, replace the per-repo commands with "Run the preflight in the repo's `AGENTS.md`." In both `GEMINI.md` files, keep setup, preflight, prefix and trailer, and delete the operational-modes and em-dash lines, which `QUALIFIED-WRITING.md` and `CLAUDE.md` carry.

**Corrected words removed:** about 90 by hand (surfacing-course ~40, the two GEMINI files ~50). The tables stop being hand-kept rather than disappearing.

## 4. Render-link rules: "run showing.py" and the budget-drs frame bug, told in four places

**Verdict:** revise

**Checked:** The web-tools half breaks the suite. `tools/test/claude-md.test.mjs` asserts that web-tools `CLAUDE.md` contains `docs/showing-mechanisms.csv` and `docs/showing.md`, and both links live only at `CLAUDE.md:13`, inside the section the lens deletes. `docs/repetitions.csv` also records that section as a checked paraphrase. The home half is 931 words (`sed -n 127,215p | wc -w`), and the snag at web-tools `docs/SNAGS.md:274-297` carries the 46 files, 9,692,313 bytes, the console line and both candidates, as claimed.

Three specifics are wrong. First, the proposed link `SNAGS.md#app-frame-outruns-the-inliner` does not resolve: the heading at `SNAGS.md:274` is `### app-frame-outruns-the-inliner: the shell draws and every view is empty`, so GitHub's anchor is the full slug, and no explicit anchor exists. Second, the conflict the lens left open has an answer. home `CLAUDE.md:187-196` is correct: home `tools/screenshot.mjs:15,319-359` answers `api.github.com` contents reads from sibling checkouts. `projects/budget-drs/app/view/README.md:302-304` ("a headless shot of one comes back empty") is stale. Third, the 70-word replacement drops facts the view README does not hold: grep of that README for `__ref`, `fetchEmbedText`, `__embedOpen`, `msTab` and `appendix-render` returns nothing, and it has no `#pkg=` fragment form for the standalone page.

**Revised proposal:** web-tools `CLAUDE.md:11-22`: cut the history ("This section used to be 1,589 words ... It happened again on 2026-08-22") and keep the two pointers the test requires, the `npm run showing` line, and the honesty rule, in about 70 words. home: adopt the 70-word bullet with the full-slug anchor, and in the same change move into the view README the `__ref` override, `?tab=` through `embedView` and `window.__embedOpen`, the `msTab` gap, the headless-shot capability (replacing the stale line at `:302-304`), `appendix-render`'s gating, and the `#pkg=<id>` fragment.

**Corrected words removed:** about 950 net in the instruction files (home ~860, web-tools ~100), of which about 150 words reappear in the view README.

## 5. The prose-clarity block in home CLAUDE.md is a compressed copy of a library skill

**Verdict:** reject

**Checked:** The block is 482 words (`sed -n 37,66p | wc -w`) and does name `google-style-clarity` as its owner. The lens's key claim fails: "the always-on half of its content already arrives through `QUALIFIED-WRITING.md`". That file is 224 words and four rules. It covers pronoun referents, plain language and noun-phrase qualification. A grep for `should`, `guarantee`, `ensure`, `metaphor`, `filler` and `simply` in it returns nothing. So four of the block's seven principles (literal language, grounded claims, must versus should, filler) and its execution rules arrive in no always-on channel. `google-style-clarity` is not in the plugin roster, so the replacement turns always-on rules into on-demand ones. The block's placement reads as deliberate: it opens "Before drafting, reviewing or rewriting any prose, apply the pass below", which only works if the pass is in context. Git history here is too shallow to date the decision, so the owner's intent cannot be ruled out.

The lens's alternative, folding the seven principles into `QUALIFIED-WRITING.md` so every repo gets them, is a policy change for the owner, not a duplication cut.

**Corrected words removed:** 0.

## 6. Four verbatim copies of library skills parked in home/projects/doc-audit

**Verdict:** keep

**Checked:** Word counts match: 2,792/2,792, 934/934, 1,706/1,706, 918/920. `diff -w` shows only added blank lines for three pairs, and for `source-anchoring` one sentence at home `:61` where the home copy has em dashes and the skill has commas. No `.py`, `.sh`, `.json` or `.csv` in home references the four paths. `projects/doc-audit/` is on `tools/lint-conventions.ignore:14`, which is why the em dash was never caught. Two inbound links the lens listed only by file need edits too: `projects/doc-audit/full-picture.md:66` (hand-written, not generated, per its frontmatter) and `projects/doc-audit/source-manifest.md:43`. The `created/2026-07-19-source-anchoring.md` links in `created/` and `chron/threads/source-anchoring.md` point at a different file and are unaffected.

**Corrected words removed:** about 6,350.

## 7. home README.md restates CLAUDE.md, tools/README.md and .claude/skills/README.md, and has gone stale doing it

**Verdict:** revise

**Checked:** Section counts hold: Structure prose 973, Skills 361, Tools 1,067, Style 42. The stale claims are real: `created/assignments` does not exist, `tools/stale-flags.sh` does not exist, and `README.md:123` credits the retired `/markers`. The list of entries `tools/README.md` lacks is one short: `.claude/hooks/session-news-fetch.sh` is also named only in the root README. No tool reads the root README's sections; `generate-full-picture.sh:79` names the file only.

The folder cut goes too far. `CLAUDE.md:3-5` assigns the README "what this repo is and why it is shaped this way", and the folder paragraphs carry that "why", which CLAUDE.md does not: why `chron/dump/` takes anything (classifying at capture costs a decision too early), why chron files never move, `news/` as the external twin of `chron/`. Those sentences are the README's own content, not copies.

**Revised proposal:** Cut the Tools section to a pointer after moving the six missing entries (the five named plus `session-news-fetch.sh`). Cut Skills and Style as proposed. In the folder paragraphs, delete the restated mechanics (filename shapes, thread entry format, promotion steps, blog regeneration) and keep one or two sentences of rationale per folder, with a link to `CLAUDE.md#where-things-go`. Fix the tree at `README.md:60`.

**Corrected words removed:** about 1,800 (Structure ~450, Skills ~320, Tools ~1,000 net, Style 42).

## 8. home's tracker section restates the tasks skill, TRACKER.md and tracker/README.md, and keeps a rule for a retired artifact

**Verdict:** revise

**Checked:** The section is 524 words. The merge-guide opt-out is dead weight, but the bullet also carries the only statement of a wrap-up sequence anywhere in the estate. A grep for `wrap-up`, `per-repo setting` and `merge guide` in `SURFACING.md`, `surfacing-course.md` and `default/SKILL.md` finds only a trigger word in the skill description. Meanwhile `tasks/SKILL.md:270-273` says the `default` skill "owns ... the merge guide, and wrap-up", web-tools `CLAUDE.md:26` cites "the conventions' wrap-up step 1", and home `CLAUDE.md:216` cites "the conventions' two per-repo settings". All three point at an owner that no longer states them. Deleting the bullet without a home for the sequence removes the last copy.

The lens also proposes deleting the tracker clause from `CLAUDE.md:35` "since the skill owns it". The skill owns task files and `board.md` on `main`, but not `trackers.md`, which is home's generated registry. That file name must stay.

**Revised proposal:** Shrink the section to about 90 words as proposed, and keep the wrap-up sequence as one line ("Wrap-up here: preflight merge check, per-session refreshes, tracker task updates, final PR body sync, mark ready") until an upstream owner states it. Trim `CLAUDE.md:35` to "Tracker state, including `trackers.md`, commits to `main` as you go." Separately, the dangling upstream pointers need an owner decision (see Missed).

**Corrected words removed:** about 400.

## 9. shortcut-tools CLAUDE.md restates the install, replace and Back Tap rules the shortcut-links skill owns

**Verdict:** revise

**Checked:** `CLAUDE.md:109-180` is 648 words. The copies disagree, and the skill is the current one. `skills/shortcut-links/SKILL.md:38-50` prefers `Library-Fetch` (pre-signed) and calls `Library-Import` "the older route". shortcut-tools `CLAUDE.md` never mentions `Library-Fetch` and still says "Generate a full plist for anything new" through `Library-Import`. `workflows/library-fetch.json` and `tools/plist.py:359-376` (`--fetch`) confirm the skill. The Back Tap text and `prefs:` table match.

The 80-word replacement drops local facts the skill lacks. A grep of the skill for `Chains view`, `WFWorkflowTypes`, `file-level`, `http://` and `worker` returns nothing. Those facts are: only a plist delivers file-level settings, and a paste install prints the toggles to set by hand; the signing worker is third-party plain `http://`, acceptable only because nothing holds a secret; and "the Chains view picks between them from the manifest; hand over `?name=<Chain>`" (`CLAUDE.md:129-130`).

**Revised proposal:** As proposed, with the directive line kept first, plus a local paragraph of about 60 words carrying the three facts above. Or move them into `shortcut-links/SKILL.md` in the same change. Drop the "Wrong 2026-08-26" paragraph.

**Corrected words removed:** about 500.

## 10. web-tools-private proposals/README.md restates the manifest doc's Proposals section

**Verdict:** keep

**Checked:** `proposals/README.md` is 865 words and `errands/README.md` is 108. `docs/manifest.md:363-557` carries every item in the README: the kinds including `unset-json-field` and `delete-issue`, `ref`, the signature fields, `expectSha` and "Apply anyway", `expectComments` and `expectTitle`, and the `summary`/`why`/`caution` split (`manifest.md` section lines 184-193). The owner is also ahead: it documents `deliver` and PR delivery, which the README lacks. The anchor `#proposals-proposalspending--proposalsapplied` matches GitHub's slug for the heading at `manifest.md:363`. No file in web-tools or web-tools-private links `proposals/README`. Private to public links resolve.

**Corrected words removed:** about 740.

## Missed

**A second stale roster in home.** `home/.claude/skills/README.md:113-131`, the "Pulled (not committed here)" table (about 190 words), restates the plugin roster the lens's proposal 2 targets. It lists `/caption`, which does not exist. It says `/load-skill` reaches "35 skills, listed in `skills/manifest.csv`"; the manifest has 45 rows and `skills/` has 47 directories. It describes `/portable:default` as loading only `SURFACING.md`, omitting `QUALIFIED-WRITING.md`. It should become a pointer to `docs/portable.csv` in the same change as proposal 2.

**The wrap-up sequence has no owner, and three documents cite one.** web-tools `CLAUDE.md:26`, home `CLAUDE.md:216` and web-tools `.claude/skills/tasks/SKILL.md:270-273` all defer to a conventions-level wrap-up or merge guide. None of `SURFACING.md`, `surfacing-course.md` or `default/SKILL.md` states one. The only statement is home's merge-guide bullet (`CLAUDE.md:107`). This is the reverse of duplication, a pointer to nothing, and it decides proposal 8.

**The estate already has a repetition registry.** web-tools `docs/repetitions.csv` and `docs/owners.csv`, held by `tools/test/owners-registry.test.mjs`, declare which copies are intended and how each is checked. The lens neither used it as a source nor lists it as a dependency. Proposals 3 and 4 touch rows in it (the assistant table rows at `:19-20`, and the showing-mechanisms paraphrase in `CLAUDE.md`). Any accepted cut should update its row in the same commit, and future duplication sweeps should start from it.

**MARKETPLACE.md miscounts skills as well as hooks.** `docs/MARKETPLACE.md:9` says 16 skills against 18 in the catalog, in the same file whose line 9 says it "deliberately does not enumerate the roster". Folded into proposal 2's revision above.
