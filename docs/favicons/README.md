# Favicon archive

The project's icon work in one place: the marks it ships, and the ones it has retired. New favicon designs go here.

## Active

### Hex nut (project mark)

<img src="../../lib/favicon.svg" width="48" height="48" alt="slot-split hex nut">

Canonical file: [`lib/favicon.svg`](../../lib/favicon.svg). A slot-split hex nut: a hexagon (modular; its left/right points read as `<` `>`) with a round bore, split down the middle to pop the angle brackets. Blue-600.

The root [`apple-touch-icon.png`](../../apple-touch-icon.png) is the same mark rasterized at 180 × 180 for iOS, which does not use the SVG favicon for a Home Screen tile. `app/index.html` declares that PNG explicitly because the app is served below the `/web-tools/` project path rather than at the origin root.

This is the library-wide mark. `lib/gh-boot.js` inlines a copy and injects it as the default favicon on any loader page that declares no icon of its own, and the [pages index](../../pages/index.html) points its `<link rel="icon">` and header logo here too.

### Repository marks

Files: [`repos/`](repos/). Drawn 2026-10-22: one mark per estate repository except web-tools, whose mark is the hex nut. Each is its repository's default mark wherever the app or the session page names a repository, read from the hub at its selected ref, main outside a preview ([`lib/kits/repo-mark.js`](../../lib/kits/repo-mark.js); Map › Reach and Map › Projects read it through `repoMarkSrc` in [`app/index.html`](../../app/index.html)).

A repository's manifest can replace the file with its own `mark` and colour whichever draws with `tone` ([`manifest-fields.csv`](../manifest-fields.csv)). Where no file can be read, the manifest's `icon` glyph draws.

### Map marks

Files: [`map/`](map/). Drawn 2026-10-22: one mark for each of the Map's tab groups, each a miniature of the view it opens, and one for each outpost but Work PowerShell. The Map draws them on its tab strip, its Overview headings, and its outposts in Reach and in Outposts. Drawn 2026-11-02: [`outpost-powershell.svg`](map/outpost-powershell.svg), Work PowerShell's, and [`outposts.svg`](map/outposts.svg), for outposts as a kind, shown on a project's Outpost tab and on the Outposts subview's tab and Overview row, which read it from the `m` field of that subview's entry in [`map.js`](../../lib/alpineComponents/map.js).

### Primitive marks

