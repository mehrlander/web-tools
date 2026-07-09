# Branch guide: claude/show-repo-page-improvements-1xpb0d

Widens the show-repo sidebar on desktop, adds header shortcut buttons for home/web-tools/chat-histories, and adds a Recent section listing recently-committed files for the open repo@ref.

⭐ [pages/show-repo/show-repo.html](https://mehrlander.github.io/web-tools/pages/show-repo/show-repo.html?use=claude/show-repo-page-improvements-1xpb0d)

**Changed:**
- pages/show-repo/show-repo.html ([new](https://github.com/mehrlander/web-tools/blob/claude/show-repo-page-improvements-1xpb0d/pages/show-repo/show-repo.html), [main](https://github.com/mehrlander/web-tools/blob/main/pages/show-repo/show-repo.html), [diff](https://github.com/mehrlander/web-tools/compare/main...claude/show-repo-page-improvements-1xpb0d))
- lib/gh-api.js ([new](https://github.com/mehrlander/web-tools/blob/claude/show-repo-page-improvements-1xpb0d/lib/gh-api.js), [main](https://github.com/mehrlander/web-tools/blob/main/lib/gh-api.js), [diff](https://github.com/mehrlander/web-tools/compare/main...claude/show-repo-page-improvements-1xpb0d))

**Next steps / open threads:**
- The pinned home/chat-histories buttons dim (not hide) when unauthenticated, since both are private; verify that reads right in practice.
- Recent list depends on `GH.recentFiles()` (commits + commits/{sha} calls); verified in the headless preview only via a stubbed `recentFiles`, since the local render harness (`tools/render/cdn.mjs`) doesn't impersonate the commits endpoint — real GitHub API behavior untested this session.
- Thumbnail regen still owed at wrap-up per convention (this page changed).
- This file was found stale on the branch (leftover content from an unrelated, already-merged branch); overwritten with this branch's own guide.
