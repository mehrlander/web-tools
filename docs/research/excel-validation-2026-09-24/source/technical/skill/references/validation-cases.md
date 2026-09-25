# Cases and measurements

Choose cases that answer the current question. This is a menu of experiments, not a mandatory compatibility suite.

| Object | Evidence from Excel / package | Useful first variations | Appearance to inspect |
| --- | --- | --- | --- |
| Cells and sheet layout | Typed values, formulas/results, formats, row heights, column widths, merges, hidden state | Zero/negative/date values; wrapped versus spilling text; a hidden row; merged heading | Text, baselines, wrapping, clipping, widths, heights, borders |
| Native Table | ListObject identity/range, headers, totals, style flags, filters | Totals on/off; no filter; stripes; adjacent non-table cells | Role boundaries, banding, total borders, control affordances |
| PivotTable | Source/cache, field order, aggregation, filters, layout, subtotal/grand-total settings | Grand totals off; top/bottom subtotals; renamed captions; compact/tabular; collapsed items | Hierarchy/indentation, subtotal placement, headers, total values |
| Chart | Type, series formulas and values, categories, axes/bounds/units, grouping, labels, dimensions | Start bar/line/scatter with explicit bounds; then blanks/zeros, negatives, long labels, smaller size | Plot bounds, mark positions, baseline, tick values, label collisions, legend |
| Conditional formatting | Rules, ranges, precedence, differential styles and Excel's displayed result | Threshold boundary; overlapping rules; a negative data bar | Actual rendered fill/font/bar extent, not just stored base styles |
| Images and anchored objects | Relationships, anchor kind, offsets, size, worksheet placement | Hidden row/column; merge near anchor; one-/two-cell anchor | Position, dimensions, overlap, cropping |
| Printed report | Print areas, margins, scaling, orientation, repeated titles, page breaks | Wide table; multiple pages; chart across a break | Pagination, headers/footers, cut-off rows, readable scale |

For PivotTables, use actual settings and items rather than guessing totals from the final row or labels containing the English word "Total". For charts, distinguish categorical and date axes, blanks and zero, and primary/secondary axes before comparing pixels. Add advanced combinations only when needed.

For a pivot sourced from a worksheet range, check whether that range includes the source table's totals row. Compare aggregates with independently summed data rows; a blank pivot group can contain an accidentally included totals row. The September 24 native experiment in `local-evidence.md` demonstrates this despite passing workbook-authored reconciliation labels.

## Reproducible experiment

Retain the intended case specification and writer route/version. For a minimal chart, specify values, category type/order, dimensions, fonts, axis bounds, and labels. Give the same specification to each writer or renderer being compared.

Inspect three transitions when relevant:

1. **Intent to package:** which formulas, values, objects, style definitions, relationships, and cached results were written?
2. **Package to Excel:** what did Excel load, compute, normalize, or repair? A workbook repair prompt is a finding, not a successful compatibility result.
3. **Excel to browser:** are matching objects and values represented, and is their geometry/appearance acceptable for the stated use?

Preserve pre-Excel and final workbook identities when native normalization matters. Different ZIP ordering or generated IDs can change bytes without changing object meaning. Use hashes for exact-artifact identity and semantic inventories for equivalence; do not substitute one for the other.

## What a picture can establish

First inspect the native reference and the browser capture side by side. Confirm that both contain the intended content, comparable dimensions, and the same state. Check that they are not empty/placeholder images. If the browser is displaying the native image, evaluate delivery and display quality; that is not an independent rendering comparison.

Use measurements suited to the claim:

- Cell/plot bounds, row/column boundaries, mark coordinates, label extents, and object offsets locate geometry errors.
- Expected values and visible labels detect semantic errors. Validate totals independently of displayed subtotal rows and truncated data.
- Pixel differences or overlays can locate color/layout changes after explicit crop/scale alignment. Retain originals and alignment parameters. A raw similarity percentage is not a universal correctness threshold.
- Fonts and antialiasing can differ even when placement is correct. Do not stretch a capture to hide a width/height defect. Define any acceptable tolerance in terms of the use case and before approving the discrepancy.

For example, a negative bar on the wrong side of zero is a failure even if nearly all background pixels match. A slightly different text edge need not fail an otherwise correct chart. If measurements cannot distinguish a font substitution from a layout error, record the uncertainty and inspect that property.

## Minimal result record

Use the project's existing report format, or a short Markdown/JSON record containing:

- Case ID, hypothesis, object target and intended view (grid, chart, or printed page).
- Input specification/generator revision, creation engine/version, Excel version/build, browser revision, and view dimensions.
- Calculation and refresh policy; whether values are cached or freshly calculated.
- Input/final workbook SHA-256; native and browser capture identities; download SHA-256 when delivery is tested.
- Capture methods, relevant observations/measurements, discrepancies, and `confirmed`, `contradicted`, or `inconclusive` for the stated claim.
- Reproduction command and concrete remaining limitations.

For an exact-download check, retrieve the actual linked/downloaded bytes and hash them (for example, `Get-FileHash -Algorithm SHA256 -LiteralPath <file>`). Bind references to the final artifact. Rehash after capture and before delivery; any change requires reconciling the evidence before claiming the preview matches.

Lack of Excel access can still permit package checks and browser checks. Report those as partial evidence and keep the native claim inconclusive. Never relabel a file-library render, browser render, or an old screenshot as output from the current native run.
