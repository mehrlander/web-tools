# Testing HTML/JS in the sandbox

*(verified 2026-06-12)*

How to exercise a page or component in the Claude Code web sandbox. This file
states current truth only; superseded methods and discovery stories live in git
history. Supersede in place, don't append. Builds on the browser and network
facts in [capabilities.md](capabilities.md).

Reach for the lightest tool that proves the thing:

- **real pixels / layout / gesture** → `npm run shot` (pre-installed Chromium
  via Playwright)
- **boot logic / component state, no pixels** → `npm run preview` (jsdom with
  the real Alpine runtime)
- **unit logic for kits and components** → `npm test` (node:test +
  `tools/test/bootstrap.mjs`)
- **static traversal only** → cheerio / linkedom / a Python parser (table at
  the end)

## npm run shot: real pixels from the working tree

```bash
npm run shot -- pages/<page>.html [--ref <ref>] [--query "k=v&..."] \
  [--script <file>] [--build] [--out <png>] [--width N] [--height N] [--full]
```

[`tools/render/screenshot.mjs`](../../tools/render/screenshot.mjs) serves the
working tree over loopback and intercepts every external request through
[`tools/render/cdn.mjs`](../../tools/render/cdn.mjs), which resolves three
kinds of traffic:

- **Own code** (the jsDelivr `gh-api.js` import, then every contents-API
  `gh.load`) → local files, so the render shows branch edits, committed or not.
- **Own data**: `cdn.mjs` impersonates the GitHub API *for this repo only*.
  Contents listings, file reads, `/repos/<repo>` metadata, and `git/trees` are
  answered from the on-disk checkout. No token is involved at any step.
  Identity endpoints (`/user`, `/user/repos`) are not impersonated; "who am I"
  has no local answer. Other repos' API calls pass through to the network and
  fail on the sandbox's spent anonymous quota.
- **Third-party libs** (Tailwind / daisyUI / Phosphor / Alpine, jsDelivr +
  unpkg) → npm-vendored copies under `node_modules`.

Output is a PNG plus a log (intercepts, `__loadedScripts`, console, errors)
under `tools/.preview/`. `--script` runs an async `(page) => {}` to drive the
page into a state first. `--build` renders through `dist/<page>.js` instead of
the live chain; see [`tools/README.md`](../../tools/README.md) for the build /
verify-build companions.

### What renders: three page categories

| Category | First paint needs | Headless result |
|---|---|---|
| self-contained | code only | full render |
| repo-content | this repo's files / tree | full render, served from the checkout |
| identity-bound | "who am I" (e.g. `gh.repos()`) | gh-auth token wall |

The containment pattern for identity-bound pages: boot identity-free when the
URL names a repo. `repo.js pickByName()` picks it without listing anyone's
repos, and `setup(gh, { quiet: true })` fills the picker in the background
(gh-auth's per-request `quiet` flag keeps a 401/403 from taking over the
page). That drops the page into the repo-content category. Worked example:

```bash
npm run shot -- pages/nav-repo.html --query "repo=mehrlander/web-tools&file=README.md"
```

### Limits

- `esm.sh` / `cdnjs` modules aren't vendored, so `kits/cm6.js` (CodeMirror)
  doesn't mount in any harness.
- GitHub **Pages serves `main`**. `?use=<ref>` swaps which ref a page's
  *loaded code* comes from, not the HTML shell, so a brand-new page has no
  live Pages URL until it merges. For branch HTML on a live origin, use
  toss-render's `#gh=` address mode or the FAB's Render tab.

## npm run preview: boot logic under jsdom

`npm run preview` runs a page's full `gh.load` chain and mounts Alpine under
jsdom, then reports each `x-data` container and a `boot:` line. Use it for
"did the components mount, what state" questions; it has no pixels.

jsdom executes neither module scripts nor dynamic `import()`, so preview
rewrites the page's module boot into a classic async IIFE, shims the
`import(gh-api.js)` call with the `import.meta.url` self-bootstrap intact, and
rewrites the one kit-level dynamic import it can satisfy (persistence's
idb-keyval) to a vendored copy; persistence then round-trips for real over
`fake-indexeddb`. Other remote imports are left alone, some sit inside
template strings that emit user-facing snippets. A page that calls a live
non-repo API endpoint gets an empty JSON array and renders its empty state.
Internals: the header comment of
[`tools/render/preview.mjs`](../../tools/render/preview.mjs).

