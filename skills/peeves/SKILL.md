---
name: peeves
description: "The owner's pet peeves: a numbered list (peeves.csv beside this file) of things the owner has corrected an assistant for, again and again, across hundreds of sessions, in writing, chat replies, pages, code, process, git and naming. Read it before handing over prose, a page, a script or a PR body, and when the owner sounds exasperated, says 'again', or asks whether something will annoy them. The peeves-critic agent preloads it and reviews work against it."
---

# Pet peeves

[`peeves.csv`](peeves.csv) is the list, one row per peeve:

| Column | Holds |
| --- | --- |
| `id` | `P01` onward; cite it when a piece of work trips the peeve |
| `name` | a short label, unique and six words or fewer, that the Map view lists the peeve by |
| `area` | writing, chat-reply, page-design, code, process, git-pr, questions, reporting, naming |
| `peeve` | the behavior, stated so a reviewer can check work against it |
| `look_for` | what tripping it looks like in the work |
| `owner` | where the rule is already written down, when it is; that document governs and this row only points at it |
| `detector` | what catches a trip: `reader` (judgment, the peeves-critic's job), `lint` (a script), `hook` (refused or flagged at edit or commit time), `measure` (web-tools' page-measures) |
| `sessions` | roughly how many recorded sessions show the owner correcting it, from the 2026-08 to 2026-10 records |
| `status` | active, guidance or retired; the Map shows active entries in one list |
| `merged_into` | the retained peeve ID when this row supplies examples, references and evidence to a consolidation |

The owner's quotes behind each row are in web-tools-private `sessions/peeves/evidence.csv`, kept out of this skill because it travels publicly. Original IDs remain stable. Merged rows keep their historical wording; review the retained entry and its contributing examples together. Guidance rows hold contextual working requirements. Retired rows preserve historical IDs and are excluded from peeve reviews. The Map's session bar uses the largest source estimate for a consolidation, since the source estimates can overlap.

## Using it

- **Before handing work over**, find rows for the work's area and follow each `merged_into` to its retained entry. Skip retired entries. The retained statement defines the peeve's scope; check contributing `look_for` examples within that scope. Apply guidance rows in their stated context. Cite the retained ID for a consolidation. Fix what trips; do not report a clean pass row by row.
- **When the owner corrects something** that a row already names, the row failed to fire: say which id. When the correction is new and recurs, propose a row with the quote rather than adding one silently.
- **Where `owner` names a document**, that document's wording wins. A peeve row is the reminder, not the rule.
