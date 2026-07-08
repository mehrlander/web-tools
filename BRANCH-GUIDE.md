# Branch guide: claude/show-repo-pages-integration-uzn9gw

Rebuilds `pages/show-repo/show-repo.html` so it opens as the perfect web-tools pages gallery (the index), with the file navigator folded into an expandable left drawer and the file viewer taking over the main area on selection. Header is the web-tools brand plus a standing Pages | Files toggle.

🥏 [pages/show-repo/show-repo.html](https://mehrlander.github.io/web-tools/pages/toss-render.html#gh=mehrlander/web-tools@claude/show-repo-pages-integration-uzn9gw:pages/show-repo/show-repo.html)

(Toss `#gh=`, not `?use=`: the change is in the page's own shell, which github.io serves from main, so `?use=` would show the pre-change page.)

**Changed:**
- pages/show-repo/show-repo.html ([new](https://github.com/mehrlander/web-tools/blob/claude/show-repo-pages-integration-uzn9gw/pages/show-repo/show-repo.html), [main](https://github.com/mehrlander/web-tools/blob/main/pages/show-repo/show-repo.html))
- tools/build/pages-index.mjs — also emit pages/pages.json (single-source gallery data)
- pages/pages.json — generated gallery catalog, fetched at runtime
- CLAUDE.md — clarify the `?use=` (lib/dist) vs 🥏 toss `#gh=` (page shell) preview boundary

**Next steps / open threads:**
- Concept proposal for review. Gallery is web-tools-fixed (home); the drawer's repo picker repoints only the file browser. A repo-following gallery is a possible extension, deliberately not taken.
- Dropped the mehrlander/home remote state persistence; state now rides the URL only.
- Open review points: drawer pinned on desktop vs close-on-select; whether the per-card inspect bridge earns its place.
