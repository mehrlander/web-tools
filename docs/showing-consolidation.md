# Showing: selecting versions in a toss

A plan, drafted 2026-09-27 and revised five times by 2026-09-29. It is carried by PR #825, which also takes in the complementary work of PR #823.

**The objective**: expand `pages/toss-render.html` so that it can supersede `?use=` as the normal interface for rendering and previewing anything other than the deployed page. Existing `?use=` behaviour and links stay as they are. The third revision said that replacing `?use=` was no longer a goal. That misstated the owner's intent, and this revision corrects it: the aim is still that a toss link becomes the ordinary way to preview, with `?use=` kept working for the links that already exist.

[showing.md](showing.md) explains the boundaries. [loader.md](loader.md#under-the-toss) states how a toss hands a page its Web Tools version. This document records what selects each version, what the extension shipped, what still separates a toss from a direct `?use=` link, and a measured model for selecting every repository's version at once.

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

**An explicit `lib=main` through the app's navigation and a reload** (S5, added 2026-09-29, since S3 drove history with a raw `pushState` and no selection). The app was loaded at a branch with Web Tools at main, navigated by its own code, and reloaded. In F and A the selection survived the reload because it sits on the renderer's query, and the app's navigation was lost, as in S3. In B, `lib=main` survived the navigation, the reload and Back, and the app kept booting main. B had one gap: the app addressed a hub view without its own branch, because it recognises a toss by `window.__fabHosted`, which the launcher does not stamp, and so took itself for deployed. Recognising the launcher's `window.__tossTop` as well closes it (measured with the E11 patches, R7).

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

## The selection map

**The model under test.** A link names one target and, optionally, a map from repository to ref: show this file, and read each repository at this ref. The target can be any file the renderer shows: a page by `#gh=`, a CSV or Markdown file by `#data=`. The map does not sort repositories into page, code and data. An entry that no read touches has no effect. The prototype's spelling is repeatable keys on the renderer's query:

```
toss-render.html?refs=mehrlander/web-tools@viewer-improvements&refs=mehrlander/web-tools-private@supporting-data#data=mehrlander/home@revised-records:projects/example/records.csv
```

The existing parameters are spellings of the same thing. `?lib=X` is the entry `mehrlander/web-tools@X`. The address's `@ref` is the target's own version. A page's `?data=<ref>` is that page's entry for one repository.

**Experiment E11**, `tools/test/showing-refs-probe.mjs`, applies the prototype as patches to the bytes the harness serves, so nothing committed carries it, and `--unpatched` runs the same cases against the shipped code. Four places change:

- The renderer reads the map, reads the target at the address's `@ref` (or the map's entry when the address names none), reads the target repository's other files at the map's entry, boots Web Tools at the map's web-tools entry, and stamps the map into the page as `window.__refs`.
- The GH client consults `window.__refs` only where no ref is named: a client constructed without one, and a contents read without `?ref=`.
- The app forwards the map on every view address it mints.
- The top-mode launcher stamps the map from the same query keys.

### Level 1: one version per repository

**Where the loader can apply it.** A survey of every ref choice in the four repositories on 2026-09-29 (browser code only; `dist/`, `tools/` and `scripts/` skipped) found about 140 sites. They fall into four classes:

| Class | Sites | Meaning | Under the map |
|---|---|---|---|
| Explicit `main`, deliberate | about 52, of which about 41 read the registry or session store | Live shared state written on main (`state/`, caches, notes, errands); the folders a device writes (`library.html` `DEVICE_REF`, `push-shortcuts`, `shortcut-log`); a main-versus-branch comparison (`shortcut-log`); the budget-drs appendix, which shows other owners' live pages; `lib/entry.js` itself | Untouched, because the ref is explicit |
| Explicit `main` that only states today's default | about 24 | `.web-tools.json` reads, the routes manifest in `state-view.js`, `docs/tools.csv` in `tools.js`, the home text-collection kits (`md-history`, `md-variants`, the FAB's `TEXT_COLLECTION_REF`), address fallbacks such as `@ref` else `main`, `GH`'s own constructor default | Untouched until each names no ref, which is a behaviour change for its reader and belongs with the change that needs it |
| Already follows a selection | about 50 | `entry.js`, the renderer, the app's view addressing, pages reading `?data=`, `?use=` or `__ref` | Follows the map where it reads `use`, `__lib` or `__ref`; a page's own parameter still comes first |
| Names no ref | about 16 | Contents reads with no `?ref=`, and a few computed default branches | Follows the map through the GH client |

