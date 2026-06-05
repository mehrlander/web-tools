# Testing HTML/JS in the sandbox

*(verified 2026-05-30)*

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
  ([`tools/screenshot.mjs`](../../tools/screenshot.mjs)) serves the working tree
  over loopback and intercepts every external request via
  [`tools/lib/cdn.mjs`](../../tools/lib/cdn.mjs) — own code (the jsDelivr `/gh/`
  `gh-api.js` import, then the contents-API loads) to local files, third-party
  libs to `node_modules`. The real `gh.load` chain runs unmodified against branch
  code with no token; output is a PNG + a log of intercepts / `__loadedScripts` /
  errors under `tools/.preview/`. *(verified 2026-06-05: `sheet-modal-demo`,
  `cross-repo-read-demo`, `fab-sidebar-test` all rendered with the full chain and
  zero errors.)* The jsdom logic-level twin is `npm run preview` — but note it
  can only inspect a page's static DOM: jsdom's script VM can't run the
  `await import(gh-api.js)` boot every gh.load page uses, so the chain doesn't
  execute and it prints `boot: NOT RUN` (reach for `shot` when you need the chain
  to actually run, or the manual jsdom+Alpine recipe below to drive a component
  in isolation). See
  [`tools/README.md`](../../tools/README.md) for the build/verify companions
  (`npm run build` emits an offline `dist/<page>.js`; `--build` / `verify-build`
  render through it).
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

> A possible follow-up not yet built: a reusable jsdom + Alpine test bootstrap
> (the six globals + polyfills above) so component logic tests don't repeat the
> setup.
