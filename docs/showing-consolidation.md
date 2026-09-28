# Showing consolidation: one public address

A plan, drafted 2026-09-27 and revised 2026-09-28 after a second round of probes, to make the 🥏 toss the only link a person or an assistant writes to show something other than the deployed page. Today the writer chooses among the `?use=` lib pin, three toss shapes and a nested toss by reasoning about page HTML, library loading, the renderer around the page and which document is on top. [showing.md](showing.md) explains why those boundaries exist; this document proposes which of them the writer should stop seeing, how the machinery should choose for them, and how to get there. When stage S6 lands, the parts still true move into showing.md and this file is retired.

Every finding below carries one of three labels:

- **Measured**: observed in headless Chromium through the render harness. The harness answers every ref from the working tree, so these results establish which ref each request *asked for*, not what GitHub would have returned for it.
- **Read**: concluded from the code and not run.
- **Device**: needs Safari on an iPhone, and is set up as a probe that runs from Pages after merge.

## The verdict, revised

One public address is achievable. The first round's shape holds: the fragment names the content at a ref, `?lib=` names the web-tools code that displays it, and `?use=` becomes an internal lib pin. The second round changes three recommendations.

1. **The renderer should be able to run a trusted page as the top-level document**, by replacing itself with the fetched page instead of framing it. Measured in Chromium: the page gets its own title, its own FAB booted at the addressed ref, and its history, with no shell pin and no frame. That covers most of what `?use=` on a deployed page exists for, and the FAB-at-a-branch case that nothing covers today. It is gated on the iPhone (E1, E6) and on moving the address out of the query (E7).
2. **The app should mount framed views with the renderer's code, not through a second renderer document.** Measured: an app view is three documents deep, the middle one reads about 775 KB of library code for a FAB that declines to mount, and it drops the app's ref, so the app at a branch shows its views at main.
3. **Version honesty needs a check that reads what ran, not what was asked.** Measured: neither the FAB's ignored-version warning nor its layer strip notices a framed page booted at the wrong ref. The evidence a real check needs is already recorded in every framed document.

## What each document runs, measured

`tools/test/showing-version-map.mjs` (experiment E5) renders twelve addresses and attributes every own-code request to the document that made it. Depth 0 is the toss host, depth 1 the framed page, and deeper numbers nested frames. The host boots main in every case, by design. The addressed ref is `probe-ref`.

| Case | Address | Lib each framed document booted | Verdict |
|---|---|---|---|
| C1 | web-tools page on the `entry.js` chain | d1 `probe-ref` | as meant |
| C2 | the same page, no `@ref` | d1 main | as meant |
| C3 | pre-build page (`inquiry.html`) | d1 `dist/web-tools.js` at `probe-ref` | as meant |
| C4 | the whole app | d1 `dist/app.js` at `probe-ref`; `.web-tools.json`, `README.md` and the board read at main, `pages.csv` at `probe-ref` | code as meant, data mixed |
| C5 | the app, with an app view open | d1 `probe-ref`; d2 is the deployed `toss-render`; d3 is the page at main with lib main | **wrong: the view runs main** |
| C6 | `#data=` route | viewer and lib main, content at `probe-ref` | as meant |
| C7 | nested toss | d1 and d2 `probe-ref` | as meant |
| C8 | home page pinning `entry.js?ref=main` | d1 main | as meant |
| C9 | shortcut-tools page, plain `entry.js` import | d1 `probe-ref`, a shortcut-tools branch name used as a web-tools ref | **wrong** |
| C10 | `repo-atlas.html?ref=feature` | d1 `feature` | **wrong** |
| C11 | relative `<img>`, CSS `url()`, `import()`, `<iframe src>` | all four from the deployed site; the `fetch()`, the `<link>` and the `<script src>` at `probe-ref` | **wrong for four kinds** |
| C12 | the ref switcher's shape, `?use=` on the shell | host and page `probe-ref` | as meant, but this is the shape that crashes the iPhone |

`tools/test/toss-lib-ref.test.mjs` (E2) holds C9 and C10 in the suite as `todo`, together with an unrelated `new URLSearchParams('a=1').get('use')` answering the addressed ref. Both come from two facts: the params shim patches `URLSearchParams.prototype` for every instance, and it injects `use` whatever the subject repo is.

