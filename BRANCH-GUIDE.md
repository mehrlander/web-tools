# Branch guide: claude/review-main-commit-oya9hs

Console-suite ergonomics: `_f` digit-string fix, then the modular growth path — `console/mods/` (lockstep verbs, the `q()` chain grammar, by-example `grow`, click-to-collect `pick`) assembled into a one-paste `console/suite.js` by a new build leg, with base.js untouched.

⭐ [console/README.md](https://github.com/mehrlander/web-tools/blob/claude/review-main-commit-oya9hs/console/README.md) (module map + grammar cheatsheet)

**Changed:**
- console/mods/verbs.js ([new](https://github.com/mehrlander/web-tools/blob/claude/review-main-commit-oya9hs/console/mods/verbs.js))
- console/mods/query.js ([new](https://github.com/mehrlander/web-tools/blob/claude/review-main-commit-oya9hs/console/mods/query.js))
- console/mods/grow.js ([new](https://github.com/mehrlander/web-tools/blob/claude/review-main-commit-oya9hs/console/mods/grow.js))
- console/mods/pick.js ([new](https://github.com/mehrlander/web-tools/blob/claude/review-main-commit-oya9hs/console/mods/pick.js))
- console/suite.js (generated) + tools/build/console-suite.mjs ([new](https://github.com/mehrlander/web-tools/blob/claude/review-main-commit-oya9hs/tools/build/console-suite.mjs))
- console/README.md ([new](https://github.com/mehrlander/web-tools/blob/claude/review-main-commit-oya9hs/console/README.md))
- tools/test/console-suite.test.mjs ([new](https://github.com/mehrlander/web-tools/blob/claude/review-main-commit-oya9hs/tools/test/console-suite.test.mjs)) — 15 tests, all passing
- console/base.js ([new](https://github.com/mehrlander/web-tools/blob/claude/review-main-commit-oya9hs/console/base.js), [main](https://github.com/mehrlander/web-tools/blob/main/console/base.js)) — `_f` digit-string fix only
- .claude/hooks/build-on-commit.sh, package.json, README.md — build:console wiring

**Next steps / open threads:**
- Backlog from the ideation (rough priority): `infer` (selector synthesis from the set), `tap` (fetch/XHR capture + shelf), `columns` (repetition → table, feeds packTable), `harvest` (virtualized-list scroll capture), `lasso` (drag-rectangle select), `census` (page-shape ping), named sets, `deck` (pop-window live table via messaging kit).
- `visible` engine untestable under jsdom (inert layout); verify in a real browser when convenient.
- `q()` grammar edge: a bare stage named like an engine (svg `<text>`) reads as the engine; documented in console/README.md.
