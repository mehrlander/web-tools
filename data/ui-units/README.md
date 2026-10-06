# UI units

Tables of the user interface the Web Tools app and the budget-drs app show:
one row per unit, the ring each sits in, and which shared kits its files call.
It is the input to a catalog of the estate's display patterns, rendered in the
Map view's UI tab as Dimensions and the Gallery. This folder holds a snapshot, its
coding, its screenshots, and the draft [codebook](codebook.md), not a
registry: nothing here is gated, and nothing is authoritative until the owner
has assessed the codes.

## Files

| File | Row | Written by |
| --- | --- | --- |
| `units.csv` | one unit: an app view, a view's tab, or a page; `as_of` dates the snapshot | `tools/ui-units.mjs` (Pass 0) |
| `signals.csv` | one source file: kit call counts, kits loaded by name, hand-built signatures | `tools/ui-units.mjs` (Pass 1) |
| [`dimensions.csv`](dimensions.csv) | one dimension the units are coded on: what it holds, its test, whether a unit takes one code or any number, and, for frame and body, the color their slots are outlined in | authored |
| [`codes.csv`](codes.csv) | one code a unit can be coded with, by axis (the dimension), and the five rings | authored, settled at synthesis |
| [`parts.csv`](parts.csv) | one part a declared pattern can name, and what it is | authored |
| `coded.csv` | one unit coded against the codebook; `coder` names the pass that coded it | readers (Pass 2), merged at synthesis |
| [`codebook.md`](codebook.md) | the coding instrument: fields, rules, and the decisions behind the codes | authored |
| `instances.csv` | one unit loaded to check what its markup declares: the code declared and coded, the parts found, whether the code's behavior held, and the slots found, missing and stray (codebook, "Slots") | `tools/build/ui-instances.mjs` |
| `shots.csv` | one unit whose screenshot needs more than its address: a query, a scenario script (stand-in rows for a pane that needs a token), a click, a focus other than its host's, or a `region` narrower than its host's; `shot` is `no-script` where the script reads a private repository, so the check runs it and the public shot does not | authored |
| `thumbs/` | each unit's desktop and phone shot as a JPEG thumbnail, its slots outlined and named, cropped from the topmost slot, and `thumbs.csv` naming them with the focus each crop used | `tools/build/ui-shots.mjs` |

Regenerate the snapshot with `npm run ui-units -- --write --date <date>`,
from a checkout that has `home` beside it. Without `--write` it prints counts.
The names are stable so the Map can read them without listing the folder; git
holds the earlier snapshots.

The shots are taken by `npm run ui-shots`, once per session at most, like
`pages/thumbs/`: they are not byte-deterministic, so no commit hook owns them.
home's units are shot into web-tools-private's `thumbs/mehrlander/home/ui-units/`,
the private registry's store for shots of private repos' pages.

**The public and private halves are split by visibility.** Rows whose unit
lives in this repo are written here. Rows for home's own pages and for
everything the budget-drs app draws or frames go to home's `data/ui-units/`,
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

The five rings are the `ring` rows of [`codes.csv`](codes.csv): what each
holds (`gloss`) and the declaration that places a unit in it (`test`). Ring 0
is the app's built-in views, 1 what a repo promotes into the app, 2 what a
promoted app frames, 3 gallery pages and pages nothing declares, 4
demonstrations and scratch. The 2026-10-04 snapshot counts:

| Ring | Here | Home |
| --- | --- | --- |
| 0 | 47 | |
| 1 | 7 | 37 |
| 2 | | 8 |
| 3 | 39 | 20 |
| 4 | 62 | |

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
