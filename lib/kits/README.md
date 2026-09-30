# kits/

Themed logic libraries loaded via `gh.load`. Each kit is a plain script
(no `import`/`export`) that populates a single namespace on `window`.

## Concept

The repo's code layers, and which folder a new file belongs in, are stated once
in [`docs/code-layers.md`](../../docs/code-layers.md). What follows is the kit
shelf's own admission rule.

A **kit** is a logic library that registers a namespace on `window`, with no
Alpine coupling. (The daisyUI/Tailwind string helpers that used to live here as
`fills.js` now hang off `window.html` in `vanilla-bundle.js`.)

This shelf holds every logic module; `lib/` root keeps only the loader, the
files extending its prototype, and the boot bundles. A kit is not defined by
portability or by use across apps: the rule sorts on attachment alone, and the
reasoning is in [`docs/code-layers.md`](../../docs/code-layers.md).

`tools/test/code-layers.test.mjs` holds the boundary in all three directions,
so a misfiled arrival fails the suite.

The line is **no Alpine and no DOM opinions of its own**, not "no DOM": `cm6.js`
mounts a live editor into a host element you hand it, `io.js` drives file inputs
and the clipboard, `pdf.js` renders pages and projects geometry into screen
space. What a kit must not do is decide where it lives, own reactive state, or
assume a framework. It takes the host it is given and returns a handle. A kit
that wants Alpine reactivity gets a component wrapper: `cm-editor.js` over
`cm6.js` is the reference pair.

The shape rules (so the file works through `gh.load`):

1. No static `import` / `export` statements at the top level. (`gh.load`
   runs the body inside `new Function`, where either keyword throws
   `SyntaxError`.)
2. Wrap the file body in an IIFE, `(() => { ... })();`, to keep helpers
   private.
3. End the IIFE by assigning the public namespace: `window.foo = { ... };`
4. Third-party libraries load lazily inside functions via dynamic
   `await import('https://cdn.jsdelivr.net/npm/...')`. That's an expression and
   works fine inside `new Function`'s body.
5. Internal "imports" between kits are reads from `window.otherKit`.
   Order them in the page's `gh.load` chain accordingly.

See [`docs/loader.md`](../../docs/loader.md) for the full loader contract.

## Current kits

