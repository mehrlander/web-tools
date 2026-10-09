# Charts and browser round trips

Excel successfully rendered three controlled charts and exported clean PNG images through its native **Save as Picture** command. A local browser page displayed those same image bytes and downloaded the exact workbook used in Excel. PR 791's current viewer omitted all three charts; it displayed their source cells only.

## Results

| Claim | Outcome | Evidence |
| --- | --- | --- |
| The PR sample's real GitHub download matches the workbook inspected in Excel | Confirmed: HTTP 200, 28,024 bytes, identical SHA-256 | [Real download test](../roundtrip-results.md) |
| Excel opens and renders the controlled chart workbook | Confirmed for Column, Line, and Scatter; no repair prompt observed | Native images and window captures below |
| PR 791 independently renders these charts | Contradicted for this fixture: three chart parts exist, but no charts appear | [Pinned viewer test](../roundtrip-chart-browser-results.md) |
| The native-image preview delivers the matching workbook | Confirmed: three received PNG hashes match; actual browser download matches the native reference workbook | [Browser evidence](native-preview-evidence.json) |
| The page rejects a workbook changed since native capture | Confirmed at page load: a changed response byte disabled the download link | Same browser evidence; original files were not changed |

## Native cases

| Sheet | Inputs and controls | Observed in Excel |
| --- | --- | --- |
| Column | 8, 0, −4, 12; Y range −5 to 15, step 5 | Positive and negative bars lie on their expected sides of zero; no filled bar for zero |
| Line | Jan–May: 2, blank, 7, 3, 9; Y range 0–10, step 2 | February is a gap; January remains an isolated marker |
| Scatter | (0,0), (1,4), (4,1), (10,8); both axes 0–10, step 2 | Uneven X spacing is preserved |

Native exports: [Column](excel-column.png), [Line](excel-line.png), [Scatter](excel-scatter.png). All three PNGs are 2464 × 1322 pixels. They were exported by Excel, not redrawn or resized by a file library. Separate [Column](excel-column-window.png), [Line](excel-line-window.png), and [Scatter](excel-scatter-window.png) window captures retain the application context.

The column image also supplies a first measured case. Using the native gridline centers and painted bar extents, the nonzero endpoints imply **8.033, −4.021, and 12.025**. Their outer painted edges differ from the specified geometric endpoints by 1.7, 1.1, and 1.3 pixels respectively. The method includes stroke and raster quantization; these are measurements, not a universal fidelity threshold. The Gamma label overlaps its bar, so disconnected blue regions inside its letters were grouped with that category. [Measurement details](column-measurements.json)

## Artifact identity and creation route

The [workbook](chart-cases.xlsx) is 13,637 bytes, SHA-256:

`96e0742507ef118fe00639331ba4c6acb98fe42198acb45f7c60d42dbb951326`

It was written with bundled XlsxWriter 3.2.9 and inspected in installed Excel 16.0.20326.20158 on September 24, 2026. The package contains three native charts, no raster images, formulas, macros, or external workbook links. Explicit axis limits and drawing anchors were checked. The nominal writer dimensions are 700 × 400; the browser preserves the actual native PNG aspect ratio. [Package manifest](chart-manifest.json)

A limited Artifact Tool 2.8.59 attempt preceded this fixture. Its consulted documentation/help did not expose the explicit axis limits and blank policy needed for this experiment. That is a limitation of the explored route, not proof that no equivalent library capability exists. No OOXML was patched.

One useful distinction: the Line source cell is blank, while its stored chart cache contains zero for February. Excel nevertheless displays a gap. A future parser must distinguish source blanks, cached chart values, and observed native behavior.

The workbook was closed without saving; its hash remained unchanged after native export and browser testing. The [browser-downloaded copy](chart-cases-downloaded.xlsx) has the same hash. No forced calculation or refresh was requested. Test browsers were closed; no PR or repository source was changed.

## Preview and next boundary

[Open the local preview file](native-preview.html) alongside the PNGs and workbook, or use the running local HTTP preview opened in Codex. [Retained browser capture](capture.png)

The prototype demonstrates native-image delivery and an exact download for this artifact. It does not add chart support to the PR viewer or establish an unattended rendering service. A next implementation would package the workbook, native images, and their hashes as one version, then add a bounded Excel rendering worker with recovery and capture checks. The independent renderer can be developed against these same native cases.
