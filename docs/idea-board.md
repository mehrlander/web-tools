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

Both also read from the query. Pin `@ref` to a commit so the link keeps showing
the board that was handed over.

## Fields

| Field | Holds |
| --- | --- |
| `title`, `subject`, `made` | the board's name, what it is about, and the date |
| `brief.result`, `brief.musts[]` | the intended result and what the concept must show, from phase 1 |
| `ideas[]` | eight concepts: `n`, `title`, `kind` (its principal difference), `encounter` (what readers meet), `helps` (what it helps them understand), `sketch` |
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

## Faces

Each idea's card has two faces. The proposal face shows the idea's `title`, `kind` and `sketch`; the commentary face shows `encounter`, `helps`, the idea's role in the selection (base or graft, from `selection.pick` and `selection.grafts`), and the reader's star and note. Below 1280 pixels wide, a switch above the strip, repeated in the header of the full-screen deck the strip expands into, shows one face on every card, and `face=commentary` in the address opens on the commentary face; wider, the two faces sit side by side.

The brief and the selection have no faces: the brief is the board's background and the selection its conclusion. [`lib/kits/call-marks.js`](../lib/kits/call-marks.js) draws a mark for each of the four parts, a book for the background, a bulb for the proposal, a speech bubble for the commentary and a stamp for the conclusion, and the page uses them on the brief, the face switch and the selection.

## Returning picks

The reader stars concepts and writes notes on any card, the selection
included. The header's copy button puts them on the clipboard as text that names
the board's address, to paste into the session that made the board. Picks and
notes stay in the browser, keyed by the address without its ref, so a board
republished at a new commit keeps them.
