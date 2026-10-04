# UI census

A census of the user interface the Web Tools app and the budget-drs app show:
one row per unit, the ring each sits in, and which shared kits its files call.
It is the input to a catalog of the estate's display patterns, rendered in the
Map view's Patterns tab. This folder holds a snapshot, its coding, and the
draft [codebook](codebook.md), not a registry: nothing here is gated, and
nothing is authoritative until the owner has assessed the codes.

## Files

| File | Row | Written by |
| --- | --- | --- |
| `units.csv` | one unit: an app view, a view's tab, or a page; `as_of` dates the snapshot | `tools/ui-census.mjs` (Pass 0) |
| `signals.csv` | one source file: kit call counts, kits loaded by name, hand-built signatures | `tools/ui-census.mjs` (Pass 1) |
| [`codes.csv`](codes.csv) | one code a unit can be coded with, by axis | authored, settled at synthesis |
| `coded.csv` | one unit coded against the codebook; `coder` names the pass that coded it | readers (Pass 2), merged at synthesis |
| [`codebook.md`](codebook.md) | the coding instrument: fields, rules, and the decisions behind the codes | authored |

Regenerate the snapshot with `npm run ui-census -- --write --date <date>`,
from a checkout that has `home` beside it. Without `--write` it prints counts.
The names are stable so the Map can read them without listing the folder; git
holds the earlier snapshots.

**The public and private halves are split by visibility.** Rows whose unit
lives in this repo are written here. Rows for home's own pages and for
everything the budget-drs app draws or frames go to home's `data/ui-census/`,
so no private file name lands in public source. The 2026-10-04 snapshot holds
155 units here and 65 in home, and 54 and 41 of them are coded. Units in other
repositories, such as shortcut-tools' own pages, are counted by the script and
written nowhere.

## Rings

`app_ring` says how far a unit sits from the Web Tools app's center. No
registry declares rings; each value rests on the declaration the row names in
`ring_basis`. The column is not called `ring` because budget-drs's
`data/design/lineage/exposure.csv` already has one, for how far a data file is
from being displayed.

| Ring | Holds | Declared by | Here | Home |
| --- | --- | --- | --- | --- |
| 0 | the app's built-in views, and their tabs | `docs/app-routes.csv`, `docs/map-tabs.csv` | 47 | |
| 1 | pages a repo promotes into the app, and the views of a promoted app | `appView: true` in a `.web-tools.json` | 7 | 37 |
| 2 | pages a promoted app frames | `embed` in the budget-drs app's `VIEWS` | | 8 |
| 3 | gallery pages, and pages nothing declares | `pages/pages.csv`, `pages[]`, or nothing | 39 | 20 |
| 4 | demonstrations and scratch | `pages/pages.csv` top `demos`, `kit-demos`, `drop`, `scratch` | 62 | |

Four of home's ring 2 units live in repositories not checked out here
(budget-wa, fn-data, spend-wa) and carry `reachable: not checked out`.

## What the columns can and cannot say

- **`at`** is the commit each unit's files were read at. A reader's `file:line`
  in `coded.csv` is cited against it, and the Map's deck links to that commit,
  so a citation keeps landing after the branch moves on.
- **`attribution`** is `declared` when the unit's own registry row names its
  files, `derived` when the script followed the budget-drs app's `RENDER` table
  to a file and then that file's references into sibling view files, `shell`
  when the unit renders from the app shell, and `shared` when one file serves
  several units. Every Map tab shares `map.js`, and every budget-drs tab shares
  its view's files, so a tab's kit counts are its view's, not its own.
- **Kit counts** are call sites, so a deck opened from three places counts three.
  `kits` lists what a file loads by name, which catches a route that has no call
  site at all: budget-drs reaches the record deck through
  `__loadKit("record-deck.js")` and the row menu.
- **Hand-built signatures** flag a file to read, nothing more. `hand_snap` is
  an inline snap track in a file that never calls `swipeDeck.core`. On
  2026-10-04 it flagged four components that hand-build the same inline swiper:
  the Files view (`file-browser.js`), the branch page (`branch-brief.js`), the
  session page (`session-brief.js`) and the call form (`call-form.js`).

## Coverage of the 2026-10-04 coding

Every unit of rings 0 to 2 that is checked out here is coded: seven by hand in
the pilot, 88 by eight readers in parallel, merged at synthesis (the codebook's
last section says what was decided there). Rings 3 and 4 have the mechanical
pass only. Screenshots were taken headless at 1280 and 390 pixels wide and are
not committed; nine rows are `medium` because the unit needs a token or data a
headless render does not have.
