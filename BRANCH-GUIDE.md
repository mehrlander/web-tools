# Branch guide: claude/headless-tailwind-daisyui-alpine-ue50gn

A portable how-to for rendering/testing CDN-loaded pages (Tailwind, daisyUI,
Alpine, Phosphor) headless inside a sandbox that blocks the CDNs: vendor via npm,
intercept requests, serve from `node_modules`. Meant to be handed to a fresh
session in another repo.

⭐ [docs/headless-vendoring.md](https://github.com/mehrlander/web-tools/blob/claude/headless-tailwind-daisyui-alpine-ue50gn/docs/headless-vendoring.md)

**Changed:**
- docs/headless-vendoring.md ([new](https://github.com/mehrlander/web-tools/blob/claude/headless-tailwind-daisyui-alpine-ue50gn/docs/headless-vendoring.md))

**Next steps / open threads:**
- Doc is self-contained and verified: the embedded render.mjs + page.html were
  run as-is and produced a correct screenshot (daisyUI/Tailwind/Phosphor/Alpine
  all live).
- Not yet done: wiring one-line pointers from the existing env docs
  (capabilities.md, testing.md) and the cdn.mjs header to this canonical doc, so
  they stop restating the concept. Discussed but deferred per the user.
- Decision taken: doc is written generic (no web-tools specifics baked in) so it
  travels to other repos.