Open the [Kits tab](https://mehrlander.github.io/web-tools/app/?view=map&tab=kits)
for the full list. Each row gives the namespace, the first line of the header
comment, how many files load the kit, whether it loads on every page, and
whether it has a demo. The data is in [`docs/kits.csv`](../../docs/kits.csv).
A script rebuilds that file from the kits.

Each kit is documented in its own header comment, which is authoritative.
The sections below are for what a header does not hold: operating
constraints, gotchas, and pointers to demos and tests.

### compression.js

Documented in its header comment: [`compression.js`](compression.js).
A payload label rides as `BR64("mylabel"):...`; see
`kits/demos/compression.html` for live, editable examples.

### persistence.js

String-path key/value over
[`idb-keyval`](https://github.com/jakearchibald/idb-keyval). All values
go through IndexedDB's structured clone, so `Uint8Array`, `Date`,
`Map`, `Blob`, etc. round-trip with their types intact.

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

The base namespace is read-only; the destructive operations (`clearStore`,
`deleteStore`, `deleteDb`, `replaceAll`) sit under `idb.admin`. `databases()`
returns `[]` on older Firefox where `indexedDB.databases()` isn't
implemented; treat that as "unknown" not "empty".

### io.js

User-data ingress/egress: file picker, file download, blob preview, and
clipboard. JSZip is loaded lazily from
`cdn.jsdelivr.net/npm/jszip@3.10.1/+esm` only when `saveZip` is called.

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

UI metadata for each type (label, badge, exec) lives on the data-shelf
page in `cfg.types`; the canonical set of valid type names lives here so
the importer doesn't drift from the page.

### console.js

Console retention/filter/subscribe layer, auto-loaded by `gh-boot.js` after
`gh-fetch.js`. It wraps `console.{log,info,warn,error,debug,table}` *on top
of* gh-api.js's existing hook, without modifying gh-api.js, and retains structured entries so a renderer can show JSON trees / tables,
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
which the FAB embeds and `pages/demos/console-kit-demo.html` exercises standalone.
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

**Load-order requirement:** `cm6` populates `window.cm6`, and the Alpine editors
that build on it — `alpineComponents/cm-editor.js`, `compress-input-cm.js` —
guard at mount and log `window.cm6 is missing` if it isn't there. Put
`gh.load('kits/cm6.js')` ahead of those components in the page's load chain.
Used directly (no Alpine) by `vanilla-demo.js`.

### proof.js

Documented in its header comment: [`proof.js`](proof.js).
`vanilla-demo.js` and `chat-render.js` read `window.proof` at call time, so
put `gh.load('kits/proof.js')` ahead of either in the page's load chain.

### wring.js

Single-document template induction: give it one document with repeated
structure (a log, raw HTML, structured records) and it returns the recurring
**templates** (fixed boilerplate with variable **slots**) plus the values that
fill each slot. Lossless: templates + slot values reconstruct the original
exactly.

Two design choices differ from `archive/wring/ARCHITECTURE.md`. **Stage 2 is
Re-Pair** (Larsson & Moffat, 2000) where that document names Sequitur: both
build a hierarchical grammar of exact repeats, Re-Pair is offline and greedily
replaces the most frequent digram, and the `{ start, rules, ruleUses }`
interface takes either. **Stage 3 has two groupers** because Bookend Merge
groups on the longest shared literal, which on a log line is an incidental
field: records sharing a client IP group together while the real template
fractures. `groupByAlignment` groups on positional agreement instead, the Drain
and LogMine idea, and is what `induce(text, { group: 'align' })` selects.

After loading:

```js
// End-to-end on text: one call, templates out
const run = window.wring.induce(logText, { group: 'align' });
run.result.groups     // [{ template: '192.168.1.${0} - - [...] ${5} ${6}', members, score }]
run.fidelity          // { pass, total } — reconstruction check

// DOM: repeated components from a live document or DOMParser result
const sigs = wring.extractSignaturesFromNodes(document);   // tag#id.class.class strings
const res  = wring.groupByTemplate(sigs, { maxSlots: 2 }); // templates + slot values

// The stages individually
wring.tokenize(text, 'punct')         // Stage 1: lossless tokenizers (punct/word/char/line)
wring.induceGrammar(tokens)           // Stage 2: Re-Pair grammar of exact repeats
wring.groupByTemplate(strings, opts)  // Stage 3-4: Bookend Merge + greedy MDL
wring.groupByAlignment(records, opts) // Stage 3 alternative: positional alignment
wring.selectTemplates(input)          // Stage 4: full MDL + weighted interval scheduling
wring.reconstruct(template, slots)    // Stage 5: exact reconstruction
```

Demo pages: `pages/demos/wring-text.html` (logs/records → templates) and
`pages/demos/wring-dom.html` (DOM signatures or pasted HTML → repeated components).
Kit liveness test: `tools/test/wring.test.mjs` (part of `npm test`; loads the
kit the way `gh.load` does and checks the pipeline invariants end-to-end).

### treemap.js

Pure logic for mapping a file tree as a treemap — no DOM, no colors
(rendering stays with the page; `pages/repo-atlas.html` is the consumer).
Extracted so the kernels run under `npm test`
(`tools/test/treemap.test.mjs`: tiling invariants, rollups, taxonomy).

`squarify` tiles the rect exactly (area ∝ weight, no overlap) and guards
degenerate input: zero/empty weights and extreme skew emit zero-size
rects rather than negative extents.

### build.js (moved to `lib/` root, 2026-08-08)

Lives at [`lib/build.js`](../build.js): it extends `GH.prototype`
(overriding `.read` and `.get` while a build runs), which the admission rule
makes scaffolding.

Its header comment documents the design and the API; the notes below cover
what the header does not.

`emit` reproduces the bootstrap offline, still honoring `?use=<ref>` (an
explicit ref falls through to the network), and sets
`window.__builtOffline`. Optional `data` does for `read()` what `cache`
does for `get()`: a `path → value` map consulted before the local probe
and before the network, which is how a single-file copy carries data it
cannot lay down as sibling files.

`bake` rewrites the page's `lib/entry.js` import **call**, the one boot
every loader page shares. It matches the call rather than a literal URL,
because a specifier spelled another way would leave the page looking
chainless when it is merely unreachable: the output looks finished and then
asks the network for its modules. `bakeable` is the honest predicate for
"there is nothing to inline," which is a real state (a page with no chain is already a
standalone artifact). See "Load and build are one contract" in
[`docs/loader.md`](../../docs/loader.md) and the pipeline in
[`tools/README.md`](../../tools/README.md).

### export.js

Export the current page as a portable zip, or as one pasteable HTML string.
The header comment in [`export.js`](export.js) explains the two zip modes and
`renderCopy` and lists the API; the facts it lacks are below.

What `renderCopy` cannot inline it counts: `cdnRefs` is the number of
run-time references to this repo's `lib/` on GitHub Pages that survive
baking.

Those references break on a private repo, so they are reported at copy
time rather than discovered on paste. A page that follows the loader leaves
none.

The page path comes from `opts.path` or the FAB's `[data-path]` stamp;
the page source is fetched pristine from the repo at the booted ref, not
scraped from the post-Alpine DOM. `kits/io.js` and `build.js` load
on demand if absent.

### brief.js

Assemble the current page into a **review brief**: one markdown document
carrying the page source plus the source of the modules the page itself
loaded, sized for pasting into a chat model. The header comment in
[`brief.js`](brief.js) explains the four rings and why the boot chain is
left out.

`assemble` refuses a page whose closure exceeds `BRIEF_CAP`
(`plan().wholeLib`), which `app/index.html` does, unless `opts.force`, and
points at a Region from the FAB's take grid instead.

`stageUrl` is the seam with the stage: the FAB is the only thing that can
know *which* files a running page pulled in, and the stage is the tool that
specializes in choosing among them. It mints the single-group case of
`StageLink`'s grammar directly, since `stage.js` is a full Alpine component
and is not loaded on an ordinary page.

### md-doc.js

Documented in its header comment: [`md-doc.js`](md-doc.js). The notes below
cover what the header does not.

A declared render also carries the kind's own vocabulary, from the `KIND` literal
here, which is why the annotator's aim reads **Markdown section** rather than
the implementation's word for it. `docs/routes-kinds.csv` is the owner of that
row and `tools/test/routes-manifest.test.mjs` holds the two together; the same
arrangement `docs/routes-routes.csv` has with toss-render's inlined
`TOSS_ROUTES`. Declaring is what a render OPTS INTO, and a render that skips it
is indistinguishable from a page with no markdown on it: a render that calls
`contain()` alone offers neither the heading menus nor the Section aim.

**Enhance** is render's second half, for markup another renderer produced.
`guide-render.js` renders a doc with the link re-aiming a guide body needs, and
the Files pane reads markdown through it; that reader wants the containment and
the controls without giving up the re-aiming. The `src` handed to it must be the
source that produced that markup, and nothing can check it: get it wrong and
every control copies the wrong lines.

The copy control carries `data-annotate-ui`, which is how `annotate.js` knows
to keep it out of the text a note is anchored in.

**Sections nest, and the hierarchy is arithmetic rather than a walk.** `chain`
gives a section's ancestors by rank (innermost first, the shape `Peek.chainOf`
uses so one renderer serves both), `children` the sections exactly one rank
finer before a peer closes the run, `headOf` the heading node for any section
index, and `stats` what a passage holds counted in markdown's units: words,
paragraphs, list items, code blocks, tables, quotes, links. Counted off the
SOURCE, so a fence full of hyphens is one code block rather than the list it
resembles.

### annotate.js

Notes pinned to pieces of a page: select text (or pick an element, or drag a
rectangle), write a note, and carry the set out as markdown for a chat model,
as JSON (`annotate/1`), or as one jot in the estate registry. The unit is the
**annotation set**, not the single note: several small notes against one
document, shipped together, which is what neither a screenshot nor a copied
quote does.

`kits/peek.js` is a soft dependency the way `dictate.js` is: load
`annotate.js` alone and every reading works except the DOM reading, whose chip
is simply absent. Peek's computations read the element's own document and need
no `enable()`, so nothing of Peek's own UI is mounted by asking. Both loaders
chain the trio, and the FAB's `_loadAnnotate` treats either extra as
best-effort: a failure costs one chip, not the notes.

The FAB's take grid carries it as **Annotate** (the one take that operates on
the view rather than carrying it away), aiming at the subject frame's
document inside a readable `#gh=` toss; a `#gz=` sandbox is opaque and gets
the shell, which the take's caveat says. `pages/annotate.html` is the page
half: load any `owner/repo[@ref]:path` document and annotate it.

