# Branch guide: claude/unmerged-branches-review-bkn37j

Follow-up to PR #181: drop toss-render's floating "Copy toss link" pill and surface page actions through the FAB instead, via a new opt-in `actions` contract on the FAB's component scan.

⭐ [toss-render on this branch](https://mehrlander.github.io/web-tools/pages/toss-render.html?use=claude/unmerged-branches-review-bkn37j) — paste to render, then open the FAB: "Copy toss link" / "New toss" sit in its header.

**Changed:**
- lib/alpineComponents/fab.js ([new](https://github.com/mehrlander/web-tools/blob/claude/unmerged-branches-review-bkn37j/lib/alpineComponents/fab.js), [main](https://github.com/mehrlander/web-tools/blob/main/lib/alpineComponents/fab.js))
  renders on: every page that mounts the FAB (additive: `actions` defaults to none)
- pages/toss-render.html ([new](https://github.com/mehrlander/web-tools/blob/claude/unmerged-branches-review-bkn37j/pages/toss-render.html), [main](https://github.com/mehrlander/web-tools/blob/main/pages/toss-render.html))
- BRANCH-GUIDE.md — also deletes the copy that leaked to main when #181 merged via the UI (folded at wrap-up).

**What changed:**
- FAB: `detect()` now reads an `actions: [{label, icon, run}]` array off each `[x-data]` (mirroring how it already reads `description`); `pageActions` renders them as buttons in the always-visible header, with `runAction()` flashing any string the action returns ("Copied").
- toss-render: pill removed; a tiny `tossRender` x-data component exposes `description` + `actions` ("Copy toss link", "New toss"), closing over the existing vanilla render state — so the instant/offline render path is unchanged.
- FAB `loadVersion()` now passes `{ quiet: true }`: a background version check 403 no longer hijacks the page with the token prompt (this was wiping tossed content for anonymous/rate-limited users).

**Verified headless:** tossed content renders full-viewport un-hijacked; FAB header shows both actions; `tossRender` + description show in Components; `npm test` 93/93; `build:lib` clean.

**Next steps / open threads:**
- Not yet device-tested: the FAB action tap → `clipboard.writeText` on iOS (should be fine; it's a gesture).
- Decided NOT to add per-page tab-hiding or hide the Render tab — more machinery than it's worth; the Render tab is tucked in the drawer and is the dev shell-preview tool. Revisit if it annoys.
- Follow-up candidates: `loadFrameBranches()` still hijacks on a Render-tab 403 (same `quiet` fix, via gh-fetch); and DRY the duplicated `<base>`+`?use=` recipe shared by toss-render's `addressHtml` and the FAB's `frameHtml`.
