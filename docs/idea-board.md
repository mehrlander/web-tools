# The idea board form

An idea board is the output of the [`design-sprint`](../skills/design-sprint/SKILL.md)
skill's phase 2: eight concepts written before any was judged, then the
selection. [`pages/idea-board.html`](../pages/idea-board.html) draws one from
a JSON file. With no address it draws the sample,
[`pages/demos/idea-board.json`](../pages/demos/idea-board.json), whose shape
every board follows.

## Addresses

| Address | Reads |
| --- | --- |
| `#gh=owner/repo[@ref]:path` | the file, through the viewer's stored GitHub token |
| `#gz=<base64url>` | the gzipped JSON carried in the link, for a reader with no token |
| `#user-call=owner/repo[@ref]:path` | the pick call that names the board, as [Returning picks](#returning-picks) describes |

Each also reads from the query. Pin `@ref` to a commit so the link keeps showing the board that was handed over.

## Fields

| Field | Holds |
| --- | --- |
| `title`, `subject`, `made` | the board's name, what it is about, and the date |
| `brief.background`, `brief.methodology` | a sentence each, from phase 1: what gives rise to the board, then how the concepts were made |
| `ideas[]` | eight concepts: `n`, `title`, `kind` (its principal difference), `commentary`, `sketch` |
| `selection.pick[]` | the base concept's `n` |
| `selection.grafts[]` | `[n, what is taken from it]` pairs |
| `selection.rationale`, `selection.assumptions[]` | why, and the open questions the choice rests on |

## Sketches

`sketch` is either a complete SVG document or an HTML fragment.

- **SVG** renders as an image, and its list row gets a thumbnail. Give it a
  `viewBox` about 320 wide, text at 14 or larger, a named `font-family`, and
  explicit colors, since `currentColor` resolves to black inside an image. At
  390 px the strip shows a sketch about 360 px wide, so text at 14 renders near
  16 px.
- **HTML** renders inline, so it can use the page's Tailwind, daisyUI and
  Phosphor classes, and `<details>` for anything opened by a tap. Scripts, event
  attributes and `javascript:` links are removed. Rows then carry no
  thumbnails, since the page cannot draw a reduced copy of a fragment.

## Cards

A board has four parts: the brief gives its background and methodology, each idea has a proposal (its `title`, `kind` and `sketch`) and a commentary (its `commentary`), and the selection is its conclusion. [`lib/kits/call-marks.js`](../lib/kits/call-marks.js) draws an icon for each part, and the page marks the brief and the selection with the kit's book and stamp.

Each idea is one card: its commentary, then its sketch, then the reader's star and note; from 1280 pixels wide the sketch sits beside the other two. The commentary is one sentence of insight into what the idea brings, with `**bold**` and `` `code` `` the only formatting drawn. The header above the strip of cards names the card in view by its number and `title`. The brief card shows the background and the methodology, each under its label, with the board's `made` date beneath them. A board whose brief has `result` and `musts[]` and whose ideas have `encounter` and `helps`, as [`docs/prototypes/md-edit-ideas.json`](prototypes/md-edit-ideas.json) does (a record, never edited once on main), is read with each pair turned into prose.

## Returning picks

The reader stars concepts and writes notes on any card, the selection
included. The header's copy button puts them on the clipboard as text that names
the board's address, to paste into the session that made the board. Picks and
notes stay in the browser, keyed by the address without its ref, so a board
republished at a new commit keeps them.

On a [pick call](forms/README.md#respond-forms), opened at its `#user-call=` address, the header's Send records the stars and notes as the call's answer and comments them on its pull request. Reopened there, the board starts from the latest answer.
