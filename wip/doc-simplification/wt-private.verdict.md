# Verdicts: wt-private

Checked against web-tools-private at `08f775b` (2026-09-27). Word counts were re-run with `sed -n | wc -w` and match the proposal's figures for every span it names. The file totals are also right: `sessions/README.md` 11,350, `DESIGN.md` 3,307, `shortcuts/README.md` 2,291, `README.md` 1,232, `proposals/README.md` 865.

All four "wrong today" claims hold. Stop timing: `sessions/README.md:923` says Stop "fires once per assistant turn", and web-tools `docs/environment/extending.md:155` says it fires on idle and an auto-continued turn produces none. `quickLinks` and `repos`: the root `.web-tools.json` holds neither key, `docs/manifest-fields.csv:3` says there is no central registry, and the only live mention of `quickLinks` in web-tools code is a comment (`lib/alpineComponents/stage.js:5417`). `mailbox/`: absent; `errands/README.md:15` records the rename. `session-load-conventions.sh`: exists nowhere on disk. The `lib/repo-*-cache.js` paths do not exist; the files are under `lib/kits/`.

## 1. Collapse the schema history in `sessions/README.md` to a field reference; the rationale already lives in `record.py`

**Verdict:** revise

**Checked:** The duplication claim holds for most of the cited passages. `record.py:24-40` has the schema-number story, `:104-122` the answering half and the 464 KB measurement, `:124-148` the bounds and head-and-tail measurement, `:163-173` the schema-3 receipt measurement, `:380-392` the redactor, `:412-414` the credential grep and the rotate remedy, `:812-817` the `isSidechain` finding, `:835-839` the 38 MB, `:852` the 25-day wake, and `:46` the `injected_total` discriminator for the two schema-8 shapes. Two findings are **not** in `record.py`. The first is "The later pass" (`README:629-667`): the 1,078 clipped calls, the 68 percent file read-backs, and the 107-call residue, which the README keeps "so it is not rediscovered as a surprise". A grep for `1,078`, `8,634` and `107 calls` in `record.py` finds nothing. The second is the `subagents/` survival boundary, "between three days and three weeks" (`README:612-620`), which is also absent from `record.py`. So "each narrative exists twice" is false for these two, and deleting them loses them.

The proposal also removes consumer-facing reading rules that are not bounds or invariants. A renderer or a reader of the store needs them: merge `prompts`, `replies` and `calls` on `at` to rebuild a conversation (`:230-236`); `exchanges` against `prompts_stored` and `replies_total` against `replies_stored` tell a complete record from a capped one (`:70-74`); `last_message` is the only assistant text in schema 1 to 3, and `repo-sessions-cache.js:366-400` reads it; `replies_elided` and `replies_clipped` are 0 from schema 5 but still read by `session-render.js` (`:250-253`); `bodies_dropped` is policy and `bodies_elided` is the budget (`:579-583`); pre-schema-11 records are split on read by `search.py` (`:83-85`); from schema 12, `origin` is provenance and not kind (`:98-106`); `sample-record.json` is a frozen schema-2 exhibit (`:549-558`). A "one line per field" table does not carry these unless the rows are written to.

There is one missed inbound citation: `record.py:657` cites README section "What is bounded", which this proposal renames to "Bounds". The `search.py:46` citation of "Nothing captured is rewritten on its way in" is correctly handled.

**Revised proposal:** Do the collapse as proposed, with three changes. (1) Add a short "Reading a record" list after the invariants, one line per rule listed above. That is about 300 words. (2) Before deleting "The later pass" and the wake paragraph, move two sentences into `record.py`: the clipped-bytes breakdown with the 1.3 percent residue beside `BODY_CAP`, and the three-days-to-three-weeks boundary beside `merge_agents`. The pointer sentence is then true. (3) Keep the words "What is bounded" in the bounds heading, or repoint `record.py:657` in the same commit.

**Corrected words removed:** about 3,000 of 4,303 (about 1,300 kept).

## 2. Merge the three session-name sections and their three echoes into one "Session identity" section

