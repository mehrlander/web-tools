# Branch guide: claude/modest-newton-cm6is8

Brings pages/index and show-repo closer together: the stale show-repo local index goes away, the main index gains path-transparent filter chips, `?filter=` deep links, a show-repo companion link, and the FAB; show-repo gains a pages view of the selected repo.

⭐ [pages index on this branch](https://mehrlander.github.io/web-tools/pages/?use=claude/modest-newton-cm6is8)

**Changed:**
- (work not yet committed; see next steps)

**Next steps / open threads:**
- Delete pages/show-repo/index.html (+ thumb); catalogs regenerate via hook
- pages-index.mjs: path-transparent chips, ?filter=/?q= URL state, show-repo header link, FAB mount
- New lib/alpineComponents/pages.js: pages view inside show-repo.html
- Thumbnails refresh at wrap-up
