# Good ideas

A standing, on-demand backlog of worthwhile follow-ups for this repo. Each
entry is grounded in a real `file:line` so it can be picked up cold. This is a
menu, not a commitment — nothing here is scheduled. Prune an entry when it
ships or stops being a good idea.

Convention mirrors [`MERGE-GUIDE.md`](MERGE-GUIDE.md): say "good idea list" in a
session to regenerate or extend it. Newest thinking on top; keep entries to a
five-second skim.

Confidence tags: **confirmed** = verified against the code this pass;
**observed** = a pattern worth a closer look before acting.

---

## Quick wins

Small, confirmed, low-risk. Each is an afternoon or less.

### Fix the broken `demos/` link in the README — *confirmed*
`README.md:61` links the demos row to
`…/pages/demos/`, but there is no `pages/demos/` — the per-kit demo pages live
in [`kits/demos/`](../kits/demos/) (`compression.html`, `io.html`,
`messaging.html`, `persistence.html`, plus `index.html`). The published link
404s. Repoint it to `kits/demos/`.

### Document `kits/cm6.js` in the kit catalog — *confirmed*
[`kits/cm6.js`](../kits/cm6.js) is the shared CodeMirror 6 factory
(`cm6.create(...)`, lazy module load + retry). Both
`alpineComponents/cm-editor.js:51` and `alpineComponents/compress-input-cm.js:110`
depend on it, yet `kits/README.md` has a `### ` section for every *other* kit
(compression, persistence, io, messaging, data-shelf, console) and none for
`cm6`. Add the missing section so the catalog is complete and the
`gh.load('kits/cm6.js')` ordering requirement is discoverable.

### Name the file in the loader's script-load error — *confirmed*
`gh-api.js:48` throws ``Failed to load script: ${res.status}`` with no path. When
a `gh.load(...)` chain fails, the message doesn't say *which* file. Including
the URL turns a guessing game into a one-line diagnosis.

---

## Build-outs

Bigger, higher-leverage. Worth a design pass first.

### Stand up a headless test runner for the kits — *confirmed*
The `SessionStart` hook already installs `jsdom`, `fake-indexeddb`, and
`idb-keyval` (see [`docs/STARTUP.md`](STARTUP.md)), and `package.json` has the
deps — but there's **no `test` script and no runner**. The pure-logic kits
(`compression`, `persistence`, `messaging`) are exactly what's cheap to test
headless, and [`ENVIRONMENT.md`](ENVIRONMENT.md) already documents a
jsdom + Alpine recipe. Formalizing that into `npm test` would turn the recipe
into regression coverage and give future sessions a green/red signal instead of
page-poking.

### Auto-generate a component catalog — *observed*
Every component in `alpineComponents/` carries a `description:` field, and the
FAB scans the live DOM to surface them — but there's no *static* index the way
[`pages/index.html`](../pages/index.html) auto-lists pages. A generated
`alpineComponents/` catalog (name + description + which pages mount it) would
give components the same at-a-glance directory pages already have, and double as
the README's missing component table.

### Decide bundle parity for the `html.*` helpers — *confirmed*
`vanilla-bundle.js` exposes string helpers (`html.btn`, `html.tip`,
`html.lines`, `html.toolbar`, `html.modal`). `alpine-bundle.js` ships only the
directive equivalents (`x-btn`, `x-tip`, …) — so an Alpine page can't reach the
`html.btn('…')` string form a vanilla page uses. Either expose `window.html` in
the Alpine bundle too, or document the asymmetry as intentional in
[`SCAFFOLDING.md`](SCAFFOLDING.md) so it stops reading like an omission.

---

## Tidy

Organizing moves that make the curated set legible.

### Sort the unlisted pages — *confirmed*
Nine pages under `pages/` aren't in the README table. They split cleanly:
- **Polished demos worth listing** — `alpine-bundle-demo.html`,
  `vanilla-bundle-demo.html`, `console-kit-demo.html`, `sheet-modal-demo.html`.
  These are good builder references; a "demos & references" row would surface
  them.
- **Scratch / MWE** — `define-test.html`, `fab-sidebar-test.html`,
  `sidebar-drawer-mwe.html`, `base64-render-engine.html`, `demo-spacex.html`.
  Candidates to move under `pages/misc/` so the top-level `pages/` listing reads
  as the curated set.

The `pages/` index auto-lists *everything* regardless, so this is about signal,
not hiding work.

---

## Watch

Observations to keep in view; not yet shaped into a task.

### Kit load-order is manual with late failure — *observed*
Components guard their kit dependency by logging at mount
(`alpineComponents/cm-editor.js:47`, `compress-input-cm.js:106`:
`window.cm6 is missing — gh.load(...) first`). It works, but the failure
surfaces only when the component renders. A lightweight dependency declaration
on `gh.load` (or a boot-time assert listing missing `window.*` namespaces) would
catch ordering mistakes at load time instead of render time.
