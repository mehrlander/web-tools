# Lens: cross-repo duplication

## Summary

This lens swept web-tools, home, shortcut-tools and web-tools-private for one rule or fact stated in more than one place. The method was a 10-word shingle comparison across every top-level document, `docs/`, skill and README in the four repos, plus home's own `tools/duplicated-claims.py`, then a read of each hit. Ten clusters survive. The largest single cut is mechanical: four files in `home/projects/doc-audit/` are byte-for-byte copies (modulo whitespace and one em dash) of web-tools library skills, about 6,350 words. The largest instruction-file cut is home `CLAUDE.md`, where the render-path exception, the prose-clarity block, the plugin delivery history, the marketplace mechanics and the tracker section restate owners that already exist, about 2,300 words together. Several clusters also show the cost of the copies: they have already drifted. The assistant table's Codex and Gemini notes differ between the owner and its two copies; `MARKETPLACE.md` counts eight plugin hooks where the catalog lists nine; home `README.md` still describes the retired `/markers` skill, a `created/assignments/` folder that does not exist, and a `/caption` skill; and web-tools `CLAUDE.md` tells every session to run `/markers`, which was retired on 2026-09-21. Estimated total removed across the ten proposals: about 13,100 words.

## 1. The plugin delivery story, told three times with its history

**Repos:** web-tools, home, shortcut-tools.

**Copies:**
- web-tools `CLAUDE.md:5` (241 words): the `invoke-default` hook, `/portable:default`, the `@`-import cut on 2026-09-12 and why, the `pr-subscribe-hint` channel for `surfacing-course.md`, and "four one-line defaults".
- home `CLAUDE.md:12-30` (281 words): the same hook and command, plus the retired `SessionStart` injection hook and the same `@`-import retirement story, citing web-tools #652.
- home `CLAUDE.md:116-124` (73 words): "loaded by `/portable:default` and operated by `/caption`", and the 2026-09-10 move of the course.
- home `CLAUDE.md:287-293` (48 words): "Availability is not invocation ... which is why the Working style rule above names `/portable:default` explicitly."
- shortcut-tools `CLAUDE.md:3-12` (85 words): the same hook and command, and "A web-tools checkout is not delivery and has not been since 2026-09-12, when that repo cut the `@`-import".

**Owner:** the `default` skill itself (`web-tools/.claude/skills/default/SKILL.md`) for what loads, and `web-tools/docs/MARKETPLACE.md` for the channel. The retirement history already has dated owners: `home/chron/2026/08/2026-08-26-the-injection-delivers-five-percent.md` and web-tools PR #652.

**Kind:** restated rule plus incident narrative.

**Proposal:** Each repo keeps one sentence and drops the history.
- web-tools `CLAUDE.md:5` becomes: "Conventions arrive through the `portable` plugin: its `invoke-default` hook prods every session, including this one, to run `/portable:default`. If they are missing here, the prod is broken; see [docs/MARKETPLACE.md](docs/MARKETPLACE.md). [docs/surfacing-course.md](docs/surfacing-course.md) arrives separately, through the `pr-subscribe-hint` hook, when a PR opens." Keep the doc-growth test ("ask whether the app derives it, the suite enforces it, or another document owns it") as its own line. Delete the `/markers` default outright.
- home `CLAUDE.md:12-30` becomes: "The portable conventions arrive through the `portable` plugin; run `/portable:default` if the session-start directive asks. There is no fallback channel, by design ([record](chron/2026/08/2026-08-26-the-injection-delivers-five-percent.md))."
- home `CLAUDE.md:116-124` keeps "Portable and not restated here: [SURFACING.md](...) and, when a PR is open, [surfacing-course.md](...). Substitute `mehrlander/home` into their URL templates." Drop "operated by `/caption`".
- home `CLAUDE.md:287-293`: delete; it only points back at the bullet above.
- shortcut-tools `CLAUDE.md:3-12` becomes: "Working rules for this repository, on top of the portable conventions, which the `portable` plugin loads through `/portable:default`. What follows is specific to this repo, and the first section governs every design decision made here."

**Rationale:** The mechanism is one sentence and every repo states it. The two paragraphs of "why the import was cut" explain a decision to a reader who can no longer make the mistake: the import is gone from web-tools `CLAUDE.md`, so nothing needs defending. The copies have already rotted. home `CLAUDE.md:17` says invoking `/portable:default` "also reports this repo's frozen paths"; `default/SKILL.md` contains no mention of frozen paths or `.paths.json`. home `CLAUDE.md:121` names a `/caption` skill that no plugin ships (`.claude-plugin/marketplace.json` lists 18 skills, none named `caption`). web-tools `CLAUDE.md:5` says "run `/markers` before marking or editing near frozen areas" and says four defaults "ride with the contract"; `/markers` was retired on 2026-09-21 (`web-tools/docs/SNAGS.md:1555-1560`), and none of the four defaults appears in `default/SKILL.md`, `SURFACING.md` or `QUALIFIED-WRITING.md` (grep for `markers`, `venue`, `hypothetical`, `link instead` returns nothing), so they ride with nothing.

