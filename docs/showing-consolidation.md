# Showing: selecting versions in a toss

A plan, drafted 2026-09-27 and revised four times by 2026-09-28. It is carried by PR #825, which also takes in the complementary work of PR #823.

**The objective**: expand `pages/toss-render.html` so that it can supersede `?use=` as the normal interface for rendering and previewing anything other than the deployed page. Existing `?use=` behaviour and links stay as they are. The third revision said that replacing `?use=` was no longer a goal. That misstated the owner's intent, and this revision corrects it: the aim is still that a toss link becomes the ordinary way to preview, with `?use=` kept working for the links that already exist.

[showing.md](showing.md) explains the boundaries. [loader.md](loader.md#under-the-toss) states how a toss hands a page its Web Tools version. This document records what selects each version, what the extension shipped, what still separates a toss from a direct `?use=` link, and the open question of a map of repository selections.

Evidence carries one of three labels:

- **Harness**: headless Chromium through the local render harness, which answers every ref from the working tree. The probes make versions distinguishable by stamping every served script, and the JSON data a page reads, with the repo, ref and path its URL named, then reading the stamps back from each document. This evidence says which version each document asked for and ran. It does not say what GitHub returns.
- **Live**: headless Chromium against GitHub itself, anonymously, which reaches public repositories only.
- **Device**: Safari on an iPhone, after merge.

## The selection rules, as shipped on this branch

| What | Picked by | Default |
|---|---|---|
| The page, and every file it reaches relatively | The address: `#gh=owner/repo@<ref>:<path>` | The repository's default branch |
| The Web Tools code the page boots | The renderer's own `?lib=<ref>`, else a `lib` in the page query inside the address | A web-tools page: its own ref. Any other repo's page: main |
| A routed toss's viewer page (`#data=`, `#pdf=`) | The renderer's `?lib=` | The route's declared ref, main |
| A page's data in other repositories | The page, by its own parameters (`library.html`: `?data=<ref>`), which the address's page query carries through untouched | Whatever the page chooses; some reads are pinned to main on purpose |
| A view framed by the web-tools app | The view's own ref and `lib`, else the app's page ref (web-tools views) and the app's explicit Web Tools selection, `main` included | The view's own default |

The renderer hands the Web Tools choice to the page by three channels, one meaning each (loader.md has the table): `use` and `lib` answer the effective ref, `window.__lib` is stamped only for an explicit selection, and `window.__ref` names the page's own repo ref. `lib/entry.js` reads `?ref=` on its import, then `window.__lib`, then `use`, then main.

The FAB checks the result. Its layer strip marks any layer whose loader booted a Web Tools version other than the one the rule gives it. Its "ignored" banner makes the same check inside a toss, where until 2026-09-28 it was switched off.

## Scenarios

| Scenario | Link | State | Evidence |
|---|---|---|---|
| App shell at main, one view at a branch | `app/?view=app&appRepo=<repo>&appPath=<path>&appRef=<branch>`, deployed or tossed | Implemented; `appRef` existed before. The view's library follows the view's ref unless the app carries an explicit `?lib=` | Harness X5 |
| App at a branch, its views following it | `toss-render.html#gh=web-tools@<branch>:app/index.html?view=app&…` | Implemented on this branch. A web-tools view takes the app's branch; an explicit `?lib=`, `main` included, reaches every view | Harness X5b, X5c, X5d; unit tests |
| A web-tools page and its Web Tools code at two refs | `toss-render.html?lib=<ref B>#gh=web-tools@<ref A>:pages/x.html` | Implemented | Harness X9p; unit tests |
| A page from another repo with Web Tools at a branch | `toss-render.html?lib=<ref B>#gh=home@<ref A>:<path>` | Implemented. With no `?lib=` the page runs main; before, it was told its own repo's branch name | Harness X2p, C9; live L1 |
| A project page, Web Tools code and private-repository data at three refs | `toss-render.html?lib=<B>#gh=shortcut-tools@<A>:pages/library.html?data=<C>` | Works for the one real page that reads private data. Page at A, Web Tools at B, curated data consumed at C (the stamp was read back from the page's state), device folders at main by design | Harness X11. No live private read: anonymous access cannot reach web-tools-private |
| A viewer page from one branch showing content from another | `toss-render.html?lib=<B>#data=<repo>@<A>:<file>` | Implemented | Harness X8p; unit test |
| A page on a pre-built bundle (`dist/web-tools.js`, `dist/app.js`, seven pages' own boots) | as above | The whole build at the effective ref. No single file inside a build is selectable, and none needs to be: any library state worth previewing exists as a commit whose build the hook keeps current | Harness X4, X6p |
| A home page that picks its own build (`surfacer.html`) | as above | Always main's build; later loads follow the effective ref, so an explicit `?lib=` other than main mixes the two | Harness X4 |
| Relative images, CSS `url()`, `import()`, `<iframe src>` in a tossed page | any | Load from the deployed site, main, whatever the address says; absent for a private repo | Harness C11 |
| `lib/entry.js` itself | any | Always the deployed copy | Harness, every case |

## What still separates a toss from a direct `?use=` link

For a web-tools page with only `lib/` changed, the toss `toss-render.html#gh=web-tools@<ref>:pages/x.html` loads the same page file and the same library as `pages/x.html?use=<ref>`. It also reaches private repositories and changed page files, which `?use=` cannot. What `?use=` still has that a toss lacks:

1. **The FAB and the drawer at the branch.** A toss's FAB is the renderer's, from main; `?use=` on a deployed page runs the page's own FAB at the ref. Pinning the renderer is the shape that crashes an iPhone. Two ways forward: E1 finds a safe way to pin the renderer's FAB, or the renderer runs a trusted page as the top-level document (E6's top mode, measured in Chromium only).
2. **The top-level document.** Title and icon are relayed today. History writes inside the frame are swallowed, so a reload loses the view. The iOS viewport, keyboard and home-screen behaviour are the page's only at the top level. Top mode addresses all of these; so would a history relay for the first two.
3. **The generators.** `scripts/showing.py` still picks `?use=` for a change confined to `lib/`, and its tests say so. It should switch to the toss once item 1 is settled, since until then the switch trades a branch FAB for nothing.
4. **Device confirmation.** No tap on the current renderer hosting a frame has been recorded since the loader changed on 2026-09-26 (E1, cell A).

Relative assets and `entry.js` load from the deployed site on both routes, so neither is a reason to prefer `?use=`.

## The map of repository selections

**The real three-repository case.** No project page in `mehrlander/home` reads private data today. Two real pages cross into `mehrlander/web-tools-private`:

- **The web-tools app.** It reads its registry at the default branch, and that is right: the registry is live shared state that crawls and devices write on main.
- **The shortcut-tools library page.** It reads curated data at `?data=<ref>` and the folders the device writes at main, deliberately; reading those at the preview ref was the 2026-08-18 bug its comments record.

So the measured case is the library page (X11): its page, Web Tools and curated data at three refs, with the device folders at main. It works with existing parameters.

**What that rules out, and what it does not.** It rules out a *blind* override: a map applied to every read of a repository, which is the placement PR #823's draft named (the renderer's fetch shim rewriting the ref of any API read for a mapped repository). Nothing in a request says whether its `main` was chosen or defaulted, so the library page's device folders would move to the preview ref. It does not rule out two narrower forms:

- **Scoped selections**: a map entry limited to paths, such as `web-tools-private@C:shortcuts/library.json,shortcuts/prune.json`. It works without the page's help, but the link then has to know which paths are curated, which is knowledge the page already holds. The scope drifts whenever the page reads a new file.
- **Page cooperation**: the renderer carries a small map, `?refs=<repo>@<ref>,…`, and exposes it read-only as `window.__refs`; a page's curated reader consults it before its own default, and its pinned readers never do. It works for any page that opts in, needs no path knowledge in the link, and nests: the app would forward it the way it forwards `?lib=`.

**Recommendation: no map yet, and page cooperation when one is needed.** Today the one page that reads another repository's data at a chosen ref already has a parameter, and the address carries it untouched. The web-tools app also forwards a view's own query, so the parameter survives nesting. A map buys one uniform name. That is worth adding when either of two things happens: a page reads two or more other repositories at chosen refs, or a view needs a selection its own query cannot carry. At that point the smallest form is the read-only `?refs=` → `window.__refs` above, with `?lib=` as its entry for Web Tools, which the renderer already treats as a selection to pass on. A blind override stays ruled out.

## PR #823, taken in

- **The ref-switch fix**, as written: `ref-switch.js` addresses the page at the ref and no longer pins the renderer's own `?use=`. The same fix covers the header note in `show-repo.md` and the test.
- **`entry.js` reading `window.__lib`** after its import pin and before `use`.
- **The in-toss ignored check** (`ignoredUse` and `loaderRef` reading the framed page's loader, sampled until it boots), now computed by the rule the layer strip uses, so the banner and the strip cannot disagree.
- **Its channel test**, rewritten to the combined rule.

Where the two differed, the combined rule is this branch's, for one reason: a page should be told the one Web Tools ref it ought to load under every name it might read. PR #823 injected `use` only into web-tools pages. That fixed the cross-repo defect, but the pre-built pages and the doc-audit viewer read `use` and never `window.__lib`, so they would ignore an explicit `?lib=`. `window.__lib` keeps PR #823's meaning, an explicit selection, which is the signal the app needed to pass a selection on without mistaking a default for one.

## Experiments

| Id | Question | Status |
|---|---|---|
| E1 | Which variable kills Safari's web process under a pinned renderer; does the current renderer survive a FAB tap while framing (cell A) | Device, `pages/scratch/shell-pin-probe.html`, after merge |
| E2 | Which ref a tossed page's library boots | Done; `toss-lib-ref.test.mjs`, `toss-ref-channels.test.mjs` |
| E5 | Which ref every document asks for | Done; `showing-version-map.mjs` reports no wrong version on this branch |
| E6 | Top mode | Chromium only, `toss-top-probe.mjs` |
| E7 | A path address served by a 404 page | Needs a deploy |
| E8 | Independent selection, read from what ran | Done; `showing-selection-probe.mjs`, cases X1 to X11 |
| E9 | The same selections against live GitHub | Anonymous, public repositories only; see the PR |
| — | Which inliner candidate empties the budget-drs app's panes | Open, from `app-frame-outruns-the-inliner` |

## Earlier rounds

- **Still useful**: the probes; the harness fixes (real blob shas, the sha media type, and the warning that a stale local `main` misreports `?ref=main`); the finding that the checks reported what was asked rather than what ran, which the FAB now reads directly.
- **Optional, and possibly on the path to superseding `?use=`**: top mode (E6) and the path address (E7). Both answer items 1 and 2 above.
- **Optional, not on the path**: a shared render kit to remove the app's middle renderer document.
- **Withdrawn**: redirecting a toss to a deployed `?use=` page.
