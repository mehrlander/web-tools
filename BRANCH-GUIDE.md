# Branch guide: claude/portable-scripts-framework-36hror

Introduces portable scripts as a first-class category alongside portable docs, with the tracker board generator as the first one.

⭐ [docs/PORTABLE.md](https://github.com/mehrlander/web-tools/blob/ed993df/docs/PORTABLE.md#scripts)

**Changed:**
- scripts/build-board.py ([new](https://github.com/mehrlander/web-tools/blob/ed993df/scripts/build-board.py))
- docs/PORTABLE.md ([new](https://github.com/mehrlander/web-tools/blob/ed993df/docs/PORTABLE.md), [main](https://github.com/mehrlander/web-tools/blob/main/docs/PORTABLE.md), [diff](https://github.com/mehrlander/web-tools/commit/ed993df))
- docs/TRACKER.md ([new](https://github.com/mehrlander/web-tools/blob/ed993df/docs/TRACKER.md), [main](https://github.com/mehrlander/web-tools/blob/main/docs/TRACKER.md), [diff](https://github.com/mehrlander/web-tools/commit/ed993df))
- docs/README.md ([new](https://github.com/mehrlander/web-tools/blob/ed993df/docs/README.md), [main](https://github.com/mehrlander/web-tools/blob/main/docs/README.md), [diff](https://github.com/mehrlander/web-tools/commit/ed993df))
- CLAUDE.md ([new](https://github.com/mehrlander/web-tools/blob/ed993df/CLAUDE.md), [main](https://github.com/mehrlander/web-tools/blob/main/CLAUDE.md), [diff](https://github.com/mehrlander/web-tools/commit/ed993df))

**Next steps / open threads:**
- Review: does `scripts/` as the portable-scripts home feel right, or should it live elsewhere?
- The Node `tools/build/tracker-board.mjs` stays as this repo's local implementation (wired into `npm run tracker-board` and the commit hook); the Python `scripts/build-board.py` is the portable published version. Two implementations of the same logic, which is a drift risk. Worth discussing whether to collapse them or accept the duplication given they serve different purposes (Node for the commit hook, Python for portability).
- The home repo's next step: add a `SessionStart` hook that fetches `scripts/build-board.py` into `.web-tools-scripts/` and wires the tracker board command to run it.