**Evidence:** `grep -n "invoke-default\|portable:default\|@-import"` across the four repos' top-level docs returns the locations above, `web-tools/CLAUDE.md:78` (an unrelated note that `docs/environment/` is not imported), and `web-tools/docs/SNAGS.md:357-371` (a snag, which stays) and `home/me/README.md:41` (a one-line pointer, which stays).

**Words removed:** about 600 (web-tools ~190, home ~345, shortcut-tools ~50).

**Inbound dependencies:** None to the paragraphs themselves. The chron entry and PR #652 remain as the record and stay linked from home.

**Risk:** Low. The one behavior that matters, "if conventions are missing, the prod is broken, do not paper over it", survives as a sentence in web-tools. The four "one-line defaults" need a decision: either put the two live ones (doc-growth test, venues) into `default/SKILL.md` so they actually travel, or admit they are web-tools-local.

## 2. Marketplace mechanics restated in home, with a drifting hook count upstream

**Repos:** home, web-tools.

**Copies:**
- home `CLAUDE.md:262-301` (319 words, section "Cross-repo conventions (web-tools)"): the `extraKnownMarketplaces`/`enabledPlugins` subscription, version pinning, the marketplace clone versus plugin cache, `claude plugin list` as the one command that shows a load failure, per-directory status, `session-*.sh` discovery by the dispatcher.
- web-tools `docs/MARKETPLACE.md:14` (no `version`, tracks the tip), `:25-39` (the same settings JSON), `:58-67` (the hooks that ship).
- web-tools `docs/environment/extending.md:165-171` (`claude plugin list` is the command that shows a load failure; status is per-directory; the cache path `~/.claude/plugins/cache/<marketplace>/<plugin>/<sha>/`), `:73` (the dispatcher discovers `session-*.sh` by filename).
- web-tools `docs/environment/container.md:170` (`refresh-portable.sh`).
- home `README.md:97` (Skills section): restates the subscription and lists what `portable@web-tools` brings: "`/web-tools`, `/caption`, `/load-skill`, `/show-repo`, `/tree`, and `/tasks`".
- Inside web-tools: `docs/MARKETPLACE.md:60-63` enumerates "Eight pieces" that run on their own; `.claude-plugin/marketplace.json` `description` enumerates "nine hooks".

**Owner:** `web-tools/docs/MARKETPLACE.md` for the channel, `web-tools/docs/environment/extending.md` for the measured mechanics, and `.claude-plugin/marketplace.json` for the roster.

**Kind:** restated mechanics, restated roster.

**Proposal:**
- home `CLAUDE.md:262-301` shrinks to three sentences: "Portable skills and hooks arrive through the web-tools plugin marketplace, subscribed in `.claude/settings.json`; the channel is [MARKETPLACE.md](https://github.com/mehrlander/web-tools/blob/main/docs/MARKETPLACE.md) and its failure modes are [extending.md](https://github.com/mehrlander/web-tools/blob/main/docs/environment/extending.md). This repo declares no `SessionStart` hooks; add a `.claude/hooks/session-*.sh` file and the plugin's dispatcher runs it. `plugin_script()` in `tools/verify-artifacts.sh` resolves plugin scripts by preferring the newer of the marketplace clone and the plugin cache." Move the one fact not already upstream, "a session's hooks run from the previous pin, so a plugin change lands one session late", into `MARKETPLACE.md:14`.
- home `README.md:97`: drop the roster sentence; replace with "General skills arrive through the web-tools plugin marketplace; see [portable.csv](https://github.com/mehrlander/web-tools/blob/main/docs/portable.csv)."
- web-tools `MARKETPLACE.md:60-66`: replace the enumerated list with "The hooks that run on their own are listed in the catalog's `portable` description. They ship in the plugin because ..." and keep the reason.

**Rationale:** `MARKETPLACE.md:9` already says "This file deliberately does not enumerate the roster: the catalog is the definition", and then `:60` enumerates the hooks anyway. The two enumerations disagree (eight versus nine; the catalog adds the sessions-store directive). home's README roster names `/web-tools` and `/caption`, neither of which is in the catalog's 18 skills. Each roster copy is a count that someone has to remember to update, and none of them did.

