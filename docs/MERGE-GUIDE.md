# Merge guide

Newest-on-top log of what each session shipped. Convention: see the Merge guide section in `docs/CONVENTIONS.md`. Say "merge guide" in a session to prepend an entry.

---

## 2026-06-16 Portable headless-vendoring recipe + the to-go-set manifest (branch claude/headless-tailwind-daisyui-alpine-ue50gn)

A self-contained, repo-agnostic guide to building with Tailwind / daisyUI / Alpine / Phosphor and rendering them headless where a sandbox blocks their CDNs (vendor from npm, intercept the requests, serve from `node_modules`), plus a `PORTABLE.md` manifest cataloguing the docs meant to travel to other repos.

⭐ **Result:** [docs/headless-vendoring.md](https://github.com/mehrlander/web-tools/blob/main/docs/headless-vendoring.md) — the recipe, with a standalone Playwright interceptor and a verified daisyUI theme-explorer example; catalogued in [docs/PORTABLE.md](https://github.com/mehrlander/web-tools/blob/main/docs/PORTABLE.md)

**Changed:**
- docs/headless-vendoring.md ([new](https://github.com/mehrlander/web-tools/blob/main/docs/headless-vendoring.md), [diff](https://github.com/mehrlander/web-tools/commit/98ac4a6)) — vendor + intercept concept; `render.mjs` handles `/combine/` and is CDN-field-aware (unpkg vs jsdelivr defaults); framing, chat-image, and feedback-loop notes
- docs/PORTABLE.md ([new](https://github.com/mehrlander/web-tools/blob/main/docs/PORTABLE.md), [diff](https://github.com/mehrlander/web-tools/commit/1d9f57d)) — the to-go-set manifest, bidirectional with the conventions skill
- docs/examples/theme-explorer.html ([new](https://github.com/mehrlander/web-tools/blob/main/docs/examples/theme-explorer.html), [diff](https://github.com/mehrlander/web-tools/commit/81d1276)) — daisyUI theme picker + paired-pill token matrix; the verified example
- .claude/skills/web-tools-conventions/SKILL.md, docs/README.md, CLAUDE.md ([diff](https://github.com/mehrlander/web-tools/commit/1d9f57d)) — point at / surface the manifest
- docs/environment/testing.md, docs/environment/capabilities.md, tools/render/cdn.mjs ([diff](https://github.com/mehrlander/web-tools/commit/1d9f57d)) — one-line pointers → headless-vendoring.md (one direction, to keep it portable)

**Notes:** Portable by design (no web-tools internals); examples verified by running the doc's `render.mjs` extracted verbatim (no MISS, no console errors). Convention settled this session: author pages with one tag per library, not jsDelivr `/combine/` (the interceptor still handles combine for pre-existing pages). The earlier landing-demo example was dropped; theme-explorer is the single canonical example.

[Session diff](https://github.com/mehrlander/web-tools/compare/main...claude/headless-tailwind-daisyui-alpine-ue50gn)

## 2026-06-13 RCW pension crosswalk page over the full corpus (PR #175)

A standalone, self-contained pension reference: wsl-core's PENSION_MAP layered over every RCW title, chapter, and section caption, searchable and filterable, usable saved as a single local file offline.

⭐ **Result:** [pension-map](https://mehrlander.github.io/web-tools/pages/wsl-sync/pension-map.html) — quick-find pills (trust-fund expenses 41.50.255 highlighted), cite-scoped search (`41.50 payment`), pension-only filter, per-chapter section detail, grouped tag view with `#tag` filtering, full-code browse tree

**Changed:**
- pages/wsl-sync/pension-map.html ([new](https://github.com/mehrlander/web-tools/blob/main/pages/wsl-sync/pension-map.html), [diff](https://github.com/mehrlander/web-tools/commit/619907c)) — corpus embedded gzip+base64 (1.2 MB), inflated at boot via native DecompressionStream; refresh one-liner in the header comment
- pages/thumbs/wsl-sync/pension-map.png ([new](https://github.com/mehrlander/web-tools/blob/main/pages/thumbs/wsl-sync/pension-map.png), [diff](https://github.com/mehrlander/web-tools/commit/b962c36)); pages/README.md + pages/index.html hook-regenerated

**Notes:** Pension semantics mirrored by hand from `lib/kits/wsl-core.js` PENSION_MAP (drift risk noted in both files). Corpus is the 2025 RCW archive; 2026 session law (e.g. ch. 68, 2026 Laws amending 41.50.255, the trust-fund expenses section) not reflected until refreshed. PENSION_MAP cite 41.40.761 is absent from the corpus, likely repealed; tag omitted, may warrant a PENSION_MAP cleanup. Quick-find pills are a placeholder set of five; curate as needed.

[Session diff](https://github.com/mehrlander/web-tools/compare/main...claude/practical-noether-ks7579)

## 2026-06-12 nav-repo lens browser; identity-free boot; testing.md rewrite (PR #174)

New page nav-repo answers "what is show-repo for": a repo@ref header with Files / Pages as top-level lens tabs, shareable `?repo=&ref=&file=&tab=` URL state, and an identity-free boot, so public repos browse with no token; the headless harness now impersonates the GitHub API from the local checkout, so these pages screenshot for real.

⭐ **Result:** [pages/nav-repo.html](https://mehrlander.github.io/web-tools/pages/nav-repo.html?repo=mehrlander/web-tools&file=README.md)

**Changed:**
- pages/nav-repo.html ([new](https://github.com/mehrlander/web-tools/blob/main/pages/nav-repo.html)): the lens-tab page; show-repo left intact as-is
- lib/alpineComponents/repo.js ([new](https://github.com/mehrlander/web-tools/blob/main/lib/alpineComponents/repo.js)): `pickByName()` (boot without listing anyone's repos), `setup({quiet})`, auto-pick guard
  renders on: [nav-repo](https://mehrlander.github.io/web-tools/pages/nav-repo.html), [show-repo](https://mehrlander.github.io/web-tools/pages/show-repo/show-repo.html)
- lib/gh-auth.js ([new](https://github.com/mehrlander/web-tools/blob/main/lib/gh-auth.js)) + lib/gh-fetch.js: per-request `quiet` flag keeps background 401/403s from taking over the page
- pages/show-repo/show-repo.html ([new](https://github.com/mehrlander/web-tools/blob/main/pages/show-repo/show-repo.html)): drop `x-init="init()"` (Alpine auto-calls `init()`; every boot API call ran twice); same fix in nav-repo
- tools/render/cdn.mjs + screenshot.mjs: own-data API shims (`/repos/<repo>` metadata, `git/trees` from the working tree) and a `--query` flag
- tools/build/pages-shots.mjs: honors `<meta name="shot-query">`, so auth-dependent pages declare a representative thumbnail state
- docs/environment/testing.md ([new](https://github.com/mehrlander/web-tools/blob/main/docs/environment/testing.md)): rewritten as a reference (tool-per-section, render-category table, gotchas; 64% of prior length)

**Notes:** Token-bearing browser path unverified in-session (headless covers the anonymous path; suite 93 passing). The Actions lens (token-holding executor for requests a session can't perform, e.g. delete a branch) is designed in concept but deferred to its own session.

[Session diff](https://github.com/mehrlander/web-tools/compare/main...claude/keen-carson-w36rui)

## 2026-06-12 Index ↔ show-repo convergence; toss-render address mode; ?use= announces itself (PR #173)

The repo's two navigation surfaces grew together: the pages index gained path-transparent chips, shareable filters, and the FAB; show-repo gained a pages view of the browsed repo; embed.html became toss-render.html with a token-safe address mode; and `?use=` pages now badge their ref and auto-mount the FAB.

⭐ **Result:** [pages/index.html](https://mehrlander.github.io/web-tools/pages/) — chips show full locations (`?filter=`/`?q=` deep-link), header links show-repo, FAB mounted

**Changed:**
- tools/build/pages-index.mjs ([new](https://github.com/mehrlander/web-tools/blob/main/tools/build/pages-index.mjs)): path chips with dimmed prefixes, URL state, show-repo link, gh-api boot + FAB on the generated index; `pages/show-repo/index.html` (stale hand-written list) deleted
- lib/alpineComponents/pages.js ([new](https://github.com/mehrlander/web-tools/blob/main/lib/alpineComponents/pages.js)): collapsible Pages section — scans the browsed repo/ref for .html files; thumbnail/live cards, rendered+source links, open-in-viewer
  renders on: [show-repo](https://mehrlander.github.io/web-tools/pages/show-repo/show-repo.html)
- pages/toss-render.html ([new](https://github.com/mehrlander/web-tools/blob/main/pages/toss-render.html)), renamed from embed.html (no redirect): payload modes unchanged (opaque-origin sandbox); new `#gh=owner/repo[@ref]:path` address mode fetches with the stored token and renders same-origin with `<base>` + `?use=` shim, allowlisted to `mehrlander/*` so crafted links can't spend or read the token
- bookmarklets/toss-render.js ([new](https://github.com/mehrlander/web-tools/blob/main/bookmarklets/toss-render.js)), renamed from embed-page.js, retargeted; text also inlined in the page header comment — re-save the 🥏 bookmarklet
- lib/gh-boot.js ([new](https://github.com/mehrlander/web-tools/blob/main/lib/gh-boot.js)): `?use=` shows a corner badge naming the booted ref and auto-mounts the FAB (skipped when the page mounts its own; try/caught)
- lib/alpineComponents/fab.js ([new](https://github.com/mehrlander/web-tools/blob/main/lib/alpineComponents/fab.js)), viewer.js ([new](https://github.com/mehrlander/web-tools/blob/main/lib/alpineComponents/viewer.js)): "Open at ref in toss-render" / "Toss render" links into address mode
- docs/CONVENTIONS.md + CLAUDE.md ([new](https://github.com/mehrlander/web-tools/blob/main/docs/CONVENTIONS.md)): "Show pixels" — send rendered screenshots into chat; `npm run shot` wiring
- tools/test/pages.test.mjs ([new](https://github.com/mehrlander/web-tools/blob/main/tools/test/pages.test.mjs)): 7 jsdom tests for the pages view

**Notes:** toss-render address mode is the repo's first "open page X at ref Y" URL; the FAB Render overlay and show-repo's off-ref page cards route through it. Address mode was unverifiable in-session (API rate limit): first thing to try post-merge. Suite: 93 passing.

[Session diff](https://github.com/mehrlander/web-tools/compare/main...claude/modest-newton-cm6is8)

## 2026-06-11 Import Wring: template-induction kit, demo pages, repo snapshot (PR #172)

Wring (single-document template induction: one document with repeated structure in, recurring templates plus slot values out, losslessly) moves into web-tools as a kit, two demo pages, a test in the npm suite, and a full snapshot of the source repo.

⭐ **Result:** [pages/demos/wring-text.html](https://mehrlander.github.io/web-tools/pages/demos/wring-text.html) (logs/records to templates); the DOM twin is [wring-dom.html](https://mehrlander.github.io/web-tools/pages/demos/wring-dom.html)

**Changed:**
- lib/kits/wring.js ([new](https://github.com/mehrlander/web-tools/blob/main/lib/kits/wring.js), [diff](https://github.com/mehrlander/web-tools/commit/9cba52b)): the engine as a kit (`window.wring`); generated, regenerate via `archive/wring/export/build-kit.mjs`
  renders on: [wring-text](https://mehrlander.github.io/web-tools/pages/demos/wring-text.html), [wring-dom](https://mehrlander.github.io/web-tools/pages/demos/wring-dom.html)
- pages/demos/wring-text.html ([new](https://github.com/mehrlander/web-tools/blob/main/pages/demos/wring-text.html)), pages/demos/wring-dom.html ([new](https://github.com/mehrlander/web-tools/blob/main/pages/demos/wring-dom.html)): the demos, re-plumbed to `gh.load` the kit with `?use=`
- tools/test/wring.test.mjs ([new](https://github.com/mehrlander/web-tools/blob/main/tools/test/wring.test.mjs)): kit invariants on node:test; wring.js also joins kits-register.test.mjs
- archive/wring/ ([tree](https://github.com/mehrlander/web-tools/tree/main/archive/wring), [IMPORT.md](https://github.com/mehrlander/web-tools/blob/main/archive/wring/IMPORT.md)): byte-for-byte snapshot of `mehrlander/wring@23114dc` (source modules, six-harness suite, research record)
- lib/kits/README.md ([new](https://github.com/mehrlander/web-tools/blob/main/lib/kits/README.md), [diff](https://github.com/mehrlander/web-tools/commit/9cba52b)): wring section + salvage-table row

**Notes:** Mid-branch, main's pages reorg and npm-test suite merged in; the wring artifacts were realigned to both (pages into `pages/demos/`, standalone test recast onto node:test). Follow-up outside this repo: tombstone README in `mehrlander/wring`, then archive it on GitHub.

[Session diff](https://github.com/mehrlander/web-tools/compare/main...claude/peaceful-carson-f7ymn5)

## 2026-06-11 Pages index: location-based filter chips + name search; kit demos surfaced (PR #170)

The visual index gained a filter bar (location-based chips plus a name/title search box), and the demo/story pages were reorganized into real folders (`pages/demos/`, `pages/stories/`) so the categories are locations, not name guesses. The kit demos under `lib/kits/demos/` are now pulled into the catalog too.

⭐ **Result:** [pages/index.html](https://mehrlander.github.io/web-tools/pages/): chips scope by location, the search box narrows within the selection (pick `All` for a repo-wide name search)

**Changed:**
- tools/build/pages-index.mjs ([new](https://github.com/mehrlander/web-tools/blob/main/tools/build/pages-index.mjs), [diff](https://github.com/mehrlander/web-tools/commit/f63eeae)): a second source root (`lib/kits/demos/`, the `kit-demos` group), location-based chips from each group's top segment, and the `q` search getter; regenerates `pages/index.html` + `pages/README.md`
- tools/build/pages-shots.mjs ([new](https://github.com/mehrlander/web-tools/blob/main/tools/build/pages-shots.mjs), [diff](https://github.com/mehrlander/web-tools/commit/f63eeae)): same two-source model so kit demos get thumbnails under `pages/thumbs/kit-demos/`
- pages/demos/, pages/stories/ ([tree](https://github.com/mehrlander/web-tools/tree/main/pages/demos)): six demo pages and the bookmarklets story relocated (files + thumbs); FAB `data-path` and inbound links in README/docs/kit-readmes updated to match
- docs/loader.md ([diff](https://github.com/mehrlander/web-tools/commit/f63eeae)): corrected a stale `pages/demos/{persistence,…}` path to the real `lib/kits/demos/`

**Notes:** `scratch/demo-spacex` and `show-repo/demo-viewer` deliberately left in their own folders (they belong to those projects), so they appear under those chips, not `demos`. Demo pages load deps via absolute jsDelivr URLs, so moving them deeper didn't affect loading. Built on PR #170 (the earlier chip-prototype commit is part of the same branch).

[Session diff](https://github.com/mehrlander/web-tools/compare/main...claude/nice-hamilton-z1wj9e)

## 2026-06-11 Branch-guide convention: third spine artifact + prose-style rule (PR #171)

Working branches now carry a live `BRANCH-GUIDE.md` (pushed first thing, accurate per push, folded into this guide and deleted at wrap-up, never landing on main), and the portable conventions gain a no-em-dash prose rule plus a consolidated "Wrapping up & PR creation" section.

⭐ **Result:** [Branch guide section in docs/CONVENTIONS.md](https://github.com/mehrlander/web-tools/blob/main/docs/CONVENTIONS.md#branch-guide)

**Changed:**
- docs/CONVENTIONS.md ([new](https://github.com/mehrlander/web-tools/blob/main/docs/CONVENTIONS.md), [main](https://github.com/mehrlander/web-tools/blob/c6cfa35/docs/CONVENTIONS.md), [diff](https://github.com/mehrlander/web-tools/commit/8775a57)): three-artifact surfacing spine, Branch guide section, branch-guide-enforcement extension point, wrap-up rewrite; prose-style rule and em-dash removal in [626bbb9](https://github.com/mehrlander/web-tools/commit/626bbb9)
- CLAUDE.md ([new](https://github.com/mehrlander/web-tools/blob/main/CLAUDE.md), [main](https://github.com/mehrlander/web-tools/blob/c6cfa35/CLAUDE.md), [diff](https://github.com/mehrlander/web-tools/commit/8775a57)): answers the new extension point (enforcement: none yet)
- docs/MERGE-GUIDE.md ([new](https://github.com/mehrlander/web-tools/blob/main/docs/MERGE-GUIDE.md), [diff](https://github.com/mehrlander/web-tools/commit/8775a57)): header pointer fixed (convention lives in CONVENTIONS.md); this entry

**Notes:** The session dogfooded the convention; its own branch guide folded into this entry. Enforcement deferred until a guide actually leaks to main (then: hook nag or CI guard). Pre-existing em dashes in older merge-guide entries left as written.

[Session diff](https://github.com/mehrlander/web-tools/compare/main...claude/trusting-volta-wsl8nh)

## 2026-06-11 npm test: kit + Alpine-component suite; persistence deadlock fix (PR #169)

The repo's first automated test suite — 76 tests on Node's built-in runner, offline via npm-vendored libs — and its first run caught a real bug: `kits/persistence.js` could deadlock IndexedDB version upgrades.

⭐ **Result:** [tools/test/bootstrap.mjs](https://github.com/mehrlander/web-tools/blob/main/tools/test/bootstrap.mjs) — run it all with `npm test`

**Changed:**
- tools/test/ ([new](https://github.com/mehrlander/web-tools/tree/main/tools/test), [diff](https://github.com/mehrlander/web-tools/commit/d4b042da70c61d138bb7af83d3f743fdb69875e7)) — bootstrap.mjs (the jsdom+Alpine bootstrap testing.md had flagged "not yet built", plus `loadKit()` with CDN-import→npm rewrites) and 7 suites: compression, persistence, messaging, wsl-core, kit-registration smoke, counter, sheet-modal
- lib/kits/persistence.js ([new](https://github.com/mehrlander/web-tools/blob/main/lib/kits/persistence.js), [main](https://github.com/mehrlander/web-tools/blob/2731a43/lib/kits/persistence.js), [diff](https://github.com/mehrlander/web-tools/commit/d4b042da70c61d138bb7af83d3f743fdb69875e7)) — cached connections now yield to `versionchange`; previously a second store on the same db (or another tool's upgrade) blocked the version bump forever
  renders on: [data-shelf](https://mehrlander.github.io/web-tools/popups/data-shelf.html), [idb-nav](https://mehrlander.github.io/web-tools/popups/idb-nav.html), [persistence demo](https://mehrlander.github.io/web-tools/lib/kits/demos/persistence.html)
- docs/environment/testing.md ([new](https://github.com/mehrlander/web-tools/blob/main/docs/environment/testing.md), [diff](https://github.com/mehrlander/web-tools/commit/d4b042da70c61d138bb7af83d3f743fdb69875e7)) — follow-up note replaced with the built bootstrap + two new gotchas (Alpine ESM entry, global rAF)
- tools/README.md ([new](https://github.com/mehrlander/web-tools/blob/main/tools/README.md), [diff](https://github.com/mehrlander/web-tools/commit/d4b042da70c61d138bb7af83d3f743fdb69875e7)), package.json ([diff](https://github.com/mehrlander/web-tools/commit/d4b042da70c61d138bb7af83d3f743fdb69875e7)) — `test/` documented; `test` script + brotli-wasm/acorn devDeps
- dist/web-tools.js — hook-regenerated (persistence fix rides into the pre-build)

**Notes:** Also audited the issue backlog: #133/#137/#138/#139 were all already fixed in main, just never closed.

[Session diff](https://github.com/mehrlander/web-tools/compare/main...claude/stoic-volta-xnpbvh)

## 2026-06-11 WSL closeout: docs synced to kits, monthly fetch cron (PR #166)

Closed out the WSL arc: the folder's docs now describe the kit/snapshot architecture #162 actually shipped, and the fetch Action gained its planned monthly cron.

⭐ **Result:** [pages/wsl-sync/README.md](https://github.com/mehrlander/web-tools/blob/main/pages/wsl-sync/README.md) — the rewritten front-door doc

**Changed:**
- pages/wsl-sync/README.md ([new](https://github.com/mehrlander/web-tools/blob/main/pages/wsl-sync/README.md), [main](https://github.com/mehrlander/web-tools/blob/0379536/pages/wsl-sync/README.md), [diff](https://github.com/mehrlander/web-tools/commit/5235ceb)) — rewritten around the wsl-core/wsl kits and the committed snapshot as source of truth; obsolete IDB seed snippet dropped; fast-xml-parser 4.5.1 pin rationale recorded (audit advisory is XMLBuilder-only, unused here)
- .github/workflows/wsl-fetch.yml ([new](https://github.com/mehrlander/web-tools/blob/main/.github/workflows/wsl-fetch.yml), [main](https://github.com/mehrlander/web-tools/blob/0379536/.github/workflows/wsl-fetch.yml), [diff](https://github.com/mehrlander/web-tools/commit/8beb91e)) — monthly cron, `--full` on the open biennium; the meta.json-only guard keeps quiet months commit-free
- pages/wsl-sync/fetch-data.mjs ([new](https://github.com/mehrlander/web-tools/blob/main/pages/wsl-sync/fetch-data.mjs), [diff](https://github.com/mehrlander/web-tools/commit/5235ceb)) — header comment now matches the `new Function` + `makeParsers` injection it actually does
- pages/wsl-sync/IMPORT.md, .gitignore ([diff](https://github.com/mehrlander/web-tools/commit/5235ceb)) — #162 restructure noted as provenance history; dead `.wsl-api.node.mjs` ignore dropped

**Notes:** Docs plus the cron; no page runtime touched. Also adds the retroactive #160/#161 entry below. Deferred deliberately: the wsl-sync real-browser thumbnail pass and the fast-xml-parser v5 bump (rationale now in the README).

[Session diff](https://github.com/mehrlander/web-tools/compare/main...claude/festive-mendel-ojely2)

## 2026-06-11 embed payload moves to the URL fragment (PR #165)

Fixes the bookmarklet's "URL too long" failure on real-sized files: the payload now rides in the `#fragment`, which never reaches the server, so GitHub Pages' ~8KB edge cap (Fastly 414s longer query strings) no longer applies — the bound becomes the browser's own ~2MB. Follow-up to #164.

⭐ **Result:** [embed.html#gz=…](https://mehrlander.github.io/web-tools/pages/embed.html#gz=H4sIAAAAAAAAAyXHOw7DIAwA0Ku42aMkK6HMHdKlSg9AwcGW-ERgRaKn79C3PX3zxUk_EUhSNFpYIprwBY-p6Olf_Sm-Q5Me8T4cJct42MSxq1Ryaad1uHpuZ7Rdhcp-PaN1OLJgasphFqwrIQcStczzRYPRtJiduMFjf24g1V4Y0QPnxh5BCOH92uCoNiTMoidazA9QuvH2qQAAAA) — same demo, now fragment-borne

**Changed:**
- pages/embed.html ([new](https://github.com/mehrlander/web-tools/blob/main/pages/embed.html), [diff](https://github.com/mehrlander/web-tools/commit/9d2ede1)) — reads `#params` first with `?query` back-compat; reloads on `hashchange` (fragment-only navigation is same-document, so the boot script wouldn't otherwise re-run when following a second embed link).
- bookmarklets/embed-page.js ([new](https://github.com/mehrlander/web-tools/blob/main/bookmarklets/embed-page.js), [diff](https://github.com/mehrlander/web-tools/commit/9d2ede1)) — emits `#gz=`.
  renders on: [embed](https://mehrlander.github.io/web-tools/pages/embed.html)
- README.md ([new](https://github.com/mehrlander/web-tools/blob/main/README.md#bookmarklets), [diff](https://github.com/mehrlander/web-tools/commit/9d2ede1))

**Notes:** Verified headlessly up to 724KB of HTML (310KB fragment). Re-installing the bookmarklet is required — the old copy still emits `?gz=`.

[Session diff](https://github.com/mehrlander/web-tools/compare/main...claude/peaceful-lovelace-ga5wj4)

## 2026-06-10 embed-page bookmarklet + inline-HTML modes (PR #164)

From any github.com blob page, one bookmarklet click renders that file as live HTML: the file's content travels gzipped inside the URL to embed.html's new `?gz=` mode. Follow-up to #163.

⭐ **Result:** [embed.html?gz=…](https://mehrlander.github.io/web-tools/pages/embed.html?gz=H4sIAAAAAAAAAyXHOw6DMAwA0Ku47AhYQ5q5A10qeoA0MdhSfkospPT0Hfq2p28-O-kFgSQGo4UloDm_4DFmPf2rP9l3aNID3ocjJxkPGzl0FXPKrViHq-dWgu3qrOzXEqzDkQVjUw6TYF0J-SRRyzxfNBhNi9mJGzz25wZS7YUBPXBq7BGEEN6vTU-0mB-RNkyHoAAAAA) — a demo page unpacked from the URL itself

**Changed:**
- bookmarklets/embed-page.js ([new](https://github.com/mehrlander/web-tools/blob/main/bookmarklets/embed-page.js), [diff](https://github.com/mehrlander/web-tools/commit/673b5e3)) — reads the file text from the blob page's own DOM (private repos work), stamps a jsDelivr `<base>` for relative assets, gzips, navigates.
  renders on: [embed](https://mehrlander.github.io/web-tools/pages/embed.html)
- pages/embed.html ([new](https://github.com/mehrlander/web-tools/blob/main/pages/embed.html), [main](https://github.com/mehrlander/web-tools/blob/84bb12c/pages/embed.html), [diff](https://github.com/mehrlander/web-tools/commit/673b5e3)) — adds `?gz=` (base64url gzipped HTML) and `?html=` (base64 HTML) srcdoc modes alongside `?url=`.
- README.md ([new](https://github.com/mehrlander/web-tools/blob/main/README.md#bookmarklets), [diff](https://github.com/mehrlander/web-tools/commit/673b5e3)) — bookmarklet listed.

**Notes:** Inline modes render in a sandboxed iframe (`allow-scripts`, no `allow-same-origin`) so URL-borne HTML can't touch this origin's localStorage (gh token). Encoding the blob *URL* instead wouldn't render — github.com refuses framing and raw/jsDelivr serve HTML as `text/plain` — hence content-in-URL. Practical bound: very large files brush Chrome's ~2MB URL limit.

[Session diff](https://github.com/mehrlander/web-tools/compare/main...claude/peaceful-lovelace-ga5wj4)

## 2026-06-10 embed.html: iframe a base64-encoded URL (PR #163)

New page that takes `?url=<base64 URL>` and renders it in a full-viewport iframe — the iframe is the page.

⭐ **Result:** [embed.html?url=…](https://mehrlander.github.io/web-tools/pages/embed.html?url=aHR0cHM6Ly9leGFtcGxlLmNvbQ==) — example.com in the frame

**Changed:**
- pages/embed.html ([new](https://github.com/mehrlander/web-tools/blob/main/pages/embed.html), [diff](https://github.com/mehrlander/web-tools/commit/fcc3dda))
- pages/thumbs/embed.png ([new](https://github.com/mehrlander/web-tools/blob/main/pages/thumbs/embed.png), [diff](https://github.com/mehrlander/web-tools/commit/9d859f9))

**Notes:** Accepts standard or URL-safe base64, http(s) only; sites sending `X-Frame-Options`/`frame-ancestors` refuse to load — remote server's choice.

[Session diff](https://github.com/mehrlander/web-tools/compare/84bb12c...9d859f9)

## 2026-06-10 WSL Sync on gh.load kits + Alpine + JSON snapshot (PR #162)

Rebuilt both WSL Sync pages on the repo's standard rails — committed JSON snapshot as the data source, Alpine (jQuery dropped), and the gh-api/`gh.load` kit chain — with one WSL core shared by the pages and the Node fetch Action.

⭐ **Result:** [pension-dash](https://mehrlander.github.io/web-tools/pages/wsl-sync/pension-dash.html) — 52 pension clusters from the snapshot

**Changed:**
- lib/kits/wsl-core.js ([new](https://github.com/mehrlander/web-tools/blob/main/lib/kits/wsl-core.js), [diff](https://github.com/mehrlander/web-tools/commit/1d4fbd5)) — dependency-free core: parsers as a `makeParsers({ XMLParser, flatten })` factory + classify + list/group helpers (pension-map folded in). Same file runs in the browser (`gh.load`) and Node (`new Function`).
  renders on: [wsl-sync](https://mehrlander.github.io/web-tools/pages/wsl-sync/wsl-sync.html), [pension-dash](https://mehrlander.github.io/web-tools/pages/wsl-sync/pension-dash.html)
- lib/kits/wsl.js ([new](https://github.com/mehrlander/web-tools/blob/main/lib/kits/wsl.js), [diff](https://github.com/mehrlander/web-tools/commit/1d4fbd5)) — browser kit: registers `window.wsl` (lazy parsers, fetch helpers, snapshot loader, RCW display utilities).
  renders on: [wsl-sync](https://mehrlander.github.io/web-tools/pages/wsl-sync/wsl-sync.html), [pension-dash](https://mehrlander.github.io/web-tools/pages/wsl-sync/pension-dash.html)
- pages/wsl-sync/wsl-sync.html ([new](https://github.com/mehrlander/web-tools/blob/main/pages/wsl-sync/wsl-sync.html), [diff](https://github.com/mehrlander/web-tools/commit/1d4fbd5)), pension-dash.html ([new](https://github.com/mehrlander/web-tools/blob/main/pages/wsl-sync/pension-dash.html), [diff](https://github.com/mehrlander/web-tools/commit/1d4fbd5)) — boot gh-api, `gh.load` the kit + alpine-bundle, drive Alpine off `window.wsl`.
- pages/wsl-sync/fetch-data.mjs ([new](https://github.com/mehrlander/web-tools/blob/main/pages/wsl-sync/fetch-data.mjs), [diff](https://github.com/mehrlander/web-tools/commit/1d4fbd5)) — runs `wsl-core` via `new Function` + npm XML libs; the source-rewrite hack is gone.
- removed pages/wsl-sync/{wsl-api,pension-map,wsl-data}.js (folded into the kits)

**Notes:** Lazy parsers mean snapshot-only pension-dash never loads fast-xml-parser, so it renders fully headless (0 console errors). wsl-sync's grid (Tabulator) can't paint under the headless renderer — its thumb is chrome-only and a real-browser grid pass is still pending.

[Session diff](https://github.com/mehrlander/web-tools/compare/main...claude/wsl-sync-json-alpine-xh7m89)

## 2026-06-10 WSL data pipeline: fetch Action + first snapshots (PRs #160 & #161)

Added the GitHub Actions path for WSL bill data — public-repo runners have the egress to `wslwebservices.leg.wa.gov` that the sandbox lacks — and hardened it through live runs that committed the first snapshots.

⭐ **Result:** [WSL fetch workflow](https://github.com/mehrlander/web-tools/actions/workflows/wsl-fetch.yml) — dispatch from the Actions tab; the snapshot commits to `data/<biennium>/`

**Changed:**
- .github/workflows/wsl-fetch.yml ([new](https://github.com/mehrlander/web-tools/blob/main/.github/workflows/wsl-fetch.yml), [diff](https://github.com/mehrlander/web-tools/commit/bda895a)) — #160 added it (manual dispatch); #161 made it install from package.json ([diff](https://github.com/mehrlander/web-tools/commit/b7d8db2)) and default to fetch-all ([diff](https://github.com/mehrlander/web-tools/commit/1f64117))
- pages/wsl-sync/fetch-data.mjs ([new](https://github.com/mehrlander/web-tools/blob/main/pages/wsl-sync/fetch-data.mjs), [diff](https://github.com/mehrlander/web-tools/commit/578ef12)) — parameterized by biennium; each biennium archives to its own `data/<biennium>/`
- pages/wsl-sync/data/2025-26/ ([new](https://github.com/mehrlander/web-tools/tree/main/pages/wsl-sync/data/2025-26), [diff](https://github.com/mehrlander/web-tools/commit/ad7f5f6)) — snapshots from real Action runs; the final full 4,691-bill snapshot rode in on #162's branch ([f7e1ffd](https://github.com/mehrlander/web-tools/commit/f7e1ffd))

**Notes:** Two PRs, one arc: #160 the workflow, #161 the parameterization and smoke-tested runs. *(Entry written retroactively 2026-06-11.)*

[Session diff](https://github.com/mehrlander/web-tools/compare/54bdfb7...2e0fb65)

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
