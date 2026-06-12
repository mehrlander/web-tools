# Branch guide: claude/keen-carson-w36rui

New page `pages/nav-repo.html`: the lens-tab take on the repo browser (repo@ref header, then Files / Pages as top-level tabs), built fresh next to show-repo instead of restructuring it; URL-param state (`?repo=&ref=&file=&tab=`) instead of show-repo's home-repo state file.

⭐ [nav-repo via toss-render](https://mehrlander.github.io/web-tools/pages/toss-render.html#gh=mehrlander/web-tools@claude/keen-carson-w36rui:pages/nav-repo.html) (page is new, so no canonical Pages URL yet)

**Changed:**
- pages/nav-repo.html (new)
- BRANCH-GUIDE.md (this file)

**Next steps / open threads:**
- Verify in a token-bearing browser (headless render can only reach the token screen, same as show-repo's thumb)
- Pages lens still shows the component's own collapse header (redundant inside a tab); fold away if it grates
- Actions lens deferred: payload format + allowlist design is its own session
- Decide later whether show-repo's bolted-on pages section gets removed once nav-repo proves out
