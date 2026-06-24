# Branch guide: claude/dreamy-pascal-luo2b0

Polishing the `pages/` landing page and codifying a "lead with the live view" README convention: clearer header link, a helpful pre-rendered-screenshot note, and a bespoke favicon/logo.

⭐ [pages/index.html (this branch)](https://github.com/mehrlander/web-tools/blob/claude/dreamy-pascal-luo2b0/pages/index.html) — the markup changes (logo, caption, link) only render on the canonical Pages URL once merged, since `?use=` swaps loaded lib code, not a page's own HTML.

**Changed:**
- tools/build/pages-index.mjs — generator: favicon `<link>`, inline logo, `show-repo` label, build-script caption, README lead link.
- pages/favicon.svg — new bespoke mark (rounded tile, 2x2 card grid, amber accent).
- pages/index.html + pages/README.md — regenerated catalogs.
- README.md — leads with ⭐ link to the live tools index.
- docs/CONVENTIONS.md — new "Lead with the live view" surfacing primitive.

**Next steps / open threads:**
- Open question for the user: grow `pages/index.html` into a broader repo landing page (bookmarklets, popups, console, library), keeping it as the seed.
- Favicon is a grid-of-tiles mark; a wrench-in-tile variant is on offer if a more literal "tools" read is wanted.
- This replaced a stale leaked branch guide from the merged toss-render work (PR #181).
- At wrap-up: fold this guide into docs/MERGE-GUIDE.md and delete it.
