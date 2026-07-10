---
name: source-anchored-xlsx
description: "Build Excel workbooks where every derived number traces back to a visible source snippet, so a reviewer can confirm at a glance that this is where a figure comes from and yes, that is what it says. Use whenever transcribing, combining, or reconciling figures from a PDF, report, slide deck, or image into a spreadsheet and the result needs to be checkable: pension and budget tables, financial extracts, valuation results, any 'pull these numbers into Excel and show where they came from' task. Covers pairing a cropped source image with its transcribed extract, single-source-of-truth formula layout, a sheet-per-source structure, robust image placement, minimal canonical-Excel formatting, and quiet conditional-format validation. Reach for this even when the user just says 'combine these tables' or 'put this in a spreadsheet,' as long as they care about verifying the figures. Composes with the xlsx skill, which handles the openpyxl and recalculation mechanics."
---

# Source-Anchored Workbooks

Spreadsheet analysis should aim for zero-trust clarity of data source and lineage. A glossy workbook hides its joints, but the joints are what need checking.

Two habits follow. Keep raw data together in a structured shape.  A formatted view should refer by formula to the raw data.

This skill is the layout and provenance layer. Lean on the **xlsx** skill for the mechanics: openpyxl construction, the mandatory `recalc.py` pass, zero-formula-error checking.

## Core principles

**One home for transcribed numbers.** Transcribed values exist in exactly one location. Everything downstream is a formula that references them. When a figure is wrong, there is one cell to fix and the correction flows everywhere on its own.

**The source rides alongside.** Put the literal source, a cropped image of the table, next to its transcription. Verification becomes a glance down the column rather than an act of faith. Pull the image from the source document itself, not from a screenshot of it: one fewer link in the chain to vouch for.

**Name the extraction path.** A figure that is not a formula arrived one of two ways: the model transcribed it from the source by reading, or a script parsed it out. The two are checked differently, so say which one produced a given number. A transcribed figure is verified against the snippet by eye, which is why the snippet rides alongside it. A script-extracted figure is verified by reading or re-running the script, so the script becomes its audit trail and belongs in the file when it does not crowd the sheet. Either way the producer's confidence is beside the point: to the reader, anything that is not a formula is suspect until checked, and the path just tells them how to check it.

**Preserve the source's precision.** If the slide shows 4.6%, store and display 4.6%, not 4.60%. Matching the shown precision keeps the eye from snagging on a difference that is not there.

**Functional color only.** Color earns its place when it encodes logic, not decoration. The one richly colored object on the page should be the source image. If a value is set by a rule, a conditional highlight can say so. A pass/fail check can be green or red. Beyond that, no fills, no font colors.

**Validation is quiet and lives apart.** A test belongs outside the table it tests. Let a conditional-formatted difference column carry the signal; skip the loud status banner.

## Pattern A: a sheet per source (the default)

This is the robust arrangement and the recommended starting point.

- One tab per source. Each holds the snippet image and, right beside or above it, the transcribed extract of that snippet. These transcribed cells are the only typed numbers in the file.
- A main tab references the extracts by cross-sheet formula and assembles the combined view. It carries no typed numbers of its own, so it reads as a finished deliverable while staying pure formula.
- Tie the pair with a shared label, distinguished only by a suffix: `Slide 8: Open Plan Normal Cost (Values)` over the transcribed table, `Slide 8: Open Plan Normal Cost (Snippet, source p.8)` over the image.

Why separate sheets help: a single-cell image anchor pins only the top-left corner, so the image floats downward by its own pixel height and can land on whatever sits below it. On its own sheet, with the transcribed table placed above and nothing beneath the image, the floating bottom edge has nowhere to collide. The arrangement is the safeguard, not a buffer.

If the user prefers everything on one tab, fall back to **Pattern B**: stack the source band beneath the outputs rather than beside them. Avoid placing a wide image to the side of a table, because row height is a property of the whole row and a tall image on the right will stretch whatever sits at the same row number on the left.

## When a script did the extracting

If figures were pulled by a script rather than read by the model, the script is part of the provenance and the file should make that plain.

- Give the script its own tab (or a cell comment if it is short), so a reader can read it or re-run it against the same source.
- Note which figures it produced, so a reader knows to check those against the script rather than the snippet.
- Keep it off the deliverable face. The main tab still reads clean; the script sits to the side the way the snippet does.

A script you can show and re-run makes its figures' provenance reproducible without the image. That is the one case where the snippet is no longer the only audit trail, so let the script stand in its place.

## Pulling the snippet from the source

