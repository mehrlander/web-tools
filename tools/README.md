# tools/ — headless render + build harness

Node tooling for exercising repo pages inside the Claude Code web sandbox, where
the JS CDNs our pages use at runtime (jsDelivr, unpkg) are blocked and there's no
GitHub token. See [`docs/environment/`](../docs/environment/) for the sandbox
facts these build on.

Everything here resolves the same two networks of dependencies to local files:

- **Own code** — the page's first jsDelivr `/gh/` import of `gh-api.js`, then
  every `gh.load()` after it via the GitHub contents API → the on-disk working
  tree (so a render reflects branch edits, not what `main` serves; no token).
- **Third-party libs** — Tailwind / daisyUI / Phosphor / Alpine off jsDelivr +
  unpkg → npm-installed copies under `node_modules`.

## The tools

| Command | What it does |
|---|---|
| `npm run preview <page>` | **Logic** render under jsdom: runs the full `gh.load` chain, mounts Alpine, reports which `x-data` containers mounted + their state. No pixels; `esm.sh`/cm6 can't load (reported, non-fatal). jsdom runs no module scripts or dynamic `import()`, so the boot block is rewritten to a classic IIFE with the `import(gh-api.js)` call shimmed. |
| `npm run shot <page> [--build] [--ref R] [--script s.mjs] [--full] [--out p.png]` | **Pixel** render with the pre-installed Chromium → PNG. Runs the real `gh.load` chain (or the build, with `--build`). `--script` drives the page into a state first (see below). |
| `npm run build <page>` | Emit `dist/<page>.js`: the offline form of the page's `gh.load` chain. |
| `npm run bake <page>` | Emit `dist/<page>.html`: the chain inlined into a standalone page. |
| `npm run verify-build <page>` | Build + render live + render via the build, assert the two are **byte-identical**. |

Shared internals: [`lib/cdn.mjs`](lib/cdn.mjs) (URL → local classification, used by
the renderer), [`lib/graph.mjs`](lib/graph.mjs) (static walk of a page's
`gh.load`/`_selfLoad` graph), and [`lib/kit-shim.mjs`](lib/kit-shim.mjs) (run a
browser kit in Node). The build/bake *format* lives in
[`../lib/kits/build.js`](../lib/kits/build.js) (`window.buildKit`) — one emitter
shared by `build.mjs`/`bake.mjs` (Node, static cache) and `kits/export.js`
(browser, runtime cache) so the two can't drift.

Outputs land in `tools/.preview/` (PNG + a `.shot.log` listing intercepts,
`__loadedScripts`, console, errors). `dist/` and `tools/.preview/` are gitignored.

### Driving state before the shot (`--script`)

`--script <file.mjs>` runs an interaction step after the page settles, so a render
can capture a *state* — a drawer open, a toggle ticked, a breakpoint — not just the
landing view. The file default-exports `async (page, ctx) => {}` and gets the
Playwright `page` (`ctx.repoRoot` too). Scenarios live in
[`tools/scenarios/`](scenarios/); the PNG/log pick up the scenario name in their
suffix. Example — the FAB's Export controls, opened to the Render tab with "Fully
offline" ticked:

```
npm run shot pages/sheet-modal-demo.html \
  -- --script tools/scenarios/fab-export.mjs --out tools/.preview/fab-export.png
```

Two harness facts a scenario sometimes has to work around (the FAB one does both):
the FAB opens via pointer drag/tap physics that synthetic input doesn't drive
reliably, and its render-tab content is gated by `<template x-if="path">` where
`path` is inferred from a `*.github.io` URL (empty on the `127.0.0.1` loopback). So
a scenario may set component state through `window.Alpine.$data(host)` to reach the
state a real Pages URL would have, then exercise the actual control via the UI.

## Where "the build" sits — and why it stays off the dev path

`build.mjs` does **not** rewrite the dependency graph. It emits the real
`gh-api.js` loader with `GH.prototype.get` overridden by an inlined cache of every
own-repo file the page reaches. The actual loader runs — same strip+wrap+execute,
same `gh-boot` registry/attribution, same `read()` tracking — only the source
bytes come from memory instead of the API. Third-party libs are untouched: they
stay on the page's CDN `<script>`/`<link>` tags.

