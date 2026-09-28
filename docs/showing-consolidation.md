# Showing: selecting versions in a toss

A plan, drafted 2026-09-27 and revised twice on 2026-09-28. It began as a proposal to make the 🥏 toss the only public way to show a preview and to retire `?use=` from public use. **That is no longer the goal.** The objective since the third revision is narrower:

- keep `?use=` and every existing link working;
- extend `pages/toss-render.html` so that one toss can select versions independently. For example: a project page from a home branch, its data from a web-tools-private branch, and Web Tools code from main or from another branch;
- keep a surrounding app at main while previewing one changed piece inside it.

[showing.md](showing.md) explains the existing boundaries. This document traces what selects each version today, measures which selections already work, and recommends the smallest extension. It stays investigation: nothing here changes production code.

Every finding carries one of three labels:

- **Measured**: observed in headless Chromium through the render harness. The harness answers every ref from the working tree, so the probes make versions distinguishable in one of two ways. `showing-version-map.mjs` records the ref each request asked for. `showing-selection-probe.mjs` stamps every served JavaScript file with the repo, ref and path its URL named, so the report lists what each document *executed*.
- **Read**: concluded from the code and not run.
- **Device**: needs Safari on an iPhone, after merge.

## The loading boundaries

A toss has up to four kinds of thing in it, and each gets its version from a different place.

