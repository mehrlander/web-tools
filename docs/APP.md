# The Web Tools app

⭐ **Open it:** [Web Tools](https://mehrlander.github.io/web-tools/app/) (append `?repo=owner/repo` to open a repo)

Web Tools is one place to find, understand, and continue work across the development estate: its repositories, branches, sessions, pages, and tools. GitHub holds the content and history. The page is `app/index.html`.

## Durable goals

A feature belongs in the app when it serves one of these goals:

- **One entry point.** Find work without first knowing which repo holds it.
- **Content stays with its owner.** Bring work into view while keeping it in the repo that owns it.
- **Direct access to GitHub.** Every view keeps a one-tap link to GitHub's presentation of its subject.
- **Continuity.** Keep work understandable across sessions, branches, repos, and venues.
- **Action.** Continue the work: stage and transfer files, edit repo configuration, and maintain lists.

The estate's goals are in [`aims.json`](aims.json), shown in Map → Docs → Purpose.

## Product boundary

Views of the estate are built into the app. Views of repository content are app views, declared by the owning repo in `.web-tools.json` ([manifest.md](manifest.md)).

The app browses and transfers files. `toss-render` runs pages. Artifacts publish snapshots to claude.ai ([artifacts.md](artifacts.md)).

Keep the redirect at `pages/show-repo/show-repo.html`; saved links depend on it.

## Token requirement

Stage links (`#stage=`) and private-repo access require the browser's stored `ghToken`. The Claude app's browser may lack that token. State the requirement with every stage link. A stage holding only pasted text mints as `#gz=`, which carries the text in the link and needs no token ([stage.md](stage.md)). For repo files and a reader without a token, download the stage's concatenated bundle and send the file.

## Addresses

- `?repo=owner/repo[&ref=…]` opens a repo on its Overview. `?ref=` is repo-scoped and stamps beside `repo`.
- `?view=<key>` opens a view. The keys, their labels, nav stops, groups, files and docs are rows of [app-routes.csv](app-routes.csv).
- Second keys: `&tab=` (Project's pills, Map's tabs), `&item=` (State), `&detail=` (Branches), the `&sq=` family (Search), `&file=`, `&path=`, `&window=`. A view leaves its default second key out of the URL.
- `&shell=full|nav|none` sets how much chrome surrounds the view (below).
- Retired keys still resolve: `activity` to Sessions, `portable` to Map, `surfaces` to Stage, `landing` to the plain `?repo=` form.

The app's `VIEWS` table is the router: each row names a key, how a link opens it, and what it stamps back. `routeFromUrl` dispatches through it and `deepLinkParams` stamps through it. **Adding a row is the whole of adding an addressable view**, plus its `app-routes.csv` row. [`shell-routing.test.mjs`](../node/test/shell-routing.test.mjs) forbids comparing a view name inside the routing functions and re-parses every row's own stamp; [`app-routes.test.mjs`](../node/test/app-routes.test.mjs) holds `VIEWS` and `app-routes.csv` to each other both ways. The default repo's `repo` key is dropped from addresses as redundant, except on its landing, which would otherwise have no address.

## Navigation

**Header.** The estate navigation (`estateNav`) lists Activity, Waiting (with a token), Lists, Repos, Stage, Tools, Search, and Map. Repo-promoted app views (`appView: true`) follow, one button each, from `sidebarAppViews`, the same list the sidebar renders; keep one list so the two cannot disagree. The rail (`rail: true` links) and the ref switch appear on desktop. Select a repo in Repos.

**Sidebar.** `sidebarOpen` controls an overlay below `lg` and a column at `lg` and above, without changing the URL. Breadcrumbs show the app, repo, and non-default ref. Repo navigation lists views, projects, pins, and recents; estate navigation lists repos and app views.

**Repo views.** Overview displays the README. Other views are Pages, Atlas, Config, Files, and Project. A declared landing page renders as an app view.

**Display options.** `?shell=` controls the header and sidebar. It accompanies the view's address and has no `VIEWS` row.

| Value | Header | Sidebar |
| --- | --- | --- |
| `full` | Shown | Open on wide screens; closed on phones |
| `nav` | Shown | Closed; opened by the menu button |
| `none` | Hidden | Closed; the launcher and FAB Render tab provide navigation |

App views default to `nav`; other views default to `full`. Omit the default from the URL. Unknown values use `full`. `shell-routing.test.mjs` holds these rules. App views take their tab title and iOS Home Screen title and icon from toss-render's `toss-subject-mark` event.

**Ref switch** (`lib/alpineComponents/ref-switch.js`). Enter a branch, tag, or SHA to reload the app through toss-render at that ref (`#gh=…@<ref>:…`, which also pins its library), preserving the current deep link. It puts no `?use=` on the renderer's own query, since that pin kills Safari's web process on an iPhone whenever the renderer hosts a frame (SNAGS.md, `shell-pin-kills-the-tab`); the drawer around a switched view is therefore main's, and the FAB's layer strip says so. Search's ref picker changes the browsed repo's ref. The FAB Render tab shows the app ref. A link's selection (`refs=owner/repo@ref[:path]`, [loader.md](loader.md#the-selection)) travels to every view the app frames; a hub view with no ref of its own is displayed at the app's version. The Files view's browsed ref is its own visible choice, which also targets its writes, so the selection does not move it.

## Page controls

The floating action button (FAB) reads three optional lists from page components:

- `actions`: actions shown in the drawer.
- `toggles`: `[{ key, label, icon, on, title, set }]`, controls on the Render tab's width row, read on each paint.
- `menu`: `[{ label, icon, run }]`, rows in the launcher's long-press menu, read when opened (`readPageMenu()`). No description field.

Read each element's own scope. `Alpine.$data(el)` merges scopes and makes nested components report the app's controls.

## GitHub links

Every new view must include its GitHub link.

| Destination | Control |
| --- | --- |
| Repo menu (`lib/kits/github-links.js`) | Icon opens a list |
| Repo or branch | Plain icon |
| Manifest for a whole view | Icon and label at the header's far edge |
| Exact file | Plain icon with source preview |

Use `x-blob` with an `owner/repo[@ref]:path` address for exact files. It derives the link and hover preview from the same address. The preview is `lib/kits/source-peek.js`, loaded by `gh-boot.js`; `SourcePeek.seed` supplies bytes already held. Previews do not open on touch. Checks: `x-blob.test.mjs` and `npm run test:peek-link`.

## Shared gestures

**Drop and paste.** `wireAppDrop` and `wireAppPaste` stage incoming content and open Stage. `window.StageIntake` interprets the input. The app's paste listener is the only window paste listener; do not add a second. On phones, the launcher menu and Stage's Paste button call `pasteAnywhere` → `StageIntake.takeClipboard`. Read the clipboard during the tap's user activation; await nothing first. Outside the app, the FAB parks clipboard content through `lib/kits/stage-handoff.js` for the app to collect at startup.

**Expanded decks.** Swipe-deck takeovers fill the view pane at `lg` and above and the window below `lg`. CSS maps `--deck-left` and `--deck-top` at `lg` and above; `syncDeckFrame()` measures the header and decides whether the sidebar and header insets apply. Leaving the view calls the deck's `drop()` from `syncUrl()`.

## Public browse

`?view=public` (`lib/alpineComponents/public-browse.js`) lists and previews public repos without a token. `GH.flatTree()` makes one GitHub trees request; `GH.rawUrl()` supplies file URLs on raw.githubusercontent.com. Anonymous GitHub API access allows 60 requests per hour. Private repos return 404.

## Transfer

"Copy to repo" writes the staged fileset through `gh-transfer.js`.

- **Destination:** `owner/repo`, `owner/repo:dir`, or `owner/repo@ref:dir`. Omitted refs use the default branch.
- **Confirmation:** two taps; copying onto the source is refused.
- **Commit:** one Git Data API commit, base64 end to end, with up to twenty paths in its message.
- **Failures:** report and omit unreadable files; retry a moved ref three times against its new tip.
- **Limits:** files above the Contents API's 1 MB cap use `git/blobs/<sha>` (`getRaw`). File modes are not preserved.

## References

| Subject | Reference |
| --- | --- |
| Views and forms | `doc` columns in [app-routes.csv](app-routes.csv) and [subjects.csv](subjects.csv) (under [views/](views/) and [forms/](forms/)) |
| Stage and `#stage=` links | [stage.md](stage.md) |
| Repo configuration, the config cache and errands | [manifest.md](manifest.md), [manifest-fields.csv](manifest-fields.csv) |
| Proposals | [views/proposals.md](views/proposals.md) |
| The branch takeover | [forms/branch.md](forms/branch.md) |
| Choosing a presentation | [showing.md](showing.md), [showing-mechanisms.csv](showing-mechanisms.csv) |
| Standalone changeset review | [review.html](../pages/review.html) |

## Use from a Claude session

- **Browse:** `…/app/?repo=owner/repo`, optionally with `&ref=` or `&view=files&path=<dir>`. The bare app URL opens the estate.
- **Stage 🗂️:** create a `#stage=` link using [stage.md](stage.md); state the token requirement.
- **Configure:** edit the repo's `.web-tools.json` using [manifest.md](manifest.md).
