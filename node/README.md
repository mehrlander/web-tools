# node/: headless render + build harness

Node tooling for exercising repo pages inside the Claude Code web sandbox, where
a render cannot count on reaching the JS CDNs or GitHub and there's no GitHub
token. See [`docs/environment/`](../docs/environment/) for the sandbox facts
these build on.

Everything here resolves the same two networks of dependencies to local files:

- **Own code**: the page's `lib/entry.js` import from GitHub Pages, the
  `gh-api.js` it fetches from raw.githubusercontent, then every `gh.load()`
  after it via the GitHub contents API → the on-disk working tree (so a render
  reflects branch edits, not what `main` serves; no token).
- **Third-party libs**: Tailwind / daisyUI / Phosphor / Alpine off jsDelivr +
  unpkg → npm-installed copies under `node_modules`.

## Layout

Three categories, one folder each, plus one folder of generated input (they
share no module imports; render and build touch only via subprocess and the
`dist/` artifact):

- [`render/`](render/): exercise a page headlessly, offline. `preview.mjs`
  (jsdom logic render) + `screenshot.mjs` (Chromium pixel render) +
  `netlog.mjs` (Chromium request log: what a load costs, by host and endpoint,
  writes blocked), with
  `cdn.mjs` (the URL → local resolver) and `scenarios/` (interaction scripts).
- [`build/`](build/): snapshot a page's own-code graph into an offline
  artifact. `build.mjs` / `bake.mjs`, with `graph.mjs` (the static `gh.load`
  walk) and `kit-shim.mjs` (run a browser kit in Node). `verify-build.mjs` is
  the bridge: it drives the render tools to prove a build matches live.
- [`test/`](test/): the unit/logic suite behind `npm test` (`node --test`,
  no framework dep). `bootstrap.mjs` carries the shared setup: `loadKit()`
  runs a `lib/kits/*.js` file against a plain `window` with its CDN
  `import()`s rewritten to npm-vendored copies (the preview shim's tactic,
  unit-test-sized), and `makeWindow()`/`startAlpine()` package the jsdom +
  real-Alpine recipe from
  [`docs/environment/testing.md`](../docs/environment/testing.md) for
  component logic tests. One `*.test.mjs` per kit/component beside it.
- [`graphql/`](graphql/): one generated file, the pruned GitHub schema the
  suite typechecks `lib/gh-fetch.js`'s queries against. Tracked, unlike the
  other generated outputs, because the test needs it offline.

The build/bake
*format* itself lives outside `node/`, in [`../lib/build.js`](../lib/build.js)
(`window.buildKit`), one emitter shared by `build/`'s Node tools (static cache)
and `kits/export.js` (browser, runtime cache) so the two can't drift. The
contract that makes all of this possible is in [`../docs/loader.md`](../docs/loader.md).

## The tools

