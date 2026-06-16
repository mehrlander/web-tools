# Branch guide: claude/headless-tailwind-daisyui-alpine-ue50gn

A portable how-to for rendering/testing CDN-loaded pages (Tailwind, daisyUI,
Alpine, Phosphor) headless inside a sandbox that blocks the CDNs: vendor via npm,
intercept requests, serve from `node_modules`. Meant to be handed to a fresh
session in another repo.

⭐ [docs/headless-vendoring.md](https://github.com/mehrlander/web-tools/blob/claude/headless-tailwind-daisyui-alpine-ue50gn/docs/headless-vendoring.md)

**Changed:**
- docs/headless-vendoring.md ([new](https://github.com/mehrlander/web-tools/blob/claude/headless-tailwind-daisyui-alpine-ue50gn/docs/headless-vendoring.md))
- docs/examples/landing-demo.html ([new](https://github.com/mehrlander/web-tools/blob/claude/headless-tailwind-daisyui-alpine-ue50gn/docs/examples/landing-demo.html))
- docs/examples/theme-explorer.html ([new](https://github.com/mehrlander/web-tools/blob/claude/headless-tailwind-daisyui-alpine-ue50gn/docs/examples/theme-explorer.html))

**Next steps / open threads:**
- Verified end-to-end: the doc's render.mjs (extracted verbatim) renders the
  minimal card, the landing hero, and the theme-explorer; all served from
  node_modules, no CDN reached, no MISS/console errors.
- Decision: author pages with one tag per library, NOT jsDelivr `/combine/`
  (clearer, maps 1:1 under any interception strategy, no benefit when local).
  Both examples converted to separate tags; Alpine loads from unpkg everywhere.
  render.mjs still handles `/combine/` so pre-existing pages render unchanged, but
  it's framed as legacy in the doc.
- Minimal worked example rewritten to a full-bleed centered glass card (was a
  small card on white that read as a broken modal).
- theme-explorer exercises a runtime `fetch` of vendored themes.css (parsed into
  the Tabulator matrix), Phosphor as one script tag (its main injects per-weight
  CSS links), and live daisyUI `data-theme` switching; carries a "Vendor & inject"
  footer.
- Doc also covers chat image-presentation (file-send tool, not markdown) and
  designing for the frame (viewport vs fullPage, deviceScaleFactor, solid dark bg,
  avoid bg-clip-text). landing-demo.html is the presentation-quality example.
- Not yet done: wiring one-line pointers from the existing env docs
  (capabilities.md, testing.md) and the cdn.mjs header to this canonical doc, so
  they stop restating the concept. Discussed but deferred per the user.
- Decision taken: doc is written generic (no web-tools specifics baked in) so it
  travels to other repos.
