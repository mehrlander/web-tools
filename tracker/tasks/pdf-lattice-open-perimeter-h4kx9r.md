---
id: pdf-lattice-open-perimeter-h4kx9r
title: Close open table perimeters in the pdf kit's lattice
status: in-progress
session: claude/open-ended-exploration-9zkc1y
opened: 2026-07-25
size: M
---
# Close open table perimeters in the pdf kit's lattice

The one named gap in `lattice` as shipped in PR #294.

## The failure

Many tables omit their outer borders: interior rules divide the columns, but
nothing is drawn down the left and right edges, or across the top and
bottom. The cell walk starts from a junction taken as a top-left corner, so
where the perimeter is missing there is no corner to start from, and the
table yields nothing at all. Not a degraded result, an empty one.

This is common in government forms and is the reason a stream reading is
often the only one that works on them, which costs the cross-method control
the kit exists to provide.

## The approach

Where a ruled region is found but its perimeter does not close, take the
bounding box of the text that overlaps the discovered interior rules and use
those bounds as virtual outer edges. The interior geometry is real and stays
authoritative; only the outer boundary is inferred.

A second, related case worth handling in the same pass: a header row with a
rule above and below it but no vertical separators. The walk correctly
reports one wide cell, and the logical structure of the header is lost. The
mitigation is to project the body's column separators upward to subdivide it.

## Why it is not already done

Both fixes invent geometry that the document does not contain, which is a
different kind of claim from anything else in `lattice`. Everything the
lattice currently reports traces to a mark on the page. So the inferred
edges need to be marked as inferred in the output, and the shape of that
marking is the actual design question, not the geometry.

Inferred edges must be marked as inferred in the output; settle that marking
shape here when implementing.

`document-structure-harness-4mz7wk` once shared this provenance question; that
task is done (closed 2026-08-25) and frozen out to the private estate. The lattice
gap is still real; there is no longer a web-tools dependency blocking it.


## Related

- `lib/kits/pdf.js`: `lattice` implementation; inferred edges are the design question
- `docs/pdf-structure.md`: lattice vs stream control rationale
- `pages/pdf-inspect.html`: surface that shows empty lattice results today
- task `pdf-table-splitter-page-q7vm2d`: stream-side splitter surface on the same page
- task `pdf-inspect-pinch-zoom-5wz3kt`: sibling page-mode UX gap
- task `document-structure-harness-4mz7wk`: done; once shared provenance marking, no longer blocking
- PR #294: lattice shipped with this named gap

## Progress log
- 2026-07-25: Filed from PR #294 as the kit's main known gap.
- 2026-09-17: Dropped the harness-dependency framing (harness task done 2026-08-25). Provenance marking for inferred edges is decided in this task when the work runs.
- 2026-09-18: Added ## Related (paths / sibling tasks / premise PRs).
- 2026-09-26: Implemented in PR #807 (draft): `lattice.close` closes open sides at rule ends (basis `rules`) or out to text (basis `text`); `lattice.project` splits unruled headers; tables and cells carry `inferred`, derived by `mark` from drawn rules. Doc change to `docs/pdf-structure.md` awaits owner approval there, as does the on-by-default choice.
