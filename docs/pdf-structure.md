# Recovering structure from a PDF, in the browser

Reference for [`lib/kits/pdf.js`](../lib/kits/pdf.js). What a PDF actually
contains, the two independent ways to read a table out of one, the tolerances
that decide whether either works, and the failure modes that are specific to
government and legislative documents.

The kit's own header covers the API; this covers the reasoning.

## The problem, stated honestly

A PDF is a list of instructions for putting marks on a page. It says "draw this
glyph at this point" and "stroke a line from here to there." It does not say
"this is a table," "this is a column heading," or "these two numbers belong to
the same row." Every structure you get back is inferred, and every inference can
be wrong.

Two consequences follow, and the kit is shaped by both:

- **Extraction is a measurement, not a lookup.** It has error, and the error is
  not uniform: it concentrates in particular places for particular reasons.
- **A single answer with no dissent is the dangerous case.** A number read
  correctly and filed under the wrong heading is worse than a number dropped,
  because nothing downstream can tell.

## Coordinates

PDF user space: origin bottom-left, **y increases upward**, units are points
(1/72 inch). The browser's origin is top-left with y increasing downward. Every
mistake in this area comes from mixing the two, and they mix invisibly because
both produce plausible-looking numbers.

The kit stays in PDF space throughout. Boxes are `{x1, y1, x2, y2}` with `y1`
the bottom edge, so `y1 < y2` always holds. Text items also carry `base`, the
baseline, which is what pdf.js reports and what decoration detection needs.
Convert to screen space at the render boundary and nowhere else.

**Each element is drawn in its own transform space.** A rule's raw coordinates
say nothing about where it sits relative to the text until you project it
through the current transformation matrix. The kit tracks the `save` /
`restore` / `transform` stack while walking the operator list, which is the
step that makes "is this line under that word" answerable at all. Get it wrong
and the lines land somewhere unrelated to the text, consistently enough to look
like a different bug.

## Two readings of the same page

The kit implements both classical methods and keeps them separate on purpose.

|  | `stream` | `lattice` |
| --- | --- | --- |
| Evidence | where the text sits | the rules drawn on the page |
| Source | `getTextContent` | `getOperatorList` |
| Works when | alignment is consistent | the table is ruled |
| Fails when | a full-width row bridges the columns; nothing aligns | rules are missing, decorative, or invisible |
| Output | column boundaries, rows | cells with spans, a matrix |

They are not a primary and a fallback. They draw on unrelated evidence, so
**running both and comparing is a control you cannot get from one of them run
twice.** Where they agree, you have two independent readings; where they
disagree, you have found the part of the page worth looking at.

The kit does not adjudicate between them, because the right resolution depends
on the document. It gives you both, in the same coordinate space, with the same
item objects, so the comparison is a `deepEqual` rather than a project.

### Inside `stream`

Two column detectors, and they fail in opposite directions:

- **`columns`, by alignment frequency.** Histogram every item's left and right
  edge; coordinates that recur are column edges. Labels align left, money
  aligns right, so both edges are histogrammed and each column reports the edge
  it was found on. A candidate supported by a subset of another candidate's
  items is the same column seen from both sides, and is dropped.
- **`gutters`, by whitespace.** Project every item's horizontal extent onto the
  x-axis and look at what is left. A band of unoccupied x is a gutter, and
  gutters divide columns.

Frequency sees columns that whitespace cannot, because a single wide row (a
title, a footnote) bridges every gutter and collapses the page to one column.
Whitespace sees columns that frequency cannot, because a column whose members
have ragged edges never registers a recurring coordinate. Disagreement between
these two is itself informative and costs one extra call.

`split` then assigns text to columns **by where a chunk starts, not where its
centre lands**. A value that overruns into the next column still belongs to the
one it began in. Centre-based assignment gets this wrong on exactly the cases
that matter, which are long values in narrow columns.

### Inside `lattice`

Five stages, in dependency order:

1. **Geometric reduction.** Filter unusable strokes, dedupe doubled ones, join
   collinear segments. This is the stage that gets skipped and then blamed on
   tolerances. Everything downstream is only as good as the line set it walks.
2. **Junctions.** Every crossing of a horizontal and a vertical rule, keyed by
   snapped position, each carrying the ids of the lines through it. "Are these
   two corners connected" is then a set intersection, not a geometry test.
3. **Atomic cells.** From each junction as a top-left corner, step right to the
   nearest junction sharing a horizontal rule, down to the nearest sharing a
   vertical, project the fourth corner, and require that it exists **and** is
   connected both ways. Taking the nearest neighbour is what makes the result
   atomic: an enclosing rectangle is never reached, because the walk stops at
   the first interior corner. The fourth-corner check is load-bearing; an L of
   rules yields three corners and no cell, and three corners prove nothing.
