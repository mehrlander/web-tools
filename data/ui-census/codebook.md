# UI pattern codebook

Draft of 2026-10-04, revised once against a hand-coded pilot of seven units.
It is the instrument for Pass 2 of the UI census ([README.md](README.md)): a
reader codes one row per unit, and every field below says what it holds and
what test decides it. Nothing here is settled vocabulary yet. The codes become
a registry only after a full pass shows they hold.

## What is coded, and what is not

A **unit** is one row of the census units file: an app view, a view's tab, or a
page. The census computes three things a reader does not code:

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

| Field | Holds | Test |
| --- | --- | --- |
| `frame` | how the reader chooses what the body shows, as codes from **Frame** below, `;`-joined | the control changes what the body holds, not how it looks |
| `body` | the unit's main arrangement at first paint, at desktop width, as one code from **Body** | the region that would remain if every control were removed |
| `reach` | what one tap on the body opens, as codes from **Reach** | the thing opens over or beside the body, rather than replacing the unit |
| `binding` | how the body's regions, or the body and its reach, are tied: one value from **Binding** | the strongest tie present |
| `phone` | what changes below 640px: one value from **Phone** | compare the two screenshots, or read the breakpoint in code |
| `built_on` | the kits or components that draw `body` and `reach`, `;`-joined, or `hand` | a call or a mount in the unit's files |
| `hand_evidence` | `file:line` of each part drawn by the unit's own code where a shared kit does the same job | blank when nothing qualifies |
| `form` | the type of the one object a region draws, where one is drawn: a `docs/subjects.csv` key, or a candidate type marked `?` | a layout written for that type, knowing its fields in advance |
| `style` | `house` (daisyUI and Tailwind, the app's look) or `own` (the page's own CSS vocabulary) | the screenshot |
| `notes` | anything a code could not hold | |
| `confidence` | `high` (code and pixels), `medium` (code only), `low` (inferred) | |

A unit can hold several frame and reach codes and exactly one body code. Code
the unit as it first paints. A tab that opens on a chart, with a list one switch
away, is coded on the chart.

## Codes

### Frame: choosing what is shown

| Code | Arrangement | Not to confuse with |
| --- | --- | --- |
| `tabs` | a strip of tabs, each its own address | `selector`, which picks one item rather than one view |
| `subtabs` | a second strip, or a switch row, inside a tab | |
| `lede` | one sentence under the tabs saying what the rows are | explanatory prose, which `html-style` forbids |
| `search` | a box that narrows the body as it is typed | |
| `census-chips` | one line of counts whose chips filter the body | a legend, whose chips do not filter |
| `rail-filter` | a rail of groups, often a folder tree with counts rolled up, whose selection narrows the body | `contents-rail`, which jumps rather than narrows |
| `contents-rail` | one contents list drawn as a side rail where the width allows and a pinned bar where not; a pick scrolls to a place | |
| `selector` | chips, a grid or a menu that picks the ONE item the body draws (a table, a biennium, a document) | `rail-filter`, which narrows a list |

### Body: the main arrangement

| Code | Arrangement | Test |
| --- | --- | --- |
| `list` | rows or entries, read by scanning | one entry per item, nothing else on screen draws an item in full |
| `grid` | a sortable, filterable table (Tabulator or a hand table used as one) | column headers that sort or filter |
| `card-grid` | one card per item, in a grid | each card is a complete small account of its item |
| `list-detail` | a list and one item's card, side by side or stacked | a pick redraws the card; the card shows exactly one item of the list |
| `linked-swiper` | a list and an INLINE strip of the items' cards, both on screen | a pick moves the strip AND a swipe moves the list's selection |
| `header-swiper` | a fixed region (a judgment, a guide, a question) over an inline strip of materials | the top region is about the set, not an index into it; no selection binding |
| `source-beside` | a document reader beside the material that cites it, with a divider | a cited item opens a place in the reader |
| `figure` | a chart, map or matrix is the main region, with controls and a legend | |
| `fields` | one object's fields, labeled values and small tables, read top to bottom | a form usually draws this, but the code is the arrangement; the `form` field says whose |
| `document` | prose or a rendered document, read top to bottom | |
| `tool` | an input and its output, where the reader acts rather than reads | |
| `app-split` | two whole views side by side | each pane is an app view with its own address |

### Reach: one tap away

| Code | What opens | Kit, where there is one |
| --- | --- | --- |
| `deck-takeover` | the list itself as a deck over the view or the window, at the tapped item, frozen at the tap | `swipeDeck.open` |
| `deck-docked` | the same deck over part of the pane, the list keeping the rest | `swipeDeck.open`, pane `dock` |
| `drill` | a deck one level down, covering its parent | `swipeDeck.drill` |
| `record-deck` | a table's records, one per slide, every field shown | `recordDeck` |
| `file-deck` | a changeset's files, one per slide | `fileDeck` |
| `peek` | a card on hover or focus, sometimes pinned by a click | `source-peek`, `title-tip`, `panel-tip`, or hand |
| `row-menu` | a menu at the finger: read from here, copy | `rowMenu` |
| `expand-row` | the row opens in place | |
| `modal` | a dialog or sheet over the page | `sheet-modal`, daisyUI `modal` |
| `land` | a scroll to a target that tints and fades | `land.js` |

### Binding

`none`, `select-show` (a pick in one region redraws another), `two-way` (moving
either region moves the other), `filter` (one region narrows another),
`cite-land` (an item opens a place in a document), `stamp` (the state is
written to the address, so a link reopens it). Code the strongest present;
`notes` may name the rest.

### Phone

`same`, `stack` (side by side becomes top over bottom), `hide:<region>` (a region
is dropped), `switch` (one region at a time, chosen by a control), `takeover` (an
inline region becomes a full-window deck), `wrap-cost` (a control wraps and
pushes the body down by more than a screen).

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

The pilot rows are in `2026-10-04-pilot.csv` beside this file (public units) and
in home's `data/ui-census/2026-10-04-pilot.csv` (budget-drs units).

## Open for the owner

- **A tab strip bound to a swiper.** The pension explorer's lens tabs and its map
  deck turn together, both ways. The pilot coded that `linked-swiper`, with the
  tab strip as the list. If tabs should stay frame-only, it is `figure` with a
  `two-way` binding instead, and the pattern goes unnamed.
- **Names.** `linked-swiper` and `header-swiper` are working names. The code calls
  the inline strip a "swiper" in four files and keeps "deck" for the takeover.
- **Grain inside a tab.** A tab whose switch row changes the body (Funding:
  Levels and its four switches) is coded once, on its first paint. A switch that
  changes the body's code may deserve its own row.
- **What `style: own` is for.** The submittal page has its own visual vocabulary
  (small capitals, square bordered buttons). Coding it says so; whether it should
  change is a separate question.