**Evidence:** `grep -rln "plugins/cache\|marketplaces/web-tools"` finds only `extending.md`, `delivery.json`, `MARKETPLACE.md` and home `CLAUDE.md`. `jq '.plugins[0].skills'` on the catalog lists 18 entries without `caption` or `web-tools`.

**Words removed:** about 330 (home CLAUDE ~240, home README ~40, MARKETPLACE ~50).

**Inbound dependencies:** home `CLAUDE.md:293` points at this section ("the Working style rule above"); proposal 1 removes that line. The chron record `2026-08-27-plugin-marketplace-mechanics.md` stays and can be linked from the shrunk paragraph.

**Risk:** Low. The marketplace clone versus plugin cache distinction is the one hard-won fact; it survives as the `plugin_script()` sentence and belongs in `extending.md` if it is not already there (it is not: `extending.md` names the cache path but not the clone, so move that one sentence up rather than lose it).

## 3. The assistant identity table, preflight rule and batch rule, five copies

**Repos:** web-tools, home.

**Copies:**
- web-tools `docs/surfacing-course.md:15-31` (342 words): the four-row table, the unclassified rule, preflight for both web-tools and home, and the batch-output rule.
- web-tools `.claude/skills/default/surfacing-course.md`: generated copy, staged by `.githooks/pre-commit:288`. Not a duplication to fix.
- web-tools `AGENTS.md:9-26` (286 words total file): the table ("repeats the one surfacing-course owns; change it there first"), preflight, batch output.
- home `AGENTS.md:9-28` (317 words total file): the same table, home preflight, batch output.
- web-tools `GEMINI.md` (205 words) and home `GEMINI.md` (165 words): setup, preflight, branch prefix, trailer, operational modes, no em dashes.
- `npm run setup` once per checkout: web-tools `CLAUDE.md:42`, `AGENTS.md:7`, `GEMINI.md:8`.

**Owner:** `web-tools/docs/surfacing-course.md#assistant-identity-and-attribution` for the table and the two rules. Each repo's `AGENTS.md` for its own preflight commands.

