# UI pattern codebook

Draft of 2026-10-04, revised once against a hand-coded pilot of seven units.
It is the instrument for Pass 2 of the UI units ([README.md](README.md)): a
reader codes one row per unit, and every field below says what it holds and
what test decides it. Nothing here is settled vocabulary yet. The codes become
a registry only after a full pass shows they hold.

## What is coded, and what is not

A **unit** is one row of `units.csv`: an app view, a view's tab, or a page.
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

| Field | Holds | Test |
| --- | --- | --- |
| `frame` | how the reader chooses what the body shows, as `frame` codes from `codes.csv`, `;`-joined | the control changes what the body holds, not how it looks |
| `body` | the unit's main arrangement at first paint, at desktop width, as one `body` code | the region that would remain if every control were removed |
| `reach` | what one tap on the body opens, as `reach` codes | the thing opens over or beside the body, rather than replacing the unit |
| `binding` | how the body's regions, or the body and its reach, are tied: one `binding` code | the strongest tie present |
| `phone` | what changes below 640px: one `phone` code | compare the two screenshots, or read the breakpoint in code |
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

The codes are rows of [`codes.csv`](codes.csv), one per code, grouped by
`axis`: `frame`, `body`, `reach`, `binding` and `phone`. Each row gives the
code's arrangement (`gloss`), the `test` that decides it, what it is
`not_to_confuse` with, and the `kits` that draw it where any do. A reader codes
from that file, and the Map view renders the same rows, so a code changed there
changes in both.

Three rules the rows cannot hold:

- **Binding:** code the strongest tie present; `notes` may name the rest.
- **Phone:** `hide` is written `hide:<region>`, naming what is dropped.
- **A code that fits nothing:** write `new:<proposed-code>` and say in `notes`
  what it is. A new code is settled at synthesis, not by the reader.

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
