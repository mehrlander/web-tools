---
id: growth-vs-reads-quadrant-ng3c97
title: Read a document's growth against its readership, on the Docs tab
status: backlog
opened: 2026-08-28
size: M
awaiting: four axis choices, all with recommended answers in the body: recent slope, presence, labelled corners, injected docs excluded
---
# Read a document's growth against its readership, on the Docs tab

The Docs tab now carries both halves of the pair and shows them apart: `words`
with a growth sparkline from the doc-growth payload, and readership as presence
beside access from the sessions cache (PR #528). Nothing crosses them, so the
question they answer together is still asked by eye: **which documents are
growing that nobody reads.**

A quadrant does it directly. Growth on one axis, recorded reads on the other,
each registered doc a point, the four corners named. The one that matters is
high growth and no reads: a document accreting with no reader is the cheapest
kind of rot to find and the easiest to miss in a table sorted by either column
alone. 42 of 70 registered docs had zero recorded reads on 2026-08-28, so the empty
quadrant is most of the corpus and the figure is worth showing rather than
describing. The registry has since grown to 76 rows, so read the zero-read count
live when building rather than quoting this one.

## Where it goes, and why not on Growth

**On Docs, not the Growth tab.** Growth is federated as of 2026-08-28: the repo
is a control and every declaring corpus is a subject. Readership is not. It
joins against `docs/docs.csv`, which is the hub's registry alone, so a quadrant
on Growth would show growth for any selected repo and coverage for exactly one,
which is a view that changes meaning when its control moves. Reach and
readership already live on Docs; this belongs beside them.

Both inputs are in hand there. `loadDocsReg` already reads `docs/docs.csv`, the
growth payload (`docGrowth`, per-path `w`/`delta`), and `loadDocReads`. The work
is the rendering and the reading, not the data.

## Open questions
- Which growth measure: net delta over the whole history, or recent slope. A doc
  that grew once in March and has been still since is not the same finding as
  one still accreting.
- Whether reads should be presence, access, or both. They are two rollups that
  are never summed, so a single axis has to pick one and say which.
- Whether the four corners are labelled or left to the reader. Naming them makes
  the view an argument, which may be the point.
- Whether injected docs belong on it at all. They are the two most-read files in
  the estate and precisely the two no file tool can count, so they distort
  either axis.

## Recommended answers, so this is four confirmations rather than a design pass

Each follows from an argument already in this task, so a reader who disagrees
has something specific to disagree with. Added 2026-09-17; none is acted on.

- **Recent slope, not net delta.** The task's own sentence decides it: a doc that
  grew once in March and has been still since is not the finding. Net delta
  scores it identically to one still accreting.
- **Presence, not access.** The quadrant asks whether anyone opened a document.
  Presence answers that; access answers how often, which is a different question
  and belongs in the table the rows already have.
- **Label the corners.** The view exists to make one corner's argument. An
  unlabelled quadrant makes the reader rediscover the argument every time, which
  is the table's failure restated in two dimensions.
- **Exclude injected docs, and say so on the view.** An axis that cannot count
  its two largest values is not measuring. A one-line note naming the exclusion
  is honest; silently dropping them is not.

## Done when
The Docs tab renders growth against readership for every registered doc, the
zero-read population is legible as a count rather than inferred, and a point
opens its document in the deck the table's rows already use.

## Progress log
- 2026-08-28: filed out of the doc-growth deduplication branch
  (`claude/doc-growth-duplicate-sidebar-4bg2or`, PR #534), which made Growth a
  federated tab and settled that this belongs on Docs instead. Not claimed.
- 2026-09-04: `docs/docs.csv` now holds 76 rows against the 70 this was written
  on. The zero-read figure is not restamped on purpose: it joins the sessions
  cache rather than the registry, and rendering it live is the point of the task.
- 2026-09-17: Surfaced the four open axis/label questions as awaiting.
- 2026-09-17: Answered all four with recommendations drawn from arguments this
  task already makes, so the hold is four confirmations rather than a design
  pass. This is the only one of the board's parked tasks whose questions were
  genuinely open on both sides; the rest were waiting on a yes.