**Kind:** restated table, inverted ownership (a web-tools doc stating home's commands).

**Proposal:**
- web-tools and home `AGENTS.md`: delete the table. Replace with "Identify your work by branch prefix and commit trailer, per [the table](.../surfacing-course.md#assistant-identity-and-attribution). Batch output goes to home `projects/text/runs/`, never a PR against the documents it proposes changes to." Keep each repo's numbered preflight list, which is local.
- `surfacing-course.md:30`: drop the command lines for both repos and say "Run the preflight in the repo's `AGENTS.md`." It keeps the Gemini evidence sentence, which is the reason for the rule.
- Both `GEMINI.md`: reduce to "Follow [AGENTS.md](AGENTS.md), which holds setup, preflight and your branch prefix and trailer." The em-dash rule is already in `QUALIFIED-WRITING.md:12`, loaded every session.

**Rationale:** The copies disagree already. The owner's Codex row says "Requested 2026-09-20; Codex commits carried no trailer before then"; both `AGENTS.md` copies say "Include trailer on all commits". Both `AGENTS.md` copies add "`antigravity/` reads as Gemini", which the owner does not say. So either the Activity view's classifier accepts `antigravity/` and the owner is wrong, or it does not and the copies are wrong. The "change it there first" disclaimer admits the problem instead of fixing it. The owner also states home's preflight commands, which means a change to `home/tools/verify-artifacts.sh` usage needs an edit in web-tools.

**Evidence:** `grep -rn "Codex <codex@openai.com>"` returns `web-tools/AGENTS.md:18`, `web-tools/docs/surfacing-course.md:22`, the generated plugin copy, and `home/AGENTS.md:16`. Shingle overlap: home/web-tools `AGENTS.md` share 127 ten-word windows; each shares 35 with `surfacing-course.md`; the two `GEMINI.md` share 75.

**Words removed:** about 450 (two tables ~150 each, two GEMINI bodies ~250, surfacing-course ~40, less ~140 of new pointer text).

**Inbound dependencies:** `docs/assistant-branches.csv` is linked from all three; keep one link in the owner. Codex reads `AGENTS.md` locally; for home, the owner is a URL into another repo.

**Risk:** Medium for non-Claude agents. The table was copied because Codex and Gemini read `AGENTS.md` and may not follow a cross-repo link. If that is the measured reason, keep the table in `AGENTS.md` and make it generated from the owner (the pre-commit hook already copies `surfacing-course.md` into the plugin, so one more target is cheap), rather than hand-kept.

## 4. Render-link rules: "run showing.py" and the budget-drs frame bug, told in four places

**Repos:** web-tools, home.

**Copies:**
- web-tools `docs/SURFACING.md:57`, loaded every session: "Run `npm run showing` before handing over a render link, and paste the line it prints."
- web-tools `CLAUDE.md:11-22` (173 words): the same instruction, plus the history of why ("This section used to be 1,589 words ... It happened again on 2026-08-22").
- home `CLAUDE.md:132-152` (~200 words): the same instruction for home ("Do not pick the link by reading; run it"), plus the history of the paragraph it replaced.
- home `CLAUDE.md:153-180` (310 words): the unsettled app-frame bug: 46 files, 9,692,313 bytes, `inlineRelativeDeps`, the `data-inline-error` console line, the two candidate causes, "hand over the framed page on its own".
- web-tools `docs/SNAGS.md:274-297` (`app-frame-outruns-the-inliner`): the same bug with the same numbers, the same console line, the same two candidates and the same workaround, plus the fact that `showing.py` prints the broken route.
- home `CLAUDE.md:182-215` (398 words): the branch-preview `__ref` rule, two "former limits, and neither holds now", `appendix-render`, and the `SUBMITTAL_OPEN` params `?pkg=`, `?piece=`, `?track=`, `?diag=`.
- home `projects/budget-drs/app/view/README.md:69-75` (the four `SUBMITTAL_OPEN` params, "every param present is forwarded") and `:245-265` (`embedView`, `inlineRelativeDeps`, `data-inline-error`, `ref` is `"main"` by design).

**Owner:** `SURFACING.md:57` for "run it". `web-tools/docs/SNAGS.md#app-frame-outruns-the-inliner` for the open bug. `home/projects/budget-drs/app/view/README.md` for how the frame forwards params and mounts tenants.

**Kind:** restated rule, duplicated incident, app internals in an instruction file.

**Proposal:**
- web-tools `CLAUDE.md:11-22`: delete the section. `SURFACING.md` carries the rule into this session already. If the honesty rule ("for a kit or doc, link the `[new]` blob; where no link reaches a change, say so and send a screenshot") is not in `SURFACING.md`, move that one sentence there, since it is portable.
- home `CLAUDE.md:127-215` becomes one bullet of about 70 words: "**Render path.** The repo is private, so ⭐ never applies; 🥏 toss in owner mode, `#gh=mehrlander/home@<branch>:<path>`. Pages the budget-drs app frames are declared in the `showing` block of [.web-tools.json](.web-tools.json); run `python3 ../web-tools/scripts/showing.py` for the link. Until [app-frame-outruns-the-inliner](https://github.com/mehrlander/web-tools/blob/main/docs/SNAGS.md#app-frame-outruns-the-inliner) is settled, hand over the framed page on its own with `#pkg=<id>` and say the app route is broken. How the frame forwards params: [app/view/README.md](projects/budget-drs/app/view/README.md)."

**Rationale:** An instruction file is paid for on every turn. The frame bug is a snag with an owner, and the snag already says everything the home paragraph says, down to the byte count. The `SUBMITTAL_OPEN` rungs, the `__ref` override and the "two former limits" are how one app works, not how an agent should behave in home; the view README owns them. The home paragraph even schedules its own deletion ("when the cause is known ... this paragraph goes"), which is the snag's job.

**Evidence:** `grep -rln "inlineRelativeDeps\|app-frame-outruns-the-inliner\|SUBMITTAL_OPEN\|9,692,313\|data-inline-error"` returns home `CLAUDE.md`, `web-tools/docs/SNAGS.md`, `home/projects/budget-drs/app/view/README.md`, and two tracker tasks. Line 170 of home `CLAUDE.md` itself says "The trip is logged upstream as `app-frame-outruns-the-inliner`".

**Words removed:** about 1,000 (home ~830, web-tools ~170).

**Inbound dependencies:** No file links to the home `CLAUDE.md` Render path bullet (`grep -rn "Render path"` in home finds only the bullet itself). `showing.py` reads `.web-tools.json`, not the prose.

**Risk:** Low, with one conflict to settle first. The copies already disagree on a fact: home `CLAUDE.md:187-196` says "a framed view can be shot headless since 2026-09-05", while `projects/budget-drs/app/view/README.md:301-304` says "a headless shot of one comes back empty; shoot the framed page directly." Whichever is true goes in the view README, and the other sentence goes. The `#pkg=` fragment form for the standalone page also needs a home in the view README if it is not there.

## 5. The prose-clarity block in home CLAUDE.md is a compressed copy of a library skill

**Repos:** home, web-tools.

**Copies:**
- home `CLAUDE.md:37-66` (482 words, "Prose clarity"): role, seven principles, execution rules, a six-row example table.
- web-tools `skills/google-style-clarity/SKILL.md` (1,179 words): the full statement, with citations. The table row "Keep both. / Keep both app views." appears at `SKILL.md:71` and home `CLAUDE.md:61`.
- web-tools `docs/QUALIFIED-WRITING.md:14-20`, loaded every session through `/portable:default`: "Introduce before you refer", "Use plain language", "Qualify noun phrases", which cover the same ground as "Resolve pronouns", "Define jargon" and "Unstack modifiers".
- The user's global `~/.claude/CLAUDE.md` also sets the prose register ("Use short sentences ... common words in their common meanings").

**Owner:** `web-tools/skills/google-style-clarity/SKILL.md` for the Google rules; `QUALIFIED-WRITING.md` for the always-on rules.

**Kind:** compressed restatement of a skill, which the block admits: "this block is a repetition of it, not a second authority."

**Proposal:** Replace home `CLAUDE.md:37-66` with two sentences: "**Prose clarity.** Before drafting, reviewing or rewriting prose, apply `QUALIFIED-WRITING.md` (already loaded) and, for an edit pass or a disputed call, `/load-skill google-style-clarity`."

**Rationale:** The block is the second-largest section of the repo's instruction file and is paid on every turn in every home session, including sessions that write no prose. The always-on half of its content already arrives through `QUALIFIED-WRITING.md`; the rest is an editing procedure that belongs on demand. The block names its own owner and disclaims authority, so it adds no rule the skill lacks.

**Evidence:** The block's own line 39: "This is the compressed form of `google-style-clarity`, which owns the full statement". `grep -rn "google-style-clarity\|Prose clarity" home` finds no other reference, so nothing depends on the section.

**Words removed:** about 450.

**Inbound dependencies:** None found.

**Risk:** Medium. The block exists because `google-style-clarity` is not in the `portable` plugin (it is absent from the catalog's skill list), so without the block the rules fire only when a session loads the skill. If the owner wants the Google rules always on, the fix is to fold the seven principles into `QUALIFIED-WRITING.md` (which is always on, in every repo) and delete the home copy, not to keep a home-only copy.

## 6. Four verbatim copies of library skills parked in home/projects/doc-audit

**Repos:** home, web-tools.

**Copies:**
- `home/projects/doc-audit/atomic-decomposition.md` (2,792 words) = `web-tools/skills/atomic-decomposition/SKILL.md` (2,792 words), zero differing words.
- `home/projects/doc-audit/source-anchored-writing.md` (934) = `web-tools/skills/source-anchored-writing/SKILL.md` (934), zero differing words.
- `home/projects/doc-audit/source-anchored-xlsx.md` (1,706) = `web-tools/skills/source-anchored-xlsx/SKILL.md` (1,706), zero differing words.
- `home/projects/doc-audit/source-anchoring.md` (918) = `web-tools/skills/source-anchoring/SKILL.md` (920): the diff is trailing whitespace, a missing final newline, and one sentence where the home copy has em dashes and the skill has commas.
- Not verbatim, and not proposed for deletion: `outlining.md` (757), `outlining-revised.md` (1,015) and `source-anchoring-revised.md` (1,444) differ substantially from their skills and read as drafts.

**Owner:** the web-tools skill library (`web-tools/skills/<name>/SKILL.md`).

**Kind:** parked draft superseded by the published skill.

**Proposal:** Delete the four verbatim files. In `home/projects/doc-audit/README.md:68-76` ("Skill framings"), point each bullet at the skill: "[atomic-decomposition](https://github.com/mehrlander/web-tools/blob/main/skills/atomic-decomposition/SKILL.md) (web-tools skill library)". Do the same for the inbound links in `projects/local-models/README.md:97,156` and `projects/local-models/corpus-analysis.md:27`. Leave the three `-revised`/`outlining` drafts in place and say in the README that they are proposed revisions against the published skill.

**Rationale:** The README calls this section "Reusable-skill statements ... parked here as they accumulate. Each is a draft developed elsewhere." The drafts have since been published, and the home copies are now the published text, not drafts. A reader who edits one edits a copy nobody loads. The home copy of `source-anchoring.md` has already diverged by one sentence, in the direction the conventions forbid (em dashes).

**Evidence:** word-level diff (`diff -w` on tokenized text) gives 0, 0, 0 and 4 differing lines for the four pairs. home's own `tools/duplicated-claims.py` ranks the doc-audit/skill cluster among its top pairs (388 and 500 shared windows for the source-anchoring and outlining pairs).

**Words removed:** about 6,350.

**Inbound dependencies:** `projects/doc-audit/README.md`, `projects/doc-audit/full-picture.md` (check whether it is generated), `projects/doc-audit/source-anchoring-revised.md`, `projects/doc-audit/source-manifest.md`, `projects/doc-audit/2026-06-23-one-machine-three-questions.md` (dated, leave its links to break or point them at the skill), `projects/local-models/README.md`, `projects/local-models/corpus-analysis.md`. Session records in `web-tools-private/sessions/2026/08/` mention the paths; those are captured records and stay as they are. No script reads these files (`grep` for `doc-audit/*.md` in `.py`, `.sh`, `.js` under `projects/` and `tools/` finds none).

**Risk:** Low. The one question is whether `source-anchoring-revised.md` is meant to be a revision of the home copy specifically; since the home copy equals the skill, it is equally a revision of the skill.

## 7. home README.md restates CLAUDE.md, tools/README.md and .claude/skills/README.md, and has gone stale doing it

**Repos:** home.

**Copies:**
- home `README.md:69-92` (973 words, the prose under "Structure"): one paragraph per folder. The `chron/dump/`, `chron/threads/`, `chron/blog/`, `chron/assignments/`, `news/`, `links/`, `created/` and `me/` paragraphs restate `CLAUDE.md:82-99` ("Where things go"), `CLAUDE.md:233-240` ("Dump promotion"), `CLAUDE.md:241-249` ("Threads") and `CLAUDE.md:254-261` ("Blog"). The `links/` paragraph also restates `links/README.md` (27 shared ten-word windows).
- home `README.md:95-112` (361 words, "Skills"): the plugin roster (see proposal 2), the three `/repo-review` depths (restating `CLAUDE.md:108-114`), and a per-skill list that `.claude/skills/README.md` (1,627 words) owns as "the full inventory".
- home `README.md:114-137` (1,067 words, "Tools"): one entry per script, against `tools/README.md` (2,103 words), which `CLAUDE.md:250-252` names as the owner: "What each tool does ... is in `tools/README.md`."
- home `README.md:139-141` (42 words, "Style"): the no-em-dash rule, which is also in `CLAUDE.md:70`, `QUALIFIED-WRITING.md:12` (loaded every session), home `GEMINI.md`, the global `~/.claude/CLAUDE.md`, and is enforced by `tools/lint-conventions.py`.

**Owner:** `CLAUDE.md` for where things go; `tools/README.md` for tools; `.claude/skills/README.md` for skills; `lint-conventions.py` for the dash rule.

**Kind:** human-facing restatement of the agent contract and two inventories.

**Proposal:**
- Keep the README's orientation sections, which no other file owns: "Fast and slow layers", "Push and pull", "Ingress", and the tree diagram.
- Replace the folder paragraphs (`:69-92`) with one line: "What goes in each folder, and how, is the contract in [CLAUDE.md](CLAUDE.md#where-things-go)." Keep only what CLAUDE.md lacks: the `full-picture.md`/`state.md` split (two sentences) and the topic-folder graduation test (one sentence).
- Replace "Skills" with: "Home's own verbs are in [.claude/skills/README.md](.claude/skills/README.md); the portable set arrives by plugin."
- Replace "Tools" with: "Every script is described in [tools/README.md](tools/README.md)." First move the entries `tools/README.md` lacks: `generate-tracker-registry.py`, `archive-session.py`, `heatmap.ps1`, `repo-constellation.html`, and a pointer to `news/tools/news-state.sh`.
- Delete "Style".

**Rationale:** `CLAUDE.md:3-5` says the README is orientation and CLAUDE.md is "self-sufficient", so every rule in the README is a second copy by construction. The copies have drifted. The tree at `README.md:60` puts `assignments/` under `created/`; the folder is `chron/assignments/` (`ls created/assignments` fails), and the README's own paragraph at `:87` says so. `README.md:123` describes `stale-flags.sh` as replaced by `/markers`, a skill retired on 2026-09-21; the script is not in `tools/`. `README.md:97` lists `/web-tools` and `/caption` as plugin skills; neither exists.

**Evidence:** shingle overlap: `README.md`/`tools/README.md` 41 windows, `README.md`/`CLAUDE.md` 37, `README.md`/`links/README.md` 27, `README.md`/`.claude/skills/README.md` 11.

**Words removed:** about 2,200 (Structure prose ~850, Skills ~320, Tools ~1,030 net of the entries moved, Style 42).

**Inbound dependencies:** `CLAUDE.md:3-5` and `AGENTS.md` link to `README.md` as a whole, not to sections. `app/README.md` and `full-picture.md` do not link into these sections (`grep -n "README.md#"` finds no section anchors into home `README.md`).

**Risk:** Low. A human reader loses nothing that is not one click away, and gains a README that is not wrong.

## 8. home's tracker section restates the tasks skill, TRACKER.md and tracker/README.md, and keeps a rule for a retired artifact

**Repos:** home, web-tools.

**Copies:**
- home `CLAUDE.md:100-107` (524 words, "Project tracking").
- home `CLAUDE.md:35`: tracker state commits to `main` in Real-time mode.
- web-tools `docs/TRACKER.md:3` (state lives on `main`), `:14` (`board.md`, `board.csv`, `board-tags.csv`), `:19` (scope a tracker to a workspace), `:134` (On deck is `status: backlog`).
- web-tools `.claude/skills/tasks/SKILL.md:7,239` (task files and `board.md` commit straight to `main`), and the filing rules the home section summarizes.
- web-tools `docs/surfacing-course.md:10-13` (the two modes).
- home `tracker/README.md` (204 words): "Board command: regenerate via `/tasks`", the root placement rationale, the pointer to the convention.

**Owner:** the `tasks` skill for operation; `docs/TRACKER.md` for schema; home `tracker/README.md` for the root instance; home `CLAUDE.md` for the two extension points only (the registry command and the phrases).

**Kind:** restated contract, plus a retired-concept rule.

**Proposal:** Replace `CLAUDE.md:100-107` with about 90 words: "Trackers follow the portable convention, operated by `/tasks` ([TRACKER.md](https://github.com/mehrlander/web-tools/blob/main/docs/TRACKER.md) is the schema). A tracker is scoped to a workspace; the root `tracker/` holds repo-meta work. After standing one up, run `python3 tools/generate-tracker-registry.py`, which rewrites `trackers.md` and the `projects` field of `.web-tools.json`. Migrated tasks carry their old integer as a `legacy-id:` tag. Phrases: 'what's on deck for X' reports On deck and In progress; 'stand up a tracker for X' scaffolds `X/tracker/` and refreshes the registry." Delete the "No merge guide" bullet. Delete the tracker clause from `CLAUDE.md:35`, since the skill owns it.

**Rationale:** The section opens by saying the skill "owns every operating rule" and TRACKER.md is "the contract", and then restates the rollup's three files, the drift check's resolution mechanics, and the filing gate. The "No merge guide" bullet explains why home does not keep an artifact web-tools retired on 2026-08-05 (`web-tools/docs/estate-span.md:48`, `web-tools/docs/SNAGS.md:1836`). No convention now asks for a merge guide, so the opt-out defends against nothing. The board-command bullet repeats `tracker/README.md` word for word in substance.

**Evidence:** shingle overlap home `CLAUDE.md`/`tasks/SKILL.md` 10 windows, `CLAUDE.md`/`tracker/README.md` 7. `grep -rn -i "merge guide"` in web-tools' living docs finds only snags and retirement notes.

**Words removed:** about 430.

**Inbound dependencies:** None to the section. `tools/verify-artifacts.sh` runs the drift check regardless of the prose describing it.

**Risk:** Low. The wrap-up sequence in the merge-guide bullet ("preflight merge check, per-session refreshes, tracker task updates, final guide-PR body sync, mark ready") is the only operative content there, and no upstream owner states it: a case-insensitive grep for "wrap-up" in `SURFACING.md` and `surfacing-course.md` finds only one line about a clean exit, although web-tools `CLAUDE.md:26` cites "the conventions' wrap-up step 1". Keep the sequence as one line in home, or restore it upstream, before deleting the bullet.

## 9. shortcut-tools CLAUDE.md restates the install, replace and Back Tap rules the shortcut-links skill owns

**Repos:** shortcut-tools, web-tools.

**Copies:**
- shortcut-tools `CLAUDE.md:109-180` (648 words): installing is an import; importing over a name leaves both copies; `Library-Replace` for a replace; `Library-Paste` when signing is down; a struck "Wrong 2026-08-26" paragraph; Back Tap binds only `Double-BackTap` and `Triple-BackTap`; replacing a bound shortcut breaks the binding; the `prefs:` table for Back Tap and AssistiveTouch; `Open-URL` as the delivery.
- web-tools `skills/shortcut-links/SKILL.md:15-36` (the command table: `plist.py --link --replace` → `Library-Replace`, `pack.py --install` → `Library-Paste`), `:38-52` (prepare an installation, the older `Library-Import` route), `:54-69` (the Back Tap stubs, the binding break, "include the appropriate Settings link in the same message", the identical `prefs:` table, "bare `prefs:` links do not work reliably in chat"), `:71-79` (diagnostics through `--log` and `Log-Repo`).
- shortcut-tools `CLAUDE.md:476` already concedes the handover card is "owned upstream by web-tools' `shortcut-links` skill, not restated here."

**Owner:** `web-tools/skills/shortcut-links/SKILL.md`.

**Kind:** restated procedure with incident history.

**Proposal:** Replace `CLAUDE.md:109-180` with about 80 words: "**Before handing over an install, replace or run link, `/load-skill shortcut-links`.** It owns which command and receiver to use, the replace-not-import rule, and the Settings link a re-bound gesture needs. Two local facts: installing is the dearest route (see the table above), and a generated receiver is reproducible from `git`, so replacing one needs no staging." Keep `:181-191` ("The one-time cost so far"), which is a local ledger. Drop the "Wrong 2026-08-26" paragraph outright: it narrates a superseded version of the rule, and git holds it.

**Rationale:** The skill has the same rules with the same table, and it is the thing a session in another repo loads to hand over a shortcut link. Keeping a longer copy here means two places to update when a receiver changes. The "Wrong" paragraph uses the marker form retired across the estate on 2026-09-21 (home `CLAUDE.md:74`, web-tools `SNAGS.md:1555`); the retirement's rule is to fix the sentence and let git hold the history.

**Evidence:** shingle overlap `shortcut-tools/CLAUDE.md`/`shortcut-links/SKILL.md` 38 windows, concentrated at `CLAUDE.md:147-172`. The `prefs:` URLs appear only in these two files and `Fav-Settings`.

**Words removed:** about 570.

**Inbound dependencies:** `shortcut-tools/workflows/README.md:371` links `CLAUDE.md#a-diagnostic-returns-itself`, a different section, unaffected. No anchor into `:109-180` was found.

**Risk:** Medium. `shortcut-links` is not in the `portable` plugin (absent from `docs/portable.csv`), so it loads only on request. The one-line directive at the top of the replacement is what keeps the rule firing; without it, a session reading only `CLAUDE.md` would hand over an import where a replace was needed, which is the failure the section records. An alternative with no risk: add `shortcut-links` to the plugin, since `apple-shortcuts-actions` already rides there.

## 10. web-tools-private proposals/README.md restates the manifest doc's Proposals section

**Repos:** web-tools-private, web-tools.

**Copies:**
- web-tools-private `proposals/README.md` (865 words): purpose, record shape with a JSON example, required fields, `ref`, the signature fields, `expectSha`, the three file kinds (`put-file`, `set-json-field`, `unset-json-field`) and `delete-issue`.
- web-tools `docs/manifest.md:363-557` (2,044 words, "Proposals (`proposals/pending` → `proposals/applied`)"): the same record, the same kinds, `expectSha`, the applied tombstone, plus the code paths (`lib/kits/repo-proposals.js`, `lib/alpineComponents/proposals.js`).

**Owner:** `web-tools/docs/manifest.md#proposals`, which sits beside the code that enforces the shape.

**Kind:** restated schema.

**Proposal:** Cut `proposals/README.md` to the shape `errands/README.md` in the same repo already uses (108 words): two sentences of purpose, the `pending/` and `applied/` layout, "Nothing here is applied automatically", and "The record shape and the kinds are specified in [docs/manifest.md](https://github.com/mehrlander/web-tools/blob/main/docs/manifest.md#proposals-proposalspending--proposalsapplied) and enforced by `lib/kits/repo-proposals.js`."

**Rationale:** The precedent is in the repo: `web-tools-private/errands/README.md:9-10` says the errand record is "specified in `docs/manifest.md` ... and enforced by `lib/kits/errands.js` there" and stops. The proposals README does the opposite and carries its own schema. Both copies count the same fields (a grep for `expectSha`, `put-file`, `unset-json-field` or `delete-issue` matches 10 lines in each file), so a new kind needs two edits in two repos.

**Evidence:** 95 of 920 ten-word windows in `proposals/README.md` also occur in `manifest.md`, the highest cross-repo pair in the sweep after the `AGENTS.md` pair.

**Words removed:** about 740.

**Inbound dependencies:** None in the living docs (`grep -rn "proposals/README"` finds only an unrelated `home/projects/text/instruments/proposals/README.md` in a session cache). A session writing a proposal reads the README it lands beside, so the link must be the first thing after the purpose.

**Risk:** Low. The web-tools-private repo is private and web-tools is public; the link goes from private to public, which always resolves.
