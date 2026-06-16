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
- render.mjs now handles jsDelivr `/combine/` (concat local files) and a runtime
  `fetch` of a vendored file; theme-explorer exercises both, plus Phosphor via the
  combine script (its main injects per-weight CSS links), Tabulator, and live
  daisyUI `data-theme` switching. It carries an on-page "Vendor & inject" note.
- Doc now also covers chat image-presentation (file-send tool, not markdown) and
  designing for the frame (viewport vs fullPage, deviceScaleFactor, solid dark bg,
  avoid bg-clip-text). landing-demo.html is the presentation-quality example.
- Not yet done: wiring one-line pointers from the existing env docs
  (capabilities.md, testing.md) and the cdn.mjs header to this canonical doc, so
  they stop restating the concept. Discussed but deferred per the user.
- Decision taken: doc is written generic (no web-tools specifics baked in) so it
  travels to other repos.
