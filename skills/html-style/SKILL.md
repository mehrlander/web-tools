---
name: html-style
description: The binding house conventions for HTML page structure, appearance, interaction, and shared implementations. Read it BEFORE laying out any page and BEFORE any general design, dashboard, or charting skill, which recommend what these rules forbid, such as stat cards, explanatory prose on the page, embedded browsing, and shrunken type. Use when creating or reviewing an HTML page, artifact, single-file web app, dashboard, prototype, web UI component, or browser tool; when asked why a page looks wrong; and whenever the user mentions the style guide, house style, page layout, or stat cards. Building mechanics (DaisyUI 5, Tailwind CSS 4, Alpine.js, tooltips, CDN loading) are in references/mechanics.md.
---

# HTML house style

Use this skill to choose a page's structure and interactions, apply the house style, and find the shared implementations.

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

## Shared page patterns

Start with the reader's job and reuse a [standard presentation](https://github.com/mehrlander/web-tools/blob/main/docs/forms/README.md) where one fits. A **deck** is a swipeable sequence of cards. A **takeover** opens content in an expanded reader with a header, content area, navigation, and a return path to the page beneath it (rule 4).

| Page need | Pattern | Shared implementation |
| --- | --- | --- |
| Browse one item at a time | A card deck in a takeover | [Swipe Deck](https://github.com/mehrlander/web-tools/blob/main/lib/kits/swipe-deck.js): `open()` (rule 4) |
| Scan a list while reading details | A list and cards with synchronized selection | [Linked Swiper](https://github.com/mehrlander/web-tools/blob/main/lib/kits/linked-swiper.js), using Swipe Deck's `core()` for the embedded cards (rule 11) |
| Reveal detail in context | A brief title-tip or an interactive panel-tip | [title-tip](https://github.com/mehrlander/web-tools/blob/main/lib/kits/title-tip.js), [panel-tip](https://github.com/mehrlander/web-tools/blob/main/lib/kits/panel-tip.js) (rule 10) |
| Adjust adjoining panes | A divider the reader can move | [Dock Split](https://github.com/mehrlander/web-tools/blob/main/lib/kits/dock-split.js) |
| Read Markdown or its changes | Rendered Markdown with changes marked inline | [Guide Renderer](https://github.com/mehrlander/web-tools/blob/main/lib/kits/guide-render.js), [Markdown Diff](https://github.com/mehrlander/web-tools/blob/main/lib/kits/md-diff.js) (rule 13) |

Kits supply shared behavior; Alpine components render and hold reactive state, often using kits. [Code layers](https://github.com/mehrlander/web-tools/blob/main/docs/code-layers.md) defines the boundary: [cm6.js](https://github.com/mehrlander/web-tools/blob/main/lib/kits/cm6.js) supplies an editor and [cm-editor.js](https://github.com/mehrlander/web-tools/blob/main/lib/alpineComponents/cm-editor.js) wraps the editor in Alpine. Browse [Kits](https://mehrlander.github.io/web-tools/app/?view=map&tab=kits) and [Alpine components](https://github.com/mehrlander/web-tools/tree/main/lib/alpineComponents) for other implementations; read each file's header for its interface.

Simple pages can remain self-contained. Loading shared code is covered by the [loader contract](https://github.com/mehrlander/web-tools/blob/main/docs/loader.md). When the information structure needs development, use [page-design-loop](https://github.com/mehrlander/web-tools/blob/main/skills/page-design-loop/SKILL.md). The [content maturity prototype](https://github.com/mehrlander/web-tools/blob/main/docs/prototypes/content-maturity.html) is background on the progression from a summary to an app view.

## The rules

**1. No stat cards.** A row of tiles, each a label over a big number, spends the page's best space on figures with no comparison, baseline, denominator, or movement. Show a count with the content or controls that give it context. Filter pills can be especially effective to associate counts with the categories and units that they speak to.

**2. No explanatory prose.** GitHub doesn't explain and neither should we. Use
structure, labels, and controls to show relationships: a range control starting
at 2015 says the data starts in 2015.

**3. A reading column and balanced lines are not wanted.** Leave out
`text-balance` and `text-pretty`. `max-w-prose`, `max-w-2xl`, `max-w-3xl`,
`max-w-4xl`, `container mx-auto`, and a `prose` class without `!max-w-none`
(typography's unlayered CSS beats a plain `max-w-none`) all cap the text, with
or without `mx-auto`. So does an arbitrary value: any `ch` cap, such as
`max-w-[64ch]`, and an absolute cap from 42rem to 64rem, such as
`max-w-[920px]`. The page's own layout sets the width. Where a measure is
needed, take it from a grid track
(`lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)]`, `min-w-0` on the wide track),
which lets copy fill the page when the tracks stack. The `reading-column` hook
refuses these at edit time and `npm run reading-column` lists them; `modal-box`
sizing is exempt, and an exception takes a `reading-column-ok` comment on the
line or the line above.

**4. Browsing takes the available view.** A deck, gallery, diff, or result set uses the frame below. For expansion over another page, use the Swipe Deck takeover. A takeover fills the window on a phone and the host's content pane on a wide screen; a host may also dock it beside a list.

```text
├── header   identity, controls, counter
├── content  the thing; large, top-aligned, scrollable
└── footer   previous, progress, next
```

The shape is a default, and a page is **content-sensitive**: a slot the content
would leave empty, such as a footer for a single item, is left out rather than
filled with boilerplate. Use dots for
up to about 25 items, then a progress bar. Support arrow keys, Escape, and the
phone back button. Give each filter a row under the header: a label, then its
options as pills on one line that scrolls sideways rather than wrapping. Don't
embed a deck in a page; a strip under its own list (rule 11) is the exception,
since its takeover is one tap away.

**5. An embedded page has no fixed root.** A page another page may embed (an
appendix, a toss render, a stage preview) takes rule 4's shape without the fixed
root: `min-h-dvh` and sticky chrome over document scrolling, or an `h-dvh` root
for a list over a strip (rule 11). In an iframe on
iOS, a fixed child measures against the outer viewport and loses its right-hand
column, which headless Chromium does not show. Width queries measure the frame,
not the window. With sticky chrome, save and
restore document scroll when a detail view replaces a long list, and drop
`viewport-fit=cover` unless the page is edge-to-edge.

**6. Type is for reading, not for fitting.** If type shrank to fit, the layout is
wrong, not the type. Decks and documents run `text-xl` or larger with
`leading-8`; dense working surfaces run smaller, one size per tier (rule 7).

**7. Content has one size.** The page has two tiers, content and chrome.
Everything the reader came to read shares a size; `text-xs` and monospace belong
to labels, counters, and timestamps.

**8. Content starts at the top.** Do not vertically centre a slide because it
looks balanced when short; across a deck it moves the first line on every card.

**9. One accent, and it means something.** Colour carries information, not
decoration. Assign it by semantic role, and in a comparison lock each side's
treatment across every view. Where two concerns compete for the accent, let a
control pick which one is marked rather than spending a second colour.

**10. A tooltip worth having is worth building.** Prefer text on the page. Do
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

**11. Keep the list visible while browsing details.** Pair the list with a swipeable sequence of cards, one per item. On a phone, place the list above the cards and limit its height to about 40% of the available space. In a wide pane, place the list beside the cards. Each pane scrolls independently; the page stays still. Selecting a row shows its card. Swiping between cards selects the corresponding row and keeps that row visible. In the list, Up and Down move selection and keyboard focus together. A control in the card header opens the takeover (rule 4) at the card in view. Closing returns to the list at the item last viewed. Use Linked Swiper; the host supplies the action that opens the takeover.

**12. Avoid modal dialogs.** Consider a panel-tip, the Swipe Deck takeover (rule 4), or another more fluid alternative.

**13. Show the source.** A page presents the publisher's own document rather than a conversion made here, quoted text exactly as written with only highlighting added, and a change inline in the document it changes.

**14. Keep the reader's context.** A link to a row scrolls to it and leaves the other rows in view.

**15. Keep the layout stable.** Reserve space for scrollbars and content of varying lengths. For counters, use `tabular-nums` and reserve room for extra digits. Put repeated card controls in a consistent position: in the header or a footer anchored to the card's bottom edge.

**16. An item and its counterparts highlight together.** Where one item appears in two or more places on a page, hovering or tapping any of them marks the others.

**17. A value takes the form its content asks for.** Do not lay out a card's or panel's fields as label-value pairs. A URL or file path is a link, short labels and dates run as one line of items, a sentence runs as text without a label, and an item the card points to leads with an icon and its name in bold. Leave out a field whose value is a placeholder, a value nearly every card shares, or a restatement of another field. A table whose rows share columns is exempt.

**Icon flair** uses small icons beside an item to mark properties such as kind or origin. Explain unfamiliar marks with a title-tip or panel-tip.

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
