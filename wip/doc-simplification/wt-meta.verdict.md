# Verdicts: wt-meta

## 1. Let `sandbox-traps` own the trap rules, and cut their restatements from environment/

**Verdict:** keep

**Checked:** Every cited duplicate holds. The 413 rule and its numbers are at `capabilities.md:80-95` and `sandbox-traps/SKILL.md:78-82`. The deny-header rule is at `capabilities.md:15-18`, `:207-213` and `SKILL.md:84-87`. The two gates and the 502 text are at `capabilities.md:200-205` and `SKILL.md:89-92`. The shallow-clone rule and its two commands are at `container.md:257` and `SKILL.md:60-66`. The added-repo affordance is at `container.md:283-293` and `SKILL.md:94-104`. `SKILL.md:115-121` does split action from evidence. The callout's rule 2 is covered by `capabilities.md:255-260` (the browser is already on disk). Rule 3 is partly in `capabilities.md:213-215` (the GCS bucket path). The skill ships in the plugin (`portable:sandbox-traps`).

One weak point, which does not change the verdict. The rationale says the `mcp-fail-hint.sh` hook met the "untested until it catches a real failure" condition. That hook delivers only the `-32003` trap. It says nothing about 413, the deny header, the shallow clone or added repositories. The argument that stands is simpler: the skill's own closing section assigns the operative text to the skill.

Keep the three origin behaviours at `capabilities.md:213-217` (`api.github.com` 403 without a user agent, the GCS path, the `docs.github.com` 503s) and the `probe` shell function. The skill does not carry either, and both are the evidence half.

**Corrected words removed:** about 620. The spans measure 182 + 150 + 179 + 120 + 140 = 771 (the 413 span is 150, not 172), less about 150 of kept evidence.

## 2. container.md: resolve its self-contradiction and hand the setup script to its owner

**Verdict:** revise

**Checked:** The claimed contradiction is weaker than stated. `container.md:217-222` says the container holds only the running session's transcript and that a transcript not copied out before the container is **reclaimed** is gone. `:80-90` measured exactly that: the 25-day wake came back with no `subagents/`. `:62-73` measured survival across a VM restart and idle days, which is a different lifetime. The two passages agree on content. What is wrong is the bold lead "It does not persist", which is too broad, and the passage never says it means reclaim. `capabilities.md:401` ("die with the environment") is also consistent with the reclaim result, so it needs no edit.

The setup-script claim is overstated too. `container.md:190-192` says "no copy on disk" and "nothing **outside the checkouts**", so it excludes the web-tools-private checkout by its own wording. It is still true that the script writes no copy of itself. The real duplicate is the five-item list at `:168-173`, which `web-tools-private/environment/README.md:10-13` states. The canonical copy exists: `web-tools-private/environment/setup.sh`, and it writes `env-manifest.txt` at `setup.sh:85`.

Two things in the target spans exist nowhere else. First, the three "why none of it moves" bullets at `:175-188`. `environment/README.md` (287 words) does not carry them, and they stop an obvious wrong move. Second, the documentation-versus-measurement passage at `:129-148`. It is the only record of the open question that proposal 7 wants settled by a probe, so sending it to git history removes the question before it is answered.

Missed dependency: `container.md:261` links `#evidence-limits`, which the proposal deletes. The other inbound links listed (`github-surfacing.md:47`, `SNAGS.md:479,487`, `capabilities.md:5`, `environment/README.md:6,27`) are correct.

**Revised proposal:** Rebuild the persistence half as the three lifetimes, as proposed. Change the lead at `:217` from "It does not persist" to "It does not outlive the environment", and keep the rest of that paragraph. Leave `capabilities.md:401` alone. Replace `:168-173` and `:190-204` with a link to `web-tools-private/environment/` and one sentence on `env-manifest.txt`. Keep the three bullets at `:175-188`, or move them to `web-tools-private/environment/README.md`. Collapse `:104-162` to the three operative rules plus one sentence: "The hooks reference says plugins load once at startup; on CLI 2.1.220 a mid-session `claude plugin update` reached a new skill and a later `Stop` hook without restart (measured 2026-07-30)." Delete "Evidence limits" and the link to it at `:261`. Keep the partial-resume hazard at `:92-102` as one sentence with its pointer.

**Corrected words removed:** about 1,400. The four spans measure 1,270 + 387 + 299 + 142 = 2,098 (not 2,151). The rebuilt section, the kept bullets and the kept sentence come to about 700.

## 3. extending.md: drop the Claude Code primer, replace per-hook essays with a table of the nine hooks

**Verdict:** revise

