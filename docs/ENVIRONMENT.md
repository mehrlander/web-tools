# Environment & testing notes

A living record of what the Claude Code **web sandbox** can and can't do, so we
don't re-derive it every session. Each claim is dated — the sandbox (especially
the network policy) can change, so treat anything old as "verify before trusting"
and re-run the probes inline. Newest knowledge is kept in place, not appended as a
changelog. See the footer for how to extend this.

> **Probing discipline (read first).** Most of the errors this doc has carried
> came from one habit: letting a *status code* or a *failed command* stand in for
> a fact you can observe directly. Three rules that would have caught every past
> mistake:
> 1. **Allowed vs. denied is told by a header, not a status.** A real proxy
>    denial carries `x-deny-reason: host_not_allowed`. A bare 400/403/404 with no
>    such header means the origin was *reached* and answered — the host is
>    allowed. Always probe with `curl -D -` and look at the header, not just
>    `%{http_code}`.
> 2. **A failed download does not mean a thing is absent.** `npx playwright
>    install` failing (its CDN is blocked) says nothing about whether the binary
>    is already on disk. `ls` the path and read the env before concluding absence.
> 3. **One path's refusal is not the whole host's.** A 403 on a specific bucket
>    path (e.g. a GCS listing) is the origin's, not the proxy's — don't table the
>    host as blocked from a single path.

---

## The sandbox

*(verified 2026-05-30)*

- Runs in a **remote, ephemeral container** — fresh clone each session, reclaimed
  after inactivity. Anything worth keeping must be committed and pushed.
- `node` **v22.22.2**; working dir `/home/user/web-tools`.
- `git` works; GitHub actions go through the GitHub MCP tools, not `gh`.
- A real **Chromium is pre-installed** (see Browsers below) — headless rendering
  and screenshots *are* available in-sandbox.
- Resource ceilings (approx, may shift): **4 vCPU, 16 GB RAM, 30 GB disk** —
  memory-heavy builds or tests can be killed.

## Toolchain — `check-tools`, and what it omits

*(verified 2026-05-30)*

`check-tools` (a cloud-only command) prints a dated version table for the
language/build toolchain — the fastest way to read versions. But it's a
**version probe, not a capability manifest**, and its checklist is incomplete:
it silently omits things that *are* installed. Verified present though unlisted:
**Ruby 3.3.6**, **PHP 8.4.19** + Composer, **PostgreSQL 16.13** and **Redis
7.0.15** (installed, not running — start with `service postgresql start` /
`service redis-server start`), and **bun** (`~/.bun/bin/bun` — but it has known
proxy issues fetching packages; use npm/pip to install). Absent: `mongod`,
`deno`, `bundler`. Treat a `check-tools`
omission as "unchecked," not "absent" — confirm with `command -v`.

```bash
for t in ruby php composer psql redis-server bun; do command -v "$t" || echo "missing: $t"; done
```

## Network access — a curated allowlist, not open egress

*(verified 2026-05-30)*

