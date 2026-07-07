# console/ — paste-into-DevTools toolkits

Code you paste into a browser console and run against the page in front of
you. Nothing here is hosted or imported by pages; the deliverable is the
paste.

## Layout

- [`base.js`](base.js): the standalone core. Selection (`ea`, `glom`),
  accessors (`text`, `rect`, `sig`, `dom`, `el`), visual marking (`mark`),
  structure stats (`summary`), export helpers (`pop`, `packTable`, `copy`),
  console formatting (`console.style/box/see/help/env`). Works alone;
  everything else layers on top.
- [`mods/`](mods): one feature per file. Each is an independent IIFE that
  expects base.js to have run first, so any single mod can be pasted after
  base without the others.
- [`suite.js`](suite.js): **generated** — base.js plus every mod, in one
  paste. Rebuild with `npm run build:console` (the build-on-commit hook does
  this automatically when `console/` changes). Don't edit it; edit base or a
  mod.

The find → dance → grab loop, end to end: `census()` or `glom.templates()`
to orient, `pick` two examples, `grow` (or a template grab) to the full set,
`deck` to watch it live, verbs or `q()` to move, `lasso` to trim spatially,
`columns` + `packTable` to carry it off, `infer` to keep a replayable
selector, `harvest` when the list is virtualized, `tap` when the DOM is
hostile and the wire is honest.
- [`to-canvas.js`](to-canvas.js): unrelated one-off; renders the page into a
  scrollable canvas.

Adding a mod: create `mods/<name>.js`, add it to `MODS` in
[`tools/build/console-suite.mjs`](../tools/build/console-suite.mjs) (the
build fails if the manifest and directory disagree), cover it in
[`tools/test/console-suite.test.mjs`](../tools/test/console-suite.test.mjs).

## The working set

`glom` keeps a persistent selection in the DOM itself (`data-glom`
attributes): it survives across console expressions, renders as numbered
badges, and has history (`glom.undo()`). Everything below reads or moves
that set.

## Mods

### verbs — lockstep set navigation

The set moves as one cursor over N parallel subtrees; members whose step
lands nowhere drop out, landings dedupe.

```js
glom('hearing')        // seed: all elements whose own text contains "hearing"
glom.up('tr')          // each member -> closest tr ancestor
glom.down('a')         // each member -> its first <a> descendant
glom.downAll('td')     // union of every td under each member
glom.over(-1)          // each member -> previous sibling
```

### query — `q(expr)`, a Playwright-flavored chain grammar

Stages separated by `>>`, each transforming the element set. Playwright's
`css >> text= >> nth=` chaining, browser-native, plus dance stages
(`up/down/over`) Playwright doesn't have.

```js
q('#bills >> tbody tr >> has-text=hearing >> down=a >> nth=0-4').glom()
```

| stage | meaning |
| --- | --- |
| `<css>` | querySelectorAll — document-wide first, then within each member |
| `text=foo` | own text contains "foo", case-insensitive |
| `text="Foo"` / `text=/re/i` | exact (whitespace-cleaned) / regex |
| `has-text=…` | same three forms, against full `textContent` |
| `has=<css>` | keep members containing a descendant match |
| `visible` / `visible=false` | filter by `sig.visible` |
| `nth=2` · `nth=-1` · `nth=1-4` | index (0-based, negatives from end) or inclusive range |
| `up` · `up=2` · `up=<css>` | parent / nth ancestor / closest ancestor |
| `down=<css>` / `down*=<css>` | first descendant match per member / union of all |
| `over=1` · `over=-2` | sibling hops |

Returns an array decorated with `.mark(spec)`, `.glom()`, `.texts()`.
Mind the scope rule: `text=` filters the *current* members; to search inside
a container, take a css hop first (`#cards div >> text=alpha`, not
`#cards >> text=alpha`).

### grow — by-example expansion

```js
glom.pick()            // click two example rows, Esc
glom.grow()            // -> every structurally-alike element
```

Fingerprint: unindexed tag path from the root, plus the classes the examples
*share*. Two examples beat one: shared classes survive the intersection while
hashy per-instance classes (`css-1a2b3c`) wash out, and headers usually
differ in tag path (`thead/tr` vs `tbody/tr`) so they stay excluded. From a
single example (`glom.alike(el)` or a one-member grow), structure alone
decides, since one example can't say which of its classes matter.
`glom.grow({classes: false})` forces structure-only matching.

### pick — click-to-collect

```js
glom.pick()            // hover outlines; click toggles membership; Esc ends
glom.pick.done()       // programmatic finish, returns the set
```

Clicks are swallowed in the capture phase so picking a link doesn't
navigate. Picks are additive to the current set; click a member again to
remove it.

### infer — selector synthesis

```js
glom.infer()           // → { selector, extra, missing }, logs a verdict
```

Converts a hand-danced set into a durable CSS selector: replayable after a
rerender, pasteable into Playwright or a scraper. Reports honestly: `extra`
elements matched beyond the set, `missing` members not matched; (0, 0) is
exact. Tries the members' shared atom (tag + common classes), then scopes it
under common ancestors with ids or classes; mixed-tag sets infer per tag and
join with commas.

### tap — wire capture

```js
tap(/api/)             // wrap fetch + XHR; capture responses whose url matches
tap.hits               // [{n, via, url, method, status, data}] — data: parsed JSON
tap.last; tap.find('bills'); tap.clear(); tap.stop()
```

