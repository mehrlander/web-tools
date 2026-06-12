# Testing HTML/JS in the sandbox

*(verified 2026-06-05)*

The sensible way to exercise a page or component here. Builds on the browser and
network facts in [capabilities.md](capabilities.md): reach for the **lightest
tool that proves the thing** —

- **real pixels / layout / gesture** → the pre-installed **Chromium** via
  Playwright (the binary inventory is in
  [capabilities.md](capabilities.md#browsers--headless-rendering-available));
- **inline scripts / component logic, but not pixels** → **jsdom** with the real
  Alpine runtime;
- **static traversal only** → **cheerio / linkedom** (Node) or a Python parser.

The sections below go from heaviest to lightest.

## Driving Chromium for screenshots

Drive it with Playwright and screenshot (proven against a vendored-Alpine page:
Alpine ran reactively and the PNG rendered):

```bash
npm i playwright@1.56.0        # binary already on disk; no browser download
```

```js
import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--no-sandbox'] });   // env var finds the binary
const p = await b.newPage();
await p.goto('file:///tmp/site/page.html');                    // or http://localhost:PORT/
await p.screenshot({ path: '/tmp/site/shot.png', fullPage: true });
await b.close();
```

**Chromium and the TLS proxy.** Chromium ships its own trust store and doesn't
trust the sandbox's inspection CA, so any `https://` URL, even an allowed host,
fails with `net::ERR_CERT_AUTHORITY_INVALID` unless you launch with
`args: ['--no-sandbox', '--ignore-certificate-errors']`. (curl / Python / Node
use the system CA bundle, which already trusts the proxy, so they don't need it.)
The flag doesn't bypass the allowlist: denied hosts still return the proxy's 403
page, you just see it as page content instead of a TLS error.

## Rendering a repo page

The browser works, but a repo page won't boot *as-is*: it pulls Alpine / Tailwind
/ daisyUI / Phosphor from jsDelivr + unpkg, which are denied. Two paths:

- **Vendor the deps, then render.** `npm install` the libraries (or copy their
  `dist` files) and rewrite the page's `<script src>` to local paths, serve over
  loopback (`python3 -m http.server` / `npx serve`), and drive with Playwright.
  Confirmed: a page using npm-vendored Alpine rendered with full reactivity and
  screenshotted. This gives real pixels / layout, not just logic.

  This is now a tool, not a recipe: **`npm run shot <page>`**
  ([`tools/render/screenshot.mjs`](../../tools/render/screenshot.mjs)) serves the working tree
  over loopback and intercepts every external request via
  [`tools/render/cdn.mjs`](../../tools/render/cdn.mjs) — own code (the jsDelivr `/gh/`
  `gh-api.js` import, then the contents-API loads) to local files, third-party
  libs to `node_modules`. The real `gh.load` chain runs unmodified against branch
  code with no token; output is a PNG + a log of intercepts / `__loadedScripts` /
  errors under `tools/.preview/`. *(verified 2026-06-05: `sheet-modal-demo`,
  `cross-repo-read-demo`, `fab-sidebar-test` all rendered with the full chain and
  zero errors.)* The jsdom logic-level twin is `npm run preview`: it **runs the
  full gh.load chain and mounts Alpine** (verified 2026-06-05 — all six gh.load
  pages boot, `Alpine 3.15.x`, components inject their templates), then reports
  each `x-data` container and a `boot:` line. jsdom executes neither module
  scripts nor dynamic `import()`, so preview rewrites the page's `<script
  type="module">` boot into a classic async IIFE and swaps the `import(gh-api.js)`
  call for an in-realm shim that runs gh-api with its `import.meta.url`
  self-bootstrap intact (see the header comment in `tools/render/preview.mjs`). The same
  no-dynamic-`import()` limit hits kit code the chain loads: a kit's `await
  import(...)` runs via `new Function` in jsdom's realm, which has no host import
  hook. preview rewrites the one such call it can satisfy — `kits/persistence.js`'s
  idb-keyval load — to a `window.__pvImport` shim that returns the **vendored**
  idb-keyval, so persistence round-trips for real over `fake-indexeddb` (verified
  2026-06-05: `save`/`load` preserve `Uint8Array` via structured clone). The
  rewrite is surgical by URL; `compression`/`cm6`'s remote imports are left alone
  (some sit inside template strings that emit user-facing snippets, so a blanket
  rewrite would corrupt them). Two jsdom gaps remain, **reported but non-fatal**
  (the harness no longer dies on them): `esm.sh` modules can't be dynamically
  imported, so `kits/cm6.js` (CodeMirror) fails to mount — same as the build/shot
  path, which also don't vendor esm.sh — and there are no real pixels. (A page
  that calls a live, non-repo GitHub API endpoint offline — e.g. `gist-editor`'s
  `/gists` — gets an empty JSON array back, so it renders its empty state instead
  of throwing on `res.json()`.) Reach for `shot` for pixels; preview is for logic
  / "did the components mount + what state". See
  [`tools/README.md`](../../tools/README.md) for the build/verify companions
  (`npm run build` emits an offline `dist/<page>.js`; `--build` / `verify-build`
  render through it). *(2026-06-10)* `cdn.mjs` honors jsDelivr `/+esm` imports by
  serving the package's ESM entry (`exports["."].import` / `module`) instead of
  the UMD/browser default, so `import { get } from '…idb-keyval@6/+esm'` works
  vendored. A CJS→ESM gap remains in principle — jsDelivr bundles a CJS
  dependency graph into ESM server-side, which the local resolver can't do — but
  no rendered page currently hits it: the lazy parsers from PR #162 mean
  snapshot-backed pages never request `fast-xml-parser` (only the interactive
  fetch path would). *(2026-06-11)* The earlier note blaming it for
  `wsl-sync.html` rendering header-chrome-only was a misdiagnosis: the actual
  cause was `tabulator-tables` not being npm-installed (an unvendored spec in a
  `/combine/` URL serves as empty). Vendored, both wsl-sync pages render fully.
  Two lessons: a `MISS` in the intercept log is the first thing to check before
  suspecting resolver semantics; and a package with no `jsdelivr`/`browser`
  field needs a `CDN_DEFAULT` entry in `cdn.mjs`, else the non-ESM fallback
  picks `module` — an ESM file that throws inside a classic `<script>` (real
  jsDelivr falls back to `main`). `cdn.mjs` also mirrors jsDelivr's
  auto-minification: a requested `.min.js`/`.min.css` subpath falls back to the
  unminified tarball file when the tarball ships no minified copy (codemirror@5).
  *(2026-06-12)* **Where the "no token" data comes from: the checkout, not the
  API.** `cdn.mjs` impersonates the GitHub API *for this repo only* (the
  hardcoded `REPO`) from the on-disk working tree: contents listings via
  `readdirSync`, file reads via `readFileSync` in the API's JSON envelope, plus
  `/repos/<REPO>` metadata (a stub) and `git/trees` (a recursive walk). So a
  headless render never authenticates and never leaves the box for own-repo
  data, and it shows *uncommitted* branch truth, which is the point. Any
  *other* repo's API calls pass through to the real network and die on the
  sandbox's spent anonymous quota. This sorts pages into three render
  categories: **self-contained** (code only: renders), **repo-content** (own
  repo's files/tree: renders, served locally), and **identity-bound** (first
  paint gated on "who am I", e.g. `gh.repos()`: renders only the gh-auth token
  wall). The containment pattern for the third: boot identity-free when
  `?repo=` is given (`repo.js pickByName` + the background `setup({quiet:
  true})`, with gh-auth's per-request `quiet` flag), which drops the page into
  category two; nav-repo is the worked example, shot via
  `npm run shot -- pages/nav-repo.html --query "repo=mehrlander/web-tools&file=README.md"`.
- **Preview a page already on main.** GitHub **Pages serves `main`**. The
  `?use=<ref>` convention swaps which ref the page's *loaded code* comes from, but
  **not the page's own HTML shell**: that's whatever main serves. So a brand-new
  page must reach `main` before it can be opened at its Pages URL at all. For
  branch edits to a page already on main, the FAB's "Render page" tab fetches the
  page HTML at a chosen ref via the contents API and hosts it in an `srcdoc`
  iframe (see `README.md`). That doesn't help a page that's never been on main.

## Parsing / testing HTML without a browser

When you don't need pixels, lighter tools (all installable via npm/pip here):

| Tool | Lang | Runs `<script>`? | Use when |
|---|---|---|---|
| **cheerio** | Node | No | jQuery-style traversal of static markup |
| **linkedom** | Node | No | DOM API on static markup |
| **happy-dom** | Node | Sometimes (construction-dependent) | lighter DOM, partial JS |
| **jsdom** | Node | Yes (`runScripts: 'dangerously'`) | inline scripts must execute |
| **BeautifulSoup / lxml / selectolax / parsel** | Python | No | Python-side traversal |

### Logic-testing Alpine components with jsdom

*(verified 2026-05-30 against `alpineComponents/sheet-modal.js`)*

Load a component into **jsdom** and drive it with the **real Alpine** runtime,
verifying DOM structure, class/state logic, and event wiring. Not pixels, not real
pointer-drag (use the pre-installed Chromium for those), but it caught the real
bugs. Setup: `npm i alpinejs jsdom`, load the component source with
`new window.Function(src)()` after Alpine is registered, then `Alpine.start()`.

Gotchas that cost iterations (do these or it throws):

- **Node 22 ships its own global `Event` / `CustomEvent`.** Alpine mints events
  with them and dispatches on jsdom nodes → cross-realm `dispatchEvent` throw.
  Fix: `global.Event = window.Event; global.CustomEvent = window.CustomEvent`.
- **Expose the DOM globals Alpine reaches for:** `ShadowRoot`, `Node`,
  `HTMLElement`, `DocumentFragment`, `MutationObserver`, `Element`,
  `customElements` (assign each from the jsdom `window`).
- **jsdom has no `matchMedia`:** polyfill it (and make `matches` settable so you
  can simulate breakpoint flips). **No `requestAnimationFrame`** either, so polyfill.
- Read component state back with `Alpine.$data(el)`; let `$nextTick` callbacks
  flush with a couple of `await setTimeout` ticks before asserting.

What it proves: slot/innerHTML handling, reactive `:class` branches, `open/close`
state, event-driven triggers, `matchMedia`-driven logic. What it doesn't: visual
correctness (no CSS framework loads) and gesture physics (synthetic pointer
streams aren't real input).

**Test the eager path, not just the lazy one.** A first pass of the sheet-modal
test only put `@click="close()"` in the slot and passed, but `@click` is *lazy*
(evaluated on click), so it never exercised init-time evaluation. A real
`x-text="isDesktop ? …"` in the slot throws *at startup*. If a component reads its
own scope from slotted markup, the test slot must include an **eagerly-evaluated**
binding (`x-text` / `:class` / `x-effect`), or the test gives false confidence.
Capture startup warnings by stubbing `console.warn` / `console.error` and a
`window` `error` listener; assert the count is zero.

**Alpine "slots" without a custom element: preserve the slot nodes, don't rebuild
them.** A component that accepts caller-provided children and renders its own
chrome around them must NOT do `body = $el.innerHTML; $el.innerHTML =
shell(body)`. Measured cause: by the time `init()` runs, Alpine has already queued
reactive effects on the original child nodes; rebuilding from a string discards
those nodes, and the orphaned (now detached) effects throw when they flush
(`"isDesktop is not defined"`), even though a second `initTree` makes the visible
result look correct. Bare children left *in place* bind fine (scope chains down
the tree); it's the rebuild that breaks them. Fix that needs no caller
cooperation: move the existing children into a fresh body element (`appendChild`
preserves node identity + queued effects), assemble the chrome around them
**synchronously**, reattach, then `initTree` only the new chrome (it skips
already-initialized nodes, so no double-bind). A `<template>` wrapper also works
(its content is inert, never walked) but pushes a tag onto every caller.

*(2026-06-11)* That follow-up is built: **`tools/test/bootstrap.mjs`**
packages this whole section — `makeWindow()` applies the six globals, the
matchMedia/rAF polyfills (matchMedia is flippable via the returned
`setMedia(bool)`, for breakpoint-flip tests), and warning/error capture (the
returned `problems` array; assert it stays empty); `startAlpine(window,
[paths])` loads components and boots the real Alpine. Its `loadKit()` half
runs a `lib/kits/*.js` file in the Node realm with the kit's lazy CDN
`import()`s rewritten to npm-vendored copies. `npm test` runs the suites
beside it (one `*.test.mjs` per kit/component, `node --test`, ~76 tests).
Two lessons from building it, beyond the gotchas above:

- Import **`alpinejs/dist/module.esm.js`**, not bare `alpinejs` — the package
  has no `exports` map, so bare resolution lands on the CJS build, whose
  default export arrives double-wrapped under Node interop (`Alpine.start is
  not a function` is the symptom).
- Patch **`global.requestAnimationFrame`** too, not just the window's —
  Alpine's `x-show` transitions call it bare in the Node realm.

The suite caught a real bug on its first run: `kits/persistence.js` cached
IDB connections with no `versionchange` handler, so layering a second store
onto the same database (or any other tool's upgrade) blocked the version
bump forever — reproduced in a real browser too, fixed in the kit.