The composer's voice half is **`dictate.js`**, below, and it is a soft
dependency: load `annotate.js` alone and everything works except the
microphone, which simply never appears.

### dictate.js

Documented in its header comment: [`dictate.js`](dictate.js).

### peek.js

Documented in its header comment: [`peek.js`](peek.js). The library half
(`atom`, `chainOf`, `selectorFor`, `covers`) is documented at each function.
The page half is [`pages/peek.html`](../../pages/peek.html); the browser facts
(pointer path, outlines, auto-dock) are driven by
`tools/render/scenarios/peek-walk.mjs`, since jsdom has no layout.

### wsl-core.js

Dependency-free core for Washington State Legislature data: URL builders
for the `wslwebservices.leg.wa.gov` endpoints, the XML→record parsers as
a factory, pension classification against a built-in RCW map, and pure
list/group helpers. The one twist on the kit shape: it imports nothing,
taking its XML libraries through `makeParsers({ XMLParser, flatten })`,
so the same file runs in the browser (via `gh.load`, with `wsl.js`
injecting the CDN builds) and in Node (`fetch-data.mjs` injects the npm
builds). Registers `globalThis.wslCore`.

### wsl.js

Browser wrapper over `wsl-core.js`: loads the core, lazy-loads
`fast-xml-parser` and `flat` from the CDN on first parse (a snapshot-only
page never pulls them), and registers `window.wsl` with the parsers,
fetch-and-parse helpers for the WSL services (CORS permitting), a
committed-snapshot loader with an IndexedDB overlay, and RCW reference
lookups with linkify/tooltip/popup builders. Returns its async wiring, so
`gh.load('kits/wsl.js')` resolves when `window.wsl` is ready. Consumers
live in `pages/wsl-sync/`.