Rasterize the page and crop the table region. View the crop before using it, the same verification you are asking the reader to do.

```python
import fitz                      # PyMuPDF
from PIL import Image

doc = fitz.open("source.pdf")
pix = doc[8].get_pixmap(matrix=fitz.Matrix(3, 3))   # page index, 3x for legible text
pix.save("page.png")

im = Image.open("page.png"); W, H = im.size          # crop by fractions of the page
im.crop((int(0.19*W), int(0.19*H), int(0.81*W), int(0.60*H))).save("crop.png")
```

Then `view` the crop to confirm it captured the right region cleanly.

## Placing the image (the anchor lesson)

A one-cell anchor (`ws.add_image(img, "A11")`) fixes the top-left to a cell; the bottom is unconstrained and extends by the image's absolute pixel height. The reliable layout is therefore: transcribed table on top, label, then the image last, with empty space below it.

```python
from openpyxl.drawing.image import Image as XLImage
img = XLImage("crop.png")
img.width = 760
img.height = round(760 * src_h / src_w)   # preserve aspect ratio explicitly
ws.add_image(img, "A11")                  # nothing placed below row 11 on this sheet
```

If an image must sit above other content, bound both corners with a two-cell anchor so it cannot overflow, and size the cell rectangle to the image's aspect ratio to avoid distortion. Prefer the nothing-below arrangement when you can; it needs no math.

## Formatting

Aim for the look of canonical Excel autoformat: bold header text, a single rule above and below the header row, a single rule under the last row, numbers right-aligned. No fills or font colors anywhere except the functional cases below. Gridlines on is fine.

Skip the blue-input / black-formula convention from the xlsx skill when the snippet is present. Spatial isolation already shows what is transcribed (the values beside the image) versus what is derived (the main tab), and a second color competing with the image for attention costs more than it gives. Note this is a deliberate departure from the xlsx default, justified by the snippet doing the same job color-coding would.

## Validation

Find a natural tie-out. When two sources overlap on a shared figure (a column printed on both slides), the overlap is a free consistency check: transcribe both copies independently and subtract. Place it in its own small block, not inside the main table.

```python
from openpyxl.formatting.rule import FormulaRule
from openpyxl.styles import PatternFill, Font
green = PatternFill("solid", fgColor="C6EFCE"); greenF = Font(color="006100")
red   = PatternFill("solid", fgColor="FFC7CE"); redF   = Font(color="9C0006")
ws.conditional_formatting.add("D2:D7", FormulaRule(formula=["ROUND(D2,6)=0"],  fill=green, font=greenF))
ws.conditional_formatting.add("D2:D7", FormulaRule(formula=["ROUND(D2,6)<>0"], fill=red,   font=redF))
```

A green difference column tells the reader the copies agree without raising its voice. Resist adding an "OK / CHECK" status cell on top; it is louder than the result deserves. For a value set by a rule rather than computed (a minimum that lifts an estimate above its unconstrained figure), a conditional yellow on the affected cell, tied to the condition, says it cleanly:

```python
ws.conditional_formatting.add("F2:F7", FormulaRule(formula=["F2<>E2"], fill=PatternFill("solid", fgColor="FFFF00")))
```

## Provenance

Keep it to one line, not a block. Name the source, the date, and any status that is part of what the numbers are: a figure marked preliminary or under audit reads as more settled than it is once that mark is stripped. The per-snippet caption carries the page or slide reference. When a script produced figures, name it here too, and point to the tab that holds it. Tuck longer explanation of a tie-out or a rule into a cell comment so the face of the sheet stays quiet.

## Build and verify loop

1. Build with openpyxl per **Pattern A**.
2. Run `recalc.py` and confirm zero formula errors (see the xlsx skill).
3. Reopen with `data_only=True` and read back the derived cells to confirm the formulas resolve to the expected numbers, including that every tie-out is zero.
4. Convert to PDF with LibreOffice and rasterize a page or two to eyeball the layout, checking specifically that no image overlaps a label and no validation row is stretched.

## Anti-patterns

- Computing a number in Python and pasting it as a literal. Use a formula referencing the transcribed input.
- Leaving the extraction path implicit, so a reader cannot tell a transcribed figure (check it against the snippet) from a script-extracted one (check it against the script).
- Normalizing the source's decimal precision. Match what the source shows.
- A wide image placed beside a table on a shared row grid. Stack instead, or give the image its own sheet.
- An attention-grabbing status message where a quiet conditional column would do.
- Color used for polish rather than to encode logic.