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

The renderer hands the Web Tools choice to the page by three channels, one meaning each (loader.md has the table): `use` answers the effective ref, `lib` and `window.__lib` carry only an explicit selection, and `window.__ref` names the page's own repo ref. `lib/entry.js` reads `?ref=` on its import, then `window.__lib`, then `use`, then main.

The FAB checks the result. Its layer strip marks any layer whose loader booted a Web Tools version other than the one the rule gives it. Its "ignored" banner makes the same check inside a toss, where until 2026-09-28 it was switched off.

## Scenarios

| Scenario | Link | State | Evidence |
|---|---|---|---|
| App shell at main, one view at a branch | `app/?view=app&appRepo=<repo>&appPath=<path>&appRef=<branch>`, deployed or tossed | Implemented; `appRef` existed before. The view's library follows the view's ref unless the app carries an explicit `?lib=` | Harness X5 |
| App at a branch, its views following it | `toss-render.html#gh=web-tools@<branch>:app/index.html?view=app&…` | Implemented on this branch. A web-tools view takes the app's branch; an explicit `?lib=`, `main` included, reaches every view | Harness X5b, X5c, X5d; unit tests |
| A web-tools page and its Web Tools code at two refs | `toss-render.html?lib=<ref B>#gh=web-tools@<ref A>:pages/x.html` | Implemented | Harness X9p; unit tests |
| A page from another repo with Web Tools at a branch | `toss-render.html?lib=<ref B>#gh=home@<ref A>:<path>` | Implemented. With no `?lib=` the page runs main; before, it was told its own repo's branch name, which live GitHub served from a same-named web-tools branch | Harness X2p, C9; live E9 |
| A project page, Web Tools code and private-repository data at three refs | `toss-render.html?lib=<B>#gh=shortcut-tools@<A>:pages/library.html?data=<C>` | Works for the pages that let a link choose the private repository's ref (see the map section for which). Measured on `library.html`: page at A, Web Tools at B, curated data consumed at C (the stamp was read back from the page's state), device folders at main by design | Harness X11. Live E9 reached the Web Tools boot at B; the proxy dropped the data reads |
| A viewer page from one branch showing content from another | `toss-render.html?lib=<B>#data=<repo>@<A>:<file>` | Implemented | Harness X8p; unit test |
| A page on a pre-built bundle (`dist/web-tools.js`, `dist/app.js`, seven pages' own boots) | as above | The whole build at the effective ref. No single file inside a build is selectable, and none needs to be: any library state worth previewing exists as a commit whose build the hook keeps current | Harness X4, X6p |
| A home page that picks its own build (`surfacer.html`) | as above | Always main's build; later loads follow the effective ref, so an explicit `?lib=` other than main mixes the two | Harness X4 |
| Relative images, CSS `url()`, `import()`, `<iframe src>` in a tossed page | any | Load from the deployed site, main, whatever the address says; absent for a private repo | Harness C11 |
| `lib/entry.js` itself | any | Always the deployed copy | Harness, every case |

## Which resources follow which selection

Measured in the harness unless marked read.

| Resource | Version |
|---|---|
| The page file | The address's ref |
| The page's relative `<script src>` and `<link rel=stylesheet>` | The address's ref, inlined by the renderer. A frame only today: the top-mode prototype has no inliner, so production top mode must reuse the renderer's prelude (read) |
| The page's relative `fetch()` GETs | The address's ref, through the renderer's fetch shim. Frame only today, as above |
| The page's relative `<img>`, CSS `url()`, `import()`, `<iframe src>`, and a relative favicon | The deployed site, main, through the stamped `<base>`, in both modes |
| `lib/entry.js` | The deployed site, always |
| `lib/gh-api.js` and every `gh.load` file | The Web Tools selection: raw and the contents API at that ref, or Pages for main |
| A pre-built bundle a page boots by `use` (`dist/app.js`, `dist/web-tools.js`, seven pages' own boots) | The Web Tools selection, whole. Files loaded after it follow the same ref |
| `surfacer.html`'s bundle (home) | main's, whatever the selection; its later loads follow the selection |
| A routed toss's viewer page | The Web Tools selection, else the route's ref |
| The renderer itself, its FAB and its Alpine | main, in frame mode. In top mode there is no renderer on screen; the page's own FAB follows the Web Tools selection |
| Another repository's data | The page's choice: an explicit parameter, the page's own ref by convention, or main by design (the map section) |
| A view the web-tools app frames | The inheritance rules in the selection table |

## Closing the gap to a direct `?use=` link: two approaches, measured

For a web-tools page with only `lib/` changed, a toss already loads what `pages/x.html?use=<ref>` loads, and it also reaches private repositories and changed page files. What it lacked, measured in `tools/test/showing-mode-compare.mjs` (E10) across four scenarios, with F as today's renderer:

| Measured in Chromium, harness | F: frame | A: frame, the renderer's library at a chosen ref | B: top mode |
|---|---|---|---|
| The FAB on screen | main's | the chosen ref's | the page's own, at the page's Web Tools selection |
| Tab title | "Toss · …" | "Toss · …" | the page's own |
| Page and Web Tools chosen apart | yes | yes, plus a third choice for the renderer | yes |
| A view switch (`pushState`), back, reload | the address is untouched; back leaves the page; reload loses the switch | as F | the address keeps the page's query; back returns to the prior view; reload keeps the switch |
| The page sees the address in its own query | no | no | no: the `gh` entry is hidden from the page's reads and folded back into its history writes |
| Three repositories (S4) | page A, Web Tools B, data C; FAB main | the same; FAB B | the same; FAB B, the page's own |

**What A solves.** It solves only the drawer's version around a framed page. It adds a third version a user must understand (the renderer's, beside the page's and the Web Tools'), and it leaves title, history and the phone's viewport where F leaves them. On an iPhone it is the recorded crash shape unless E1 finds that loading the renderer's library by the native import at a ref survives (cell C).

**What B solves.** It gives the page's own FAB at the Web Tools selection, its own title and icon, working history and reload, and, on a phone, the page's own viewport and keyboard. It keeps page and Web Tools independent without adding a third version: the FAB is Web Tools code, so it follows the Web Tools selection. **It also makes device verification possible before merge.** Once the top-mode page is on main, it can run any branch's page, including a branch's own renderer, as the top-level document (measured: a branch renderer launched this way framed a page at another branch, with each document at its own version).

**What B costs.** The forced width (`?w=`) needs a frame; payloads (`#gz=`) must stay opaque in a frame; the renderer's own Link and re-address actions are not on screen (the page's FAB has its own render tab); a link in the page to another relative page leaves the preview for the deployed site, as it does in a frame. Its iPhone behaviour is unmeasured. A page that boots a branch library by the blob import and also hosts a frame (the app with a view open, or a branch renderer) is the recorded crash shape. A page with no frame is the shape the record says survives.

