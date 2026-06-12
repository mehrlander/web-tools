# Branch guide: claude/modest-newton-cm6is8

Brings pages/index and show-repo together as the repo's two navigation surfaces: the index gains path-transparent chips, `?filter=`/`?q=` deep links, a show-repo companion link and the FAB; show-repo gains a pages view of the browsed repo; the stale show-repo local index is gone.

⭐ [pages index on this branch](https://mehrlander.github.io/web-tools/pages/?use=21e54bc66e3a0e3735507eb8db2b186984364382)

**Changed:**
- tools/build/pages-index.mjs ([new](https://github.com/mehrlander/web-tools/blob/claude/modest-newton-cm6is8/tools/build/pages-index.mjs), [main](https://github.com/mehrlander/web-tools/blob/main/tools/build/pages-index.mjs), [diff](https://github.com/mehrlander/web-tools/commit/208367d))
- pages/index.html + pages/README.md (regenerated)
- pages/show-repo/index.html (deleted; the index's show-repo chip replaces it)
- lib/alpineComponents/pages.js ([new](https://github.com/mehrlander/web-tools/blob/claude/modest-newton-cm6is8/lib/alpineComponents/pages.js), [diff](https://github.com/mehrlander/web-tools/commit/21e54bc))
  renders on: [show-repo](https://mehrlander.github.io/web-tools/pages/show-repo/show-repo.html?use=21e54bc66e3a0e3735507eb8db2b186984364382)
- pages/show-repo/show-repo.html ([new](https://github.com/mehrlander/web-tools/blob/claude/modest-newton-cm6is8/pages/show-repo/show-repo.html), [main](https://github.com/mehrlander/web-tools/blob/main/pages/show-repo/show-repo.html), [diff](https://github.com/mehrlander/web-tools/commit/21e54bc))
- tools/test/pages.test.mjs ([new](https://github.com/mehrlander/web-tools/blob/claude/modest-newton-cm6is8/tools/test/pages.test.mjs))

**Next steps / open threads:**
- Verify the pages view against the live API (this container is rate-limited; jsdom tests cover the logic)
- The "consolidated dashboard" idea has room to grow: the pages view is the first piece pulled into show-repo
- Thumbnails refresh at wrap-up (index.html, show-repo.html changed)
