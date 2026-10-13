# Excel rendering research: findings, evidence, and next experiments

This guide records the experiments conducted on September 24, 2026, in America/Los_Angeles. Some machine logs are dated September 25 because they use UTC. It covers native Excel, PR 791's browser viewer, workbook delivery, chart creation, native image export, and the first geometry measurements. It preserves observations at a specific revision and environment, not a claim about every Excel workbook or the current state of the repository.

The scripts tell much of the story, but not all of it. File generation, package inspection, browser loading/downloads, and pixel measurements have retained scripts. Opening Excel, inspecting its native objects, and exporting chart PNGs were performed interactively through computer use. There is no tested one-command native rendering worker yet.

**Reading paths:** [reproduction and script catalog](REPRODUCTION.md), [native Excel workflow](NATIVE-EXCEL-WORKFLOW.md), [read-only evidence verifier](verify-evidence.py), [script snapshot index](script-index.json), [file inventory](evidence-manifest.json).

## 1. What the tests establish

| Question | Result | Primary retained evidence |
| --- | --- | --- |
| Can the installed Excel open the PR demonstration workbook? | Yes, without an observed repair prompt | [Native table](../excel-table-design.png), [pivot source dialog](../excel-pivot-source-dialog.png) |
| Does its PivotTable aggregate just the 24 data records? | No; its source includes the table totals row, and the displayed grand totals are doubled | [Native pivot](../excel-pivot-summary.png), [package facts](package-facts.json) |
| Do its four reconciliation PASS labels prove pivot correctness? | No; their formulas do not reference PivotSummary | [Native reconciliation](../excel-reconciliation.png), package facts |
| Is the PR's table/pivot styling an exact native reproduction? | No; inspected colors, banding, spacing, and slicer representation differ | [Browser pivot](../browser-pivot-summary.png), [right side](../browser-pivot-summary-right.png) |
| Does the actual Raw link deliver the inspected PR workbook? | Yes, through a real GitHub HTTP 200 response and completed browser download | [Live evidence](../roundtrip-live-evidence.json) |
| Can Excel render the controlled column, line, and scatter cases? | Yes | [Column](../charts/excel-column.png), [Line](../charts/excel-line.png), [Scatter](../charts/excel-scatter.png) |
| Can Excel export clean chart images through the UI? | Yes, Save as Picture produced native PNGs | Native PNGs plus corresponding `*-window.png` captures |
| Does the pinned PR viewer render these native charts? | No; it renders their source cells but no charts | [Chart browser evidence](../roundtrip-chart-browser-evidence.json) |
| Can a browser display the Excel PNGs and deliver their workbook? | Yes; received image bytes and downloaded workbook bytes match the retained native references | [Native preview evidence](../charts/native-preview-evidence.json) |
| Can a changed workbook be detected before enabling this preview's link? | Yes, at page load in the tested prototype | `changedWorkbookGuard` in native preview evidence |
| Have COM export, unattended operation, print rendering, or broad Excel emulation been established? | No | These remain explicit next experiments |

These are three different validation questions: **identity** asks whether bytes match; **meaning** asks whether inputs, objects, and calculations are right; **appearance** asks what Excel and the browser display. Passing one does not establish the others.

## 2. Environment and immutable identities

Original task root:

`C:/Users/mehrl/Documents/Codex/2026-09-24/tak`

