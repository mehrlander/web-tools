---
id: own-json-tree-retire-vje-i0lcj2
title: Build our own JSON tree for display, keep vanilla-jsoneditor for editing
status: backlog
opened: 2026-07-25
size: M
awaiting: the reader/writer split, recommended in the body and unanswered since filing
---
# Build our own JSON tree for display, keep vanilla-jsoneditor for editing

A 1.27 MB editor (373 KB gzipped) is the display path for every JSON file anyone
looks at, and almost nobody types.

## The three mounts, measured 2026-09-04, restamped 2026-09-17

| Mount | Mode | Who edits |
| --- | --- | --- |
| `alpineComponents/viewer.js` | editable, fires `viewer:tree-change` | `popups/idb-nav.html` alone |
| `alpineComponents/console.js` | `readOnly: true` | nobody |
| `alpineComponents/transform-workbench.js` | `readOnly: true` since 2026-09-14 | nobody |

Every other consumer of viewer's tree (the data route, Files, the stage preview,
chat-results) is read-only and reaches it through the editable mount.

**So two of the three mounts are display-only, and one page edits.** The
workbench went read-only on 2026-09-14 with its reasoning in the code: it was
mounted editable, had no `onChange` and no reader for the handle, so every edit
was accepted and discarded on the next mode switch. That is the case this task
argues, arriving from a direction the task did not predict.

## Why build the reader

- **`dist/web-tools.js` is not offline.** It carries four runtime
  `import('https://cdn.jsdelivr.net/npm/vanilla-jsoneditor/…')` calls, up from
  three, in the one artifact whose purpose is not needing the network.
- **It cannot cooperate with the FAB.** VJE owns its viewport and ships its own
  mode switcher, which is why the double-switcher in
  `data-view-mobile-chrome-x5plcv` is not negotiable with it.
- **It cannot grow our affordances**: copy a node's JSON-path, toss a subtree as
  its own `#data=`, deep-link a node through the fragment. The compounding
  argument, invisible on day one.
- **Theme.** VJE ships its own CSS and ignores `data-theme`.

## What is hard

Not the rendering; collapse-by-default is naturally lazy. Two things:

- **Breadth.** One array of 100k rows at a single level. Prefer an honest
  "showing 100 of 100,000" over windowing. VJE does this properly, so we accept
  a cruder answer.
- **Precision.** `JSON.parse` mangles integers past 2^53 and VJE has a lossless
  mode. Not a regression (table mode already plain-parses), and ours could
  improve on it by parsing to strings where precision would be lost.

## The shape recommended

Ours becomes `tree`, the display mode: themed, FAB-aware, no CDN. VJE becomes
`edit`, requested explicitly, so `idb-nav` and the workbench are untouched and it
stops loading for everyone else. The registry already does per-page mode
selection, so no new mechanism.

The asymmetry that decides it: a reader that renders a node wrong looks ugly and
gets fixed; a writer that saves a mangled value costs data, and its edge cases
(precision, key order, undefined vs null, partial edits mid-keystroke) are the
ones nobody tests. Build the reader, keep the writer.

## Done when
A `tree` module renders with no network call, honors the theme, and caps
large-array expansion visibly; VJE is reachable as an explicit mode with both
edit round-trips held by a test; `console.js` moves to the reader; and
`dist/web-tools.js` no longer imports VJE on the default path.

**Blocked on one answer.** The user was leaning toward dropping VJE outright.
The split above is the counter-proposal and has never had a reply. That is what
has held this task for its whole life.

## Progress log
- 2026-07-25: Filed from the `#data=` session (PR #288). Bundle sizes and the
  `dist` occurrences verified by grep.
- 2026-09-04: Scope corrected. "Exactly one consumer edits" was true at filing
  and is not now: `transform-workbench.js` and `console.js` both mount VJE since
  then, and `dist` went three occurrences to four. The recommendation is
  slightly stronger, `console.js` being a second display-only mount paying the
  CDN cost. Sized M; body cut from 923 words.
- 2026-09-17: Surfaced the long-standing VJE decision as `awaiting:` so the board shows the hold.
- 2026-09-17: Mount table restamped. `transform-workbench.js` is `readOnly: true`
  since 2026-09-14, so the 2026-09-04 correction here ("both mount VJE since
  then", implying two editors) now reads the wrong way: two of three mounts are
  display-only and `viewer.js` is the only editor, serving `popups/idb-nav.html`.
  That is a stronger case for the split than the body made, not a weaker one, and
  it was found by reading the mounts rather than the task.
