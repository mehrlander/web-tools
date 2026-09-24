# Map

`?view=map[&tab=<key>]` (`lib/alpineComponents/map.js`) makes the coordination
layer inspectable. Each tab renders a hub registry, so the registry is the
source and the tab is its reading. The FAB `description` in `map.js` states
each tab's contents in full; the table below is the index.

The shell owns the tab (`MAP_TABS` and `MAP_SUBVIEWS` in `app/index.html`,
validated before `map()` mounts). The default, `set`, stays out of the URL.
`?view=portable` resolves to the Map and `?view=routes` to its Views tab.

| Tab (`&tab=`) | Reads | Held by |
| --- | --- | --- |
| Distribution (`set`) | [portable.csv](../portable.csv) | `portable-manifest.test.mjs` |
| Surfacing | [surfacing.csv](../surfacing.csv), indexing [SURFACING.md](../SURFACING.md) | `surfacing-manifest.test.mjs`, `surfacing-lead-anchor.test.mjs` |
| Showing | [showing-mechanisms.csv](../showing-mechanisms.csv), [routes-modes.csv](../routes-modes.csv), [routes-routes.csv](../routes-routes.csv), [routes.json](../routes.json) | `routes-manifest.test.mjs` |
| Docs: Inventory (`docs`), Purpose (`aims`), Growth (`growth`) | [docs.csv](../docs.csv); [aims.json](../aims.json) and its CSVs; `data/doc-growth/*.json` | `docs-registry.test.mjs` |
| Themes (`claims`) | [themes.csv](../themes.csv), [owners.csv](../owners.csv) | `owners-registry.test.mjs`, `derived-artifacts.test.mjs` |
| Harness: Automation (`harness`), Tests (`tests`), Context (`context`) | [harness.csv](../harness.csv), [tests.csv](../tests.csv), `pages/session-context.html` | `tests-registry.test.mjs`, `derived-artifacts.test.mjs` |
| Kits | [kits.csv](../kits.csv) | `kits-register.test.mjs` |
| Skills | the shipped skill catalog | `skills-registry.test.mjs` |
| Views (`views`) | [app-routes.csv](../app-routes.csv) | `app-routes.test.mjs` |
| Registries | [registries.csv](../registries.csv) | `properties-registry.test.mjs` |

**Two ownership exceptions.** In Surfacing, `SURFACING.md` is authoritative and
`surfacing.csv` is its gated index; a card's title lands on its bullet through
`lib/kits/land.js`. The Docs Inventory's readership column is the one
token-gated reading, and it is absent (not blank) without a token.

## Views: the app's own destinations

The Views tab reads `app-routes.csv` and one `commits?path=` call per declared
file, ranks routes freshest first through
[`lib/kits/route-activity.js`](../../lib/kits/route-activity.js), and joins each
to the open PRs touching its files. It is read live, at the ref the code came
from (`?use=`), never pinned to main, because `app-routes.csv` and `VIEWS` are
held to each other per ref.

- `app/index.html` is excluded from dating and shown as its own row.
- A file named by three or more routes (`WIDE`) cannot be a row's reason; a row
  dated only by such files reads `shared`.
- Rows group by their `stop`, in the order of each stop's freshest member.
- The same PR-file join feeds the route chips on Branches rows, so the two
  readings agree.

These are **app routes**. [routes-routes.csv](../routes-routes.csv) holds
**toss routes**, content types mapped to renderer pages.