| Item | Recorded value |
| --- | --- |
| PR | [mehrlander/web-tools #791](https://github.com/mehrlander/web-tools/pull/791) |
| Pinned source revision | `5109699ac5eea3ca510947859ff9e5cb3980676e` |
| Installed Excel executable version | `16.0.20326.20158` |
| Excel path | `C:/Program Files/Microsoft Office/Root/Office16/EXCEL.EXE` |
| Edge used by tests | `153.0.4234.48`, launched with Playwright channel `msedge` |
| Playwright / Node in native-preview test | `1.62.1` / `v24.19.0` |
| Runtime bundle | `26.904.11930` |
| Final chart writer | XlsxWriter `3.2.9` |
| Limited alternative writer attempt | Artifact Tool `2.8.59` |
| Capability probe PowerShell | Core `7.6.5`, STA |
| Additional discovered packages | openpyxl `3.1.5`, ImportExcel `7.8.10`; discovery is not execution evidence |

The bundled Python probe did not find `win32com` or `xlwings`; other Python installations were not excluded. Ambient `python` resolved to an Inkscape interpreter, so reproduction commands use explicit runtimes. Excel COM registration was present, but this run did not test COM activation. The current native route used `@oai/sky` through the computer-use Node REPL.

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| [PR demonstration workbook](../demonstration-workbooks.xlsx) | 28,024 | `998d5483e1dee7db4c14c9f17142842f5eba451825b33afefa5fc11f4c82be14` |
| [Controlled chart workbook](../charts/chart-cases.xlsx) | 13,637 | `96e0742507ef118fe00639331ba4c6acb98fe42198acb45f7c60d42dbb951326` |
| [Column native PNG](../charts/excel-column.png) | 19,320 | `95efaee02f88d9bf30badfa3858c9d211059fd3c9909b2fb043d36a58054c587` |
| [Line native PNG](../charts/excel-line.png) | 52,347 | `aefc5c1ae7e7323e58018ac15c04076ad9f3c5053c2e1803b8e98bacf9584f81` |
| [Scatter native PNG](../charts/excel-scatter.png) | 14,711 | `fd2276e89febf149c4353af33ba13eaf9a8b666447371c817aa4a9b6d1bd600f` |

Hashes were unchanged after native inspection/export and the final browser checks. Native workbooks were closed without saving. No forced recalculation or data refresh was requested. This does not establish that Excel performed no automatic in-memory work on open. Original files, native images, and later downloaded copies are retained separately.

## 3. Table and PivotTable findings

The PR specimen has four sheets: RawData, PivotSummary, FormattingAndLogic, and Reconciliation. Package inspection found a native table `Financials` at `RawData!B5:N30`, `totalsRowCount="1"`, with `TableStyleMedium2`. Excel's Table Design UI confirmed the native table identity. Its native pivot is `FinancialPivot` at `PivotSummary!B5:O19`; PivotTable Analyze confirmed that identity.

Both package XML and Excel's Change Data Source dialog show an explicit source range `RawData!$B$5:$N$30`. The data is in rows 6–29. Row 30 contains the table totals. The pivot cache has `recordCount="25"`, consistent with the 24 data records plus the totals row. The recorded source is a cell range, not a source expression that automatically excludes the table total.

An independent ZIP/XML sum of `J6:J29` and `K6:K29` gives 21,450 budget and 21,595 actual, with a difference of +145. All 48 source cells are numeric inputs. The table total formulas are:

```text
J30 = SUBTOTAL(109,Financials[Budget])
K30 = SUBTOTAL(109,Financials[Actual])
L30 = SUBTOTAL(109,Financials[Variance])
```

| Visible aggregation | Budget | Actual | Variance |
| --- | ---: | ---: | ---: |
| Raw data total | 21,450 | 21,595 | +145 |
| Pivot `(blank)` group | 21,450 | 21,595 | +145 |
| Pivot grand total | 42,900 | 43,190 | +290 |

The pivot's blank group repeats the source totals. Native Excel and the browser both show the doubled grand total. Thus matching the native result here would reproduce an underlying workbook error. The experiment did not fix it, refresh the cache, or rebuild the source; it inspected the retained artifact.

The four PASS checks are narrower than their surrounding headings might suggest:

| Reconciliation cell | Formula compares |
| --- | --- |
| E6 | RawData FY2028 actual SUMIFS against FormattingAndLogic actual SUM |
| E7 | RawData FY2028 budget SUMIFS against FormattingAndLogic budget SUM |
| E8 | Dashboard actual minus budget against dashboard variance SUM |
| E9 | RawData actual minus budget against RawData variance SUM, data rows only |

F6:F9 turn the corresponding zero differences into `PASS: EXACT MATCH`. None of E6:E9 references PivotSummary. [Package facts](package-facts.json) preserve the full formulas and cached results. This explains why those checks can pass without testing the pivot's aggregation.

Appearance also differs. Excel showed dark teal headers with white text, stronger blue banding, native filter controls, hierarchy controls, and a Fund Filter slicer. The browser's default theme showed lighter blue headers with black text and lighter banding. Spacing differed. The slicer was absent from the browser, and in Excel it overlapped part of the pivot. These are observations, not proposed changes to PR 791. FormattingAndLogic's native color scales and data bars were captured, but a complete browser parity test for those objects was not performed.

## 4. Chart specification, serialization, and native behavior

The single controlled chart workbook has three sheets, each with one native chart. Inputs are synthetic; there are no worksheet formulas, macros, external workbook links, or embedded raster images. The package contains three chart XML parts and three drawing XML parts. [Chart manifest](../charts/chart-manifest.json) preserves chart references, numeric caches, bounds, steps, and anchors.

| Case | Source | Explicit controls | Native observation |
| --- | --- | --- | --- |
| Column | `A4:A7`: Alpha, Beta, Gamma, Delta; `B4:B7`: 8, 0, −4, 12 | Y −5 to 15, step 5 | Positive and negative bars lie on the expected sides of zero; Beta has no filled bar |
| Line | Jan–May; 2, blank, 7, 3, 9 | Y 0 to 10, step 2; gap policy; circular markers | February is a gap; January is an isolated marker; March–May are connected |
| Scatter | X 0, 1, 4, 10; Y 0, 4, 1, 8 | Both axes 0 to 10, step 2; markers without a connecting line | Uneven numeric X spacing is preserved |

The builder uses Arial, blue `#2563EB`, no legend, a chart at E2, and nominal dimensions 700 × 400 pixels. Headers start at row 3. In the builder's shared specification, `type: "bar"` is translated to an XlsxWriter **column** chart. The scatter series uses the categories reference as numeric X values.

The alternative Artifact Tool attempt was deliberately limited. Consulted documentation/help exposed bar/line/scatter creation, source bindings, dimensions, and major units, but did not expose the explicit min/max bounds and blank policy needed for this experiment. The final controlled fixture used XlsxWriter. This is not a benchmark or proof that Artifact Tool cannot express equivalent controls through another API. The unmodified attempt and inspection output are retained in the source snapshots. No direct OOXML patch was used to obtain the final native result.

### The blank-cell/cache distinction

`Line!B5` exists as a formatted cell with no numeric value and no formula. The on-disk chart cache nevertheless has point index 1 with value `0`. The writer was instructed to use gaps and omitted `c:dispBlanksAs`. XlsxWriter documents gap as its default blank-cell behavior. [XlsxWriter chart documentation](https://xlsxwriter.readthedocs.io/chart.html#chart-show-blanks-as)

Excel displayed a gap, not a zero point. The observation proves a difference between a source blank, a serialized numeric cache value, and native display. It does not isolate whether Excel resolved worksheet references, refreshed an in-memory cache, or used another internal path. No in-memory cache dump or save-and-diff experiment was performed. A parser that relies solely on the stored cache would need to address this case explicitly.

### Native PNG export and sizing

Using Excel's chart-area context menu, **Save as Picture** exported three clean PNGs, each 2464 × 1322 pixels. The native UI captures are separate from these exports and include the Excel window. No file-library render or screenshot crop was substituted for a native export.

The intended 700 × 400 chart size and the 2464 × 1322 export do not have the same aspect ratio. Package verification calculated the nominal size from two-cell anchors under stated row/column conversion assumptions. Native export dimensions were measured directly. The relation between anchor interpretation, actual chart dimensions, font metrics, display scaling, and PNG export resolution was not isolated. Do not assume a universal DPI multiplier from this one run. A future test should read native chart Width/Height and vary one sizing factor at a time.

## 5. What the current browser viewer did

The tests loaded the original `pages/data-view.html` at the pinned revision, together with the actual viewer and `xlsxKit` dependency chain. They did not replace the viewer with a mock rendering implementation.

For the PR specimen, the existing repository source-address input was used. The contents API response supplied the exact retained workbook bytes. For the local chart fixture, the existing `#gz` data envelope was used:

```text
{kind: "data-view/1", title: "...", items: [
  {name: "chart-cases.xlsx", content: "data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,..."}
]}
```

The JSON was gzip-compressed, base64url-encoded, and passed to `data-view.html?use=<revision>#gz=<payload>`. This exercised an actual local-file input path without inventing a GitHub address for the synthetic workbook.

On each of Column, Line, and Scatter, the stage contained zero canvas, SVG, and image elements. Inspection of the actual parsed model found no drawing keys and no chart-model keys. The screenshots display only the source cells. Object counts alone would not establish absence for every possible renderer; here they corroborate the screenshots and model inspection. [Detailed browser result](../roundtrip-chart-browser-results.md)

The local-envelope view exposed Raw, Sheet, Grid, and Structure modes, with no original-file URLs or whole-XLSX download/rebuild action. The Structure Extract Save path emits an `.extract.json` envelope; it is not an XLSX round trip. No re-export was invented for the test.

### Transport and environment controls

Browser viewport was 1440 × 1000, device scale factor 1. Browser dependencies were supplied from cached files because direct sandbox fetches were blocked. GitHub contents responses were reconstructed with base64 of the original bytes; library source files were not edited. JSZip 3.10.1 was preloaded using the repository visual-test approach. Original CDN resources were cached, including Alpine and collapse resources. Phosphor icon CSS/font assets were unavailable, affecting navigation chrome. Vendor assets are retained as the observed bytes; they are not all governed by the repository commit.

The router maps supported requests by URL pattern and often by basename. It returns 404 for unmapped assets. This is an experiment harness, not a general browser proxy or proof of an unchanged live deployment. Before applying it to a later revision, inspect request mapping, name collisions, loaded-module status, and missing resources. A local cache can hide network/deployment behavior while still testing the pinned rendering code.

## 6. Browser download investigation

The original Raw link opens a new target. The first probe watched only the source page's download event and used page-scoped routing; it timed out. The corrected probe installs request routing at browser-context scope and registers download listeners on both existing and newly opened pages.

Three outcomes are retained distinctly:

1. **Corrected live attempt, blocked:** the exact Raw GET failed with `net::ERR_NETWORK_ACCESS_DENIED`.
2. **Same-URL local transport:** fulfilling that request with the retained original bytes emitted a real browser download. This verified browser delivery under controlled transport, not a fresh GitHub fetch.
3. **Real live download:** after network permission was granted, the root-context execution received GitHub HTTP 200, `application/octet-stream`, 28,024 bytes, and a completed download with matching SHA-256 and `failure: null`.

The subagent retry did not receive the effective network permission in that run; execution from the granted root context did. This is an observed tool/environment distinction, not a universal statement about permission propagation.

The successful request also emitted navigation-level `net::ERR_ABORTED` as the attachment was handed to the browser download. The response, completed download, bytes, and hash established success; treating every navigation-aborted event as a failed file download would misclassify this case. [Live evidence](../roundtrip-live-evidence.json) and [earlier attempts](../roundtrip-evidence.json)

The current probe uses a five-second wait for observing the download, then awaits its save. That is a local test bound, not a suitable universal timeout. It records observations and does not reliably return a failing process exit code for every failed attempt. Consumers must inspect the report and completed download, not just shell exit status.

## 7. Native-image preview prototype

[native-preview.html](../charts/native-preview.html) is a separate diagnostic page, not a PR modification. It serves three native PNGs and `chart-cases.xlsx` from a loopback HTTP server. Tabs are accessible by mouse and keyboard. Image sizing preserves the PNG aspect ratio. The workbook link is disabled until a page-load SHA-256 check matches the hardcoded workbook identity from the native export run.

The browser test verifies all three actual image-response bodies against the retained PNG hashes, image decoding, natural dimensions, aspect ratio, tab selection, and the displayed workbook hash. It clicks the actual download link, saves the delivered XLSX, and compares its hash with the unchanged source. It then alters one response byte in transport only, reloads the page, and asserts that the changed workbook disables the link. Original files are not changed. The route is restored, the page reloads successfully, and a final screenshot is retained.

**Limits of the prototype:** the hash guard runs at page load. It does not continuously monitor files or bind the second download GET to the earlier hash request. It does not embed image-integrity enforcement in the page; image hashes are checked by the test. It has no authenticated manifest, release system, or content-addressed serving. For production, publish the workbook and native captures together under one immutable version and ensure the download selects that version. The test demonstrates identity for this run, not an unconditional guarantee under later concurrent file replacement.

The preview test browser uses 1280 × 1080, device scale 1. Images decode at 2464 × 1322 and display at about 1005.97 × 539.73 CSS pixels. The test permits an aspect-ratio difference below 0.002 to accommodate fractional CSS layout; that is not a pixel-fidelity threshold.

## 8. Pixel measurement method and interpretation

The first measurement uses the unmodified Column PNG. Frequent native colors and long gray gridline runs identify the series color `(37,99,235)` and plot bounds `[229,156,2411,1198]`. The top/bottom gridline centers correspond to 15 and −5. The zero baseline is at Y 937.5.

For a vertical coordinate `y`, the value estimate is:

```text
value = 15 - ((y - 156) / (1198 - 156)) * 20
```

The script finds connected blue regions within those bounds and assigns them to four category bins by X position. Gamma's text lies on its negative column. Blue interiors of letters therefore create small disconnected components; grouping by category prevents treating those fragments as additional bars. Raw components remain in the report.

| Input | Outer painted endpoint estimate | Paint-edge minus expected geometric Y |
| ---: | ---: | ---: |
| 8 | 8.033 | −1.7 pixels |
| −4 | −4.021 | +1.1 pixels |
| 12 | 12.025 | −1.3 pixels |

Beta has no colored component. The measurements locate outer painted edges, including stroke and raster quantization, rather than an abstract centerline or vector rectangle boundary. No image was stretched or recolored, and no tolerance was tuned to declare success. [Full measurement record](../charts/column-measurements.json)

This is a deliberately narrow algorithm: one color, four equally spaced categories, known bounds, no legend inside the plot, no gradients, and no other blue annotations. Tiny regions below 30 pixels and pixels farther than 12 RGB levels from the series color are not included. It is not a general chart-recognition system. Line-marker and scatter-coordinate measurements remain future cases.

## 9. Native execution lessons

The [native workflow guide](NATIVE-EXCEL-WORKFLOW.md) records the observed sequence and tool patterns. The useful operational findings are:

- Excel's accessibility data was weak; screenshots and newly observed coordinates were used.
- A fresh Excel screenshot once showed stale/occluded content. Activating the selected Excel window and recapturing corrected it. A later capture timeout recovered after selecting the current window again.
- A capture immediately after a sheet switch retained transient paint from the prior sheet. A subsequent settled frame was clean.
- Modals and chart menus had their own screenshot IDs. Coordinates must correspond to the specific image; a child dialog's coordinate system is different from the whole window's.
- Window size changed during some dialog interactions. Old coordinates were not reused after those changes.
- Save as Picture initially defaulted to a Pictures location. Absolute task-output paths were supplied before saving.
- Closing the chart workbook prompted to save changes. Don't Save preserved the original byte identity; the close result and hash were checked.

Other Excel workbooks were already open. Only task-owned fixtures were inspected and closed. Global calculation settings, trust settings, unrelated workbook contents, and the user's repository were not changed. Native export was interactive and visible; headless Edge does not make Excel headless.

## 10. What is not yet known

No tests established COM chart export, range clipboard capture, PDF/print rendering, hidden/minimized Excel export, unattended sessions, application restart recovery, native recalculation/save normalization, external refresh, workbook editing preservation, chart interactions in the browser, or coverage of advanced Excel objects. The sample was not a representative compatibility corpus.

There is also no reliable effort estimate for emulating all of Excel. These tests do support a smaller strategy: serve native images where fidelity matters, retain workbook identity, and grow a selected independent renderer against controlled native cases. Basic rendering geometry and Excel's automatic layout/default behavior should be tested separately.

## 11. Suggested next experiments

| Priority | Question | Smallest useful experiment and retained evidence |
| --- | --- | --- |
| 1 | Can native exports be repeated without manual menu work? | One owned Excel instance, one chart, bounded object-model export; retain open/activation/capture/save/cleanup observations and decoded output |
| 2 | Can the worker recover? | Deliberately fail one owned job, verify timeout handling and subsequent job success without touching unrelated workbooks |
| 3 | What controls export size? | Read native chart Width/Height; vary one of anchor, dimensions, zoom, display scale, and font; record output size and plot bounds |
| 4 | How does the blank cache behave? | Create blank/zero/missing/error variations, inspect pre-open XML, native output, and a separately saved post-open copy |
| 5 | How should package publication work? | Store workbook, captures, and hashes as one immutable version; test switching versions and stale requests |
| 6 | What should an independent chart model contain? | Decode one column chart's relationships, series, category/axis types, bounds, and blank policy; compare geometry with this native reference |
| 7 | What layout defaults matter next? | Long labels, automatic bounds, number formats, legends, multiple series, stacked values, date axes; one factor per case first |
| 8 | Can tables and print layouts use equivalent evidence? | Separate native range-image and PDF cases; compare within the same grid or print scope |

Microsoft documents `Chart.Export(FileName, FilterName, Interactive)` as a graphics export returning a Boolean. That makes it a candidate for the next native automation test, not something executed by this study. [Chart.Export](https://learn.microsoft.com/en-us/office/vba/api/excel.chart.export)

`Range.CopyPicture(Appearance, Format)` copies a range picture to the clipboard, so a usable file would need an additional capture/export step. It was not used here. [Range.CopyPicture](https://learn.microsoft.com/en-us/office/vba/api/excel.range.copypicture)

## 12. How the retained material should be used

Start with the read-only verifier to establish that the evidence still matches its inventory. Use the script catalog to select a narrow rerun. Preserve the old artifacts before running scripts that write their fixed output names. Use a new case directory for new generators or native saves, because regenerated workbooks may have different ZIP metadata and hashes even when their visible data matches.

The source snapshots preserve what was present at documentation time, including exploratory assumptions and limited assertion coverage. They are not a cleaned-up SDK or a portable installer. The guide, scripts, machine-readable evidence, and original native images are complementary: together they explain what was intended, what ran, what was observed, and what still requires an experiment.
