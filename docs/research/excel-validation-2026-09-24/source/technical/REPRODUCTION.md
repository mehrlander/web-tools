# Reproduction, scripts, and preserved sources

Start with the [technical findings](README.md). This document explains what can be replayed, which files a replay writes, and what still requires an interactive Excel session. The [native workflow](NATIVE-EXCEL-WORKFLOW.md) covers that session.

## 1. Verify the retained evidence first

The research archive contains the `excel-validation/` directory. Its `technical/evidence-manifest.json` lists relative file paths, byte counts, and SHA-256 hashes. It excludes itself. This inventory detects accidental changes to retained files; it is not a signed attestation of how the screenshots were produced.

Use Python 3.9 or later, with no additional packages:

```powershell
# From the extracted excel-validation directory:
python ./technical/verify-evidence.py
```

On the original machine, use the known bundled interpreter instead of relying on the ambient `python` command:

```powershell
$excelPython = 'C:/Users/mehrl/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'
& $excelPython 'C:/Users/mehrl/Documents/Codex/2026-09-24/tak/outputs/excel-validation/technical/verify-evidence.py'
```

The verifier reads files only. It checks every listed file's size and hash, then independently reads workbook ZIP/XML to check the raw totals, pivot source range, number of chart parts, and the line's blank worksheet cell versus stored zero chart cache. Its output also preserves reconciliation formulas and pivot-cache metadata. Exit code 0 means the implemented checks passed; code 1 means a mismatch or package check failed. Do not run Python with `-O`, because the package checks use assertions. `--packages-only` skips the inventory and produces the package facts alone. `--bundle <directory>` selects another extracted copy.

This does not open Excel, refresh a PivotTable, recalculate formulas, inspect screenshot content, or retest the browser. A preserved screenshot's hash proves file identity, not visual correctness. Extra files are not rejected, and the inventory does not hash itself.

## 2. What is in the archive

| Location | Purpose |
| --- | --- |
| Bundle root | Original PR workbook, native worksheet screenshots, browser screenshots, downloaded copies, and first-stage result/evidence records |
| `charts/` | Controlled workbook, native chart/window PNGs, package manifest, measurements, diagnostic preview page, browser capture, and downloaded workbook |
| `technical/` | Detailed findings, this guide, native workflow, verifier, package audit, and hash inventory |
| `technical/scripts/` | Frozen copies of experiment scripts; original directory relationships are recorded in the index |
| `technical/source-cache/` | Cached PR viewer and dependency assets used by the browser probes; retained as reference source, with existing notices intact |
| `technical/history/` | Earlier probe diagnostics and the limited Artifact Tool writer attempt |
| `technical/skill/` | Snapshot of the reusable `validate-excel` skill and its supporting files |

[script-index.json](script-index.json) maps each snapshot to its original task-relative path, role, size, and hash. The broader [evidence manifest](evidence-manifest.json) also covers the reports, screenshots, workbooks, and documentation. Runtime binaries, installed packages, browser profiles, and the `node_modules` junction are excluded. The archive does not install dependencies.

## 3. Script catalog and write behavior

Original task root: `C:/Users/mehrl/Documents/Codex/2026-09-24/tak`.

The following paths are relative to that root. Copies under `technical/scripts/` preserve the source text exactly; relocating them does not automatically relocate their outputs. Several scripts derive paths from their own location, and some use absolute paths. Review those before replaying into a new experiment directory.