Because the cache is just a `path → source` map that `gh.get` looks up, **load
order is irrelevant** — the build collects the reachable *set*, including lazy
`_selfLoad` targets (fab's console panel, the export kit), so the built page
is fully offline-capable.

The build and the runtime loader **optimize opposite things**. `gh.load` exists
for freshness — edit a file, see it immediately — fetching own code through the
contents API (not jsDelivr) precisely to dodge CDN caching. The build is the
opposite: a *delivery snapshot*, regenerated on demand, not polled. So the build
should never go back onto jsDelivr (that reintroduces the 12h branch-tip cache the
loader was written to avoid). Its caching-free homes are:

- **Inlined into HTML** (see "bake", below) — nothing to fetch; the code is in the
  document.
- **A same-origin Pages asset** (`<script src="../dist/x.js">`) — normal Pages
  caching (~10 min, ETag-revalidated), hard-bustable with `?v=<sha>`. For a shipped
  page, not the inner loop.

A page adopts the build by swapping one line — its loader import:

```js
// gh-for-review (unchanged): runtime loads from the CDN at ?use=<ref>
await import(`https://cdn.jsdelivr.net/gh/mehrlander/web-tools@${ref}/lib/gh-api.js`);
// the build (offline / production twin): same chain, served from the inlined cache
await import('../dist/diff-tool.js');
```

Everything after that line resolves from the cache. The build still honors
`?use=<ref>` (an explicit ref falls through to the network), so a built page can be
re-pinned for review. This is the **gh-for-review / build-for-delivery** split —
one source line, two modes. `verify-build` is the guarantee: on every page tried so
far the build render is MD5-identical to the live `gh.load` render.

## Vocabulary (load → build → bake → pack)

Four distinct steps, kept on four distinct words so "bundle" stops meaning three
things:

- **load** — the fresh, per-file, ref-pinnable runtime path (`gh.load`). The dev /
  review loop.
- **build** — a snapshot of a page's own **code** graph → `dist/<page>.js` (this
  tool). `vanilla-bundle.js` / `alpine-bundle.js` keep "bundle" as hand-authored
  runtime grab-bags — distinct from a build-produced graph.
- **bake** — inline a build into a page's HTML to get one standalone document.
  `tools/bake.mjs` rewrites the page's `gh-api.js` import to a `data:` module
  carrying the build, so the page boots with zero own-code network (verified
  byte-identical to live on `sheet-modal-demo`).
- **export** — [`lib/kits/export.js`](../lib/kits/export.js)'s "page + the data it
  `read()`s" zip (the FAB's **"Export"** button, `window.exporter`). Runtime;
  **data** by default, **`{ offline: true }`** also bakes the code in.

So "bundle" now means only the hand-authored grab-bags (`vanilla-bundle.js`,
`alpine-bundle.js`); the four verbs above are the pipeline.

**bake + export compose** into a page that opens with no network at all:
`kits/export.js`'s `{ offline: true }` mode (the FAB's **"Fully offline"** toggle)
bakes the code in *and* lays the `read()` data out local-first, in one zip. The
browser gathers the cache from `window.__loadedScripts` and calls the same
`window.buildKit` emit/bake the Node tools use.

## Extending

- **New third-party dep shows up MISS in a `.shot.log`?** `npm i -D` it; the
  resolver maps `npm/<pkg>[@ver]/<file>` and unpkg paths to `node_modules`
  automatically. Add an entry to `CDN_DEFAULT` in `cdn.mjs` only when a package's
  CDN-default file differs from its npm `main`/`browser` (as for the Alpine
  globals and daisyUI's compiled CSS).
- **`esm.sh` modules are not vendored** (e.g. `kits/cm6.js`'s CodeMirror 6). They
  load lazily, so a page still boots and screenshots; the editor just won't mount
  until used. Vendoring esm.sh's bundled output is the open piece for cm6 pages.
