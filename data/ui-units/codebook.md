# UI pattern codebook

Draft of 2026-10-04, revised once against a hand-coded pilot of seven units.
It is the instrument for Pass 2 of the UI units ([README.md](README.md)): a
reader codes one row per unit, and every field below says what it holds and
what test decides it. Nothing here is settled vocabulary yet. The codes become
a registry only after a full pass shows they hold.

## What is coded, and what is not

A **unit** is one row of `units.csv`: an app view, a view's tab, or a page.
A tab whose data, not its reader, chooses between arrangements (the Project
Overview) is one unit per arrangement, and a route that only lands on a tab
(`lands` in `docs/app-routes.csv`) is an address of that tab's unit.
`tools/ui-units.mjs` computes three things a reader does not code:

- **`app_ring`**: how far the unit sits from the Web Tools app's center, from
  the declaration named in `ring_basis` (README, "Rings").
- **Kit signals**: call counts of the shared kits in the unit's files, and the
  kits it loads by name.
- **Hand-built signatures**: an inline snap track with no `swipeDeck.core`, a
  drag divider with no `dockSplit`, a fixed full-window layer with no deck or
  modal. A signature is a reason to read the file, not a finding.

The reader codes what only reading and looking can settle: how the screen is
arranged, how its regions are tied together, what changes on a phone, and what
draws it.

## Fields

A unit is coded on five **dimensions**: `frame`, `body`, `reach`, `binding`
and `phone`. Each is a row of [`dimensions.csv`](dimensions.csv), which says
what the dimension holds, the test that decides it, and whether a unit takes
exactly one of its codes (`per_unit` is `one`) or any number of them (`any`).
A sixth row, `ring`, is computed rather than coded (README, "Rings"). The
codes a dimension divides the units into are the rows of `codes.csv` whose
`axis` names it. The Map view's UI tab renders both files: Dimensions shows
each dimension with its codes and counts, and Gallery groups the units' shots
by any one of them.

The other fields record what draws the unit and how sure the reader is:

| Field | Holds | Test |
| --- | --- | --- |
| `built_on` | the kits or components that draw `body` and `reach`, `;`-joined, or `hand` | a call or a mount in the unit's files |
| `hand_evidence` | `file:line` of each part drawn by the unit's own code where a shared kit does the same job | blank when nothing qualifies |
| `form` | the type of the one object a region draws, where one is drawn: a `docs/subjects.csv` key, or a candidate type marked `?` | a layout written for that type, knowing its fields in advance |
| `style` | `house` (daisyUI and Tailwind, the app's look) or `own` (the page's own CSS vocabulary) | the screenshot |
| `notes` | anything a code could not hold | |
| `confidence` | `high` (code and pixels), `medium` (code only), `low` (inferred) | |
| `at` | the commit the unit was read at, where its `file:line` citations resolve | `git rev-parse --short=12 HEAD` in the unit's repo |

A unit can hold several frame and reach codes and exactly one body code. Code
the unit as it first paints. A tab that opens on a chart, with a list one switch
away, is coded on the chart.

## Codes

The codes are rows of [`codes.csv`](codes.csv), one per code, grouped by
`axis`, which names the dimension: `frame`, `body`, `reach`, `binding` and
`phone`, plus the five `ring` rows no reader codes. Each row gives the
code's arrangement (`gloss`), the `test` that decides it, what it is
`not_to_confuse` with, and the `kits` that draw it where any do. A reader codes
from that file, and the Map view renders the same rows, so a code changed there
changes in both.

Three rules the rows cannot hold:

- **Binding:** code the strongest tie present; `notes` may name the rest.
- **Phone:** `hide` is written `hide:<region>`, naming what is dropped.
- **A code that fits nothing:** write `new:<proposed-code>` and say in `notes`
  what it is. A new code is settled at synthesis, not by the reader.

## What a pattern is, and four ways a unit is tied to one