| Original path | What it did | Replay constraints and writes |
| --- | --- | --- |
| `work/native-test/inspect-package.py` | Inventoried the PR workbook's ZIP objects, sheets, table/pivot/style parts | Uses the original fixture/path layout; writes `work/native-test/package-inventory.json` |
| `work/native-test/browser-probe.mjs` | Loaded the pinned viewer and captured table/pivot appearance | Requires nearby cached assets and bundled Playwright/JSZip; writes browser screenshots/evidence. Its initial page-only download observation missed the Raw link's new target; use the next script for delivery |
| `work/native-test/browser-roundtrip.mjs` | Observed context-level requests, new pages, downloads, and downloaded bytes | Default attempts live network and local same-URL fulfillment. `--live-only` tests actual network delivery. Writes `roundtrip-*.json`, PNGs, and XLSX copies under the original output directory. Several failures are recorded rather than asserted, so inspect the JSON, not just the exit status |
| `work/native-test/browser-chart-probe.mjs` | Submitted the exact chart fixture through the viewer's actual `#gz` local-envelope input, inspected parser and stage objects | Requires fixture absolute path as its argument and nearby cached assets. Writes three browser PNGs and `roundtrip-chart-browser-evidence.json`. Records chart counts; does not treat zero charts as an execution failure |
| `work/native-test/chart-fixture/builder.mjs` | Created the controlled specification and tested two native-chart writers | `--xlsxwriter` selects the final writer; otherwise takes the exploratory Artifact Tool route. Writes `specification.json` every run and uses fixed output paths for XLSX files. Imports Artifact Tool even with the XlsxWriter flag. Requires the original module setup or an explicit adaptation |
| `work/native-test/chart-fixture/verify-package.py` | Inspected final chart parts, axes, series, anchors, genuine source blanks, and the limited alternative writer output | Uses fixed original paths; rewrites `charts/chart-manifest.json` and the alternative-attempt evidence. Reads package XML, not the running Excel object model |
| `work/native-test/native-preview-test.mjs` | Tested native PNG delivery, image decoding/aspect ratio, keyboard tabs, exact workbook download, and altered-workbook rejection | Has `--output-dir`, `--playwright`, `--browser`, and `--native-workbook-sha256` options. Writes a capture, downloaded XLSX, and JSON evidence in the chosen directory. Does not invoke Excel |
| `work/native-test/serve-native-preview.mjs` | Served the five preview input files through a loopback HTTP allowlist | Uses the original output layout; prints a temporary URL and stays running until stopped. It is a convenience preview server, not a deployed service |
| `work/native-test/inspect-chart-pixels.py` | Counted colors and long gray rows/columns to locate likely gridlines | Requires Pillow and its expected relative image path. Prints observations; no image edits |
| `work/native-test/measure-column.py` | Measured colored bar components against explicit plot bounds and the known value scale | Requires Pillow, image path, plot bounds, and output path. Writes measurement JSON; does not automatically infer axes or labels |
| `work/native-test/pr791-verify-table-styles.mjs` | Repository visual-test reference that informed the local browser setup | Copied reference source, not a local test reported as executed unchanged. Retained in source-cache, not classified as an authored experiment |
| `outputs/validate-excel/scripts/Probe-ExcelCapabilities.ps1` | Read-only capability inventory | Discovers applications/packages and accepts an explicit Python interpreter. Does not start Excel or establish COM success |

The browser probe scripts are research instruments, not a uniform test framework. The native-preview test contains explicit assertions for its central claims. The new read-only verifier provides a separate repeatable check of retained evidence. Neither turns the remaining exploratory scripts into universal pass/fail tests.

## 4. A bounded replay of the native-image browser test

This is the most self-contained browser experiment. It reuses already exported native PNGs; it does not reproduce native Excel capture. Run into a fresh directory so the historical record stays intact.

On the original machine, from the task root:

```powershell
$excelNode = 'C:/Users/mehrl/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
$excelReplay = Join-Path (Get-Location) ('work/native-preview-replay-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $excelReplay -ErrorAction Stop | Out-Null
$excelInputs = @('native-preview.html', 'chart-cases.xlsx', 'excel-column.png', 'excel-line.png', 'excel-scatter.png')
foreach ($excelInput in $excelInputs) {
    Copy-Item -LiteralPath (Join-Path 'outputs/excel-validation/charts' $excelInput) -Destination $excelReplay
}
# The original browser launch needed a task-owned temporary directory.
# These environment assignments affect only this shell and its child processes.
$excelOldTemp = $env:TEMP
$excelOldTmp = $env:TMP
try {
    $env:TEMP = $excelReplay
    $env:TMP = $excelReplay
    & $excelNode './work/native-test/native-preview-test.mjs' --output-dir $excelReplay --native-workbook-sha256 '96e0742507ef118fe00639331ba4c6acb98fe42198acb45f7c60d42dbb951326'
    if ($LASTEXITCODE -ne 0) { throw 'Preview assertions failed; inspect the replay evidence.' }
} finally {
    $env:TEMP = $excelOldTemp
    $env:TMP = $excelOldTmp
}
```

For an extracted archive on another machine, use `technical/scripts/native-preview-test.mjs`, supply `--output-dir` explicitly, and supply `--playwright <absolute package directory>` plus `--browser <browser executable>` if the bundled paths/Edge channel are unavailable. Adapt the input-copy source to the extracted `charts/` directory. Use the environment's dependency-discovery tool before assuming a runtime path exists.

These commands are a documented adaptation for preserving evidence. They were not rerun during the documentation pass; the earlier retained native-preview execution succeeded. The original script and its evidence remain available for comparison.

The test starts and closes its own loopback server and browser. It checks input hashes, native PNG response bytes, image dimensions, browser download bytes, a one-byte altered workbook response, and restored normal behavior. Inspect `native-preview-evidence.json`, including its outcome, browser errors, image results, download result, and changed-workbook guard. The mutation occurs in a browser route response; it does not modify the fixture on disk.