**Recommendation for review: B, as a mode of the one render interface, chosen by the renderer.** A trusted page address runs top-level; payloads, forced widths and anything the renderer must stay around run in a frame, as today. The first step is small and verifiable: merge the two scratch pages on their own, since they change no production code, and use them on a phone to run the device checks below against this branch's code before anything else merges. A is not recommended. It is a narrower fix to one symptom, and it adds the version choice this work set out to hide.

## iPhone: what can be checked before merge

**What is possible now.**

- **A faithful device check of the current deployed renderer** hosting a frame (the post-2026-09-26 baseline). Tap the FAB on any ordinary toss link. It needs no merge.
- **Nothing that runs a branch's renderer, or a branch's page as the top-level document.** GitHub Pages serves only main, `raw.githubusercontent.com` serves HTML as text, a toss frames what it renders, and third-party render proxies are ruled out by the surfacing conventions. So a branch's renderer only ever runs nested, which is not the shape under question.

**The smallest change that enables verification**: merge the two scratch pages, `pages/scratch/toss-top-probe.html` and `pages/scratch/shell-pin-probe.html`. Neither touches production code. After that, any branch's page or renderer can run top-level on the phone through the first. The second has to merge beside it rather than run through it, because its cell links are relative, and a relative link in a page run top-level resolves to the deployed site, not back to the launcher.

**Device checks, in order**:

1. Cell A: the deployed renderer, framing a page, survives a FAB tap. Possible now.
2. Top mode, a page with no frame, Web Tools at a branch: the FAB opens. Expected to survive.
3. Top mode, a page with a frame and Web Tools at a branch (the app with a view open, cell I): the risky shape.
4. Top mode, the same page with `lib=main`: the native import with a frame. If this survives where check 3 dies, the blob import is the fatal part, and top mode can load a branch library some other way.
5. Top mode, history on Safari: a view switch, back, reload, and `document.write` of module scripts.
6. The shell-pin matrix, cells A to I, through the launcher, with cell D as the positive control.