A **pattern** here is a `body` code: a named arrangement of a unit's main
region, such as `list` or `source-beside`. Its definition is its row of
`codes.csv` (name, gloss, test, what it is not to be confused with) and, for
the three codes that have one, its `parts` cell. Nothing else defines it, so a
pattern exists whether or not any code draws it, and the other dimensions'
codes are not patterns in this sense.

Four sources can tie a unit to a pattern, and they differ in who or what
supplies the claim:

| Source | Holds | Supplied by |
| --- | --- | --- |
| coded | the unit's one `body` code in `coded.csv` | a reader's judgment against the code's test |
| declared | `data-pattern` on the element holding the arrangement | the unit's own markup |
| construction | a kit in the code's `kits` cell among the unit's `built_on` | `codes.csv` names the kit; the reader records the call |
| behavior | the code's promise, tried on the page driven headless | `tools/build/ui-instances.mjs`, into `instances.csv` |

Every coded unit has the first; the other three are present only where they
apply. A pattern can also have characteristics that are not part of its
definition and are observed across its units:

- **Whether a shared kit draws it.** Five codes name a kit: `grid`
  (Tabulator), `linked-swiper` and `header-swiper` (swipe-deck's core),
  `source-beside` (dock-split) and `deck-page` (swipe-deck). The other ten
  name none, so each unit coded with one draws its own; declaring the parts
  makes such a pattern checkable without making it a component.
- **How many units use it, and in which apps.** The Dimensions view counts
  each code's units in scope.
- **How its declarations fared.** The Gallery says, under each Body code,
  which kit draws it in how many of its units, and how many units declare
  it and hold.

## Declaring a pattern in markup

A body code can also be stated by the unit's own markup, which treats the code
as an interface: a set of named parts and a behavior the unit promises. Piloted
on 2026-10-05 for `list` and `list-detail` on five units, then carried to every
unit coded either code, and the same day to every unit coded `card-grid`, the
third code whose `parts` cell is filled. A card grid's parts are a list's: the
grid is the `list` part and each card an `item`, with the same anatomy. The
rollout's readers asked for `body` and `links` and for the rules on groups,
nesting and alternates below.

- **`data-pattern="<code>"`** goes on the element that holds the whole
  arrangement, using a body code from [`codes.csv`](codes.csv).
- **`data-part="<part>"`** goes on each element of it. The `parts` cell lists
  the parts a code allows, required ones first and optional ones marked `?`.
  [`parts.csv`](parts.csv) says what each part is and gives it one color, the
  same in every pattern. A part belongs to its nearest `data-pattern` ancestor,
  and a part outside any is ignored.
- **The selected item** carries a standard attribute rather than a data one:
  `aria-selected="true"` where the list is an ARIA `listbox`, otherwise
  `aria-current="true"`.
- **An item's anatomy** is title, meta, summary, body, links and actions, as
  far as the item has them. `meta` is any one fact about the item: a code, a
  count, an amount, a date, a kind icon or a status chip, marked on the
  smallest element that holds only such facts. `body` is the item's own
  content beyond its summary (a diff, a script, a small chart, a panel it
  expands in place); `links` lead elsewhere (tags that filter the list, doors
  to other views, related documents), where `actions` act on the item itself.
  A `group` may carry its own `meta`, `summary`, `links` and `actions`, such
  as its count, its sentence, a door to its notes or a "show more". A part may
  sit inside another (a link inside an actions row, a date inside a title).
  What describes the whole list (its count line, filter, pager or empty state)
  is the frame's, coded on the frame axis, and carries no part.
- **Nesting.** An item may hold a declared pattern of its own (a session's
  branch tiles), and its parts belong to that inner pattern. Nested group
  headings are all `group`; the levels are not told apart.
- **Alternates.** Two elements may carry the same part where only one is
  shown at a time (a detail drawn as a parsed panel or as the source sheet, a
  title that is a link or plain text).

`data-ui` would have been the obvious name; `lib/vanilla-bundle.js` already
uses it to look elements up.

Where a unit declares a pattern, the declaration states its intent, and the
`body` a reader coded becomes evidence checked against it. A unit may also
show a declared pattern that is not its body, such as the errands list inside
Stage, coded a tool; it contains that pattern rather than declaring its own.
The construction and behavior sources above check an instance independently
of its declaration. The behavior each code promises: for `list`, at least one
item shown; for `card-grid`, at least one card; for `list-detail`, picking an unselected item changes (or first
shows) the detail and moves the selection to it. A declaration hidden at the
unit's address, or a list with nothing in it there, is unchecked rather than
failed, until a scenario script (`tools/render/scenarios/`) gives it stand-in
rows; `shots.csv` names the scenario a unit is checked and shot with.

`tools/build/ui-instances.mjs` runs both checks and writes `instances.csv`,
one row per unit it loaded. `tools/build/ui-shots.mjs` crops a declaring unit's shots
to the declared element and outlines its parts in their colors.

## Where the pilot moved the codebook

Seven units were coded by hand before this was written down: the Branches view,
the Map's Docs tab, `pages/branch.html`, and four units of the budget-drs app (Funding:
Requests, Data: Sources, the submittal page, and the pension explorer it frames). Three things
changed because of them.