The page's hash guard only runs on load. The download later makes a separate request. A server could change the workbook between those requests; this prototype does not close that gap. Future integration should bind the displayed images and downloadable file to an immutable render record, and either use a verified Blob for download or guarantee an immutable download endpoint.

## 5. Replaying the original PR viewer

The viewer's browser probes expect cached assets next to the script in `work/native-test`. Source-cache snapshots must be restored to those filenames in a separate copied experiment tree, with the PR specimen in the tree's `outputs/excel-validation/`. Review fixed paths before running. Do not point a replay at the preserved output directory unless overwriting those results is intentional.

The probes serve the original `data-view.html` over loopback, pin the `use` parameter to `5109699ac5eea3ca510947859ff9e5cb3980676e`, supply original app assets through Playwright routes, and inject the installed JSZip distribution in the same manner as the repository visual-test reference. Third-party bundles are separately cached dependency bytes, not files claimed to come from the PR revision. Existing routes deliberately return 404 for requests outside the bounded cache. Some navigation icon fonts were not supplied.

The chart input is an actual `data-view/1` envelope:

```javascript
const envelope = {
  kind: 'data-view/1',
  title: 'Native Excel chart validation fixture',
  items: [{
    name: 'chart-cases.xlsx',
    content: 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,' + workbookBase64
  }]
};
// gzip UTF-8 JSON; encode as base64url; append as #gz=<encoded>.
```

This local input has no original remote XLSX link. Do not confuse the viewer's Structure/Extract JSON save action with a workbook download. The separate PR Raw-link experiment exercises a real remote XLSX source and watches new browser-context pages/downloads because the anchor opens a new target.

For network results, retain the actual request URL, HTTP response, completed download status, byte count, and hash. A locally fulfilled response proves delivery behavior separately from actual GitHub transport. A navigation-level `ERR_ABORTED` is not sufficient to classify an attachment download as failed: the successful retained run has that navigation event and a completed exact-byte download with null failure. Conversely, an event named `downloaded` in the exploratory report is not enough; inspect the saved file and fields.

The first blocked attempt, local fulfillment, and successful live attempt are all retained. Do not rewrite the blocked record into a success or interpret the block as a workbook/viewer defect.

## 6. Native workbook generation and export

The final chart workbook came from the XlsxWriter branch of `builder.mjs`. The common specification fixes synthetic data, chart dimensions, fonts, source ranges, axes, and blank policy. It is generated from arrays embedded in the builder; editing the emitted JSON alone will not persist through another builder run.

The alternative writer attempt and its package inspection are retained under `history/chart-fixture/`. The investigated API surface did not provide all requested controls for that attempt. This is a limited exploration result, not proof that the library cannot support them by another route.

There is no retained tested script that opens Excel and exports all three PNGs unattended. The native steps used computer use. Follow the separate native workflow and preserve new screenshots and hashes. Do not substitute a library's render for Excel and label it native evidence.

The PNG exports are 2464 × 1322 even though the writer's nominal chart size was 700 × 400. The exact relationship to Excel sizing, DPI, font metrics, and export behavior has not been isolated. Preserve natural dimensions rather than forcing the output back to the nominal ratio.

## 7. Repeating the column measurement

The original measurement command shape is:

```powershell
# From the task root; choose a NEW output filename.
& $excelPython './work/native-test/measure-column.py' './outputs/excel-validation/charts/excel-column.png' --plot 229 156 2411 1198 --rgb 37 99 235 --output './work/column-measurements-replay.json'
```

Those plot bounds were established for this exact PNG. The script uses the known four categories and a known Y range of -5 to 15; it is not a general chart detector. It identifies nearby blue pixels with RGB tolerance 12, finds four-neighbor connected components, rejects components smaller than 30 pixels, and groups fragments into known category bins. The zero baseline is computed from the explicit scale.

Read the [measurement discussion](README.md#8-pixel-measurement-method-and-interpretation) before reusing the numbers. Labels can split or contaminate mark components. The measured outer paint boundary includes stroke/raster effects and is not automatically the mathematical endpoint. No image cropping, recoloring, or generated replacement was used for this evidence.

## 8. What to record in the next run

Use a new run directory with a small case specification, exact writer source/dependencies, workbook hash before native open, Excel version, selected calculation/refresh policy, native capture route and natural dimensions, browser revision/viewport, actual downloaded hash, and a claim-by-claim result. Preserve failed attempts with their cause or unresolved status. Record any changes made during native open/export separately from the input package.

A useful next automation unit is one controlled workbook in a task-owned Excel session, three chart exports, clean close, and a manifest linking workbook and image hashes. Once that works repeatedly, add table/range capture and more chart families. The existing archive supplies baseline cases and evidence, not a claim that those next units already exist.