### pdf.js

Browser PDF extraction: text with resolved fonts and per-character geometry,
the vector rules a page draws, and table structure recovered two independent
ways.

The split is the point. `geom`, `stream`, and `lattice` are **pure**: plain
arrays in, plain arrays out, no pdf.js and no DOM. Every structural decision
the kit makes lives there, which is why the whole table-detection surface is
testable under node against synthetic geometry. Only `open()` and `firstLook()` load pdf.js,
and only `doc` needs pdf-lib (both load lazily from jsDelivr).

The two libraries load **separately**, and a caller that only reads should say
so. `loadPdfjs()` is the reading half, `loadPdfLib()` the writing half, and
`loadLibs()` still means both. `open()` takes the first, everything under `doc`
takes the second, and nothing takes both. That matters to anyone rendering
rather than editing: the viewer's `pdf` mode
([`alpineComponents/viewer.js`](../alpineComponents/viewer.js)) draws a page
with pdf.js alone, so it no longer pulls roughly a megabyte of editor library
it never calls before the first pixel. `tools/test/viewer-pdf.mjs` asserts that
request is never made, since the regression is invisible from the pixels.

A viewer also does not want `open()`. It parses every page's text and operator
list up front, which is exactly right for extraction and wrong for showing page
1 of a 200-page submittal; show it through `firstLook(src)` instead, as the
viewer's `pdf` mode does.

`stream` and `lattice` read the same page from unrelated evidence (where the
text sits, versus the rules drawn on it), so running both and comparing is a
control that one method run twice cannot give you. Agreement is evidence;
disagreement is a finding.

`view` is the bridge to anything visual, and it is pure: hand it a viewport (or
any `{width, height, transform}`) and it projects geometry into screen space and
back through the real inverse matrix. That belongs in the kit and not in each
overlay: converting mouse pixels back by dividing by the scale drops the
translation and drifts. An Alpine component that wants drag-selection is then a
pointer-event shell over `v.select`, the same way `cm-editor.js` is a shell over
`cm6.js`.

[`pages/pdf-inspect.html`](../../pages/pdf-inspect.html) draws every layer on
top of the rendered page, with drag-selection wired to `view.select`, and a
Stack mode that lays the pages on a third axis so what recurs reads as a band
through the document and a trim can be seen cutting before it commits. It is
the visual check the numeric suites cannot be. Version pinning is settled by
running rather than by changelog: `npm run test:pdf-versions`. Tolerances,
failure modes, the measured font-alignment numbers, the government-PDF
pathologies, and the honest limits are in
[`docs/pdf-structure.md`](../../docs/pdf-structure.md).

**Two ways in.** The page reads a local file (picker or drop) and an
**address**, `#gh=owner/repo[@ref]:path`, and accepts `?src=` in the same
grammar, which is what the `#pdf=` toss route feeds it. `#data=<a pdf>` is the
first look, the viewer's `pdf` mode with a pager; `#pdf=<the same file>` is the
workbench, this page with its layers, trim and two table readings. Both are in
[`docs/routes-routes.csv`](../../docs/routes-routes.csv).

### xlsx.js

OOXML (`.xlsx`) structural inspector: unzip, walk every XML/rels part, and
surface the internal cross-references (shared strings, styles, sheet rels,
comments, calc chain, defined names) plus reconstructed sheet data. It is a
pure kit: no DOM rendering, no jQuery/Tabulator. `analyze()` takes
already-extracted XML strings and is synchronous and part-order-independent
(cross-file resolution happens in a finalize pass once every part is walked),
so a sheet processed before `sharedStrings.xml` still gets its string values.
`readZip()` is the thin JSZip-backed convenience wrapper a page actually calls
(JSZip loads lazily, same pattern as `io.js`).

