# Fan-out review of the Web Tools app, 2026-10-25

This is a review of `mehrlander/web-tools` at main `764ba4c` (2026-10-24 evening), with the registry `mehrlander/web-tools-private` beside it. Seven read-only agents each took one slice of the app and its records (a lens) and returned findings in one schema. The session ran the repo's mechanical probes first, then checked every returned finding against the tree before ranking it. The question had two parts: what to pursue next, and which kinds of reading find things worth pursuing.

Main moved four times during the run. A session closed `growth-vs-reads-quadrant-ng3c97` (`4f5d613`), another filed `expanding-rows-and-modals-kits-1r7is4` (`cbe4c62`), and #1075 and #1081 merged. Claims below hold at `764ba4c` unless they say otherwise.

## The finding in one paragraph

The estate's records describe its code less accurately than the code describes itself, and the gap opens fastest where the work moves fastest. Main took 250 pull requests in four weeks, 110 of them in the last week. The commit hook keeps every generated artifact in step with its source, and the suite holds most registries to the code. No check reaches the hand-written record about code: the app reference, tracker task bodies, tend findings, snag notes, the ui-units coding, a Map tab's list of sources. Every lens found some part of that record lagging main or running ahead of it. One commit, `8ef2e7d`, removed the view aliases and left four documents describing what it deleted. A second, smaller pattern: several instruments that sessions use to prove their work are broken or blind in the current sandbox. Headless rendering does not launch, the suite is red on two known sandbox-only failures, the render shim serves stale sibling checkouts, and a NUL byte hides a kit from the search tool.

## Where the effort went

Four weeks to `764ba4c`, from the momentum lens. A PR counts toward every area its diff touches, so the rows overlap.

| Area | PRs | Commits | Shape |
| --- | --- | --- | --- |
| Map view, all tabs | 65 | 237 | steady; `map.js` grew from 6,004 to 14,474 lines |
| Skills | 92 | 206 | steady |
| Registry and vocabulary CSVs | 67 | 124 | steady |
| Per-view docs (`docs/views/`, `docs/forms/`) | 44 | 67 | built, then retired on 2026-10-24 |
| Estate views (Sessions, Branches, Lists) | 37 | 129 | steady |
| Conversation, surfacing and showing docs | 37 | 96 | converging |
| UI units and codebook | 26 | 94 | recoding lags the Map |
| Registry upkeep | | 93 | 31 commits only fill a `docs/tests.csv` "protects" cell; 62 refresh thumbnails |
| Tracker | 8 | 22 | 2 tasks opened and 8 closed, against 250 PRs |
| Declared goals and initiatives | 0 | 0 | no task, program or PR cites one |

## Ranked actions

The ranking weighs consequence and how many later items depend on an item. Size is the lens's estimate after checking: S fits one short PR, M a full one, L several.

### 1. Repair the instruments (S, time-sensitive)

This should be one PR, before other work, because items 3 to 6 are proved with these tools.

- **Headless rendering does not launch.** `package.json` pins `playwright` 1.56.0, which wants Chromium build 1194. The sandbox image built 2026-10-22 ships only build 1243, with `/opt/pw-browsers/chromium` a symlink to its binary. `npm run shot`, `npm run pages-shots` and every Playwright probe fail with "Executable doesn't exist", while `npm run ready` reports "ready". [capabilities.md](../docs/environment/capabilities.md) (lines 242 to 248, verified 2026-05-30) still records build 1194. Sessions on older images took screenshots through 2026-10-24 20:34, so the failure arrives with the image, not with a commit. Fix: fall back to `executablePath: '/opt/pw-browsers/chromium'` in `node/render/screenshot.mjs` and `node/render/netlog.mjs` when the pinned build is missing; have `node/checkout-setup.mjs --check` compare the client's expected build with the installed folders; re-date capabilities.md. Snag: `pinned-playwright-misses-the-image-browser`, filed by this run.
- **A NUL byte hides a kit from search.** `lib/kits/read-aloud.js:97` writes its control-character class as raw bytes. It is the only tracked text file in `lib/`, `pages/`, `app/`, `node/`, `python/`, `skills/` or `docs/` that holds a NUL. ripgrep, the engine behind the agent's Grep tool, leaves it out silently: `rg -l speechText lib/` lists two other files and not the one that defines `speechText`. Fix: write the class with `\u` escapes, and add a test that fails on any 0x00 byte in a tracked text file.
- **The render shim serves sibling repos from their working trees.** `siblingFile` (`node/render/cdn.mjs:113-121`) ignores the ref a page asks for. The registry checkout in this sandbox was 108 commits behind its origin when checked. #1099 fixed the same fault for the hub's own reads only (`refAt`, lines 93 to 107). Fix: warn in `screenshot.mjs` when a sibling read comes from a checkout behind its origin, or when the address names an own-repo ref other than the checkout's; add both cases to `node/test/shot-warnings.mjs`.