**Checked:** `hooks.json` registers nine hooks, split three, two, two, one, one, as claimed. `extending.md:5-16` says "one plugin hook" and then lists two. No file name among `reading-column-guard`, `send-later-guard`, `pr-subscribe-hint`, `warn-governing-docs`, `mcp-fail-hint` or `session-dispatch` appears in the file (grep count 0 for each). But the dispatcher's job is documented, at length, in "The session dispatcher" (`:239` onward, 703 words), so "says nothing about `session-dispatch.sh`" is true only of the file name. `MARKETPLACE.md:46` does recommend `claude plugin validate .` with no caveat, against `extending.md:163`. The four hook scripts that cite the file are as listed (`invoke-default.sh:145`, `pr-subscribe-hint.sh:17`, `reading-column-guard.sh:18`, `session-record.sh:10`). No test reads the file.

Two problems with the cut as written. First, "delete the Components and Settings sections" takes more than the primer. The Settings section's "This setup uses" bullets (`:213-217`) carry the 2026-09-14 proof that a multi-repo session does not read project settings (the plugin loads although web-tools' project settings disable it). `container.md:180` links to that proof. It is a second proof, distinct from the transcript-path proof at `:18-43` that the two-sentence version keeps. Second, the essays at `:129-183` hold measured facts beyond the four the proposal keeps, and no script header states them: a `hooks` key on the marketplace entry refuses the whole plugin (`:147-149`), and `Stop` fires when the session idles, not once per message (`:155`). The per-entry output cap is already in the script headers (`invoke-default.sh:25`, `session-dispatch.sh:66`), so that one can go.

The "Context cost" section (`:221-237`) repeats the component list as a table, and the proposal leaves it. It belongs in the same cut.

**Revised proposal:** As proposed, with three changes. Keep the "This setup uses" bullets at `:213-217`, trimmed to the multi-repo proof. Add the marketplace-entry `hooks` key and the Stop-on-idle measurement to the "Plugin hook facts" list, which makes it six facts. Cut the component table under "Context cost" with the primer. Keep "The session dispatcher" section, and name `session-dispatch.sh` in the new hook table's row for it. Fix `MARKETPLACE.md:46` in the same change.

**Corrected words removed:** about 2,200. The spans measure primer 281, diagnosis 555, essays 1,658 and inventory 162, for 2,656. Add about 80 for the Context cost table. Subtract about 250 for the table, the six facts and the kept settings bullet, and about 290 for the kept two sentences and settings proof.

## 4. TRACKER.md: cut the operating rules its own line 5 gives to the `tasks` skill

**Verdict:** revise

**Checked:** `TRACKER.md:5` does assign every operating rule to the `tasks` skill. The skill tells sessions to fetch TRACKER.md for the schema (`tasks/SKILL.md:26`, `:196`, `:224`), and the proposal keeps the schema, parser contract, graduation rule, board format, typed projection and assessment record, so that path survives. The runnable-task template, "writing the skill is part of filing", "prefer a derivation" and "belongs in a hook, a test, or CI" are all in `SKILL.md:142-171`. The size scale and "a smell" are at `SKILL.md:130-132`. The conflict rule "take either side and rerun" is at `SKILL.md:256-257`. The correct-versus-file split and the commit-message rule are at `SKILL.md:260-266`. No task file in any local tracker still carries a legacy integer or dated id (266 task files checked). `state-the-rule.test.mjs:787` needs more than 1,000 units and at least 10 code units across eight files; losing one fence here will not threaten that, but re-run it.

Two rules in the cut spans have no copy in the skill. First, "References carry their repo" (`TRACKER.md:217`): write the `owner/repo` prefix on any path in another repository. The proposal keeps it in its two lines, which is right. Second, the rule at `:235` that a session moving material across a repo boundary owns repointing every tracker that names it. The proposal drops it, and the skill does not have it. Also missing from the skill is the resolution rule at `:108` that an `action` resolves the way a skill invocation resolves, repo first, then plugin. That is design contract, not operation, which is what line 5 says this file keeps.

The word arithmetic is wrong. "Across repositories" (`:213-235`) is 413 words, not 584. Conflicts (`:205-211`) is 171 and was left out of the sum.

**Revised proposal:** As proposed, with three additions to what stays. Keep the `:235` repoint-on-move rule as one sentence under "Across repositories", beside the `owner/repo` and `depends-on` lines. Keep the `action` resolution rule (`:108`, first two sentences) in the two lines for runner and action. Legacy migration at `:88` can go for web-tools and home, but TRACKER.md is the adoption contract for other repos, so leave one sentence: "Legacy integer or dated ids still parse; rename to the slug form when you next touch the tracker."

**Corrected words removed:** about 1,300. Spans: runner and action 574, across 413, conflicts 171, size and awaiting 231, id minting line 88 98, incident tails about 150, for about 1,640. Kept text is about 330.

## 5. headless-vendoring.md and testing.md: fix a false premise, cut the copies of each other, collapse two correction stories

**Verdict:** revise

