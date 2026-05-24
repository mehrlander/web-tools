# `fill` concepts — catalog

Ten exploratory pages, each a small Art Institute of Chicago collection browser,
each built on a different take on a `fill` DOM-construction helper. The app is held
constant on purpose — search box → results grid → "filter shown" box → master/detail
view, all hitting `api.artic.edu`, all styled with Tailwind + daisyUI + Phosphor — so
the thing that actually varies between pages is the `fill` concept itself.

This file catalogs what came out: the pages grouped by general approach, then the
ideas and techniques that recurred or stood out, with pointers to where each shows up.
It distills rather than ranks.

---

## Common ground (all ten)

- **CDN-only, no build step.** Tailwind browser build + daisyUI themes + Phosphor icons,
  loaded from jsDelivr. Each page is a single self-contained `.html`.
- **Same data + same screen.** AIC search endpoint, 24 results, filtered to those with an
  `image_id`; IIIF image URLs; a "filter shown" client-side narrow over the fetched set;
  a detail view linking back to artic.edu.
- **`fill` is the only DOM API the app code touches.** Every page routes element creation
  through `fill`; the raw platform (`createElement`, `<template>`, `DOMParser`) is treated as
  the floor that `fill` sits on, and the app layer above speaks only `fill`.
- **One shared splicing trick.** Every template-string variant solves the same core problem —
  *how does a real DOM Node survive being embedded in an HTML string?* — the same way: replace
  the node with a comment placeholder (`<!--fill:N-->`), parse the HTML, then walk the tree and
  swap the placeholder back for the node. The variations are in everything around that.

---

## Approach families

Three broad families, split by how the author *spells out structure*.

### Family 1 — Chained Proxy element factory

Structure is written as JS property chains, no HTML strings for the scaffold.
The first property is the tag; the rest become classes. A leading plain-object argument
is props/attributes; remaining arguments are children (strings → text, Nodes → appended,
arrays → flattened). A tagged-template form (`` fill`...` ``) is kept around as an escape
hatch for splicing nodes into literal markup.

- **`aic.html`** — `fill.div.grid.gap_4(...)`. `_`→`-` on tags, classes, *and* attribute keys.
  `on[A-Z]` handlers, `style`/`dataset` objects, `fill.frag`, `fill.text`, plus `` fill`...` ``.
- **`aic-browser.html`** — same shape (`fill.div.card(...)`). Notable for using `{class:'...'}`
  for the long/arbitrary utility strings and the chain only for simple classes — a pragmatic
  split that sidesteps the chain's inability to express `grid-cols-[1fr_420px]`-style values.
- **`aic-kimi-1.html`** — `fill.div.card.bg_base_200(...)`, and the one page that pushes the
  chain further: a `toClass` step expands Tailwind variant prefixes (`sm_x`→`sm:x`,
  `hover_x`→`hover:x`, etc.). Adds `fill.when` / `fill.each` helpers.

