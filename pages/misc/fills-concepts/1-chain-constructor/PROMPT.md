# Prompt 1 — Chain Constructor

The prompt that generated the pages in this folder: `aic.html`, `aic-browser.html`,
`aic-kimi-1.html`. Each was pasted into its own fresh session. See `../CATALOG.md` for the
cross-page analysis.

```text
Implement a tiny DOM-creation helper called `fill`, then build a page that showcases it.

The convention:
- `fill` is a Proxy-based callable.
- Property access builds an element factory. The FIRST property segment is the tag name; any FURTHER segments are CSS classes. So `fill.div` makes a div, `fill.div.card.lg` makes a div with classes "card lg".
- Calling a factory returns a real DOM Node. Arguments are read by type:
  - a plain object in first position is attrs/props (keys starting with "on" become listeners; "class" merges with the chain classes; the rest set as attribute or property),
  - strings and numbers become text,
  - Nodes are appended,
  - arrays are flattened and appended (so `.map` works).
- `fill` as a tagged template, fill`<section>...</section>`, parses an HTML string into a Node. Any Node interpolated into the literal must survive (parse with comment-marker placeholders, then swap real Nodes back). Detect the tagged call by checking for `raw` on the first argument.
- Reserve `fill.frag(...children)` and `fill.text(str)`.

Examples:
  const card = fill.div.card(fill.h3.title(t), fill.button.btn.primary({onClick: f}, 'Open'))
  const grid = fill.div.grid(items.map(i => makeCard(i)))
  const hero = fill`<header class="hero"><h1>Gallery</h1>${card}</header>`

Extend the convention with whatever helpers or sugar make it sing. The goal is to show off what this chain flavor of `fill` makes easy. Don't hold back.

The API (Art Institute of Chicago, public, no key needed):
- Search: https://api.artic.edu/api/v1/artworks/search?q=QUERY&fields=FIELDS&limit=24
- Response is { data: [ ...artworks ] }.
- Useful fields: id, title, artist_display, date_display, medium_display, image_id, thumbnail.
- Image via IIIF: https://www.artic.edu/iiif/2/IMAGE_ID/full/SIZE,/0/default.jpg  (SIZE is pixel width, ~400 for cards, 600+ for detail).
- Skip results where image_id is null.
- Link to a piece: https://www.artic.edu/artworks/ID
Figure out anything else yourself; that is part of the point.

The build:
A single-file HTML page: an Art Institute of Chicago collection browser. A search box queries the API (default it to a query with good hits, like "monet"). Render results as a responsive grid of artwork cards: image, title, artist, a date badge. Clicking a card opens a master-detail side panel with a larger image, title, artist, medium, and a link to artic.edu. Once results are in, a second "filter shown" text input narrows the visible cards as you type, with a live count of how many are showing. Show a loading state during the fetch. Style with Tailwind and daisyUI; pick a theme via data-theme.

Stack (single file; no React, no Alpine, no other framework, the point is to test `fill` alone):
<script src="https://cdn.jsdelivr.net/combine/npm/@tailwindcss/browser@4,npm/@phosphor-icons/web"></script>
<link href="https://cdn.jsdelivr.net/combine/npm/daisyui@5/themes.css,npm/daisyui@5" rel="stylesheet" />

Rule: use `fill` for every DOM node you create. No innerHTML for content, no document.createElement, anywhere. Lean into the chain even where it feels awkward.

Finish with three sentences: where the convention felt great, where it fought you, and one thing you'd change about it.
```