**Checked:** The premise contradiction is real. `headless-vendoring.md:19-23` says the JS CDNs "all return a denial". `capabilities.md:180-189` (2026-08-05) found the shell reaches them and the headless browser reaches no host. `portable.csv:28` repeats the old premise. `testing.md:356` does retract an earlier entry against its own header at `:5-7`. `testing.md:114-118` states the same trap as the `use` row of `showing-mechanisms.csv`. `SURFACING.md:55` owns "send the file, not a path", so "Showing the result in chat" can go, and the link at `capabilities.md:301` must be repointed. The duplication measure is real: `themes.csv` records the testing.md and headless-vendoring.md pair at 30 shared windows (now at row 16, not row 6, because the file has been regenerated).

The direction of the Gotchas cut is backwards. `testing.md:52-55` says headless-vendoring.md is "the portable, repo-agnostic write-up" and that testing.md "owns the web-tools harness specifics". `portable.csv:28` ships headless-vendoring.md on demand to other repos. The TLS flag, the Alpine import and the pre-installed browser are generic facts. Deleting them from the portable doc and keeping them in the web-tools doc leaves a reader in another repo with the recipe and without its failure modes. The same holds for the jsdom variant: `npm run preview` exists only in web-tools, so it is no substitute in a portable doc. The edge cases at `:377-391` overlap `testing.md:275-281` only in part (`/+esm` and CJS). The `esm.sh` point and the data-API point are not in testing.md.

**Revised proposal:** Rewrite the premise as proposed, and fix `portable.csv:28`'s "where the sandbox blocks their CDNs" in the same commit. Word the premise for both cases, since other sandboxes may still deny the CDNs: "the browser may reach no host at all, and the CDNs may be denied as well; interception answers both." Delete "Showing the result in chat" and repoint `capabilities.md:301` to SURFACING. Delete the theme-explorer walkthrough. Keep the Gotchas, the edge cases and the jsdom variant in headless-vendoring.md. Cut their copies from testing.md instead: the Alpine bullet at `testing.md:285-287` and the TLS paragraph at `:332-337`, each replaced by a link. Take the testing.md cuts as proposed (the Tailwind section to three sentences, the typography story, the `?use=` paragraph to a link).

**Corrected words removed:** about 900. headless-vendoring.md loses 88 + 276 = 364. testing.md loses about 370 from the Tailwind section, 107 from the typography story, about 45 from `?use=`, and about 80 from the two gotcha copies.

## 6. artifacts.md: keep the house pipeline, drop the copied matrix and the stale platform summary

**Verdict:** revise

**Checked:** The matrix at `artifacts.md:27-34` does restate what `showing-mechanisms.csv` holds, and `CLAUDE.md` says the link rule is not restated. The inbound links listed are right: `surfacing-extended.md:14`, `portable.csv:26`, and `docs/examples/which-link.html` exists as a second copy of the matrix. The drift is real. The Artifact tool's description in this session says a page may load scripts from `cdnjs.cloudflare.com` and `cdn.jsdelivr.net/npm/` and stylesheets from Google Fonts, may publish several files through `files`, and may declare runtime capabilities (a shared database, viewer identity, live data). `artifacts.md:13-15`, `:45-47` say the opposite. That comes from the tool's own text in this session, not from a publish probe.

The proposal keeps the parts the drift hits hardest. First, the bake step (`:58-61`) exists because "the CSP blocks every external request". If jsDelivr `/npm/` scripts load, a page in CDN form may publish without a bake, and the pipeline the proposal calls "what the estate adds" may be one step shorter or gone. Second, convention 3 (`:117-120`) reasons from "the CSP means the page cannot read repo files live". Third, convention 5 (`:124-126`, "Nothing notifies sessions of changes") is now contradicted by the tool's watch and comment features, though the proposal already drops 5. Fourth, the replacement line points at the `artifact` row of `showing-mechanisms.csv`, and that row says "artifact CSP blocks every external request". `surfacing-extended.md:14` says the same ("bake CDN dependencies in first"). Linking to the owner moves the reader to a copy that is just as stale.

**Revised proposal:** Do the cuts as proposed: the matrix to one line, the platform summary to a link, and the stale-sign-in tell kept. Before keeping the pipeline, run one probe: publish the CDN-form `examples/which-link.html` without baking and see whether it renders. If it renders, cut the pipeline to "author in CDN form, strip to a fragment, publish", and note that `/combine/` URLs may still need a bake because the tool names only `/npm/`. Either way, fix the CSP wording in the `artifact` row of `showing-mechanisms.csv` and in `surfacing-extended.md:14` in the same change. Reword convention 3 to "embedded data is a snapshot unless the page declares a live-data capability". Retire `which-link.html` with the matrix rather than regenerate it.

**Corrected words removed:** about 650, as estimated, before the probe. Spans measure 224 + 63 + 81 + 268 + 92 = 728, less about 80 kept. If the probe shows the bake is unneeded, about 100 more.

