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

Files are byte-for-byte copies of the upstream sources.

## Why this is in `pages/`, not `sites/`

`wsl-sync.html` fetches *from* `wslwebservices.leg.wa.gov` (with a paste-mode
fallback for CORS), but it is not designed to be opened *as a popup from* that
host — it runs standalone on GitHub Pages. By the convention in `sites/README.md`,
that makes it a Pages app, not a domain popup. (Imported to `tools/wsl-sync/`,
moved here 2026-06: it's a set of served pages, not part of the build/render
harness in `tools/`.)

## Layout

`wsl-sync.html` and `pension-dash.html` use same-directory ES imports
(`import { ... } from './wsl-api.js'`) and same-directory data fetches
(`fetch('./rcw/rcw-chapters.json')`). The flat layout here preserves that —
no build step, no CDN, served directly by GitHub Pages.
