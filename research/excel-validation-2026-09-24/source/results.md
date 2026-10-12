# Excel validation: PR 791 specimen

Native Excel opened the exact PR specimen and displayed its four sheets, a real table, and a real PivotTable. The first inspection also found a numerical problem in the workbook: the pivot includes the source table's total row and displays doubled grand totals. A convincing appearance and passing reconciliation labels therefore do not establish numerical correctness.

Tested September 24, 2026, using installed Excel **16.0.20326.20158** on Windows. The [workbook](demonstration-workbooks.xlsx) came from PR 791 head `5109699ac5eea3ca510947859ff9e5cb3980676e`. Its SHA-256 was unchanged before and after the native inspection:

`998d5483e1dee7db4c14c9f17142842f5eba451825b33afefa5fc11f4c82be14`

The application was actually launched and operated through native Windows computer use. All four sheets were visited. No repair prompt was observed; no forced recalculation, refresh, or save was performed. Only the test workbook was closed; unrelated workbooks were left untouched.

## Native findings

- **Table confirmed:** Excel's Table Design UI identified `Financials`; its total row is row 30. [Table Design evidence](excel-table-design.png)
- **Pivot confirmed:** PivotTable Analyze identified `FinancialPivot`. Its Change Data Source dialog showed `RawData!$B$5:$N$30`, including the table's total row. [Source dialog](excel-pivot-source-dialog.png) · [Source range in context](excel-pivot-source.png)
- **Totals disagree:** the pivot's blank group repeats the raw-data total, explaining the doubled pivot grand total. These values are displayed dollars in thousands. [Raw data](excel-raw-data.png) · [Pivot summary](excel-pivot-summary.png)

A separate read-only ZIP/XML check summed all 24 records in `RawData!J6:J29` and `K6:K29`, excluding row 30: **21,450 budget; 21,595 actual; +145 difference**. All 48 source cells contain numeric inputs, not formulas.

| Displayed result | Budget | Actual | Variance |
|---|---:|---:|---:|
| RawData total | 21,450 | 21,595 | +145 |
| Pivot blank group | 21,450 | 21,595 | +145 |
| Pivot grand total | 42,900 | 43,190 | +290 |

- **Reconciliation displayed four `PASS: EXACT MATCH` statuses.** This observation does not isolate saved caches from any calculation Excel may have performed on opening, and those checks did not expose the pivot discrepancy. [Reconciliation](excel-reconciliation.png)
- **Native appearance captured:** worksheet formatting, pivot fields, and the Fund Filter slicer were visible. Screenshots are approximately 1536 × 912; sheets were inspected at 100%, with a 75% view for the wide pivot. [Formatting and logic](excel-formatting-and-logic.png) · [Pivot at 100%](excel-pivot-summary-100.png)

## Browser comparison

The pinned, unmodified viewer code ran in Edge 153.0.4234.48 headless at 1440 × 1000, device scale 1, using the same 28,024 workbook bytes. Dependency caching and harness details are recorded in [browser evidence](browser-evidence.json). The browser shows light-blue headers, black text, and lighter banding versus Excel's dark teal/white styling. Pivot spacing differs and the Fund Filter slicer is absent. [Browser RawData](browser-raw-data.png) · [Browser PivotSummary](browser-pivot-summary.png)

The [right-side capture](browser-pivot-summary-right.png) confirms the same doubled totals and blank group. The initial download attempt was inconclusive. The [follow-up round-trip test](roundtrip-results.md) captured the real GitHub browser download and confirmed the same 28,024 bytes and SHA-256 as the workbook inspected in Excel. No normalized pixel comparison was performed.

## Limits

This is a first native observation, not a pixel-fidelity proof or an exhaustive workbook validation. The specimen contains no charts. No chart-rendering experiment, creation-engine comparison, COM capture/export test, forced calculation, or refresh comparison was performed. Screenshots establish an Excel reference appearance; the unchanged workbook hash identifies the inspected artifact. No workbook or PR fixes were made.
