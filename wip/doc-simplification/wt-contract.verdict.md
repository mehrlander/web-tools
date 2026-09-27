# Verdicts: wt-contract

## 1. Collapse the delivery paragraph in web-tools CLAUDE.md, and drop the dead `/markers` default

**Verdict:** keep

**Checked:** `CLAUDE.md:5` is 241 words and names `/markers`. No `markers` directory exists under `.claude/skills/`, and the plugin's `skills` array in `.claude-plugin/marketplace.json` lists 18 skills without it. `.claude-plugin/marketplace.json:45` still carries the `markers` keyword. `docs/estate-span.md:41` records the retirement. `tools/test/claude-md.test.mjs` asserts only the two showing links and the 1,600-word ceiling. No script, hook or test matches the "one-line defaults" text. `tools/build/docs-reach.mjs` derives `project` reach from links in `CLAUDE.md`; the proposal keeps the venues, portable.csv and MARKETPLACE links, and `surfacing-course.md` keeps its reach through `SURFACING.md:35`, so no doc changes reach.

**Corrected words removed:** about 140 of 241. The history sentences are about 95 words and the `/markers` clause about 10; the replacement text costs back roughly what the tightening saves.

## 2. Replace the build-on-commit section of CLAUDE.md with the rules and a link

**Verdict:** revise

**Checked:** `CLAUDE.md:32-48` is 558 words and `:24-26` is 75, as stated. `tools/README.md` owns setup (`:54`), `artifacts:refresh` (`:56`), the pre-build (`:169`), the refresh model (`:267`), `--no-verify` (`:348`), server-side writes skipping hooks (`:377-384`) and the `merge --continue` path (`:343`). `docs/environment/extending.md:12` repeats the merge path. The browser-free naming rule is also at `docs/SNAGS.md:520`. The package-lock caveat is in `.github/workflows/test.yml:93` as a comment. Two inbound pointers were missed: `.githooks/pre-commit:15` says `(see CLAUDE.md "Per-session refresh")` and `docs/SNAGS.md:2048` cites the same heading. One fact has no other owner: that `test.yml` exists and runs `npm test` as a PR check. `tools/README.md:377` says "no CI" in the deploy sense, which reads as a contradiction once CLAUDE.md stops saying otherwise.

**Revised proposal:** As written, plus: keep the heading "Per-session refresh" or repoint `.githooks/pre-commit:15` and `docs/SNAGS.md:2048` in the same change. Add one line to rule (d): "`.github/workflows/test.yml` runs `npm test` on every PR." Move the package-lock caveat and the CI sentence into `tools/README.md` beside `:377`, and reword that line so "no CI" means no deploy build.

**Corrected words removed:** about 450 of 633.

## 3. Shrink the default skill to its instruction, and drop the provenance headers from the two contract docs

**Verdict:** revise

**Checked:** `SKILL.md:17-27` is 124 words. The fallback span is smaller than claimed: the curl block (`:36-40`) is about 9 words and the MCP line (`:48-49`) 17; lines `:42-46` are the surfacing-course sentence the proposal keeps. `SURFACING.md:3-8` is 57 words and `QUALIFIED-WRITING.md:3-8` is 56. All three copies are byte-identical (`cmp`). `invoke-default.sh:86` matches `## Surfacing primitives` and `# Qualified writing`. `surfacing-manifest.test.mjs:25` splits on `\n---`; with no later `---`, removing line 10 is safe. But the headers carry rules stated nowhere else: `SURFACING.md:3` scopes the rules ("when chat is the only output channel"), and `QUALIFIED-WRITING.md:3-4` lists what the rules govern, which `injected-docs.test.mjs` records as "four rules and a scope line". The docs are also read without the skill: `shortcut-tools/CLAUDE.md` and home `CLAUDE.md` link them directly, so "Local `CLAUDE.md` rules override these defaults" is not redundant for that reader. The claim that `invoke-default.sh` comments carry the 2026-09-13 closed-loop history does not hold: a grep for "closed loop" and "2026-09-13" in the hook finds nothing. Git holds it, which is enough.

**Revised proposal:** Do the `SKILL.md` cuts as written, keeping "stop only if both documents are demonstrably in context". In each doc, cut the canonical-source and byte-matched-copy sentences, and keep the scope sentence plus "Local `CLAUDE.md` rules override these defaults." Keep the `---`.

