---
name: look-markers
description: "Hand over a look link: a page link whose fragment scrolls to one element, tints it, shows a one-line reason, and can ring a control to tap or run a walk of such steps. Use unprompted whenever a reply would tell the reader where to look or what to tap on a page, and when asked to point at, highlight, or walk someone through something on a page."
---

# Look markers

A **look link** is a page link whose `#fragment` puts a **look marker** on one
element: the page scrolls there, tints it, and shows a card saying why. A marker
can also ring a control the reader must tap before going on, and a **walk** is a
sequence of markers. The grammar is in the header of
[`lib/kits/look.js`](../../lib/kits/look.js).

Write "look marker" and "look link" in full; "marker" alone means other things here.

## When

Whenever a reply would locate something on a page in words, send the link and
let the reply say what to notice. One place is `show`, or `tap` when the reader
should press it; three or more ordered steps are a walk. Where no route below
reaches the page, say it in words.

## Making the link

Use `python/look-link.py` (from another repo, `../web-tools/python/look-link.py`):

    look-link.py anchors <page>
    look-link.py make <page> --show <anchor> --say "<why>"
    look-link.py make <page> --tap <anchor> --say "<what to do>"
    look-link.py make <page> --walk <name>
    look-link.py make <page> --steps '[{"at":"…","tap":true,"say":"…"}, …]'

`make` prints the fragment and exits 1 when a page that declares anchors lacks
the one named; do not send a rejected link. Pass the fragment to `showing` as
`--at "<fragment>"`, beside the page's own keys if it routes on its fragment, and
paste what it prints.

`say` is one sentence the reader can act on: "Recalculate after changing an
amount", not "Click here".

## Anchors

| `at` | Resolves to | Breaks when |
| --- | --- | --- |
| `<name>` | `data-at="<name>"`, else `id="<name>"` | the attribute goes |
| `text:<words>` | the smallest element whose whole text is those words | the wording changes |
| `css:<selector>` | the first match | the structure changes |

Prefer `data-at` names and ids: only they are checked before sending.

## Where it works

- A page that boots the web-tools loader (`lib/entry.js` or `gh-api.js`); it loads
  the kit when a fragment asks.
- Any page through a toss link (🥏); the renderer adds the kit.
- A page that loads `lib/kits/look.js`.
- Not inside a frame of the budget-drs app; link the framed page itself.

## Giving a page anchors

- `data-at="<name>"` on each element a link may name; a bound
  `:data-at="'row-' + r.id"` is checked by its prefix.
- `data-at-open="<name>"` on a region that starts hidden, naming the control that
  shows it, so a link into a closed tab opens it first.
- Walks in `<script type="application/json" id="look-walks">`, as
  `{ "<name>": [{ "at": …, "say": …, "tap": true }, …] }`.
- Leave `show`, `tap`, `say`, `walk` and `steps` to the kit; do not route on them.

`look-link.py check <page>` fails on a walk step or an opener that names nothing,
and the suite runs it over web-tools. Demo: [`lib/kits/demos/look.html`](../../lib/kits/demos/look.html).
