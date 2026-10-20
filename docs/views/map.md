# Map

`?view=map[&tab=<key>]` (`lib/alpineComponents/map.js`) makes the coordination
layer inspectable. Most tabs render a hub registry; federated tabs assemble
each repository's declarations. Each address's one-sentence description and
its account of the files it reads are a row of [map-tabs.csv](../map-tabs.csv);
the test holding each registry is its `gate` in [registries.csv](../registries.csv).

The Map has two doors. A bare `?view=map` opens the **Overview**, which says
what the hub is and holds. Its **Contents** lists every address under the tab
that holds it, with its sentence, so a reader new to the Map meets each set
before its rows; its **Purpose** is the estate's mission, goals and reading
paths. The Contents finder matches an address's name, its tab and its
sentence, and also the files the address names, which answers "which tab shows
this file". The rows come from the `TABS` and `SUBVIEWS` arrays and the
sentences from the CSV, so Contents holds no list of its own. The second door,
**Reach**, holds what the hub covers beyond itself. It lands on Routes, the
diagram of every repository and outpost the hub reaches, then offers Projects,
Distribution, Outposts and Data. Until 2026-10-12 the Map itself opened on that
diagram, and each tab headed its own screen with its sentence.

Every address opens with the same toolbar: its controls and counts, then a
database icon that opens Sources and methods, which holds the description, the
files and builders, and notes on reading them. Below the `lg` breakpoint the two
tab rows and the current group heading stay pinned while the pane scrolls; the
controls and filter rows scroll away with the list.

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

## Docs: edits waiting on a document

With a token, a document named by an open documentation user call, or by a
Text collection proposal, carries a badge on its row
([`lib/kits/user-calls.js`](../../lib/kits/user-calls.js)), and each kind has
its own filter. A user call waits on the owner, so its badge, filter and
marks take the attention colour, which a proposal from a batch process does
not. In the reading deck a proposal is labelled on the paragraph it would
change and applied or rejected in place. Each edit a call proposes is open
there as a change container. A call is answered for all its edits at once,
from its sheet, which steps through the edits like a walkthrough and stays
open while it does: each edit confirmed or discarded, with a note if wanted,
and the answer recorded in web-tools-private beside the call with the
confirmed edits as a patch for a session to apply
([`lib/kits/call-answer.js`](../../lib/kits/call-answer.js), which Dictate
shares). The sheet commits nothing: a call is read on main, so a commit from
the browser would land there outside any pull request and skip the target
repository's commit hook. To amend an edit or commit it, the sheet opens the
call in Dictate.

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
