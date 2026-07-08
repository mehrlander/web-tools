# Branch guide: claude/show-repo-pages-integration-uzn9gw

Rebuilds `pages/show-repo/show-repo.html` around a per-repo landing page with a pinned sidebar. The sidebar lists the repo's views (its landing, its atlas, then its files) so there is no separate toggle; the repo picker + auth live in the header. Every repo gets a landing: web-tools' is its pages gallery, others get a synthesized overview (stats + README). The atlas is always available as a standing view and is now light-themed.

🥏 [pages/show-repo/show-repo.html](https://mehrlander.github.io/web-tools/pages/toss-render.html#gh=mehrlander/web-tools@claude/show-repo-pages-integration-uzn9gw:pages/show-repo/show-repo.html)

(Toss `#gh=`, not `?use=`: the change is in the page's own shell, which github.io serves from main, so `?use=` would show the pre-change page.)

**Changed:**
- pages/show-repo/show-repo.html ([new](https://github.com/mehrlander/web-tools/blob/claude/show-repo-pages-integration-uzn9gw/pages/show-repo/show-repo.html), [main](https://github.com/mehrlander/web-tools/blob/main/pages/show-repo/show-repo.html))
- pages/repo-atlas.html ([new](https://github.com/mehrlander/web-tools/blob/claude/show-repo-pages-integration-uzn9gw/pages/repo-atlas.html), [main](https://github.com/mehrlander/web-tools/blob/main/pages/repo-atlas.html)) -- light-themed
- tools/build/pages-index.mjs ([new](https://github.com/mehrlander/web-tools/blob/claude/show-repo-pages-integration-uzn9gw/tools/build/pages-index.mjs), [main](https://github.com/mehrlander/web-tools/blob/main/tools/build/pages-index.mjs)) -- also emit pages/pages.json
- pages/pages.json -- generated gallery catalog, fetched at runtime
- CLAUDE.md -- clarify the `?use=` (lib/dist) vs 🥏 toss `#gh=` (page shell) preview boundary

**Next steps / open threads:**
- Landing mechanism is stubbed at one decision point (`app.landingKind`); only web-tools resolves ('gallery'). Design notes at the end of show-repo.html sketch the progression: per-repo `pages/landing.html`, an elegant default overview, then the task-0002 home-registry federation. Co-designing the home manifest (0002's "next") is now unblocked.
- State rides the URL (`?repo&ref&file&view`); no remote persistence.
- Open review points: whether the atlas iframe should hot-reload on ref change; whether the per-card inspect bridge earns its place; overview content beyond stats + README (recent commits, contributor list, etc.).