1. **One pattern field became three.** The first draft had one code per unit and
   could not say that Data: Sources is a table chosen by chips with a record
   deck behind its rows. `frame`, `body` and `reach` say it in three codes.
2. **`header-swiper` split from `linked-swiper`.** The branch page and the call
   form put a strip of materials under a fixed region; the pension explorer and
   the swiper on budget-drs branch `claude/funding-comp-csm-tabs` bind a list to
   the strip in both directions. The geometry is the same and the binding is
   not, so they are different patterns.
3. **`wrap-cost` joined Phone.** Data: Sources draws about 900 pixels of table
   chips above its table on a phone, which no other phone code described.

The pilot rows are the rows of `coded.csv` whose `coder` is `pilot`, here for
the public units and in home's `data/ui-units/coded.csv` for the budget-drs
ones. Two were corrected after readers found what the pilot missed: Data:
Sources gained a hand-built column-story card, and Branches gained the Activity
tabs and search box.

## Decided by the coder, pending the owner's review

On 2026-10-04 the owner asked for the categorization to go ahead on the coder's
judgment and to be assessed once it is viewable. These four calls were made on
that basis.

- **A tab strip bound to a swiper is `linked-swiper`.** The pension explorer's
  lens tabs and its map deck turn together, both ways, so the tab strip is the
  list. Coding it `figure` would leave the binding without a pattern.
- **Names stay as drafted.** `linked-swiper` and `header-swiper` follow the
  code's own usage: "swiper" for an inline strip in four files, "deck" for the
  takeover.
- **One row per tab, coded at first paint.** A switch row that changes the
  body is recorded in `notes`, not as a row of its own.
- **`style: own` is recorded, not judged.** Whether a page should move to the
  house look is a separate question.

## Settled at synthesis

Eight readers coded the remaining 88 units of rings 0 to 2 on 2026-10-04,
each against this codebook, with screenshots at both widths where the unit
would render headless. Four decisions came out of merging their rows.

- **Eleven proposed codes joined `codes.csv`.** `filter-switch`, `dial` and
  `panel-toggle` (frame); `host`, `list-stack` and `deck-page` (body);
  `dock-view`, `turn-deck`, `swap-view` and `panel-below` (reach); `squeeze`
  (phone), proposed by two readers independently.
- **A copied deck door is not hand-built.** `swipeDeck.entry` says a
  template-driven host has to keep a literal copy of its door, and
  `deck-entry-parity.test.mjs` holds each copy to the kit, so those
  citations were dropped from `hand_evidence`.
- **A chip row with no counts is `filter-switch`.** Data: Design's filter row
  was coded `count-chips` by a reader who said the code was bent.
- **A wide table that scrolls sideways on a phone has no code yet.** Readers
  coded it `same` or `stack` and said so in `notes`; a code earns a row once a
  second pass finds it often enough to compare.