**Corrected words removed:** about 190 per session (skill about 135, headers about 55).

## 4. Remove the duplicated wake and merge rules inside SURFACING.md, and make its showing line portable

**Verdict:** revise

**Checked:** `SURFACING.md:31` and `:65` both say a base-branch move gets no reply; confirmed. `npm run showing` exists only in `web-tools/package.json:36`; no other repo defines it. But the merge and close sentences on `:65` are not duplicates. They are the exception to `:31`'s rule: a merge event is a wake that changes no files, and `:31` alone says such a wake gets no reply. Cutting them makes the two rules contradict. `injected-docs.test.mjs` sets an 1,800-word ceiling; this change only helps.

**Revised proposal:** Delete "A base branch that moved is not work. If a wake changes nothing, do not reply." and "an event is the only wake". Merge the two PR sentences into one: "A merge or an unmerged close still gets 🟣 or 🔴, even with no files changed." Replace `:57` as proposed.

**Corrected words removed:** about 35.

## 5. Move the assistant attribution table out of the surfacing course

**Verdict:** revise

**Checked:** `surfacing-course.md:15-31` is 342 words. The drift is real: `AGENTS.md:19` has the `antigravity/` note and the course does not; the Codex notes differ (`course:22` vs `AGENTS.md:18`); `lib/kits/assistant-mark.js:102,105` accepts `chatgpt/` and `-grok`, which no copy mentions. `docs/repetitions.csv:19` registers the copy. `course:4` and `pr-subscribe-hint.sh:90` both say SURFACING.md is "injected", which is stale. Three problems with the plan. First, the two rules at `course:28-31` (preflight, batch output) say they hold "for every assistant", Claude included, and the course is the only place a Claude session meets them: `CLAUDE.md` never mentions `npm run preflight`. Moving them to `AGENTS.md` removes them from Claude sessions. Second, `SURFACING.md` ships in the plugin, and `portable-manifest.test.mjs:123-140` fails a relative link to a file that does not ship; the repoint of `SURFACING.md:35` must be an absolute hub URL. Third, home `CLAUDE.md` declares itself self-sufficient and home `AGENTS.md` points non-Claude agents there; replacing home's table with a cross-repo link leaves a home-only checkout without it. Missed inbound: `lib/ops/session-menu.js:69` cites the course as the declarer of the prefixes.

**Revised proposal:** Make web-tools `AGENTS.md` the owner of the table and the unclassified rule, adding the `chatgpt/` and `-grok` aliases the classifier accepts. In the course, replace `:15-26` with one pointer line and keep `:28-31` as two short bullets without the Gemini statistics. Keep home `AGENTS.md`'s copy, flip its "change it there first" pointer to web-tools `AGENTS.md`, and register it in `repetitions.csv`. Repoint `SURFACING.md:35` with an absolute URL, `SNAGS.md:246`, and the `session-menu.js` comment. Fix the "injected" string in `course:4` and `pr-subscribe-hint.sh:90`.

**Corrected words removed:** about 260 from the course, none from home.

## 6. Collapse the APP.md name split to a rule and a table

**Verdict:** keep

**Checked:** `APP.md:13-106` is 1,021 words, `:24-99` is 870, Provenance is 89 (`wc -w` on the spans). The counts are already stale: `manifest-fields.csv` now has 75 rows, 69 with `show-repo` in `consumer`, against "55 of its 58" at `:18`. The doc contradicts itself: `:24-27` says `app-routes.csv` holds no `show-repo` key, and `:54` lists `app-routes.csv` as still naming the shell. The specimen's route-registry row (`APP_living_spec_replacement.md:28`) is wrong, as the proposal says. The tests that name `docs/APP.md` use it as an address fixture only. One correction to the dependency list: `CLAUDE.md:9` does not "stay accurate". It says show-repo sits on "files, routes, and the tracker project", and "routes" is the claim `APP.md:24` retracts. Fix it in the same change. `docs/README.md:20` and `docs/show-repo.md:7` describe the section and stay true.

**Corrected words removed:** about 940.

## 7. Cut the restated mechanisms from showing.md

**Verdict:** revise

