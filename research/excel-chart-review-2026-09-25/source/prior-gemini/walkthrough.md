# Native Excel Chart Rendering in Web-Tools

We have successfully engineered and delivered native Microsoft Excel chart rendering directly over worksheet cells inside the `web-tools` Excel viewer (`pages/data-view.html` & `lib/alpineComponents/viewer.js`) on branch **`gemini/excel-charts-viewer`**, fully tested, committed, and published via GitHub Pull Request: **[#792](https://github.com/mehrlander/web-tools/pull/792)**.

---

## Architecture & Implementation Overview

1. **Strict Zero-Dependency Architecture**:
   - Built with 100% vanilla SVG graphics.
   - Zero external charting libraries (no Chart.js, Highcharts, or ApexCharts), maintaining ultra-lightweight bundle size and instant load performance.

2. **OpenXML Chart & Drawing Pipeline ([`lib/kits/xlsx.js`](file:///C:/Users/mehrl/Code/gh/web-tools/lib/kits/xlsx.js))**:
   - Parses `<c:chartSpace>` definitions from `xl/charts/chart*.xml`.
   - Extracts cached plot points (`<c:numCache>`, `<c:strCache>`), series definitions, category labels, number format codes, and titles.
   - Resolves drawing relationships (`xl/drawings/_rels/drawing*.xml.rels`) to associate two-cell anchors (`xdr:twoCellAnchor`) with chart parts.
   - Extended `sheetLayout` to expand the worksheet grid bounding box across drawing anchor coordinates (`to.col`, `to.row`), preventing chart truncation when charts extend beyond raw data cells.

3. **High-Fidelity SVG Renderer ([`lib/kits/xlsx-chart.js`](file:///C:/Users/mehrl/Code/gh/web-tools/lib/kits/xlsx-chart.js))**:
   - **Office 2013-365 Theme Palette**: Accents 1-6 (`#1b6288`, `#e46c24`, `#24693d`, `#0f82c2`, `#942c7f`, `#e5b422`).
   - **Clustered Column Chart**: Dynamic tick calculation with `niceTicks`, cluster spacing, multiline category labels, horizontal gridlines, and right-side legend.
   - **Horizontal Bar Chart**: Bidirectional horizontal bars crossing a dynamic vertical \$0 baseline for variance analysis with negative figures.
   - **Multi-Series Line Chart**: High-precision polyline paths with custom geometric markers (diamonds, squares, triangles, circles) matching native Excel markers.
   - **Pie Chart**: Precise trigonometric SVG arc slices (`M ... A ... Z`) beginning at 12 o'clock clockwise with theme colors and legend.

4. **Viewer Integration ([`lib/alpineComponents/viewer.js`](file:///C:/Users/mehrl/Code/gh/web-tools/lib/alpineComponents/viewer.js))**:
   - Lazily loads `kits/xlsx-chart.js` on workbook initialization.
   - Places `.xl-chart-container` elements at precise cell offsets (`dx`, `dy`, `width`, `height`).
   - Integrates seamlessly with existing workbook features (tables, pivot tables, frozen panes, formatting).

---

## Ground Truth Verification: Microsoft Excel vs Web-Tools SVG

We generated a native Excel test workbook ([`demonstration-charts.xlsx`](file:///C:/Users/mehrl/Code/gh/web-tools/docs/examples/demonstration-charts.xlsx)) via Microsoft Excel COM automation, exported reference images directly from Excel, and compared them side-by-side with our web-tools SVG renders:

### 1. Clustered Column: Budget vs Actual by Division

````carousel
![Native Microsoft Excel Export](C:/Users/mehrl/.gemini/antigravity/brain/71fb05a6-090d-4167-b515-57b3176e3aa7/Chart1_Direct.png)
<!-- slide -->
![Web-Tools Zero-Dependency SVG](C:/Users/mehrl/.gemini/antigravity/brain/71fb05a6-090d-4167-b515-57b3176e3aa7/rendered-chart-1-column.png)
````

### 2. Horizontal Bar: Net Variance with Baseline Cross ($k)

````carousel
![Native Microsoft Excel Export](C:/Users/mehrl/.gemini/antigravity/brain/71fb05a6-090d-4167-b515-57b3176e3aa7/Chart2_Direct.png)
<!-- slide -->
![Web-Tools Zero-Dependency SVG](C:/Users/mehrl/.gemini/antigravity/brain/71fb05a6-090d-4167-b515-57b3176e3aa7/rendered-chart-2-bar.png)
````

### 3. Multi-Series Line: Quarterly Outlay Trajectory with Markers

````carousel
![Native Microsoft Excel Export](C:/Users/mehrl/.gemini/antigravity/brain/71fb05a6-090d-4167-b515-57b3176e3aa7/Chart3_Direct.png)
<!-- slide -->
![Web-Tools Zero-Dependency SVG](C:/Users/mehrl/.gemini/antigravity/brain/71fb05a6-090d-4167-b515-57b3176e3aa7/rendered-chart-3-line.png)
````

### 4. Pie Chart: Expenditure Share by Object

````carousel
![Native Microsoft Excel Export](C:/Users/mehrl/.gemini/antigravity/brain/71fb05a6-090d-4167-b515-57b3176e3aa7/Chart4_Direct.png)
<!-- slide -->
![Web-Tools Zero-Dependency SVG](C:/Users/mehrl/.gemini/antigravity/brain/71fb05a6-090d-4167-b515-57b3176e3aa7/rendered-chart-4-pie.png)
````

---

## Full Worksheet Context Renders (In-Situ)

### Sheet 1: Column and Bar Charts with Styled Tables
![Sheet 1 Column and Bar](C:/Users/mehrl/.gemini/antigravity/brain/71fb05a6-090d-4167-b515-57b3176e3aa7/rendered-sheet-column-and-bar.png)

### Sheet 2: Trends and Shares (Line & Pie Charts with Table Data)
![Sheet 2 Trends and Shares](C:/Users/mehrl/.gemini/antigravity/brain/71fb05a6-090d-4167-b515-57b3176e3aa7/rendered-sheet-trends-and-shares.png)

---

## Verification & Test Results

1. **OpenXML Parser Unit Tests ([`tools/test/xlsx.test.mjs`](file:///C:/Users/mehrl/Code/gh/web-tools/tools/test/xlsx.test.mjs))**:
   - `parseChartXml`: validated title, series, categories, values, and format codes.
   - Drawing placement: validated two-cell anchors, `row`, `col`, and drawing bounding boxes.
   - **Result**: All unit tests passed (`pass 133 / fail 0`).

2. **Browser Viewer Integration Tests ([`tools/test/viewer-xlsx.mjs`](file:///C:/Users/mehrl/Code/gh/web-tools/tools/test/viewer-xlsx.mjs))**:
   - All browser-based workbook and extraction checks passed (`all checks passed`).

3. **End-to-End Headless Chart Verification ([`tools/test/verify-chart-styles.mjs`](file:///C:/Users/mehrl/Code/gh/web-tools/tools/test/verify-chart-styles.mjs))**:
   - Headlessly loads `demonstration-charts.xlsx`.
   - Validates chart presence, titles, bar counts, polyline line paths, marker elements, and pie slice arcs across both sheets.
   - Tests horizontal scrolling on mobile viewports to guarantee charts slide behind sticky row headers.
   - **Result**: All checks passed (`ALL CHECKS PASSED`).

---

## Follow-up Enhancements (Gutter Hoisting Fix & Excel Tabs)

### 1. Sticky Row Number Gutter Hoisting Fix
- **Issue**: On mobile or narrow viewports, scrolling horizontally caused charts (`z-index: 2`) to paint directly on top of the sticky row number gutter (`z-index: 1`), blotting out row numbers.
- **Fix**: Elevated `thead th` and `tbody th` to `z-index: 20`, and the top-left corner cell to `z-index: 30`. Charts (`z-index: 2`) now cleanly slide *underneath* the sticky row gutter during horizontal scroll.

````carousel
![Before: Chart hoisted over row gutter (User Screenshot)](C:/Users/mehrl/.gemini/antigravity/brain/71fb05a6-090d-4167-b515-57b3176e3aa7/.user_uploaded/media_1790287570475.png)
<!-- slide -->
![After: Charts cleanly scroll behind row gutter](C:/Users/mehrl/.gemini/antigravity/brain/71fb05a6-090d-4167-b515-57b3176e3aa7/mobile-gutter-scrolled.png)
````

### 2. Authentic Microsoft Excel Tab Bar
- Styled authentic Microsoft Excel worksheet tabs matching desktop/web Excel:
  - **Taper & Borders**: Active tab has tapered/rounded top corners (`border-radius: 3px 3px 0 0`) with a 1px border that connects flush into the sheet stage (`border-bottom: 1px solid #ffffff`). Inactive tabs are flat (`border-radius: 0`) with no heavy box outlines.
  - **Coloring**: Inactive tabs have transparent background blending naturally into the `#f3f3f3` toolbar (not dark gray), with subtle `#e8e8e8` hover feedback. Active tab is crisp `#ffffff`.
  - **Green Accent Line**: Replaced the top overbar with a green underline under the text (`text-decoration: underline 2px solid #107c41; text-underline-offset: 3px`).
  - **Typography**: Active tab text is bold black (`#000000; font-weight: 600;`), not green.
  - **Spacing**: Compact horizontal padding (`3px 8px`) and tight gap (`gap-0.5`), removing excessive horizontal whitespace around tabs.
  - **Clean Toolbar**: Removed the theme dropdown to keep the interface focused and authentic.

### 3. Solid Borders on Line Numbers (No Bleed-Through)
- **Issue**: In Chromium and WebKit browsers, tables with `border-collapse: collapse` collapse the borders between sticky `th` elements and scrolling data cells. Sticky `th` background fills only cover their padding box, leaving the 1px collapsed border space shared with whatever elements scroll underneath (causing colored SVG lines to bleed through the line number borders).
- **Fix**: Switched the sheet grid to `border-collapse: separate; border-spacing: 0;` with explicit `border-left`, `border-right`, `border-top`, and `border-bottom` on the sticky gutter cells and `box-sizing: border-box`. Each row number is now a 100% opaque rectangle with its own solid borders on all 4 sides, completely blocking charts or images underneath.

````carousel
![Before: Chart lines bleeding through collapsed row number border gaps](C:/Users/mehrl/.gemini/antigravity/brain/71fb05a6-090d-4167-b515-57b3176e3aa7/gutter-before-border-fix.png)
<!-- slide -->
![After: Solid borders on line numbers with zero bleed-through](C:/Users/mehrl/.gemini/antigravity/brain/71fb05a6-090d-4167-b515-57b3176e3aa7/gutter-exp4-separate.png)
````

### 4. Minimal Table Styling & Proportional Column Widths
- **Minimal Table Design**:
  - Uncolored summary table headers (`.tbl-hdr` and `s="3"`) feature a crisp, uninterrupted bottom underline (`border-bottom: 2px solid #000000;`) with NO top, left, or right borders (`border-side: none`).
  - Table data cells have all borders completely removed (`border: none`), eliminating distracting box grids and vertical column dividers.
  - In `lib/alpineComponents/viewer.js`, `styleCss` now explicitly emits `border-side: none` for omitted edges when cell borders are styled, preventing default `#e3e3e3` sheet gridlines from cutting through partially bordered cells.
- **Proportional Column Width Tuning**:
  - **Sheet 1**: Adjusted Column B to width 26 (comfortably fits the longest division label with breathing room, while letting titles in B2 and B3 spill smoothly across adjacent empty cells), Column C to 12, Column D to 12, and Column E to 4 as a spacer before the chart.
  - **Sheet 2**: Adjusted Column B to width 24 (comfortably fits expenditure category labels), and Columns C, D, and E to width 11 (plenty of room for currency and share figures).

````carousel
![Sheet 1: Clean Minimal Tables with Tuned Column Widths](C:/Users/mehrl/.gemini/antigravity/brain/71fb05a6-090d-4167-b515-57b3176e3aa7/current-sheet1.png)
<!-- slide -->
![Sheet 2: Trends and Shares with Header Underlines and Borderless Data](C:/Users/mehrl/.gemini/antigravity/brain/71fb05a6-090d-4167-b515-57b3176e3aa7/current-sheet2.png)
````


