# Branch guide: claude/headless-tailwind-daisyui-alpine-ue50gn

A portable how-to for rendering/testing CDN-loaded pages (Tailwind, daisyUI,
Alpine, Phosphor) headless inside a sandbox that blocks the CDNs: vendor via npm,
intercept requests, serve from `node_modules`. Meant to be handed to a fresh
session in another repo.

⭐ [docs/headless-vendoring.md](https://github.com/mehrlander/web-tools/blob/claude/headless-tailwind-daisyui-alpine-ue50gn/docs/headless-vendoring.md)

**Changed:**
- docs/headless-vendoring.md ([new](https://github.com/mehrlander/web-tools/blob/claude/headless-tailwind-daisyui-alpine-ue50gn/docs/headless-vendoring.md))
- docs/examples/theme-explorer.html ([new](https://github.com/mehrlander/web-tools/blob/claude/headless-tailwind-daisyui-alpine-ue50gn/docs/examples/theme-explorer.html))
- docs/examples/landing-demo.html — deleted (theme-explorer is the one canonical example)

**Next steps / open threads:**
- Verified end-to-end: the doc's render.mjs (extracted verbatim) renders the
  minimal card and the theme-explorer; all served from node_modules, no CDN
  reached, no MISS/console errors.
- Minimal worked example is now LIGHT (user dislikes dark), a card centered on a
  soft light gradient, full-bleed.
- Only one example now: theme-explorer. landing-demo deleted.
- theme-explorer swapped to the user's nicer "paired pills" version: each cell a
  fill/content pill (Aa), grouped Surfaces/Brand/Status/Geometry headers, geometry
  shape previews, h-screen layout with the Tabulator grid filling a flex slot and
  themed via var(--color-base-*) so a recolor recolors the table. Combine converted
  to separate tags, Alpine unpkg@3. Capture viewport (not fullPage).
- Decision: author pages with one tag per library, NOT jsDelivr `/combine/`.
  render.mjs still handles `/combine/` for pre-existing pages; doc explains the
  split is of the URL path (not a downloaded body) since jsDelivr is never reached.
- render.mjs is now CDN-field-aware: for a subpath-less URL it reads the field the
  host uses (`unpkg` for unpkg, `jsdelivr` for jsDelivr) before falling back. Both
  CDNs resolve to the same node_modules file for explicit subpaths.
- Doc also covers chat image-presentation (file-send tool, not markdown) and
  designing for the frame (viewport vs fullPage, deviceScaleFactor, explicit page
  background, avoid bg-clip-text).
- Not yet done: wiring one-line pointers from the existing env docs
  (capabilities.md, testing.md) and the cdn.mjs header to this canonical doc, so
  they stop restating the concept. Discussed but deferred per the user.
- Decision taken: doc is written generic (no web-tools specifics baked in) so it
  travels to other repos.
