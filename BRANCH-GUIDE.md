# Branch guide: claude/portable-scripts-framework-36hror

Introduces portable scripts as a first-class category alongside portable docs, with the tracker board generator as the first one. Collapses the Node and Python board generators into one: `scripts/build-board.py` is the single source of truth, called by `npm run tracker-board` with this repo's paths as argv.

⭐ [docs/PORTABLE.md](https://github.com/mehrlander/web-tools/blob/claude/portable-scripts-framework-36hror/docs/PORTABLE.md#scripts)

**Changed:**
- scripts/build-board.py ([new](https://github.com/mehrlander/web-tools/blob/claude/portable-scripts-framework-36hror/scripts/build-board.py))
- docs/PORTABLE.md ([new](https://github.com/mehrlander/web-tools/blob/claude/portable-scripts-framework-36hror/docs/PORTABLE.md), [main](https://github.com/mehrlander/web-tools/blob/main/docs/PORTABLE.md), [diff](https://github.com/mehrlander/web-tools/commit/ed993df))
- docs/TRACKER.md ([new](https://github.com/mehrlander/web-tools/blob/claude/portable-scripts-framework-36hror/docs/TRACKER.md), [main](https://github.com/mehrlander/web-tools/blob/main/docs/TRACKER.md), [diff](https://github.com/mehrlander/web-tools/commit/ed993df))
- docs/README.md ([new](https://github.com/mehrlander/web-tools/blob/claude/portable-scripts-framework-36hror/docs/README.md), [main](https://github.com/mehrlander/web-tools/blob/main/docs/README.md), [diff](https://github.com/mehrlander/web-tools/commit/ed993df))
- CLAUDE.md ([new](https://github.com/mehrlander/web-tools/blob/claude/portable-scripts-framework-36hror/CLAUDE.md), [main](https://github.com/mehrlander/web-tools/blob/main/CLAUDE.md), [diff](https://github.com/mehrlander/web-tools/commit/ed993df))
- tools/build/tracker-board.mjs (deleted)
- package.json ([new](https://github.com/mehrlander/web-tools/blob/claude/portable-scripts-framework-36hror/package.json), [main](https://github.com/mehrlander/web-tools/blob/main/package.json))

**Next steps / open threads:**
- Review: does `scripts/` as the portable-scripts home feel right, or should it live elsewhere?
- The home repo's next step: add a `SessionStart` hook that fetches `scripts/build-board.py` into `.web-tools-scripts/` and wires the tracker board command to run it.
