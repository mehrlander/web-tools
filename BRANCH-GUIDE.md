# Branch guide: claude/frisbee-icon-render-page-rdc108

Removes the floating "Copy toss link" pill that sat over rendered content on toss-render, surfacing those actions through the FAB instead. Recovers work stranded on `claude/unmerged-branches-review-bkn37j` (its four post-#181 commits never got their own PR).

⭐ [toss-render.html (branch)](https://mehrlander.github.io/web-tools/pages/toss-render.html?use=claude/frisbee-icon-render-page-rdc108)

**Changed:**
- pages/toss-render.html — pill markup dropped; `tossRender` x-data exposes `description` + `actions`; address-mode relative-dep inlining (`inlineRelativeDeps`) + `fetchShim`.
- lib/alpineComponents/fab.js — FAB reads an `actions` array off each component and renders it in the always-visible header strip; `loadVersion({quiet})`.

**Next steps / open threads:**
- Verified headless: pill gone, FAB present, actions wired (`pageActions`/`runAction`). Address-mode inlining (former "DUMBO") carried along; term already renamed out of code.
- Wrap-up: fold into MERGE-GUIDE, open PR.
