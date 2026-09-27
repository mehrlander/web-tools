# Lens: cross-repo duplication

## Summary

This lens swept web-tools, home, shortcut-tools and web-tools-private for one rule or fact stated in more than one place. The method was a 10-word shingle comparison across every top-level document, `docs/`, skill and README in the four repos, plus home's own `tools/duplicated-claims.py`, then a read of each hit. Ten clusters survive. The largest single cut is mechanical: four files in `home/projects/doc-audit/` are byte-for-byte copies (modulo whitespace and one em dash) of web-tools library skills, about 6,350 words. The largest instruction-file cut is home `CLAUDE.md`, where the render-path exception, the prose-clarity block, the plugin delivery history, the marketplace mechanics and the tracker section restate owners that already exist, about 2,100 words together. Several clusters also show the cost of the copies: they have already drifted. The assistant table's Codex and Gemini notes differ between the owner and its two copies; `MARKETPLACE.md` counts eight plugin hooks where the catalog lists nine; home `README.md` still describes the retired `/markers` skill, a `created/assignments/` folder that does not exist, and a `/caption` skill; and web-tools `CLAUDE.md` tells every session to run `/markers`, which was retired on 2026-09-21. Estimated total removed across the ten proposals: about 11,900 words.

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

**Evidence:** `grep -n "invoke-default\|portable:default\|@-import"` across the four repos' top-level docs returns exactly the five locations above plus `web-tools/docs/SNAGS.md:357-371` (a snag, which stays) and `home/me/README.md:41` (a one-line pointer, which stays).

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

