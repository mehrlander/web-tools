---
name: look-markers
description: "Hand over a look link: a page link whose fragment makes the page scroll to one element, tint it, show a one-line reason beside it, and ring a control to tap, or run a short walk of such steps. Use unprompted whenever a reply would tell the reader where to look or what to tap on a page that takes look links (one that loads lib/kits/look.js, or any page reached through a toss link), and turn three or more ordered taps into a walk. Also use when the user asks to point at, highlight, show me where, walk me through, or make a page take look links."
---

# Look markers

A **look link** is an ordinary page link whose `#fragment` asks the page to put a
**look marker** on one element: scroll there, tint it, and show a short card
saying why. A marker can also ring a control and point at it until the reader
taps it, and a **walk** is a sequence of markers that moves on as the reader
taps. The kit is [`lib/kits/look.js`](../../lib/kits/look.js); its header owns
the grammar and this skill owns when and how a session uses it.

Always write "look marker" or "look link" in full. "Marker" alone already means
several other things in these repos.

## When to use one

**Unprompted, whenever a reply would describe a place on a page in words.**
"Open the Funds tab and check the dedicated account row" is a walk of two
markers. "The figure is in the Total line" is one marker. The link does the
pointing, so the reply can say what to notice rather than where to find it.

- **One place:** `show` (look here) or `tap` (look here, then tap this).
- **Three or more ordered taps:** a walk.
- **Not** when the page cannot answer the fragment: see "Where it works". Say
  where to look in words instead, and offer to add anchors to the page.

## Making the link

Run the helper from a web-tools checkout. In another repo, use the path to it,
for example `python3 ../web-tools/scripts/look-link.py`.

1. **List the page's anchors.**
   `python3 scripts/look-link.py anchors <page>`
2. **Make the fragment.** One of:
   ```
   python3 scripts/look-link.py make <page> --show <anchor> --say "<why>"
   python3 scripts/look-link.py make <page> --tap <anchor> --say "<what to do>"
   python3 scripts/look-link.py make <page> --walk <name>
   python3 scripts/look-link.py make <page> --steps '[{"at":"<a>","tap":true,"say":"…"}, …]'
   ```
   It prints the fragment without its `#`, and exits 1 naming any anchor the page
   does not declare. **Do not send a link it rejected.** Fix the anchor, or fall
   back to words.
3. **Put it on the render link.** Pass the fragment to `showing` and paste
   exactly what it prints: `npm run showing -- --at "<fragment>"` in web-tools,
   `python3 ../web-tools/scripts/showing.py --at "<fragment>"` elsewhere. A page
   that routes on its own fragment keeps its keys beside the look keys:
   `--at 'gh=o/r&pr=12&show=…'`. `showing` also checks the anchors again, and
   on a page that takes look links it prints a `look:` line saying so.

**Writing `say`.** One short sentence the reader can act on, as on a phone card:
why this place matters or what to do with it. "Recalculate after changing an
amount", not "Click here". The kit shows it as plain text and never as markup.

## Anchors

| `at` | Resolves to | Survives |
| --- | --- | --- |
| `<name>` | the element with `data-at="<name>"`, else `id="<name>"` | anything that keeps the attribute |
| `text:<words>` | the smallest element whose whole text is those words | anything but a change of wording |
| `css:<selector>` | the first match | nothing structural |

Prefer declared names. `text:` and `css:` exist for pages that declare none, and
the helper can only report them as unchecked.

## Making a page take look links

- Load `lib/kits/land.js`, then `lib/kits/look.js`. The kit starts itself from
  the fragment, on load and on every change to its keys.
- Put `data-at="<name>"` on each element a link may name. A bound name
  (`:data-at="'row-' + r.id"`) is checked as its literal prefix.
- On a region that starts hidden, such as a tab panel, put
  `data-at-open="<name of the control that shows it>"`. A link into a closed tab
  then opens it first.
- Declare reusable walks in `<script type="application/json" id="look-walks">`
  as `{ "<name>": [ { "at": …, "say": …, "tap": true }, … ] }`.
- `python3 scripts/look-link.py check <page>` fails on a walk step or an opener
  that names nothing. In web-tools, `tools/test/look-link.test.mjs` runs it over
  every tracked page that declares either.
- The fragment keys `show`, `tap`, `say`, `walk` and `steps` belong to the kit on
  any page that loads it. Do not use them for the page's own routing.

The demo is [`lib/kits/demos/look.html`](../../lib/kits/demos/look.html).

## Where it works

- **A page that loads the kit,** wherever it is served.
- **Any page opened through a toss link** (🥏). The renderer adds the kit to a
  page that lacks it when the trailing fragment carries a look key. Such a page
  declares no anchors, so name the target with an `id`, `text:` or `css:`.
- **Not yet a page framed by the budget-drs app.** The app's shell forwards only
  the keys in its `SUBMITTAL_OPEN` list into the frame. A look link to a framed
  page has to open that page on its own until the shell forwards the look keys.

A target the kit cannot find, or finds but cannot show, gets a card on the page
saying so, so a wrong anchor fails visibly rather than silently. That is a
backstop. The check before sending is the real one.