### 2. Make the Tending record true (S)

`python3 skills/tend/findings.py list` shows 51 open findings. 41 of them name a user call the owner has closed, most on 2026-10-07, and the actions those answers asked for were carried out: #667 closed and #837 merged that day, and the four tasks in `close-four-tasks` closed as directed. No session settled the findings. `findings.py` requires an `answer` finding to name its user call (`skills/tend/findings.py:129`), but `check` never reads that call's status, and for a pull request outside the crawl cache it answers "not in the crawl cache". The Tending view therefore shows about five times the open work that remains.

Fix: settle the 41 in one `findings.py update` batch with their evidence, then make `check` mark a finding REASSESS when a user call among its subjects is closed or a pull request among them has merged or closed. Separately, the only open user call, `f0b9084b-docs-tab-test`, is a test fixture that points at `docs/views/tending.md`, which was retired on 2026-10-24. Close it.

### 3. Make `npm test` green in a standard sandbox (S)

At main the suite runs 5,721 tests here and 5,719 pass. The two failures are logged snags whose remedies are habits ("read a local failure as the runtime", "read it as home's coding debt"). A suite that is red for reasons a session must remember to discount trains sessions to discount red.

- `node/test/powershell-outpost-view.test.mjs:592` fails because this sandbox's Node 22.22.0 decodes Windows-1252 byte 0x93 as U+0093 (snag `node-decodes-windows-1252-as-latin1`). Fix: skip the case, naming the runtime in the reason, when `new TextDecoder('windows-1252').decode(Uint8Array.of(0x93))` is not the curly quote. CI's Node still runs it.
- `node/test/ui-units-coverage.test.mjs` reads home's ui-units store whenever a home checkout sits beside web-tools (lines 29 and 30). The gap it reports grew from 1 unit on 2026-10-23 to 13 today, and neither CI nor home's `tools/verify-artifacts.sh` reads that pair. Fix: report the home store's misses here as a diagnostic, give the failing check to home's `verify-artifacts.sh`, and code home's 13 units.

### 4. Fix six faults the render pass found (S, one PR)

The render lens loaded 72 addresses at desktop and phone widths without a token, then 32 with a stand-in token against the registry's checkout. I traced the first three faults to the lines named.

