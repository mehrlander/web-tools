# Showing consolidation: one public address

A plan, drafted 2026-09-27, to make the 🥏 toss the only link a person or an assistant writes to show something other than the deployed page. Today the writer chooses among the `?use=` lib pin, three toss shapes and a nested toss by reasoning about page HTML, library loading, the renderer around the page and which document is on top. [showing.md](showing.md) explains why those boundaries exist; this document proposes which of them the writer should stop seeing, and how to get there. The stages below are marked as they land, and when stage S5 lands the parts still true move into showing.md and this file is retired.

## The verdict

Removing the choice from ordinary use is achievable, and the toss already does most of it. When `pages/toss-render.html` frames a page, its params shim answers the framed page's lookup of `use` with the addressed `@ref`, and [`lib/entry.js`](../lib/entry.js) reads that value to pin the page's library. So `?use=` is already an internal operation of the toss for web-tools pages. What stands between that and one public address is three things: two defects in how the ref is handed down, the code the shell itself contributes (the FAB and Alpine, always from main), and the behaviour only a top-level document has. The first is small, the second needs one device experiment, and the third needs an explicit host-to-frame channel plus an internal top-level route for the cases the channel cannot reach.

## What the code does, checked 2026-09-27

1. **The toss hands the framed page its lib ref through the `URLSearchParams` prototype.** `addressHtml` injects `use=<ref>` and every page-query key, and patches `URLSearchParams.prototype.get` and `.has` to answer them. `entry.js` resolves its ref as `?ref=` on its own import URL, then `use`, then `main`.
2. **That injection is wrong for a repo other than web-tools.** The shim injects `use=<ref>` whatever the subject repo is, and `entry.js` reads it as a web-tools ref. A page that imports `entry.js` with no `?ref=`, such as `shortcut-tools/pages/library.html`, tossed at a branch, boots web-tools at that branch name: a 404 on raw, or, where both repos carry a branch of that name, the wrong web-tools branch with no error. The budget-drs pages in `mehrlander/home` avoid it only because they import `entry.js?ref=${lib}`.
3. **The patch answers every `URLSearchParams` in the frame, not only the page address.** `entry.js` builds one from its own import URL, so a page query carrying `ref` re-pins the library: `#gh=…@claude/x:pages/repo-atlas.html?ref=feature` boots the library at `feature`. `repo-atlas.html`, `shortcuts.html` and `shortcut-edit.html` read a `ref` query of their own. An unrelated `new URLSearchParams('a=1').get('use')` also answers the subject ref.
4. **The generators disagree about the prohibited link.** [`scripts/showing.py`](../scripts/showing.py) never puts `?use=` on the shell, held by `showing-pick.test.mjs`, because that shape kills Safari's web process on an iPhone (SNAGS, `shell-pin-kills-the-tab`). The app header's ref switcher, `lib/alpineComponents/ref-switch.js` `rideUrl`, mints exactly that shape, `toss-render.html?use=<ref>#gh=…@<ref>:…`, and `tools/test/ref-switch.test.mjs` asserts it.
5. **The iPhone record predates the current loader.** The 2026-09-08 matrix compared an unpinned shell importing its modules natively from jsDelivr with a pinned shell that blob-imported `gh-api.js` from raw and read the rest through the contents API. Since 2026-09-26 both routes read everything after `gh-api.js` through the contents API. The delivery differences left are how `gh-api.js` arrives and which ref the shell's `gh` names, which the FAB reads as `loaderRef`. No cell ever ran the blob route at main.
6. **`?use=` has three implementations.** The `entry.js` chain; a pre-build blob boot copied into `approve`, `branch`, `dictate`, `inquiry`, `probe-snap`, `review` and `session`; and `app/index.html`'s own `dist/app.js` boot. They disagree on `?use=main`: `entry.js` takes the native import, the app takes the blob route.
7. **`#gh=` renders every file as HTML.** Dispatch by kind lives in [`routes-kinds.csv`](routes-kinds.csv) and in the FAB's path picker, not in the renderer, so a `#gh=` link to a `.md` file mounts the markdown text as a page.
8. **There are two embedders.** The web-tools app frames a promoted page through `toss-render` (`appViewUrl`). The budget-drs app in `mehrlander/home` carries its own copy of the fetch and the inliner, and that copy is the path with the recorded empty-pane failure.

Findings 2 and 3 are measured, by [`tools/test/toss-lib-ref.test.mjs`](../tools/test/toss-lib-ref.test.mjs); the rest are read from the code.

## The contract

The fragment says what to show. The query says how. The host is always `pages/toss-render.html` on main.