**Addressing a place inside a workbook** is the viewer's, not the kit's:
`ViewRegistry.parsePlace` reads `Sheet!H11`, `H11`, `A1:C3` or a bare name, and
a mounted sheet publishes `locate({ sheet, cell, text })` on its root's
`__sheets`, which switches sheets, resolves a covered cell to the merge that
draws it, scrolls and marks. What makes it possible here is that `sheetLayout`
gives every cell its A1 address, so the render can carry one.

**Three boundaries worth knowing, each a case where the kit declines rather
than guesses.** A conditional rule of type `expression` is a formula, and
evaluating one means a formula engine; those are skipped and counted in
`sheetLayout`'s `cfSkipped`, so a caller can say how much of Excel's painting
it is not showing. A picture is read from DrawingML anchors; the legacy VML
drawings Excel uses for comments and form controls are not, so a comment's TEXT
is read while the box Excel would draw it in is not. And a list validation
resolves an inline `"a,b,c"` or a cell range on any sheet, but a defined name
returns null and the cell then carries only its prompt.

**Comments are the legacy kind, and the part is found by walking the rels.**
Nothing in the sheet XML names it: `<legacyDrawing>` points at the VML, and the
comments part rides a relationship with no referring element, so `comments3.xml`
can belong to `sheet1` and does in OFM's OneWA template. Excel writes the
author's name as the comment's first run, followed by a colon; it is the same
string the author field carries, so the kit strips it once rather than leaving
every consumer to. A threaded comment (`xl/threadedComments/`) is skipped, since
Excel writes the same text into a legacy part beside it and reading both lists
each comment twice.

**Two readings, and the second is why the style records exist.** `sheetRows`
answers "what values are in this sheet" and feeds a data grid. `sheetLayout`
answers "what does this sheet look like" and feeds a render that reproduces the
document: it is what the viewer's `sheet` mode draws, and what makes an OFM
budget form arrive as a form rather than as a list of strings. Neither touches
the DOM; a caller turns a style record into whatever it draws with.

**A formula arrives as its stored text**, not as a boolean. A
row's `formulas` map holds the formula as the file writes it (no leading `=`,
which is Excel's UI rather than the stored string) for every computed cell that
has one, and `true` where the file stored none: that is a SHARED formula's
followers, which carry `<f t="shared" si="0"/>` and nothing else. Recovering
those means rewriting relative references per cell, so the honest answer is
"computed, text not stored here". Both are truthy, which is the contract
`profileColumns` already read when counting a computed cell apart from an
entered one.

`analyze(parts)`, the pure entry point, takes `[[path, xmlString], ...]` or
`{path: xmlString}` for already-extracted `.xml`/`.rels` parts, so it's
testable with plain fixture strings (`tools/test/xlsx.test.mjs`) and needs no
real `.xlsx` file or JSZip. One known limitation remains: cell-to-column
mapping trusts each `<c>`'s `r` attribute, falling back to positional order
only when `r` is absent, which is standard but not universal among third-party
writers. Named ranges and calc-chain entries resolve through `workbook.xml`'s
`<sheets>` and its rels, so they survive a reorder or a rename. See
`kits/demos/xlsx.html` for live examples.

### xlsx-extract.js

**Pick part of a workbook and carry the answer away.** `xlsx.js` reads every
part and returns plain objects; this kit is the selection over that reading, and
nothing more. It writes no file back, reconstructs no workbook, and renders
nothing. It reads `window.xlsxKit` at call time, so load that first.

The current picker is **sheet-centered**. Each sheet has its own selected
readings, and each pivot, cache, connection, or Power Query section is a
separate choice. The original cross-product API remains available for callers
that use it. The full table of kinds and their limits is in
[`docs/envelopes/workbook-extract.md`](../../docs/envelopes/workbook-extract.md).

One kind is not a table: `cells` is the serialized-workbook shape, one object
per sheet with every cell as `{Address, Formula, Value}`, which is what home's
PowerShell exporter writes and its fund view's reader consumes. It writes a
shared-formula follower as `=[fill N] <master text>`, which is why `xlsx.js`
now keeps each cell's shared index and each sheet's master texts. Never cut.

