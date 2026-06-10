# Merge guide

Newest-on-top log of what each session shipped. Convention: see the Merge guide section in `CLAUDE.md`. Say "merge guide" in a session to prepend an entry.

---

## 2026-06-10 WSL Sync thumbnails + `/+esm` render fix (PR #159)

Filled the two empty pages/wsl-sync cards in the pages index, fixing the render harness's handling of jsDelivr `/+esm` imports along the way.

⭐ **Result:** [pages/index.html](https://mehrlander.github.io/web-tools/pages/index.html) — the wsl-sync cards now show previews

**Changed:**
- pages/thumbs/wsl-sync/pension-dash.png, wsl-sync.png ([new](https://github.com/mehrlander/web-tools/tree/main/pages/thumbs/wsl-sync), [diff](https://github.com/mehrlander/web-tools/commit/0e2e9bc))
- tools/render/cdn.mjs ([new](https://github.com/mehrlander/web-tools/blob/main/tools/render/cdn.mjs), [main](https://github.com/mehrlander/web-tools/blob/f11f3f6/tools/render/cdn.mjs), [diff](https://github.com/mehrlander/web-tools/commit/0e2e9bc)) — `/+esm` specs now resolve to the package's ESM entry, not the UMD default; jquery vendored
- docs/environment/testing.md, docs/MERGE-GUIDE.md ([diff](https://github.com/mehrlander/web-tools/commit/0e2e9bc))

**Notes:** pension-dash's thumb shows its real empty state; wsl-sync's shows header chrome only — its fast-xml-parser dep is CJS-only, which jsDelivr bundles to ESM server-side but the local resolver can't. Also adds the retroactive #158 entry below. Remaining wsl-sync work (Actions-based data fetch, load-from-repo path) deferred to a follow-up session.

[Session diff](https://github.com/mehrlander/web-tools/compare/main...claude/blissful-keller-tc8vl6)

---

## 2026-06-09 WSL bill apps move to pages/ + repo-side fetcher (PR #158)

Moved the WA Legislature pension-bill apps from `tools/wsl-sync/` to `pages/wsl-sync/` (they're served pages, not build tooling) and added a Node fetcher that writes the six sync stores as IDB-shaped JSON, bypassing the browser CORS paste-shuffle.

⭐ **Result:** [pension-dash](https://mehrlander.github.io/web-tools/pages/wsl-sync/pension-dash.html) (empty until IndexedDB is seeded; see [README](https://github.com/mehrlander/web-tools/blob/main/pages/wsl-sync/README.md))

**Changed:**
- pages/wsl-sync/fetch-data.mjs ([new](https://github.com/mehrlander/web-tools/blob/main/pages/wsl-sync/fetch-data.mjs), [diff](https://github.com/mehrlander/web-tools/commit/62868d9)) — `npm run wsl-fetch`; reuses wsl-api.js's parsers, writes `data/*.json`
- pages/wsl-sync/README.md ([new](https://github.com/mehrlander/web-tools/blob/main/pages/wsl-sync/README.md), [diff](https://github.com/mehrlander/web-tools/commit/62868d9)) — the two data paths + console seed snippet
- tools/wsl-sync/ → [pages/wsl-sync/](https://github.com/mehrlander/web-tools/tree/main/pages/wsl-sync) ([diff](https://github.com/mehrlander/web-tools/commit/10847a1)) — wsl-sync.html, pension-dash.html, wsl-api.js, pension-map.js, rcw/ moved unmodified
- package.json ([diff](https://github.com/mehrlander/web-tools/commit/62868d9)) — `wsl-fetch` script + fast-xml-parser/flat devDeps

**Notes:** Merged unexercised: `data/` is empty (the fetcher needs egress to `wslwebservices.leg.wa.gov`, not on the sandbox allowlist — run locally or via CI), and the pages read only IndexedDB, so committed `data/` won't show until seeded (README snippet) or a load-from-repo path exists. *(Entry written retroactively 2026-06-10; rode in on the branch above.)*

[Session diff](https://github.com/mehrlander/web-tools/compare/c042b30...f11f3f6)

---

## 2026-06-09 Build-on-commit hook + wrap-up ritual (PR #157)

Unified the derived-artifact refresh model: the commit-time hook now owns the pages catalogs alongside the pre-build, and thumbnails refresh once per session via the new "wrap up" ritual.

⭐ **Result (tooling + conventions — view the doc):** [tools/README.md — The refresh model](https://github.com/mehrlander/web-tools/blob/main/tools/README.md#the-refresh-model)

**Changed:**
- .claude/hooks/build-on-commit.sh ([new](https://github.com/mehrlander/web-tools/blob/main/.claude/hooks/build-on-commit.sh), [was prebuild-on-commit.sh](https://github.com/mehrlander/web-tools/blob/d82ce35/.claude/hooks/prebuild-on-commit.sh), [diff](https://github.com/mehrlander/web-tools/commit/ddd9c3a)) — new legs: regenerate+stage `pages/README.md` + `pages/index.html` when `pages/**/*.html` is dirty; warn when a page changes without its thumb
- CLAUDE.md ([new](https://github.com/mehrlander/web-tools/blob/main/CLAUDE.md), [diff](https://github.com/mehrlander/web-tools/commit/ddd9c3a)) — "Wrapping up" ritual (thumbs → merge-guide entry → PR) + the merged-branch closer line for post-merge responses
- tools/README.md ([new](https://github.com/mehrlander/web-tools/blob/main/tools/README.md#the-refresh-model), [diff](https://github.com/mehrlander/web-tools/commit/ddd9c3a)) — "The refresh model" section
- .claude/settings.json, docs/environment/extending.md, tools/build/build-lib.mjs ([diff](https://github.com/mehrlander/web-tools/commit/ddd9c3a)) — hook rename references

**Notes:** Deliberate split: deterministic artifacts ride in the commit that changes their source; thumbnails (slow, not byte-deterministic) refresh per-session at wrap-up, with the hook nagging if forgotten. The hook only governs commits made through Claude sessions; `pages-index --check` remains the audit. Conventions take effect for sessions started after merge.

[Session diff](https://github.com/mehrlander/web-tools/compare/main...claude/eager-davinci-ekveex)

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