| Part | Form | Meaning |
|---|---|---|
| Repository content | `#gh=owner/repo[@ref]:path[?q][#f]` | A file at a branch, tag or SHA. Private repos resolve on the viewer's token; the owner allowlist stays. |
| Inline content | `#gz=<base64url>[#f]` | Rendered sandboxed under an opaque origin, as today. |
| Viewer override | `#data=`, `#pdf=`, `#chat-results=`, `#shorter=` | Kept, and demoted to an override: by default `#gh=` picks the viewer from `routes-kinds.csv`. |
| Display code | `?lib=<ref>` | The web-tools ref for the framed page's library and for the viewer page. Default: the content's `@ref` when the subject is web-tools, `main` otherwise. |
| Layout | `?w=<px>` | Unchanged. |

`@ref` selects content and `?lib=` selects the code that displays it, which keeps the two questions apart. The word is already in use for exactly this meaning: a home page takes `?lib=` because its own ref names something else. On the host, `?lib=` is **forwarded, never applied to the host's own loader**, until experiment E1 says a pinned host survives on an iPhone; applying it to the host would recreate the recorded crash.

**Names.** Keep "toss", 🥏 and the `toss-render.html` path. They are in SURFACING.md, the bookmarklet and every link already handed over, and renaming a deployed URL breaks links for no gain in clarity. `?use=` leaves the public vocabulary and is described as the lib pin, an internal operation; `?lib=` is the one public code switch.

## Layers and their versions

| Layer | Version today | Proposed default |
|---|---|---|
| Bootstrap, `lib/entry.js` | main | Unchanged |
| Host, `toss-render.html`, the top-level document | main | Unchanged |
| Code the host contributes: FAB, Alpine | main | main; follows `?lib=` only if E1 passes |
| App chrome, when an app frames the content | framed at `@ref` | Unchanged |
| Content | `@ref` | `@ref` |
| Library inside the frame | `@ref` for web-tools, `?lib=` or main for other repos, wrong for a plain `entry.js` importer | Follows the content for web-tools, main otherwise, `?lib=` overrides |
| Viewer page for a non-page file | `web-tools@main`, fixed | `?lib=` |

Two cases the defaults already cover. **The whole app at a branch** is `#gh=mehrlander/web-tools@<branch>:app/index.html`, since the shim hands the app its `use` and the app loads that branch's `dist/app.js`. **The app at main reading branch content** is the app's own ref picker, a choice about data rather than about code, and needs no link parameter.

## The document boundary

| Concern | Kind | Proposal |
|---|---|---|
| Tab title and favicon | Browser: only the top-level document owns them | Relayed today by polling the frame; move to explicit channel calls |
| Address bar and history | Browser, for the address bar. Swallowing the frame's `replaceState` is a design choice | The frame is same-origin with the host, so the host can map the page's query and fragment back into its `#gh=` address. Reload and the "Link" action then keep the view. |
| Top-level navigation | Design choice: the sandbox omits `allow-top-navigation` | Keep; `__tossLeave` exists |
| One FAB per viewport, host-owned | Design choice | Keep; a branch FAB depends on E1 |
| Alpine in the host | Follows from the FAB | Same |
| `location.search` and `location.href` read as strings | Limit of the shim, which patches `get` and `has` only | Publish the page query on the channel and narrow the patch (S1) |
| Home-screen web app, viewport meta, safe areas, keyboard and visual viewport, iframe scrolling on iOS | Browser | Needs top-level execution |

**The channel.** One `window.__toss` object stamped into address-mode frames, carrying `ref`, `lib`, `subject`, `query`, and the calls `setMark`, `replaceUrl`, `navigate`, `leave` and `width`. It replaces about ten separate globals (`__fabHosted`, `__ref`, `__tossNavigate`, `__tossRoute`, `__tossLeave`, `__tossWidth`, `__tossSubject`, `__tossFrame`, `__tossSubjectMark`), which stay as aliases until nothing reads them. Payload mode gets no channel.

