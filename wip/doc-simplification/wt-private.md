# Slice: wt-private

## Summary

This slice is the living documentation of `mehrlander/web-tools-private`: `sessions/README.md` (11,350 words), `DESIGN.md` (3,307), `shortcuts/README.md` (2,291), `README.md` (1,232), `proposals/README.md` (865), and eight small READMEs (about 1,700 words together). The total is about 20,700 words, and `sessions/README.md` alone is 55 percent of it.

The dominant bloat is **schema archaeology written twice**. `sessions/README.md` narrates each schema change (what schema N cut, what it was measured against, how the number 8 was claimed twice), and `sessions/tools/record.py` carries the same narratives as comments beside the constants they justify. The second source is **restatement of web-tools docs**: the Stop hook's distribution argument (web-tools `docs/environment/extending.md`), the derived caches (web-tools `docs/views/*.md` and `docs/manifest.md`), and the proposal record contract (web-tools `docs/manifest.md`, "Proposals"). The third is **staleness that the duplication produced**: `DESIGN.md` still documents a `mailbox/` folder that was renamed `errands/` on 2026-09-24, `proposals/README.md` links to it, `sessions/README.md` explains `startup_context` through a home hook that no longer exists, and it says Stop fires once per assistant turn while web-tools measured on 2026-09-21 that it fires on idle.

Proposals are ordered by words removed.

## 1. Collapse the schema history in `sessions/README.md` to a field reference; the rationale already lives in `record.py`

**Repo:** web-tools-private

**Targets:** `sessions/README.md:70-123` (the prompts/injected accounting and the "Schema 8 was claimed twice" story), `:186-261` ("What is bounded", "The answering half"), `:516-584` ("Tool calls"), `:586-736` ("The transcript can come back short", "The later pass", "What schema 3 cut", the redactor paragraphs, "Where the records are read", "What is still absent"), `:738-826` ("The fan-out half" and its four subsections).

**Kind:** collapse-narrative

**Proposal:** Rewrite these spans as one section, "The record", with three parts. (a) The existing field table at `:45-68`, extended with the `calls` table from `:529-536` and the `agents_*` rows, one line per field. (b) A "Bounds" list of four lines, each naming a constant in `record.py` and stating the rule once: results are the only bounded content; failing bodies keep 2 KB head and tail (`FAIL_CAP`); succeeding bodies keep 1 KB tail-weighted (`BODY_CAP`); receipts and successful `Read` keep no body (`NO_BODY_ON_SUCCESS`); 256 KB of bodies per record (`BODY_BUDGET`); agents follow the same policy under `AGENT_BUDGET`. `bytes` and `sha` ride every call regardless. (c) An "Invariants" list of four lines: a record is rebuilt whole on every Stop; the captured half never shrinks (`merge_captured`, `merge_agents` union with the prior record); the record path is pinned to the session id (`record_path`); nothing captured is rewritten on its way in. End with one sentence: "Why each bound and invariant has its value, with the measurements, is in the comment above its constant or function in `tools/record.py`." Delete every "Measured YYYY-MM-DD on the session that..." paragraph, the schema-number merge story, the "later pass" percentage table, and the "What schema 3 cut" table.

**Rationale:** Each narrative exists twice. `record.py` carries the schema-number story (`record.py:24-40`), the answering-half argument and its 464 KB measurement (`:104-122`), the tool-call bounds and the head-and-tail measurement (`:124-148`), the schema-3 receipt measurement (`:163-173`), the redactor removal with its examples (`:380-392`), the `isSidechain` finding (`:812-817`), the 38 MB of `skill_listing` attachments (`:837`), and the 25-day wake (`:852`). The comment is the owner, because it sits beside the constant a future change edits. The README copy has already drifted from its owner: `:898-899` still calls `bodies_elided` "currently the loudest, at 387 across the 17 schema-2 records", a claim about a store now at schema 12. The doctrine question "does another document own it" answers yes for every one of these paragraphs.

**Evidence:** Word counts by `sed -n | wc -w`: `:70-123` 663, `:186-261` 753, `:516-584` 678, `:586-627` 393, `:629-667` 385, `:669-736` 611, `:738-826` 820. The duplicated passages are listed under Rationale with their `record.py` line numbers.

**Words removed:** about 3,400 of 4,303 in the target spans (the field tables, the bounds list and the invariants list keep about 900).

**Inbound dependencies:** `sessions/tools/search.py:46` cites the heading "Nothing captured is rewritten on its way in"; keep that phrase as the fourth invariant's text so the citation still resolves. `web-tools/lib/kits/session-render.js:4` calls the README "the schema"; the field table still serves that. `web-tools/lib/kits/session-render.js` reads `replies_elided` and `replies_clipped`, which stay in the field table. No script parses the README. `.paths.json` names `sessions/README.md` only as prose ("Described in sessions/README.md"); keep one line on `sample-record.json`.

**Risk:** Low. A reader loses the measured history in the README but keeps it in `record.py` comments and in git. The one real cost is that a reader who never opens `record.py` no longer sees the reasoning. The closing sentence names where it is.

