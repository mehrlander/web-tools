# Slice: wt-snags

**Summary.** This slice is web-tools `docs/SNAGS.md` (24,926 words, 2,350 lines, 110 entries), its generator `tools/build/snags-index.mjs` (251 lines, 1,160 words of comments), its test `tools/test/snags-index.test.mjs` (128 lines), and the derived registry `docs/snags.csv`. The comparison is shortcut-tools `docs/SNAGS.md` (1,755 words, 15 entries). The header (SNAGS.md:1-62, about 660 words of prose) promises "a one-liner (symptom, then the corrected move) with a `→` to the durable doc" (SNAGS.md:4-5) and "Entries stay an index (a one-liner plus a `→`), so they cannot drift" (SNAGS.md:15-16). The entries do not keep that promise. The median entry is 177 words; the 90th percentile is 305; the largest is 757 (`daisy-divide-paints-black`). 77 of 110 entries run over 150 words. The bloat comes from accretion: each recurrence adds a "Bit again", "Third bite" or "Fourth trip" paragraph that retells the incident, and a rule already stated in the `→` target gets restated in the entry. Only 40 of 110 entries have been seen more than once (70 once, 18 undated), so most of the narrative supports entries whose recurrence count is 1 or unknown. shortcut-tools already runs the intended shape: one sentence per entry, a `seen:` line, and a `→`.

## 1. Cap every entry at the index shape, and make the cap a check

