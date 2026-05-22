# kits/

Themed logic libraries loaded via `gh.load`. Each kit is a plain script
(no `import`/`export`) that populates a single namespace on `window`.

## Concept

A **kit** is the third category of file in this repo, alongside:

- **Root-level scaffolding** — `gh-api.js`, `gh-auth.js`, `gh-fetch.js`,
  `gh-store.js`, `alpine-bundle.js`. The boot chain. `alpine-bundle.js`
  also owns the Alpine-coupled `x-define` directive (custom-element
  registration from a `<template>`), so kits can stay Alpine-free.
- **`alpineComponents/*.js`** — UI components that register with
  `Alpine.data(name, fn)` inside `alpine:init`.
- **`kits/*.js`** — logic libraries that register a namespace on
  `window`. No Alpine coupling. Mostly pure functions or stateful
  service objects; `fills.js` is the one exception that renders, but
  only as Alpine-free HTML strings.

The shape rules (so the file works through `gh.load`):

1. No static `import` / `export` statements at the top level. (`gh.load`
   uses `new Function(body)()`, which strips `export` keywords and
   chokes on `import`.)
2. Wrap the file body in an IIFE — `(() => { ... })();` — to keep helpers
   private.
3. End the IIFE by assigning the public namespace: `window.foo = { ... };`
4. Third-party libraries load lazily inside functions via dynamic
   `await import('https://unpkg.com/...')`. That's an expression and
   works fine inside `new Function`'s body.
5. Internal "imports" between kits are reads from `window.otherKit`.
   Order them in the page's `gh.load` chain accordingly.

See `SCAFFOLDING.md` at the repo root for the full loader contract.

## Current kits

### compression.js

Brotli/Gzip compression, JS detection (acorn), and bookmarklet packing.
Salvaged from Alp's `utils/kits/{brotli,gzip,acorn,text}.js` — the
originals live at `archive/alp/repo/utils/kits/` for reference.

After loading:

```js
window.compression.brotli  // { compress, decompress, detect, findChunks }
window.compression.gzip    // { compress, decompress, detect, findChunks, sizeOf }
window.compression.acorn   // { parse, isJS }
window.compression.text    // { detectCompressionType, findCompressedChunks,
                            //   templates, assess, pack, process }
```

`text.process(input, opts)` is the high-level entry point that drives the
compression-helper UI: it assesses input, optionally compresses with
brotli or gzip, and optionally packs the result as a self-decompressing
`javascript:` bookmarklet.

`text.findCompressedChunks(str)` scans for `BR64:` / `GZ64:` payloads
embedded in arbitrary text. Detection regexes accept an optional label:
`BR64("mylabel"):...`.

### fills.js

daisyUI/Tailwind template-string helpers salvaged from
`archive/alp/repo/utils/fills.js`. Pure functions returning HTML
strings; zero runtime deps and zero Alpine coupling. Compose
wherever HTML is built by string concatenation.

```js
window.fills.tip(mods, trigger, content)
window.fills.lines(mods, arr)
window.fills.toolbar(mods, ...items)
window.fills.modal(inner)
```

`mods` is an array of short tokens (e.g. `['xs','bottom']`). Recognized
tokens map to daisyUI/Tailwind classes; unrecognized tokens are ignored.
See `kits/demos/fills.html` for live examples.

For Alpine-flavored equivalents that decorate elements (rather than
return string fragments), see the directives in `alpine-bundle.js`:
`x-tip`, `x-lines`, `x-toolbar`, `x-btn`, `x-save-indicator`,
`x-action`, `x-metric`.

### persistence.js

