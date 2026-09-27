# Slice: home-budgetdrs

**Summary.** The slice is the living documentation of `home/projects/budget-drs` outside `data/source/`, dated records, probes, research, and tracker tasks. That leaves about 190 Markdown files and roughly 192,600 words (`find ... | xargs wc -w`, with dated names, `probes/`, `research/`, `source-docs/`, `companion-docs/` and `request-development/2026-*` excluded). The dominant bloat is not restated rules. It is **records living as if they were contracts**: shipped proposals, retired fan-out briefings, and change logs kept beside the code they describe, each carrying a status banner that says "this is history now" and then thousands of words of the history. The second source is **incident narrative inside living docs**, where a rule arrives with its dated backstory attached.

(Proposals below are added as they firm up.)

## 1. Retire the eight shipped proposals and briefings in app/view

**Repo:** home

**Targets:** `projects/budget-drs/app/view/acfr-subcategory-proposal.md` (1,518 w), `appendix-proposal.md` (853), `bill-tab-proposal.md` (2,794), `pension-sections-proposal.md` (2,947), `redesign-proposal.md` (1,706), `walkthrough.md` (1,873), `VIEW-PRIOR-WORK.md` (1,688), `VIEW-SESSION-PROMPT.md` (1,322).

**Kind:** delete

**Proposal:** Delete all eight from `app/view/`. Git holds them. Where a living doc links one as "the reasoning behind", replace the link with a pinned-SHA permalink or drop it. Keep `app/view/README.md` as the one living document in the folder. Its "Working on one view" section (README.md:44-53) already states the one rule `VIEW-SESSION-PROMPT.md` exists to carry, so change its first sentence to stop pointing at the prompt file.

**Rationale:** Every one of these self-declares as a record, not a contract:
- `acfr-subcategory-proposal.md:3` "Status: implemented in the view on this branch, 2026-08-11."
- `appendix-proposal.md:4,9` "status: superseded 2026-07-28 ... This proposal lost."
- `bill-tab-proposal.md:8` "Status: delivered 2026-08-05 ... This file stays as the reasoning behind it."
- `pension-sections-proposal.md:5,11` "status: built 2026-08-17 ... [../bill/README.md] is the living account", and what was built was option one, not the recommended option three.
- `redesign-proposal.md:5` "Progress (2026-06-24)" over phases long since landed; it still says "nine views".
- `walkthrough.md:8-10` "narrates the nine-view nav of June 2026 and has not been renarrated since."
- `VIEW-PRIOR-WORK.md:4` "A briefing for the June 2026 fan-out, kept as its record."
- `VIEW-SESSION-PROMPT.md` is the June per-view fan-out brief; `README.md:46-53` restates its only binding rule.

The project's own rule (home `CLAUDE.md`, status markers retired 2026-09-21) is that git holds what a document used to say. A folder of eight banners saying "superseded" is the marker estate in another form. They also mislead: `walkthrough.md` and `redesign-proposal.md` describe a nine-view nav that `data/design/views.csv` no longer matches.

**Evidence:** Status lines quoted above. `wc -w` on the eight files totals 14,701.

**Words removed:** about 14,700.

**Inbound dependencies:**
- `app/bill/README.md:346` links `pension-sections-proposal.md`; `data/source/2026-06-25-enacted-bill-sections-drs/_pages.py:127` and that folder's `README.md` name it in a comment (supplied-source folder, out of scope for editing here; a stale comment is harmless, or use a SHA permalink).
- `app/view/README.md:48` links `VIEW-SESSION-PROMPT.md`.
- `app/workshop/data-asks/README.md` links `redesign-proposal.md`.
- `app/workshop/consolidation-orchestration/README.md` links `VIEW-PRIOR-WORK.md`.
- `tools/lint-conventions.py:226,228` exempts `redesign-proposal.md` and `VIEW-PRIOR-WORK.md` by path; remove those two ignore lines.
- `projects/doc-audit/fact-census/recall.py:31` cites `redesign-proposal.md:14` as a recall fixture. That fixture must be repointed at a SHA or dropped, or the census recall test loses a case.
- Tracker tasks (`reconcile-appendix-designs-w11yek`, `appendix-mount-reductions-explorer-vq3n8d`, `bill-window-before-2015-3ah1sc`, others) cite by path. They are out of scope and are records; leave them.
- `data/doc-growth.json` and dated chron CSVs mention the paths as history; no action.

**Risk:** Low. The loss is reading convenience for design reasoning, recoverable from git. The one mechanical dependency is the `recall.py` fixture.
