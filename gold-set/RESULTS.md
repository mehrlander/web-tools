# Excel results

What Excel did with the files in this folder. One stanza per run, newest first.
A session with Excel fills this in and commits it, so the verdict lands on the
branch rather than in a chat scrollback the next session cannot read.

---

## 2026-09-13 · commit `28b0b4c` · Microsoft Excel for Windows

Two of three opened. One was refused. The tested copies were confirmed against
the committed blob hashes after the check.

| File | Excel | What appeared |
| --- | --- | --- |
| `15.02-TECM-Template.xlsm` | opened, no repair prompt | Both kept sheets, and Excel recognised `PivotTable1` on `HeadCountCheck`. |
| `09.02-Decision-Package-Addendum.xlsx` | opened, no repair prompt | `DP Addendum` and its embedded OFM image. Excel warned that automatic link updates were disabled, which is its normal notice for a workbook carrying external links and not a defect. |
| `11.01-Central-Service-Fund-Split-Form.xlsm` | **refused** | "We found a problem with some content in '11.01-Central-Service-Fund-Split-Form.xlsm'. Do you want us to try to recover as much as we can? If you trust the source of this workbook, click Yes." Recovery was declined, so the workbook did not open and there is no repair log to read. |

Macros were not run, the pivot was not refreshed, dropdowns were not exercised,
and neither opened workbook was saved.

**This is the finding the gold set exists for.** `11.01` passed the mechanical
package check and both readers parsed it. Only Excel refused it, which is the
entire argument for a check no sandbox can run.

### Root cause, and what changed

The writer re-emitted both of that workbook's tables with `headerRowCount="0"`
while keeping an `<autoFilter>` spanning the whole table range. Those cannot
both be true: an autofilter's dropdowns live in the header row the table says it
does not have. It also dropped `tableType="queryTable"` and both
`xl/queryTables/` parts, so a table built from a database connection came back
as a plain range still carrying the connection's name.

- **A `tables` graft.** The source's own table parts, their rels, and the
  `queryTables/` parts behind them are copied in, matched by `displayName`
  rather than part filename (the writer numbers table parts in its own order),
  and gated on the owning sheet being kept. `11.01` now carries
  `vba, customxml, connections, tables`.
- **A new rule in `verify()`.** Every other rule checks wiring *between* parts;
  this is the first that looks inside one. A table declaring `headerRowCount="0"`
  alongside an autoFilter is now reported, and
  [`tools/test/xlsx-write.test.mjs`](../tools/test/xlsx-write.test.mjs) asserts
  it in both directions.

### What is still unverified

The contradiction is gone and the query wiring is restored, but nothing in the
sandbox can open Excel, so **whether `11.01` now opens is untested**. It is also
possible the repair prompt had a second cause this did not reach, since
declining recovery leaves no repair log to read. If it is refused again, taking
the recovery offer once and keeping the repair log would say which part Excel
objects to, which is worth more than a second refusal.

Re-run and add a stanza above.
