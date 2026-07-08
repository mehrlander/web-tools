# Branch guide: claude/show-repo-pages-integration-uzn9gw

Rebuilds `pages/show-repo/show-repo.html` around a per-repo landing page: the repo picker + ref switch + auth shield are up front in the header, the drawer is just the file tree for the selected repo, and the main area shows that repo's landing (web-tools' = its pages index) or the file viewer. Standing Landing | Files toggle.

🥏 [pages/show-repo/show-repo.html](https://mehrlander.github.io/web-tools/pages/toss-render.html#gh=mehrlander/web-tools@claude/show-repo-pages-integration-uzn9gw:pages/show-repo/show-repo.html)

(Toss `#gh=`, not `?use=`: the change is in the page's own shell, which github.io serves from main, so `?use=` would show the pre-change page.)

**Changed:**
- pages/show-repo/show-repo.html ([new](https://github.com/mehrlander/web-tools/blob/claude/show-repo-pages-integration-uzn9gw/pages/show-repo/show-repo.html), [main](https://github.com/mehrlander/web-tools/blob/main/pages/show-repo/show-repo.html))
- tools/build/pages-index.mjs — also emit pages/pages.json (single-source gallery data)
- pages/pages.json — generated gallery catalog, fetched at runtime
- CLAUDE.md — clarify the `?use=` (lib/dist) vs 🥏 toss `#gh=` (page shell) preview boundary

**Next steps / open threads:**
- Landing mechanism is stubbed at one decision point (`app.landingKind`); only web-tools resolves ('gallery'). Design notes at the end of show-repo.html sketch the progression: per-repo `pages/landing.html`, an elegant default overview, then the task-0002 home-registry federation. Co-designing the home manifest (0002's "next") is now unblocked.
- Dropped the mehrlander/home remote state persistence; state rides the URL (`?repo&ref&file`).
- Open review points: default landing content (repo overview shape); drawer pinned on desktop vs close-on-select; whether the per-card inspect bridge earns its place.