## The map of repository selections

**Which pages read private data, and at which ref.** Verified by search on 2026-09-29 across web-tools, home and shortcut-tools:

- **Pages that read `mehrlander/web-tools-private`:** nine web-tools pages (`shortcuts`, `citations`, `dictate`, `shortcut-log`, `entities`, `session`, `shortcut-edit`, `session-context`, `show-repo/show-repo`), the app and its components, and three shortcut-tools pages (`library`, `token`, `push-shortcuts`). No page under `mehrlander/home/projects` reads it.
- **Pages that let a link choose its ref:** three.
  - `shortcut-tools/pages/library.html` takes `?data=<ref>` for its curated files and reads the folders the device writes at main, deliberately; reading those at the preview ref was the 2026-08-18 bug its comments record.
  - `pages/entities.html` and `pages/citations.html` take `?data=<ref>`, else the page's own ref (`window.__ref`). That applies a web-tools ref to another repository on purpose: it relies on a session using the same branch name in every repository it touches.
- **Pages that read it at main or the default branch:** the others. These include the app's registry and session store, which are live shared state that crawls and devices write on main.

So the measured three-repository case is `library.html` (X11), and it works with existing parameters.

**What that rules out, and what it does not.** It rules out a *blind* override: a map applied to every read of a repository, which is the placement PR #823's draft named (the renderer's fetch shim rewriting the ref of any API read for a mapped repository). Nothing in a request says whether its `main` was chosen or defaulted, so the library page's device folders would move to the preview ref. It does not rule out two narrower forms:

- **Scoped selections**: a map entry limited to paths, such as `web-tools-private@C:shortcuts/library.json,shortcuts/prune.json`. It works without the page's help, but the link then has to know which paths are curated, which is knowledge the page already holds. The scope drifts whenever the page reads a new file.
- **Page cooperation**: the renderer carries a small map, `?refs=<repo>@<ref>,…`, and exposes it read-only as `window.__refs`; a page's curated reader consults it before its own default, and its pinned readers never do. It works for any page that opts in, needs no path knowledge in the link, and nests: the app would forward it the way it forwards `?lib=`.

**Recommendation: no map yet, and page cooperation when one is needed.** The three pages that choose another repository's ref already have a parameter, and the address carries it untouched. The web-tools app forwards a view's own query, so the parameter survives nesting. The same-branch-name convention in `entities.html` and `citations.html` is a cooperative selection already, keyed on the page's own ref. A map buys one uniform name, and it is worth adding when a page reads two or more other repositories at independently chosen refs, or when a view needs a selection its own query cannot carry. At that point the smallest form is the read-only `?refs=` → `window.__refs` above, with `?lib=` as its entry for Web Tools, which the renderer already treats as a selection to pass on. A path-scoped entry stays possible for a page that cannot cooperate. A blind override stays ruled out.

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
| E10 | Renderer version (A) against top mode (B), same scenarios | Done in Chromium, `showing-mode-compare.mjs`; the device half is the checks above |
| E7 | A path address served by a 404 page | Needs a deploy |
| E8 | Independent selection, read from what ran | Done; `showing-selection-probe.mjs`, cases X1 to X11 |
| E9 | The same selections against live GitHub | Partly done, 2026-09-28, `showing-live-probe.mjs` through the sandbox's proxy. **The deployed renderer** booted a shortcut-tools page's Web Tools at `claude/doc-simplification-followups-n6ft2r`, a shortcut-tools branch name that web-tools also has, and GitHub served it: the cross-repo defect in its silent form. **This branch's renderer**, nested and given `?lib=<commit>`, booted the page's Web Tools at that commit. The proxy dropped later reads in every attempt, so the private data the page consumed is not established live; the harness has it (X11) |
| — | Which inliner candidate empties the budget-drs app's panes | Open, from `app-frame-outruns-the-inliner` |

## Earlier rounds

- **Still useful**: the probes; the harness fixes (real blob shas, the sha media type, and the warning that a stale local `main` misreports `?ref=main`); the finding that the checks reported what was asked rather than what ran, which the FAB now reads directly.
- **Optional, and possibly on the path to superseding `?use=`**: top mode (E6) and the path address (E7). Both answer items 1 and 2 above.
- **Optional, not on the path**: a shared render kit to remove the app's middle renderer document.
- **Withdrawn**: redirecting a toss to a deployed `?use=` page.