**The answer is a data-view envelope**, so it renders in
[`pages/data-view.html`](../../pages/data-view.html) with no new page and no
change to [`data-payload.js`](data-payload.js): that reader's discriminator is
structural rather than a `kind` check, so a superset kind is already admitted.
What the profile adds is the one thing data-view has no slot for, the provenance
of the pick: which workbook, at which ref, what was taken (`picked`) and what
was left (`left`). Per item, `rows` against `total` plus `truncated` say whether
that item is short of what the file holds, which is `pivotRecords`' habit and
the reason this kit keeps it; the same fact is derived into the item's `note`,
so today's data-view reader shows the cut without knowing this format.

**Where a survey count and an extract's rows would disagree, the count is
wrong,** and `tools/test/xlsx-extract.test.mjs` holds them equal per kind: a
picker showing 400 beside an item holding 12 is a lie about the file rather than
about the cut.

### xlsx-write.js

The write half of `xlsx.js`, which reads a workbook and never writes one. It is
also the sibling of `xlsx-extract.js` above, and the pair divides cleanly: both
are a selection over one reading, but extract carries the answer away as data
and reconstructs no workbook, while this one rebuilds the package and hands back
a file Excel opens.
`rebuild(bytes, keepNames)` returns a new package holding only the sheets
named, plus a manifest saying what survived. `plan(read, partNames, keep)` is
the pure, synchronous half: it answers what keeping a given set implies before
anything is written, which is what lets a picker show the consequences of a tick
rather than the consequences of a rebuild.

**Reproduction, not subtraction, and the difference is the point.** The faithful
way to drop a sheet is to edit the package in place: delete the parts that sheet
owns and patch `workbook.xml`, `[Content_Types].xml` and the rels around the
hole, leaving everything untouched byte-intact. This kit does the other thing.
It loads the source into ExcelJS, drops the sheets, and lets the writer re-emit
every part, so what survives is what the writer models. That was chosen to find
out what reproduction costs on real files, and the manifest is where the cost is
declared rather than discovered.

**ExcelJS rather than SheetJS, measured.** Round-tripping three OFM budget forms
and re-reading each output with `xlsx.js`: ExcelJS keeps 17144/17148, 1640/1642
and 458/502 cells where SheetJS keeps 13872, 327 and 52, and 49/56 cell format
records where SheetJS keeps 3. SheetJS's community build writes no cell styles
and drops the empty-but-formatted cells a blank form is mostly made of; its
output was also 2.0 MB from a 56 KB source, since it emits 32,768 column
definitions. SheetJS earns its place in the check suite instead, as the
independent reader over the output.

**The graft is what makes a checkbox list honest.** A writer models no VBA, no
pivot cache, no `customXml` and no workbook connections, so offering those as
options with only a writer behind them would be offering inert controls. After
the base package is written, the source's own bytes for those parts are copied
in with JSZip, along with the source's own content-type and relationship
*entries*, taken verbatim rather than rebuilt from a hardcoded table of type
URIs. A graft that does not take is reported and skipped, and the workbook still
opens.

**What it will not carry, in full.** Per-sheet `printerSettings`; hyperlinks
where two share an anchor cell or one carries only a location fragment (the
writer models a link as a property of a cell); the *scope* of a sheet-local
defined name, since every name is emitted workbook-global; and `calcChain.xml`,
which goes deliberately because it is a recalculation cache whose every index
moves when a sheet goes. `fullCalcOnLoad` is set in its place. `workbookView`'s
`activeTab` is clamped rather than dropped, which is the one index trap that
does not fix itself.

**And what it carries that a count says it lost.** Across thirteen real forms
every cell the writer did not re-emit was one of two things: an empty cell whose
style record is the package default in every field, or text inside a merged
range but not at its top-left, which Excel does not display and a formula can
still read. `manifest.cellLoss` separates those from real loss, so the count is
flagged only when something else goes.

`pages/xlsx-picker.html` is the interface over it, through
`alpineComponents/xlsx-picker.js`; `scripts/xlsx-picker-sweep.mjs` runs it over
a directory of real workbooks. **`npm run gold-set`** builds the committed
[`gold-set/`](../../gold-set/): three chosen workbooks, rebuilt with a sheet
dropped, for someone to open in Excel. The selection is declared in
`scripts/gold-set.mjs` with a reason per file, and the script refuses any
selection whose kept sheets still read a dropped one, following the defined-name
hop that these forms actually point through. The folder is committed rather than
regenerated on demand because the sources are in a private repo, so a session
with only this one cannot rebuild them and a gitignored copy reaches nobody.
What makes storing it safe is that the rebuild is byte-reproducible, held by the
suite, so `--check` diffs exactly when the kit changes what it writes.

