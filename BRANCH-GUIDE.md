# Branch guide: claude/show-repo-pages-integration-uzn9gw

Rebuilds `pages/show-repo/show-repo.html` so it opens as the perfect web-tools pages gallery (the index), with the file navigator folded into an expandable left drawer and the file viewer taking over the main area on selection.

⭐ [pages/show-repo/show-repo.html](https://mehrlander.github.io/web-tools/pages/show-repo/show-repo.html?use=claude/show-repo-pages-integration-uzn9gw)

**Changed:**
- pages/show-repo/show-repo.html ([new](https://github.com/mehrlander/web-tools/blob/claude/show-repo-pages-integration-uzn9gw/pages/show-repo/show-repo.html), [main](https://github.com/mehrlander/web-tools/blob/main/pages/show-repo/show-repo.html))
- tools/build/pages-index.mjs — also emit pages/pages.json (single-source gallery data)
- pages/pages.json — generated gallery catalog, fetched at runtime

**Next steps / open threads:**
- Concept proposal, one-shot for review. Gallery is web-tools-fixed (home); the drawer's repo picker repoints only the file browser. A repo-following gallery is a possible extension, deliberately not taken.
- Dropped the mehrlander/home remote state persistence; state now rides the URL only.
