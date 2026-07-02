# Branch guide: claude/creative-exploration-mqersv

Overnight creative build: **Repo Atlas** (`pages/repo-atlas.html`), an interactive zoomable treemap of any GitHub repo's file tree (and of dropped local folders and zips): files as cushion-shaded tiles sized by bytes or count, colored by type, with animated zoom, search, type isolation, and an insights sidebar. Complements `show-repo`'s tree+viewer with a spatial view.

⭐ [repo-atlas.html source](https://github.com/mehrlander/web-tools/blob/claude/creative-exploration-mqersv/pages/repo-atlas.html): a new page, so no live Pages URL until merge. Render locally with `npm run shot -- pages/repo-atlas.html`. Note the branch name has a slash, which jsDelivr's `?use=` can't resolve; preview with a commit SHA instead.

**Changed:**
- pages/repo-atlas.html ([new](https://github.com/mehrlander/web-tools/blob/claude/creative-exploration-mqersv/pages/repo-atlas.html), [diff](https://github.com/mehrlander/web-tools/commit/d3482ef)): the atlas page
- lib/kits/treemap.js ([new](https://github.com/mehrlander/web-tools/blob/claude/creative-exploration-mqersv/lib/kits/treemap.js), [diff](https://github.com/mehrlander/web-tools/commit/ac6e0f8)): the pure kernels (taxonomy, tree build, squarify, fmtBytes) per the kit contract
- tools/test/treemap.test.mjs ([new](https://github.com/mehrlander/web-tools/blob/claude/creative-exploration-mqersv/tools/test/treemap.test.mjs), [diff](https://github.com/mehrlander/web-tools/commit/ac6e0f8)): tiling invariants, rollups, taxonomy; caught a real negative-extent bug
- tools/render/cdn.mjs ([new](https://github.com/mehrlander/web-tools/blob/claude/creative-exploration-mqersv/tools/render/cdn.mjs), [main](https://github.com/mehrlander/web-tools/blob/main/tools/render/cdn.mjs), [diff](https://github.com/mehrlander/web-tools/commit/d3482ef)): impersonated git/trees now carries real blob sizes (lstat, crash-safe, cached per process)
- tools/build/pages-index.mjs ([new](https://github.com/mehrlander/web-tools/blob/claude/creative-exploration-mqersv/tools/build/pages-index.mjs), [main](https://github.com/mehrlander/web-tools/blob/main/tools/build/pages-index.mjs), [diff](https://github.com/mehrlander/web-tools/commit/d3482ef)): blurb for the new page
- lib/kits/README.md ([new](https://github.com/mehrlander/web-tools/blob/claude/creative-exploration-mqersv/lib/kits/README.md), [main](https://github.com/mehrlander/web-tools/blob/main/lib/kits/README.md), [diff](https://github.com/mehrlander/web-tools/commit/0b78d86)): treemap kit docs
- docs/environment/testing.md ([new](https://github.com/mehrlander/web-tools/blob/claude/creative-exploration-mqersv/docs/environment/testing.md), [main](https://github.com/mehrlander/web-tools/blob/main/docs/environment/testing.md), [diff](https://github.com/mehrlander/web-tools/commit/000765f)): harness fidelity notes (tree sizes, exact-path metadata, working-tree gap)
- pages/thumbs/repo-atlas.png ([new](https://github.com/mehrlander/web-tools/blob/claude/creative-exploration-mqersv/pages/thumbs/repo-atlas.png), [diff](https://github.com/mehrlander/web-tools/commit/000765f)): thumbnail

**Next steps / open threads:**
- Code-review findings applied (XSS-safe links, symlink-safe harness walk, O(1) squarify rows, paint-level selection); verify the fixes render clean, run the suite, and push
- Parked ideas: per-directory lazy fetch for API-truncated trees; an IDB atlas as a second kit consumer; exposing `io.jszip()` so the zip pin lives in one place; a source capability object if a third source type ever lands
