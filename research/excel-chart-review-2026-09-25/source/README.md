# PR 792: browser chart rendering review

Reviewed [mehrlander/web-tools #792](https://github.com/mehrlander/web-tools/pull/792), commit `3263a62ec6588e6e60df1afbf77697b3d1e9582c`. GitHub reported the PR open, not a draft, not merged, and not mergeable because of conflicts. The commit workflow query returned no pull-request-triggered runs. This review did not change or publish anything to that PR.

The implementation is a useful starting point for our own renderer. It resolves chart XML and drawing relationships, extracts series, expands the sheet bounds, and lazily renders SVG charts over worksheet cells. The demonstration workbook's four charts all appeared in the browser. However, the renderer currently loses information that changes the meaning of charts. I would fix the cases below, or explicitly route them to an unsupported-feature fallback, before treating the preview as an accurate representation of the download.

## Reproduced findings

### 1. Blank points become real zero points, and sparse cache indices are lost

Our unchanged native test workbook contains the line series `[2, blank, 7, 3, 9]`, for January through May. Excel's retained native export shows a January marker, a gap for February, then a connected March–May segment. PR 792 draws `[2, 0, 7, 3, 9]` as one continuous line.

The workbook has a genuinely blank source cell at `Line!B5`, but the writer stored zero at that index in the chart's numeric cache. Reading only the chart cache cannot recover the intended blank. The parser discards the source reference and blank-display policy; the renderer then adds a point for every category and connects every point. See [line path construction](https://github.com/mehrlander/web-tools/blob/3263a62ec6588e6e60df1afbf77697b3d1e9582c/lib/kits/xlsx-chart.js#L404).

A separate in-memory XML diagnostic removes cached point `idx="1"`. The parser returns values `[2, 7, 3, 9]` beside five unchanged category labels. This shifts March's 7 into February; the renderer's missing-value fallback adds a final zero for May. Sorting points does not preserve their positions when the code subsequently calls `push`. See [numeric cache parsing](https://github.com/mehrlander/web-tools/blob/3263a62ec6588e6e60df1afbf77697b3d1e9582c/lib/kits/xlsx.js#L215).

Suggested correction: preserve point indices and missingness, retain source references, resolve available worksheet values, and carry the chart's blank-display behavior into segment construction. Unknown or stale data should remain distinguishable from zero. The same index preservation is needed for sparse categories.

### 2. Stacked charts silently become clustered charts

Changing only the demonstration column chart's XML grouping attribute between `clustered`, `stacked`, and `percentStacked` produces the corresponding three parsed grouping values, but all three produce identical SVG. The renderer always calculates independent bars beside each other. It does not calculate stacked baselines, stacked extents, or percentages.

See [column rendering branch](https://github.com/mehrlander/web-tools/blob/3263a62ec6588e6e60df1afbf77697b3d1e9582c/lib/kits/xlsx-chart.js#L210) and [bar construction](https://github.com/mehrlander/web-tools/blob/3263a62ec6588e6e60df1afbf77697b3d1e9582c/lib/kits/xlsx-chart.js#L246). The two saved grouping SVGs are byte-identical.

The PR advertises clustered columns, so implementing stacking need not be a prerequisite. Detecting an unsupported grouping and declining to render it as clustered is the minimum correction. This diagnostic exercises the actual parser and renderer with modified XML in memory; it is not a fresh native Excel test of stacking.

### 3. Explicit axes and marker settings are replaced by renderer defaults

The native line fixture specifies minimum 0, maximum 10, major unit 2, and circular markers. PR 792 displays 0 through 12 and diamond markers. It also omits the fixture's axis titles. The parser's chart model contains no axes or marker settings; the line renderer always calls its automatic tick generator and chooses markers by series index.

See [automatic line axis scaling](https://github.com/mehrlander/web-tools/blob/3263a62ec6588e6e60df1afbf77697b3d1e9582c/lib/kits/xlsx-chart.js#L367) and [marker selection](https://github.com/mehrlander/web-tools/blob/3263a62ec6588e6e60df1afbf77697b3d1e9582c/lib/kits/xlsx-chart.js#L413). Explicit axis bounds must take precedence over automatic tick heuristics. Marker shape and visibility should come from the workbook when present.

## Coverage boundaries

The retained scatter fixture produces no chart container. `scatterChart` is outside the parser's supported type list. This is a coverage limitation rather than a claim that the PR promised scatter support. It nevertheless needs a visible unsupported-feature state or native-image fallback if the app is expected to show what the workbook will look like.

Other code-level boundaries include reading only one supported chart-type node per plot area, so combination charts are not fully modeled, and a duplicated chart parser in the parser and rendering kits. Consolidating that parser would reduce the chance of future fixes reaching only one path.

## What was actually tested

| Check | Result |
| --- | --- |
| Existing `tools/test/xlsx.test.mjs` at the pinned PR commit | 87 tests passed; zero failed |
| Real `pages/data-view.html` in headless Microsoft Edge 153.0.4234.48 | Both workbooks loaded; five sheet tabs examined |
| PR demonstration workbook | Two column/bar containers; three line-series paths; five pie slices |
| Retained native fixture | Column and line visible; scatter absent; line discrepancies above reproduced |
| Sparse-cache XML diagnostic | Missing index compacted away |
| Grouping XML diagnostic | Clustered, stacked, percentStacked produce identical SVG |
| Browser runtime | No captured page errors, blocked requests, or empty dependency responses |

This was fresh browser testing against native Excel images retained from our earlier testing. Excel was not reopened during this review. No screenshot pixel-difference score was calculated: the finding concerns different plotted data, axes, and markers, which can be checked directly. The fresh browser probe did not perform a download round trip. The earlier PR 796 evidence separately covers workbook identity and download experiments.

The browser used the actual PR's page, viewer, chart kit, and parser from the detached worktree. Its CDN resolver served the checkout's own code and locally installed dependencies; JSZip was injected using the same approach as the PR's browser test. Node was 24.19.0. Dependencies were reused from the research checkout, so this was not a clean lockfile installation or a full preflight/CI run.

The earlier Gemini artifact directory contains a walkthrough and native chart exports. Its `Demonstration-Charts.xlsx` differs in whole-file SHA-256 from the current PR workbook, but all four `xl/charts/chart*.xml` parts are byte-identical. That supports using those images as related chart references, without claiming the earlier exports establish identity for the current whole workbook. The definitive blank-line comparison here uses our own unchanged fixture and its previously retained native export.

## Evidence and reproduction

- [Machine-readable results](probe-results.json): workbook hashes, chart-part hashes, parsed models, explicit axes from the input XML, grouping diagnostics, browser chart elements and SVG paths, and earlier demo comparison.
- [Probe script](probe.mjs): rerunnable locally from this directory with the task's existing detached worktree and dependencies. It writes only this review output directory; synthetic changes stay in memory.
- [Unit-test output](xlsx-tests.txt) and [browser output](browser-probe.txt).
- [Native Excel line export](excel-line-reference.png) and [PR 792 browser line screenshot](native-cases-line-chart-1.png).
- The other `*-page.png`, `*-chart-*.png`, and SVG files record both workbooks' browser output.

Native fixture SHA-256: `96e0742507ef118fe00639331ba4c6acb98fe42198acb45f7c60d42dbb951326`.

Current PR demo SHA-256: `a7a7cb831aeebd42ead3f129e1b2c5b99990a2a4ef9d72d19edb14adddd3b4dd`.

From the task root, use the bundled Node executable with `TEMP` and `TMP` set to `work/pr792-review/temp`, then run `outputs/pr792-review/probe.mjs`. The exact worktree location and source fixture paths are near the top of the script. The XLSX tests run from `work/web-tools-pr792-review` with `node --test --test-reporter=spec tools/test/xlsx.test.mjs`.

## How this fits the larger plan

[PR 792](https://github.com/mehrlander/web-tools/pull/792) supplies the independent browser renderer. [PR 796](https://github.com/mehrlander/web-tools/pull/796) supplies the research, scripts, fixtures, and native Excel evidence needed to validate it. They complement one another.

Build a feature matrix around chart type, grouping, data source, blank/error behavior, axes, labels, markers, themes, and anchors. Each small experiment should change one property, record the exact workbook hash, capture Excel's output, inspect the browser's model, and compare the rendered result. First check data and geometry; use visual measurements afterward for typography and styling. A tiny corpus that catches wrong data is more valuable than many screenshots that only confirm chart presence.

For the product, keep the downloadable workbook and the preview tied to the same artifact hash. Use the independent renderer for combinations we have validated. For unsupported or uncertain combinations, a native Excel image produced on the user's machine can supply the preview. The preview should identify which rendering path produced it. That lets us build our own renderer incrementally while preserving the promise that the shown result corresponds to the actual workbook.