The counts are approximate, since similar sites are grouped. So the map applies consistently at two points, the renderer and the GH client, and the rule that makes it safe is the one the prototype uses: **an explicit ref is never rewritten, `main` included.** That rule is what keeps the deliberate pins where they are without a list of exceptions. It is also why a blind override (a map applied to every read of a repository, the placement PR #823's draft named) stays ruled out: it would move `library.html`'s device folders to the preview ref, which is the 2026-08-18 bug that page's comments record.

**Precedence, strongest first:**

1. A read the code pins on purpose, as in the first class above.
2. The target file: the address's `@ref`; with none, the map's entry for its repository; with neither, the default branch.
3. A page's own parameter for a repository (`?data=`), because the page reads it before anything else. Measured: `?data=own-br` beat a map entry of `data-br` (R2d).
4. The map's entry for the repository. The renderer's `?lib=` is the web-tools entry and ranks here, above a `lib` inside the page query, as it does today.
5. The implied selection: the target's `@ref` for the rest of its own repository, and for a web-tools target, its Web Tools code.
6. The code's default.

**What adopting it costs a page.** A page that reads another repository through the GH client with no ref follows the map with no change. A page that already chooses such a ref with its own parameter needs one line, putting the map between its parameter and `main`. Measured on `library.html`: the map alone left its curated data at main (R2), and with the one-line change the curated files moved to `data-br` while the device folders stayed at main (R2p). The same line applies to `entities.html` and `citations.html` for the private repository, and to `links.html`, `news.html` and `text-lab.html` for home, whose `?data=` does not consult `__ref` at all.

**A defect the map fixes.** `entities.html` and `citations.html` fall back from `?data=` to `window.__ref`, the page's own web-tools ref, and apply it to `mehrlander/web-tools-private`. Measured: a web-tools view at `view-br` read `state/entities.json` from the private repository at `view-br` (R5), a branch name that repository need not have. This is the cross-repository defect of case C9 in a page rather than in the renderer. With the one-line change the read followed the map's entry (R5p).

### Level 2: an explicitly versioned target

**A web-tools page from a branch, its dependencies at main.** `?refs=mehrlander/web-tools@main#gh=mehrlander/web-tools@page-br:pages/diff-tool.html` read the page at `page-br` and ran every other web-tools file at main (R4). It differs from today's `?lib=main` in one respect: the page's relative `<script src>` files are inlined at main, not at the page's branch, because the map names the repository and those files are in it. For a web-tools page those files are library code, so the map's reading is the consistent one; a page whose own relative scripts are the change under review should name that branch, not main.

**An app at one version, one view at another.** The app at this branch with a hub view whose own ref is `view-br`: the view's page and its Web Tools ran at `view-br`, and the map arrived in the nested document intact (R5). A home view that names no ref read its page and its inlined files at the map's `home-br` (R6). The rule that makes both work is that **the app forwards the map as given and never adds the address's `@ref` to it.** An implied selection stays local to the document it was implied in, so a view's own ref is never outranked by its parent's page ref, and the app's existing rule, a hub view with no ref takes the app's page ref, stays as it is.

### Level 3: finer overrides

None is proposed. The survey found no script or stylesheet loaded from another version of the same repository. The splits that exist are between documents rather than within one: the renderer runs main's code around a page at any version, and a page shell comes from the deployed site while its code comes from `?use=`. The one place a per-file override might seem useful is a pre-built bundle, and it cannot reach one: `dist/app.js` and `dist/web-tools.js` answer every library path they hold from their own build (`GH.prototype.get` is replaced and keyed on the path alone), so a bundle runs as one commit's library, and selecting the bundle's ref is the finest selection it supports. A separately loaded file (`gh.load` after the boot, a relative script the renderer inlines) could be selected per file, but no case needing it has come up.

### Nesting, navigation, reload and removal

- **Frame mode.** The map rides on the renderer's query, which the page's navigation never touches, so a reload keeps it. The app forwards it on each view address, and the nested renderer stamps it again (R5, R6).
- **Top mode.** The map rides as real query keys beside `gh`. The app rebuilds its query from a list of the keys it owns and keeps the others, so the map survived the app's own navigation and a reload, and the hub and home views it then addressed carried it (R7). The launcher collapsed a repeated key to its first value until this round (fixed; it dropped the second `refs` entry).
- **Removal.** Dropping the `refs` keys returns every read to its default (R1c). The map is stored nowhere else.

### Limits

- **Harness only.** Refs need not exist: the harness answers a ref the local checkout has from git, and any other from the working tree. Live and device behaviour are unmeasured.
- **The deployed renderer does not read the map.** The app addresses its views to the deployed renderer, so the forward works only once the renderer change is on main.
- **home's budget-drs app frames its tenants itself.** It stamps `__ref` and `__lib` into each tenant but not `__refs`, so the map stops there (read, not measured); two lines would carry it. It also always stamps `__lib`, which invents a selection the renderer deliberately does not.
- **`window.__ref` changes meaning slightly.** In the prototype it names the ref the page's own repository is read at, which is the map's entry when there is one, rather than the address's `@ref`. Home pages read it for exactly that purpose.
- **Reads outside the two points** do not follow: raw URLs, `GH.flatTree`, and direct `fetch` calls to the API.

### Recommendation

Adopt the map as the one selection model, in the form measured and no larger:

1. The renderer reads repeatable `refs=owner/repo@ref`, stamps `window.__refs`, and applies it to the target, to the target repository's other files, and to the Web Tools boot. `?lib=` stays as the short spelling of the web-tools entry, and the address's `@ref` as the target's.
2. The GH client consults the map only where no ref is named.
3. The app forwards the map on every view address, and home's budget-drs app forwards it to its tenants.
4. Pages that choose another repository's ref adopt it in one line each: `library.html`, `entities.html`, `citations.html`, and home's `links`, `news` and `text-lab`.
5. The literals that only state today's default change when a change needs them, not in bulk.

Not proposed: path-scoped entries, per-file overrides, and rewriting any ref a read names explicitly. The earlier recommendation in this section, no map until a page reads two repositories at independent refs, understated what the map fixes today: it gives the app's views a selection their own query cannot carry, and it closes the `entities`/`citations` defect.

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
| E10 | Renderer version (A) against top mode (B), same scenarios, and an explicit `lib=main` through navigation and reload (S5) | Done in Chromium, `showing-mode-compare.mjs`; the device half is the checks above |
| E11 | One selection map for every repository a target reads | Done in the harness, `showing-refs-probe.mjs`, as in-flight patches; `--unpatched` is the baseline |
| E7 | A path address served by a 404 page | Needs a deploy |
| E8 | Independent selection, read from what ran | Done; `showing-selection-probe.mjs`, cases X1 to X11 |
| E9 | The same selections against live GitHub | Partly done, 2026-09-28, `showing-live-probe.mjs` through the sandbox's proxy. **The deployed renderer** booted a shortcut-tools page's Web Tools at `claude/doc-simplification-followups-n6ft2r`, a shortcut-tools branch name that web-tools also has, and GitHub served it: the cross-repo defect in its silent form. **This branch's renderer**, nested and given `?lib=<commit>`, booted the page's Web Tools at that commit. The proxy dropped later reads in every attempt, so the private data the page consumed is not established live; the harness has it (X11) |
| — | Which inliner candidate empties the budget-drs app's panes | Open, from `app-frame-outruns-the-inliner` |

## Earlier rounds

- **Still useful**: the probes; the harness fixes (real blob shas, the sha media type, and the warning that a stale local `main` misreports `?ref=main`); the finding that the checks reported what was asked rather than what ran, which the FAB now reads directly.
- **Optional, and possibly on the path to superseding `?use=`**: top mode (E6) and the path address (E7). Both answer items 1 and 2 above.
- **Optional, not on the path**: a shared render kit to remove the app's middle renderer document.
- **Withdrawn**: redirecting a toss to a deployed `?use=` page.
