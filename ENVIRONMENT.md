# Environment & testing notes

A living record of what the Claude Code **web sandbox** can and can't do, so we
don't re-derive it every session. Each claim is dated — the sandbox (especially
the network policy) can change, so treat anything old as "verify before trusting"
and re-run the probes below. Newest knowledge is kept in place, not appended as a
changelog. See the footer for how to extend this.

---

## The sandbox

*(verified 2026-05-30)*

- Runs in a **remote, ephemeral container** — fresh clone each session, reclaimed
  after inactivity. Anything worth keeping must be committed and pushed.
- `node` **v22.22.2**; working dir `/home/user/web-tools`.
- `git` works; GitHub actions go through the GitHub MCP tools, not `gh`.

## Network access — a curated allowlist, not open egress

*(verified 2026-05-30)*

Outbound traffic goes through a filtering proxy. Blocked hosts return **HTTP 403**
(a denial, not a connection refusal) — that's the tell that it's an allowlist, not
a dead network.

| Host | Status | Notes |
|---|---|---|
| `registry.npmjs.org` | ✅ 200 | `npm install` works |
| `raw.githubusercontent.com` | ✅ 200 | raw file fetches work |
| `github.com` | ✅ 200 | page loads (release *asset* downloads are elsewhere, see below) |
| `cdn.jsdelivr.net` | ❌ 403 | the repo's runtime CDN — blocked |
| `unpkg.com` | ❌ 403 | Alpine's CDN in some pages — blocked |
| `esm.sh` | ❌ 403 | blocked |
| `cdn.tailwindcss.com` | ❌ 403 | blocked |
| `cdn.playwright.dev` | ❌ 403 | Playwright browser binaries — blocked |
| `playwright.download.prss.microsoft.com` | ❌ 403 | Playwright binary mirror — blocked |
| `storage.googleapis.com` | ❌ 403 | chrome-for-testing — blocked |

**Implication that bites:** our pages load Alpine / Tailwind / daisyUI / Phosphor
from **jsDelivr + unpkg at runtime**, all blocked. So a repo page **cannot be
booted headlessly inside the sandbox as-is**. npm and GitHub-raw are the reliable
fetch paths.

Re-check the table (extend the `HOSTS` list as needed):

```bash
HOSTS="https://registry.npmjs.org/alpinejs \
https://raw.githubusercontent.com/mehrlander/web-tools/main/gh-api.js \
https://cdn.jsdelivr.net/gh/mehrlander/web-tools@main/gh-api.js \
https://unpkg.com/alpinejs https://esm.sh/alpinejs \
https://cdn.tailwindcss.com https://cdn.playwright.dev"
for h in $HOSTS; do curl -sS -o /dev/null -w "%{http_code}  $h\n" --max-time 12 "$h"; done
```

## Browsers / headless rendering

*(verified 2026-05-30)*

- **No browser binary is present**, and every binary-download host is blocked
  (Playwright's CDN, its MS mirror, Google's chrome-for-testing). `npx playwright
  install chromium` fails.
- Therefore **Playwright / Puppeteer cannot fetch a browser here**, and there is
  **no pixel-level / screenshot / real-layout testing** in-sandbox today.
- The `playwright` npm package itself installs (registry is allowed) — it's only
  the *browser download* that's blocked. If a download host is ever allowlisted,
  full headless rendering becomes possible.

## What does work: logic-testing Alpine components with jsdom

*(verified 2026-05-30 against `alpineComponents/sheet-modal.js`)*

Since npm is reachable, you can load a component into **jsdom** and drive it with
the **real Alpine** runtime — verifying DOM structure, class/state logic, and
event wiring. Not pixels, not real pointer-drag, but it caught the real bugs.

Setup: `npm i alpinejs jsdom`, then load the component source with
`new window.Function(src)()` after Alpine is registered, and `Alpine.start()`.

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
`x-text="isDesktop ? …"` in the slot throws *at startup*. If a component reads
its own scope from slotted markup, the test slot must include an
**eagerly-evaluated** binding (`x-text` / `:class` / `x-effect`), or the test
gives false confidence. Capture startup warnings by stubbing `console.warn` /
`console.error` and a `window` `error` listener; assert the count is zero.

**Alpine "slots" without a custom element: preserve the slot nodes, don't
rebuild them.** A component that accepts caller-provided children and renders
its own chrome around them must NOT do `body = $el.innerHTML; $el.innerHTML =
shell(body)`. Measured cause: by the time `init()` runs, Alpine has already
queued reactive effects on the original child nodes; rebuilding from a string
discards those nodes, and the orphaned (now detached) effects throw when they
flush (`"isDesktop is not defined"`) — even though a second `initTree` makes the
visible result look correct. Bare children left *in place* bind fine (scope
chains down the tree); it's the rebuild that breaks them. Fix that needs no
caller cooperation: move the existing children into a fresh body element
(`appendChild` preserves node identity + queued effects), assemble the chrome
around them **synchronously**, reattach, then `initTree` only the new chrome
(it skips already-initialized nodes, so no double-bind — verified: slot getter
evaluates once at start and once per state change). A `<template>` wrapper also
works (its content is inert, never walked) but pushes a tag onto every caller.

## Previewing pages

*(verified 2026-05-30)*

- GitHub **Pages serves `main`**. The `?use=<ref>` convention swaps which ref the
  page's *loaded code* comes from, **but not the page's own HTML shell** — that's
  whatever main serves. So a **brand-new page must reach `main` before it can be
  opened** at its Pages URL at all.
- For previewing **branch edits to a page already on main**, the FAB's "Render
  page" tab fetches the page HTML at a chosen ref via the contents API and hosts
  it in an `srcdoc` iframe (see `README.md`). That doesn't help a page that has
  never been on main.

---

## Updating this doc

- Keep it **succinct** — the key facts, not a transcript.
- **Date every claim** (`*(verified YYYY-MM-DD)*`); the sandbox shifts under us.
- When a finding changes, **edit it in place** and update the date — don't stack
  stale entries. Git holds the history.
- Prefer a **re-runnable probe** over a bare assertion, so the next session can
  confirm rather than trust.
- Possible follow-up not yet built: a reusable jsdom + Alpine test bootstrap
  (the six globals + polyfills) so component logic tests don't repeat the setup.
