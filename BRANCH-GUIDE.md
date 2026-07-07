# Branch guide: claude/pages-index-link-99qruu

Retire the pages-index's four-quadrant grid favicon and adopt the canonical hex-nut project mark, and start a favicon archive under `docs/favicons/` so retired designs stay visible.

🥏 [branch index via toss (hex-nut mark in the header)](https://mehrlander.github.io/web-tools/pages/toss-render.html#gh=mehrlander/web-tools@claude/pages-index-link-99qruu:pages/index.html)

(Not `?use=`-previewable: the favicon lives in `pages/index.html` itself, and Pages serves that from main. `?use=` only swaps the runtime `lib/` ref, not the page HTML. The toss `#gh=` link fetches the branch's actual index.html; goes live on the [canonical index](https://mehrlander.github.io/web-tools/pages/) at merge.)

**Changed:**
- tools/build/pages-index.mjs ([new](https://github.com/mehrlander/web-tools/blob/claude/pages-index-link-99qruu/tools/build/pages-index.mjs)) — both favicon refs (`<link rel=icon>` + header logo) now point at `../lib/favicon.svg`
- pages/index.html — regenerated; picks up the hex nut
- pages/favicon.svg → docs/favicons/grid.svg — the grid, moved to the archive
- docs/favicons/README.md ([new](https://github.com/mehrlander/web-tools/blob/claude/pages-index-link-99qruu/docs/favicons/README.md)) — favicon gallery (active hex nut, retired grid)

**Next steps / open threads:**
- Thumbnails unaffected (favicon isn't in the card grid); no pages-shots refresh needed.
- Wrap-up: fold into docs/MERGE-GUIDE.md, delete this guide, open PR if wanted.
