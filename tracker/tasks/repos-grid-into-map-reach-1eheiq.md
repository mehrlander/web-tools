---
id: repos-grid-into-map-reach-1eheiq
title: Move the Repos grid into Map › Reach
status: backlog
opened: 2026-10-19
size: L
---
# Move the Repos grid into Map › Reach

The Repos view (`?view=repos`), the grid of estate repository cards, moves
into the Map as a Reach subview, and the header loses its Repos button. The
owner asked for this on 2026-10-12: the Repos view is used for discovering
information about repositories, which is the Map's job, and Reach already
draws each repository as its Repos card in the routes diagram. #945 built the
Map's two doors (Overview and Reach) and left this move for its own pull
request.

Until this lands, Repos stays in the header (owner's call, 2026-10-19). A
half-step that drops only the header button fails the gate that every
estate-level route is a header stop, so the move goes in whole.

What the move involves, measured at `8293c466`:

- **Extract the grid.** Its markup is about 460 lines inside
  `lib/alpineComponents/estate.js` (the `tab==='repos'` block, lines 983 to
  1442), and its state lives in the same 13,913-line component, which the
  shell mounts once for ten views (Repos, Lists, Stage and the Activity
  family). The Map cannot mount it without either a component of its own for
  the grid or a second copy of the whole estate component; the first is the
  intended route.
- **Route it like `?view=routes`.** `?view=repos` (and `?view=estate`) keeps
  working and lands on Map › Reach › Repos; the Map's header stop lists
  `repos` in its `views`, so `repos`' declared stop becomes Map and the
  nav-stop gate keeps holding.
- **Keep the token-less front door.** A bare open with no token calls
  `goDashboard()`, which goes to Repos; it should land on the same grid at its
  new address.
- **Keep the writes.** Adopting a repository, setting one aside and editing a
  card write that repository's own `.web-tools.json`; they move with the grid
  unchanged.
- **Reach still opens on Routes**, with Repos as a subview.

## Related

- `lib/alpineComponents/estate.js`: the grid's markup and state to extract
- `lib/alpineComponents/map.js`: `TABS`, `SUBVIEWS` and `SUBVIEW_PARENT`, where Reach gains the subview
- `app/index.html`: `estateNav` (the Repos entry, line 7048), `goDashboard` (line 7009), `goRepos`, and `MAP_SUBVIEWS`
- `node/test/app-routes.test.mjs`: the nav-stop gate (line 153) that rules out dropping the button alone
- `node/test/map-tabs.test.mjs`: `GROUPS`, which must gain the new subview
- `docs/app-routes.csv`: the `repos` row's `stop`
- `docs/map-tabs.csv`: a row for the new address
- `docs/APP.md`: the header sentence and "Select a repo in Repos"
- `lib/alpineComponents/estate.js`, `lib/alpineComponents/map.js`: where the grid lives
- `data/ui-units/`: the Map units' recoding waits on this move, since it changes the same units
- `tracker/tasks/stranded-titles-panel-or-drop-o6hqom.md`, `tracker/tasks/registry-authored-derived-split-v3qm2x.md`: open tasks that also touch `estate.js`
- PR #945: the two-door regroup this completes

## Done when

`?view=repos` opens Map › Reach › Repos with the full grid, its unfiled list
and its write actions working; the header has no Repos button and the Map
button is lit on that address; a token-less bare open lands on the grid; and
the suite passes, the nav-stop gate included.

## Progress log
- 2026-10-19: filed at the owner's direction after a tend pass (2026-10-18) found the half-step fails the nav-stop gate; Repos stays in the header meanwhile. Next: extract the grid from `estate.js` into its own component.
