# Prompt 2 — Tagged Factory

The prompt that generated the pages in this folder: `aic-browse.html`, `aic-browser-2`,
`aic-1.html`. Each was pasted into its own fresh session. See `../CATALOG.md` for the
cross-page analysis.

```text
Implement a tiny DOM helper called `fill`, then build a page that showcases it.

The convention is template-per-tag:
- `fill` is a Proxy-based callable.
- `fill` as a tagged template, fill`<div>...</div>`, parses an HTML string into a Node. Interpolation: strings and numbers inline as text; Nodes splice in (parse with comment-marker placeholders, then swap real Nodes back); arrays flatten and may mix strings and Nodes; functions are called with no args and their result interpolated.
- Property access yields a tagged-template factory whose ROOT element is that tag. So fill.div`<span>${x}</span>` returns a <div> wrapping the parsed literal. The property names the wrapper, the literal fills it.
- Attributes are written in the markup. If you want, allow a leading interpolated object on the root to set root attrs, but the simple path is markup-only.

Examples:
  const badge = fill.span`<i class="ph ph-star"></i> ${label}`
  const card = fill.article`
    <figure><img src="${url}"></figure>
    <header><h3>${title}</h3>${badge}</header>
  `
  const grid = fill.div`${items.map(i => makeCard(i))}`

Extend the convention with whatever helpers or sugar make it sing. The goal is to show off what this template-per-tag flavor of `fill` makes easy. Don't hold back.

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

Rule: use `fill` for every DOM node you create. Build nested structures by interpolating `fill` results into parent literals. No document.createElement, no manual innerHTML outside the helper's own parsing.

Finish with three sentences: where the convention felt great, where it fought you, and one thing you'd change about it.
```