**Verdict:** keep

**Checked:** The word counts are right (`:263-321` 607, `:323-402` 738, `:404-470` 633, `:866-886` 228, `:1094-1108` 193, `DESIGN.md:161-176` 197). The title story is told in all the places named. Inbound citations are confirmed: `search.py:31` ("The third name"), `search.py:239` (cites a section, "The title is not obtainable from inside the container", that exists nowhere; the fix is warranted), `repo-sessions-cache.js:31` and `:1365` (the full heading "The third name, and why the record cannot have it"; a partial match still lands), `app/index.html:3624`, and `DESIGN.md:175` (the anchor). The claim that no dated record of the eight-route investigation exists outside the README holds: `probes/` holds one unrelated file, and home `chron/2026/08/` has no match. One detail is wrong. Live title coverage is shown in the **State** view (`state-view.js:2399-2423`, `titlesOf`: named, total, unjoinable, staleness), not the Sessions pane. The argument for dropping the 2026-08-19 snapshot table still holds.

**Corrected words removed:** about 2,150.

## 3. Cut "How recording happens" and "Known limits" to the store side, and link web-tools for the hook side; fix the Stop timing that web-tools has since corrected

**Verdict:** revise

**Checked:** The contradiction is real: `sessions/README.md:923` and `:946-947` against `extending.md:155`. `:1136-1137` repeats it ("loses at most the turn in progress, since every completed turn publishes"). The restatement is real: `:1030-1041` and `:953-969` match `extending.md:147-149` down to the 2026-07-30 measurement. The closed-problem claim holds: `extending.md:163-171` documents `invoke-sessions.sh` and `SESSIONS_STORE_REPO`, which contradicts "No code here can fix it" at `:1118-1120`. The opt-out condition is confirmed at `extending.md:216`. The four environment variables are `SESSIONS_SYNC_SECS`, `SESSIONS_BRANCH`, `SESSIONS_STATE_DIR` and `SESSIONS_STAGE` (`:1014-1020`). The anchor `#stop-the-session-recorder` resolves (`extending.md:141`, cited from its own `:15`). The span's word count is right at 2,205.

Two things the proposal would cut are still needed. (1) The `ended` semantics, `ended` means "as of the last Stop", never "final" (`:940-942`), is a field meaning a consumer relies on, and no field-table row carries it. (2) `sessions/README.md:37` cites "The mechanics" by name, so the kept store-side block must keep that heading. The `install-hook.sh` line should also stay, reworded rather than dropped. The script exists, and its own header (`install-hook.sh:4-14`) defines it as the fallback where the plugin is absent or for testing `on-stop.sh`. That is a store-side fact, not a restatement.

**Revised proposal:** As proposed, plus: keep the heading "The mechanics"; add `ended` ("as of the last Stop, never final; no hook fires when a container is reclaimed") to the field table or the kept limits; keep one line naming `install-hook.sh` as the fallback. State the loss window as "until the next idle", with the link to the web-tools measurement.

**Corrected words removed:** about 1,750.

## 4. Replace `DESIGN.md`'s derived-cache prose with a table that links web-tools, and delete its dead sections

**Verdict:** revise

**Checked:** The drift is worse than the proposal says. `DESIGN.md:95` gives the activity throttle as "~12h" and `:135` gives the sessions throttle as "~3h". `app/index.html:3612-3617` sets sessions to 15 minutes and describes the activity sibling at 30 minutes. The owners cover what the proposal says they do. `docs/manifest.md:237-256` covers the config cache, the refresh model and the source-of-truth rule. `docs/views/branches.md:31-60` covers the activity cache, including `branchPulls` and the `needsScan` carry rule, which replaces `DESIGN.md:108-114`. `docs/views/state.md:51-59` covers the `runs` ring and `calls.json`; the proposal cites `:54-62`, which is off by a few lines. The `titlesAt` design is in `repo-sessions-cache.js:1632-1641`. `collapse-quicklinks-projection-80oprp` has `status: done`. `docs/CONVENTIONS.md` is gone.

