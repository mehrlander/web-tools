---
name: source-anchored-xlsx
description: "Build Excel workbooks where every typed number sits next to an image of its source, laid out the same way, and formatted tables draw from those numbers by formula. Use when figures are transcribed, combined or reconciled from a PDF, report, slide deck or image into a spreadsheet that must be checkable: budget and pension tables, financial extracts, valuation results, 'pull these numbers into Excel and show where they came from', or 'combine these tables' when the figures need verifying. Composes with the host-provided spreadsheet skill for construction and recalculation."
---

# Source-Anchored Workbooks

Use the host-provided spreadsheet skill for workbook construction and recalculation. In Claude Code, portable declares Anthropic's `/third-party-documents:xlsx` as a dependency; use `scripts/recalc.py` from that installed skill folder, with its `office/` companions. Without plugins, fetch the [complete official skill folder](https://github.com/anthropics/skills/tree/main/skills/xlsx). Resolve that support before creating the workbook. A different host's spreadsheet skill may use another calculation engine; it must still recalculate formulas, verify their cached values, and report zero formula errors.

## Numbers

- **Image and numbers**: put the numbers next to an image of the source, laid out the same way. Formatted tables draw from those numbers, creating an inspectable chain of provenance.
- Type each number once. Everything else is a formula; never paste a computed result as a value.
- Keep the source's precision: 4.6%, not 4.60%.
- Crop the image from the source page itself (PyMuPDF at 3x), not a screenshot, and look at the crop before placing it. Label the pair once, with the page.
- Say how each typed number arrived: read from the image, or parsed by a script. Keep the script in the file, on its own tab or in a cell comment, and note which numbers it produced.

## Layout

- Images sit next to their numbers, on the same sheet or a sheet of their own. Images may cascade over each other but never cover a cell with content.
- A one-cell anchor fixes only the top-left corner; set the height from the width to keep the aspect ratio.

## Formatting

Bold headings with a single rule below; totals bold, with a single rule above and a double rule below; no fills. Blue for typed numbers.

## Checks

- Where two sources print the same figure, transcribe both and subtract, in a small block apart from the table.
- Show the difference with green or red conditional formatting, and no status banner.

## Provenance

One line per source: what it is, its date, and any status such as preliminary. Name the script if one produced numbers.

## Verify

Recalculate with zero formula errors, read the derived cells back with `data_only=True` (every check zero), and render a page to confirm no image covers a cell with content.
