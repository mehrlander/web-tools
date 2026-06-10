# Import provenance

Imported from [`mehrlander/wring`](https://github.com/mehrlander/wring)
at commit `<FILL: short SHA of the wring commit snapshotted>` (tag `v1.0.0`)
on <FILL: date>.

This directory is a complete snapshot of the wring repository: the source
modules, the six-harness test suite, the CLI drivers, the original browser
demos, and the research record (`docs/research/`, `docs/history/`,
`docs/concepts/`). Files are byte-for-byte copies of the upstream sources.

To recreate the snapshot:

```bash
curl -sSL https://codeload.github.com/mehrlander/wring/tar.gz/refs/tags/v1.0.0 | tar xz
mv wring-*/ archive/wring/   # then drop this IMPORT.md in
```

## What was ported out of the snapshot (the live copies)

| Live file in web-tools | Built from |
|---|---|
| `lib/kits/wring.js` | the six engine modules + `general/bridge.js`, concatenated by `export/build-kit.mjs` (run it from this directory to regenerate) |
| `pages/wring-text.html` | `general/demo.html`, re-plumbed to load the kit via `gh.load` |
| `pages/wring-dom.html` | `dom/demo.html`, same re-plumbing |
| `tools/test-wring.mjs` | `export/tools/test-wring.mjs` (verifies the generated kit) |

The snapshot's `export/` directory contains the exact artifacts that were
copied out, as they were at import time.

## Division of labor

- **Live code** (`lib/kits/wring.js`, the two pages): maintained here in
  web-tools. Bug fixes and features happen against the kit going forward.
- **This snapshot**: the v1 record. Source modules, full test suite
  (`npm test` works inside the snapshot), design history, and the research
  reports that produced the architecture. Read `ARCHITECTURE.md` first;
  `docs/README.md` maps the rest.
- The upstream repo is archived (read-only) on GitHub; this snapshot is the
  working reference copy.
