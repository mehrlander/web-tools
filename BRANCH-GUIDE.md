# Branch guide: claude/unmerged-branches-review-bkn37j

Follow-up to PR #181, two threads: (1) drop toss-render's floating "Copy toss link" pill and surface page actions through the FAB via a new opt-in `actions` contract; (2) add DUMBO, so address-mode rendering of a private/un-deployed page inlines its relative script/CSS deps that Pages can't serve.

⭐ [toss-render on this branch](https://mehrlander.github.io/web-tools/pages/toss-render.html?use=claude/unmerged-branches-review-bkn37j) — paste to render (FAB header: "Copy toss link" / "New toss"); `?gh=owner/repo@ref:path` renders a private/branch page with its relative deps DUMBO-inlined.

**Changed:**
- lib/alpineComponents/fab.js ([new](https://github.com/mehrlander/web-tools/blob/claude/unmerged-branches-review-bkn37j/lib/alpineComponents/fab.js), [main](https://github.com/mehrlander/web-tools/blob/main/lib/alpineComponents/fab.js))
  renders on: every page that mounts the FAB (additive: `actions` defaults to none)
- pages/toss-render.html ([new](https://github.com/mehrlander/web-tools/blob/claude/unmerged-branches-review-bkn37j/pages/toss-render.html), [main](https://github.com/mehrlander/web-tools/blob/main/pages/toss-render.html))
- BRANCH-GUIDE.md — also deletes the copy that leaked to main when #181 merged via the UI (folded at wrap-up).

**What changed:**
- FAB: `detect()` now reads an `actions: [{label, icon, run}]` array off each `[x-data]` (mirroring how it already reads `description`); `pageActions` renders them as buttons in the always-visible header, with `runAction()` flashing any string the action returns ("Copied").
- toss-render: pill removed; a tiny `tossRender` x-data component exposes `description` + `actions` ("Copy toss link", "New toss"), closing over the existing vanilla render state — so the instant/offline render path is unchanged.
- FAB `loadVersion()` now passes `{ quiet: true }`: a background version check 403 no longer hijacks the page with the token prompt (this was wiping tossed content for anonymous/rate-limited users).
- toss-render DUMBO (Dynamic Unplanned mini-Bake Operation): in address mode, after fetching the HTML, `dumboBake()` inlines every *relative* `<script src>` and `<link rel=stylesheet href>` by fetching it through the authenticated contents API at the same ref (scripts → `<script>`, CSS → `<style>`). No-op when there are no relative deps. Private-repo/branch focus only (public would use a base trick we deliberately skipped). Limits: static first-level refs; images, CSS `url()`/`@import`, and second-level module imports left to a later pass.

**Verified headless:** FAB actions + un-hijacked render confirmed (prior commit); DUMBO confirmed with throwaway fixtures (relative `<script>`+`<link>` inlined and executed: JS ran, CSS applied, no `src`/`stylesheet` left); fixtures deleted, not committed.

**Next steps / open threads:**
- DUMBO not yet device-tested against a real private repo (only the harness contents-API stand-in). Logic is identical; the only delta is the token + real 404/403 handling, which DUMBO surfaces per-asset via `data-dumbo-error`.
- DUMBO v2 candidates (deferred deliberately): images → `data:`; rewrite `url()`/`@import` inside inlined CSS; recurse into module imports. A Service Worker resolver would cover dynamic `fetch()`/`import()` but is much heavier.
- Edge: inlining JS that contains a literal `</script>` would break serialization (rare; in strings only). Acceptable for v1.
- FAB action tap → `clipboard.writeText` on iOS not device-tested (gesture path, should be fine).
- Kept all FAB tabs (no per-page tab-hiding) — Render tab is the dev shell-preview tool, tucked in the drawer.
- Still open: `loadFrameBranches()` hijacks on a Render-tab 403 (same `quiet` fix via gh-fetch); DRY the `<base>`+`?use=` recipe shared by `addressHtml` and the FAB's `frameHtml`.
