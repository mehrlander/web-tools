# Branch guide: claude/pages-index-link-99qruu

Retire the pages-index's four-quadrant grid favicon for the canonical hex-nut mark, start a favicon archive under `docs/favicons/`, refine the surfacing-caption convention (uniform file list with a 🥏 render line after it), and publish the opt-in project-tracker convention (`docs/TRACKER.md`). Three topics on one branch: the tracker can be split to its own branch/PR on request.

🥏 [mehrlander/web-tools@claude/pages-index-link-99qruu:pages/index.html](https://mehrlander.github.io/web-tools/pages/toss-render.html#gh=mehrlander/web-tools@claude/pages-index-link-99qruu:pages/index.html)

(Not `?use=`-previewable: the favicon lives in `pages/index.html` itself, and Pages serves that from main. `?use=` only swaps the runtime `lib/` ref, not the page HTML. The toss `#gh=` link fetches the branch's actual index.html; goes live on the [canonical index](https://mehrlander.github.io/web-tools/pages/) at merge.)

**Changed:**
- tools/build/pages-index.mjs ([new](https://github.com/mehrlander/web-tools/blob/claude/pages-index-link-99qruu/tools/build/pages-index.mjs), [main](https://github.com/mehrlander/web-tools/blob/main/tools/build/pages-index.mjs)) — both favicon refs now point at `../lib/favicon.svg`
- pages/index.html ([new](https://github.com/mehrlander/web-tools/blob/claude/pages-index-link-99qruu/pages/index.html), [main](https://github.com/mehrlander/web-tools/blob/main/pages/index.html)) — regenerated; picks up the hex nut
- docs/favicons/grid.svg ([new](https://github.com/mehrlander/web-tools/blob/claude/pages-index-link-99qruu/docs/favicons/grid.svg)) — the retired grid, moved to the archive
- docs/favicons/README.md ([new](https://github.com/mehrlander/web-tools/blob/claude/pages-index-link-99qruu/docs/favicons/README.md)) — favicon gallery (active hex nut, retired grid)
- docs/CONVENTIONS.md ([new](https://github.com/mehrlander/web-tools/blob/claude/pages-index-link-99qruu/docs/CONVENTIONS.md), [main](https://github.com/mehrlander/web-tools/blob/main/docs/CONVENTIONS.md)) — "Surfacing caption" primitive (uniform list + trailing 🥏 render line); tracker/merge-guide + post-merge-HP cross-refs
- docs/TRACKER.md ([new](https://github.com/mehrlander/web-tools/blob/claude/pages-index-link-99qruu/docs/TRACKER.md)) — opt-in project-tracker convention: one file per task + generated board, with a python3 reference generator
- docs/PORTABLE.md ([new](https://github.com/mehrlander/web-tools/blob/claude/pages-index-link-99qruu/docs/PORTABLE.md), [main](https://github.com/mehrlander/web-tools/blob/main/docs/PORTABLE.md)) — manifest row for TRACKER.md

(No trailing 🥏 render line here: the lead line above already renders index.html, so repeating it would duplicate the file's link.)

**Next steps / open threads:**
- Thumbnails unaffected (favicon isn't in the card grid); no pages-shots refresh needed.
- Optional follow-on: the `?use=` vs `#gh=` note for CLAUDE.md, and propagating the 🥏 render line into the PR / merge-guide templates.
- Wrap-up: fold into docs/MERGE-GUIDE.md, delete this guide, open PR if wanted.
