# Prompt 3 — Reactive Surface

The prompt that generated the pages in this folder: `aic-2.html`, `aic-kimi.html`,
`collection-browser.html`, `collection-browser-2`. Each was pasted into its own fresh session.
See `../CATALOG.md` for the cross-page analysis.

```text
Implement a small reactive DOM helper called `fill`, then build a page that showcases it.

The convention returns a live, re-rendering handle:
- `fill` is called as a tagged template, fill`...`, and returns a builder.
- Inside the literal, interpolated functions are accessors called with the data object, ${d => d.title}. They re-run on every render. Non-function values inline normally.
- The builder chains: `.data(obj)` sets backing state and returns the builder; `.on(type, selector, fn)` adds a delegated listener and returns the builder; `.el` is the live DOM node to mount.
- Backing state is a Proxy. Mutating it, including from inside an `.on` handler where `this` is the state, triggers an in-place re-render of `.el`.
- Give a sensible story for rendering a list from an array in state (your choice of approach; this is part of what I am testing).

Example:
  const counter = fill`
    <div class="card"><span>${d => d.n}</span><button class="inc">+1</button></div>
  `.data({ n: 0 }).on('click', '.inc', function(){ this.n++ })
  document.body.append(counter.el)

Extend the convention with whatever helpers or sugar make it sing. The goal is to show off what this reactive flavor of `fill` makes easy. Don't hold back.

The API (Art Institute of Chicago, public, no key needed):
- Search: https://api.artic.edu/api/v1/artworks/search?q=QUERY&fields=FIELDS&limit=24
- Response is { data: [ ...artworks ] }.
- Useful fields: id, title, artist_display, date_display, medium_display, image_id, thumbnail.
- Image via IIIF: https://www.artic.edu/iiif/2/IMAGE_ID/full/SIZE,/0/default.jpg  (SIZE is pixel width, ~400 for cards, 600+ for detail).
- Skip results where image_id is null.
- Link to a piece: https://www.artic.edu/artworks/ID
Figure out anything else yourself; that is part of the point.

The build:
A single-file HTML page: an Art Institute of Chicago collection browser. A search box queries the API (default it to a query with good hits, like "monet") and writes results into reactive state. Render results as a responsive grid of artwork cards: image, title, artist, a date badge. Clicking a card opens a master-detail side panel with a larger image, title, artist, medium, and a link to artic.edu. Once results are in, a "filter shown" text input narrows the visible cards as you type, with a live count of how many are showing, all driven through reactive state. Show a loading state during the fetch. Style with Tailwind and daisyUI; pick a theme via data-theme.

Stack (single file; no React, no Alpine, no other framework, the point is to test `fill` alone):
<script src="https://cdn.jsdelivr.net/combine/npm/@tailwindcss/browser@4,npm/@phosphor-icons/web"></script>
<link href="https://cdn.jsdelivr.net/combine/npm/daisyui@5/themes.css,npm/daisyui@5" rel="stylesheet" />

Rule: drive every dynamic part of the page through `fill` and its reactive state. No manual innerHTML for content, no document.createElement, anywhere.

Finish with three sentences: where the convention felt great, where it fought you, and one thing you'd change about it.
```
