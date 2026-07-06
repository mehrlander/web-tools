# Branch guide: claude/frisbee-icon-render-page-rdc108

Two threads on one theme (how we surface renders through toss-render): (1) the toss-render **code** change — drop the floating "Copy toss link" pill, surface those actions through the FAB (recovers work stranded on `claude/unmerged-branches-review-bkn37j` after PR #181); (2) **conventions** — document the 🥏 toss as a portable surfacing primitive.

⭐ [toss-render.html (branch)](https://mehrlander.github.io/web-tools/pages/toss-render.html?use=claude/frisbee-icon-render-page-rdc108)

**Changed:**
- pages/toss-render.html — pill markup dropped; `tossRender` x-data exposes `description` + `actions`; address-mode relative-dep inlining (`inlineRelativeDeps`) + `fetchShim`.
- lib/alpineComponents/fab.js — FAB reads an `actions` array off each component and renders it in the always-visible header strip; `loadVersion({quiet})`.
- docs/CONVENTIONS.md — new "Toss a live view" primitive (🥏 marker, `#gz=` portable + `#gh=@ref` owner-only branch/private render); external-proxies ban now names the services and points at the toss alternative.

**Next steps / open threads:**
- Verified: pill gone (headless), FAB actions wired, `#gz=` one-liner round-trips, `#gh=@branch` address render works for the owner. "DUMBO" term already renamed out of code.
- Wrap-up: fold into MERGE-GUIDE, refresh toss-render thumbnail, open PR. Decide: one PR (code + docs together) or split code vs conventions.
