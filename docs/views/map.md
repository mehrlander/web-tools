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

## Tests: what checks protect and how they run

The Tests view explains the checks a repository owns and how its declared
checks run. A repository's `.web-tools.json` selects workflow jobs and steps
under `checking.execution`, and supplies their purpose and limits. The view
reads the selected workflow file for the command, runner, triggers, and
conditions. Those facts are not copied into another inventory. A missing job
or step is shown as an unreadable declaration, with a link to its source.

The command can also be run in a checkout with its required tools and inputs.
GitHub Actions runs the workflow on the runner its job declares. A GitHub-hosted
Linux or Windows runner is a temporary machine at GitHub; `self-hosted` names
a separately registered machine. The tests belong to the repository and are
available to every assistant and developer.

The links to workflow runs open GitHub's results. The Map does not turn a
workflow declaration into a passing badge: a result applies to the commit and
environment that ran it. Read the run's skipped checks and final verdict.

### Placement

Each repository keeps the declarations, check descriptions, and workflow files
for its own work. Web Tools owns the shared view and this public explanation.
Home's test descriptions stay in Home. Web Tools Private supplies the derived
configuration cache used to discover the other repositories; it does not own
copies of their test descriptions. This applies the existing
[repository ownership rule](../CONSTELLATION.md#principle-5-the-repo-owns-its-own-story)
and [configuration-cache contract](../manifest.md#config-cache-stateconfigsjson).

The public Web Tools declarations are read at the selected Web Tools revision.
Other repositories are discovered through the private cache after sign-in;
their selected non-main revisions are read directly. Workflow files are read
from the same repository revision as the declaration. Refresh rereads the
available declarations and workflows; it does not run the tests or rebuild
the private cache.

The existing `checking.files`, `checking.comparisons`, and `checking.as_of`
fields describe dated investigations of checks. Those research accounts keep
their dates and findings when a current execution declaration is added.
Web Tools' individual test inventory remains `docs/tests.csv`. The manifest
[field reference](../manifest-fields.csv) owns the execution declaration shape.
