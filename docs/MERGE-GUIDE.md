# Merge guide

Newest-on-top log of what each session shipped. Convention: see the Merge guide section in `CLAUDE.md`. Say "merge guide" in a session to prepend an entry.

---

## 2026-06-05 Split tools/ into render+build; rewrite loader doc (PR #152)

Reorganized the `tools/` harness into `render/` + `build/`, and rewrote the loader contract doc to match the current loader and tell the load↔build story.

⭐ **Result (doc + tooling — view the file):** [docs/loader.md](https://github.com/mehrlander/web-tools/blob/main/docs/loader.md)

**Changed:**
- docs/loader.md ([new](https://github.com/mehrlander/web-tools/blob/main/docs/loader.md), [main (was SCAFFOLDING.md)](https://github.com/mehrlander/web-tools/blob/main/docs/SCAFFOLDING.md), [diff](https://github.com/mehrlander/web-tools/commit/6de6e79))
- tools/ → [render/](https://github.com/mehrlander/web-tools/tree/main/tools/render) + [build/](https://github.com/mehrlander/web-tools/tree/main/tools/build) ([diff](https://github.com/mehrlander/web-tools/commit/6de6e79))
- tools/README.md, README.md, docs/README.md ([diff](https://github.com/mehrlander/web-tools/commit/6de6e79))

**Notes:** Dev-only tooling + docs; no page runtime touched. The two tool clusters share no module imports (they couple only via subprocess + the `dist/` artifact), which is why the folder split is clean. The loader-doc rewrite corrects a stale "load mechanism" section (the `export`-strip/auto-return was removed in `451f963`) and documents a new contract clause: a runtime-computed `gh.load()` path is invisible to the static build graph, so it isn't cached offline.

[Session diff](https://github.com/mehrlander/web-tools/compare/main...claude/build-process-review-glCSc)

---

## 2026-05-29 Establish the merge-guide convention (branch `claude/merge-results-guide-lcnVY`)

A standing, on-demand log so session results are one tap away.

⭐ **Result:** [Merge guide section in CLAUDE.md](https://github.com/mehrlander/web-tools/blob/claude/merge-results-guide-lcnVY/CLAUDE.md#merge-guide)

**Changed:**
- CLAUDE.md ([new](https://github.com/mehrlander/web-tools/blob/claude/merge-results-guide-lcnVY/CLAUDE.md#merge-guide), [main](https://github.com/mehrlander/web-tools/blob/main/CLAUDE.md))
- MERGE-GUIDE.md, this log ([new](https://github.com/mehrlander/web-tools/blob/claude/merge-results-guide-lcnVY/MERGE-GUIDE.md))

**Notes:** On-demand only. This entry is the format's worked example.

[Session diff](https://github.com/mehrlander/web-tools/compare/main...claude/merge-results-guide-lcnVY)
