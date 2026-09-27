# Slice: wt-private

## Summary

This slice is the living documentation of `mehrlander/web-tools-private`: `sessions/README.md` (11,350 words), `DESIGN.md` (3,307), `shortcuts/README.md` (2,291), `README.md` (1,232), `proposals/README.md` (865), and eight small READMEs (about 1,700 words together). The total is about 20,700 words, and `sessions/README.md` alone is 55 percent of it.

The dominant bloat is **schema archaeology written twice**. `sessions/README.md` narrates each schema change (what schema N cut, what it was measured against, how the number 8 was claimed twice), and `sessions/tools/record.py` carries the same narratives as comments beside the constants they justify. The second source is **restatement of web-tools docs**: the Stop hook's distribution argument (web-tools `docs/environment/extending.md`), the derived caches (web-tools `docs/views/*.md` and `docs/manifest.md`), and the proposal record contract (web-tools `docs/manifest.md`, "Proposals"). The third is **staleness that the duplication produced**: `DESIGN.md` still documents a `mailbox/` folder that was renamed `errands/` on 2026-09-24, `proposals/README.md` links to it, `sessions/README.md` explains `startup_context` through a home hook that no longer exists, and it says Stop fires once per assistant turn while web-tools measured on 2026-09-21 that it fires on idle.

Proposals are ordered by words removed.

## 1. Collapse the schema history in `sessions/README.md` to a field reference; the rationale already lives in `record.py`

**Repo:** web-tools-private

**Targets:** `sessions/README.md:70-123` (the prompts/injected accounting and the "Schema 8 was claimed twice" story), `:186-261` ("What is bounded", "The answering half"), `:516-584` ("Tool calls"), `:586-736` ("The transcript can come back short", "The later pass", "What schema 3 cut", the redactor paragraphs, "Where the records are read", "What is still absent"), `:738-826` ("The fan-out half" and its four subsections).

**Kind:** collapse-narrative

**Proposal:** Rewrite these spans as one section, "The record", with three parts. (a) The existing field table at `:45-68`, extended with the `calls` table from `:529-536` and the `agents_*` rows, one line per field. (b) A "Bounds" list of one line per bound, each naming a constant in `record.py` and stating the rule once: results are the only bounded content; failing bodies keep 2 KB head and tail (`FAIL_CAP`); succeeding bodies keep 1 KB tail-weighted (`BODY_CAP`); receipts and successful `Read` keep no body (`NO_BODY_ON_SUCCESS`); 256 KB of bodies per record (`BODY_BUDGET`); agents follow the same policy under `AGENT_BUDGET`. `bytes` and `sha` ride every call regardless. (c) An "Invariants" list of four lines: a record is rebuilt whole on every Stop; the captured half never shrinks (`merge_captured`, `merge_agents` union with the prior record); the record path is pinned to the session id (`record_path`); nothing captured is rewritten on its way in. End with one sentence: "Why each bound and invariant has its value, with the measurements, is in the comment above its constant or function in `tools/record.py`." Delete every "Measured YYYY-MM-DD on the session that..." paragraph, the schema-number merge story, the "later pass" percentage table, and the "What schema 3 cut" table.

**Rationale:** Each narrative exists twice. `record.py` carries the schema-number story (`record.py:24-40`), the answering-half argument and its 464 KB measurement (`:104-122`), the tool-call bounds and the head-and-tail measurement (`:124-148`), the schema-3 receipt measurement (`:163-173`), the redactor removal with its examples (`:380-392`), the `isSidechain` finding (`:812-817`), the 38 MB of `skill_listing` attachments (`:837`), and the 25-day wake (`:852`). The comment is the owner, because it sits beside the constant a future change edits. The README copy has already drifted from its owner: `:898-899` still calls `bodies_elided` "currently the loudest, at 387 across the 17 schema-2 records", a claim about a store now at schema 12. The doctrine question "does another document own it" answers yes for every one of these paragraphs.

