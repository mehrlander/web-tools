---
name: peeves
description: "The owner's pet peeves: a numbered list (peeves.csv beside this file) of things the owner has corrected an assistant for, again and again, across hundreds of sessions, in writing, chat replies, pages, code, process, git and naming. Read it before handing over prose, a page, a script or a PR body, and when the owner sounds exasperated, says 'again', or asks whether something will annoy them. The peeves-critic agent preloads it and reviews work against it."
---

# Pet peeves

[`peeves.csv`](peeves.csv) is the list, one row per peeve:

| Column | Holds |
| --- | --- |
| `id` | `P01` onward; cite it when a piece of work trips the peeve |
| `area` | writing, chat-reply, page-design, code, process, git-pr, questions, reporting, naming |
| `peeve` | the behavior, stated so a reviewer can check work against it |
| `look_for` | what tripping it looks like in the work |
| `owner` | where the rule is already written down, when it is; that document governs and this row only points at it |
| `detector` | what catches a trip: `reader` (judgment, the peeves-critic's job), `lint` (a script), `hook` (refused or flagged at edit or commit time), `measure` (web-tools' page-measures) |
| `sessions` | roughly how many recorded sessions show the owner correcting it, from the 2026-08 to 2026-10 records |

Each row was drawn from the owner's own words in the recorded sessions
(web-tools-private `sessions/`); the quotes behind each row are kept there, in
`sessions/peeves/evidence.csv`, not here, because this skill travels publicly.

## Using it

- **Before handing work over**, read the rows for the work's area and check the
  work against each `look_for`. Fix what trips; do not report a clean pass row
  by row.
- **When the owner corrects something** that a row already names, the row
  failed to fire: say which id. When the correction is new and recurs, propose
  a row with the quote rather than adding one silently.
- **Where `owner` names a document**, that document's wording wins. A peeve
  row is the reminder, not the rule.
