---
name: html-style
description: The binding house style for HTML pages built here, covering what a page looks like rather than how it is built. Read it BEFORE laying out any page and BEFORE any general design, dashboard, or charting skill, which recommend what these rules forbid, such as stat cards, explanatory prose on the page, embedded browsing, and shrunken type. Use when creating or reviewing an HTML page, artifact, single-file web app, dashboard, prototype, web UI component, or browser tool; when asked why a page looks wrong; and whenever the user mentions the style guide, house style, page layout, or stat cards. Building mechanics (DaisyUI 5, Tailwind CSS 4, Alpine.js, tooltips, CDN loading) are in references/mechanics.md.
---

# HTML house style

## "Project what matters"

A good page projects just the right properties onto the viewport to build
insight. Getting there is usually iterative: present the pieces, pare the
representation down, layer it, and manage each disclosure tightly, until it
builds a dense web of connected information.

## "A page is for comparing"

Most often, insight comes from a comparison. Ask Tufte's question, "Compared to
what?", then give the compared things one place:

- **Side by side, when they fit:** columns, small multiples, a table whose rows
  share columns.
- **In one frame, when they do not:** tabs or the
  [swipe deck](https://github.com/mehrlander/web-tools/blob/main/lib/kits/swipe-deck.js),
  with each field at the same spot on every card and tab.
- **Not down a long scroll:** split stacked sections and long forms along the
  dimension the reader compares. A long table is exempt; its rows share columns.

## The rules

**1. No stat cards.** A row of tiles, each a label over a big number, spends the
page's best space on figures with no comparison, baseline, denominator, or
movement. Put a headline figure in the header as one compact line, such as
`62/100 category · 35/100 systems`, and supporting analysis one tap away in an
info dialog. Where figures deserve room, give them a form that holds a
comparison. Treat any `stats`, `stat-value`, or KPI-tile grid as a defect.

**2. No explanatory prose.** GitHub doesn't explain and neither should we. Use
structure, labels, and controls to show relationships: a range control starting
at 2015 says the data starts in 2015.

**3. Don't narrow text to a reading column.** `max-w-prose`, `max-w-2xl`,
`max-w-3xl`, `max-w-4xl`, `container mx-auto`, and a `prose` class without
`!max-w-none` (typography's unlayered CSS beats a plain `max-w-none`) all cap
the text, with or without `mx-auto`. So does an arbitrary value: any `ch` cap,
such as `max-w-[64ch]`, and an absolute cap from 42rem to 64rem, such as
`max-w-[920px]`. The page's own layout sets the width. Where a measure is
needed, take it from a grid track
(`lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)]`, `min-w-0` on the wide track),
which lets copy fill the page when the tracks stack. The `reading-column` hook
refuses these at edit time and `npm run reading-column` lists them; `modal-box`
sizing is exempt, and an exception takes a `reading-column-ok` comment on the
line or the line above.

**4. Browsing takes the viewport.** A deck, gallery, diff, or result set uses
`fixed inset-0 grid grid-rows-[auto_1fr_auto]`:

```text
├── header   identity, compact figure, controls, counter
├── content  the thing; large, top-aligned, scrollable
└── footer   previous, progress, next
```

The shape is a default, and a page is **content-sensitive**: a slot the content
would leave empty, such as a header figure the data does not have or a footer
for a single item, is left out rather than filled with boilerplate. Use dots for
up to about 25 items, then a progress bar. Support arrow keys, Escape, and the
phone back button. Put filters in a header dropdown, not a chip row. Don't
embed a deck in a page; a strip under its own list (rule 12) is the exception,
since its takeover is one tap away.

**5. A tenant page uses normal flow.** A page another page may embed (an
appendix, a toss render, a stage preview) takes rule 4's shape without the fixed
root: `min-h-dvh` and sticky chrome over document scrolling. In an iframe on
iOS, a fixed child measures against the outer viewport and loses its right-hand
column, which headless Chromium does not show. With sticky chrome, save and
restore document scroll when a detail view replaces a long list, and drop
`viewport-fit=cover` unless the page is edge-to-edge.

**6. Type is for reading, not for fitting.** If type shrank to fit, the layout is
wrong, not the type. Decks and documents run `text-xl` or larger with
`leading-8`; dense working surfaces run smaller, one size per tier (rule 7).

**7. Content has one size.** The page has two tiers, content and chrome.
Everything the reader came to read shares a size; `text-xs` and monospace belong
to labels, counters, and timestamps.

**8. A short text block balances its lines.** Put `text-balance` on a heading,
lede, caption, or any block read at a glance, and `text-pretty` on running copy,
which fixes a stranded last word without evening out full lines.

**9. Content starts at the top.** Do not vertically centre a slide because it
looks balanced when short; across a deck it moves the first line on every card.

**10. One accent, and it means something.** Colour carries information, not
decoration. Assign it by semantic role, and in a comparison lock each side's
treatment across every view. Where two concerns compete for the accent, let a
control pick which one is marked rather than spending a second colour.

**11. A tooltip worth having is worth building.** Prefer text on the page. Do
not use a `title`: the browser draws it only on mouse hover and outside the
page, so touch screens and screenshots omit it. One line the page implies is a
**title-tip**
([`kits/title-tip.js`](https://github.com/mehrlander/web-tools/blob/main/lib/kits/title-tip.js));
anything tapped, scrolled, or sourced is a **panel-tip**
([`kits/panel-tip.js`](https://github.com/mehrlander/web-tools/blob/main/lib/kits/panel-tip.js)).
Do not use daisyUI's `tooltip`, `data-tip`, or `cursor-help`. Details are in
[`references/mechanics.md`, "Title-tips and panel-tips"](references/mechanics.md#title-tips-and-panel-tips);
`npm run stranded-titles` lists facts parked in a `title`, and
`TitleTip.open('#id')` opens one for a shot.

**12. A list with a detail is a list over a strip.** The list sits above,
capped near 40% of the height, over a strip of one card per item, swiped
sideways. Each scrolls inside itself; the page does not. A pick in the list
moves the strip, and a swipe moves the list's selection and keeps it in view.
The strip's header opens the deck takeover (rule 4) at the card in view, and
closing it returns to the list at the card where it closed. In a wide pane the
list sits beside the strip; on a phone it stays in view above the strip. The
reference is the linked-swiper kit
([`linked-swiper.js`](https://github.com/mehrlander/web-tools/blob/main/lib/kits/linked-swiper.js)),
coded `linked-swiper`.

## Handing a page over

In a web-tools checkout, run `npm run showing`. Elsewhere, pick by what the
reader can open
([`docs/showing-mechanisms.csv`](https://github.com/mehrlander/web-tools/blob/main/docs/showing-mechanisms.csv)
lists what each mechanism reaches):

- **Uncommitted:**
  `https://mehrlander.github.io/web-tools/pages/toss-render.html#gz=<payload>`,
  the payload computed in code:
  `base64.urlsafe_b64encode(gzip.compress(html.encode())).decode().rstrip("=")`.
- **Committed:** the same renderer with `#gh=<owner>/<repo>@<ref>:<path>`; the
  reader needs a GitHub token saved there.
- **Visual change, or no link reaches the reader:** a headless screenshot.

## What this does not cover

- **Themes:** a palette and font repair none of the failures above.
- **Checking a rendered page:** the `screenshot-review` skill, whose Style
  reader judges a shot against this file.
- **Mechanics:** [`references/mechanics.md`](references/mechanics.md) for the
  stack, the CDN pattern, and the class-level traps that compile to nothing;
  `references/daisyui.md` and `references/alpine-v3.md` for syntax.
