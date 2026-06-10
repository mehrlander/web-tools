# export/ — the web-tools handoff

Everything Wring contributes to [`mehrlander/web-tools`](https://github.com/mehrlander/web-tools),
already in web-tools' target shape and organized by destination path. The move
is a copy, not a port: each file here lands verbatim at the matching path.

| Here | Destination in web-tools | What it is |
|---|---|---|
| `lib/kits/wring.js` | `lib/kits/wring.js` | The engine as a kit (IIFE → `window.wring`, loads via `gh.load('kits/wring.js')`). **Generated** by `build-kit.mjs`; do not hand-edit. |
| `pages/wring-text.html` | `pages/wring-text.html` | General-text demo (logs/records → templates), re-plumbed from `general/demo.html` to load the kit. Adopts the `?use=<ref>` convention. |
| `pages/wring-dom.html` | `pages/wring-dom.html` | DOM demo (signatures / pasted HTML → repeated components), re-plumbed from `dom/demo.html`. |
| `tools/test-wring.mjs` | `tools/test-wring.mjs` | Kit liveness + invariants test. Loads the kit the way `gh.load` does (`new Function`), so it tests the exact artifact pages run. Self-contained (fixtures inlined). |
| `lib/kits/README-section.md` | append to `lib/kits/README.md` | The kit's entry for the "Current kits" catalog. Not a standalone file there. |
| `archive/wring/IMPORT.md` | `archive/wring/IMPORT.md` | Provenance doc to drop into the snapshot (fill in SHA + date). |

## Move procedure (in a web-tools session)

1. **Snapshot this repo** into `archive/wring/`:
   `curl -sSL https://codeload.github.com/mehrlander/wring/tar.gz/refs/tags/v1.0.0 | tar xz`
   (or the final main SHA if not tagging). The snapshot includes this `export/`
   directory — that's intentional; it documents what was copied out and lets
   the kit be regenerated (`node export/build-kit.mjs`) from inside the archive.
2. **Copy the artifacts** per the table above; add `IMPORT.md` with the SHA and
   date filled in; append the README section to `lib/kits/README.md`.
3. **Verify**: `node tools/test-wring.mjs` (should print ALL PASSED), then
   `npm run preview pages/wring-text.html` / `npm run shot` per the render
   harness, and `npm run pages` to regenerate the index + thumbnails.
4. **After merge**, back in wring: add the tombstone note to the root README
   (concept complete, live code in web-tools, snapshot at `archive/wring/`)
   and flip on GitHub's *Archive repository* setting.

## Regenerating the kit

```bash
node export/build-kit.mjs   # rebuilds lib/kits/wring.js from the source modules
node export/tools/test-wring.mjs
```

The build concatenates the seven source modules (Stage 1 segmenters, Re-Pair
grammar, Bookend Merge + alignment grouping, MDL selection, and the
grammar→records bridge) inside one IIFE, strips module syntax, refuses to
build on top-level name collisions, and stamps the source commit.

## Why a kit and not ESM modules

web-tools' loader contract (`lib/kits/README.md` there) requires plain scripts
that populate a `window` namespace — `gh.load` runs file bodies through
`new Function`, which chokes on static `import`/`export`. The kit shape also
plugs into web-tools' render/build harness (preview, screenshot, bake) for
free. The ESM-style source modules remain the source of truth, snapshotted
under `archive/wring/`.