**`lib/entry.js` always comes from the deployed site.** Every document in every case requested it from GitHub Pages (measured). No link can preview a change to it before merge.

## Combinations of change, and what reaches each

| What changed | Today's route | Faithful today? | Proposed route | Evidence |
|---|---|---|---|---|
| A web-tools page file only | toss | yes | toss | measured (C1) |
| `lib/` only | ⭐ `?use=` on the deployed page | yes | toss; top mode when top-level behaviour matters | measured (C1, E6) |
| Page file and `lib/` | toss | yes, except the host's FAB | toss | measured (C1) |
| The FAB (`lib/alpineComponents/fab.js`) | `?use=` on a deployed page, only when the page file is unchanged | partly | top mode: the page's own FAB boots at the ref | measured in Chromium (E6); device pending |
| `pages/toss-render.html` internals | nested toss | yes | nested toss, until the renderer's code moves into a kit (S4), then any view at the ref | measured (C7) |
| The renderer's top-level behaviour (its title, icon, history, its own boot) | none | no | none until S4; after it, only the thin host page stays unpreviewable | read |
| `lib/entry.js` | none | no | the renderer could fetch `entry.js` at the ref and blob-import it in top mode | measured (every case), option read |
| `lib/gh-api.js` on the native route | none: a pinned preview always takes the blob route | no | same; E1 says whether the route matters | read, device |
| A viewer page (`data-view`, `pdf-inspect`) | nested toss, or a hand-built `?src=` | yes, awkwardly | `?lib=<ref>` | measured (C6), proposed |
| A cross-repo page plus `lib/` | the page's own `?lib=`, where it has one | only where the page implements it | `?lib=<ref>` on the address | measured (C8, C9) |
| Relative images, CSS `url()`, `import()`, `<iframe src>` | none | no, and absent for a private repo | extend the inliner and fetch shim, or rewrite to blob URLs | measured (C11) |
| The app's own manifest (`.web-tools.json`) | none | no: the app at a branch reads it at main | decide whether the app's config follows the app's ref | measured (C4) |
| Pages-level files: a 404 fallback, `.nojekyll`, the touch icon, headers, caching | none | no | none: deploy only | read |
| Home-screen web app behaviour | none | no | none: deploy and device only | read |

## What needs the top-level document

| Concern | Browser requirement or current choice | Evidence | Proposal |
|---|---|---|---|
| Permission-policy features (clipboard, fullscreen, geolocation and so on) | Neither: a same-origin frame inherits the top level's 77 features | measured, Chromium | none needed |
| Tab title and icon | Browser | measured: top mode gives the page its own | top mode; in frame mode keep the relay |
| Address bar and history | Browser for the address bar; swallowing the frame's writes is a choice | measured: in top mode a view switch lands in the address once `<base>` is corrected for; the reload then hit the next row's defect | top mode; in frame mode map writes into the host address |
| FAB at a ref | Choice: the host owns the only FAB | measured: in top mode the page's own FAB mounts at the ref and reports it | top mode |
| `location.protocol` and `location.href` | Browser: a framed document is `blob:` | measured | top mode, or accept it |
| Pages' query read as a whole (`location.search`, or iterating a `URLSearchParams` built from it) | Choice of where the address lives | measured: the app wrote the renderer's `?gh=` back into its own query and the address nested on reload | move the address into the path (E7) |
| Viewport, keyboard, safe areas, home-screen mode on iOS | Browser | device | top mode |
| Top-level navigation | Choice (sandbox) | read | `__tossLeave` in frame mode; native in top mode |

**Top mode, as probed.** `pages/scratch/toss-top-probe.html` (E6) fetches the page at the ref, adds the same `<base>`, ref and params shim a toss adds, and calls `document.open`, `write` and `close`. The document keeps the renderer's URL, so a reload renders again at the same ref. Two corrections were needed, and both are in the probe:

