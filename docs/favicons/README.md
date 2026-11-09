# Favicon archive

The project's icon work in one place: the marks it ships, and the ones it has retired. New favicon designs go here.

## Active

### Hex nut (project mark)

<img src="../../lib/favicon.svg" width="48" height="48" alt="slot-split hex nut">

Canonical file: [`lib/favicon.svg`](../../lib/favicon.svg), a slot-split hex nut in blue-600.

The root [`apple-touch-icon.png`](../../apple-touch-icon.png) is the same mark at 180 × 180 for an iOS Home Screen tile, declared in [`app/index.html`](../../app/index.html).

[`lib/gh-boot.js`](../../lib/gh-boot.js) inlines a copy of the hex nut as the default favicon of any loader page without its own, and the [pages index](../../pages/index.html) uses the same mark for its icon and header logo.

### Repository marks

Files: [`repos/`](repos/), one mark for each of the owner's repositories except web-tools, whose mark is the hex nut. [`lib/kits/repo-mark.js`](../../lib/kits/repo-mark.js) draws each wherever the app or the [session page](../../pages/session.html) names its repository.

A repository's manifest can name its own mark file in `mark` and its colour in `tone`; where no mark file can be read, the manifest's `icon` glyph draws ([`manifest-fields.csv`](../manifest-fields.csv)).

### Map marks

Files: [`map/`](map/), one mark for each of the Map's tab groups, each a miniature of the view it opens, one for each [outpost](https://mehrlander.github.io/web-tools/app/?view=map&tab=outposts), and [`outposts.svg`](map/outposts.svg) for outposts as a kind. The Map draws them on its tab strip, its Overview headings, and its outposts.

### Primitive marks

Files: [`primitives/`](primitives/), one mark for each column primitive in [column-primitives.md](../column-primitives.md#the-four), named for its value. [`docs/vocabularies.csv`](../vocabularies.csv) names each file in the `icon` column of that primitive's row, and the Map's Data tab draws it, in the primitive's colour, on each column declared with that primitive.

## Drawn marks

Project, program and agent icons, and the repository and Map marks above, are SVGs drawn to these rules:

- `viewBox="1.5 1.75 29 29"`, solid fills, no strokes.
- Every gap between filled areas at least 2.5 units, about 1.4 CSS px in a 16 px favicon.
- A project's or program's mark takes a colour no other project or program uses, and a repository's mark one no other repository uses; shortcut-tools' mark keeps the pink and violet of Apple's Shortcuts icon. An agent's icon may repeat a project's colour.
- A mark without a colour of its own, such as a Map mark, is filled with `currentColor`, and a page paints it as a CSS mask in a colour it chooses, since an `<img>` would draw it black.
- The hub's repositories share a hexagon, the public-record stores stand on the detached base bar (`<rect x="2" y="24.4" width="28" height="4.6"/>`), and a program's mark is cut from a rounded tile in its colour (`<rect x="2" y="2.25" width="28" height="28" rx="7"/>`).
- A `<desc>` says what the mark depicts.
- The options considered for a mark sit beside it in `alternatives/` as `<mark>.<option>.svg`. Choosing an option swaps it with the current mark, which moves into `alternatives/`. A program's mark is the `icon.svg` in its folder under [`programs/`](../../programs/); [`program-mark-ideas.html`](../prototypes/program-mark-ideas.html) shows every option considered for those marks, more than the programs' `alternatives/` folders hold.

## In review

### Angled 3D hex nut

<img src="web-tools-icon-3d.png" width="96" height="96" alt="blue hex nut rendered at a slight three-dimensional angle on graphite gray">

File: [`web-tools-icon-3d.png`](web-tools-icon-3d.png), a 180 × 180 candidate for the Home Screen tile; the [iPhone size check](../../pages/scratch/web-tools-icon-preview.html) compares it with the active tile at phone sizes.

### Test-concept marks

Files: [`test-concepts/`](test-concepts/), candidate marks for testing concepts, for skills such as [sandbox-traps](../../skills/sandbox-traps/SKILL.md), [gold-set](../../skills/gold-set/SKILL.md) and [screenshot-review](../../skills/screenshot-review/SKILL.md). None is adopted yet; a skill that takes one up links its file here.

Each test-concept mark is one `currentColor` path drawn to the rules above, and its file name says what it shows.

### Per-page emoji marks

Pages can declare their own emoji favicon, an inline `data:image/svg+xml` URI holding one `<text>` glyph, such as 🌿 on the [branch page](../../pages/branch.html).

## Treatments

A treatment restyles a mark this project does not own, to say how it is being shown.

### Dimmed (a toss)

A toss, a page rendered from GitHub by [`pages/toss-render.html`](../../pages/toss-render.html), shows the favicon of the page it renders, dimmed to mark the tab as a render of that page; the 🥏 frisbee marks a render with no page of its own.

A page read at its default branch from a repo that serves no GitHub Pages has no deployed copy, and shows undimmed.

The reasons for dimming and its mechanics are in the comments above `DIM_SATURATE` and `adoptSubjectIcon` in [`pages/toss-render.html`](../../pages/toss-render.html).

## Retired

### Grid (former pages-index identity)

<img src="grid.svg" width="48" height="48" alt="2x2 card grid, one accented">

File: [`grid.svg`](grid.svg), kept as a design reference.
