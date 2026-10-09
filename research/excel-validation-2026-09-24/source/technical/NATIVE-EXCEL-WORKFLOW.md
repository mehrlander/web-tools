# Native Excel observation and chart export workflow

This is the retained procedure from the September 24 experiment. It describes actual native computer use and the operational issues encountered. It is not an unattended macro or a tested one-command worker. Browser automation and file inspection have separate scripts in the [catalog](REPRODUCTION.md).

## 1. Tool route and ownership

The native route used the computer-use plugin's `@oai/sky` API through the Node REPL tool. Browser Playwright screenshots alone did not supply the Excel evidence. Read the currently installed computer-use skill and its API/confirmation guidance before a future run; tool signatures and capabilities can change. At this run the skill was at:

`C:/Users/mehrl/.codex/plugins/cache/openai-bundled/computer-use/26.915.31945/skills/computer-use/SKILL.md`

Native Excel control was not done by COM, PowerShell keystroke injection, VBA, a Python UI library, or the browser's automation interface. PowerShell/Python handled discovery and files; the native tool operated the visible application.

The observed sequence was to initialize `sky`, enumerate apps/windows, select the exact fixture window, read its state, perform one action against that current state, and read again. Tool results supplied current window identities and screenshot identifiers. Those identifiers, element IDs, and pixel coordinates are ephemeral. This guide intentionally does not provide old coordinates as replay targets.

Only the task's fixtures were opened/closed for the experiment. Existing unrelated workbooks were not edited, recalculated, saved, or closed. An existing Excel window was used to open a task fixture; the newly opened fixture window was then reacquired by its actual title/identity. Using the previously selected window handle after opening another workbook would have risked targeting the wrong workbook.

## 2. Establish the specimen and preconditions

1. Preserve the intended input file, record its absolute path, size, and SHA-256, and inspect its package objects. Both fixtures here had no VBA project or external-link/connection parts discovered. The PR specimen contains formulas and pivots; the controlled chart fixture contains no worksheet formulas.
2. State the calculation policy. This run requested no explicit calculation, refresh, link update, or save. It did not isolate Excel's automatic in-memory behavior on open. Do not describe it as a freshly recalculated validation.
3. Enumerate Excel windows through the native tool. Open the task fixture through the observed file dialog. The actual flow used Ctrl+F12, inspected the dialog, entered the absolute path in the observed filename field, and confirmed open.
4. Enumerate windows again and select the newly opened fixture. Inspect for repair prompts, external-content prompts, and the expected title/sheets. Neither tested fixture produced an observed repair prompt. A future prompt requires a new observation and disposition, not a silent assumption that this result generalizes.
5. Maximize using the observed window control and establish the desired sheet/view. Record zoom and capture bounds. The retained Excel window captures are 1536 × 912; most worksheet views used 100%, while the wide pivot also has a 75% view.

## 3. PR specimen: table, pivot, and reconciliation

The workbook is `demonstration-workbooks.xlsx`, with RawData, PivotSummary, FormattingAndLogic, and Reconciliation sheets. Sheet switching used the observed tabs or Ctrl+PageUp/Ctrl+PageDown, followed by a new state read. Ctrl+Home helped establish the intended region.

On RawData, inspect the headers, banding, numeric formats, and row 30 totals. Select a table cell and inspect Table Design to establish that Excel recognizes `Financials` as a native table. This is stronger evidence of native object recognition than a screenshot of table-shaped colored cells alone. Retain a worksheet view and the separate object-identity view.

On PivotSummary, select a pivot cell and inspect PivotTable Analyze to establish `FinancialPivot`. Open Change Data Source and read the source range; this run showed `RawData!$B$5:$N$30`. Capture the dialog, then cancel it. Do not confirm a source edit while gathering read-only evidence. Capture the pivot's blank group, grand totals, and the overlapping Fund slicer. Use an additional view/zoom when the wide output does not fit.

Visit FormattingAndLogic and Reconciliation. The four `PASS: EXACT MATCH` labels were visibly present. Their existence was recorded independently of the arithmetic check; later package inspection showed their formulas do not reference PivotSummary. Preserve both observations. A native screenshot is not a correctness oracle for the author's intended aggregation.

The table grand totals were 21,450 budget and 21,595 actual. The pivot grand totals were 42,900 and 43,190, with a blank group equal to the table totals. The package source range and 25-record cache explain why the 24 raw records were not the entire aggregation input. No source correction or pivot refresh was performed in this experiment.

## 4. Controlled charts: inspect, then export

