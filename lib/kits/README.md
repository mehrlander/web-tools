# kits/

Themed logic libraries loaded via `gh.load`. Each kit is a plain script
(no `import`/`export`) that populates a single namespace on `window`.

## Concept

A **kit** is the third category of file in this repo, alongside:

- **Scaffolding in `lib/`** — `lib/gh-api.js`, `lib/gh-auth.js`,
  `lib/gh-fetch.js`, `lib/gh-store.js`, `lib/alpine-bundle.js`,
  `lib/vanilla-bundle.js`. The boot chain. `alpine-bundle.js` also owns the
  Alpine-coupled `x-define` directive (custom-element registration from a
  `<template>`), so kits can stay Alpine-free. `vanilla-bundle.js` is the
  no-framework alternative.
- **`lib/alpineComponents/*.js`** — UI components that register with
  `Alpine.data(name, fn)` inside `alpine:init`.
- **`kits/*.js`** — logic libraries that register a namespace on
  `window`. No Alpine coupling, no DOM rendering — pure functions or
  stateful service objects. (The daisyUI/Tailwind string helpers that
  used to live here as `fills.js` now hang off `window.html` in
  `vanilla-bundle.js`.)

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

See [`docs/SCAFFOLDING.md`](../docs/SCAFFOLDING.md) for the full loader contract.

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
`BR64("mylabel"):...`. See `kits/demos/compression.html` for live,
editable examples.

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
`popups/data-shelf.html`. Records live in `persistence.collection('dataShelf.items')`;
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

### console.js

Console retention/filter/subscribe layer, auto-loaded by `gh-boot.js` after
`gh-fetch.js`. It wraps `console.{log,info,warn,error,debug,table}` *on top
of* gh-api.js's existing hook (gh-api.js stays untouched — it's cache-shy)
and retains structured entries so a renderer can show JSON trees / tables,
not just flattened strings.

```js
console.history                       // live array of retained entries
const off = console.subscribe(fn);    // replays history, then streams new
                                      //   entries; fn gets { clear:true } on clear
console.filter({ level:'error', text:'fetch' });  // query over history
console.clear();                      // clears retained history too
window.consoleKit.truncated;          // count dropped past the 1000-entry cap
```

Each entry is `{ level, args, msg, time, kind? }`: `args` is a
`structuredClone` snapshot of the original call args (JSON-safe fallback,
then `null`), `msg` is the pre-joined text (copy + no-structure fallback).
`console.table` entries also carry `{ table:{data,columns}, kind:'table' }`.

The renderer is `alpineComponents/console.js` (the `debugConsole` component),
which the FAB embeds and `pages/console-kit-demo.html` exercises standalone.
It falls back to gh-api's raw `window.__consoleLogs` when this kit is absent.
Extending native `console` (rather than a separate `journal` global) keeps
callers writing plain `console.log()`; it's the same additive tactic
`console/base.js` uses for its formatting helpers, and the two are
orthogonal (this kit owns retention; base.js owns `style/box/see`).

### cm6.js

Framework-free [CodeMirror 6](https://codemirror.net/) editor factory. No
Alpine, no DOM opinions beyond mounting into the host you pass. The six CM6
modules load lazily (and once) from esm.sh on first `create()`, deduped by
shared sub-deps, with per-import retry/backoff and attribution so a failed or
hung import names the URL it came from (`?cm6stall=` / `?cm6fail=` reproduce
those paths).

```js
const ed = await window.cm6.create(hostEl, {
  value, language, wrap, lineNumbers, readOnly, fontSize, setup, // 'minimal'|'basic'
  onChange, onSelection, onRun,                                  // onRun binds Mod-Enter
});
ed.getValue(); ed.setValue(str); ed.setLanguage('js'|'html'|'plain');
ed.setWrap(b); ed.setLineNumbers(b); ed.setReadOnly(b); ed.setFontSize(px);
ed.focus(); ed.destroy(); ed.view;

window.cm6.preload();      // warm the module load without creating an editor
window.cm6.loadStatus();   // per-import state, for diagnosing a stall
```

**Load-order requirement:** `cm6` populates `window.cm6`, and the Alpine editors
that build on it — `alpineComponents/cm-editor.js`, `compress-input-cm.js` —
guard at mount and log `window.cm6 is missing` if it isn't there. Put
`gh.load('kits/cm6.js')` ahead of those components in the page's load chain.
Used directly (no Alpine) by `vanilla-demo.js`.

## Salvage status

Every kit is in active use. The custom-element wrapper that used to live
here as `component.js` now lives in `alpine-bundle.js` as the `x-define`
directive — see the bundle demo at `pages/alpine-bundle-demo.html` for
examples.

| Kit | Demo | Notes |
|---|---|---|
| `compression.js` | `kits/demos/compression.html` | brotli + gzip + acorn |
| `persistence.js` | `kits/demos/persistence.html` | idb-keyval + collections |
| `messaging.js` | `kits/demos/messaging.html` | exact-match pub/sub |
| `io.js` | `kits/demos/io.html` | pick / save / clipboard |
| `data-shelf.js` | `popups/data-shelf.html` | record shape + importer support |
| `console.js` | `pages/console-kit-demo.html` | console retention + `debugConsole` renderer |
| `cm6.js` | `vanilla-demo.js` / `pages/drop/cm6-editor.html` | lazy CodeMirror 6 editor factory |
