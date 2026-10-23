# Showing: how content reaches a viewer

Showing follows the conversation rules ([CONVERSATION.md](CONVERSATION.md)): they decide
what a reply hands over; showing is what makes it openable.

**The reference is the app, not this file.** Each way of showing (a 🥏 toss, the
deployed page's own URL, content carried in the link, and others) is a row in
[`showing-mechanisms.csv`](showing-mechanisms.csv), with the address to write,
what it reaches and misses, its trap, and when to use it. The `showing` block of
[`routes.json`](routes.json) holds the picker rules and two of the three axes that
classify the rows, version and viewer; the third, subject, is
[`subjects.csv`](subjects.csv). The app's **Map view, Showing tab** renders all
three files, and `npm run showing` ([`python/showing.py`](../python/showing.py))
executes the picker.

## The toss, framed or as the tab

A 🥏 toss is the preview link for anything the deployed page does not already
show, a library change included, since a page tossed at a ref boots its library
at that ref. A `?use=` link, a deployed page pinned to a ref, still works where
one was handed over, and nothing mints a new one
([showing-consolidation.md](showing-consolidation.md)).

|  | What runs | Reaches | Misses |
| --- | --- | --- | --- |
| **🥏 toss** | the page file at the ref, inside a frame | the page's inline code and its library | what the page does to the top-level document, and the FAB, which is the renderer's at main |
| **🥏 toss with `?top`** | the page as the tab's own document | the same, plus the tab and the page's own FAB at its ref | not available with `?w=` or a `#gz=` payload, which keep the frame |

`npm run showing` adds `?top` when a page's diff touches the tab, when the FAB's own
code changed, or when a look link's steps name other pages, and `--top` asks for it
otherwise. [`loader.md`](loader.md)
documents how a toss hands a page its versions.

## Landing on a place

A 🥏 link on any route can carry a look marker in the rendered page's own
fragment, which makes it a look link: `--intro` greets the reader, and `--at`
scrolls to one element, tints it and says why, or walks through several.
`npm run showing` puts the fragment on whichever route the picker chose. The
grammar is in the header of [`lib/kits/look.js`](../lib/kits/look.js);
[`skills/look-markers/SKILL.md`](../skills/look-markers/SKILL.md) says how to
make one and which pages it reaches.

## Nesting

A 🥏 link is served by main's `toss-render.html`, so the deployed shell parses the
address. To preview a branch change to the shell itself, nest it: address the
branch's `toss-render.html` as the page, and pass the page to show as a trailing
fragment. Main's shell runs the branch's shell in a frame, which renders the page
two frames deep. A `?query` reaches the inner shell through the params shim, and
a trailing `#frag` arrives as a real `location.hash`.

The inner shell never becomes the top-level document, so its changes to
`document.title`, the favicon, `history.replaceState` or top-level navigation run
without visible effect. This was found with a favicon change in PR #315. At depth
2 the icon is dimmed twice, and the tab's icon and label describe different
levels; both are correct.

In a nested preview, the FAB (the floating action button every lib page carries)
lists actions from both the framed page and the shell, and the shell's rows carry
a stacked-windows icon.
[`node/test/subject-actions.mjs`](../node/test/subject-actions.mjs) tests how an
action is invoked across the frame boundary.

## Picking versions inside a toss

`#gh=` picks the displayed file. `refs=owner/repo@ref` on the shell's query sets
the version of each repository the page's code reads; it can repeat, and
`@ref:path` narrows it to one file. `?lib=<ref>` does the same for web-tools.
Writes, and the reads pinned to main by design, ignore these selections. `?top`
makes the page the top-level document.
[loader.md](loader.md#the-selection) states the full rules.

## Changes that resist preview

- **The bootstrap.** `lib/gh-api.js` fetches files at a ref, so it cannot be
  fetched that way itself; each page loads it by explicit URL in a hand-written
  boot preamble. A toss reaches a change to a page's preamble, since it serves the
  branch's page file whole. Nothing reaches a change to the shell's preamble,
  because the shell always runs from main.
- **The document boundary.** A framed toss is two documents, the shell and the
  framed page, and each creates its own `gh` loader, whose ref every later load
  uses. The framed page's `gh` uses the Web Tools ref the shell resolved; the
  shell's uses main. So whatever the shell contributes to the view (today the FAB
  and the Alpine bundle) comes from main, whatever the address names. A branch
  change there shows through `?top`, where the page mounts its own FAB.
- **Never pin both documents.** `?use=` on the shell alongside an `@ref` in the
  fragment pins two documents in one view, and on an iPhone that kills Safari's web
  process on the first tap of the FAB, whatever refs are named. The cause is
  unknown; the record is the snag `shell-pin-kills-the-tab`.
- **The shell itself.** `pages/toss-render.html` cannot render itself at the top
  level, so a branch change to it previews by nesting (above).

## The FAB's ref check

Every page that boots lib honors `?use=`, and every one carries the FAB. A page
that pins the ref in its own boot block and ignores the parameter loads
default-branch code under a preview banner. The FAB compares `window.gh.ref` with
the address and says when `?use=` was ignored. Inside a toss it checks the framed
page against the ref the shell resolved, and marks any layer that booted a
different one.

The failures recorded in this file share one shape: the link renders something
plausible but wrong, and reports no error. The mechanism table cannot catch that,
so two checks remain in use: CLAUDE.md's honesty rule ("where no link reaches a
change, say so") and a headless screenshot.

## Viewer context

A toss reads a private repo with the GitHub token saved in the viewer's browser,
and the Claude app's in-app browser may not have one. Without a token, carry the
content in the link: a 🥏
`#gz=` toss carries a page, and the app's `#gz=` carries text files
([stage.md](stage.md#content-the-gz-param)). Or bake the page and publish a 📦
artifact ([artifacts.md](artifacts.md)).

## Subjects and kinds

[`subjects.csv`](subjects.csv) lists the types of subject a viewer can have on
screen: the estate, a repo, a project, a branch, a session, a page, a file, data,
or a fileset. Its `needs` column says whether a subject renders itself or needs a
renderer, and the FAB's layer strip reads its `detect` column to label each layer
by type. A view (`group` in `app-routes.csv`) is not a subject type; it appears as
the label under the subject. Promotion (`appView`) is an attribute of a page, not
a type.

[`routes-kinds.csv`](routes-kinds.csv) lists, for each kind of file, the renderer
that opens it and what a note can be pinned to once it is open. A kind is neither
a subject type nor a route: markdown has no route, and several kinds share the
`data` route. The kinds table joins the subject, mechanism and route tables by
key, and `routes-manifest.test.mjs` checks every join.