Files: [`primitives/`](primitives/). Drawn 2026-10-24: one mark for each column primitive in [column-primitives.md](../column-primitives.md#the-four), named for its value. `docs/vocabularies.csv` names each file in the `icon` column of that primitive's row, and the Map's Data tab draws it, in the primitive's colour, on each column declared with that primitive.

## Drawn marks

A project's or a program's own icon is an SVG drawn to the rules of the budget-drs app icon (`mehrlander/home:projects/budget-drs/app/favicon.svg`), as are an agent's icon and the repository and Map marks above:

- `viewBox="1.5 1.75 29 29"`, solid fills, no strokes.
- Every gap at least 2.5 units, about 1.4 CSS px at 16.
- A project's or a program's mark takes a colour no other project or program uses; an agent's icon is coloured too, and may repeat a project's colour. A repository's mark takes a colour no other repository's mark uses, and shortcut-tools' keeps the Shortcuts icon's pink and violet; a page draws it as an `<img>`. Every other mark is filled with `currentColor`, which an `<img>` draws black, so a page paints it as a CSS mask in its text colour.
- The hub's repositories share a hexagon, the public-record stores stand on the detached base bar (`<rect x="2" y="24.4" width="28" height="4.6"/>`), and a program's mark is cut from a rounded tile in its colour (`<rect x="2" y="2.25" width="28" height="28" rx="7"/>`).
- A `<desc>` says what the mark depicts.
- The options considered for a mark sit beside it in `alternatives/` as `<mark>.<option>.svg`. Choosing one swaps it with the mark, which moves into `alternatives/`. The program marks, [`programs/surfacing/icon.svg`](../../programs/surfacing/icon.svg) and [`programs/testing/icon.svg`](../../programs/testing/icon.svg), keep their previous mark in the `alternatives/` beside each; the other ideas drawn for them are in [`program-mark-ideas.html`](../prototypes/program-mark-ideas.html).

## In review

### Angled 3D hex nut

<img src="web-tools-icon-3d.png" width="96" height="96" alt="blue hex nut rendered at a slight three-dimensional angle on graphite gray">

File: [`web-tools-icon-3d.png`](web-tools-icon-3d.png). A 180 × 180 candidate with a lighter graphite tile, the blue mark reduced to roughly two-thirds of the canvas, and shallow extrusion. The [iPhone size check](../../pages/scratch/web-tools-icon-preview.html) compares the production-size raster with the active tile at 60, 40, and 29 CSS pixels. This is a design candidate, not the shipped Home Screen icon.

### Test-concept marks

Files: [`test-concepts/`](test-concepts/). Drawn 2026-11-01 as candidates for testing concepts, for skills such as [sandbox-traps](../../skills/sandbox-traps/SKILL.md), [gold-set](../../skills/gold-set/SKILL.md) and [screenshot-review](../../skills/screenshot-review/SKILL.md). The marks in this folder are not program marks: a program declares its own mark in [`.web-tools.json`](../../.web-tools.json). The folder has no row in [`icon-families.csv`](../icon-families.csv), which lists only the icon families already adopted; a skill that takes up one of these marks points at the mark's file in this folder.

Each mark follows the drawn-mark rules above and uses one ink: a single `currentColor` path, filled even-odd, with every coordinate between 2 and 30 in viewBox units. Judged by eye at 16 CSS px when they were drawn, the clearest are [`pass-badge`](test-concepts/pass-badge.svg), [`fail-badge`](test-concepts/fail-badge.svg), [`flask-check`](test-concepts/flask-check.svg), [`test-bot`](test-concepts/test-bot.svg), [`console-log`](test-concepts/console-log.svg), [`shield-pass`](test-concepts/shield-pass.svg), [`flaky-dice`](test-concepts/flaky-dice.svg), [`bug`](test-concepts/bug.svg), [`audit-lens`](test-concepts/audit-lens.svg), [`assert-equals`](test-concepts/assert-equals.svg), [`sandbox-dashed`](test-concepts/sandbox-dashed.svg), [`smoke-test`](test-concepts/smoke-test.svg).

| Theme | Marks |
|---|---|
| Containment / sandbox | [`sandbox-dashed`](test-concepts/sandbox-dashed.svg), [`isolation-hex`](test-concepts/isolation-hex.svg), [`specimen-jar`](test-concepts/specimen-jar.svg), [`petri-dish`](test-concepts/petri-dish.svg), [`cage`](test-concepts/cage.svg), [`capsule`](test-concepts/capsule.svg), [`bracketed-block`](test-concepts/bracketed-block.svg) |
| Find / inspect | [`bug`](test-concepts/bug.svg), [`bug-fix`](test-concepts/bug-fix.svg), [`audit-lens`](test-concepts/audit-lens.svg), [`crosshair`](test-concepts/crosshair.svg), [`spotlight`](test-concepts/spotlight.svg), [`scan`](test-concepts/scan.svg), [`binoculars`](test-concepts/binoculars.svg), [`lens-check`](test-concepts/lens-check.svg) |
| Pass / fail / gate | [`validate-gate`](test-concepts/validate-gate.svg), [`traffic-light`](test-concepts/traffic-light.svg), [`stamp`](test-concepts/stamp.svg), [`shield-pass`](test-concepts/shield-pass.svg), [`test-strip`](test-concepts/test-strip.svg), [`pass-badge`](test-concepts/pass-badge.svg), [`fail-badge`](test-concepts/fail-badge.svg), [`pass-fail-pair`](test-concepts/pass-fail-pair.svg) |
| Known-good / gold | [`medal`](test-concepts/medal.svg), [`golden-file`](test-concepts/golden-file.svg), [`calibrate`](test-concepts/calibrate.svg), [`master-key`](test-concepts/master-key.svg), [`certified-seal`](test-concepts/certified-seal.svg), [`reference-sample`](test-concepts/reference-sample.svg) |
| Trap / false signal | [`mousetrap`](test-concepts/mousetrap.svg), [`false-face`](test-concepts/false-face.svg), [`cracked-check`](test-concepts/cracked-check.svg), [`honeypot`](test-concepts/honeypot.svg), [`decoy-duck`](test-concepts/decoy-duck.svg) |
| Regression / change | [`regression-bars`](test-concepts/regression-bars.svg), [`regression-trend`](test-concepts/regression-trend.svg), [`before-after`](test-concepts/before-after.svg), [`plus-minus`](test-concepts/plus-minus.svg), [`rerun`](test-concepts/rerun.svg), [`snapshot-stack`](test-concepts/snapshot-stack.svg) |
| Coverage / matrix | [`coverage-gap`](test-concepts/coverage-gap.svg), [`heatmap`](test-concepts/heatmap.svg), [`checklist`](test-concepts/checklist.svg), [`variants`](test-concepts/variants.svg), [`overlap-venn`](test-concepts/overlap-venn.svg) |
| Stress / chaos / load | [`stress-squeeze`](test-concepts/stress-squeeze.svg), [`chaos-zigzag`](test-concepts/chaos-zigzag.svg), [`pressure-gauge`](test-concepts/pressure-gauge.svg), [`load-weight`](test-concepts/load-weight.svg), [`breaking-load`](test-concepts/breaking-load.svg), [`spike`](test-concepts/spike.svg) |
| Timing / flake | [`stopwatch`](test-concepts/stopwatch.svg), [`flaky-dice`](test-concepts/flaky-dice.svg), [`scheduled-run`](test-concepts/scheduled-run.svg), [`flaky-signal`](test-concepts/flaky-signal.svg), [`timeout`](test-concepts/timeout.svg) |
| Harness / automate | [`gears`](test-concepts/gears.svg), [`conveyor`](test-concepts/conveyor.svg), [`plug`](test-concepts/plug.svg), [`test-bot`](test-concepts/test-bot.svg), [`pipeline`](test-concepts/pipeline.svg), [`test-rack`](test-concepts/test-rack.svg), [`flask-check`](test-concepts/flask-check.svg) |
| Mock / intercept | [`mock-twin`](test-concepts/mock-twin.svg), [`intercept`](test-concepts/intercept.svg), [`puppet`](test-concepts/puppet.svg), [`reroute`](test-concepts/reroute.svg), [`stand-in`](test-concepts/stand-in.svg) |
| Observe / live | [`live-signal`](test-concepts/live-signal.svg), [`radar`](test-concepts/radar.svg), [`heartbeat`](test-concepts/heartbeat.svg), [`waveform`](test-concepts/waveform.svg), [`eye`](test-concepts/eye.svg), [`console-log`](test-concepts/console-log.svg) |
| Filter / smoke | [`funnel`](test-concepts/funnel.svg), [`smoke-test`](test-concepts/smoke-test.svg), [`sieve`](test-concepts/sieve.svg), [`noise-filter`](test-concepts/noise-filter.svg) |
| Scale / parallel | [`balance`](test-concepts/balance.svg), [`parallel-runs`](test-concepts/parallel-runs.svg), [`hub`](test-concepts/hub.svg), [`nested-dolls`](test-concepts/nested-dolls.svg), [`replicas`](test-concepts/replicas.svg) |
| History / archive | [`film-strip`](test-concepts/film-strip.svg), [`archive-box`](test-concepts/archive-box.svg), [`echo-history`](test-concepts/echo-history.svg), [`rewind-clock`](test-concepts/rewind-clock.svg) |
| Usability | [`user-path`](test-concepts/user-path.svg), [`click-target`](test-concepts/click-target.svg), [`tap-ripple`](test-concepts/tap-ripple.svg) |
| Test building blocks | [`assert-equals`](test-concepts/assert-equals.svg), [`breakpoint`](test-concepts/breakpoint.svg), [`unit-cube`](test-concepts/unit-cube.svg), [`canary`](test-concepts/canary.svg) |

### Per-page emoji marks

Many pages carry their own emoji favicon, written inline as a `data:image/svg+xml` URI holding a single `<text>` glyph, among them 🌿 branch, 📊 data-view, 🔖 links, 🧪 console-playground, 💎 shorter, 🔍 review and pdf-inspect, ✍️ word-select, 🐈‍⬛ compression-helper, 🥏 toss-render. A page that declares none inherits the hex nut from `gh-boot.js`, so the estate needs no per-page icon file and no registry.

## Treatments

A treatment is a mark this project does not own, restyled to say something about how it is being shown. One so far.

### Dimmed (a toss)

A toss shows its **subject's** favicon, not its own, desaturated to `saturate(0.15)` and faded to `globalAlpha` 0.78 on a 64 px canvas, emitted as a PNG. So the tab names the page being rendered without impersonating the deployed one, and the 🥏 frisbee becomes the mark for a render with no addressable subject behind it.

**Except where there is nothing to impersonate.** A repo that serves no Pages has no deployed twin at any ref, so a private page read at its own default branch is not standing in for anything: a toss is the only way to open it at all. Those icons come through undimmed, at full colour, which is also what a bookmark of that address then keeps. Off the default branch the dimming returns and says what it always said, that this is not the canonical version. The test is `has_pages` on the REST repo object, read once per repo and cached, and an unanswered call keeps the dimming. The escape button in the drawer asks the same question of the same endpoint, for the same reason: [`lib/alpineComponents/fab.js`](../../lib/alpineComponents/fab.js), `liveTwin`.

Why dimming rather than a badge, why those two values, the mechanics, and why the output is a PNG rather than an SVG are in the comments above `DIM_SATURATE` and `adoptSubjectIcon` in [`pages/toss-render.html`](../../pages/toss-render.html).

## Retired

### Grid (former pages-index identity)

<img src="grid.svg" width="48" height="48" alt="2x2 card grid, one accented">

File: [`grid.svg`](grid.svg). A rounded tile holding a 2x2 grid of cards, one accented in amber: the pages index as a collection of tools. Indigo-to-sky gradient.

Kept as a design reference.
