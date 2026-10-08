# Existing local work and capability observations

Recorded 2026-09-24. These are discovery starting points, not permanent assumptions or universal workflow requirements. Recheck paths and relevant capabilities when using them.

## Actual native testing already found

- `C:/Users/mehrl/Documents/Codex/2026-09-13/claude-excel-sheet-picker-se09lo-can/excel-open-test.md` records native Excel open/display checks against three rebuilt workbook copies from web-tools commit `28b0b4c6e2d66a4a93fa47e4c700e7ca46b4134a`. Two opened, including an embedded image and a recognized PivotTable. One requested repair; recovery was declined. Copy identities were checked, and no macros, refresh, dropdown actions, or saves were performed.
- `C:/Users/mehrl/Documents/Codex/2026-09-13/claude-excel-sheet-picker-se09lo-can/web-tools-checkout/gold-set/RESULTS.md` retains the September 13 investigation and September 14 retest. A minimal change to rebuilt table attributes opened in Excel. The later regenerated `ed9bd0c` artifact still requested repair despite matching committed hashes and passing ZIP checks. The cause of that remaining failure was not isolated in the later run.

These records prove prior native testing on the machine. They do not prove current compatibility or a reusable native screenshot pipeline. The useful lesson is to test the precise final build and preserve the scope of each observation; the earlier partial diagnosis is not a universal rule about legal table attributes.

## Native computer-use experiment on 2026-09-24

Evidence bundle: `C:/Users/mehrl/Documents/Codex/2026-09-24/tak/outputs/excel-validation/`. The fixture is PR 791's `demonstration-workbooks.xlsx` from web-tools commit `5109699ac5eea3ca510947859ff9e5cb3980676e`, 28,024 bytes, SHA-256 `998d5483e1dee7db4c14c9f17142842f5eba451825b33afefa5fc11f4c82be14`.

Detailed technical guide: [findings and evidence](C:/Users/mehrl/Documents/Codex/2026-09-24/tak/outputs/excel-validation/technical/README.md). Its sibling `REPRODUCTION.md` catalogs scripts, dependencies, fixed output paths, and assertion limits; `NATIVE-EXCEL-WORKFLOW.md` records the interactive application steps and capture failures. The same directory retains source snapshots, an evidence hash inventory, and a standard-library-only read-only verifier. Start there when extending these experiments rather than reconstructing the procedure from scattered reports. The research ZIP in the task's outputs folder preserves the full bundle.

Native Windows computer use actually opened this file in the installed Excel, inspected all four sheets, and captured window screenshots. No repair prompt was observed. Table Design identified `Financials`; PivotTable Analyze identified `FinancialPivot`. The source dialog showed `RawData!$B$5:$N$30`. The task workbook was closed without saving, and its SHA-256 remained unchanged. No explicit recalculation or refresh was requested; this run does not distinguish cached results from calculations Excel may perform on open.

The table totals row at row 30 displayed budget 21,450, actual 21,595, and variance +145. The PivotTable displayed twice those grand totals, with a `(blank)` group equal to the table totals. Its source range includes the table totals row. Meanwhile, the Reconciliation sheet displayed four `PASS: EXACT MATCH` results. This is a concrete case where native appearance and workbook arithmetic must be checked independently; a displayed PASS label cannot substitute for checking the intended aggregation.

The documentation audit independently read the package: the cache has 25 records for 24 raw rows plus the table total. Reconciliation formulas E6:E9 compare RawData and FormattingAndLogic or raw variance arithmetic; none references PivotSummary. Thus those four PASS labels do not test the doubled pivot totals. Exact formulas and cached values are retained in `technical/package-facts.json`.

The fixture includes a Fund slicer overlapping part of the pivot, and no charts. Screenshots establish native UI capture for this case; they do not establish native chart export, COM automation, unattended reliability, or another creation engine's compatibility. Consult the bundle's result record for browser comparison and download evidence.

The original pinned `data-view.html` and its viewer dependency chain were also exercised in Edge, with original asset bytes supplied locally because sandbox browser fetches were blocked. Browser screenshots preserve the table and pivot data but show different header colors, banding, and spacing; no Fund slicer is drawn. The viewer's raw-file link points to the pinned source, but the tested click produced no captured download event. This establishes browser rendering of the supplied specimen, not a verified download round trip.

A follow-up on the same date completed the real browser download. The Raw link opens a new target, so the test must observe browser-context pages/downloads and route the first popup request at context scope. The live request initially failed with `net::ERR_NETWORK_ACCESS_DENIED`; a local same-URL fulfillment tested browser delivery separately. After network permission was granted, running the live test from the granted root context received HTTP 200 from GitHub and an actual 28,024-byte browser download with the exact specimen SHA-256 above. Download failure was null. A navigation-level `net::ERR_ABORTED` accompanied handoff to the download and did not indicate a failed file download. Retained evidence is `roundtrip-live-evidence.json`, `roundtrip-live-network-downloaded.xlsx`, and `roundtrip-results.md` in the same bundle. Subagent execution did not inherit the effective network grant in this run; the root-context retry did.