4. **Clustering.** Group cells into tables by **shared corner**, not shared
   edge. Corner-touching keeps a table whole across a row whose interior rules
   are fragmented, where edge-matching splits it in two.
5. **The anchor grid.** Collect every distinct cell boundary, sort, and the gaps
   between consecutive anchors *are* the logical rows and columns. A cell
   covering several gaps is a span.

With `infer` on, `close` runs between stages 1 and 2 and `project` after text
assignment; see [Inferred geometry](#inferred-geometry).

The anchor system is the part worth understanding, because it changes what you
do rather than only what you know: the grid is **derived from the data, not
assumed**. Nothing needs to know the table's shape in advance, ragged row
heights simply produce more anchors, and merged cells fall out as spans.

The price is that one stray coordinate does not merely shift an index, it
**inserts a phantom row or column** that every later cell then straddles. When a
grid comes out with one more column than the table has, suspect a stray
boundary before suspecting the cell finder.

Text lands in cells by **majority overlap**, not centroid. A line whose baseline
sits on a rule has a box straddling two cells and a centroid that can fall in
the wrong one, while the overlap areas are not close. Cells grow by `pad` first,
because text routinely overruns its cell by a fraction of a point through
nothing but coordinate rounding.

## Tolerances

Five values, each failing in its own direction. Defaults are in `pdf.config`,
and every function takes an override.

| Name | Default | What it does | What breaks when it is too large |
| --- | --- | --- | --- |
| `snap` | 1.5 | merges near-identical coordinates | a thin column collapses into its neighbour |
| `join` | 3.0 | bridges gaps between collinear segments | two tables merge into one |
| `intersect` | 1.0 | how close H and V must come to cross | grid bleed: one table's rules join another's |
| `minEdge` | 5.0 | shortest segment that counts as a rule | checkboxes and tick marks vanish |
| `reach` | 36 | how far past an open side's rule ends text may extend that side | margin text joins the first or last column |

Clustering is single-link, which has a consequence worth stating: values chain.
With `snap: 1.6`, coordinates at 10, 11.5, and 13 all land together, because
11.5 bridges them, even though 10 and 13 are further apart than the tolerance.
This is how a generous snap tolerance quietly eats a column. The behaviour is
pinned by a test.

Reach for these in order. Most bad grids are a reduction problem (`join`,
`minEdge`) rather than a snapping problem, and almost none are a cell-finder
problem.

## What breaks on government documents

These are born-digital, well-printed, and single-column, which makes them easier
than most inputs in every way except three.

- **White strokes.** A shaded header row gets its column separators drawn in the
  page background colour: invisible to a reader, fully visible to an extractor,
  which then rules the header into cells that bisect its text. The kit filters
  by stroke colour in `geom.usable`, before the junction walk. Extraction stays
  faithful and captures the white rule; filtering is a lattice-layer decision,
  which is the right place for it, because a reader might want to know the rule
  is there.
  The colour read has a silent trap (typed-array colour operands), commented at
  `toHex` in `pdf.js` and pinned by a test in both suites.

- **Dotted leaders.** `Appropriations..........$1,000,000` is often not a dashed
  line but thousands of discrete one-point segments. A single budget page can
  carry tens of thousands. Without an aggressive collinear join before the
  junction walk, the network is unusable. `geom.joinCollinear` handles this, and
  a 120-segment leader is in the browser fixture for that reason.

- **Missing perimeters.** Outer borders are often not drawn, so the cell walk
  finds no top-left corner. `lattice.close` supplies the missing edges; see
  [Inferred geometry](#inferred-geometry).

## Inferred geometry

Everything else `lattice` reports traces to a mark on the page. With `infer` on
(the default; `{ infer: false }` turns it off), two stages add geometry the page
does not draw:

- **`close`** gives each open side of a ruled region a virtual edge, at the rule
  ends (basis `rules`) or out to text within `reach` (basis `text`). A drawn
  border is never moved.
- **`project`** splits an unruled header cell along the body's column rules,
  only where no header text crosses the cut and every piece holds text, so a
  centred title spanning columns stays whole.

Each table lists what was invented in `inferred` (`{edge, at, basis}`, empty
when nothing was), and each cell lists its undrawn sides in its own `inferred`.
Check these before trusting a comparison: lattice and stream agreeing across a
`text` edge is not independent evidence, because that edge came from the text
stream reads.

A table ruled in one direction only has no junctions, so it stays `stream`'s.

## The visual layer, measured

The reason to care about any of this is usually an overlay: boxes drawn on a
rendered page, a splitter dragged across a column, text highlighted under the
pointer. Two questions decide whether that lines up, and they have different
answers.

### Does the reported box sit where the ink is?

No, and the gap is systematic. `getTextContent` reports a **typographical
container**, which includes side bearings, not an ink extent. `npm run test:pdf`
measures it per font across five standard fonts, by rendering a page at 3x and
scanning for real ink, and prints the gaps.

Two things to take from it. The container starts **before** the ink, always, by
up to a point at 12pt, which is why a shrink-wrapped box looks loose on the left
and why a naive left-edge column rule fires slightly early. And the trailing side
is **not symmetric**: an italic W leans past its own advance width (about a
point in Times-Italic), so ink exits the box on the right. Any overlay that
clips to the reported box will cut it off.

The invariant worth relying on is only the first one: ink never starts before the
box. Build containment rules on the leading edge and treat the trailing edge as
approximate. Both are pinned as assertions, including a check that the fixture
still exercises the overhang, so the asymmetry cannot quietly stop being tested.

### Do the per-character positions land on the characters?

Only if you measure them. The same run measures the boundary after `iiiii` in
`iiiiiWWWWW` at 12pt against the font's own metrics. Even division is not
approximately right, it is wrong by more than half the run: about 20pt out on a
36pt string. Canvas measurement is essentially exact when the browser's
substitute font is metrically close (Helvetica, Times-Roman), and off by 1.5 to
2.7pt when it is not (bold, italic). Courier is the control: a monospaced font
has genuinely uniform advances, both strategies agree, and the measured path
must not make it worse.

So per-character geometry is good enough for decoration matching and column
assignment, and not good enough for exact character-level hit testing in an
unusual font.

### Projecting to the screen

`pdf.view(viewport)` converts between PDF space and screen pixels, in both
directions, through the viewport's real transform and its true inverse. Give it
a pdf.js viewport or any `{width, height, transform}`; the latter is why it
tests without pdf.js in the room, and `npm run test:pdf` separately confirms it
agrees with pdf.js's own `convertToViewportPoint` to 0.02pt on a real viewport.

```js
const v = d.viewOf(1, { scale: 1.5 });      // same scale you pass to page.render()
const boxes = v.items(d.page(1));           // {left, top, right, bottom, w, h, glyphs}
v.at(px, py, boxes);                        // point hit test
v.select(dragRect, boxes, { mode: 'contain' });
v.unbox(dragRect);                          // back to PDF space, for the pure layers
```

Do not convert by dividing pixels by the scale: that ignores the transform's
translation, and the overlay drifts off the text in a way that looks like a
rendering problem. Going through the actual inverse is exact, and `unbox` closes
the loop: a rectangle the user
dragged comes back as a PDF-space region the `stream` and `lattice` functions
accept unchanged.

### One thing extraction keeps that looks like noise

pdf.js emits blank items: empty strings and lone spaces, each with a real
position. The kit keeps them. A zero-width item between two runs is often the
only mark a column break leaves behind. Filter them at the consumer
(`items.filter(i => i.str.trim())`) rather than at the source.

## What the kit does not do

Stated plainly, because the honest limit is more useful than the feature list.

- **No OCR.** `getTextContent` returns nothing for a scanned page. The lattice
  may still find the rules, but the cells come back empty. Scanned documents are
  the Python harness's problem, not this one.
- **Glyph advances are measured, not authoritative.** Per-character positions
  come from measuring the item's text with the browser's own engine using the
  resolved `fontFamily`, then scaling the run so the advances sum to the width
  pdf.js reported. Font substitution shifts the proportions; it cannot shift the
  total. The authoritative source is the font's own widths via `charsToGlyphs`,
  which lives on the worker side and is not reachable from the main thread.
  Measured error is under 0.02pt where the substitute is metrically close and up
  to 2.7pt where it is not, as measured above.
- **No reading order for multi-column prose.** `rows` groups by baseline, which
  merges two side-by-side columns of body text into one line.
- **No semantic labelling.** Nothing here decides that a cell is an agency name
  or a dollar figure. That is always corpus-specific and belongs with the corpus.

## Where this sits

The Python side of the same problem (scanned pages, OCR, multi-method
agreement) is docstruct, in `projects/pdf/` in `mehrlander/home`
([its filing](../tracker/tasks/document-structure-harness-4mz7wk.md)).
This kit is the born-digital front end of the same question: it handles the case
where a text layer exists and the difficulty is geometry. The two want the same
output vocabulary, and settling that vocabulary is open work on both sides.

## Library versions

Pinned: **pdf.js 3.4.120** and **pdf-lib 1.17.1**. pdf-lib is current (upstream
has not released since); pdf.js is three majors behind. Whether to move is
answered by running, not from a changelog: `node node/test/pdf-version-probe.mjs`
puts the same fixture and the same analysis through each version with only the
library swapped. Its run of 2026-07-25 on Chromium 141 found:

- **v4 (4.10.38) does not break this kit's code.** Every stage produces
  byte-identical output, and `await page.getOperatorList()` still returns
  `fnArray`/`argsArray`. The only real change is packaging: 4.x onward ships
  **ESM only**, so `pdf.min.js` no longer exists and a classic `<script src>`
  cannot load it. That is a loader question, not an extraction question.
- **v5 (5.4.149) is where the API breaks**, in the one place this kit reaches
  deepest: `constructPath`'s operand shape changed, so the path walk throws
  `pathOps is not iterable`. Vector rules are what the lattice runs on, so this
  is a rewrite of `extractPaths`, not a shim.
- **v6 (6.1.200) needs a newer browser.** It calls
  `Map.prototype.getOrInsertComputed`, which Chromium 141 does not implement,
  so pinning to it would exclude anyone a browser generation behind.

**The decision: stay on 3.4.120.** The corpus of prior work is calibrated
against it, and moving to v4 buys nothing measurable while costing the
classic-script load path.

**The escape hatch works, and is supported.** If a page already has pdf.js on
`window.pdfjsLib`, the kit uses it, does not load its own, and leaves the
page's `GlobalWorkerOptions.workerSrc` alone. So a page wanting v4 imports it,
sets `workerSrc`, and loads the kit after. The probe drives exactly that path.

## The page axis

A document is not a stack of independent pages. What repeats across them is
structure: running heads, folios, rules, the standing furniture that is not
content and usually has to come off before anything downstream is right.

`stream.recurring(items)` counts it. Group items by snapped position across
pages; anything appearing at the same place on enough of them is a candidate.
Each result carries `ratio`, the pages it appears on, and `varies`.

`varies` is the part that matters. **In a tabular document, body rows recur positionally too.**
Eighteen data rows at fixed heights on twelve pages produce fifty-five recurring
positions, none of which are furniture. Position alone is not a footer detector.
What separates them is whether the *text* repeats: a running head says the same
thing on every page (`varies: false`), while a folio and a data row do not.
Neither flag is sufficient alone, which is why both are reported.

`stream.trim(items, region)` then cuts. A region is a box plus a page range, six
numbers, with `mode: 'keep' | 'drop'`, and it returns **both halves**. What a
trim removes is as worth seeing as what it keeps, because the mistake to catch is
taking a row of data off with the footer.

### Why sliders and not a gesture

Trimming in three dimensions sounds like it wants a three-dimensional gesture,
and it does not. A drag on a projected scene is two numbers; the third has to
come from somewhere, and every scheme for supplying it (a modifier key, a
snapped plane, a second drag) is a guess the interface presents as a
measurement. An axis-aligned trim needs six numbers, and six numbers set
explicitly are honest about what moved.

So the split is: the **planes are dragged nowhere and drawn everywhere**. Set
them numerically, see them cut through the stack, and watch what falls outside
turn red before committing. The gesture that is worth having in the stack is
orbit, which changes nothing about the document.

## Looking at it

[`pages/pdf-inspect.html`](../pages/pdf-inspect.html) draws every layer the kit
produces on top of the page it was read from: text containers, per-character
boxes, the vector rules split into the ones the lattice will walk and the ones
it discards, both column detectors, and the lattice grid with its cell indices.
Drag on the page to select, and the panel reports the region back in PDF
coordinates with `columns` re-run over just that selection.

**Stack** mode is the page axis, drawn: every page as a translucent sheet on a
third axis, orbitable, with the trim planes cutting through the whole stack and
anything outside them shown in red before it is cut. The projection is
deliberately parallel rather than perspective, because the question the view
answers is whether an element recurs at the same position, and perspective
would put two such elements at different screen points.

Every coordinate on that page goes through `pdf.view`, and nothing on it
converts by hand. That is the point: if the overlay lines up, the projection is
right. The page is an assertion that a number cannot make.

Use it when numeric tests pass and a table still reads wrong: drawing the rules
shows that "extracted" and "walked" are different sets, and the two table
readings side by side over the *same region* show a disagreement (blank items
voting on alignment, for one) that no numeric test reports.

## Testing

- `node --test node/test/pdf-kit.test.mjs` covers `geom`, `stream`, and
  `lattice` under jsdom with hand-built fixtures. Hand-built on purpose: with a
  real PDF, a failure is ambiguous between the extractor and the analysis, and
  the analysis is what those tests are about.
- `npm run test:pdf` runs two browser passes, both against PDFs built with
  pdf-lib at coordinates the test chooses. This is the only way to have an answer
  key. Needs a browser, so
  neither is part of `npm test`.
  - `node/test/pdf-kit-browser.mjs` opens a ruled table with a white rule and a
    dotted leader in it, and checks the kit returns what went in. A second
    document holds an open-perimeter table and an unruled header.
  - `node/test/pdf-ink-alignment.mjs` renders the page and scans the pixels, so
    the box-versus-ink and glyph-boundary numbers above are measurements rather
    than claims. Run it with `--keep` to retain the fixture PDF.
