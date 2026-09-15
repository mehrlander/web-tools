# data/report-layout

A worked template for [`lib/kits/report-layout.js`](../../lib/kits/report-layout.js),
kept as two separate files because that separation is the point.

| File | What it is |
| --- | --- |
| [`three-way-compare.csv`](three-way-compare.csv) | the rows: one record per budget version, fiscal year and item, in long form |
| [`three-way-compare.json`](three-way-compare.json) | a layout: budget version bands the columns, fiscal year sits inside each band |
| [`compare-by-year.json`](compare-by-year.json) | a second layout over the same rows: fiscal year bands, version inside |

A **stored template** is a pairing of one rows file with one layout, and nothing
in a layout can change a figure. The second layout exists so that claim is
demonstrated rather than asserted, and
[`tools/test/report-layout.test.mjs`](../../tools/test/report-layout.test.mjs)
holds it: both layouts must yield the same amounts under different column keys.

## Where the rows came from

A working Washington State operating budget workbook, transcribed by hand on
2026-09-14: the Governor's January update and the two chamber chairs' budgets,
compared item by item over the 2025-27 biennium's two fiscal years. Nothing in
the `mehrlander/home` budget-drs workspace carries these version codes, so the
figures are not derived from committed data anywhere and this file is their only
copy. The test asserts every subtotal and grand total the source table printed,
typed in separately from the item rows here, so a transcription slip fails the
suite rather than printing a table that does not add up.

The rows are ordered for reading: an item's versions sit together, and the
layout takes first-appearance order where it declares none. Re-sorting this file
therefore changes the printed order without changing a figure.