| Command | What it does |
|---|---|
| `npm run setup` | Configure this checkout's committed Git hooks and registry CSV merge driver, install usable development dependencies without a Playwright browser, and finish by checking readiness. Safe to repeat; never regenerates tracked artifacts. `node node/checkout-setup.mjs` is the dependency-free bootstrap when npm itself cannot start; Windows PowerShell can use `npm.cmd run setup` to bypass a broken `.ps1` shim. |
| `npm run ready` | Read-only checkout diagnosis: effective hook paths, merge-driver configuration and attributes, required runtimes, and npm's installed dependency metadata. Works for ordinary clones and linked worktrees without assuming `.git` is a directory. |
| `npm run artifacts:refresh` | Run every commit rule whose `repair` is `yes` over the whole tree, in order, staging what each writes (see [The refresh model](#the-refresh-model)). If verification names a generated file no rule writes, run the command it names. |
| `npm run build`, `generate`, `package`, `check` | Run one kind of commit rule over the whole tree, as `artifacts:refresh` does for every kind. |
| `npm test` | Run the unit/logic suite under [`test/`](test/) with Node's built-in runner: kit behavior, a registration smoke test across every kit, and jsdom + real-Alpine component logic tests. Offline; third-party libs come vendored from `node_modules`. |
| `npm run preview <page>` | **Logic** render under jsdom: runs the full `gh.load` chain, mounts Alpine, reports which `x-data` containers mounted + their state. No pixels; how it rewrites the page is in [`testing.md`](../docs/environment/testing.md). |
| `npm run shot <page> [--build] [--ref R] [--script s.mjs] [--full] [--out p.png]` | **Pixel** render with the pre-installed Chromium → PNG. Runs the real `gh.load` chain (or the build, with `--build`). `--script` drives the page into a state first (see below). |
| `npm run build:page <page>` | Emit `dist/<page>.js`: the offline form of the page's `gh.load` chain. |
| `npm run build:lib` | Emit `dist/web-tools.js`: **the pre-build**, the whole `lib/` as one self-booting offline artifact (see [The pre-build](#the-pre-build)). |
| `npm run build:app` | Emit `dist/app.js`: the app's own pre-build, the part of `lib/` that `app/index.html` can reach, by the same emitter (see [The app's pre-build](#the-apps-pre-build)). |
| `npm run bake <page>` | Emit `dist/<page>.html`: the chain inlined into a standalone page. |
| `npm run verify-build <page>` | Build + render live + render via the build, assert the two are **byte-identical**. |
| `npm run pages-shots` | Regenerate the visual index's card previews, one headless screenshot per page, into web-tools-private's `thumbs/mehrlander/web-tools/`; commit them there. Uses the [`screenshot.mjs`](render/screenshot.mjs) renderer; see [Cataloging the pages](#cataloging-the-pages). |
| `npm run pages-index` | Regenerate both catalogs of every page: [`pages/README.md`](../pages/README.md) (link-dense table) and [`pages/index.html`](../pages/index.html) (visual card index). A *catalog* generator, not part of the code pipeline below; see [Cataloging the pages](#cataloging-the-pages). |
| `npm run pages` | `pages-shots` then `pages-index`: refresh thumbnails and both catalogs in one step. |
| `npm run graphql-schema [-- --check]` | Regenerate [`graphql/github-schema.pruned.graphql`](graphql/): fetch GitHub's published SDL (1.5 MB) and write only the slice `lib/gh-fetch.js`'s queries reach (~2 KB), so `npm test` can typecheck them offline. The **one generator that needs the network**, which is why it stays out of the commit hook and the derived-artifacts gate; the drift guard lives in [`test/graphql-schema.test.mjs`](test/graphql-schema.test.mjs) instead. Run it after editing a query. |
| `node node/build/repo-pages-shots.mjs --repo <owner/name> --root <checkout> --out <thumbs-dir>` | Shoot ANOTHER repo's `pages` catalog into the private thumb cache (`web-tools-private/thumbs/`), so the app's gallery can show clickable screenshots for that repo. Serves the source checkout, vendors CDN libs from this repo's `node_modules`. Not an npm script (it takes a target). |

Shared internals: [`render/cdn.mjs`](render/cdn.mjs) (URL → local
classification, used by the renderer), [`build/graph.mjs`](build/graph.mjs)
(static walk of a page's `gh.load`/`_selfLoad` graph), and
[`build/kit-shim.mjs`](build/kit-shim.mjs) (run a browser kit in Node).

Outputs land in `node/.preview/` (PNG + a `.shot.log` listing intercepts,
`__loadedScripts`, console, errors). `dist/` and `node/.preview/` are gitignored.

### Driving state before the shot (`--script`)

`--script <file.mjs>` runs an interaction step after the page settles, so a render
can capture a *state* (a drawer open, a toggle ticked, a breakpoint), not just the
landing view. The file default-exports `async (page, ctx) => {}` and gets the
Playwright `page` (`ctx.repoRoot` too). Scenarios live in
[`node/render/scenarios/`](render/scenarios/); the PNG/log pick up the scenario
name in their suffix.

Every driver lives there and there is nowhere else to put one.

Example: the FAB's Export controls, opened to the Render
tab with "Fully offline" ticked:

```
npm run shot pages/demos/sheet-modal-demo.html \
  -- --script node/render/scenarios/fab-export.mjs --out node/.preview/fab-export.png
```

Two harness facts a scenario sometimes has to work around (the FAB one does both):
the FAB opens via pointer drag/tap physics that synthetic input doesn't drive
reliably, and its render-tab content is gated by `<template x-if="path">` where
`path` is inferred from a `*.github.io` URL (empty on the `127.0.0.1` loopback). So
a scenario may set component state through `window.Alpine.$data(host)` to reach the
state a real Pages URL would have, then exercise the actual control via the UI.

## Where "the build" sits, and why it stays off the dev path

`build.mjs` does **not** rewrite the dependency graph: it emits the real
`gh-api.js` loader with `GH.prototype.get` reading an inlined cache of every
own-repo file the page reaches, and third-party libs stay on the page's CDN tags
(the design is in [`lib/build.js`](../lib/build.js)'s header and "Load and build
are one contract" in [`docs/loader.md`](../docs/loader.md)).

Because the cache is just a `path → source` map that `gh.get` looks up, **load
order is irrelevant**: the build collects the reachable *set*, including lazy
`_selfLoad` targets, so the built page is fully offline-capable.

The build and the runtime loader **optimize opposite things**. `gh.load` exists
for freshness (edit a file, see it immediately), fetching own code through the
contents API precisely to dodge CDN caching. The build is the opposite: a
*delivery snapshot*, regenerated on demand, not polled. Its caching-free homes
are:

- **Inlined into HTML** (see "bake", below): nothing to fetch; the code is in the
  document.
- **A same-origin Pages asset** (`<script src="../dist/x.js">`): normal Pages
  caching (~10 min, ETag-revalidated), hard-bustable with `?v=<sha>`. For a shipped
  page, not the inner loop.

A page adopts the build by swapping one line, its loader import:

```js
// gh-for-review (unchanged): runtime loads at ?use=<ref>, else main
await import('https://mehrlander.github.io/web-tools/lib/entry.js');
// the build (offline / production twin): same chain, served from the inlined cache
await import('../dist/diff-tool.js');
```

Everything after that line resolves from the cache. The build still honors
`?use=<ref>` (an explicit ref falls through to the network), so a built page can be
re-pinned for review: one source line, two modes. `verify-build` is the
guarantee that the build render is identical to the live `gh.load` render.

## Vocabulary (load → build → bake → export → brief)

Distinct steps on distinct words, so "bundle" means only the hand-authored
runtime grab-bags (`vanilla-bundle.js`, `alpine-bundle.js`):

- **load**: the fresh, per-file, ref-pinnable runtime path (`gh.load`). The dev /
  review loop.
- **build**: a snapshot of a page's own **code** graph → `dist/<page>.js` (this
  tool).
- **bake**: inline a build into a page's HTML to get one standalone document
  that boots with zero own-code network (`node/build/bake.mjs`, through
  `bake` in [`lib/build.js`](../lib/build.js)).
- **export**: [`lib/kits/export.js`](../lib/kits/export.js)'s "page + the data it
  `read()`s" zip (the FAB's **"Export"** button, `window.exporter`). Runtime;
  **data** by default, **`{ offline: true }`** also bakes the code in.
- **brief**: the page and its own modules as one markdown document for a
  reviewer, boot chain left out ([`lib/kits/brief.js`](../lib/kits/brief.js)).

## The pre-build

`npm run build:page` snapshots *one page's* reachable graph. **The pre-build**
(`npm run build:lib` → [`build-lib.mjs`](build/build-lib.mjs)) snapshots the
*whole* `lib/`: every `lib/*.js` inlined into one self-resolving artifact at
`dist/web-tools.js`. It's the same emitter (`lib/build.js`), just seeded
with all of `lib/` instead of a page's boot block, so the format can't drift
from the per-page build, and `verify-build` still holds for pages.

The difference a consumer sees is **one import instead of a `gh.load` chain.**
The artifact auto-boots: importing it runs gh-boot's base chain, registers every
Alpine component, then boots Alpine via `alpine-bundle.js`. A page drops the
whole chain and writes one line:

```js
// loader (dev / freshness): per-file, ref-pinnable, network for own code
await import('https://mehrlander.github.io/web-tools/lib/entry.js');
// pre-build (delivery / simplicity): whole library, one fetch, no own-code network
await import('../dist/web-tools.js');
```

Everything is then live (`x-data="repo()"`, `x-data="counter()"`, etc.) with
no per-component load. The pure kits (`compression`, `persistence`, `io`, …)
ride along **cached but not executed**; a page's `gh.load('kits/x.js')` resolves
instantly from the inlined cache. Third-party libs (Tailwind/daisyUI/Phosphor/
Alpine/CodeMirror) stay on their CDN tags, and `?use=<ref>` re-pins the bundle to
that ref for review through the same raw.githubusercontent fetch and blob import
`lib/entry.js` uses, so a fresh push previews immediately and a branch name is
safe. The no-`?use` path stays the same-origin Pages import.
[`pages/demos/prebuild-demo.html`](../pages/demos/prebuild-demo.html) is the
worked example.

Develop against the `gh.load` chain, ship against the pre-build. A per-page
build is leaner but needs a build per page; the pre-build is one artifact
reused everywhere, and an unused `Alpine.data` registration costs nothing until
an `x-data` references it.

### The app's pre-build

`app/index.html` imports `dist/app.js`, not the whole library:
[`build-app.mjs`](build/build-app.mjs) walks the app's **reach** (every lib path
named as a string literal, transitively, plus every component an `x-data`
names, mapped through its `Alpine.data('name')` registration) and hands that
set to the same emitter. Five heavy kits a reader reaches only by an explicit act
(`annotate`, `pdf`, `dictate`, `xlsx`, `redact`) are left out on purpose and load on
first use through the contents API, which is the loader's ordinary cache-miss
path. The same limit as the per-page walker applies: a path computed at
runtime is invisible, and falls through to the API at runtime, correctly.
Both artifacts are committed and held to `lib/` by the commit hook and by
`derived-artifacts.test.mjs`; `npm run build:app -- --check` is the app's
half of that gate.

**Staying current.** `dist/web-tools.js` is **committed** (an exception to
the gitignored `dist/`, listed in `.gitignore`) and served same-origin by Pages. It's held to
`lib/` by the commit-time hook (see [The refresh model](#the-refresh-model)).
The build is deterministic (sorted cache + sorted boot, no date stamp), so it
only shows a diff when `lib/` actually changed. Don't hand-edit
`dist/web-tools.js`.

**bake + export compose** into a page that opens with no network at all:
`kits/export.js`'s `{ offline: true }` mode (the FAB's **"Fully offline"** toggle)
bakes the code in *and* lays the `read()` data out local-first, in one zip. The
browser gathers the cache from `window.__loadedScripts` and calls the same
`window.buildKit` emit/bake the Node tools use.

## Cataloging the pages

`pages-index.mjs` is the odd one out in this folder: it resolves no dependency
graph and emits no `dist/` artifact. It walks the `pages/` tree, reads each page's
`<title>`, and regenerates **two** catalogs from the same data:

- [`pages/README.md`](../pages/README.md): a dense markdown table, two links per
  page (**rendered** github.io URL + **code** view on github.com). GitHub renders a
  folder's `README.md` beneath its file listing, so it surfaces where you browse.
- [`pages/index.html`](../pages/index.html): the **visual index**, a light-themed
  card per page, grouped by directory, whose default preview is the page's
  screenshot (from web-tools-private's `thumbs/`, read with the viewer's token, and
  generated by `pages-shots.mjs`), or a placeholder with no token, with a toggle to
  a **live** iframe of the page or its **HTML source**. Per-page blurbs live in the
  `NOTES` map at the top of `pages-index.mjs`; edit them there.

The catalogs regenerate automatically at commit time (see
[The refresh model](#the-refresh-model)); `npm run pages` (= `pages-shots` then
`pages-index`) is the manual full refresh, and `pages-index --check` exits non-zero
when either committed catalog is stale, as an audit. The thumbnails are committed
PNGs, so the index stays self-contained rather than re-rendering every page at
view time.

## The refresh model

Run `npm run setup` once in a new clone or linked worktree. It stores a relative
`.githooks` path, which Git resolves in whichever checkout it is working on, and
registers the `derived-csv` merge driver that
[`.gitattributes`](../.gitattributes) names. `npm run ready` reads the hook path
and driver config and writes nothing.

Generated files are refreshed in three places:

- the commit hook, below, commits each deterministic generated file with the
  change to its source;
- [`refresh-derived.yml`](../.github/workflows/refresh-derived.yml) runs
  `npm run artifacts:refresh` on `main` after each push, for writes that ran no
  hook;
- page thumbnails (in web-tools-private's `thumbs/`) are slow and not byte-deterministic,
  and are refreshed once per session, as root `CLAUDE.md` says under
  "Per-session refresh: thumbnails".

**Deterministic generated files are committed with their source.**
[`.githooks/pre-commit`](../.githooks/pre-commit) runs
[`build/commit-rules.mjs`](build/commit-rules.mjs) over the rules in
[`docs/commit-rules.csv`](../docs/commit-rules.csv). A rule is a Make rule:
sources, a command, outputs. In file order, each rule whose sources have a
pending change runs its command and, when the command succeeds, stages its
outputs. A failed command or a missing output prints a warning, and the commit
proceeds. A rule's `kind` is `build` (a built script under `dist/` or
`console/`), `generate` (a catalog, registry or index), `package` (a copy a
plugin ships) or `check` (a warning that writes nothing, printed when its
command exits nonzero).

Most generated files are written whole. Four are not:
[`docs/docs.csv`](../docs/docs.csv), [`docs/harness.csv`](../docs/harness.csv),
[`docs/registries.csv`](../docs/registries.csv) and
[`docs/tests-authored.csv`](../docs/tests-authored.csv) are hand-edited except
for the fields or rows a generator writes. Edit a row freely and leave those
fields alone.

**A rule that writes a file runs before any rule that measures it.** `docs-reach`
writes the word count of every `docs/` file into `docs/docs.csv`. Each rule that
writes under `docs/` comes before it. `docs/README.md` is generated from
`docs/docs.csv` and is also a row in it. After `docs-readme` rewrites it,
`docs-reach-again` runs `docs-reach` once more. `csv-census` measures the staged
bytes of every CSV and comes after every rule that writes one. A word count
written too early fails [`docs-registry.test.mjs`](test/docs-registry.test.mjs) in
CI.

Every generator is byte-deterministic: a commit whose sources did not change
gets identical generated files back. The suite tests determinism directly.

**Automatic local merge commits use the same rules.** Git does not run
`pre-commit` for a clean automatic merge. It runs `pre-merge-commit`, which
runs `pre-commit` on the merged index and compares the index before and after.
Git has already recorded the merge tree by then. When the rules changed a
file, the hook stops the commit and leaves the merge in progress, with the
regenerated files staged. It prints the next step:
`git -c core.editor=true merge --continue`. That command makes an ordinary
commit, which runs `pre-commit` again and then the
[`commit-msg`](../.githooks/commit-msg) checks. When no file changed, the merge
finishes in one command. A conflicted merge does not reach `pre-merge-commit`;
its continuation is an ordinary commit. A fast-forward creates no merge commit,
and `--no-verify` skips every hook.

The registry CSV merge driver and the commit rules divide the work. The driver
unions rows, merges authored cells three-way, and keeps the current side's
value in computed cells. The rules then run over the merged tree and rewrite
those computed cells. Neither takes one side of a CSV whole. Authored rows from
the other branch survive.

GitHub Pages serves `main` as it is, with no deploy build.

[`test.yml`](../.github/workflows/test.yml) runs `npm test` on pull requests
and on pushes to `main`, except pushes limited to `pages/wsl-sync/data/**`.

A write through GitHub's API, MCP or a server-side merge runs no local hooks.
Root [`CLAUDE.md`](../CLAUDE.md#the-pre-build--the-build-on-commit-hook), under
"Verification stays independent", says how to repair the tree it leaves.

A branch can be previewed before merge with `?use=<sha>` because its generated
files are committed.

## Extending

- **New third-party dep shows up MISS in a `.shot.log`?** `npm i -D` it; the
  resolver maps `npm/<pkg>[@ver]/<file>` and unpkg paths to `node_modules`
  automatically. Add an entry to `CDN_DEFAULT` in `cdn.mjs` only when a package's
  CDN-default file differs from its npm `main`/`browser` (as for the Alpine
  globals and daisyUI's compiled CSS).
- **`esm.sh` modules are not vendored** (e.g. `kits/cm6.js`'s CodeMirror 6). They
  load lazily, so a page still boots and screenshots; the editor just won't mount
  until used. Vendoring esm.sh's bundled output is the open piece for cm6 pages.
