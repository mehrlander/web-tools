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

## Testing

`npm test` drives the assembled suite under jsdom
([`tools/test/console-suite.test.mjs`](../tools/test/console-suite.test.mjs)),
and pins the committed `suite.js` to a fresh `assemble()` so a stale artifact
fails the run. jsdom's layout is inert, so `visible` filters everything out
there; test that engine in a real browser.
