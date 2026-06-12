# Branch guide: claude/modest-newton-cm6is8

Brings pages/index and show-repo together as the repo's two navigation surfaces (path-transparent chips, `?filter=`/`?q=` deep links, FAB on the index, pages view in show-repo), and renames embed.html to toss-render.html with a new allowlisted `#gh=owner/repo[@ref]:path` address mode that renders repo HTML the deployed site isn't serving.

⭐ [pages index on this branch](https://github.com/mehrlander/web-tools/blob/claude/modest-newton-cm6is8/pages/index.html) (HTML changes; live only after merge — `?use=` can't swap served HTML)

**Changed:**
- tools/build/pages-index.mjs ([new](https://github.com/mehrlander/web-tools/blob/claude/modest-newton-cm6is8/tools/build/pages-index.mjs), [main](https://github.com/mehrlander/web-tools/blob/main/tools/build/pages-index.mjs))
- pages/index.html + pages/README.md (regenerated)
- pages/show-repo/index.html (deleted; the index's show-repo chip replaces it)
- lib/alpineComponents/pages.js ([new](https://github.com/mehrlander/web-tools/blob/claude/modest-newton-cm6is8/lib/alpineComponents/pages.js))
  renders on: [show-repo](https://mehrlander.github.io/web-tools/pages/show-repo/show-repo.html) (after merge)
- pages/show-repo/show-repo.html ([new](https://github.com/mehrlander/web-tools/blob/claude/modest-newton-cm6is8/pages/show-repo/show-repo.html), [main](https://github.com/mehrlander/web-tools/blob/main/pages/show-repo/show-repo.html))
- pages/toss-render.html, renamed from embed.html, + gh= address mode ([new](https://github.com/mehrlander/web-tools/blob/claude/modest-newton-cm6is8/pages/toss-render.html), [main as embed.html](https://github.com/mehrlander/web-tools/blob/main/pages/embed.html))
- bookmarklets/toss-render.js, renamed from embed-page.js, new target URL ([new](https://github.com/mehrlander/web-tools/blob/claude/modest-newton-cm6is8/bookmarklets/toss-render.js))
- README.md bookmarklet section ([new](https://github.com/mehrlander/web-tools/blob/claude/modest-newton-cm6is8/README.md))
- tools/test/pages.test.mjs ([new](https://github.com/mehrlander/web-tools/blob/claude/modest-newton-cm6is8/tools/test/pages.test.mjs))

**Next steps / open threads:**
- After merge: re-save the 🥏 bookmarklet (target moved to toss-render.html; text inlined in the page header comment), then try `toss-render.html#gh=mehrlander/web-tools@<branch>:pages/<page>.html`
- Address mode unverified against the live API (container rate-limited); parse regex + payload modes covered by checks here, fetch path is small
- Done: gh-boot `?use=` badge + auto-FAB (no-conflict when a page mounts its own); toss-render links in the FAB Render tab and viewer.js
- Thumbnails refresh at wrap-up (index.html, show-repo.html, toss-render.html changed)
