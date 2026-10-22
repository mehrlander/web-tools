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
- [`mods/`](mods): one feature per file. [`core.js`](mods/core.js) loads
  first and provides the shared kernels (`glom.core`: SCOPE, text cleaners,
  tag-path fingerprints, dance steps) plus the **onSet bus** (`glom.onSet`
  subscribers run after every `glom.set`, which everything funnels through);
  every other glom mod expects base.js + core.js to have run first, so a
  single mod pastes as base + core + it. `tap.js` alone is fully standalone.
  [`recipe.js`](mods/recipe.js) loads last, wrapping the verbs the others
  installed.
- [`suite.js`](suite.js): **generated**: base.js plus every mod, in one
  paste. Rebuild with `npm run build:console` (the build-on-commit hook does
  this automatically when `console/` changes). Don't edit it; edit base or a
  mod.
- [`to-canvas.js`](to-canvas.js): unrelated one-off; renders the page into a
  scrollable canvas.

The find → dance → grab loop, end to end: `census()` or `glom.templates()`
to orient, `pick` two examples, `grow` (or a template grab) to the full set,
`deck` to watch it live, verbs or `q()` to move, `lasso` to trim spatially,
`columns` + `packTable` to carry it off, `infer` to keep a replayable
selector, `harvest` when the list is virtualized, `tap` when the DOM is
hostile and the wire is honest, `scan` when the capture has to run over time
and survive the tab.

[`LINEAGE.md`](LINEAGE.md) is where each mod came from: the bookmarklet or
console tool it descends from, first seen 2023-10 onward, and the approach that
was tried and dropped on the way. Read it before reworking a mod, since most of
these are the third or fourth answer to their question and the earlier ones
failed for reasons that have not changed.

Adding a mod: create `mods/<name>.js`, add it to `MODS` in
[`node/build/console-suite.mjs`](../node/build/console-suite.mjs) (the
build fails if the manifest and directory disagree), cover it in
[`node/test/console-suite.test.mjs`](../node/test/console-suite.test.mjs).

## The working set

`glom` keeps a persistent selection in the DOM itself (`data-glom`
attributes): it survives across console expressions, renders as numbered
badges, and has history (`glom.undo()`). Everything below reads or moves
that set.

## Mods

Each mod's header comment gives its call forms, options and reasoning; open
the file before using it.

| Mod | Entry | What it does |
| --- | --- | --- |
| [`verbs`](mods/verbs.js) | `glom.up/down/downAll/over` | lockstep set navigation: every member takes the same step |
| [`query`](mods/query.js) | `q(expr)` | a Playwright-flavored `>>` chain grammar, plus dance stages |
| [`grow`](mods/grow.js) | `glom.grow()` | by-example expansion from one or two picked members |
| [`pick`](mods/pick.js) | `glom.pick()` | click-to-collect; clicks are swallowed so links don't navigate |
| [`infer`](mods/infer.js) | `glom.infer()` | a durable CSS selector for the set, with `extra` and `missing` reported |
| [`tap`](mods/tap.js) | `tap(/re/)` | capture fetch/XHR JSON; `tap.replay` and `tap.walk` reuse a hit as a request template. Standalone |
| [`veins`](mods/veins.js) | `glom.veins()` | which captured API fields feed which elements |
| [`watch`](mods/watch.js) | `glom.watch()` | re-applies the set's selector as a rerendering page churns |
| [`columns`](mods/columns.js) | `glom.columns()` | one row object per member, constant columns dropped |
| [`harvest`](mods/harvest.js) | `glom.harvest()` | scrolls a virtualized list until dry, accumulating snapshots |
| [`scan`](mods/scan.js) | `glom.scan.*` | durable capture over time into IndexedDB, by scroll, churn or interval |
| [`lasso`](mods/lasso.js) | `glom.lasso()` | drag-rectangle refine, or discover on an empty set |
| [`census`](mods/census.js) | `census()` | the page's top repeating structures, each marked in its own hue |
| [`templates`](mods/templates.js) | `glom.templates()` | Wring-style template induction over element signatures |
| [`sets`](mods/sets.js) | `glom.save/use` | named working sets, held as in-memory element refs |
| [`join`](mods/join.js) | `glom.join(a, b, rel)` | structural and geometric joins between sets |
| [`semantics`](mods/semantics.js) | `glom.semantics()` | JSON-LD, microdata and og:/twitter: metas the page carries |
| [`recipe`](mods/recipe.js) | `glom.recipe()` | prints the session's `glom`/`q` calls back as a replayable script; loads last |
| [`deck`](mods/deck.js) | `glom.deck()` | a live side-window table of the set |

One `q()` trap no header states: `text=` filters the *current* members, so to
search inside a container take a css hop first (`#cards div >> text=alpha`, not
`#cards >> text=alpha`).

## Testing

`npm test` drives the assembled suite under jsdom
([`node/test/console-suite.test.mjs`](../node/test/console-suite.test.mjs)),
and pins the committed `suite.js` to a fresh `assemble()` so a stale artifact
fails the run.

jsdom's layout is inert (every box 0×0, computed styles uniform), so the
geometry-dependent behavior (`visible`, census geoReg, lasso rectangles,
`grow {by:'style'}`, geometric joins) is exercised by a second, manual pass
through real Chromium:
[`node/test/playground-pass.mjs`](../node/test/playground-pass.mjs) drives
[`pages/console-playground.html`](../pages/console-playground.html)
(fixtures for every mod: a table, hashy cards, class-less soup, a truly
virtualized feed, an offline `/fake-api/`, microdata). Run it with
`node node/test/playground-pass.mjs`; it exits nonzero on any failure.
The playground doubles as the interactive demo: the suite is pre-loaded, so
open the console and work the loop.