The DOM is a lossy rendering of data that arrives as JSON; tap watches the
wire instead. Requests pass through untouched (responses are cloned). Each
capture dispatches a window `tap` CustomEvent. Standalone: works without
base.js. It sees what's on the wire, so it shines when the API speaks JSON
(nearly always) and can't help with payloads decrypted client-side.

A captured hit is also a request template:

```js
await tap.replay(0, {page: 7})              // refetch with mutated query params
await tap.walk(0, {param: 'page', to: 40})  // paginate the API without scrolling
```

`walk` stops early when `until(data)` says dry (default: an empty array) and
waits `delay` ms between requests (default 250). GETs only — tap doesn't
record request bodies. Capture one page's request, walk the parameter, and
the 400-page scrape never touches the DOM.

### veins — vein-to-skin matching

```js
tap(/api/)             // ...browse a little, then:
glom.veins()           // which API fields feed which elements?
glom.veins.grab(0)     // adopt a field's elements
```

Joins captured payloads (the vein) to the page (the skin): JSON leaves are
matched against elements' own text, and fields rank by coverage (distinct
values matched / seen). A `3/3` field is a confirmed vein — you've learned
its API name and can stop scraping the DOM for it. Takes explicit data too:
`glom.veins(obj)`.

### watch — self-healing set

```js
glom.watch()                     // selector inferred from the current set
glom.watch({selector: '.row'})   // or explicit
glom.watch.stop()
```

React-style rerenders destroy `data-glom` attributes mid-dance; watch
re-applies the selector whenever the DOM churns (debounced, default 250ms),
so the badges come back and new members join. The suite's answer to the SPA
fragility.

### columns — repetition to table

```js
glom.columns()             // one row object per member; console.table + return
packTable(glom.columns())  // → columnar gzip+base64 on the clipboard
```

`pandas.read_html` generalized to things that aren't tables. Leaf texts are
keyed by member-relative indexed tag path (`td[2]`, `div/span`); links add
`@href` columns. Columns that never vary across members are boilerplate and
drop (`{all: true}` keeps them).

### harvest — sweep virtualized lists

```js
await glom.harvest()                      // fingerprint from the working set
await glom.harvest({selector: '.row'})    // or explicit (glom.infer() output fits)
```

Virtualized grids keep only visible rows in the DOM. Harvest scrolls, waits
(`settle` ms), re-collects, and accumulates records until `dry` consecutive
rounds find nothing new. Returns `[{key, text, html, el}]`: snapshots survive
element destruction (`el` may be dead by the time you look).

### lasso — drag-rectangle select

```js
await glom.lasso()                 // drag; Esc cancels
await glom.lasso({mode: 'intersect'})  // touching counts (default: contained)
```

Non-empty set → spatial refine (keep members inside the rectangle). Empty
set → discover: contained elements collapse to selection roots (elements
whose parent isn't contained), so a tight rectangle around a list gets the
items, not every span inside them. Zero-size (hidden) boxes are skipped.

### census — page-shape ping

```js
census()               // top 10 repeating structures, each marked in its own hue
census.grab(2)         // adopt group 2 as the working set
census.clear()
```

Orientation without reading HTML: groups every element by unindexed tag
path, ranks by count, and reports `geoReg` (union area over bounding box,
`summary()`'s kernel): near 1 means the group tiles its region like a grid
or list.

### templates — Wring-style induction over signatures

```js
glom.templates()            // group the set (whole page if empty) by template
glom.templates.grab(2)      // adopt group 2
glom.templates.group(strings, {delimiter: '.'})   // the raw engine
```

The principled upgrade to grow/census's fingerprints: elements become
path-qualified signatures (`html.body.div.div.c.hash-x1`) and a bookend-merge
engine (adapted from [`lib/kits/wring.js`](../lib/kits/wring.js), vendored so
the suite stays self-contained) groups signatures that differ only in slots.
Hashy per-instance classes become `${0}` slots instead of noise
(`c.hash-x${0}`, slots `1, 2, 3`), and templates match empty slots too, so a
cell and the link inside it can merge into one `td.${0}` family. Groups rank
by (members − 1) × literal chars, an MDL-ish "which repetition matters."
Lossless: `templates.reconstruct(template, slots)` rebuilds each signature
exactly. The raw engine takes any delimited strings (urls, log lines), not
just signatures.

### sets — named working sets

```js
glom.save('rows'); glom.use('rows'); glom.names(); glom.forget('rows')
```

Park one dance, start another, zip them later. In-memory element refs:
they survive the console session, not a rerender.

### deck — live side-window

```js
glom.deck()            // dense monospace table of the set in its own window
glom.deck.close()
```

Immediate visual validation without injecting UI into the host page: the
deck is its own same-origin window (the page's CSS can't touch it, a
rerender can't kill it) and re-renders on every `glom.set`, so verbs, pick,
grow, and lasso all show live.

## Testing

`npm test` drives the assembled suite under jsdom
([`tools/test/console-suite.test.mjs`](../tools/test/console-suite.test.mjs)),
and pins the committed `suite.js` to a fresh `assemble()` so a stale artifact
fails the run. jsdom's layout is inert, so `visible` filters everything out
there; test that engine in a real browser.
