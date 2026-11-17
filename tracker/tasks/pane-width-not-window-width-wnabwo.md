---
id: pane-width-not-window-width-wnabwo
title: Audit the app's views for viewport breakpoints inside the content pane
status: done
closed: 2026-11-16
session: claude/pane-container-queries
errand: claude-2026-11-16-512733
project: repo
opened: 2026-08-23
size: S
---
# Audit the app's views for viewport breakpoints inside the content pane

Docking the swipe deck narrows the content pane through `--deck-dock-left` and
leaves the window where it was, so any `sm:`/`lg:`/`xl:` rule inside that pane
keeps answering a question nobody asked: how wide is the WINDOW. Nothing is
wrong at any window size, which is why these survive.

**The rule is already written**, so this task is the sweep and nothing else:
`skills/html-style/references/mechanics.md` rule 10 says to size a pane by its
container, `@container` on the column and `@md:`/`@xl:` in place of `sm:`/`lg:`.
(No longer in `docs/HTML-STYLE.md`, a pointer since 2026-08-31.)

## Three converted, and what each taught

| View | Found | Fix |
| --- | --- | --- |
| Docs (PR #480) | a 20rem side column at `lg:` inside a sub-400px pane, files pushed under the deck and clipped | `@container`, `@2xl:`/`@5xl:` |
| Stage bench | an `xl:` 26rem aside laid out in a 368px pane, overflowing by 24px onto the deposit column | `@container`, `@2xl:`/`@5xl:`/`@7xl:` |
| Files (PR #574) | not a breakpoint at all: `max-w-7xl` on the pane and a `mx-auto` 65ch measure in `viewer.js`, composing into two nested corridors | `!max-w-none` on both |

The Stage bench was measured before and after with a headless probe: 8
overlapping element pairs and 8 elements past the pane's right edge, both to
zero, with the undocked layout unchanged at every width.

**Files is why the sweep cannot be a grep.** `npm run reading-column` reported
"none" over that screen, because a page-shell size and a standing opt-out are
each exempt by design and still compose into a corridor. Look for the second
mechanism, not just the first.

## The sweep, 2026-11-16 (PR #1332)

Every route in `docs/app-routes.csv`, every Map tab and the Project tabs were
opened headless at a 1280px window with the deck docked (a 384px pane) and a
fixture token, then judged from the screenshot.

**Converted** (viewport rules to container variants on `<main>`: `sm:` to
`@xl:`, `md:` to `@2xl:`, `lg:` to `@3xl:`, `xl:` to `@4xl:`, `2xl:` to
`@6xl:`, `max-md:` to `@max-2xl:`): Pages, Project Pages, Repos, Tools, State,
Config, Public browse, and the Map tabs Overview, Purpose, Icons, Attributes,
Events, Scheduled, Set, Context, Tests, Agents, Model, Kits, Outposts, Harness.

**Reflowed already:** the repo Overview, Atlas, Files, Project, Stage, Branches,
Sessions, Writes, Chats, Lists, Search, Traffic, Compactions, Proposals,
Waiting, Tending, This browser, Local work, Usage, and the other Map tabs.

**No view is fixed-width on purpose.** Three groups were left as they are:

- App view and Atlas frame another page, which sizes itself.
- Rules seen not to overflow at 384px keep their viewport form: Map Growth's
  `md:` row grid, Dimensions' and Public's `sm:` row grids, the Comments and
  Outposts search boxes (`sm:w-80`, `sm:w-64`).
- Unobserved: Map Watch's scan lists (`lg:columns-2`, `xl:columns-2`,
  `sm:grid-cols-4`) render only after a scan, which the headless run did not
  start.


- `skills/html-style/references/mechanics.md`: rule 10 already states container sizing
- Snag `viewport-rule-blind-to-a-docked-pane`, in web-tools-private `lists/snag.json`, its filing note (in `docs/SNAGS.md` until 2026-10-20)
- `lib/alpineComponents/viewer.js`: Files corridor fix (`!max-w-none`) lived here
- PR #480: Docs conversion that filed the sweep
- PR #574: Files conversion without citing this task

## Done when
Every view reachable in the content pane has been opened with the deck docked and
either reflows or is recorded as deliberately fixed-width.

## Progress log
- 2026-08-23: Filed from PR #480 and logged as
  `viewport-rule-blind-to-a-docked-pane` in SNAGS. The Stage bench converted the
  same day, found the same way.
- 2026-09-03: Files converted by PR #574 without this task being cited.
- 2026-09-04: Recorded that conversion, trimmed the done-condition (the clause
  asking this task to write its own rule is satisfied), and cut the body from
  581 words. Still unaudited: every view but those three.
- 2026-09-18: Added ## Related (paths / sibling tasks / premise PRs).
- 2026-11-16: sent as Claude errand claude-2026-11-16-512733 (session b805c26a, owner's go); the errand's prompt asks the taker to close this task when the branch work is complete.
- 2026-11-16: Swept every view with the deck docked at 1280; twenty views and tabs converted on `claude/pane-container-queries`, delivered as PR #1332 (errand claude-2026-11-16-512733). Closed.
