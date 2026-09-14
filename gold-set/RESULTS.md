# Excel results

What Excel did with the files in this folder. One stanza per run, newest first.
A session with Excel fills this in and commits it, so the verdict lands on the
branch rather than in a chat scrollback where the next session cannot read it.

---

## 2026-09-14 · commit `28b0b4c` · Excel on macOS

Two of three opened. One was refused.

| File | Excel | Detail |
| --- | --- | --- |
| `09.02-Decision-Package-Addendum.xlsx` | opened | Sheet and image visible. Excel disabled automatic link updates, which is its normal prompt for a workbook carrying external links and not a defect. |
| `11.01-Central-Service-Fund-Split-Form.xlsm` | **refused** | Excel reported a problem with the content and offered recovery. Recovery declined, so there is no repair log to read. |
| `15.02-TECM-Template.xlsm` | opened | Both intended sheets visible, and `PivotTable1` with them. |

Macros were not run, the pivot was not refreshed, and nothing was saved. The
tested copies matched the committed files.

**This is the finding the gold set exists for.** `11.01` passed the mechanical
package check and both readers parsed it. Only Excel refused it, which is the
entire argument for a check no sandbox can run.

### Root cause, and the fix

The writer re-emitted both of that workbook's tables with `headerRowCount="0"`
while keeping an `<autoFilter>` spanning the whole table range. Those cannot
both be true: an autofilter's dropdowns live in the header row the table says it
does not have. It also dropped `tableType="queryTable"` and both
`xl/queryTables/` parts, so a table built from a database connection came back
as a plain range still carrying the connection's name.

Two changes followed, in the commit that carries this file:

- **A `tables` graft.** The source's own table parts, their rels, and the
  `queryTables/` parts behind them are copied in, matched by `displayName`
  rather than part filename, and gated on the owning sheet being kept. `11.01`
  now carries `vba, customxml, connections, tables`.
- **A new rule in `verify()`.** Every other rule checks wiring *between* parts;
  this is the first that looks inside one. A table declaring `headerRowCount="0"`
  alongside an autoFilter is now reported, and
  `tools/test/xlsx-write.test.mjs` asserts it in both directions.

**Unverified until the next run.** The contradiction is gone and the query
wiring is restored, but nothing here can open Excel, so whether `11.01` now
opens is untested. It is also possible the repair prompt had a second cause that
this did not address. Re-run and add a stanza above.