## npm test: unit suites

`npm test` runs one `*.test.mjs` per kit / component on `node --test` (90+
tests, offline via npm-vendored libs). The suite caught a real bug on its
first run: a `versionchange` deadlock in `kits/persistence.js`.

[`tools/test/bootstrap.mjs`](../../tools/test/bootstrap.mjs) does the heavy
lifting: `makeWindow()` applies the jsdom globals and polyfills below and
captures warnings/errors into a `problems` array (assert it stays empty, with
`setMedia(bool)` for breakpoint flips); `startAlpine(window, [paths])` loads
components and boots the real Alpine; `loadKit()` runs a `lib/kits/*.js` file
with its lazy CDN imports rewritten to vendored copies.

Component-test lessons that generalize:

- **Test the eager path.** A test slot holding only lazy bindings (`@click`)
  never exercises init-time evaluation; include an eagerly evaluated binding
  (`x-text` / `:class` / `x-effect`) or the test gives false confidence.
- **Don't rebuild slotted children from a string.** `$el.innerHTML =
  shell($el.innerHTML)` detaches nodes Alpine has queued effects on, and the
  orphaned effects throw on flush. Move the existing children with
  `appendChild` (preserves node identity), assemble chrome synchronously, then
  `initTree` only the new chrome.
- Read state back with `Alpine.$data(el)`; let `$nextTick` callbacks flush
  with a couple of awaited timer ticks before asserting.

### Rolling jsdom + Alpine by hand

`bootstrap.mjs` encodes all of this; the list exists for when you're outside
it.

- **Node's own `Event` / `CustomEvent` globals** break cross-realm
  `dispatchEvent`: assign `global.Event = window.Event`, same for
  `CustomEvent`.
- **Expose the DOM globals Alpine reaches for:** `ShadowRoot`, `Node`,
  `HTMLElement`, `DocumentFragment`, `MutationObserver`, `Element`,
  `customElements`.
- **Polyfill `matchMedia`** (with a settable `matches`) and
  **`requestAnimationFrame`**.

## Gotchas

- On a partial render, check the intercept log for `MISS` before suspecting
  resolver semantics; an unvendored spec in a `/combine/` URL serves as empty.
- A package with no `jsdelivr`/`browser` field needs a `CDN_DEFAULT` entry in
  `cdn.mjs`, else the fallback picks `module`, an ESM file that throws inside
  a classic `<script>`.
- `cdn.mjs` mirrors jsDelivr's value-adds: `/+esm` imports get the package's
  ESM entry, and a requested `.min.*` falls back to the unminified file when
  the tarball ships none.
- Import `alpinejs/dist/module.esm.js`, never bare `alpinejs`: the package has
  no `exports` map, CJS interop double-wraps the default export, and the
  symptom is `Alpine.start is not a function`.
- Patch `global.requestAnimationFrame`, not just the window's; Alpine's
  `x-show` transitions call it bare in the Node realm.

## Fallback: driving Chromium directly

For HTML that isn't a repo page (a scratch file, a `data:` URL, a non-gh.load
site), drive the pre-installed Chromium yourself; the binary inventory is in
[capabilities.md](capabilities.md#browsers--headless-rendering-available).

```js
import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--no-sandbox', '--ignore-certificate-errors'] });
const p = await b.newPage();
await p.goto('file:///tmp/site/page.html');
await p.screenshot({ path: '/tmp/shot.png', fullPage: true });
await b.close();
```

Chromium ships its own trust store and doesn't trust the sandbox's TLS
inspection CA, so any `https://` URL fails with
`net::ERR_CERT_AUTHORITY_INVALID` without `--ignore-certificate-errors`
(curl / Node / Python use the system bundle and don't need it). The flag
doesn't bypass the allowlist; denied hosts still return the proxy's 403 page,
just as page content.

## Parsing / testing HTML without a browser

| Tool | Lang | Runs `<script>`? | Use when |
|---|---|---|---|
| **cheerio** | Node | No | jQuery-style traversal of static markup |
| **linkedom** | Node | No | DOM API on static markup |
| **happy-dom** | Node | Sometimes (construction-dependent) | lighter DOM, partial JS |
| **jsdom** | Node | Yes (`runScripts: 'dangerously'`) | inline scripts must execute |
| **BeautifulSoup / lxml / selectolax / parsel** | Python | No | Python-side traversal |