| Fault | Where | Fix |
| --- | --- | --- |
| The repo Board tab's chip reads "[object Object],… quiet 3+ weeks", and shows even when nothing is stale | `app/index.html:5608` returns the filtered array; its twin at `:5197` takes `.length` | add `.length`; extend `node/test/shell-board-review.test.mjs` to call `repoBoardReview` |
| The Map's Views tab tells every reader without a token "no route manifest at main" | `map.js:7544` tests `!!window.TOKEN`, and the shell always seeds a placeholder (`app/index.html:2403`) that `hasToken()` (`:3180`) excludes | call `__shell.hasToken()`, here and in `branch-brief.js:1532` |
| The Research link on Projects hides explorations in every workspace that also has a probe (6 explorations, across three of home's workspaces) | `map.js:8391-8395` opens one kind | open both, or merge Probes and Exploration into one tab with a kind filter |
| `?repo=mehrlander/home&view=pages` can show web-tools' own catalog | `gallery().load()` checks its load key before its awaits only (`app/index.html:9132`, `:9160`) | recheck the key after each await |
| At 390 px the header nav loads scrolled to its start, so the active view (Map, Search, Tools) sits off-screen | `app/index.html:494-505` | reuse the Map's `revealTab()` on the active `[data-nav]` button |
| Signed in at 390 px, the Lists pane's created-lists form overlaps the Ping input | `lib/alpineComponents/estate.js:4539-4584` | `shrink-0` or an inner scroll body; add created lists to the unit's scenario |

The lens measured the last three by element positions (four renders for the gallery race), and I did not re-run them. The page-level overflow measure returned 0 on every page. Every layout fault came from the pictures or from targeted position checks.

### 5. Sweep the documents a deletion left behind, and add the check (S to M)

Commit `8ef2e7d` (#1091, 2026-10-24) removed every view alias. Since then `?view=activity`, `?view=portable` and `?view=surfaces` open the hub's Overview. Four documents still describe the aliases: [APP.md](../docs/APP.md) line 39 says the keys still resolve; `docs/tests.csv:321` describes a test the commit deleted; `node/test/shell-routing.test.mjs:52-63` explains the removed `alias` field; and `docs/properties.csv` (lines 135, 139 and 140) states counts the deletion changed. The same kind of lag appears elsewhere:

- APP.md:17 sends readers to Map › Docs › Purpose. Purpose moved under Overview on 2026-10-13 (`5b22b3b`).
- APP.md:91 says `pasteAnywhere` calls `StageIntake.takeClipboard`. Since 2026-09-13 (`52c98e5`) it tries `pasteRoute`, then `takeCorrespondence`, then `StageIntake.takeFlavors` (`app/index.html:7748-7763`).
- APP.md:106 says a moved ref is retried three times. `lib/gh-transfer.js:202` makes three attempts, which is two retries, and its comment is off by one the same way.
- `docs/environment/capabilities.md:57-58` says the Context tab's Delivery lens renders startup delivery. That lens was retired (`map.js:470-472`), and nothing renders `startupCut`.
- `docs/app-routes.csv` leaves `tabs` empty for the landing and Tending rows, though both views take `&tab=`.
- `tracker/tasks/repos-grid-into-map-reach-1eheiq.md` says to route the grid like `?view=routes` and keep `?view=estate`. `8ef2e7d` removed both.
- `data/ui-units/coded.csv:12` still codes the Growth tab as framing `pages/doc-growth.html` in an iframe. The tab has been native since `535e682`.

The check: a test that every `?view=<key>` and `tab=<key>` written in `docs/` and `tracker/tasks/` resolves against `VIEWS` and the Map's tab list, and `node/test/app-routes.test.mjs` deriving each row's tabs from the router's allow-lists, as it already does for the Map. These are documentation edits, so they go through a doc-craft review and the owner's sign-off.

### 6. Keep the tracker on main's state (S)

Three lenses found this independently. Commit `2cb74c4`, on main, closed `registry-authored-derived-split-v3qm2x` and logged parts of `views-forms-and-key-primitive-k5ngay` and `align-map-view-cleanup-40afu8` as done, all citing #1087. #1087 is an open draft waiting on documentation sign-off. Main's `docs/registries.csv` still has `area` where #1087 has `key_primitive`, and `docs/tests-authored.csv` does not exist on main. The tasks skill closes a task when its branch work is complete (`skills/tasks/SKILL.md:184-188`), and nothing reopens a task whose PR stalls. The tracker also drifts the other way: #1100 edits a task file and `tracker/board.csv` on its feature branch, the second time its session has done so.

Fix: log on the three tasks that their #1087 claims wait on its merge; move #1100's task edit to main; add a probe to the `in-flight` or `tend` skill that lists done tasks whose `session` branch heads an open PR.

### 7. Land the Map drafts in an order that merges (needs the owner)

Three drafts touch `map.js` and `docs/map-tabs.csv`, and each merges clean alone. In simulated merges, landing #1087 first makes #1089 conflict in `docs/registries.csv`, `docs/vocabularies.csv` and `docs/tests.csv`, and landing #1089 makes #1074 conflict in `docs/map-tabs.csv`. #1087 should go first, since it changes the schemas the other two add rows to, and it waits only on the owner's sign-off on five documents. #1074's "Size by reads" lens plots words against reads from the sessions cache, which is a second readership count beside the Growth chart's `state/doc-reads.json`. #1102 exists to make the two counts one, so drop that lens or rebase it onto #1102.

### 8. Smaller fixes to carry in the next push that touches their files

- **Kit stylesheets are unlayered.** No stylesheet in `lib/`, `pages/` or `app/` declares an `@layer`, so an injected kit rule outranks every Tailwind utility. `lib/kits/title-tip.js:122-123` still sets the `border-radius:2px` that the snag `an-unlayered-rule-beats-every-layer` measured beating `rounded-full`. Two later commits worked around kit sheets inline (`linked-swiper.js:103-106` and `:221-222`), citing the snag without adding a date to it. Fix: a `python/css-blocks.py --check` rule that fails a kit sheet outside `@layer`, then wrap the five sheets (M).
- **The Map's About sources are written by hand.** `mapSources` has no case for Programs, and Showing's case leaves out three of the eight files `loadRoutes` fetches (`map.js:6683` against `:7690`), `docs/fab-signals.csv` among them. Context's circle and timing labels are hand copies of `docs/vocabularies.csv` rows (`map.js:484-515`), and no test compares them. Fix: a test that pairs each loader's path constants with its Sources case, and labels read from the vocabulary (S).
- **A guard the snag list cites was deleted.** The snag `stub-hides-the-wiring` names a test added in `460a7c0` (2026-08-13) and removed in `7a0b3cb` the next day. The remaining test sets `window.EstateSearch` directly (`node/test/fab-text.test.mjs:355`), which is the stub the snag warns against. Fix: one case that leaves it unset and asserts that `kits/estate-search.js` was requested (S).
- **Hand-built links skip the link checks.** `python/showing.py` and `python/look-link.py` now carry the encoding and codec fixes. The October look-link bites came from links built by hand, or from `text:` and `css:` anchors that `look-link.py` reports as "unchecked" (lines 133 to 147). `skills/hooks/reply-check.py` checks only that a render glyph is present. Fix: parse each toss and look URL in a reply, and send the reply back once on `?use=` on the renderer, a second raw `#`, `?w=`, a SHA that does not resolve, or an anchor without its prefix (M; plausible, not re-checked).
- **The no-title rule broke inside the app.** `lib/alpineComponents/estate.js` had no `title` attributes when #965 merged and has had 8 since #993 (2026-10-19). The stranded-titles scan runs on `app/` only. Fix: widen its roots to the files `app-routes.csv` lists, as task `enforce-house-style-ryz0z5` proposes, and convert the eight.

### 9. The Map view's shape (L, after item 7)

`lib/alpineComponents/map.js` grew from 6,004 lines on 2026-09-27 to 14,474. It took 65 of the 250 PRs and was changed on both sides of 59 merges, more than any other hand-written file. `data/ui-units/units.csv` attributes all 35 Map units to that one file, so neither a staleness check nor the Views tab can say which tab changed. The Growth tab already has its own kit (`lib/kits/doc-growth.js`). A pilot: move the Growth tab into its own component and point its units row at it, after the Map drafts land so that the move does not multiply their conflicts.

Before more Growth controls, get the owner's sign-off on the dimensions table in `docs/doc-growth.md` as the tab's spec. About ten controls were built and removed within 30 hours on 2026-10-23 and 2026-10-24, and the measure that defines the chart was decided last. The same document's "The Growth tab" section is per-view prose of the kind `f60062c` retired from `docs/views/`; cut it to the address keys, the sources and the counting rules.

## Decisions for the owner

1. **#1087's documentation sign-off.** It unblocks item 7 and makes item 6's tracker claims true. Recommended: review its five documents first, because three tasks and two drafts wait on them.
2. **The pivot stack.** #1088 is an ancestor of #1093, which is an ancestor of #1095, and #1095 also carries 9 of #1079's 17 commits. The declared landing order (#1079, then #1088, #1093 and #1095) is the reverse of what merges. #1095 is the only member current with main and clean, so merging it would land the other two under a title about a concept page. Recommended: land the stack through #1095, retitled to say what it carries; close #1088 and #1093 as carried; then bring #1079's other eight commits up to date. Going bottom-up costs two merges of branches 106 commits behind. Whichever of #1079 and the stack lands second must resolve `lib/alpineComponents/viewer.js` by hand.
3. **Merge order across three repos.** web-tools-private #141 first, then web-tools #1096 and home #870, as #141's open thread says. In the other order, sessions in between record no startup context. #1096 is green and clean; #141 has no check runs.
4. **Link work to the declared goals, or decide not to.** No task, program or PR cites a key from [aims-goals.csv](../docs/aims-goals.csv) or [aims-initiatives.csv](../docs/aims-initiatives.csv). The Purpose tab can show the goals but not motion toward them, so "is the effort serving the goals" can be answered only by a hand classification like the momentum lens's. The tracker already rolls any scalar frontmatter key into `board-tags.csv` ([TRACKER.md](../docs/TRACKER.md), "Open tags"), so an `initiative:` tag costs one line per task and no code. Recommended: tag the on-deck tasks only, and judge after a month whether the count is worth reading.
5. **Declare the review's extension points for web-tools.** Home's CLAUDE.md declares the probes, lenses and destinations that the `repo-review` skill reads. web-tools declares none, so this run designed its own. Recommended: declare the probes and the lens kinds that paid (below), with `research/` as the destination.

## Backlog verdicts

The 16 on-deck tasks at `764ba4c`, read against main's tree by the backlog lens and spot-checked.

| Task | Verdict | Reason |
| --- | --- | --- |
| `align-map-view-cleanup-40afu8` | partly done, L to M | items 1 and 3 and four of item 6's leftovers are done; item 5 waits on #1087 |
| `brief-from-the-pages-gallery-7d4031` | ready, S | no address key opens the drawer to a menu yet |
| `enforce-house-style-ryz0z5` | partly done, S | stat-card detection exists in `page-measures` but only reports; the scan roots are unchanged |
| `fab-capture-button-f6q38m` | ready, S | `captureData()` is still clipboard-only; `probe.js` already files captures to `logs/page`, so `state/captures/` needs a reason |
| `file-history-in-branch-view-hxtdep` | waiting on the wrong actor | 32 days with no user call; its own log says a session's survey comes next |
| `growth-vs-reads-quadrant-ng3c97` | closed during the run (`4f5d613`) | the Growth chart answers it |
| `own-json-tree-retire-vje-i0lcj2` | ready, decided 2026-10-07, M | the body still says blocked (line 85); it overlooks `lib/kits/json-explorer.js`; sequence it after #1093 |
| `pane-width-not-window-width-wnabwo` | ready, S to M | viewport-prefix classes with no container queries: 47 in `estate.js`, 21 in `search-view.js` |
| `pdf-inspect-pinch-zoom-5wz3kt` | ready, decided 2026-10-07, M | `lib/kits/pdf.js:2038-2070` has a two-pointer pinch map to reuse |
| `pdf-table-splitter-page-q7vm2d` | ready, S to M | its scope includes reproducing an unconfirmed defect |
| `repos-grid-into-map-reach-1eheiq` | premise deleted, L | it routes through mechanisms `8ef2e7d` removed |
| `retire-shell-name-the-parts-r152bt` | ready, decided 2026-10-07, M | `__shell` now appears in 24 files, not about 40 |
| `stage-partial-file-selection-k8mtou` | ready but cold, M | no motion in three months; whether to set it dormant is the owner's call |
| `stranded-titles-panel-or-drop-o6hqom` | ready, one premise false, M | "the app holds none" is false: `estate.js` has 8 |
| `surfacing-gate-content-okwnp6` | ready, S | 12 rows now, not 21; its preferred phrase gate would fail all 12 until someone chooses the phrases |
| `views-forms-and-key-primitive-k5ngay` | partly done, L to M | part 1 reversed by #1091 and draft #1100; part 3 exists only on #1087 |

## Open pull requests

The 16 drafts at the run's start, from the PR lens. None had been overtaken by main, and only #1098 was red.

| PR | What | Verdict |
| --- | --- | --- |
| #1100 | Retire the per-type form docs | needs the owner; edits a task on its branch (item 6) |
| #1098 | Markdown section edit | red from its own commit's missing `docs/docs.csv` row; its session was active |
| #1096 | Context: CLAUDE.md recorded | waits on merge order (decision 3) |
| #1095, #1093, #1088 | The pivot stack | decision 2 |
| #1094 | One byte rule, one CSV parse, one strip driver | ready once it merges main and runs `npm run artifacts:refresh` |
| #1092 | Code jobs probe | stalled; conflicts in `docs/themes.csv` |
| #1089, #1087, #1074 | Map drafts | item 7 |
| #1081, #1075 | Look panel | merged during the run |
| #1079 | Workbooks on the Stage | needs the owner; shares `viewer.js` with the pivot stack |
| #1073 | Portable plugin evals | needs the owner; 166 commits behind |
| #1052 | cat-map skill | needs the owner (four calls); 166 commits behind |

## What the method taught

| Lens | Slice | Returned | Held on my check | Plausible | Weak or opinion |
| --- | --- | --- | --- | --- | --- |
| Probes (the session) | the suite, the scans, findings against user calls | 3 | 3 | 0 | 0 |
| Momentum | four weeks of main's history | 7 | 7 | 0 | 0 |
| Backlog | 16 tasks, the open findings | 6 | 6 | 0 | 0 |
| Docs against code | APP.md, app-routes.csv | 6 | 5 | 0 | 1 |
| Render | 72 addresses at two widths | 6 | 3 | 3 | 0 |
| Snags | 167 snags and their guards | 6 | 5 | 1 | 0 |
| Map tabs | 35 tabs and `map.js` | 6 | 4 | 1 | 1 |
| Open PRs | 16 drafts | 6 | 4 | 2 | 0 |

Of 46 findings, 37 held, 7 are plausible, 2 are weak or a matter of opinion, and none was rejected. That last figure needs a hedge. My checks re-read the cited lines and re-ran a few commands; they did not hunt counterexamples or break a guard to watch it fail. "None rejected" therefore measures how accurately the lenses cited their evidence, more than how right they were.

1. **Joins and execution found the consequential items; reading line by line found accurate, smaller ones.** Running things found the broken renderer, six app faults, the red suite and the shim's stale siblings. Joining two records found the rest of the top items: tracker claims against open PR heads, findings against user calls, snag ids against the code (a grep plus `git blame`, which turned up three October bites the snag list never dated), deletion commits against the documents that described what they deleted, and a tab's loaders against its Sources list. Reading APP.md claim by claim checked 46 claims and found 6 wrong, which is accurate and lower in consequence.
2. **Every lens reached the same conclusion about itself.** Asked what it would aim differently, each named a join or a run as the better start: deletions and then their readers (docs); tracker claims against draft branches (backlog); the PR stacking graph and the tracker join (PRs); snag-id greps and deliberate breakage of guards (snags); a signed-in render pass with position checks (render); drafts and the tracker against main, in place of file-level counts (momentum); PR review comments, since no visit record exists (Map).
3. **Convergence is the best confidence signal a fan-out produces.** Lenses that shared no notes reached four findings independently: #1087's work recorded as landed (three lenses), the Tending record overstating open work (two), two readership counts on the Docs tabs (two), and the sandbox-red suite (two).
4. **The sandbox nearly corrupted the counts twice.** The web-tools clone was shallow, so 868 commits looked like three weeks of history and were ten days. The registry checkout was 108 commits behind its origin when the findings were recounted. Fetch before counting, and date each claim to a SHA.
5. **Some lens methods returned nothing.** The PR lens's residue test said nothing, since every draft was novel. File-level area counts could not tell owner-directed iteration from churn without reading commit bodies. No record says which views or tabs anyone opens: the visit log lives in each browser's storage, capped at 25 entries, so the Map lens's read evidence rests on proxies (owner prompts, links handed over).

## Proposed tasks

For the owner to approve as one batch through `/tasks`. Items 1 to 6 above are one PR each and need no task if a session takes them now.

1. Layer the kit stylesheets, with a `css-blocks.py` check (item 8).
2. Check hand-built render and look links in `reply-check.py` (item 8).
3. Pilot moving the Growth tab out of `map.js` (item 9), after item 7.

And one grooming pass over the board, on main: rewrite `align-map-view-cleanup-40afu8` (most items done; its keep-the-aliases premise contradicts the snag `retired-address-kept-alive`), `repos-grid-into-map-reach-1eheiq` (routing premise deleted), `views-forms-and-key-primitive-k5ngay` (part 1 reversed, its Done-when obsolete), `own-json-tree-retire-vje-i0lcj2` (name `json-explorer.js` as the candidate tree, delete the stale "Blocked" paragraph), `surfacing-gate-content-okwnp6` (12 rows) and `file-history-in-branch-view-hxtdep` (its `awaiting: owner` names the wrong actor).

## Scope and limits

The run did not see GitHub's live responses (rate limits, real 401 and 403 paths), phone-only behaviour (touch, pinch, the iOS sheet), CI runs, or the contents of private-repo PRs. The render pass ran with the live API off and a stand-in token, so token-gated views rendered against the registry's checkout rather than GitHub. Home's clone was shallow, and its history was not read for trends.