**Evidence:** Word counts by `sed -n | wc -w`: `:70-123` 663, `:186-261` 753, `:516-584` 678, `:586-627` 393, `:629-667` 385, `:669-736` 611, `:738-826` 820. The duplicated passages are listed under Rationale with their `record.py` line numbers.

**Words removed:** about 3,400 of 4,303 in the target spans (the field tables, the bounds list and the invariants list keep about 900).

**Inbound dependencies:** `sessions/tools/search.py:46` cites the heading "Nothing captured is rewritten on its way in"; keep that phrase as the fourth invariant's text so the citation still resolves. `web-tools/lib/kits/session-render.js:4` calls the README "the schema"; the field table still serves that. `web-tools/lib/kits/session-render.js` reads `replies_elided` and `replies_clipped`, which stay in the field table. No script parses the README. `.paths.json` names `sessions/README.md` only as prose ("Described in sessions/README.md"); keep one line on `sample-record.json`.

**Risk:** Low. A reader loses the measured history in the README but keeps it in `record.py` comments and in git. The one real cost is that a reader who never opens `record.py` no longer sees the reasoning. The closing sentence names where it is.

## 2. Merge the three session-name sections and their three echoes into one "Session identity" section

**Repo:** web-tools-private

**Targets:** `sessions/README.md:263-321` ("The two names one session has"), `:323-402` ("The third name, and why the record cannot have it"), `:404-470` ("The title, joined from another venue"), `:866-886` (the `--name` axis prose), `:1094-1108` (the Known limits bullet "A record cannot carry the session title"), and `DESIGN.md:161-176` (the `title` paragraph under `state/sessions.json`).

**Kind:** merge

