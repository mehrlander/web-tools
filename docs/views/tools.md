# Tools

**Tools** (`?view=tools`) is a curated gallery of the utility pages the owner
reaches for (the text-diff tool, the transform/compress round-trip, and so on),
an estate-level peer beside Repos / Surfaces / Stage / Map. It reuses the
pages card (thumbnail or live preview, an open link, a source link),
fed from a hand-curated manifest, [`docs/tools.csv`](tools.csv), rather than a
repo scan. Each entry is `{ path, title, note, icon }`, where `path` is a bare
hub path (`pages/diff-tool.html`, the hub at main) or a qualified cross-repo ref
(`owner/repo[@ref]:path`), the same grammar as a pages catalog entry. Public: the
hub is public, so the thumbnails (jsDelivr), the hosted render URL, and the blob
source resolve with no token; a cross-repo or off-default entry renders through
toss-render `#gh=` the same way the pages catalog does. The list is authored, a
sibling to `pins` and `stage.files`, maintained by hand
(`lib/alpineComponents/tools.js`).
