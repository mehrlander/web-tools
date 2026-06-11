# Branch guide: claude/peaceful-carson-f7ymn5

Imports Wring (single-document template induction) from `mehrlander/wring`: the engine as `lib/kits/wring.js`, two demo pages, a test in the npm suite, and the full upstream repo snapshotted under `archive/wring/` with IMPORT.md provenance.

⭐ [wring-text demo on the branch](https://mehrlander.github.io/web-tools/pages/demos/wring-text.html?use=190b291321a4bb6636bf7c2db1048601e9f81e71) (renders only after the page HTML reaches main; until then see the [new blob](https://github.com/mehrlander/web-tools/blob/claude/peaceful-carson-f7ymn5/pages/demos/wring-text.html))

**Changed:**
- lib/kits/wring.js ([new](https://github.com/mehrlander/web-tools/blob/claude/peaceful-carson-f7ymn5/lib/kits/wring.js), [diff](https://github.com/mehrlander/web-tools/commit/9cba52b)): the engine as a kit, generated; regenerate via `archive/wring/export/build-kit.mjs`
- pages/demos/wring-text.html, pages/demos/wring-dom.html ([text](https://github.com/mehrlander/web-tools/blob/claude/peaceful-carson-f7ymn5/pages/demos/wring-text.html), [dom](https://github.com/mehrlander/web-tools/blob/claude/peaceful-carson-f7ymn5/pages/demos/wring-dom.html)): the two demos, re-plumbed to `gh.load` the kit
- tools/test/wring.test.mjs ([new](https://github.com/mehrlander/web-tools/blob/claude/peaceful-carson-f7ymn5/tools/test/wring.test.mjs)): kit invariants on node:test; also registered in kits-register.test.mjs
- archive/wring/ ([tree](https://github.com/mehrlander/web-tools/tree/claude/peaceful-carson-f7ymn5/archive/wring), [IMPORT.md](https://github.com/mehrlander/web-tools/blob/claude/peaceful-carson-f7ymn5/archive/wring/IMPORT.md)): byte-for-byte snapshot of `mehrlander/wring@23114dc`
- lib/kits/README.md ([new](https://github.com/mehrlander/web-tools/blob/claude/peaceful-carson-f7ymn5/lib/kits/README.md), [main](https://github.com/mehrlander/web-tools/blob/main/lib/kits/README.md)): wring section + salvage-table row

**Next steps / open threads:**
- Wrap up: thumbnails for the two new pages, merge-guide entry, PR.
- After merge: tombstone README in `mehrlander/wring` + archive it on GitHub (outside this session's repo scope).
- Verified post-merge-sync: `npm test` 86/86, jsdom preview clean from `pages/demos/`; Chromium shots were taken pre-move and the pages are unchanged since.