- A relative `history.replaceState` resolves against the `<base>`. That URL is same-origin and points at the deployed page, so a reload would silently show main. The probe's history shim folds the page's query into the address and keeps the fragment as the page's own.
- The lib ref follows stage S1's rule: `use` is injected for web-tools pages only, and every other repo's page gets main. Measured: the shortcut-tools page booted main.

**What top mode gives up.** It has no forced width, since `?w=` needs a frame. It has no host-only actions, such as Link and re-address in place. It cannot render payloads, since `#gz=` must stay opaque. It also exposes the address to any page that reads its whole query, which is the nesting failure measured above. A **path address** avoids that: the site's 404 page as the renderer, with the address carried in the path, as in `https://mehrlander.github.io/web-tools/show/<owner>/<repo>@<ref>/<path>?<page query>#<page fragment>`. The page then owns its query and its fragment exactly as it would when deployed. The site has no 404 page today. Whether GitHub Pages serves it for such a path, and whether iOS behaves, needs a deploy (E7).

**Selecting the path internally.** With top mode available, the renderer chooses; the reader never does. Payloads and `?w=` renders use a frame. A web-tools page or viewer uses top mode, once E1 and E6 pass on the iPhone. A cross-repo page uses top mode too, since the access boundary is the same origin either way; its relative assets are broken in both modes until C11 is fixed. The redirect to a deployed `?use=` page proposed in round one is withdrawn: top mode reaches everything it reached without depending on the deployed page file equalling the ref's copy.

## One rendering kit, and no middle document

Today the renderer's code lives inline in `pages/toss-render.html`, and the web-tools app reaches it only by framing that page. The budget-drs app in `mehrlander/home` carries its own copy.

**Measured (C5), an app view costs:**

- three documents;
- a middle document that reads about 775 KB of own code, including the 446 KB `fab.js`, for a FAB that declines to mount because it is framed;
- the app's ref, which the middle document drops. The app at `probe-ref` framed its view at main.

**Proposal.** Move the render steps into one kit, `lib/kits/render.js`: fetch at a ref, inline relative dependencies, add the prelude, mount into a frame or replace the document, and announce the subject. Three consumers take it: the thin `toss-render.html`, the web-tools app, and the budget-drs app. The layers become host, then page.

- **Navigation.** The kit takes `navigate` and `leave` callbacks from its host instead of defining window globals.
- **History.** The kit maps the page's history writes into its host's address scheme. For the toss that is the address; for the app it is `?view=app&appRepo=…`.
- **FAB ownership.** Unchanged: the host owns the only FAB and adopts the kit's subject. The layer strip loses the middle row.
- **Access boundaries.** They move into the kit, so no consumer can skip them: the owner allowlist for same-origin renders, the opaque sandbox for payloads, and top mode for trusted addresses only.
- **Versions.** The kit loads at its host's ref. An app at a branch therefore renders with the branch's renderer, which makes renderer changes previewable without nesting.
- **Cost.** The toss host gives up its "no fetch before first render" property unless the build inlines the kit into the page. The commit hook already builds `dist/`, so an inlined copy is a derived artifact rather than a hand copy.

## Detecting a plausible preview of the wrong version

**The existing checks miss every wrong case above.**

- The FAB's `ignoredUse` returns nothing whenever `viaToss` is set (measured: C9 and C10 both show `ignoredUse: null`).
- The layer strip takes each layer's ref from the address's `?use=` or from the announced subject (read, `readLayers`). It reports what was asked, never what ran.

**Evidence a reliable check can read, all of it already in reach of the host's FAB, because address-mode frames are same-origin:**