| Layer | Where its version comes from today | Selectable independently? | Evidence |
|---|---|---|---|
| **Host**, `toss-render.html` and the FAB it mounts | GitHub Pages, so main. Its library comes through `entry.js`, main unless the host's own `?use=` is set, the shape that crashes the iPhone | only by the host's `?use=` | measured |
| **Outer app, web-tools** (`app/index.html`) | Its HTML at the address's ref. Its code is `dist/app.js` at `use`, which the toss injects as the address's ref. Its data comes from its own readers (README, `.web-tools.json` and the board at main) plus `window.gh` (`pages/pages.csv` at the library's ref) | HTML and code, yes (X5, X6p); its data is mixed | measured (C4, X5) |
| **Outer app, budget-drs** (`home`) | Its HTML and 46 own files at the address's ref; Web Tools at `?lib=`, else main. Each view it frames gets the app's own ref (`window.__ref`) | the app, yes; a view apart from the app, no | measured (X10, X10b) |
| **Rendered page**: HTML | The address's `@ref` | yes | measured |
| Page's relative `<script src>`, `<link>`, `fetch()` | Inlined, or rerouted, at the address's ref | follows the page | measured (C11) |
| Page's relative `<img>`, CSS `url()`, `import()`, `<iframe src>` | The deployed site, through the stamped `<base>` | no | measured (C11) |
| **Library, chain pages** | `lib/entry.js` always from Pages. `gh-api.js` and every `gh.load` at: `?ref=` on the page's own import URL, else `use`, else main. The toss injects `use` as the address's ref for every repo | for web-tools pages, only together with the page; home pages add their own `?lib=` | measured (C1, X1, X2, X3) |
| **Library, builds** (`dist/web-tools.js`, `dist/app.js`, seven pages' blob boots) | The build at `use`, fetched whole. Files outside the build load at `gh.ref`, which is `use` or main. `surfacer.html` in home fetches main's build by commit and ignores `use` for the choice | the whole build, yes; single files inside it, no | measured (X4, X5, X6p) |
| **Data** | Whatever the page decides. `window.gh` reads at the library's ref. A page's own `GH` readers use the page's parameters (`library.html`: `?data=`). Some reads are pinned deliberately | per page only | measured (X3), read |
| **Nested views** | web-tools app: `appRef` picks the view's ref, and the view's library follows the view. budget-drs app: the app's ref | web-tools, yes (X5); budget-drs, no | measured |

Two couplings matter most:

1. **`use` means the address's ref for every repo.** That is right for a web-tools page. For any other repo's page it names the wrong repo's branch.
2. **A view's version is tied to its container.** In the web-tools app a view's library follows the view. In the budget-drs app a view follows the app.

## Which selections worked before the extension, measured

| Want | Shipped behaviour | Case |
|---|---|---|
| home page at a branch, Web Tools main | works | X1 |
| home page at a branch, Web Tools at another branch | works through the page's own `?lib=` inside the address, for pages that implement it (the budget-drs pages) | X2 |
| shortcut-tools page at a branch, its web-tools-private data at another branch | data works through the page's own `?data=`. Its library boots at the *shortcut-tools* branch name, which is wrong | X3 |
| home page on the `dist/web-tools.js` build (surfacer) at a branch | the build is main's; `gh.ref` for files outside the build is the home branch name, which is wrong | X4 |
| web-tools app at main, one view at a branch | works through `appRef`; the view's library is the view's ref | X5 |
| web-tools app page at main, app code from a branch | works as the deployed `app/?use=<ref>`; a toss cannot say it | X6p |
| budget-drs app at main, one view at a branch | not possible; a `viewRef` parameter is ignored | X10b |
| A viewer page from one branch showing content from another | nested toss only | X8p |
| A web-tools page at one ref, its library at another | only `?use=` on the deployed page, which forces the page file to main | X9p |

Relative images, CSS `url()`, `import()` and `<iframe src>` are wrong in every row: they come from the deployed site (C11).

## Builds

Measured: under a build, each document executed the bundle as one stamped file and loaded no library file on its own (X4, X5, X6p). The build replaces `GH.prototype.get` for every cached path, on every `GH` instance and at any ref (read, `lib/build.js`). So a build is exactly one commit's library.

- **A build can stay in use** whenever the library selection is a commit whose `dist/` is current. The commit hook rebuilds `dist/` with every commit that touches `lib/`, and `derived-artifacts.test.mjs` fails CI when a branch's build is stale. So a branch with a green check has a build that matches its `lib/`.
- **Selecting another existing build is enough** whenever the library state you want exists as a commit: a branch, a tag or a SHA. Selecting it by `use` or `?lib=` swaps the whole build, and files loaded later follow the same ref.
- **Individual-file overrides** are needed only to combine library files from two commits that no single commit contains: main's newest files plus one file from a branch that forked earlier. No measured case needs that. The cheaper answer is to make the commit: merge main into the branch. The hook rebuilds its build and CI checks it. A runtime override would have to bypass the build's cache, which serves every cached path whatever ref is asked for, and it would produce a combination nothing else has tested. Not recommended.
- **One real mismatch:** a page that picks its build itself must also set the ref that later loads use. `surfacer.html` fetches main's build while `gh.ref` becomes the home branch (X4). Under the extension below `gh.ref` is main, which matches the build's branch but not its resolved commit.

## Two candidate interfaces

**A. `?lib=<ref>` on the renderer.** One value: the Web Tools code for the framed page, and for the viewer page of a routed toss. By default it is the content's ref for a web-tools page and main for any other repo's page. The renderer passes it down as `use`, as `lib` and as `window.__lib`, which are the three names pages already read. Prototyped as an in-flight patch of about eight lines in `showing-selection-probe.mjs`:

- X2p selects a home page's Web Tools from the renderer.
- X3p gives the shortcut-tools page main's library while its own `?data=` still works.
- X4p gives surfacer's later loads main.
- X6p puts the app's page at main with its code from a branch.
- X8p picks a viewer page apart from its content.
- X9p picks a web-tools page and its library apart.

It reaches every chain page, every build that reads `use` (seven pages, the app, and the build's own bootstrap), every home page that reads `lib`, and the one home page that reads `use` (the doc-audit viewer).

**B. A map of repository selections**, for example `?refs=mehrlander/web-tools@x,mehrlander/web-tools-private@y`, with path-scoped exceptions. For the Web Tools key it does what A does. For data it needs a place to apply, and the only shared place is `GH.prototype.req`, which every read passes through. A global override there is wrong, and the code says why. `library.html` reads its curated data at `?data=` but reads the folders the device writes at main *deliberately*: reading them at the preview ref was the 2026-08-18 bug its comments record. A map applied at the reader would bring that bug back, and nothing in a `GH` instance says whether its `main` was chosen or defaulted. So data selection stays with the page. A map would only give pages one shared name to read (`window.__refs`), and today one page needs it, and it already has `?data=`, which works through the address unchanged (X3). No measured case needs path exceptions: a branch that changed Web Tools data carries main's code as of its fork, so selecting the whole branch is enough.

**Recommendation: A.** Revisit B only when a second page needs cross-repo data selection, and then as a read-only object pages opt into, never as an override inside the reader. One naming hazard is worth noting now: `?data=` means a ref in `library.html` and a dataset key in the budget-drs app.

## The smallest implementation

1. **`toss-render.html`**: the `?lib=` extension as prototyped. The address grammar is unchanged, and `?use=` and every existing link keep working.
2. **The params shim** answers only lookups of the page's own address, not every `URLSearchParams`. This fixes C10, where a page's `ref` parameter re-pinned the library.
3. **The web-tools app** forwards the app's ref, and `?lib=`, to the views it frames when a view names no ref of its own. This fixes C5. The app is a build, so the change reaches readers when the app's build is rebuilt, which the hook does.
4. **The budget-drs app** (in home), if "app at main, one view at a branch" is wanted there: a per-view ref parameter read by `embedView`. This is a change in home, not in the renderer.
5. **Evidence**: the FAB's layer strip reads each framed document's `gh.ref` alongside the address's ref, so a mismatch shows. The strip already walks those same-origin windows.

**Landed on 2026-09-28**: steps 1, 2, 3 and 5. Step 4 is a change in home and is not made. Verification:

- `toss-lib-ref.test.mjs` passes its three former `todo` cases as ordinary tests, plus new ones: the renderer's `?lib=` for a web-tools page and for another repo's page, a page reading its address through `URL`, and precedence.
- `toss-routed-subject.test.mjs` checks that `?lib=` picks a viewer's ref while the subject keeps the file.
- `fab-layers.test.mjs` checks the new mark.
- Measured, `showing-version-map.mjs` reports no WRONG line: C5, C9 and C10 now run the intended version.
- Measured, `showing-selection-probe.mjs`: a home page's own `?lib=` in the address still wins when the renderer names none (X2). The first cut of step 1 overrode it, and the probe caught that before commit. The app tossed at a branch frames its views at that branch (X5b) and hands its library to a home view (X5c). The FAB's layer strip reports the library each layer ran.

Precedence, as shipped: the renderer's own `?lib=`, then a `lib` in the page query inside the address, then the rule (a web-tools page runs its own ref, any other page runs main).

**Limits that remain.**

- The host's FAB and Alpine are main's.
- `lib/entry.js` is always the deployed copy.
- Relative images, CSS `url()`, `import()` and iframes come from the deployed site until the inliner handles them.
- `surfacer.html` picks main's build whatever `?lib=` says, unless it learns to read `lib`.
- Data selection is per page.
- A view nested inside an app sees only what its app forwards.

## What remains useful from the earlier rounds

- **Still useful**:
  - the probes: `toss-lib-ref.test.mjs` (E2), `showing-version-map.mjs` (E5), `showing-selection-probe.mjs` (E8);
  - the harness fixes: real blob shas, the sha media type, and the warning about a stale local `main`;
  - the correctness fixes now folded into steps 2 and 3;
  - the finding that the ignored-version warning and the layer strip report what was asked, not what ran; step 5 starts on that.
- **Optional, and no longer required by the objective**:
  - top mode (E6), which replaces the renderer with the page to give it its own title, history and FAB at a ref;
  - the shared render kit, which would remove the app's middle renderer document (about 775 KB read for a FAB that declines to mount);
  - the path address (E7).

  Each is worth doing only when its specific payoff is wanted.
- **Still open but no longer on the path**: the iPhone matrix (E1, cells A to I). `?lib=` never pins the host, so it avoids the recorded crash shape. The matrix matters again only if the host's own FAB is ever to run a branch.
- **Withdrawn**: retiring `?use=` from public use, a single link generator, and redirecting to a deployed `?use=` page.

## Experiments

| Id | Question | Status |
|---|---|---|
| E1 | Which variable kills Safari's web process under a pinned host | Device, `pages/scratch/shell-pin-probe.html`; off the path |
| E2 | Which ref a tossed page's library boots | Done; three defects held as `todo` in `toss-lib-ref.test.mjs` |
| E5 | Which ref every document asks for, twelve cases | Done, `showing-version-map.mjs` |
| E6 | Top mode in Chromium | Done, `toss-top-probe.mjs`; optional |
| E7 | A path address served by a 404 page | Needs a deploy; optional |
| E8 | Independent selection of page, library and data, by what executed | Done, `showing-selection-probe.mjs`, with the `?lib=` prototype |
