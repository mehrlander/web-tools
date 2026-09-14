# Excel results

What Excel did with the files in this folder. One stanza per run, newest first.
A session with Excel fills this in and commits it, so the verdict lands on the
branch rather than in a chat scrollback the next session cannot read.

---

## Open: what has been ruled out, and the next experiment

`11.01` has now failed twice. Ruled out, so nobody re-runs them:

- **The connections graft.** Removing `xl/connections.xml` does not resolve the
  prompt. It was a suspicious correlate (`11.01` is the only gold-set file
  carrying one) and it is not the cause.
- **The grafts in general.** Removing every grafted part does not resolve it.
- **The table XML itself.** Both `xl/tables/table*.xml` are now byte-identical
  to the source, with `xl/tables/_rels/` and both `xl/queryTables/` parts
  restored and content-typed. Still refused.
- **Style and index references.** The rebuilt `styles.xml` keeps the
  `TableStyleMedium2` default the tables name, and every `dxfId` a conditional
  format references is within the rebuilt `dxfs` count (highest 3, of 4).
- **`docProps/app.xml` counts**, which agree with the workbook's sheet count.

**The contradiction worth attacking.** ExcelJS's own tables with
`headerRowCount="1"` patched in **open**. The source's tables, which omit
`headerRowCount` entirely (default 1) and add `tableType="queryTable"` plus the
query-table parts, **do not**. Both should satisfy the header-row condition, so
something the restored version brings is independently fatal, or the header row
was never the whole story.

**The experiment that would settle it**, for whoever has Excel: start from the
configuration that opens (ExcelJS's tables, `headerRowCount="1"`) and add back
one restored element at a time, testing after each.

1. add `tableType="queryTable"` to both tables, nothing else
2. then the two `xl/queryTables/queryTable*.xml` parts and
   `xl/tables/_rels/table*.xml.rels`
3. then swap in the source table XML whole

The first step that reintroduces the prompt names the culprit. A bisect from the
failing side has already been done twice and has stopped discriminating; this
runs it from the passing side.

**Also worth trying once:** accept Excel's recovery offer instead of declining
it. The repair log names the part Excel objects to, which is worth more than a
third refusal.

**Not yet chased, and the largest unexplained number in the manifest:** the
source declares 30 defined names and the rebuild emits 16. If a data validation
or formula still references one of the 14 that went, that is a dangling
reference of exactly the kind Excel repairs. Nothing has checked it.

---

## 2026-09-14 · commit `ed9bd0c` · Microsoft Excel for Windows

**The regenerated `11.01` still failed the open check.** A local test copy named
`11.01-after-table-graft-ed9bd0c4.xlsm` had the same SHA-256 hash as the
committed gold-set file (`1F612434AD09333F4E00E334A24D87CCCBE1FB4E8BD73917C7A72E03127D99D4`)
and the same Git blob ID (`825b8efeb1bd035a786c31b661707091fec7cc63`).
Excel displayed the same "We found a problem with some content" prompt and
offered to recover the copy. Recovery was declined; the workbook did not open,
and Excel remained running. No macros, refresh, dropdowns, or sheets were
tested in this run. The other two gold-set files were not reopened.

A read-only package check found that both `xl/tables/table*.xml` parts match
the untouched source byte-for-byte, `headerRowCount` is again absent, both
`xl/queryTables/queryTable*.xml` parts and their table relationships are
present, and the ZIP CRC check passes. The source-table graft landed, but it
did not make this rebuilt file acceptable to Excel. This run does not isolate
the remaining fault.

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

### What was still unverified when the graft was committed

The graft restores the source's table parts whole, so `headerRowCount` is absent
again and defaults to `1`, which is the state the bisect proved opens. It also
restores `tableType="queryTable"` and the two `xl/queryTables/` parts, a
separate fidelity loss the minimal one-attribute fix would have left in place.

**At this point, the rebuilt `11.01` had not been opened in Excel.** The bisect
suggested it would open, since the operative attribute was corrected by
construction. The subsequent Excel run is recorded above and found that the
new output still triggers repair. Data **refresh** through the restored query
tables remains untested.
