# Favicon archive

The project's icon work in one place: the marks it ships, and the ones it has retired. New favicon designs go here.

## Active

### Hex nut (project mark)

<img src="../../lib/favicon.svg" width="48" height="48" alt="slot-split hex nut">

Canonical file: [`lib/favicon.svg`](../../lib/favicon.svg). A slot-split hex nut: a hexagon (modular; its left/right points read as `<` `>`) with a round bore, split down the middle to pop the angle brackets. Blue-600.

The root [`apple-touch-icon.png`](../../apple-touch-icon.png) is the same mark rasterized at 180 × 180 for iOS, which does not use the SVG favicon for a Home Screen tile. `app/index.html` declares that PNG explicitly because the app is served below the `/web-tools/` project path rather than at the origin root.

This is the library-wide mark. `lib/gh-boot.js` inlines a copy and injects it as the default favicon on any loader page that declares no icon of its own, and the [pages index](../../pages/index.html) points its `<link rel="icon">` and header logo here too.

### Repository marks

Files: [`repos/`](repos/). Drawn 2026-10-22: one mark per estate repository except web-tools, whose mark is the hex nut. The app draws each wherever it lists repositories (the sidebar, the repo menu, Map › Reach and Map › Projects), reading the file named for the repository from the hub at its selected ref, main outside a preview (`repoMarkSrc` in [`app/index.html`](../../app/index.html)).

A repository can also declare its mark in its own manifest, as `mark` (a path, or `owner/repo:path` for one of these files) beside its `icon` glyph, and colour either with `tone` ([`manifest-fields.csv`](../manifest-fields.csv)). [`lib/kits/repo-mark.js`](../../lib/kits/repo-mark.js) draws the result in the session page's scope pill and checkouts panel, the estate's rows, cards and Sessions table, the sidebar and the repo switchers. The sidebar and the repo switcher take a declared `mark` first, then the file named here, then the glyph; the other surfaces read only what the manifest declares, so there a repository with no `mark` draws its glyph.

### Map marks

Files: [`map/`](map/). Drawn 2026-10-22: one mark for each of the Map's tab groups, each a miniature of the view it opens, and one for each outpost but Work PowerShell, which wears the wps project's mark. The Map draws them on its tab strip, its Overview headings, and its outposts in Reach and in Outposts.

### Primitive marks

Files: [`primitives/`](primitives/). Drawn 2026-10-24: one mark for each column primitive in [column-primitives.md](../column-primitives.md#the-four), named for its value. `docs/vocabularies.csv` names each file in the `icon` column of that primitive's row, and the Map's Data tab draws it, in the primitive's colour, on each column declared with that primitive.

## Drawn marks

A project's or a program's own icon is an SVG drawn to the rules of the budget-drs app icon (`mehrlander/home:projects/budget-drs/app/favicon.svg`), as are an agent's icon and the repository and Map marks above:

- `viewBox="1.5 1.75 29 29"`, solid fills, no strokes.
- Every gap at least 2.5 units, about 1.4 CSS px at 16.
- A project's or a program's mark takes a colour no other project or program uses; an agent's icon is coloured too, and may repeat a project's colour. Every other mark is filled with `currentColor`, which an `<img>` draws black, so a page paints it as a CSS mask in its text colour.
- The hub's repositories share a hexagon, and the public-record stores stand on the detached base bar (`<rect x="2" y="24.4" width="28" height="4.6"/>`).
- A `<desc>` says what the mark depicts.
- The options considered for a mark sit beside it in `alternatives/` as `<mark>.<option>.svg`. Choosing one swaps it with the mark, which moves into `alternatives/`.

## In review

### Angled 3D hex nut

<img src="web-tools-icon-3d.png" width="96" height="96" alt="blue hex nut rendered at a slight three-dimensional angle on graphite gray">

File: [`web-tools-icon-3d.png`](web-tools-icon-3d.png). A 180 × 180 candidate with a lighter graphite tile, the blue mark reduced to roughly two-thirds of the canvas, and shallow extrusion. The [iPhone size check](../../pages/scratch/web-tools-icon-preview.html) compares the production-size raster with the active tile at 60, 40, and 29 CSS pixels. This is a design candidate, not the shipped Home Screen icon.

### Per-page emoji marks

Many pages carry their own emoji favicon, written inline as a `data:image/svg+xml` URI holding a single `<text>` glyph, among them 🌿 branch, 📊 data-view, 🔖 links, 🧪 console-playground, 💎 shorter, 🔍 review and pdf-inspect, ✍️ word-select, 🐈‍⬛ compression-helper, 🥏 toss-render. A page that declares none inherits the hex nut from `gh-boot.js`, so the estate needs no per-page icon file and no registry.

## Treatments

A treatment is a mark this project does not own, restyled to say something about how it is being shown. One so far.

### Dimmed (a toss)

A toss shows its **subject's** favicon, not its own, desaturated to `saturate(0.15)` and faded to `globalAlpha` 0.78 on a 64 px canvas, emitted as a PNG. So the tab names the page being rendered without impersonating the deployed one, and the 🥏 frisbee becomes the mark for a render with no addressable subject behind it.

**Except where there is nothing to impersonate.** A repo that serves no Pages has no deployed twin at any ref, so a private page read at its own default branch is not standing in for anything: a toss is the only way to open it at all. Those icons come through undimmed, at full colour, which is also what a bookmark of that address then keeps. Off the default branch the dimming returns and says what it always said, that this is not the canonical version. The test is `has_pages` on the REST repo object, read once per repo and cached, and an unanswered call keeps the dimming. The escape button in the drawer asks the same question of the same endpoint, for the same reason: [`lib/alpineComponents/fab.js`](../../lib/alpineComponents/fab.js), `liveTwin`.

Why dimming rather than a badge, why those two values, the mechanics, and why the output is a PNG rather than an SVG are in the comments above `DIM_SATURATE` and `adoptSubjectIcon` in [`pages/toss-render.html`](../../pages/toss-render.html).

## Retired

### Grid (former pages-index identity)

<img src="grid.svg" width="48" height="48" alt="2x2 card grid, one accented">

File: [`grid.svg`](grid.svg). A rounded tile holding a 2x2 grid of cards, one accented in amber: the pages index as a collection of tools. Indigo-to-sky gradient.

Kept as a design reference.