**Checked:** `showing-mechanisms.csv:4` holds the FAB-from-main fact in `misses` and the never-pin-the-shell rule in `trap`; confirmed. `routes-manifest.test.mjs:253` sets the 1,500 ceiling against 1,490 words, and `:271` forbids repeated paragraphs. `scripts/showing.py:34` cites the "plausible and wrong" failure; the proposal keeps it. But `showing.md:38` carries two facts no row has: the renderer stamps `window.__fabHosted` so the inner FAB declines to mount, and the FAB's own `?use=`-ignored check does not fire, so nothing reports the mismatch. The second is the relation between the invariant section and the toss row, which is the kind of prose the test says stays. The proposal also lists `:32-36` and `:67-69` as targets without saying what happens to them.

**Revised proposal:** As written, but keep one sentence from `:38`: "The renderer stamps `window.__fabHosted` so the framed page's FAB declines to mount, and the `?use=`-ignored check does not fire, so a stale FAB through a 🥏 link reports nothing." Leave `:34-36` (depth-2 attribution) and `:67-69` alone.

**Corrected words removed:** about 380.

## 8. Stop MARKETPLACE.md enumerating what the catalog already declares

**Verdict:** keep

**Checked:** `MARKETPLACE.md:60` says "Eight pieces"; `hooks.json` registers nine scripts, the ninth `invoke-sessions.sh`; the catalog says nine. A second drift the reader missed: `MARKETPLACE.md:9` says "the 16 skills explicitly listed", and the catalog lists 18 (`tend` and `notes` among them). That is the same failure and strengthens the case. No test reads the file's content (`map-view.test.mjs:233` uses the path; `owners-registry.test.mjs` names it in comments). The spans are smaller than stated: the table rows are about 118 words, not 192, since `:12` and `:14` are kept.

**Corrected words removed:** about 220.

## 9. Fix and shorten venues.md

**Verdict:** revise

**Checked:** `docs/CONVENTIONS.md` does not exist; `venues.md:8` cites it. `claude-md.test.mjs:41,53` sends a failing session to the same missing file. `:3-9` is about 96 words and `:60-67` about 82. The proposal names `:17-20` as a target and then does nothing with it. It also missed a second false claim: `venues.md:11-12` says "Here and in the tracker's `venue:` tag". `docs/TRACKER.md` defines `runner:` (`:102`) and no `venue:` tag, and the `runner:` section at `:60-67` itself says the tag has not changed. The document contradicts itself.

**Revised proposal:** As written, plus rewrite `:11-15` so it names one field called `venue` (the errand's `run.venue`) and states that the tracker has only `runner:`. Leave `:17-20` alone. Fix the `CONVENTIONS.md` citation in `claude-md.test.mjs` in the same change.

**Corrected words removed:** about 170.

## Missed

**CLAUDE.md's showing section is narrative too.** `CLAUDE.md:13-22` is 172 words, and most of it is history: "This section used to be 1,589 words", "It happened again on 2026-08-22". The rule is: run `npm run showing`, paste its line, and follow the honesty rule. The only test constraint is the two links (`claude-md.test.mjs:30-35`). About 50 words keep both links and the rule, saving about 120 words at session start.

**CLAUDE.md's guide-PR paragraph describes a transition that is over.** `CLAUDE.md:30` is 92 words. It covers sessions that predate a 2026-07-10 toggle, which cannot exist now. It orders deletion of stray `BRANCH-GUIDE.md` files, and none exist in any of the four repos (`find`). "Body sync is manual; no hook or CI tracks it" repeats `surfacing-course.md:34-35`. One sentence does it: "Draft PRs open on first push; in an added repo, open the draft through the GitHub MCP." That saves about 70 words at session start.

**`CLAUDE.md:9` is wrong, not just long.** It puts show-repo on "routes", which `APP.md:24` retracts. Fold this into proposal 6.

**Stale "injected" claims beyond proposal 5.** `docs/docs.csv:9` types `SURFACING.md` as `injected`, and `surfacing-manifest.test.mjs:16-18` and `portable-manifest.test.mjs:109,118` still describe injection and a retired `CONVENTIONS.md`. These are comments and a registry value rather than loaded text, so the fix is small. It belongs in the same change as proposal 5's string fixes.