1. **Each document's booted lib ref**, `window.gh.ref`, compared with the rule for that document: the content's ref for a web-tools page, main for any other page or a viewer, and `?lib=` when given. This alone catches C5, C9 and C10 (measured, as the probe's verdict column).
2. **Each loaded file's git blob sha.** `gh-boot` records one per file in `window.__ghFiles`, and a pre-built bundle stamps `build:<ref>`. One `git/trees/<commit>?recursive=1` read per view checks them all. Every framed document that booted the library carried shas (measured: 10 to 75 files each), and the harness now serves real blob shas so the check can be tested here. This catches a stale cache or a branch that moved during a load.
3. **Files a framed document took from the deployed site**, from Resource Timing: anything under the Pages origin other than `entry.js`, and other than `gh-api.js` when the ref is main. This catches C11 and the deployed middle renderer in C5 (measured, the probe's DEPLOYED lines).
4. **One commit for the whole view.** Resolve a branch name to its commit once, at open, and pin every document to it. The app already does this for its bundle. Without it, a push landing during a load can split one view across two commits, and no single check can tell which half is which.

## Stages, revised

| Stage | Change | Done when |
|---|---|---|
| S1 | Correctness with no new surface. Inject `use` only for web-tools subjects and stamp `__lib` otherwise. Give `entry.js` the precedence `?ref`, `__lib`, `use`, `main`. Scope the params shim to the page address. Pass the app's ref to web-tools views (`appViewUrl`). Stop `ref-switch.js` pinning the shell. Drop the redundant `?use=` in `map.js`. | Every `todo` in `toss-lib-ref.test.mjs` passes without its marker; the version map reports no WRONG line for C5, C9 or C10. |
| S2 | The version check in the FAB: evidence 1 and 3 first, then 2 and 4. | The version map's WRONG and DEPLOYED lines appear in the FAB on a headless shot of the same cases. |
| S3 | Dispatch by kind in the renderer, and `?lib=` forwarded to viewers and nested frames. | Headless shots of `.md`, `.csv` and `.pdf` addresses show their viewers; `?lib=` reaches a viewer change. |
| S4 | The render kit, consumed by the toss host and both apps. | An app view is two documents; the version map's C5 runs the app's ref. |
| S5 | Top mode behind the kit, selected internally, after E1, E6 and E7. | A FAB change at a branch previews through the one public address on the iPhone. |
| S6 | One generator and the documents. `showing.py` emits one address shape; Map, Showing tab drops to one public row; `showing.md` and `loader.md` rewritten; direct `?use=` links flagged by the S2 check rather than removed. | `showing-pick.test.mjs` asserts no generator emits a public `?use=`. |

## Experiments

| Id | Question | Status |
|---|---|---|
| E1 | Which variable kills Safari's web process under a pinned shell: the blob import, the shell's ref, the frame, or the revoke? | Device. `pages/scratch/shell-pin-probe.html`, cells A to G, after merge. Cell D must die for the replica to count. |
| E2 | Which ref a tossed page's library boots | Done, measured in jsdom; three defects held as `todo`. |
| E3 | Whether history writes from a framed `blob:` document can reach the host's address in Safari | Open; needed only for frame mode after S4. |
| E4 | What resolving a view to one commit costs on a phone | Open. |
| E5 | Which ref every document asks for, in twelve cases | Done, measured in Chromium (`tools/test/showing-version-map.mjs`). |
| E6 | Top mode: title, FAB, history and lib ref when the page replaces the renderer | Chromium done (`tools/test/toss-top-probe.mjs`). iPhone pending: cells H (page at a SHA, no frame) and I (the app with a view framed) in the same device matrix. |
| E7 | Whether a 404-page renderer on GitHub Pages serves a path address, and what iOS does with it | Needs a deploy. |

## Harness notes found on the way

- **A stale local `main` misreports `?ref=main`.** The harness reads non-code files at a named ref from git, and a fresh checkout's local `main` can trail `origin/main`. In this session it trailed by 266 commits, and C6 first showed a `data-view.html` from before `entry.js` existed. Refresh local `main` before a version-sensitive shot.
- **Real blob shas.** The harness served `sha: 'local'` for every file, so any check built on `__ghFiles` could not be tested headlessly. It now serves the git blob sha of the bytes it returns, and it honors the sha media type on `commits/<ref>`.

## Where a link can still show something plausible and wrong

- Everything the version map marks WRONG or DEPLOYED, until S1 and the C11 work land.
- The app at a branch reading its own configuration at main (C4).
- A direct `?use=` link still in circulation, whose page file is main's, until the S2 check flags it.
- A preview of a change to `lib/entry.js`, the renderer's top-level behaviour, or anything at the Pages level, which no link reaches before deploy. Say so and send a headless screenshot.