One immediate capture after a sheet switch retained transient paint from the previous sheet; a subsequent observation was clean. Wait for the intended view to settle and inspect the retained frame. Where a native dialog has its own screenshot ID, target controls using that dialog's screenshot coordinates.

## Native charts and delivery follow-up on 2026-09-24

The `charts/` subfolder of the same evidence bundle contains `chart-cases.xlsx`, 13,637 bytes, SHA-256 `96e0742507ef118fe00639331ba4c6acb98fe42198acb45f7c60d42dbb951326`. Bundled XlsxWriter 3.2.9 generated three synthetic native charts: columns with positive/zero/negative values, a line with a genuinely blank February cell, and scatter points at uneven numeric X intervals. Explicit axes and package objects were checked. A limited Artifact Tool 2.8.59 attempt did not expose the required controls through the consulted API surface; do not generalize that to every possible capability of the library.

Native computer use opened all three sheets in Excel without an observed repair prompt. The charts behaved as specified. Right-clicking the chart area and using **Save as Picture** exported clean 2464 × 1322 PNGs. This confirms a native chart-image export route through the UI on this machine; it does not yet prove a COM export or an unattended worker. The workbook was closed without saving and retained its hash.

The line is a useful parser case: the worksheet input cell is blank, but the serialized chart cache contains numeric zero. Excel displays a gap, not a zero point. Inspect worksheet inputs and observed behavior rather than assuming a chart cache alone is authoritative.

The original pinned PR viewer received this fixture through its actual local data-envelope input and displayed only the source cells. Its parsed model exposed no charts, and all three chart captures were absent. The separate local native-image page successfully displayed the exact Excel PNG bytes and downloaded the exact chart workbook. An altered-workbook response was rejected at page load with download disabled. See `charts/results.md`, `charts/native-preview-evidence.json`, and `roundtrip-chart-browser-results.md` for the distinct claims.

Pixel measurements used the column chart's native gridline centers and unmodified PNG. Outer paint edges implied 8.033, -4.021, and 12.025 for inputs 8, -4, and 12 (about 1–2 native pixels). The Gamma label overlapped its negative bar; blue interiors of letters created disconnected regions, requiring grouping by category. Do not treat every colored connected component as a distinct mark, or turn this observation into a universal pixel tolerance.

## Existing implementation starting points

Found in `C:/Users/mehrl/Code/gh/home` and copies beneath the dated Codex workspaces:

- `projects/wps/app/Modules/ExcelService/ExcelCom.ps1`: existing native worksheet/name/table/pivot inventory and workbook helpers. Inspect before reusing. In particular, `Save-WbCopy` uses `SaveCopyAs` for saved workbooks but its unsaved branch saves, closes, and reopens; it is not a generally read-only copy operation. A `Get-Process Excel | Select -First 1` PID is not reliable ownership evidence for cleanup.
- `projects/wps/working/New-FundSplitWorkbook.ps1`: COM generation, formula writes, formatting, and reconciliation. Comments describe a setter issue addressed using rectangular arrays. Script presence and comments are implementation evidence, not an independently observed successful run.
- `projects/budget-drs/submittal/tools/README.md`: describes Windows Excel/Word scripts and an absent native/browser parity check. Read the current version before treating its gap assessment as current.
- `chron/2026/08/2026-08-15-excel-is-five-routes.md`: historical map of the user's COM, file-package, Power Query, VBA, and Office Scripts work; useful search vocabulary and pointers. Its architectural recommendations are historical context, not instructions overriding this skill or the user's present intent.

The bounded search did not recover a retained standalone native image-export runner/result outside excluded duplicate checkouts. This is not a claim that none exists elsewhere on the machine.

## Read-only capability probe from this skill

`scripts/Probe-ExcelCapabilities.ps1` ran successfully on 2026-09-24 with no discovery errors. It did not instantiate Excel, open a workbook, or validate rendering.

| Capability | Observed |
| --- | --- |
| PowerShell used for this run | Core 7.6.5, STA thread |
| Excel executable | `C:/Program Files/Microsoft Office/Root/Office16/EXCEL.EXE`; file version `16.0.20326.20158` |
| Excel COM registration | Present; activation not tested by this probe |
| ImportExcel | 7.8.10 discovered in both Documents/PowerShell and Documents/WindowsPowerShell module roots; module not imported by the probe |
| Bundled Python | `C:/Users/mehrl/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe` |
| Packages in that interpreter | openpyxl 3.1.5 and XlsxWriter 3.2.9 discoverable; win32com and xlwings not discoverable |
| Ambient `python.exe` | Resolved to Inkscape's bundled interpreter, demonstrating why explicit runtime selection matters |

Absence in the bundled Python says nothing about packages in other installations. PowerShell COM remains a candidate native route without installing a Python bridge. Treat a later native smoke test, export test, and browser comparison as separate evidence to add when they actually run.