**Proposal:** Replace the three sections with one, headed "Session identity (the third name)" so that code comments citing "The third name" still land. It carries four short paragraphs. (1) A record is keyed by the transcript uuid from the Stop payload. (2) `agent_session` is read from `CLAUDE_CODE_REMOTE_SESSION_ID` (same ULID, `cse_` prefix swapped for `session_`), with the `Claude-Session:` trailer scan as a cross-check, and the environment wins a disagreement; records before 2026-08-06 have no `agent_session` and fall back to `repos[].branch`. (3) The title cannot be read from inside a container; keep the eight-route table at `:339-348` as the evidence and drop the prose around it (`:350-402`). (4) The title is joined in the derived layer by web-tools `lib/kits/repo-sessions-cache.js` from the dated sidebar export in `mehrlander/chat-histories`, keyed on `agent_session`, falling back per row to the branch slug; link that file for coverage and cadence. Delete the `:1094-1108` limits bullet and the `:866-886` `--name` prose (the flag's help string covers it; see proposal 6). In `DESIGN.md`, cut `:161-176` to one sentence pointing at the new section.

**Rationale:** The title story is told four times: at `:323-402`, at `:404-470`, in the Known limits bullet at `:1094-1108` ("Eight routes were tested on 2026-08-10 and all are closed ... 44 of the 143 rows"), and in `DESIGN.md:161-176` ("A session's real title reaches no container ... Coverage, the join key, and why most of the store can never be titled: sessions/README.md"). The `--name` prose at `:866-886` restates it a fifth time ("A record has no title, and the section above says why"). The two-names section spends 607 words on a correction narrative (`:281-286`, "This section said the opposite until 2026-08-07") and on trailer-scan caveats. The join's coverage numbers (`:427-442`, "measured 2026-08-19 against 143 rows") are a snapshot that the Sessions pane now shows live, so they have no second use. The cadence paragraph (`:467-470`) points to a tracker task, which owns it.

**Evidence:** Word counts: `:263-321` 607, `:323-402` 738, `:404-470` 633, `:866-886` 228, `:1094-1108` 193, `DESIGN.md:161-176` 197. Total 2,596.

**Words removed:** about 2,150 (the merged section keeps about 450, including the route table).

**Inbound dependencies:** Code comments cite section names: `web-tools/lib/kits/repo-sessions-cache.js:31` and `:1365`, `web-tools/app/index.html:3624`, and `sessions/tools/search.py:31` cite "The third name". Keeping those words in the new heading preserves them. `sessions/tools/search.py:239` already cites a section that does not exist ("The title is not obtainable from inside the container"); fix it to "Session identity" in the same commit. `DESIGN.md:175` links the anchor `#the-title-joined-from-another-venue-2026-08-20`; update it. `web-tools/tracker/tasks/session-titles-from-export-4vgu4x.md` links the README; tracker files are out of scope, and a whole-file link still resolves.

**Risk:** Low. The investigation that closed eight routes survives as the table, which is the part that stops a session from trying again. The narrative of the rename test and the credential probes leaves the README but has no dated record anywhere else (home's `chron/2026/08/` and this repo's `probes/` hold none), so if the owner wants it kept outside git history, move `:350-402` verbatim to `probes/2026-08-10-session-title-routes.md`, where the repo already keeps dated investigations, rather than keep it in the contract.

## 3. Cut "How recording happens" and "Known limits" to the store side, and link web-tools for the hook side; fix the Stop timing that web-tools has since corrected

**Repo:** web-tools-private (reads web-tools `docs/environment/extending.md` and `docs/environment/container.md` as owners)

**Targets:** `sessions/README.md:921-947` ("What counts as a response"), `:953-969` (the first mechanics bullet, on plugin distribution), `:1002-1012` (the gitignore and `skip-worktree` story), `:1030-1084` (Known limits bullets one and two, the per-container install and the pinned snapshot), `:1085-1093` (the web-tools opt-out bullet), `:1109-1110`, `:1113-1120` (a session without the checkout records nothing), `:1122-1137` (presence is not use), `:1138-1144` (unrecorded sessions on 2026-07-30).

**Kind:** link-to-owner

**Proposal:** Keep only what the store owns: `on-stop.sh` runs `record.py` then `sync.sh`; `sync.sh` builds a plumbing commit against `origin/main` and never touches the checkout; it stages named record paths, never the tree (`test-sync.sh` pins it); a Stop that arrives mid-push marks pending and the holder loops (`test-onstop.sh` pins it); the live record is written to `SESSIONS_STAGE`, never the working tree; the four environment variables; every entry point exits 0. That is about 250 words, one line per fact. Replace everything about how the hook reaches a container, when Stop fires, and why a per-container install fails with one sentence: "The Stop hook that calls `tools/on-stop.sh` ships in the `portable` plugin; how it finds this store, when it fires, and why it is not installed per container are in web-tools [`docs/environment/extending.md`, "Stop: the session recorder"](https://github.com/mehrlander/web-tools/blob/main/docs/environment/extending.md#stop-the-session-recorder)." Replace the no-checkout bullet with one sentence naming `SESSIONS_STORE_REPO` (set by `environment/setup.sh`) and the `/portable:sessions` skill. Move the "presence is not use" caveat into the `repos` and `attached` rows of the field table, where schema 8's `attached` field already answers it. Delete the 2026-07-30 bullets outright.

**Rationale:** Three problems in one span. **It restates web-tools.** `:1030-1041` ("a thing installed per container is not installed") and `:953-969` are the same argument as `extending.md:147-149`, down to the same measurement ("On 2026-07-30 the store held one record ... At least four other sessions ran that day"). `:1042-1084` is `container.md:36-52` and `:115-123` ("account skills sync every container and account plugins do not"). **It is wrong where the copies diverged.** `:923` says "`Stop` fires once per assistant turn" and `:946-947` says publishing on every Stop "holds that window to a single turn, which is the floor". web-tools measured on 2026-09-21 that Stop fires on idle and an auto-continued turn produces no Stop (`extending.md:155`), so the loss window is until the next idle. The owner was corrected and the copy was not, which is the failure duplication causes. **It describes closed problems.** `:1113-1120` says "No code here can fix it ... Carrying this repo in every session's sources is the whole remedy"; since web-tools #747 the plugin's session-start directive reads `SESSIONS_STORE_REPO` and the sessions skill attaches the store (`environment/README.md:14-21`, `extending.md:179`). The two 2026-07-30 bullets record an incident whose fix shipped. The `skip-worktree` story (`:1002-1012`) justifies a design choice that `test-sync.sh` already pins.

**Evidence:** Word counts: `:916-947` 292, `:949-1026` 838, `:1028-1146` 1,268 less the title bullet `:1094-1108` (193, counted in proposal 2); total 2,205. The contradiction: `sessions/README.md:923` against `web-tools/docs/environment/extending.md:155`.

**Words removed:** about 1,800 (the store-side mechanics keep about 250, the limits keep about 150: the reparse cost, the loss window, and pre-store sessions existing only as chat history).

**Inbound dependencies:** `web-tools/.claude/skills/hooks/session-record.sh:10` points at `docs/environment/extending.md`, not here, so the hook's own citation already goes to the owner. No script reads these sections. `README.md:107-108` tells a reader to "set up recording in a fresh container with `sessions/tools/install-hook.sh`", which is the per-container route this span calls a failure; fix it with proposal 5.

**Risk:** Low. The opt-out bullet (`:1085-1093`) records a live condition (web-tools' project settings disable the plugin). `extending.md:216` already records that project settings are not read in a multi-repo session, which is the condition that makes it harmless, so one sentence and that link keep it.

## 4. Replace `DESIGN.md`'s derived-cache prose with a table that links web-tools, and delete its dead sections

**Repo:** web-tools-private (reads web-tools `docs/views/state.md`, `docs/views/branches.md`, `docs/views/sessions.md`, `docs/manifest.md` as owners)

**Targets:** `DESIGN.md:68-176` (Derived: the `runs` ring, `configs.json`, `activity.json`, `calls.json`, `sessions.json`), `:189-199` (source-of-truth rule), `:227-234` ("Refresh model"), `:236-259` ("Thumb cache"), `:261-283` ("Mailbox"), `:285-312` ("Future ideas").

**Kind:** link-to-owner

**Proposal:** Replace `:68-176` with a one-paragraph statement of the layer (derived: regenerated by show-repo's crawl, never hand-edited, committed only on material change) and a five-row table: file, built by, documented in. The rows are `state/configs.json` (web-tools `lib/kits/repo-config-cache.js`, `docs/manifest.md` "Config cache"), `state/activity.json` (`lib/kits/repo-activity-cache.js`, `docs/views/branches.md` "The activity cache"), `state/sessions.json` (`lib/kits/repo-sessions-cache.js`, `docs/views/sessions.md` "The sessions cache"), `state/calls.json` and the `runs` ring (`lib/kits/crawl-runs.js`, `docs/views/state.md`), and `state/entities.json` (keep the existing "entity index" section, which has no owner elsewhere). Delete "Refresh model" (`:227-234`) and cut the source-of-truth rule (`:189-199`) to one sentence linking `docs/manifest.md` "Config cache". Replace "Thumb cache" with one line linking `thumbs/README.md`. Delete "Mailbox" and replace it with one line: "`errands/` is the agent-to-browser request channel; see [errands/README.md](errands/README.md)." Delete "Future ideas", or keep only the GraphQL-batching bullet if the owner still holds it.

**Rationale:** **The derived section restates its owners and has drifted from them.** The `runs` ring paragraph (`:71-85`) is `docs/views/state.md:57-62` in more words. The `calls.json` paragraph (`:115-132`) is `state.md:54-55` ("It costs a commit per run, which is why it is a separate file"). The config cache and refresh model (`:86-89`, `:227-234`) are `manifest.md:237-256`, which even says "Design and future ideas: `web-tools-private/DESIGN.md`", so the two point at each other. The paths it cites are wrong: `lib/repo-config-cache.js`, `lib/repo-activity-cache.js` and `lib/repo-sessions-cache.js` (`:88`, `:93`, `:134`) do not exist; the files are under `lib/kits/`. The activity shape at `:101-106` omits `branchPulls`, which `branches.md:37` lists. The sessions-cache sizes (`:138-143`, "4.6 MB across 40 records (2026-08-05)") are a six-week-old snapshot. **Mailbox is dead.** `mailbox/` does not exist; `errands/README.md:14-15` says requests "were filed under `mailbox/` until" 2026-09-24, and web-tools `docs/manifest.md` "Errands" owns the contract. **Thumb cache is `thumbs/README.md` twice**, and `thumbs/README.md:30` points back here for "Rationale and the consumer path". **Future ideas is mostly done or obsolete:** the `quickLinks` projection bullet (`:295-299`) closed on 2026-07-28 as web-tools task `collapse-quicklinks-projection-80oprp` (status `done`), and the vendored-artifact bullet (`:300-308`) names `CONVENTIONS.md`, which no longer exists in web-tools `docs/`.

**Evidence:** Word counts: `:68-176` 1,203, `:189-199` 137, `:227-234` 77, `:236-259` 242, `:261-283` 204, `:285-312` 243; total 2,106. `ls lib/repo-*.js` in web-tools finds nothing; `ls mailbox` in web-tools-private fails.

**Words removed:** about 1,800 (the table, the layer paragraph and three pointer lines keep about 300).

**Inbound dependencies:** web-tools code comments cite `DESIGN.md` generally: `app/index.html:3265` and `:3609`, `lib/alpineComponents/state-view.js:14` (the authored, derived, captured split, which stays) and `:944` (entity-index freshness, which stays). `lib/kits/repo-activity-cache.js:10` cites `DESIGN.md "Activity cache"`, a heading that does not exist now; repoint it to `docs/views/branches.md`. `web-tools/docs/manifest.md:256` points here for "Design and future ideas"; drop "and future ideas". Tracker tasks citing DESIGN.md are out of scope.

**Risk:** Medium-low. The derived section is the one place that states the design reason for each cache in one view, for example why `calls.json` commits every run. Each reason already has a line in the owning doc, and a table row per file keeps the overview. Check `docs/views/branches.md` covers the `scan.mainSha` carry rule (`DESIGN.md:108-114`) before deleting; `branches.md:49-50` ("A verdict is carried when neither input moved") appears to.

## 5. Make `README.md` a one-screen folder index and stop it restating `DESIGN.md` and web-tools; retire the `quickLinks` and `repos` documentation

**Repo:** web-tools-private (reads web-tools `docs/manifest.md`, `docs/manifest-fields.csv`, `docs/views/todo.md` as owners)

**Targets:** `README.md:10-136` (the config, surfaces, lists, sessions, captures, environment and state sections) and `DESIGN.md:19-67` (the Authored bullets).

**Kind:** restructure

**Proposal:** Rewrite `README.md` as a two-sentence introduction plus one table, one row per top-level folder (`.web-tools.json`, `surfaces/`, `lists/`, `sessions/`, `captures/`, `device/`, `errands/`, `proposals/`, `shortcuts/`, `state/`, `thumbs/`, `environment/`, `.github/workflows/`, and the undocumented `data/`, `inquiries/`, `logs/`, `notes/`, `probes/`, `sites/`), with three columns: layer (authored, derived, captured), what it holds in under ten words, and the one document that owns its contract. Keep the runner paragraph (`:138-151`) as the `.github/workflows/` row plus its one reason (a self-hosted runner must not sit on a public repo). In `DESIGN.md`, cut the Authored bullets (`:19-67`) to one line each that name the field or folder and link its owner: `hidden` to web-tools `docs/manifest.md` (around `:102-118`), `lists/` to web-tools `docs/views/todo.md`, `surfaces/` to web-tools `docs/envelopes/surface.md`. Keep the `lists/autocorrect.json` paragraph (`README.md:67-77`), which has no other owner, as a short `lists/README.md` or as a comment beside `AUTOCORRECT` in web-tools `pages/dictate.html:377`. Delete every mention of `quickLinks` and `repos` as root config keys.

**Rationale:** **Two copies, both stale in different ways.** `README.md:15-31` and `DESIGN.md:22-44` both document `quickLinks` and `repos` as this repo's root config. The root `.web-tools.json` holds neither key (its keys are `icon, estate, group, order, note, hidden, scope, inbox, sessions, captures, notes, pages, checks, projects`), and web-tools `docs/manifest-fields.csv:3` says "Membership is a repo property; there is no central registry of repos". Both files also give the `hidden` rationale in parallel prose (`README.md:19-27`, `DESIGN.md:25-37`), which `docs/manifest.md:102-118` owns. The lists item shapes (`README.md:46-87`) are owned by `docs/views/todo.md:9-13`, and the README copy of the to-do shape has already lost `urgent` and `due`. The `surfaces/` bullets cite home `projects/surfacer/VISION.md`, which does not exist, and `DESIGN.md:48-50` says "authoring from the stage lands with that task", while web-tools `docs/stage.md:14-18` records that the stage's Saved view and surface authoring were removed on 2026-08-27. **The README's own summaries are wrong.** `:92` says records publish "on a throttle" (they publish every Stop, `sessions/README.md:1014-1015`); `:107-108` tells a reader to "set up recording in a fresh container with `sessions/tools/install-hook.sh`", the per-container route `sessions/README.md:1030-1041` calls a failure; `:129-136` lists one `state/` file where there are seven. **Folders exist with no entry at all:** `data/`, `inquiries/`, `logs/`, `notes/`, `probes/`, `sites/`, `errands/`, `proposals/`, `device/` and `shortcuts/` are absent from `README.md`. An index table makes an omission visible, where prose paragraphs hide one.

**Evidence:** Word counts: `README.md:10-136` 1,072 (config 205, lists 486, sessions 180, the rest 201); `DESIGN.md:19-67` 521. Keys verified with `python3 -c "import json; print(list(json.load(open('.web-tools.json'))))"`.

**Words removed:** about 1,150 (a 20-row table at about 12 words a row is about 250 words; the Authored bullets keep about 80; the autocorrect note keeps about 60).

**Inbound dependencies:** `thumbs/README.md` and `sessions/README.md:13` link `DESIGN.md` for the layer model, which stays. `web-tools/lib/alpineComponents/state-view.js:14` cites DESIGN's three-way split, which stays. Nothing links into `README.md` sections by anchor. Show-repo renders `README.md` as the repo landing, so the table is what a visitor sees first; that is an argument for the table.

**Risk:** Low. The only content with no other owner is the `autocorrect` rationale and the `kind` vocabulary argument (`README.md:56-66`); the latter is already in `docs/views/todo.md:24-27` in short form.

## 6. Move the `search.py` usage prose into the tool's own `--help`, and let the README say "run `--help`"

**Repo:** web-tools-private

**Targets:** `sessions/README.md:828-914` ("Use": the 17-line command block and seven paragraphs on the axes) and the argparse definitions in `sessions/tools/search.py`.

**Kind:** move-to-data-or-check

**Proposal:** Give every flag in `search.py` a one-sentence `help=` string drawn from the README paragraph about it: `--errors` ("failing calls, one per line; schema-1 records carry no calls"), `--attention` ("ranks by distinct sessions, not access count"), `--stats` ("clipped, dropped and elided are separate counters"), `--grep` ("searches asks, replies, and `last_message` for pre-schema-4 records"), and so on. Replace `:828-914` with three lines: "`sessions/tools/search.py --help` lists every filter. Filters combine with AND. `--attention` and `--corrections` print their own caveats." Keep the one sentence that links web-tools `docs/SNAGS.md` as the reason `--errors` exists, if the owner values it.

**Rationale:** The README and the tool already disagree. `search.py --help` lists `--surplus` ("closing states with no user prompt between them, the churn rate") and `--until`, `--limit` and `--json`, and the README's command block mentions none of them. Most flags in `--help` have no help text at all (`--since`, `--repo`, `--grep`, `--tool`, `--show`, `--stats`), so the one place a user types gets nothing and the place nobody opens at a terminal gets 708 words. The script's own docstring (`search.py:2-14`) is a third copy of the command block and says `--grep` looks at "the opening ask, every stored prompt, and the closing message", which omits `replies`, while the README (`:888`) says replies are searched from schema 4 on. Putting the explanation on the flag makes it one copy, and an argparse test can hold every flag to having help text. The README paragraphs also carry dated counts that no longer describe anything ("55 of the 58 records on file when the derived name landed carried a `claude/` branch", `:884-886`; "2.1% of 21,675 replies" `:910`).

**Evidence:** Word counts: `:828-914` 847, of which the prose after the command block (`:849-914`) is 708. `python3 sessions/tools/search.py --help` output confirms the missing help strings and the undocumented `--surplus`.

**Words removed:** about 800 from the README, of which the 228-word `--name` paragraph (`:866-886`) is also counted in proposal 2, so about 570 beyond it. The help strings add about 200 words to `search.py`.

**Inbound dependencies:** `web-tools/docs/views/sessions.md:14` names `search.py --show` and `:666-667` of the sessions README names `search.py --agents`; both flags stay. No other file cites the Use section.

**Risk:** Low. This edits code as well as prose, so it goes through a PR in web-tools-private with the store's tests (`sessions/tools/test-record.py`) run.

## 7. Cut `proposals/README.md` to a stub that links the web-tools contract, and fix its dead `mailbox/` links

**Repo:** web-tools-private (reads web-tools `docs/manifest.md`, "Proposals", as owner)

**Targets:** `proposals/README.md:1-157` (the whole file except the folder layout).

**Kind:** link-to-owner

**Proposal:** Replace the file with about 60 words: what the folder holds (`pending/<id>.json` written by a session, `applied/<id>.json` written by show-repo as the tombstone), that nothing applies without a two-tap confirm, and one link: "Record shape, the four kinds, staleness guards, delivery, and how to write `summary`, `why` and `caution`: web-tools [`docs/manifest.md`, Proposals](https://github.com/mehrlander/web-tools/blob/main/docs/manifest.md#proposals-proposalspending--proposalsapplied); validated by `lib/kits/repo-proposals.js`." Change the counterpart reference from `mailbox/` to `errands/`.

**Rationale:** The README's own last line names the owner ("Contract and validation: `web-tools/lib/kits/repo-proposals.js` ... Reference: `web-tools/docs/show-repo.md`"). The content is a copy of web-tools `docs/manifest.md:363-560`, which covers the same four kinds (`put-file`, `set-json-field`, `unset-json-field`, `delete-issue`), the named-kind argument against a general `graphql-mutation` (`manifest.md:410-413` against `README.md:83-85`), the `expectComments` and `expectTitle` guards, the permanent-deletion warning, and the three text fields (`manifest.md:546-555`). The owner has moved on and the copy has not: the owner documents `deliver` (commit or branch) and `proposals/attempts/`, which the README never mentions except as a refused field. The README also links `../mailbox/README.md` twice (`:3`, `:12`) and uses the mailbox as its comparison (`:15`); that folder was renamed `errands/` on 2026-09-24 (`errands/README.md:14-15`), so the first link on the page is dead.

**Evidence:** `wc -w proposals/README.md` is 865. `ls mailbox` fails in web-tools-private. web-tools `docs/manifest.md` "Proposals" section is about 1,870 words and a superset.

**Words removed:** about 800.

**Inbound dependencies:** No script reads `proposals/README.md`. A session writing a proposal is directed by web-tools docs and the app, not this file. `web-tools/tracker/tasks/cross-repo-edit-proposals-evo1ml.md` discusses the design and is out of scope.

**Risk:** Low. A session that opens only this repo gets one extra hop to the contract. The contract is public in web-tools and always reachable.

## 8. Trim `shortcuts/README.md` to the folder map and the one regeneration command; the per-tool commands, renames, tiers and corpus findings each have an owner

**Repo:** web-tools-private (reads shortcut-tools `tools/fold-incoming.py`, `tools/survey.py`, `docs/idioms.md` and `shortcuts/core/harvest.json` as owners)

**Targets:** `shortcuts/README.md:21-31` (the `index-dump.py` command), `:126-142` (the survey command and tier table), `:175-177` (the sketch command), `:196-223` (the harvest command, the renames, the rejected renames, the five ambiguous names), `:225-248` ("Read the dumps together"), `:250-270` ("Size is a property of four shortcuts"), `:272-294` ("Credentials") and the credential pointer at `:54-56`.

**Kind:** link-to-owner

**Proposal:** Keep "What is here" (one paragraph), "Regenerating" (the three `fold-incoming.py` and `freshness.py` lines), the sync-channel table, the app-view and `prune.json` paragraphs, and one line per derivative folder (`sketches/`, `core/`). Delete the four per-tool invocations, since `fold-incoming.py --regen` runs all of them in order and `freshness.py` checks them. Replace the tier table with "Tiers and their rules are defined in shortcut-tools `tools/survey.py` (`TIERS`) and shown on the Shortcuts app view." Replace `:205-223` with "The renames and dropped calls the harvest applies are `core/harvest.json`; the reasoning, including the renames rejected and the five still ambiguous, is shortcut-tools `docs/idioms.md`, 'What the corpus says is wrong'." Replace "Read the dumps together" with two sentences: read the dumps as one corpus because a folder dump names dependencies outside itself, and `survey.py --dangling` sorts what is missing. Collapse "Size" to one sentence (four shortcuts hold most of the bytes, as literal text; the folder is the size control on the clipboard route). Collapse "Credentials" to the standing rule: scan every new dump before committing, use `Inject-🎟️GitHubToken` rather than an inline token, and once a secret is on `main` the answer is to revoke it, not to rewrite history. Say it once, not at `:54-56` and again at `:291-294`.

**Rationale:** **The file argues against its own copies.** `:47-50` says the harvest's renames "lived only in this README's prose until then, which is why `core/` could not be checked and had fallen two shortcuts behind its own tier". The renames then appear in prose again at `:205-211`. `core/harvest.json` holds exactly those three renames and two dropped calls, and shortcut-tools `docs/idioms.md:252-280` holds the same renames, the same two rejections (`Speak-Text`, `Show-Template`) and the same five ambiguous names, word for word in places. **The tier table is the code's table.** shortcut-tools `tools/survey.py:48` names the three hubs and `:221-225` defines the tier labels and rules that `library.html` renders. **The self-call note is owned twice already** (`docs/idioms.md:36`, `docs/shortcuts-format-notes.md:854`, "55 shortcuts call themselves"). **The incident narrative outlived its use.** The Credentials section tells how two shortcuts were dropped from the fourteenth dump before a push; the rule it teaches is three lines, and `shortcuts/incoming/README.md:28-29` repeats the scan rule a third time. The Size table measures the first dump of 2026-08-13, which the file itself says it stopped doing for counts on 2026-09-05 (`:17-19`, "this file stopped restating them ... when every number it carried had been stale for a fortnight").

**Evidence:** Word counts: `:21-31` 65, `:126-142` 108, `:175-177` 8, `:187-223` 262 (renames `:205-219` 117), `:225-248` 248, `:250-270` 173, `:272-294` 200, `:54-56` 30; total about 1,094 of 2,291. `cat shortcuts/core/harvest.json` shows the three renames and two drops.

**Words removed:** about 850.

**Inbound dependencies:** `shortcuts/incoming/README.md:25-26` links `../README.md#regenerating` and `shortcuts/manifests/README.md` links `../README.md#the-sync-channel`; both sections stay with their headings unchanged. shortcut-tools `tools/fold-incoming.py:173` prints "see shortcuts/README.md" when `core/harvest.json` is missing; the kept `core/` line should name `harvest.json` so that pointer still lands. `tools/harvest.py:12` mentions the README historically. `freshness.py` does not read the README.

**Risk:** Low. The Credentials history explains why this corpus is private, which is also stated in the file's first paragraph (`:3-6`). The size measurement is the only fact with no other home; one sentence keeps it.