Outbound traffic goes through a TLS-inspecting proxy that enforces a host
allowlist. **The tell for a true denial is the `x-deny-reason: host_not_allowed`
response header — not the HTTP status.** A blocked host returns that header (with
a 403); an *allowed* host returns whatever the origin says (200, 301, 400, 404,
even a 403 of the origin's own) and carries **no** deny header. Probe with
`curl -D -` so you see it.

**Two gates, not one.** The allowlist above is the *general* proxy. GitHub git
traffic goes through a **separate** GitHub proxy that scopes operations to the
one authorized repo (and limits push to the current branch). So a sibling repo
like `<repo>.wiki.git` returns `Proxy error: repository not authorized` (502)
even though `github.com` itself is allowed — a different failure mode than
`x-deny-reason: host_not_allowed`.

| Host | Reachable? | Notes |
|---|---|---|
| `registry.npmjs.org`, `registry.yarnpkg.com` | ✅ | `npm install` works |
| `pypi.org`, `files.pythonhosted.org` | ✅ | pip works |
| `rubygems.org`, `proxy.golang.org` | ✅ | gem / go module fetches |
| `github.com`, `api.github.com`, `codeload.github.com` | ✅ | `api.github.com` 403s without auth/UA, but no deny header → reachable |
| `raw.githubusercontent.com` | ✅ | raw source files — the reliable fetch path |
| `objects.githubusercontent.com`, `release-assets.githubusercontent.com` | ✅ | release-asset binaries |
| `storage.googleapis.com`, `s3.amazonaws.com` | ✅ | object storage. 400 at root = reached; a 403 on a *bucket path* is GCS's own, not a denial |
| `fonts.googleapis.com`, `fonts.gstatic.com` | ✅ | Google Fonts load |
| `api.anthropic.com` | ✅ | but auth is session-bound — don't assume arbitrary scripts can call it |
| `cdn.jsdelivr.net`, `unpkg.com`, `esm.sh`, `cdnjs.cloudflare.com` | ❌ | `x-deny-reason: host_not_allowed` — the JS CDNs our pages use at runtime |
| `cdn.playwright.dev`, chrome-for-testing download CDNs | ❌ | browser-binary download hosts (moot — binary is pre-installed) |
| `docs.anthropic.com`, `console.anthropic.com` | ❌ | denied (the API host is allowed; the docs host isn't) |
| `developer.mozilla.org`, `en.wikipedia.org`, `stackoverflow.com`, `example.com` | ❌ | the open web is not reachable |

**Implication that bites:** our pages load Alpine / Tailwind / daisyUI / Phosphor
from **jsDelivr + unpkg at runtime**, both denied. So a repo page **cannot be
booted as-is** — but it *can* be rendered if you vendor those deps first (see
"Rendering a repo page"). npm and GitHub-raw are the reliable fetch paths.

Re-check (note the `-D -` and the deny-header grep — that's the whole point):

```bash
probe () { echo "== $1 =="; curl -sS -o /dev/null -D - --max-time 12 "$1" \
  | grep -iE '^HTTP/|x-deny-reason' | tr -d '\r'; }
for h in https://registry.npmjs.org/alpinejs \
  https://raw.githubusercontent.com/mehrlander/web-tools/main/lib/gh-api.js \
  https://storage.googleapis.com/ https://cdn.jsdelivr.net/ https://esm.sh/ ; do
  probe "$h"; done
```

## Browsers / headless rendering — available

*(verified 2026-05-30)*

A real Chromium is **pre-installed and works** — no download needed, despite the
download CDNs being blocked. The image bakes the binary in precisely so the
blocked download doesn't matter.

- Binary: `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` — **Chromium
  141.0.7390.37**, build **1194**.
- **`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers` is set in the env.** This is the
  canonical pointer: Playwright auto-discovers the binary through it, so a plain
  `chromium.launch()` finds it with no `executablePath` and no download.
- Playwright clients are version-pinned to a Chromium build. Build 1194 matches
  **`playwright@1.56.x`**; other client versions error with "executable doesn't
  exist". `npx playwright install chromium` is unnecessary here (and its CDN is
  blocked anyway).
- No `PUPPETEER_*` var is set, so puppeteer needs `PUPPETEER_EXECUTABLE_PATH`
  (or an explicit `executablePath`) pointed at the binary above. Playwright is
  the frictionless driver.

Smoke-test the binary directly (no npm needed):

```bash
B="$PLAYWRIGHT_BROWSERS_PATH/chromium-1194/chrome-linux/chrome"
"$B" --version
"$B" --headless --no-sandbox --disable-gpu \
  --dump-dom 'data:text/html,<h1>ok</h1>' 2>/dev/null | grep -o '<h1>ok</h1>'
```

Drive it with Playwright and screenshot (proven against a vendored-Alpine page —
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
trust the sandbox's inspection CA, so any `https://` URL — even an allowed host —
fails with `net::ERR_CERT_AUTHORITY_INVALID` unless you launch with
`args: ['--no-sandbox', '--ignore-certificate-errors']`. (curl / Python / Node
use the system CA bundle, which already trusts the proxy, so they don't need it.)
The flag doesn't bypass the allowlist — denied hosts still return the proxy's 403
page, you just see it as page content instead of a TLS error.

## Rendering a repo page

*(verified 2026-05-30)*

The browser works, but a repo page won't boot *as-is*: it pulls Alpine / Tailwind
/ daisyUI / Phosphor from jsDelivr + unpkg, which are denied. Two paths:

- **Vendor the deps, then render.** `npm install` the libraries (or copy their
  `dist` files) and rewrite the page's `<script src>` to local paths, serve over
  loopback (`python3 -m http.server` / `npx serve`), and drive with Playwright.
  Confirmed: a page using npm-vendored Alpine rendered with full reactivity and
  screenshotted. This gives real pixels / layout — not just logic.
- **Preview a page already on main.** GitHub **Pages serves `main`**. The
  `?use=<ref>` convention swaps which ref the page's *loaded code* comes from, but
  **not the page's own HTML shell** — that's whatever main serves. So a brand-new
  page must reach `main` before it can be opened at its Pages URL at all. For
  branch edits to a page already on main, the FAB's "Render page" tab fetches the
  page HTML at a chosen ref via the contents API and hosts it in an `srcdoc`
  iframe (see `README.md`). That doesn't help a page never been on main.

## Parsing / testing HTML without a browser

*(verified 2026-05-30)*

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

Load a component into **jsdom** and drive it with the **real Alpine** runtime —
verifying DOM structure, class/state logic, and event wiring. Not pixels, not
real pointer-drag (use the pre-installed Chromium for those), but it caught the
real bugs. Setup: `npm i alpinejs jsdom`, load the component source with
`new window.Function(src)()` after Alpine is registered, then `Alpine.start()`.

Gotchas that cost iterations (do these or it throws):

- **Node 22 ships its own global `Event` / `CustomEvent`.** Alpine mints events
  with them and dispatches on jsdom nodes → cross-realm `dispatchEvent` throw.
  Fix: `global.Event = window.Event; global.CustomEvent = window.CustomEvent`.
- **Expose the DOM globals Alpine reaches for:** `ShadowRoot`, `Node`,
  `HTMLElement`, `DocumentFragment`, `MutationObserver`, `Element`,
  `customElements` (assign each from the jsdom `window`).
- **jsdom has no `matchMedia`** — polyfill it (and make `matches` settable so you
  can simulate breakpoint flips). **No `requestAnimationFrame`** either — polyfill.
- Read component state back with `Alpine.$data(el)`; let `$nextTick` callbacks
  flush with a couple of `await setTimeout` ticks before asserting.

What it proves: slot/innerHTML handling, reactive `:class` branches, `open/close`
state, event-driven triggers, `matchMedia`-driven logic. What it doesn't: visual
correctness (no CSS framework loads) and gesture physics (synthetic pointer
streams aren't real input).

**Test the eager path, not just the lazy one.** A first pass of the sheet-modal
test only put `@click="close()"` in the slot and passed — but `@click` is *lazy*
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
(`"isDesktop is not defined"`) — even though a second `initTree` makes the visible
result look correct. Bare children left *in place* bind fine (scope chains down
the tree); it's the rebuild that breaks them. Fix that needs no caller
cooperation: move the existing children into a fresh body element (`appendChild`
preserves node identity + queued effects), assemble the chrome around them
**synchronously**, reattach, then `initTree` only the new chrome (it skips
already-initialized nodes, so no double-bind). A `<template>` wrapper also works
(its content is inert, never walked) but pushes a tag onto every caller.

---

## Updating this doc

- This is the **single source of truth** for sandbox capabilities. Don't spawn a
  parallel capabilities doc; edit this one. (It absorbed an earlier
  `probes/ccow-capability-probe.md`, retired 2026-05-30.)
- Keep it **succinct** — the key facts, not a transcript.
- **Date every claim** (`*(verified YYYY-MM-DD)*`); the sandbox shifts under us.
- When a finding changes, **edit it in place** and update the date — don't stack
  stale entries. Git holds the history.
- Prefer a **re-runnable probe** over a bare assertion — and observe facts
  directly (`ls` the path, read the env, inspect the header) rather than inferring
  them from a status code or a failed command. See "Probing discipline" up top.
- Possible follow-up not yet built: a reusable jsdom + Alpine test bootstrap (the
  six globals + polyfills) so component logic tests don't repeat the setup.
</content>
</invoke>


result
The file is now retire the probe and remove the empty dir
