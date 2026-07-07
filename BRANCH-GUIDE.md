# Branch guide: claude/wrap-up-conflict-detection-m3e6x4

Adds a conflict-detection preflight to the wrap-up sequence in the portable conventions, so a session catches a branch that main has diverged out from under (a fresh clone bases on main-at-session-start) before it opens an unmergeable PR.

⭐ [docs/CONVENTIONS.md — Wrap-up & PR creation](https://github.com/mehrlander/web-tools/blob/claude/wrap-up-conflict-detection-m3e6x4/docs/CONVENTIONS.md#wrap-up--pr-creation)

**Changed:**
- docs/CONVENTIONS.md — new step 1 "Preflight: confirm the branch still merges cleanly" (`git fetch origin main && git merge-tree --write-tree origin/main HEAD`), sequence renumbered, UI-trigger note updated. Names committed generated artifacts as the usual culprit. Kept terse to match the doc's voice: one-line step, no older-git fallback (no other command in the doc carries one).

**Next steps / open threads:**
- The general "generated artifacts conflict readily" insight now lives in the portable doc (passes the applies-in-any-repo test). The web-tools *instantiation* (naming `dist/web-tools.js` and the `pages/` catalogs) could still go in CLAUDE.md as the extension-point-style answer — not yet added; ask if wanted.
- Convention-only; no hook enforces the preflight. Could later wire it into the build-on-commit hook or a wrap-up helper.
