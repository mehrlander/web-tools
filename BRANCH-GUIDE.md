# Branch guide: claude/creative-exploration-mqersv

Overnight creative build: **Repo Atlas** (`pages/repo-atlas.html`), an interactive zoomable treemap map of any GitHub repo's file tree: files as tiles sized by bytes, colored by type, drill-down navigation, search, and an insights panel. Complements `show-repo`'s tree+viewer with a spatial view.

⭐ [repo-atlas.html](https://github.com/mehrlander/web-tools/blob/claude/creative-exploration-mqersv/pages/repo-atlas.html) (blob; live `?use=` preview link lands once the page exists)

**Changed:**
- (nothing yet; guide pushed first per conventions)

**Next steps / open threads:**
- Scaffold the page: boot block, git/trees fetch, hierarchy build
- Squarified treemap layout + canvas renderer
- Interactions: hover tooltip, click-to-zoom, breadcrumbs, search
- Insights sidebar: totals, extension breakdown, largest files
- Iterate on visuals via `npm run shot`; thumbnails at wrap-up
