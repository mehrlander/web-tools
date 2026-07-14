# pages/drop/

Standalone HTML tools and experiments dropped in from outside the repo's usual
`lib/`-based build, but still tracked, indexed, and thumbnailed like any other
page under `pages/` (see the `drop` chip in [the live index](https://mehrlander.github.io/web-tools/pages/)).
This file is hand-maintained; it exists because the auto-generated
[`pages/README.md`](../README.md) only carries each page's `<title>`, not what
it's for.

`components/` holds self-contained widgets meant to be lifted into another
page. Everything else here is a standalone tool or a demonstration of one
idea. A new item gets a row below; it does not need its own subdirectory
unless, like `fills-concepts/`, it's a set of related pages sharing a
catalog doc.

| Page | What it is |
|---|---|
| `cm6-editor.html` | A CodeMirror-based single-file text editor. |
| `diff-tool.html` | A diff tool for comparing legislative text. |
| `gist-editor.html` | An editor for reading and writing GitHub gists. |
| `live-docs.html` | A living-documentation page, built on daisyUI. |
| `live-docs-concept.html` | An earlier concept pass at the same living-documentation idea. |
| `word-frequencies.html` | A word-frequency and part-of-speech API reference. |

## `components/`

| Page | What it is |
|---|---|
| `console.html` | A console web component, demonstrated standalone. |
| `Sheet.html` | An iOS-style sheet web component, demonstrated standalone. |

## `fills-concepts/`

Ten pages exploring different conventions for a `fill()` DOM-construction
helper, each rebuilding the same Art Institute of Chicago collection browser.
See [`fills-concepts/CATALOG.md`](fills-concepts/CATALOG.md) for the full
breakdown.