Three specifics are wrong. (1) `state/calls.json` is not built by `lib/kits/crawl-runs.js`. It is written by `saveCrawlCalls` in `app/index.html:4057` and rendered by `state-view.js:862`, where the overwrite rationale lives. (2) The five-row table omits two things `state/` holds today: `state/session-menu.json` (`lib/ops/session-menu.js`) and `state/sessions-index/` (`lib/kits/session-index.js`). DESIGN documents neither today, so this is the moment to add them. (3) "Thumb cache is `thumbs/README.md` twice" is mostly true, but DESIGN carries two facts `thumbs/README.md` lacks: a page with no cached shot keeps the live render default, and unlike `state/`, the shots are not written by the browser crawl because they need headless Chromium. `thumbs/README.md:27` points back at DESIGN "Thumb cache" for exactly this.

The dependency list is also missing two items. `app/index.html:3265` and `:3609` send a reader to DESIGN for the activity and sessions cache designs, which will now be table rows. They still resolve, but should name the web-tools doc instead.

**Revised proposal:** As proposed, with the `calls.json` row naming `saveCrawlCalls` (`app/index.html`), two added rows for `session-menu.json` and `sessions-index/`, and the two thumb sentences moved into `thumbs/README.md` with its back-pointer removed. Also drop "mailbox" from the intro list at `DESIGN.md:9` and `:12`.

**Corrected words removed:** about 1,750.

## 5. Make `README.md` a one-screen folder index and stop it restating `DESIGN.md` and web-tools; retire the `quickLinks` and `repos` documentation

**Verdict:** keep

**Checked:** The word counts are right (`README.md:10-136` 1,072; `DESIGN.md:19-67` 521). The keys are confirmed by the `json.load` one-liner. `docs/views/todo.md:9-13` carries the to-do shape with `urgent` and `due`, which `README.md:47` lacks. `docs/manifest.md:102-118` owns `hidden`. home `projects/surfacer/` has no `VISION.md`, only `README.md`, `app` and `docs`. `docs/stage.md:15` records that the stage stopped saving on 2026-08-27. `README.md:129-136` names one `state/` file, while the folder holds six files plus `sessions-index/`. Of the folders the proposal names, `data/`, `inquiries/`, `logs/`, `notes/`, `probes/` and `sites/` have no README, so their owner column has to say "none" or point at web-tools. `notes/` belongs to `docs/views/todo.md` and the notes skill. The `install-hook.sh` line at `:107-108` is misleading rather than wrong: the script is the documented fallback (see proposal 3), so reword it rather than delete it.

**Corrected words removed:** about 1,150.

## 6. Move the `search.py` usage prose into the tool's own `--help`, and let the README say "run `--help`"

**Verdict:** keep

**Checked:** `python3 search.py --help` shows no help text for `--since`, `--until`, `--repo`, `--grep`, `--tool`, `--show`, `--limit`, `--stats` and `--json`, and it shows `--surplus`, which the README block omits. The docstring (`search.py:2-14`) says `--grep` covers "the opening ask, every stored prompt, and the closing message". The code searches `replies` too (`search.py:223-231`), so the docstring is a third, stale copy. `README:898-899` ("387 across the 17 schema-2 records") is stale. The span is 847 words. The double count with proposal 2 is handled correctly.

**Corrected words removed:** about 570 beyond proposal 2.

## 7. Cut `proposals/README.md` to a stub that links the web-tools contract, and fix its dead `mailbox/` links

**Verdict:** keep

**Checked:** `proposals/README.md:3`, `:13` and `:15` reference `mailbox/`, and the folder is gone. `docs/manifest.md:363` opens the Proposals section. It covers `deliver` (`:432-449`), `proposals/attempts/` (`:481-483`), the named-kind argument against `graphql-mutation` (`:410`), and `expectComments` and `expectTitle` (`:422`). `lib/kits/repo-proposals.js` exists. The 865-word count is right.

**Corrected words removed:** about 800.