String-path key/value over
[`idb-keyval`](https://github.com/jakearchibald/idb-keyval). All values
go through IndexedDB's structured clone, so `Uint8Array`, `Date`,
`Map`, `Blob`, etc. round-trip with their types intact.

```js
await window.persistence.save('myPage.foo', { a: 1, when: new Date() });
await window.persistence.load('myPage.foo');
await window.persistence.remove('myPage.foo');
await window.persistence.list('myPage.x');         // keys in myPage/default
await window.persistence.entries('myPage.x');      // [key, value][]
await window.persistence.clearStore('myPage.x');   // wipe one store
window.persistence.parsePath('a.b.c');             // { db, store, key }
```

Path syntax: `"<db>.<key>"` defaults `store="default"`; `"<db>.<store>.<key>"`
is explicit. Single-segment paths throw — every caller picks its own
namespace so devtools shows separate IndexedDB databases and data from
different pages can't collide. `createStore` handles are cached per
`db|store`. See `kits/demos/persistence.html` for live examples.

#### Collections

`collection(path)` is a record-bag API on top of the same idb-keyval store.
Use it when you have a list of records (with ids) instead of a single
blob. The path is `"<db>.<store>"` — the store IS the collection; each
record is one entry keyed by its id.

```js
const items = persistence.collection('dataShelf.items');
const saved = await items.put({ name: 'foo', code: '...' });  // id auto-assigned
await items.get(saved.id);
await items.delete(saved.id);
await items.all();         // [{id, ...}, ...]
await items.find(r => r.tags?.includes('snippet'));
await items.count();
await items.clear();
```

`put` preserves an incoming `id` if present (so re-imports overwrite
cleanly) and assigns a `crypto.randomUUID()` otherwise. There are no
schemas, indexes, or migrations — queries are JS over `all()`. For
collections that outgrow that (millions of records, indexed lookups),
extend the kit with raw-IDB helpers rather than introducing a second
library.

#### IndexedDB introspection

`persistence.idb` is a read-only window into whatever IndexedDB on this
origin holds — including databases this kit didn't create. Used by the
data-shelf importer to migrate from legacy Dexie databases, and useful
anywhere a page wants to surface "what's in IDB?"

```js
await persistence.idb.databases();           // [{name, version}, ...]
await persistence.idb.stores('DataJarDB');   // ['items', 'meta', ...]
await persistence.idb.count('DataJarDB', 'items');
await persistence.idb.readAll('DataJarDB', 'items');  // records[]
```

No writes, no deletes — read-only is the trust boundary. `databases()`
returns `[]` on older Firefox where `indexedDB.databases()` isn't
implemented; treat that as "unknown" not "empty".

### io.js

User-data ingress/egress: file picker, file download, blob preview, and
clipboard. JSZip is loaded lazily from
`cdn.jsdelivr.net/npm/jszip@3.10.1/+esm` only when `saveZip` is called.

```js
await window.io.pick('image/*')                 // → ArrayBuffer
await window.io.pickText('.json')               // → string
window.io.save(blob, 'out.bin')                 // download Blob/typed-array
window.io.saveJson({ a: 1 }, 'data.json')       // download as JSON
await window.io.saveZip([
  { path: 'a.txt', data: 'hello' },
  { path: 'remote.png', url: '/foo.png' }
], 'bundle.zip')
window.io.show(blob, 'application/pdf')         // open in popup window
await window.io.copy('text')                    // clipboard write
await window.io.paste()                         // clipboard read
```

`copy()` and `paste()` mirror the same three branches: a devtools
focus-wait branch (when `document.hasFocus()` is false they wait for
the next page click and retry), the modern `navigator.clipboard` API
when available in a secure context, and a hidden `<textarea>` +
`execCommand` legacy fallback for non-secure contexts like `data:`
URLs and older iOS Safari. `paste()` throws `Paste unavailable in
this context` if all branches fail (e.g. Firefox desktop, where
`readText` is gated and `execCommand('paste')` is blocked). Each
branch logs which path it took to the console. Note that wrapping
`io.paste()` in `setTimeout` may break the user-gesture chain on iOS
16+ — call it directly from the click handler. `pick` / `pickText`
reject on dialog cancel via the `cancel` event. See
`kits/demos/io.html` for live examples.

### messaging.js

In-memory pub/sub keyed on opaque path strings. No parent/child path
propagation — exact-match only. Subscribers receive
`(occasion, data, path)`.

```js
const off = window.messaging.subscribe('compress.sel', (occ, data) => { ... });
window.messaging.publish('compress.sel', 'change', { start: 0, end: 4 });
window.messaging.subscriberCount('compress.sel');
window.messaging.activePaths();
off();
```

Path strings are conventionally the same shape as `persistence.js`
(`"<db>.<store>.<key>"`) but this kit doesn't parse them — keys are
matched verbatim. See `kits/demos/messaging.html` for live examples.

### data-shelf.js

Record-shape conventions for the persistent scratch shelf used by
`pages/data-shelf.html`. Records live in `persistence.collection('dataShelf.items')`;
this kit defines the valid record shape, the `SHELF_TYPES` enum
(`js | html | json | text`), and the predicates / coercion used by the
data-shelf importer when ingesting records from legacy IndexedDB
databases.

```js
window.dataShelf.SHELF_TYPES        // ['js','html','json','text']
window.dataShelf.isShelfShaped(r)   // boolean — minimal shape check
```

UI metadata for each type (label, badge, exec) lives on the data-shelf
page in `cfg.types`; the canonical set of valid type names lives here so
the importer doesn't drift from the page.

## Salvage status

Every kit is in active use. The custom-element wrapper that used to live
here as `component.js` now lives in `alpine-bundle.js` as the `x-define`
directive — see the bundle demo at `pages/alpine-bundle-demo.html` for
examples.

| Kit | Demo | Notes |
|---|---|---|
| `compression.js` | (used in `pages/compression-helper.html`) | brotli + gzip + acorn |
| `fills.js` | `kits/demos/fills.html` | pure HTML string helpers, no Alpine |
| `persistence.js` | `kits/demos/persistence.html` | idb-keyval + collections |
| `messaging.js` | `kits/demos/messaging.html` | exact-match pub/sub |
| `io.js` | `kits/demos/io.html` | pick / save / clipboard |
| `data-shelf.js` | `pages/data-shelf.html` | record shape + importer support |
