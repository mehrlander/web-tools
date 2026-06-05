# tools/ — headless render + bundle harness

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
| `npm run preview <page>` | **Logic** render under jsdom. DOM correctness + which `x-data` mounted. No pixels. (Pre-existing; resolves URLs inline.) |
| `npm run shot <page> [--bundle] [--ref R] [--full] [--out p.png]` | **Pixel** render with the pre-installed Chromium → PNG. Runs the real `gh.load` chain. |
| `npm run bundle <page>` | Build `dist/<page>.js`: the offline form of the page's `gh.load` chain. |
| `npm run verify-bundle <page>` | Build + render live + render via bundle, assert the two are **byte-identical**. |

Shared internals: [`lib/cdn.mjs`](lib/cdn.mjs) (URL → local classification, used by
the renderer) and [`lib/graph.mjs`](lib/graph.mjs) (static walk of a page's
`gh.load`/`_selfLoad` graph, used by the bundler).

Outputs land in `tools/.preview/` (PNG + a `.shot.log` listing intercepts,
`__loadedScripts`, console, errors). `dist/` and `tools/.preview/` are gitignored.

## The bundle, and how a page adopts it

`bundle.mjs` does **not** rewrite the dependency graph. It emits the real
`gh-api.js` loader with `GH.prototype.get` overridden by an inlined cache of every
own-repo file the page reaches. The actual loader runs — same strip+wrap+execute,
same `gh-boot` registry/attribution, same `read()` tracking — only the source
bytes come from memory instead of the API. Third-party libs are untouched: they
stay on the page's CDN `<script>`/`<link>` tags.

Because the cache is just a `path → source` map that `gh.get` looks up, **load
order is irrelevant** — the bundler collects the reachable *set*, including lazy
`_selfLoad` targets (fab's console panel, the bundle kit), so the bundled page is
fully offline-capable.

A page adopts it by swapping one line — its loader import:

```js
// gh-for-review (unchanged): runtime loads from the CDN at ?use=<ref>
await import(`https://cdn.jsdelivr.net/gh/mehrlander/web-tools@${ref}/lib/gh-api.js`);
// bundle (offline / production twin): same chain, served from the inlined cache
await import('../dist/diff-tool.js');   // or inline the file in a <script type=module>
```

Everything after that line (the page's `gh.load('kits/…')` calls) resolves from
the cache. The bundle still honors `?use=<ref>`: an explicit ref falls through to
the network, so a bundled page can be re-pinned for review. This is the
**bundle-for-production / gh-for-review** split — one source line, two modes.

`verify-bundle` is the guarantee: on every page tried so far the bundle render is
MD5-identical to the live `gh.load` render.

## Extending

- **New third-party dep shows up MISS in a `.shot.log`?** `npm i -D` it; the
  resolver maps `npm/<pkg>[@ver]/<file>` and unpkg paths to `node_modules`
  automatically. Add an entry to `CDN_DEFAULT` in `cdn.mjs` only when a package's
  CDN-default file differs from its npm `main`/`browser` (as for the Alpine
  globals and daisyUI's compiled CSS).
- **`esm.sh` modules are not vendored** (e.g. `kits/cm6.js`'s CodeMirror 6). They
  load lazily, so a page still boots and screenshots; the editor just won't mount
  until used. Vendoring esm.sh's bundled output is the open piece for cm6 pages.
- **Bake-to-HTML** (inline the bundle into a single standalone `.html`) is the
  natural next artifact: `screenshot.mjs --bundle` already rewrites the loader
  import to the local bundle, so the same transform, writing HTML instead of a
  PNG, produces a baked page. Deliberately not built yet.
- **Production wiring** (a live page actually loading `dist/<page>.js`) would mean
  committing or CI-deploying `dist/`; left as a decision for when a page wants it,
  with the one-line swap above as the mechanism.
