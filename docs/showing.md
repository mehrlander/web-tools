# Showing: getting a thing in front of a viewer

The estate answers one question in a dozen ways: **something exists somewhere, and someone needs to look at it.** [SURFACING.md](SURFACING.md) is the etiquette that decides what to hand over; the Web Tools app ([APP.md](APP.md) the mission, [show-repo.md](show-repo.md) the shell's reference) is what you hand it from. The one-line split, since "surfacing" and "showing" are near-synonyms in ordinary English and this only holds if it is stated: **surfacing decides what to hand over; showing is what makes it openable.**

> **The reference is the app, not this file.** Every mechanism, the address to write for each, what it reaches and misses, its trap, and the rule for picking one are rows in [`docs/showing-mechanisms.csv`](showing-mechanisms.csv); the three axes they are indexed by and the picker rules are the `showing` block of [`docs/routes.json`](routes.json). Both render in show-repo's **Map view, Showing tab**.

What stays here is what no row can hold: why the boundaries are where they are, and the relations between rows.

## The two mechanisms are inverses

This is the part worth understanding rather than looking up, because it explains why the table has the shape it does. A row can say what one mechanism reaches; only prose can say that two of them reach complementary halves.

|  | Top-level document | Reaches | Misses |
| --- | --- | --- | --- |
| **`?use=`** | main's page file, real | anything **lib** does, top-level chrome included | the page's own inline shell |
| **🥏 nesting** | the branch's shell, but framed | shell internals: routing, mounting, rendering, address parsing | anything the shell does to the **top-level context** |

So a change that is *both* in a page's own inline shell *and* aimed at the top-level document is reachable by neither, and the escape is not a better link but **moving the code**: in a lib module, `?use=` reaches it, since that is the only mechanism swapping code without swapping which document is on top.

The `?use=` half of that table is a consequence of the loader, not a fact about showing. [`loader.md`](loader.md) owns it: what the parameter swaps, why a branch name is cache-safe, the raw-versus-jsDelivr split, and the `window.__ghBlobBoot` global. Read it there rather than here.

## What nesting reaches, and what it cannot

A 🥏 link is served by **main's** `toss-render.html`, so the deployed shell parses the address. Branch work on that page previews by nesting: address the branch's own renderer as the subject and hand it the page you want as a trailing fragment. Main renders the branch's shell, which renders the page two frames deep.

Both halves of an address reach the inner shell for real: a `?query` arrives through the params shim, and a trailing `#frag` rides the frame's `blob:` URL as a genuine `location.hash`. So routing, frame mounting, rendering, and **address-bar parsing** are all previewable.

**What nesting cannot reach is the top-level chrome.** A nested shell really runs, but never as the top-level document, and the tab belongs to whatever document is on top. So a shell change acting on that context executes correctly and shows nothing. The favicon is the case that found this (PR #315): the branch's shell reads its subject's icon and sets it on its own framed document, invisibly, while main's outer shell keeps the frisbee. The rest of the class is `document.title`, `history.replaceState`, and top-level navigation.

At depth 2 the icon arrives dimmed twice and the tab's icon and label describe different levels, both correct and left alone.

## The drawer at depth 2

The FAB around a nested preview shows **both sides, attributed**: `detect()` collects page-contributed actions from the subject as well as the shell, and the shell's rows carry a stacked-windows glyph. That is a preview with a footnote rather than a clean one, so say which rows you mean.

Invoking across the window boundary is handled rather than avoided, and [`tools/test/subject-actions.mjs`](../tools/test/subject-actions.mjs) is the statement of how.

**A toss carries main's lib, including the FAB.** `toss-render.html` is served from main, so the shell around a tossed page comes from main whatever ref the `#gh=` address names, and the FAB you touch is the shell's: the renderer stamps `window.__fabHosted` into the framed page so the inner one declines to mount. A branch change to `lib/alpineComponents/fab.js` is therefore **not visible through a 🥏 link**, and nothing reports the mismatch, because nothing is wrong: the FAB's own `?use=`-was-ignored check does not fire, since no `?use=` was asked for.

**The route that does reach it is the `?use=` pin on a deployed page, with no toss in the address.** Pinning the shell as well was tried and is prohibited: see the document-boundary category below.

## Three reasons a change resists preview

They are felt as one thing, a sense that some code is too central to swap, and
they are three constraints with three different routes.

**The bootstrap.** `lib/gh-api.js` is what fetches a file at a ref, so it cannot
be fetched at a ref by that mechanism: the loader cannot load the loader. Every
page carries a hand-written boot preamble that fetches it by explicit URL, which
is why the preamble is duplicated rather than shared. The toss reaches a change
to it, since the toss serves the branch's page file whole; nothing reaches one to
the **shell's** preamble, which is `toss-render.html` on main.

**The document boundary.** A toss is two documents, and each creates its own `gh`
whose ref every later load resolves against. The framed page's is pinned to the
addressed ref; the shell's is pinned to main. So anything the shell contributes
to the view, loaded at boot or on a tap, comes from main regardless of the
address. Today that is the FAB and the Alpine bundle. This is not about the code
being central: it is ordinary `lib/` code sitting in the other document, and the
route to it is the `?use=` pin on a deployed page instead of a toss.

**Never pin both documents.** `?use=` on the shell alongside an `@ref` in the
fragment pins two documents in one view, and on an iPhone that kills Safari's web
process on the first tap of the FAB, whatever refs are named. Measured, not
explained: SNAGS.md, `shell-pin-kills-the-tab`.

**The renderer's self-reference.** `pages/toss-render.html` cannot render itself
at the top level, so a branch change to it previews by nesting, the `toss-nested`
row, whose reach the section above states.

## The invariant, and the shape of its absence

Every page that boots lib honors `?use=`, and every one carries the FAB. The failure mode when that is only nearly true is silent rather than loud: a page that pins the ref in its own boot block and ignores the parameter loads default-branch code under a preview banner. So the FAB cross-checks `window.gh.ref` against the address and says plainly when `?use=` was ignored, which is the only thing standing between a stale preview and a confident reader.

That is the general shape of every failure recorded on this page: not a link that errors, but a link that renders something plausible and wrong. A mechanism table can tell you which link to write. It cannot tell you that the one you wrote is quietly showing you last week, which is why the honesty rule ("only a page renders this way; for a kit or doc, ⭐ links the `[new]` blob") and the headless screenshot both survive the existence of the table.

## Viewer context

The table's `viewer` axis carries this; the one criterion no row holds is that the Claude app's in-app browser keeps its own storage, so treat `ghToken` as possibly absent there. When it is, bake the page and publish a 📦 artifact, or fall back to 🥏 `#gz=`. Matrix and pipeline: [docs/artifacts.md](artifacts.md).

## What a kind is doing on this tab

The `subject` axis says a file needs a renderer. [`docs/routes-kinds.csv`](routes-kinds.csv) says which file, which renderer, and what a note can be pinned to inside it once it is open. That last clause is why it belongs here rather than beside the annotator: **showing does not end when the pixels land.** A link that reaches a markdown file and a link that reaches a PDF have put the reader in two different places, and what each can do next differs for the same reason the link did.

The boundary that took finding: a kind is neither a page type nor a route. Markdown has no route of its own and is the kind with the most built on it; the `data` route carries five kinds; a PDF has two routes. So the tables join by column and stay separate by key, the arrangement [`registries.md`](registries.md) calls inheriting. The `subject` and `shown_by` cells are checked against the frame and the mechanism table by `routes-manifest.test.mjs`, so the association is a join rather than a resemblance.

