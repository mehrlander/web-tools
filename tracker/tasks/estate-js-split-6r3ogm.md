---
id: estate-js-split-6r3ogm
title: Split estate.js into a component per view
status: backlog
opened: 2026-11-10
size: L
---
# Split estate.js into a component per view

`lib/alpineComponents/estate.js` registers one Alpine component, `estate`,
which the shell (`app/index.html`) mounts once. Its template then draws four
top-level views: Repos, Stage, Activity and Lists. Most other top-level views
are one component each, mounted by the shell directly: Map is `map()`, Tools is
`tools()`, Search is `searchView()`.

Inside estate the arrangement is mixed:

- Stage and Activity's State and Traffic panes are separate components that
  estate only hosts: `stager()`, `stateView()`, `trafficView()`.
- Repos, Lists, and Activity's Sessions, Branches, Chats and Writes panes are
  drawn by estate's own template from estate's own fields and methods.
- Activity's Tending pane is mounted by the shell, outside estate.

Measured 2026-11-10 at web-tools `dfce7164`: 14,915 lines and 928 KB, about
5,300 lines of template followed by about 9,400 of methods, about 500 members
on one object, and 45% of non-blank lines comment (Map › Docs › Comments). In
the 30 days before, 24 sessions committed to it and 19 merges touched it. At
roughly 230,000 tokens no session can read it whole, so every edit works from
search hits and partial reads, and nothing marks which field serves which view.

The aim is the arrangement the rest of the app already uses: one component per
view, logic that several views share in kits under `lib/kits/` (the layering in
`docs/code-layers.md`), and state that several components share in Alpine
stores, as the shell already does with `$store.browser`. Shared candidates seen
so far, by estate.js's own section headings: "The Activity query: one box, read
by every pane", "Crawl progress, for whichever pane is watching", the
formatters, and "One branch, stated in full", the branch row that Branches and
Sessions both draw.

## Approach

1. Map the coupling before moving anything: for each view, which fields and
   methods its template and its methods use, and which of those belong to
   another view or to all of them. The map sets the order and decides what
   becomes a kit and what becomes a store.
2. Pilot on Lists, unless the map says otherwise. It has its own address
   (`?view=lists`) and about 1,120 template lines.
3. Move the rest in the order the map gives.

If coupling makes per-view components too costly, the fallback is a file split
that keeps one component: each part moves to its own file and adds its template
and methods to `estate`. Behavior cannot change, and a test can prove it by
comparing the assembled template and member list with today's. The parts become
readable whole, but they still share one object.

A split moves code under every branch that edits estate.js, so check open pull
requests first. On 2026-11-10 none of the four open pull requests touched it.

## Related

- `lib/alpineComponents/estate.js`: the file to split.
- `app/index.html`: the shell, which mounts `estate()` and the other views'
  components.
- `docs/code-layers.md`: which folder a component and a kit belong in.
- `docs/loader.md`: the contract a new `lib/` file must honor to load through
  `gh.load`, and the boot-timing invariants.
- `docs/app-routes.csv`: each view's `files` column, which changes as views
  move.
- `repos-grid-into-map-reach-1eheiq`: moves the Repos view into Map › Reach,
  which takes Repos out of estate rather than into a component of its own;
  settle the order with it.
- `lib/alpineComponents/map.js`: 16,346 lines in the same shape, out of scope
  here.
- [web-tools#1255](https://github.com/mehrlander/web-tools/pull/1255): the
  session that took these measurements.

## Done when

estate.js draws no view itself: each view it draws today is its own component
or has left by another task, logic or state two or more views share lives in a
kit or a store, `npm test` passes, and each moved view has been checked by
screenshot at desktop and phone width.

## Progress log

- 2026-11-10: filed from the web-tools#1255 session after measuring the file;
  the owner plans to hand it to a fresh session.