**Internal top-level selection.** For the rows that need top-level execution, the host can replace itself with the deployed `pages/<p>.html?use=<ref>` when three things hold: the subject is a web-tools page served by Pages, the comparison of main with the ref touches only `lib/` and `dist/` (so the deployed page file and every sibling it loads equal the ref's copy), and E1 has not shown that a top-level blob import hosting a frame dies. The reader never picks the route; the host does, from the change set.

## Access boundaries

These do not move. `#gh=` stays same-origin and limited to the allowlisted owners. `#gz=` stays opaque. `?lib=` names only web-tools refs, which are trusted code, and never promotes inline content to same-origin. One existing exposure is stated rather than widened: pasted data renders in `data-view.html` same-origin, with DOMPurify on its markdown preview.

## Representative cases

| Case | Today | Proposed |
|---|---|---|
| web-tools page, only `lib/` changed | ⭐ `?use=` on the deployed page | `#gh=…@<ref>:pages/x.html`; the host may select top-level |
| web-tools page file changed | `#gh=` | Same |
| FAB change | `?use=` on a deployed page, only | `#gh=` with top-level selection; host `?lib=` after E1 |
| `toss-render.html` itself | Nested toss | Nested toss, kept as a developer route |
| The whole app at a branch | Ref switcher (the crashing shape) or `#gh=` | `#gh=mehrlander/web-tools@<ref>:app/index.html` |
| Private repo page at a branch | `#gh=` | Same |
| A budget-drs view | The app route | Same address; the embedder is unified later |
| CSV or JSON at a ref | `#data=` | `#gh=`, dispatched by kind; `#data=` still accepted |
| Markdown | `#gh=` mounts raw text | Dispatched to its viewer |
| Viewer change, content on main | Nested toss or a hand-built `?src=` | `?lib=<ref>#gh=…@main:rows.csv` |
| Cross-repo page with a plain `entry.js` import | web-tools pinned to the other repo's branch name | main, unless `?lib=` |
| Inline HTML | `#gz=` | Same |
| A reader with no token | `#gz=` or an artifact | Same |

Example addresses, with `T` for `https://mehrlander.github.io/web-tools/pages/toss-render.html`:

```
T#gh=mehrlander/web-tools@claude/x:pages/diff-tool.html
T#gh=mehrlander/web-tools@claude/x:app/index.html?view=map&tab=showing
T#gh=mehrlander/home@3f2c1a9:projects/budget-drs/app/view/app.html?view=submittal
T?lib=claude/viewer-fix#gh=mehrlander/home@main:projects/budget-drs/data/rows.csv
T#gh=mehrlander/web-tools@v1.2:docs/showing.md
```

## Stages

| Stage | Change | Done when |
|---|---|---|
| S1 | Correctness with no new surface. Inject `use` only for web-tools subjects and stamp `__lib` otherwise; give `entry.js` the precedence `?ref`, `__lib`, `use`, `main`; scope the params shim to the page address; stop `ref-switch.js` pinning the shell, with its test; drop the redundant `?use=` inside `#gh=` in `map.js`. | Every `todo` in `toss-lib-ref.test.mjs` passes without its marker; `npm test` green. |
| S2 | Dispatch by kind in the host, from an inlined copy of the kind map held to `routes-kinds.csv` by `routes-manifest.test.mjs`. | Headless shots of `.md`, `.csv` and `.pdf` addresses show their viewers. |
| S3 | `?lib=` forwarded into the frame, the viewer page and nested app frames. | A headless shot at `?lib=` against a branch that changes a viewer shows the change. |
| S4 | The `window.__toss` channel and history mapping, old globals kept as aliases. | A headless view switch in the app survives a reload of the host address. |
| S5 | One generator. `showing.py` emits toss links only, adding `?lib=` when the renderer or library changed; Map, Showing tab drops to one public row with internal rows labeled; showing.md and loader.md rewritten; top-level selection added if E1 allows. | `showing-pick.test.mjs` asserts no generator emits a public `?use=`. |
| S6 | The FAB compares a `?use=` page's own file at the ref with main and says so when they differ, which makes the "old shell around new lib" trap visible. | A headless shot of a divergent page shows the notice. |

## Experiments

**E1: which variable kills the tab on an iPhone.** Probe ready at [`pages/scratch/shell-pin-probe.html`](../pages/scratch/shell-pin-probe.html); it runs only from Pages, so after merge. Each cell changes one variable around the frame `toss-render` mounts. A is today's shell, the negative control. B blob-imports `gh-api.js` at main. C imports it natively with the shell's `gh` pinned to main's SHA. D is the recorded crash shape, the positive control. E removes the frame from D. F keeps D's blob URL unrevoked. G opens the real `toss-render` in the shape the ref switcher mints. The code is main's in every cell, so only the route differs. The replica means something only if D dies; if D survives and G dies, the replica misses a variable of the real shell. Every cell carries `?case=`, so a crash files itself through the FAB's trail, and "File results" commits the tally to `web-tools-private`. All seven cells boot and record in headless Chromium, which proves the instrument and says nothing about Safari.

**E2: which ref a tossed page's library boots.** Run 2026-09-27 by `toss-lib-ref.test.mjs`: a web-tools page gets its branch, a page with no `@ref` gets main, a page query `use` cannot override, and a cross-repo `?ref=` pin holds. Three defects are confirmed and recorded as `todo`: a cross-repo plain import boots the other repo's branch name, a page query `ref` re-pins the library, and an unrelated `URLSearchParams` answers `use`.

**E3: whether `parent.history.replaceState` from the blob frame works in Safari.** Expected, since the frame is same-origin with the host, and unmeasured. It gates S4.

**E4: what top-level selection costs.** One comparison call per open, anonymous for web-tools, against a limit of 60 an hour; measure the delay on a phone before S5 makes it a default.

## Where a link could show something plausible and wrong

- A cross-repo page tossed at a branch, or a page whose query carries `ref` or `use`, until S1.
- A page that hardcodes its library and ignores `?lib=`; the FAB's `ignoredUse` check should cover `lib` as well.
- A comparison that is stale or scoped too narrowly deciding the top-level route.
- The host FAB from main presented as the branch's FAB; the layer strip should mark it.
- A direct `?use=` link still in circulation, until S6 makes its divergence visible.
