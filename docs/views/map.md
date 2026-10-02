# Map

`?view=map[&tab=<key>]` (`lib/alpineComponents/map.js`) makes the coordination
layer inspectable. Most tabs render a hub registry; federated tabs assemble
each repository's declarations. [map-tabs.csv](../map-tabs.csv) holds each
address's lede and a longer account of the tab, one row per address, and the
lede's ↗ opens that row; the table below is the index.

The shell owns the tab (`MAP_TABS` and `MAP_SUBVIEWS` in `app/index.html`,
validated before `map()` mounts). The default, `set`, stays out of the URL.
`?view=portable` resolves to the Map and `?view=routes` to its Views tab.

| Tab (`&tab=`) | Reads | Held by |
| --- | --- | --- |
| Distribution (`set`) | [portable.csv](../portable.csv) | `portable-manifest.test.mjs` |
| Surfacing | [surfacing.csv](../surfacing.csv), indexing [SURFACING.md](../SURFACING.md) | `surfacing-manifest.test.mjs`, `surfacing-lead-anchor.test.mjs` |
| Showing | [showing-mechanisms.csv](../showing-mechanisms.csv), [routes-modes.csv](../routes-modes.csv), [routes-routes.csv](../routes-routes.csv), [routes.json](../routes.json) | `routes-manifest.test.mjs` |
| Docs: Inventory (`docs`), Purpose (`aims`), Growth (`growth`) | [docs.csv](../docs.csv); [aims.json](../aims.json) and its CSVs; `data/doc-growth/*.json` | `docs-registry.test.mjs` |
| Docs: Policy (`policy`) | [policies.csv](../policies.csv); [policy-topics.csv](../policy-topics.csv) | `policies-registry.test.mjs` |
| Themes (`claims`) | [themes.csv](../themes.csv), [owners.csv](../owners.csv) | `owners-registry.test.mjs`, `derived-artifacts.test.mjs` |
| Harness: Automation (`harness`), Tests (`tests`), Context (`context`) | [harness.csv](../harness.csv), [tests.csv](../tests.csv), `pages/session-context.html` | `tests-registry.test.mjs`, `derived-artifacts.test.mjs` |
| Kits | [kits.csv](../kits.csv) | `kits-register.test.mjs` |
| Skills | the shipped skill catalog | `skills-registry.test.mjs` |
| Data (`data`) | each declaring repo's [CSV census](../csv-census.md) | `csv-census.test.mjs`, `map-data-census.test.mjs` |
| Views (`views`) | [app-routes.csv](../app-routes.csv) | `app-routes.test.mjs` |
| Registries | [registries.csv](../registries.csv) | `properties-registry.test.mjs` |

**Two ownership exceptions.** In Surfacing, `SURFACING.md` is authoritative and
`surfacing.csv` is its gated index; a card's title lands on its bullet through
`lib/kits/land.js`. The Docs Inventory's readership column is token-gated,
and it is absent (not blank) without a token.

## Views: the app's own destinations

The Views tab reads `app-routes.csv` live at the ref the code came from
(`?use=`), never pinned to main, because `app-routes.csv` and `VIEWS` are held
to each other per ref. It dates each route by its declared files through
[`lib/kits/route-activity.js`](../../lib/kits/route-activity.js); a file named
by three or more routes cannot date a row on its own. The same join feeds the
route chips on Branches rows.

These are **app routes**. [routes-routes.csv](../routes-routes.csv) holds
**toss routes**, content types mapped to renderer pages.
