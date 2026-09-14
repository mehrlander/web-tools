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

### Root cause, bisected in Excel

A second run narrowed it in the application rather than by inference, which is
why this section states an attribute rather than a theory:

- The untouched source workbook opens without a prompt, so the rebuild
  introduced it.
- The cause is the two rebuilt table parts. Removing both tables resolves the
  prompt; removing the connection part, or every grafted part, does not.
- The operative attribute is `headerRowCount`. The source tables omit it, whose
  OOXML default is `1`; the rebuilt tables both set `"0"`. Setting it back to
  `"1"` in **both** tables makes the rebuilt `.xlsm` open cleanly, with its VBA
  and connection parts still present. Changing either table alone, or changing
  only `totalsRowShown`, still produced the prompt.

That rules out the connections graft, which this session had flagged early as a
suspicious correlate (`11.01` was the only file carrying it) and had not
eliminated.

### What changed

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

  **The rule may be narrower than the fault.** It fires on `headerRowCount="0"`
  *paired with an autoFilter*, because an autofilter's dropdowns need the header
  row the table says it lacks, and both tables here carry one. Whether Excel
  also refuses a headerless table with no autoFilter was not tested, and a
  headerless table is otherwise legal, so the rule is deliberately not "any
  `headerRowCount="0"` is wrong". If a case turns up that this misses, widen it
  on that evidence.

### What is still unverified

The graft restores the source's table parts whole, so `headerRowCount` is absent
again and defaults to `1`, which is the state the bisect proved opens. It also
restores `tableType="queryTable"` and the two `xl/queryTables/` parts, a
separate fidelity loss the minimal one-attribute fix would have left in place.

**Nothing in the sandbox can open Excel, so the rebuilt `11.01` is untested.**
The bisect makes it very likely to open, since the operative attribute is
corrected by construction. Data **refresh** through the restored query tables is
a further question nobody has asked yet.

Re-run and add a stanza above.
