# Demos

Interactive, browser-runnable pages. Open the `.html` files directly in a browser
(they pull their dependencies from CDNs; no build step). This folder is the single
index of every demo in the repo, including the use-case demos that have to live next
to the code they import.

## Concept demos (here)

- **[`custom-suffix-tree-engine.html`](custom-suffix-tree-engine.html)** — paste any
  text and watch a from-scratch suffix-tree engine (Ukkonen's algorithm, struct-of-arrays
  TypedArray layout) enumerate repeated substrings, rank them, and highlight document
  coverage. Self-contained: the engine is inline, only the UI libraries are loaded from
  CDNs. This is the prototype that validated O(n) in-browser repeat enumeration; its
  full writeup is
  [`docs/history/phase-1-discovery/prototype/custom-suffix-tree-engine-summary.md`](../docs/history/phase-1-discovery/prototype/custom-suffix-tree-engine-summary.md).
  Not tied to any single use case or pipeline stage.

## Use-case demos (live with their code)

These import sibling JS modules, so they stay in their use-case folders:

- **[`../dom/demo.html`](../dom/demo.html)** — DOM induction: paste a DOM signature list
  or raw HTML and see the repeated components surface as slotted templates.
- **[`../general/demo.html`](../general/demo.html)** — general-text induction: paste a
  log or record set and watch tokenize → grammar → group (bookend or structural
  alignment) → reconstruction.