### docx.js

WordprocessingML (`.docx`) preparation: what a Word file has to have done to
it before a browser renderer draws it faithfully, and what it knows about
itself that a render cannot show. The viewer's `page` mode paints a `.docx`
with [docx-preview](https://github.com/VolodymyrBaydalka/docxjs) (Apache-2.0,
pinned at 0.4.0, one dependency: JSZip), which reads page geometry, headers and
footers, shading, fonts, tab stops and list numbering off the file. Measured on
the 30 committed `.docx` in `mehrlander/home` (2026-09-04) it had six gaps, and
this kit closes them **before the bytes reach the painter**, so the estate
depends on a pinned upstream build and nothing patched inside it.

```js
const { bytes, report } = await window.docxKit.prepare(fileBytes);
// bytes:  the same package, rewritten where normalize() changed a part
// report: { controls, bullets, breaks, headerRefs, simpleFields, fields, byPart, skipped, survey }

docxKit.normalize(parts)            // the pure entry point: [[path, xml], ...]
                                    //   or { path: xml } for the body parts and
                                    //   word/numbering.xml -> { parts: changed
                                    //   only, report }. Idempotent.
docxKit.unwrapControls(xmlDoc)      // every w:sdt replaced by its content,
                                    //   deepest first; returns the count
docxKit.mapBullets(numberingDoc)    // a Symbol/Wingdings byte in a bullet
                                    //   level -> its Unicode glyph, font hint
                                    //   dropped; returns the count
docxKit.survey(documentDoc)         // { paragraphs, tables, headings: [{ id,
                                    //   style, text }], controls: [{ kind,
                                    //   level, parent, alias, tag,
                                    //   placeholder, checked, text }] }
docxKit.listControls(xmlDoc)        // the controls half of survey, any part
docxKit.markPageBreaks(documentDoc) // a paragraph's pageBreakBefore ->
                                    //   w:br type="page" (the painter reads
                                    //   only the style-level one)
docxKit.fixHeaderRefs(documentDoc, settingsXml)
                                    // inherit missing header/footer refs;
                                    //   drop even-page refs unless enabled
docxKit.expandSimpleFields(xmlDoc)  // w:fldSimple -> the complex run form
docxKit.markPageFields(xmlDoc)      // PAGE / NUMPAGES results -> sentinels
docxKit.BULLET_GLYPHS               // the glyph table, by font and byte
```

**Six gaps, each a fact about docx-preview 0.4.0, each closed in the file
before it is painted.** A content control (`w:sdt`) inside a table row or cell
is dropped: its row and cell parsers have no case for one, while its body and
paragraph parsers do. That was 45 controls across the corpus, including every
section label in OFM's Decision Package Template fiscal table, which rendered
as empty grey bands. A bullet set in Symbol or Wingdings is a private-use
character in that font (U+F0B7 for the Symbol dot); where the font is absent it
draws as nothing. The glyph table is mammoth's `dingbat-to-unicode`, cut to
the codes Word's bullet library uses; the corpus pairs `F0B7` with Symbol and
`F0A7` with Wingdings, and a Courier New `o` is a letter and is left alone.
A paragraph's own `pageBreakBefore` is ignored (the property is read off the
style only), so it is written as the explicit page break the painter does
honour. A section naming no header or footer does not inherit the previous
section's as the spec says, and an even-page reference is applied to every
second page whether or not `settings.xml` enabled even and odd headers (no file
in the corpus does), so the references are copied forward and the even ones
dropped. And a PAGE or NUMPAGES field is drawn as its cached result, so the
result is replaced with a sentinel (`PAGE_FIELD`, `NUMPAGES_FIELD`) the page
mode swaps for the real numbers once the pages exist. And a field in its simple
form (`w:fldSimple`) is parsed with no children, so its result is not drawn at
all; each is rewritten as the complex form (begin, instruction, separate,
result, end) the painter does draw. The corpus writes every field in the
complex form, so the gap showed only on a fixture.

**The survey is taken before the unwrap**, because a control's kind, its
checkbox state and whether it still shows its placeholder are facts the
rendered page no longer carries. Headings come with their `w14:paraId`, on
2,713 of the corpus's 3,713 paragraphs: the Word analogue of a cell address,
and the unit an aim would be built on. `KIND` is the kit's copy of its
`docs/routes-kinds.csv` row, held to the registry by
`tools/test/routes-manifest.test.mjs`.

