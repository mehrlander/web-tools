# Branch guide: claude/unmerged-branches-review-bkn37j

Follow-up to PR #181, two threads: (1) drop toss-render's floating "Copy toss link" pill and surface page actions through the FAB via a new opt-in `actions` contract; (2) make private/un-deployed pages render whole — inline their relative script/CSS deps *and* reroute their relative runtime fetches — since Pages can't serve them.

⭐ [toss-render on this branch](https://mehrlander.github.io/web-tools/pages/toss-render.html?use=claude/unmerged-branches-review-bkn37j) — paste to render (FAB header: "Copy toss link" / "New toss"); `?gh=owner/repo@ref:path` renders a private/branch page with its relative `<script>`/`<link>` inlined and its relative `fetch()`es rerouted.

**Changed:**
- lib/alpineComponents/fab.js ([new](https://github.com/mehrlander/web-tools/blob/claude/unmerged-branches-review-bkn37j/lib/alpineComponents/fab.js), [main](https://github.com/mehrlander/web-tools/blob/main/lib/alpineComponents/fab.js))
  renders on: every page that mounts the FAB (additive: `actions` defaults to none)
- pages/toss-render.html ([new](https://github.com/mehrlander/web-tools/blob/claude/unmerged-branches-review-bkn37j/pages/toss-render.html), [main](https://github.com/mehrlander/web-tools/blob/main/pages/toss-render.html))
- BRANCH-GUIDE.md — also deletes the copy that leaked to main when #181 merged via the UI (folded at wrap-up).

**What changed:**
- FAB: `detect()` now reads an `actions: [{label, icon, run}]` array off each `[x-data]` (mirroring how it already reads `description`); `pageActions` renders them as buttons in the always-visible header, with `runAction()` flashing any string the action returns ("Copied").
- toss-render: pill removed; a tiny `tossRender` x-data component exposes `description` + `actions` ("Copy toss link", "New toss"), closing over the existing vanilla render state — so the instant/offline render path is unchanged.
- FAB `loadVersion()` now passes `{ quiet: true }`: a background version check 403 no longer hijacks the page with the token prompt (this was wiping tossed content for anonymous/rate-limited users).
- toss-render render-time inlining (`inlineRelativeDeps`): in address mode, after fetching the HTML, it inlines every *relative* `<script src>` and `<link rel=stylesheet href>` by fetching it through the authenticated contents API at the same ref (scripts → `<script>`, CSS → `<style>`). No-op when there are no relative deps.
- toss-render runtime fetch shim (`fetchShim`, stamped into `addressHtml`'s prelude): wraps `window.fetch` in the rendered page so a *relative GET* (e.g. `fetch('./data.json')`, `'./rows.csv'`) is rerouted to the same contents API; returns a `Response` with a MIME guessed from the extension, so `res.json()/text()/blob()` behave. Absolute URLs, non-GET, root-relative `/…`, and `Request` objects pass through untouched. Reads the token itself (same-origin, allowlisted render).
- Private-repo/branch focus only (public would use a base trick we deliberately skipped).

**Verified headless:** FAB actions + un-hijacked render confirmed; inlining confirmed with throwaway fixtures (relative `<script>`+`<link>` inlined and executed); fetch shim confirmed with fixtures (`fetch('./_data.json').json()` and `'./_data.csv').text()` both resolved via the contents API with correct types); all fixtures deleted, not committed.

**Next steps / open threads:**
- Neither shim yet device-tested against a real private repo (only the harness contents-API stand-in). Logic is identical; the deltas are the live token and real 404/403s (inliner surfaces per-asset via `data-inline-error`; the fetch shim returns the API's error Response to the page).
- Still unhandled (deferred): static `<img src>`/relative-tag assets, CSS `url()`/`@import`, XHR, and dynamic `import()`. Images-via-`fetch` already work through the shim (returned as a typed blob); only relative-tag images don't.
- Edge: inlining JS containing a literal `</script>` breaks serialization (rare; in strings only).
- Edge: inlining JS that contains a literal `</script>` would break serialization (rare; in strings only). Acceptable for v1.
- FAB action tap → `clipboard.writeText` on iOS not device-tested (gesture path, should be fine).
- Kept all FAB tabs (no per-page tab-hiding) — Render tab is the dev shell-preview tool, tucked in the drawer.
- Still open: `loadFrameBranches()` hijacks on a Render-tab 403 (same `quiet` fix via gh-fetch); DRY the `<base>`+`?use=` recipe shared by `addressHtml` and the FAB's `frameHtml`.