Open `charts/chart-cases.xlsx` and reacquire its actual Excel window. Visit Column, Line, and Scatter. Each sheet contains a small explicit source table and a native chart anchored near E2.

Before selecting the chart, capture its worksheet window. This preserves chart appearance without selection handles and side controls obscuring it. Check the intended data behavior:

- Column: Alpha 8, Beta 0, Gamma -4, Delta 12; zero baseline and negative direction make sense.
- Line: January 2, February genuinely blank, March 7, April 3, May 9; Excel displays the February gap. The original package chart cache nevertheless stores zero at that index.
- Scatter: X coordinates 0, 1, 4, 10 with Y coordinates 0, 4, 1, 8; uneven numeric X spacing is visibly preserved.

For each chart, right-click the observed chart area and inspect the context menu. Choose **Save as Picture** from the actual menu. Inspect the save dialog, select/confirm PNG as appropriate, and enter an absolute output path in the observed filename field. This run's default location could have been the user's Pictures/OneDrive area; an explicit task output path avoided that ambiguity.

Confirm the save, then inspect the actual resulting PNG with the image-viewing tool. Do not infer success merely from a closed dialog or a nonempty file. Check readable labels, correct chart, no clipping, and absence of window/ribbon/selection controls in the clean export. All three successful PNGs were 2464 × 1322. Retain these original exports without editing, along with the separate window captures.

The chart exports were obtained through Excel's UI, not by screenshots cropped into chart images. This distinction matters: the clean PNGs are native chart export evidence; the window captures establish what was visible in the application. Their dimensions need not match the workbook writer's nominal 700 × 400 chart dimensions.

## 5. State and screenshot failure modes observed

| Observation | Recovery used | Reusable lesson |
| --- | --- | --- |
| A capture immediately after switching sheets retained transient paint from the prior sheet | Read the state again after the view settled and inspect the new frame | Successful navigation does not guarantee a settled image |
| A state read associated with the Excel selection showed an occluding Codex surface | Reactivate Excel and reacquire current state | Inspect the pixels and title, not just the stored handle; this did not authorize automating Codex through native UI |
| One state read timed out | Enumerate current windows, reacquire/activate the fixture, and retry a bounded observation | A timeout is not an export or validation success |
| Chart menus/save dialogs appeared as child screenshots with changing IDs | Use the current child screenshot's coordinates and controls | Root-window coordinates do not transfer into modal/child screenshot coordinate systems |
| A dialog/window action changed the available screen geometry | Refresh the state before the next action | Old positions are not a durable automation contract |
| Chart selection added handles and controls | Capture the worksheet before selection; use native PNG export for the clean chart | Record which visual surface each image represents |

The control loop should act on one fresh observation at a time. Do not batch a long coordinate sequence based on an old image. Do not use an old screenshot ID from this report in a future run. If a frame is stale or incorrect, retain the failed observation's meaning in the notes and acquire a valid frame; do not fabricate a corrected native image.

## 6. Close and verify

Close the task fixture, inspect any save prompt, and choose **Don't Save** for this observation/export workflow. The chart workbook produced such a prompt even though the purpose was export; it was declined. Re-enumerate windows to confirm that the task workbook is closed. Do not terminate all Excel processes or disturb unrelated documents.

Compute the original file's hash again after close. The PR specimen and chart fixture both retained their original hashes. That proves the saved input files did not change during this procedure. It does not prove the in-memory workbook state was never altered or recalculated.

Record native images and workbook identity together. In this run that relationship is established by the controlled procedure and retained evidence; the browser prototype does not cryptographically prove an image was produced by Excel. A future render worker should emit a manifest with input/final workbook hashes, capture route, Excel version, object identifiers, image hashes/dimensions, and calculation/refresh disposition.

## 7. What remains to automate

The following were not tested here: task-owned COM startup/cleanup, `Chart.Export`, `Range.CopyPicture`, VBA-driven capture, unattended/locked desktop operation, concurrent jobs, and print/PDF fidelity. Microsoft documents native API routes for [chart graphics export](https://learn.microsoft.com/en-us/office/vba/api/excel.chart.export) and [range picture copying](https://learn.microsoft.com/en-us/office/vba/api/excel.range.copypicture); these are candidates for the next controlled experiment, not executed results in this bundle.

Begin by reproducing the same three chart exports through one chosen native object-model route, compare content and dimensions with the retained UI exports, and verify clean ownership/closure. Then run repeated trials and introduce one failure condition at a time. The existing UI procedure remains useful as an independent observation path when the worker's behavior is uncertain.