## 8. Trim `shortcuts/README.md` to the folder map and the one regeneration command; the per-tool commands, renames, tiers and corpus findings each have an owner

**Verdict:** keep

**Checked:** `fold-incoming.py:142-172` (`regenerate`) runs `index-dump.py`, `survey.py` twice, `sketch.py` and `harvest.py` in order, so the four per-tool invocations are redundant. `survey.py:48` (`HUBS`) and `:221-227` (`TIERS`) match the tier table. `core/harvest.json` holds the three renames and two drops. `shortcut-tools/docs/idioms.md:252-280` holds the renames, both rejections and the five ambiguous names. The self-call count is at `idioms.md:36` and `shortcuts-format-notes.md:854`. `fold-incoming.py:173` prints "see shortcuts/README.md", and the proposal handles it. The span counts are right. One clause is worth keeping in the Credentials collapse: the archive holds 577 shortcuts where the device dumps totalled 579, because two were dropped (`:284-285`). Without it, a later count comparison reads as a fold bug.

**Corrected words removed:** about 830.

## 9. Rewrite the `startup_context`, `startup_delivery` and `repos` notes as field-table rows; the examples describe retired mechanisms

**Verdict:** revise

**Checked:** `session-load-conventions.sh` does not exist. The only `[startup-context]` emitter is `home/.claude/hooks/session-memory-manifest.sh:124`, which writes `basis: "reconstructed"` (`:90`). So **nothing emits `receipt` today**. The proposed row text ("`receipt` when an injecting hook printed a line") describes a path with no live producer and should say so. `docs/CONVENTIONS.md` is gone. Two claims in the proposal are off. (1) The 28,670-to-2,238 measurement is dated 2026-08-30, and home's `chron/2026/08/2026-08-26-the-injection-delivers-five-percent.md` predates it and does not contain those numbers. The measurement's second home is `record.py:317`, so it survives the cut, but not where the proposal says. (2) The stale `CONVENTIONS.md` duplicate example is also in `record.py:264-268`, and `session-memory-manifest.sh:16-17` still says "the conventions hook beside it emits basis:receipt". Fixing only the README leaves two stale owners. The span is 619 words.

**Revised proposal:** As proposed, with the `basis` row reading: "`receipt` from an injecting hook that reports what it supplied (none does today; records from before 2026-09-09 carry them); `reconstructed` from `session-memory-manifest.sh`." In the same PR, fix the `CONVENTIONS.md` example in the `record.py:264-268` comment. Leave a note for home on the `session-memory-manifest.sh:16-17` comment, since that file is in another repo.

**Corrected words removed:** about 480.

## Missed

**Merge `DESIGN.md` into `README.md`.** Proposals 4 and 5 together leave `DESIGN.md` at roughly 1,100 words: the intro, a layer statement, the derived table, two standing decisions (`:8-13`, `:201-225`) and the entity-index section (`:314-337`, 223 words). Proposal 5's folder table already carries a layer column. That makes the README table and the DESIGN layer list two indexes of the same folders. One file would hold the table, the two standing decisions and the entity index, and would remove about 250 words of overlap plus a file hop. The inbound links to repoint are `thumbs/README.md`, `sessions/README.md:13`, `state-view.js:14` and `:944`, `app/index.html:3265` and `:3609`, `repo-activity-cache.js:10` and `docs/manifest.md:256`. That is eight sites, which is why this is worth doing only in the same pass as 4 and 5.

**The captured-layer argument is stated three times.** It appears at `README.md:94-97`, `DESIGN.md:178-181` and `sessions/README.md:11-21` ("Why this is a third layer", 110 words), in nearly the same words ("a lost captured file is gone"). Keep it once, in the layer statement, and link it from the other two. This saves about 150 words.

**Stale injection examples outside proposal 9's span.** `sessions/README.md:493` in "File attention" (`:472-514`, which no proposal touches) still names `CONVENTIONS.md` as a startup-injected document. The same edit as proposal 9 should replace it with the current injected set (`SURFACING.md`, `QUALIFIED-WRITING.md`).
