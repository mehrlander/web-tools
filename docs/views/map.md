# Map

`?view=map[&tab=<key>]` (`lib/alpineComponents/map.js`) makes the coordination
layer inspectable. Most tabs render a hub registry; federated tabs assemble
each repository's declarations. Each address's lede and account, which names
the files it reads, is a row of [map-tabs.csv](../map-tabs.csv); the test
holding each registry is its `gate` in [registries.csv](../registries.csv).

The shell validates `?tab=` against `MAP_TABS` and `MAP_SUBVIEWS` in
`app/index.html` before `map()` mounts. `SUBVIEWS` in `map.js` groups the
addresses under tabs.

## Views: the app's own destinations

The Views tab reads `app-routes.csv` live at the ref the code came from
(`?use=`), never pinned to main, because `app-routes.csv` and `VIEWS` are held
to each other per ref. It ranks routes freshest first by their declared files,
through [`lib/kits/route-activity.js`](../../lib/kits/route-activity.js); a file
named by three or more routes cannot date a row on its own. The same join feeds the
route chips on Branches rows.

These are **app routes**. [routes-routes.csv](../routes-routes.csv) holds
**toss routes**, content types mapped to renderer pages.
