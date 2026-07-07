# Branch guide: claude/review-main-commit-oya9hs

Console-suite ergonomics, complete: the `_f` digit-string fix, then the full modular backlog — twelve mods under `console/mods/` (verbs, q() grammar, grow, pick, infer, tap, columns, harvest, lasso, census, sets, deck) assembled into a one-paste `console/suite.js` by a build the commit hook owns, with base.js untouched.

⭐ [console/README.md](https://github.com/mehrlander/web-tools/blob/claude/review-main-commit-oya9hs/console/README.md) (module map, grammar cheatsheet, the find→dance→grab loop)

**Changed:**
- console/mods/ ([new](https://github.com/mehrlander/web-tools/tree/claude/review-main-commit-oya9hs/console/mods)) — 12 modules
- console/suite.js (generated) via tools/build/console-suite.mjs ([new](https://github.com/mehrlander/web-tools/blob/claude/review-main-commit-oya9hs/tools/build/console-suite.mjs))
- console/README.md ([new](https://github.com/mehrlander/web-tools/blob/claude/review-main-commit-oya9hs/console/README.md))
- tools/test/console-suite.test.mjs ([new](https://github.com/mehrlander/web-tools/blob/claude/review-main-commit-oya9hs/tools/test/console-suite.test.mjs)) — 28 tests, 130/130 repo-wide
- console/base.js ([new](https://github.com/mehrlander/web-tools/blob/claude/review-main-commit-oya9hs/console/base.js), [main](https://github.com/mehrlander/web-tools/blob/main/console/base.js)) — `_f` digit-string fix only
- .claude/hooks/build-on-commit.sh, package.json, README.md — build:console wiring

**Next steps / open threads:**
- Geometry-dependent behavior (lasso rectangles, census geoReg, `visible`) is untestable under jsdom's inert layout; worth one real-browser pass over suite.js when convenient.
- Backlog fully built. Future candidates from the ideation, unscheduled: vein-to-skin matching (join tap payload fields to DOM text), `glom.watch()` (MutationObserver self-healing sets), recipe journal (ops log → replayable one-liner), `glom.semantics()` (JSON-LD/microdata grab).
- Cross-realm duck-typing note: tap detects regexes via `typeof f.test === 'function'` because `instanceof RegExp` fails across realms (bit twice in testing; real single-realm browser use is unaffected).