**Repo:** web-tools
**Targets:** docs/SNAGS.md:196-2350 (all 110 `### slug: title` entries); tools/build/snags-index.mjs (`parse`, `--check`)
**Kind:** restructure + move-to-data-or-check
**Proposal:** Rewrite each entry to four parts: the `### slug: title` heading, one paragraph of at most 60 words stating the symptom and the corrected move, the `*(seen: ...)*` line holding every date, and the `→` line. Delete every recurrence paragraph ("Bit again on", "Third bite", "Fourth trip", "Fifth and sixth trips") after moving its date onto the `seen` line. Delete measurement details (oklch values, byte counts, PR numbers) unless the corrected move needs them. Then add a length check to `snags-index.mjs --check`: an entry body over 80 words fails, so the cap holds without anyone remembering it. Keep every slug heading unchanged, because 25 slugs are cited from live code and docs (see Inbound dependencies).
**Rationale:** The header already says entries are an index that "cannot drift from the docs that hold the fix." A 600-word entry is a second copy of the fix and drifts like one. Git keeps each retold incident. The cap is enforceable, so under the estate's split it belongs in a check, not in the header prose.
**Evidence:** The measured distribution is median 177, p90 305, max 757, with 77 of 110 entries over 150 words. `daisy-divide-paints-black` (SNAGS.md:1677-1753, 757 words) has five paragraphs after the first. Each retells a sighting, and the rule they arrive at is stated in full at skills/daisy-alpine/references/mechanics.md:172. `link-sha-not-resolved` (SNAGS.md:1202-1252, 591 words) has four "bite" paragraphs, and all four arrive at one move: paste what `npm run showing` prints. `ci-run-silently-not-started` (SNAGS.md:1564-1623, 655 words) has five paragraphs whose corrected move ("read `mergeable_state` before anything else") is stated three times. It also overlaps `conflicted-pr-queues-no-ci` (SNAGS.md:299-307), whose 74 words already hold the same rule. Merge those two in the same pass. For comparison, shortcut-tools/docs/SNAGS.md holds 15 entries in about 790 words below its index, roughly 50 words each.
**Words removed:** 13,766 if every entry is cut to 80 words, and 15,922 at 60 words (computed per entry from the current file). Plan on about 13,000, since a few entries hold a rule that has no other home (for example `backtick-in-an-html-comment-ends-the-template`, whose rule is not in its target docs/loader.md) and will keep slightly more.
**Inbound dependencies:** Slugs cited from live files (not session records or corpora): scripts/blank-icons.py, scripts/derived-csv-merge.mjs, scripts/showing.py, lib/kits/claude-mark.js, lib/kits/session-export.js, lib/alpineComponents/fab.js, tools/render/cdn.mjs, tools/render/screenshot.mjs, several tools/test/*.test.mjs files, docs/showing.md, docs/doc-growth.md, docs/environment/testing.md, pages/audit-render.html, .gitattributes, home/CLAUDE.md, home/projects/budget-drs/submittal/submittal.html, shortcut-tools/pages/library.html. All of them cite the slug, not the prose, so they survive when headings are kept. tools/test/snags-index.test.mjs:60 ("a dated bold sub-paragraph counts toward its own entry") pins the sub-paragraph dating form. After the rewrite no entry uses that form, so drop that parser path and its test.
**Risk:** Medium. The owner has said an entry's value is "the paragraph explaining why a trip was invisible" (SNAGS.md:55-57). The cap keeps one such sentence and drops the story. For an entry whose `→` target does not hold the rule, the rewriter has to move the rule into the target first, or the capped entry becomes its only home. Do the rewrite in one pass, not piecemeal, so the check can be turned on at once.

## 2. Collapse gated entries to a pointer at their gate

**Repo:** web-tools
**Targets:** SNAGS.md entries `daisy-divide-paints-black` (1677-1753), `opacity-step-off-the-tens` (2007-2036), `phosphor-weight-is-a-family` (1663-1676), `claude-logomark-copied` (1432-1453), `untracked-file-invisible-to-the-suite` (998-1031), `derived-field-conflicts-per-branch` (2098-2143), `merge-drops-authored-csv-cells` (806-822), `shell-pin-kills-the-tab` (2294-2351), `silent-fallback-old-build` (1345-1360), `subtree-touch-guard-kills-the-anchor` (216-235)
**Kind:** link-to-owner
**Proposal:** For each entry whose cause is now removed by a test or a script, cut the body to one sentence naming the trap and the gate, for example: "`divide-*`/`ring-*` on a daisyUI semantic colour compiles to nothing; `npm run family-scan` gates it (tools/test/dead-family.test.mjs)." Keep the slug and the `seen` line, so the count and inbound citations still resolve. Sequence this before proposal 1 in the same pass, since it is proposal 1 applied at its tightest.
**Rationale:** The log exists so a trip that repeats earns a systematic fix (SNAGS.md:8-11). Once a gate exists, the trip cannot repeat silently, so the entry has nothing left to count. The gate's test file and the reference doc now own the rule.
**Evidence:** `daisy-divide-paints-black` restates skills/daisy-alpine/references/mechanics.md:172 almost clause for clause (three families, the arbitrary-value substitution, the `shadow-*` exception, `npm run family-scan`); tools/test/dead-family.test.mjs gates it. `derived-field-conflicts-per-branch` is resolved by the `merge=derived-csv` driver (.gitattributes:23-25, scripts/derived-csv-merge.mjs, tools/test/derived-csv-merge.test.mjs). The rest have their gates in tools/test/blank-icons.test.mjs, claude-mark.test.mjs, untracked-carriers.test.mjs, showing-pick.test.mjs, lib-parses.test.mjs (`silent-fallback-old-build`, SNAGS.md:1359), dead-opacity.test.mjs and fab-menu.test.mjs. Confirm per entry that the gate named covers the whole trap before collapsing it.
**Words removed:** About 3,100 of the 3,434 words in these ten entries (wc -w per entry: 757, 313, 124, 253, 368, 449, 176, 614, 172, 208). This overlaps proposal 1's total and does not add to it.
**Inbound dependencies:** scripts/blank-icons.py:10 and tools/test/blank-icons.test.mjs cite `phosphor-weight-is-a-family`. scripts/derived-csv-merge.mjs and .gitattributes cite `derived-field-conflicts-per-branch` and `merge-drops-authored-csv-cells`. lib/kits/claude-mark.js cites `claude-logomark-copied`. docs/showing.md cites `shell-pin-kills-the-tab`. shortcut-tools/pages/library.html cites `daisy-divide-paints-black`. All keep resolving because the slug stays.
**Risk:** Low. `shell-pin-kills-the-tab` says "the mechanism stays open" (SNAGS.md:2350-2351). Keep one sentence saying so, or move the open question into a tracker task.

## 3. Retire entries whose subject is gone, and move the latent bug to its code

**Repo:** web-tools
**Targets:** `marker-on-a-living-doc` (SNAGS.md:1542-1563), `status-audit-skipped-index` (1973-1988), `annotated-document-resists-edits` (2252-2272), `guards-shift-the-offsets` (2273-2293)
**Kind:** delete + link-to-owner
**Proposal:** Delete the first three entries. Move `guards-shift-the-offsets` to a two-line comment at scripts/annotate/segment.py:23 (the `GUARD` table it describes), or to a tracker task if it should be fixed. Then delete its entry too.
**Rationale:** A snag earns its place by being able to recur. The markers instrument, `status.py` and the `/markers` skill were retired on 2026-09-21; the entries say so themselves (SNAGS.md:1555-1560, 1987). `docs/CONVENTIONS.md`, the only annotated document `annotated-document-resists-edits` is about, no longer exists, and its `→` link to skills/state-the-rule/SKILL.md is dead. `guards-shift-the-offsets` is not a trip at all: it says "Latent, not live" (SNAGS.md:2285). It is a known bug in one file, and the file is where the next editor of it will look.
**Evidence:** `ls docs/CONVENTIONS.md`: no such file. `ls skills/state-the-rule`: no such directory. `markers/`: absent. `marker-on-a-living-doc`'s `→` is [CONVENTIONS.md](CONVENTIONS.md), the one broken target in snags.csv. segment.py:23 still carries the non-length-preserving guards, so the bug is real and unfixed.
**Words removed:** 777 (225 + 176 + 196 + 180), less about 40 for the segment.py comment.
**Inbound dependencies:** None in live files. Mentions are in web-tools-private session records, home/projects/text/passages.jsonl (a corpus), and home/chron/2026/09/2026-09-21-retiring-the-markers.md (a dated record, which may keep a now-dead slug citation as history). pages/audit-render.html still embeds a payload titled CONVENTIONS.md. That page is another slice's question, but it is a second symptom of the same deletion.
**Risk:** Low. If `annotated-document-resists-edits` is still wanted as a warning, it belongs with the annotation tool (tools/test/state-the-rule.test.mjs or the annotate script's header), not in the friction log.

## 4. Cut the header from about 660 words to about 150

**Repo:** web-tools
**Targets:** docs/SNAGS.md:18-62
**Kind:** collapse-narrative + delete
**Proposal:** Keep the opening paragraph (1-6), the recurrence rule (8-11), and one sentence of the key distinction (13-16). Replace 18-58 with two sentences: "The index below and `docs/snags.csv` are generated by `npm run snags-index` on commit; the run also warns when two slugs share two or more words, which usually means a repeat. A sighting must be a date." Delete the provisional note at 60-62.
**Rationale:** Lines 18-50 are the history of the log's own tooling: what prompted the repeat detector, an eleven-entry migration on 2026-08-14, and a paragraph admitting the migration was unfinished "for twelve days." None of it changes what a session does when it appends an entry. The provisional note points at a spike that is closed: tracker/tasks/spike-snags-log-gobdyq.md has `status: done`, `closed: 2026-09-04`. So the note has been false for three weeks.
**Evidence:** Word counts by span: 18-28 is 130, 30-37 is 103, 39-50 is 133, 52-58 is 94, 60-62 is 27. The generator's own header (snags-index.mjs:1-56) already tells the same history, which makes the doc copy a duplicate.
**Words removed:** About 460 (487 across 18-62, less about 30 for the replacement sentences).
**Inbound dependencies:** None. tools/README.md:298 and docs/registries.csv:29 describe the generator and registry and do not quote the header.
**Risk:** Low.

## 5. Shrink the generator and test comment essays to their contract

**Repo:** web-tools
**Targets:** tools/build/snags-index.mjs:1-56 (589 words; 1,160 comment words in the file); tools/test/snags-index.test.mjs:1-19 (about 190 words)
**Kind:** collapse-narrative
**Proposal:** Replace snags-index.mjs:1-56 with about eight lines: usage, the two outputs (the index block and docs/snags.csv), the strict sighting rule, and the fact that the repeat warning is advisory and never fails. Delete the dated narrative ("Measured 2026-08-14: one session wrote...", "Measured that day: the file held 53 entries..."). Cut the test header to one line naming what it pins. Leave the per-function comments unless they are also narrative.
**Rationale:** The estate's own snag `header-essay-outlives-its-code` names this failure: a file-header essay drifts while each per-site comment stays true. This header already duplicates SNAGS.md:18-50 (proposal 4), and it still describes a two-part problem ("FIRST ... SECOND ...") in terms of a log shape that proposal 1 would change again.
**Evidence:** snags-index.mjs has 101 comment lines out of 251. Lines 18-24 and 40-47 are incident narrative, and lines 52-56 argue for keeping prose in the markdown.
**Words removed:** About 500 in the generator and about 160 in the test.
**Inbound dependencies:** None. The comments cite `headless-shot-prose-flat` and `screenshot-hides-overflow` as examples, and those references go with the narrative.
**Risk:** Low.

## 6. After the cap, make snags.csv the source and render the log (optional, bolder)

**Repo:** web-tools
**Targets:** docs/SNAGS.md, docs/snags.csv, tools/build/snags-index.mjs, tools/test/snags-index.test.mjs, docs/registries.csv:29
**Kind:** move-to-data-or-check
**Proposal:** Once proposal 1 has capped every entry at one paragraph, add a `rule` column to docs/snags.csv and make the CSV the authored source (slug, title, rule, seen, targets). Either generate SNAGS.md from it as a short header plus a table, or drop the markdown log and let the Map view render the registry, which it already lists (registries.csv:29, label "Snag index"). The strict markdown parser and most of its test then go away: the sighting-boundary cases at test lines 34-81 exist only because the dates are parsed out of prose. Keep the slug-overlap warning and run it over the CSV.
**Rationale:** The one argument for keeping the markdown was that entry prose is "a poor fit for a cell" (SNAGS.md:55-57). A 60-word rule fits a cell, and shortcut-tools' index table already carries each entry's full text in one cell (shortcut-tools/docs/SNAGS.md:33-50). What a CSV source gets rid of is a 251-line parser whose main job is reading dates back out of prose.
**Evidence:** registries.csv:29 classifies snags.csv as `computed` with the log as its source. The parser's history of miscounts, written in its own header at snags-index.mjs:40-47, is the cost of that direction.
**Words removed:** The remaining SNAGS.md after proposal 1 (about 11,000 words) becomes generated rather than authored, and about 150 lines of parser and test code go.
**Inbound dependencies:** The pre-commit leg at .githooks/pre-commit:252-263, tools/test/derived-artifacts.test.mjs:92-94, the `snags-index` npm script, tools/README.md:298, registries.csv:29 (`computed` would become `authored`), the `/tend` skill's snag nomination (.claude/skills/tend/SKILL.md:34, 104), skills/screenshot-review/SKILL.md:33 ("Extend it in SNAGS first"), and estate.js:284, where the jot kind `snag` names docs/SNAGS.md as its destination.
**Risk:** Medium to high. A CSV written through the GitHub API or MCP restamps every line (the estate's own `csv-rewrite-restamps-every-line`, ×2), and phone-side appends are easier into markdown. Adopt this only if the owner wants the log read in the app rather than on GitHub. Proposals 1 through 5 stand without it.

## 7. shortcut-tools: stop printing each entry twice

**Repo:** shortcut-tools
**Targets:** shortcut-tools/docs/SNAGS.md:29-50 (index table, 717 words) against the entries below it (788 words); tools/snags-index.py
**Kind:** restructure
**Proposal:** Make the generated table's third column the title only, as web-tools does, with a short phrase instead of the entry's full text. Or keep the table and delete the entry bodies, leaving each entry as slug, `seen`, and `→`. Also cut the "Backfilled 2026-09-14" paragraph (lines 23-26) to one clause, or delete it now that entries dated after the backfill exist.
**Rationale:** The table's "what it was" cell is the entry's whole body, so every entry appears twice in one file. For example, `gate-narrower-than-its-own-claim` at line 50 (table row) and lines 55-58 (entry) is the same text word for word.
**Evidence:** Index block 717 words against 788 words of entries, for 15 entries.
**Words removed:** About 600.
**Inbound dependencies:** tools/snags-index.py writes the table, and its `--check` is held by the shortcut-tools suite. Change the column source in the script, not by hand.
**Risk:** Low. A cross-repo note: the two repos run two generators (snags-index.mjs and snags-index.py) for one format, and shortcut-tools' docstring cites web-tools' miscount as its reason. If a third repo adopts a snags log, ship one generator in the `portable` plugin rather than writing a third. Until then, two small generators cost less than a shared one.

## 8. Keep one copy of `app-frame-outruns-the-inliner`

**Repo:** web-tools and home
**Targets:** web-tools docs/SNAGS.md:274-298 (258 words); home CLAUDE.md, the "exception is observed" block under Surfacing your work (the paragraphs beginning "The exception is observed", "Two candidates remain", and "Meanwhile hand over")
**Kind:** link-to-owner
**Proposal:** Keep the full diagnosis (the 46 files and 9.7 MB, the two surviving candidates, and the console one-liner that separates them) in one place only: the SNAGS entry, capped per proposal 1 and allowed a second line for the console command. Cut home CLAUDE.md's block to two sentences: "The app route currently renders an empty pane for a private repo; hand over the framed page on its own with `#pkg=<id>`, and say the app route is broken. Diagnosis: web-tools snag `app-frame-outruns-the-inliner`."
**Rationale:** Both copies carry the same figures (46 files, 9,692,313 bytes, 6 files and 1.8 MB), the same two candidates, and the same console expression. Home CLAUDE.md already calls the snag the upstream log. A contract file loaded every session should carry the rule, not the open investigation.
**Evidence:** SNAGS.md:278-296 and home CLAUDE.md carry identical numbers and the identical `querySelectorAll('script[data-inline-error]')` line.
**Words removed:** About 350 from home CLAUDE.md. This overlaps the home-contract slice (web-tools/wip/doc-simplification/home-contract.md already cites this slug), so reconcile the two proposals there.
**Risk:** Low. Both copies say the cause is unsettled, so neither is authoritative on the cause. Only the handover rule has to stay in the contract.

## Totals

Proposals 1 to 5 together take web-tools docs/SNAGS.md from 24,926 words to about 11,000, with every slug, count and date kept. The largest share is proposal 1, the entry cap. Proposal 6 would make most of what remains generated. Proposals 7 and 8 remove about 950 words elsewhere.
