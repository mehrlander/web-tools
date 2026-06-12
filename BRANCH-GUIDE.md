# Branch guide: claude/keen-carson-w36rui

New page `pages/nav-repo.html`: the lens-tab take on the repo browser (repo@ref header, then Files / Pages as top-level tabs), built fresh next to show-repo instead of restructuring it; URL-param state (`?repo=&ref=&file=&tab=`) instead of show-repo's home-repo state file.

⭐ [nav-repo via toss-render](https://mehrlander.github.io/web-tools/pages/toss-render.html#gh=mehrlander/web-tools@claude/keen-carson-w36rui:pages/nav-repo.html) (page is new, so no canonical Pages URL yet)

Second push: identity-free boot. With `?repo=` present, nav-repo picks the repo directly (`repo.js pickByName`, no `gh.repos()` gate) and populates the picker in the background (`setup({quiet})`, new `quiet` flag in gh-auth's prompt takeover). The headless shim (cdn.mjs) answers `/repos/<repo>` metadata and `git/trees` from the working tree, so screenshots now show the real UI. Also fixed a double-boot bug: body declared `x-init="init()"` while Alpine auto-calls `init()`, doubling every boot API call (nav-repo and show-repo).

**Changed:**
- pages/nav-repo.html (new page + identity-free boot order)
- lib/alpineComponents/repo.js (pickByName, quiet setup, auto-pick guard)
- lib/gh-auth.js (opts.quiet suppresses the 401/403 prompt takeover per request)
- lib/gh-fetch.js (repos() passes opts through)
- pages/show-repo/show-repo.html (drop redundant x-init double-boot)
- tools/render/cdn.mjs (repo-metadata + git/trees local shims; header now names "own data" as a third request category)
- docs/environment/testing.md (dated note: checkout-not-API data source, three render categories, identity-free boot pattern)
- tools/render/screenshot.mjs (--query flag)
- BRANCH-GUIDE.md (this file)

**Next steps / open threads:**
- Verify the token path in a real browser (headless only exercises the anonymous path)
- Pages lens still shows the component's own collapse header (redundant inside a tab); fold away if it grates
- Actions lens deferred: payload format + allowlist design is its own session
- show-repo could adopt pickByName for its ?repo= links later (only the x-init bug fix touched it here)
