# Import provenance

Imported from [`mehrlander/wa-bills`](https://github.com/mehrlander/wa-bills)
at commit `c3a9f4a` on 2026-05-07.

| Here | Source in wa-bills |
|---|---|
| `wsl-sync.html` | `wsl-sync.html` |
| `wsl-api.js` | `wsl-api.js` |
| `pension-map.js` | `pension-map.js` |
| `pension-dash.html` | `pension-dash.html` |
| `rcw/rcw-chapters.json` | `rcw/rcw-chapters.json` |
| `rcw/rcw-titles.json` | `rcw/rcw-titles.json` |
| `rcw/rcw-full.json` | `rcw/rcw-full.json` (6.6 MB) |

Files were byte-for-byte copies of the upstream sources at import time. The
table reads as provenance history, not current layout: in PR #162 (2026-06)
`wsl-api.js` and `pension-map.js` were folded into `lib/kits/wsl-core.js` +
`lib/kits/wsl.js`, and the pages were rebuilt on Alpine over the committed
`data/` snapshot. See `README.md` for the current architecture.

Added after import (not from wa-bills): `README.md`, `fetch-data.mjs`, and
the `data/` snapshot directory. See `README.md`.

## Why this is in `pages/`, not `sites/`

`wsl-sync.html` fetches *from* `wslwebservices.leg.wa.gov` (with a paste-mode
fallback for CORS), but it is not designed to be opened *as a popup from* that
host — it runs standalone on GitHub Pages. By the convention in `sites/README.md`,
that makes it a Pages app, not a domain popup. (Imported to `tools/wsl-sync/`,
moved here 2026-06: it's a set of served pages, not part of the build/render
harness in `tools/`.)

## Layout

`wsl-sync.html` and `pension-dash.html` use same-directory data fetches
(`fetch('./rcw/rcw-chapters.json')`, `fetch('./data/<biennium>/…')`), so the
reference corpus and snapshot live in this folder beside the pages. Code is
no longer same-directory: since PR #162 the pages `gh.load` their logic from
`lib/kits/`.
