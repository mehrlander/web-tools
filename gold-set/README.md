# The sheet picker's gold set

Three real workbooks, each rebuilt by [`kits/xlsx-write.js`](../lib/kits/xlsx-write.js)
with a sheet dropped, for a person to open in Excel. Beside each one is the
manifest the rebuild emitted, and why that file is here.

**This is the third of the three checks named for that kit, and the only one no
sandbox can run.** The other two are in
[`tools/test/xlsx-write.test.mjs`](../tools/test/xlsx-write.test.mjs): a
mechanical package check, broken five ways on purpose so a checker that always
passes cannot pass; and SheetJS parsing the output, because a defect the writer
and the reader share is invisible to a check using only those two. Both pass on
all three files here. Neither is evidence that Excel accepts them.

## The three, and what each one carries

| File | Kept | Dropped | What it puts at risk |
| --- | --- | --- | --- |
| `15.02-TECM-Template.xlsm` | HeadCounts&CostPerCredit, HeadCountCheck | GrossNetOperatingFee | The only file that fires **all three grafts**: a VBA project with three signature parts, three customXml items, and five pivot parts. |
| `11.01-Central-Service-Fund-Split-Form.xlsm` | FundSplits, ActiveFunds | Instructions | 2,795 formulas, 16 data validations, 4 conditional formats, 16 defined names, a workbook connection, VBA, and a hidden sheet that must come back hidden. |
| `09.02-Decision-Package-Addendum.xlsx` | DP Addendum | Reference Tables | 129 merged ranges and an embedded image. Also the file that demonstrates two known losses, so its manifest reads short on purpose. |

## Excel desktop check

Microsoft Excel for Windows attempted to open the three committed workbooks at
`28b0b4c6` on 2026-09-13. The local test copies matched the committed Git blob
hashes after the check.

| File | Excel result | What appeared |
| --- | --- | --- |
| `15.02-TECM-Template.xlsm` | Opened without a repair prompt | Both kept sheets appeared. Excel recognized `PivotTable1` on `HeadCountCheck`. |
| `11.01-Central-Service-Fund-Split-Form.xlsm` | **Failed the open check** | Excel said, "We found a problem with some content in '11.01-Central-Service-Fund-Split-Form.xlsm'. Do you want us to try to recover as much as we can? If you trust the source of this workbook, click Yes." Recovery was declined, so the workbook did not open. |
| `09.02-Decision-Package-Addendum.xlsx` | Opened without a repair prompt | `DP Addendum` and its embedded OFM image appeared. Excel warned that automatic link updates were disabled. |

This check did not run macros, refresh the pivot, exercise dropdowns, or save
either opened workbook. The `11.01` repair prompt is a defect that the package
check and independent reader did not catch.

### Follow-up on the `11.01` repair prompt (2026-09-14)

The untouched source workbook opened in Excel without a repair prompt, so the
prompt was introduced by the rebuild. Local diagnostic copies narrowed it to
the two rebuilt table parts, `xl/tables/table1.xml` and `table2.xml`. The source
tables omit `headerRowCount`, whose OOXML default is `1`; the rebuilt tables
both set `headerRowCount="0"`. Changing only that attribute to `"1"` in **both**
table parts made the rebuilt `.xlsm` open without repair, with its VBA and
connection parts still present. Changing either table alone, or changing only
`totalsRowShown`, still produced the prompt. Removing the connection part or
all grafted parts did not resolve it; removing both tables did.

The rebuild also omitted the source's two `xl/queryTables/queryTable*.xml`
parts and the relationships from the tables to those parts, although it kept
`xl/connections.xml`. The source tables were `queryTable` tables; the rebuilt
tables no longer identify themselves that way. This is a separate fidelity
loss, and data refresh remains untested. The diagnostic copies were local
experiments; the committed gold-set workbook remains the failing output.

## What to report

In rough order of how much it would cost to learn later:

1. **Excel refuses the file, or offers to repair it.** That is a package defect
   the mechanical check missed, which is the most useful finding available here.
2. **Macros gone.** Both `.xlsm` files carry a VBA project and both are signed.
   The *signature* is expected to be reported as invalid, since the project's
   container changed. The macros themselves should still be there.
3. **The pivot.** `15.02` keeps `PivotTable1` on `HeadCountCheck`, and its cache
   reads `HeadCounts&CostPerCredit`, which is why both sheets are kept. Does it
   open, and does it refresh?
4. **`11.01`'s dropdowns and its hidden sheet.** `FundSplits` reads four named
   ranges that live on `ActiveFunds`, which is kept and should still be hidden.
   A broken dropdown here is the picker's fault, by construction (see below).
5. **Anything that looks different from the original** beyond the dropped sheet:
   colours, number formats, merged cells, comment boxes. Each manifest says what
   was expected to survive, so a disagreement between it and the screen is the
   thing to report.

Known and expected, so not worth reporting: page setup is gone, since no
`printerSettings` is carried; a sheet-local defined name is now workbook-global;
formulas recalculate on open rather than using a stored chain; and on `09.02` one
of two hyperlinks and one VML drawing are missing, which its manifest flags.

## How the three were chosen

**Drop a sheet that no kept sheet reads.** Otherwise Excel's complaint is
ambiguous between "the picker broke this" and "you dropped the sheet it needed",
which is the one thing a gold set must not be.

That rule is enforced rather than remembered:
[`scripts/gold-set.mjs`](../scripts/gold-set.mjs) refuses a selection whose kept
sheets reach a dropped one, and follows the **defined-name hop** to find out,
because these forms point across sheets through named ranges rather than by
literal sheet name. A check reading formulas alone finds nothing and calls a
dirty drop clean.

An earlier version of this folder held thirteen files at 839 KB, swept from a
directory with the rule "keep every sheet but the last". These 252 KB test more.
Five of those thirteen were single-sheet, so nothing was dropped and the drop
path went unexercised; the rule broke `11.01` by discarding the lookups its
dropdowns read; and it threw away the sheet the TECM pivot sits on, so the
committed set exercised the pivot graft nowhere at all.

## Where these came from

OFM's published 2027-29 biennial budget instruction forms, collected 2026-06-14
from <https://ofm.wa.gov/budget/state-budget-2027-29/instructions/>. The snapshot
lives in the private `mehrlander/home` repo under
`projects/budget-drs/submittal/source-docs/2026-06-13-ofm-instructions/`, whose
`_meta/manifest.json` records a public `ofm.wa.gov` URL for each one. They are
blank published templates holding no agency data, which is why derivatives sit
in this public repo while the snapshot does not.

## Refreshing it

```
npm run gold-set            # rebuild
npm run gold-set -- --check # is this folder behind its sources?
```

Both need the `home` checkout beside this one, since the sources are not in this
repo. The selection lives in `scripts/gold-set.mjs` as a declared list with a
reason per file; changing which workbooks are here means editing that list, and
the script deletes anything in this folder the list no longer claims.

**The output is byte-reproducible, which is what makes committing it safe.** Two
rebuilds of one workbook used to differ in 31 of 34 zip entries with the content
of all 34 identical, because JSZip stamps `new Date()` on every entry it is
handed; every entry now carries one fixed date, held by the suite. So a rebuild
after a change to the kit produces a diff exactly when the kit changed something,
and none when it did not, and `--check` can tell the difference.

**Nothing runs `--check` automatically**, and that gap is real rather than an
oversight. The commit hook and CI have no `home` checkout, so neither can
regenerate these; a check that cannot run is worse than a stated limit. Run it
by hand when the kit changes.