What this family makes easy: pure-JS composition, `.map` of children dropping straight in,
no escaping question for text (it's all `createTextNode`). Where it strains: arbitrary-value
utilities (brackets, slashes, colons) don't fit a property identifier, so those leak into a
`{class}` object or a template — visible in every page in this family.

### Family 2 — Tagged-template literal, build-once (non-reactive)

Structure is HTML written in a tagged template; `fill` parses it once into Nodes. No state
layer — dynamic updates are done by the app imperatively (`replaceChildren`, toggling classes,
`$('#id')` lookups into a static shell). The interpolation rules are typed and consistent:
string/number → escaped text, Node → spliced, array → flattened, function → called (thunk),
null/false → skipped (so `cond && node` reads cleanly).

- **`aic-browse.html`** — `` fill.tag`...` `` or curried `` fill.tag({attrs})`...` ``, plus bare
  `` fill`...` ``. Uses private-use sentinel chars (`N`) for *text* placeholders so
  escaped text and spliced nodes ride separate channels. Components are pure `data → Node`
  functions; `fill.when` / `fill.map`. Carries the clearest header doc of the set.
- **`aic-browser-2`** (no extension) — `` fill.tag`...` `` / bare `` fill`...` ``, but attributes
  arrive as a **leading interpolated object** inside the template:
  `` fill.button`${{class:'btn', onclick:go}}<i ...></i>` ``. The whole shell is assembled by
  nesting `fill` templates inside parent `fill` templates. Filters by toggling `.hidden` on
  prebuilt card nodes rather than rebuilding.
- **`aic-1.html`** — `<script type=module>`; tagged-template engine with a `.data`-free shell
  driven by `$('#id')`. Intends the curried `` fill.tag({attrs})`...` `` form, **but** its `root`
  only implements the leading-interpolation form (`strings[0]===''`); the curried call returns a
  Node, not a function, so `` fill.section({class})`...` `` throws. Same surface API as
  `aic-browse`, one wiring short — a useful side-by-side on how easy that form is to get subtly
  wrong. (Verified by replicating the dispatch: `fill.section({...})` yields an object, not a
  callable.)

What this family makes easy: authoring real HTML, copy-pasteable markup, cheap mental model.
Where it strains: every update is hand-wired, and keeping spliced nodes + escaped text + live
attributes straight is exactly where the implementations diverge most.

### Family 3 — Tagged-template literal, reactive builder

`` fill`...` `` returns a *builder* with state. Interpolated **functions are accessors**
(`${d => d.title}`), re-run against a reactive state object; non-function interpolations are
inlined once as trusted scaffold. `.data(obj)` sets state (a Proxy), `.on(type, selector, fn)`
attaches one delegated listener (with `this` = state, so `this.x = …` re-renders), `.el` is the
node to mount. The four pages differ sharply in *how much* re-renders on a state change.

- **`aic-2.html`** — rebuilds the whole subtree from the template, then reconciles it onto the
  live root (`syncRoot` diffs the root's attributes and replaces its children). One builder owns
  the whole app. `fill.when` / `fill.each` accessor helpers; microtask-batched renders.
- **`aic-kimi.html`** — **fine-grained slot patching.** At build time it records text slots
  (comment anchors) and attribute slots; on render it only re-evaluates the accessor functions
  and writes those slots in place. Has the explicit input-preservation special case: skip
  writing `value` when the input is `document.activeElement`, and coerce `checked`.
- **`collection-browser.html`** — **innerHTML replacement** of a `display:contents` wrapper;
  item templates return *strings*, not nodes (`cells(d)` returns an array that's joined). Because
  the whole region is reblown on every render, it splits the page into **two builders** (search
  bar vs grid) so typing in search never re-renders the grid and never steals focus, and leans on
  delegated `.on` so listeners survive the innerHTML swap.
- **`collection-browser-2`** (no extension) — the most machinery: a real **track-on-read /
  trigger-on-write reactivity core** (effects, dependency buckets, microtask batching, nested
  effect ownership + disposal). One shared state object `S` feeds *many* handles; each handle
  subscribes only to the keys it reads. That's what lets the search box (reads nothing reactive)
  and filter box stay mounted and focused while the grid and count re-render. Cards are their own
  nested `fill` handles.

What this family makes easy: data-driven UI, declarative list/empty/loading states, one source
of truth. Where it strains: the focus-during-re-render problem is real and each page solves it
differently — and the cost ranges from "rebuild everything" to "a small reactivity engine."

---

## Catalog of ideas (cross-cutting)

The axes along which the pages actually differ, distilled, with where each choice appears and
what using it looked like.

### 1. Where attributes come from

The single most-varied design decision.

- **Chain classes + object arg for the rest** — `fill.div.card({onClick})`.
  *Family 1: `aic`, `aic-browser`, `aic-kimi-1`.* Reads like code; complex utilities spill into
  the object's `class`.
- **Curried object before the template** — `` fill.tag({attrs})`...` ``.
  *`aic-browse` (wired), `aic-1` (not wired).* Compact, but needs the `get` to return a function
  when handed a plain object — the exact step `aic-1` misses.
- **Leading interpolated object inside the template** — `` fill.tag`${{attrs}}...` ``.
  *`aic-browser-2`.* Keeps everything inside one literal; detected via `strings[0].trim()===''`.
- **Attributes written literally in the markup, only values interpolated** — `class="card ..."`
  in the HTML, `${d => ...}` only for the dynamic bits.
  *Family 3 across the board.* Static class names become plain text in the template, which is why
  the reactive pages can treat scaffold as "inline once, trusted."

### 2. How a Node survives an HTML string

- **Comment placeholder + TreeWalker swap** (`<!--fill:N-->`). *Near-universal* among
  template families.
- **Separate channel for escaped text** via PUA sentinels `N`. *`aic-browse`* — so a
  `<` in a title can never be confused with a node placeholder.
- **Placeholder element** `<i data-fs="fN">` then `replaceWith`. *`collection-browser-2`* — a
  spot a fragment can be mounted without a comment walk.
- **No splice at all; strings only.** *`collection-browser`* — children are HTML strings joined
  into `innerHTML`, so there's nothing to swap (and nothing to keep identity across renders).

### 3. Escaping

Five different escapers for the same job: regex character map (`aic`, `aic-2`,
`collection-browser-2`), `new Option(s).innerHTML` (`aic-browser`, `aic-browser-2`,
`collection-browser`), a throwaway `div.textContent → innerHTML` (`aic-kimi-1`), and manual
`replaceAll` chains (`aic-1`). The reactive fine-grained pages mostly escape inside the accessor
path; the string-template page escapes in its component functions (`esc(a.title)`).

### 4. Events: inline props vs delegation

- **Inline handler props** — `onClick` / `onclick` → `addEventListener`. *Families 1 & 2.*
  Direct, but bound to a specific node, so they don't survive a re-render of that node.
- **One delegated listener per builder** — `.on(type, selector, fn)`, `this` = state.
  *Family 3, all four.* Survives innerHTML/subtree rebuilds, which is precisely why the reactive
  pages can afford to throw away and rebuild DOM.

### 5. The "list story"

How a collection becomes children — several authors named this explicitly in comments.

- **Map → array of Nodes, appended/flattened.** Family 1, and `aic-browse`/`aic-browser-2` via
  `fill.map` / arrays.
- **Map → array of HTML strings, joined.** *`collection-browser`* — loading/empty states also
  return arrays of strings so the grid wrapper stays static.
- **Accessor returns an array of Nodes / nested handles, mounted.** *`aic-kimi`,
  `collection-browser-2`* — `loading ? skeletons : shown.length ? cards : [emptyState]`, one
  accessor covering all three states.

### 6. Filtering: rebuild vs toggle

- **Rebuild the grid from the filtered list** on each keystroke. Most pages.
- **Keep the cards, toggle visibility** (`.hidden` or inline `display`) over a prebuilt
  `{art, node, hay}` index. *`aic-browser`, `aic-browser-2`.* Avoids re-creating image nodes
  (no image re-fetch/flicker) at the cost of holding every card in memory.

### 7. Keeping inputs focused across renders

A concrete recurring snag, with three distinct answers:

- **Don't re-render the input at all** — imperative shells (`aic-1`, `aic-browse`, `aic-browser`,
  `aic-browser-2`, `aic-kimi-1`) build inputs once and never touch them.
- **Split state-reading regions into separate builders** so the input's region is never in a
  re-rendering subtree. *`collection-browser`* (bar vs view), *`collection-browser-2`*
  (per-key subscription means searchBox/filterBox, reading nothing reactive, never re-run).
- **Skip the write when focused** — `if (document.activeElement !== el) el.value = …`.
  *`aic-kimi`.*

### 8. Re-render granularity (Family 3 spectrum)

From coarsest to finest, a clean gradient of the same idea:

1. **innerHTML the wrapper** — `collection-browser`.
2. **Rebuild subtree, reconcile onto stable root** — `aic-2` (`syncRoot`).
3. **Patch recorded text/attr slots, re-run only accessors** — `aic-kimi`.
4. **Per-key dependency tracking; only handles that read a changed key re-run** —
   `collection-browser-2`.

### 9. Master/detail presentation

- **Fixed slide-in panel + dimming scrim, `translate-x` toggle** — `aic`, `aic-browse`,
  `aic-browser`, `aic-kimi-1`, `collection-browser`, `aic-kimi`.
- **daisyUI drawer (hidden checkbox toggle)** — `aic-2`, `aic-browser-2`.
- **Responsive: slide-over on mobile, sticky sidebar on `lg`** — `collection-browser`,
  `collection-browser-2`.
- **Inline detail region in the layout, no overlay** — `aic-1` (sticky aside beside the grid).

### 10. Helper surface

Beyond element creation, the recurring extras: `fill.frag` (document fragment),
`fill.text` (text node), `fill.when` (conditional), `fill.map` / `fill.each` (list),
plus app-level `fill.img` / `fill.debounce` (`aic-2`). Family 1 tends to expose these as
properties on the proxy; Family 3 tends to inline the same logic into accessor functions.

---

## Page index

| Page | Family | One-line distinctive |
|---|---|---|
| `aic.html` | 1 · chained factory | `_`→`-` everywhere; factory + template hybrid |
| `aic-browser.html` | 1 · chained factory | chain for simple classes, `{class}` for arbitrary utilities |
| `aic-kimi-1.html` | 1 · chained factory | chain expands Tailwind variant prefixes (`sm_`→`sm:`) |
| `aic-browse.html` | 2 · template, build-once | PUA sentinels separate escaped text from node splices |
| `aic-browser-2` | 2 · template, build-once | attrs as leading interpolated object; deep template nesting; filter toggles `.hidden` |
| `aic-1.html` | 2 · template, build-once | curried-attrs form intended but unwired (throws); `$('#id')` shell |
| `aic-2.html` | 3 · reactive | rebuild subtree + `syncRoot` reconcile; one builder |
| `aic-kimi.html` | 3 · reactive | fine-grained slot patching; focus-aware input writes |
| `collection-browser.html` | 3 · reactive | innerHTML of `display:contents` wrapper; string templates; split builders for focus |
| `collection-browser-2` | 3 · reactive | full track/trigger reactivity; shared state, per-key subscriptions; nested handles |