**Boundaries, each a case where the kit declines rather than guesses.** A
`w:sym` run (a symbol typed into the text rather than a list level) is not
mapped; none occur in the corpus. A bullet byte the table lacks stays as
written. A part that does not parse is skipped and named in `report.skipped`,
so one malformed header cannot stop the document. Tracked changes, footnotes
and comments are the painter's to draw and are not prepared here; the corpus
has none of the first two and one of the third. `SECTIONPAGES` and every other
field keep their cached result. Word's saved page-break markers
(`lastRenderedPageBreak`) are not honoured and not repaired: measured across the
corpus they reproduce Word's own page count in 14 files of 30, missing where a
break fell inside a table and stale where the file was edited after its last
full save. The painter draws each section as one tall box and the page mode
cuts it into pages of the section's page height, at block boundaries and at
table rows (`ViewRegistry.paginate`), so the count NUMPAGES reports is the
viewer's, which for the two OFM forms matches Word's (6 and 5) and elsewhere
can differ by a line's worth of font metrics. Header geometry is the painter's: header at the file's header
margin, body at its top margin, a floating logo where its anchor puts it, so a
logo that overlaps body text in the render most likely overlaps in Word.

**Held two ways.** `tools/test/docx.test.mjs` exercises `normalize()` on
fixture XML with a control at every level and a bullet in each font.
`npm run test:viewer-docx` drives the real viewer in a browser: the fixture
document opens on the page render, a cell-level label is drawn, the bullet is a
list marker, a `javascript:` link has lost its `href`, the fixture's 40 filler
paragraphs and 40-row table cut into pages of page height with every word still
there once and the footer counting them, `__doc.locate` lands on
a phrase, and a pinch or a ctrl-wheel zooms the page about the fingers with the
pdf column's pill as the way back to fit width. `--docx <file> --shot out.png` renders a real file and writes the
pane.

## Salvage status

Every kit is in active use. The custom-element wrapper that used to live
here as `component.js` now lives in `alpine-bundle.js` as the `x-define`
directive; see the bundle demo at `pages/demos/alpine-bundle-demo.html` for
examples.

| Kit | Demo | Notes |
|---|---|---|
| `compression.js` | `kits/demos/compression.html` | brotli + gzip + acorn |
| `persistence.js` | `kits/demos/persistence.html` | idb-keyval + collections |
| `messaging.js` | `kits/demos/messaging.html` | exact-match pub/sub |
| `io.js` | `kits/demos/io.html` | pick / save / clipboard |
| `data-shelf.js` | `popups/data-shelf.html` | record shape + importer support |
| `console.js` | `pages/demos/console-kit-demo.html` | console retention + `debugConsole` renderer |
| `cm6.js` | `vanilla-demo.js` / `pages/drop/cm6-editor.html` | lazy CodeMirror 6 editor factory |
| `cm6-merge.js` | `pages/review.html` | read-only CM6 split/unified diff views; display sibling of `cm6.js` |
| `text-diff.js` | `pages/diff-tool.html` / the stage's Diff lens | patience line diff + word diff; pure, no renderer. `cm6-merge.js` is the other diff shelf: this one computes, that one displays |
| `review-target.js` | `pages/review.html` | parse/mint the review address grammar (`gh=owner/repo[@ref][:path][&base=]`) |
| `brief.js` | the FAB's "Take this page" menu | page + its own modules as one pasteable markdown brief |
| `wring.js` | `pages/demos/wring-text.html` / `pages/demos/wring-dom.html` | template induction; live here, reference snapshot at `archive/wring/` |
| `treemap.js` | `pages/repo-atlas.html` | squarified treemap kernels + file taxonomy |
| `../build.js` | `tools/build/` + the FAB export | one emitter, two consumers; `lib/` root since 2026-08-08 (extends `GH.prototype`) |
| `export.js` | the FAB's export control | page + `read()` data as a zip |
| `dom-shot.js` | the FAB's Image takes | visible view, full page, or a Peek-picked element rendered to PNG with explicit fidelity warnings; lazy modern-screenshot |
| `wsl-core.js` | `pages/wsl-sync/` + Node fetch | dependency-free; libs injected |
| `wsl.js` | `pages/wsl-sync/` | browser wrapper; lazy XML libs |
| `xlsx.js` | `kits/demos/xlsx.html` | OOXML structural walk; pure/testable, lazy JSZip |
| `docx.js` | `npm run test:viewer-docx` | WordprocessingML preparation for the page render; pure/testable, lazy JSZip |
| `pdf.js` | `pages/pdf-inspect.html` + `npm run test:pdf` | pure geom/stream/lattice/view; lazy pdf.js + pdf-lib |
