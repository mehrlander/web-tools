# show-repo: the shell of the Web Tools app

⭐ **Open it:** [Web Tools](https://mehrlander.github.io/web-tools/app/) (append `?repo=owner/repo` to open a repo)

show-repo is the one hosted page behind the Web Tools app
(`app/index.html`). It browses any repo, operates the estate, and moves files
between repos. [APP.md](APP.md) states the mission and the name split. This
file covers the shell: routing, chrome, the gestures every view shares, and
the boundaries. Each view's own document is named in the `doc` column of
[app-routes.csv](app-routes.csv) (under [views/](views/)), and each form's in
the `doc` column of [subjects.csv](subjects.csv) (under [forms/](forms/)).

## Token caveat

A `#stage=` link and any private-repo browse work only in a browser holding the
viewer's stored `ghToken`, as toss-render's `#gh=` does. The Claude app's
in-app browser may not have one. A token-less `#gz=` form for the stage is not
built: for a token-less reader, download the stage's concatenated bundle and
`SendUserFile` it. State this caveat with every stage link.

## Addresses

- `?repo=owner/repo[&ref=…]` opens a repo on its Overview. `?ref=` is
  repo-scoped and stamps beside `repo`.
- `?view=<key>` opens a view. The keys, their labels, nav stops, groups, files
  and docs are rows of [app-routes.csv](app-routes.csv).
- Second keys: `&tab=` (Project's pills, Map's tabs), `&item=` (State),
  `&detail=` (Branches), the `&sq=` family (Search), `&file=`, `&path=`,
  `&window=`. A view leaves its default second key out of the URL.
- `&shell=full|nav|none` sets how much chrome surrounds the view (below).
- Retired keys still resolve: `activity` to Sessions, `portable` to Map,
  `surfaces` to Stage, `landing` to the plain `?repo=` form.

The shell's `VIEWS` table is the router: each row names a key, how a link opens
it, and what it stamps back. `routeFromUrl` dispatches through it and
`deepLinkParams` stamps through it. **Adding a row is the whole of adding an
addressable view**, plus its `app-routes.csv` row.
[`shell-routing.test.mjs`](../tools/test/shell-routing.test.mjs) forbids
comparing a view name inside the routing functions and re-parses every row's
own stamp; [`app-routes.test.mjs`](../tools/test/app-routes.test.mjs) holds
`VIEWS` and `app-routes.csv` to each other both ways. The default repo's `repo`
key is dropped from addresses as redundant, except on its landing, which would
otherwise have no address.

## Chrome

**Header.** The estate's nav stops (`estateNav`: Activity, Lists, Repos, Stage,
Tools, Search, Map), then the repo-promoted app views (`appView: true`, one
button each, the same list as the sidebar's `sidebarAppViews`), then two
desktop-only clusters: the rail (the manifest's `rail: true` links) and the
ref switch. Repo selection happens on the Repos view.

**Sidebar.** One boolean, `sidebarOpen`, at every width: an overlay below `lg`,
a column at `lg` and up. Toggling it does not touch the URL. Its top bar is a
crumb trail (`crumbBar`): the product mark (the route home), then the repo, then
the ref when off the default. In a repo it lists the repo's views, projects,
pins and recents; in the estate, the Repos index and the app views.

**Repo views**, all `group=repo` in `app-routes.csv`: Overview (the README,
always), Pages (a `pages` catalog), Atlas, Config (the manifest as a form and as
JSON), Files ([views/search.md](views/search.md)), Project
([views/project.md](views/project.md)). A repo's declared `landing` page renders
through the app view, not as a landing kind.

**Shell mode.** `?shell=` is a reading parameter, like `?use=` and `?window=`:
it gets no `VIEWS` row and is stamped beside whatever the table stamps.

| Value | Header | Sidebar |
| --- | --- | --- |
| `full` | yes | out on a wide screen, away on a phone |
| `nav` | yes | away; the hamburger opens it |
| `none` | no | away; the launcher menu and the FAB's Render tab lead back |

The default is per view: an app view opens at `none`, every other route at
`full`, and the default stays out of the URL. An unknown value reads as `full`.
Held by `shell-routing.test.mjs`. An open app view takes over the tab title and
the iOS Home Screen title and icon, from the mark `toss-render` announces on
`toss-subject-mark`.

**Ref switch** (`lib/alpineComponents/ref-switch.js`). A text box in the header:
paste a branch, tag or sha and Enter reloads show-repo itself from that ref,
through the toss renderer with the ref pinned on both halves (`?use=<ref>` and
`#gh=…@<ref>:…`) and the current deep link carried along. It is not Search's
`refPicker`, which picks a ref of the browsed repo. The FAB's Render tab reads
the ref you landed on (picker, ref bar, the branch's PR guide).

## Contracts a page offers the FAB

A component can expose three opt-in lists, which the FAB reads without holding
an opinion about them:

- `actions`: verbs in the drawer.
- `toggles`: `[{ key, label, icon, on, title, set }]`, one control each on the
  Render tab's width row, re-read on every paint. The shell's header toggle is
  one.
- `menu`: `[{ label, icon, run }]`, rows in the launcher's long-press menu,
  read by `readPageMenu()` when the menu opens. One line per row; there is no
  description field.

The scan reads each element's own scope, not `Alpine.$data(el)`, which returns
the merged stack and makes every nested component answer for the shell.

## GitHub jump-overs and the source peek

Every view keeps a one-tap route to GitHub's presentation of what it shows. **A
new view ships with its jump-over.** The GitHub glyph has four meanings:

| Meaning | Treatment |
| --- | --- |
| a repo menu (`lib/kits/github-links.js`) | icon opens a list |
| a repo or branch destination | plain icon |
| the manifest behind a whole view | icon plus a label, at the header's far edge |
| an exact file | plain icon plus a source peek |

The source peek (`lib/kits/source-peek.js`, loaded by `gh-boot.js`) is a hover
card over an exact file. Write it with the `x-blob` directive, which takes one
`owner/repo[@ref]:path` address and derives both the href and the peek, so the
two cannot name different files; `SourcePeek.seed` passes bytes already held.
A peek never opens on touch. Held by `x-blob.test.mjs` and `npm run
test:peek-link`. `estate.js`, `stage.js`, `state-view.js` and `tools.js` still
spell the href and `data-peek` pair by hand.

## Gestures every view shares

**Drop and paste.** A file dropped or anything pasted on any view is staged and
routes to the Stage (`wireAppDrop`, `wireAppPaste`); what it becomes is
`window.StageIntake`'s decision. The shell's paste listener is the only window
paste listener; do not add a second. A phone fires no paste event, so the taps
(the launcher's long-press menu and the bench's Paste button) call
`pasteAnywhere` → `StageIntake.takeClipboard`, which must read the clipboard on
the tap's own user activation: await nothing before it. Outside the app, the FAB
parks clipboard flavors through `lib/kits/stage-handoff.js` for the app to drain
at boot.

**Takeovers.** A swipe-deck takeover is framed by `--deck-left` and
`--deck-top`: in the view pane at `lg` and up, the whole window below.
`syncDeckFrame()` decides whether the sidebar and header insets apply, since
both are conditional. Leaving the view closes the takeover, from `syncUrl()`
with the kit's `drop()`.

## Public browse

`?view=public` (`lib/alpineComponents/public-browse.js`) lists and previews any
public repo with no token: one anonymous GitHub trees call for the listing
(`GH.flatTree()`, one of the 60 anonymous requests an hour) and
raw.githubusercontent for a file's bytes (`GH.rawUrl()`). Private repos 404.

## Transfer

"Copy to repo" writes the staged fileset through `gh-transfer.js`.

- Destination: `owner/repo`, `owner/repo:dir`, or `owner/repo@ref:dir`; the
  default branch unless a ref is given.
- One commit through the Git Data API, base64 end to end, its message listing up
  to twenty paths. An unreadable source file is reported and left out; a moved
  ref is retried three times on the new tip.
- Two-tap confirm. A copy onto itself is refused.
- Files over the Contents API's 1 MB cap are read through `git/blobs/<sha>`
  (`getRaw`); modes are not carried.

## Where the rest lives

| Subject | Reference |
| --- | --- |
| the stage and the `#stage=` grammar | [stage.md](stage.md) |
| `.web-tools.json`, the config cache, errands and proposals | [manifest.md](manifest.md), [manifest-fields.csv](manifest-fields.csv) |
| the branch takeover and the overlay | [branch-overlay.md](branch-overlay.md) |
| which link shows what | [showing.md](showing.md), [showing-mechanisms.csv](showing-mechanisms.csv) |

**Boundary.** show-repo shows and moves files (🗂️ for a stage link).
`toss-render` runs a page (🥏, `#gh=`/`#gz=`). An artifact publishes a snapshot
to claude.ai (📦, [artifacts.md](artifacts.md)). `pages/review.html` (🔍) is the
standalone address for a changeset whose cards the branch view already mounts.

## Using it from a Claude session

- **Browse link:** `…/app/?repo=owner/repo`, with `&ref=` or
  `&view=files&path=<dir>`. The bare URL is the estate.
- **Stage link 🗂️:** mint `#stage=…` per [stage.md](stage.md), with the token
  caveat above.
- **Present a repo well:** write its `.web-tools.json` ([manifest.md](manifest.md)).
