# Extending the toss renderer to the useful preview scenarios

A design assessment, first written 2026-09-27 against web-tools `8574a50` and
revised 2026-09-28 around a narrower objective: **`?use=` and every existing
link keep working, and `pages/toss-render.html` is extended to cover the
rendering and preview scenarios that matter.** Removing or replacing `?use=`
is no longer a goal. Two earlier drafts proposed a `render/` endpoint, a
shared recipe adopted by the app, keyless addresses and an automatic top-level
handoff; what survives of them is listed at the end. Nothing here is
implemented.

The mechanisms are the rows of [`showing-mechanisms.csv`](showing-mechanisms.csv);
the reasoning behind the current boundaries is [`showing.md`](showing.md); the
loader half is [`loader.md`](loader.md). Every claim about current behavior was
checked against the file it names.

## What is being selected

Eight words are in use for what a link shows: the app shell, a view, a page, a
component, a project, a repository, library code, and data. For rendering and
version selection only three questions matter: which document is on top, which
repository each fetched file comes from, and at what ref. The rest are
navigation or attribution concepts that ride on those three.

| Unit | What it is for rendering | Version selected by | Notes from the code |
| --- | --- | --- | --- |
| Repository | the unit of every fetch: the contents API reads `(repo, ref, path)` | `@<ref>` in an address; `?use=`; a declared ref | `GH.get` resolves every path at one `this.ref` (`gh-api.js`, line 321); there is no per-path ref |
| App shell | one page file, `app/index.html`, plus its pre-build `dist/app.js` | the file by Pages (`main`) or a toss; the bundle by `?use=` or the injected `use` | 23 routes in `app-routes.csv`; 21 name lib files, 2 render inline; every one ships in the one bundle |
| View | a route key inside a document (`?view=`, a tenant in the budget-drs app) | none of its own; it selects which code draws, not which version | a navigation concept; `app-routes.csv`'s `files` column is attribution, not a load unit |
| Page | one HTML file, one document, with its own relative files | a toss at `@<ref>` for the file; `?use=` or the injected `use` for the hub lib | the toss inlines relative scripts and styles at the same ref (`inlineRelativeDeps`) |
| Component, kit, library code | files under `lib/` loaded by `gh.load` or served from the pre-build | the loader's one ref | not separately selectable; a component's version is its repo's ref |
| Project | a folder in a repo, a nav concept in the app (`?view=project`), and for budget-drs a page with 21 relative script files | the repo's ref, stamped as `window.__ref` | the budget-drs app reads its own repo's data at `__ref` and seven tenants from four repos, all declared `main` |
| Data | files read at run time: the subject's own repo (relative fetch, rerouted at the subject ref), other repos (absolute API reads at declared refs), and the estate stores | the subject ref for own-repo data; declared refs otherwise | the `fetchShim` reroutes relative reads only; absolute reads are the page's own |

So three roles carry a version, and they map onto repositories:

1. **The subject repository**: the page file, its relative files, and its own
   data. One ref, from the address.
2. **The hub**, `mehrlander/web-tools`: the lib inside the subject. The same
   ref as the subject when the subject is a hub page; `main` otherwise,
   unless the page pins `entry.js?ref=`.
3. **Other repositories the page reads**: tenants and cross-repo data, at
   refs the page declares. No link selects these today.

The layer table from the earlier draft still holds: the host document
(`toss-render.html`, always `main`), the host's own lib (the FAB and Alpine
bundle, `main`), the subject, the subject's files, the hub lib inside the
subject, and the framing app. Only the subject ref and the hub ref are a
caller's to set.

## Three scenarios, grounded

### Preview a page from a branch

What should come from where: the page file, its relative files and its data
from the branch; the hub lib from the same branch when the page is a hub page,
else from `main`. The link:

```
pages/toss-render.html#gh=mehrlander/web-tools@<sha>:pages/session.html#id=2bf8fcae
pages/toss-render.html#gh=mehrlander/home@<sha>:projects/budget-drs/submittal/submittal.html
```

This works today and needs nothing. `showing.py` mints it. Removing the
selection after merge (`@<sha>` gone) gives the deployed page for a hub page
and the toss at `main` for a private one, which is the ordinary result.

### Preview a changed piece within the ordinary app

A changed piece is a lib file: a view's component, a kit. What should come from
where: the app file from `main`, the bundle from the branch, the estate data
from wherever it always comes from. The link:

```
app/?use=<sha>&view=sessions
```

This works today, is the fuller preview (top-level document, the FAB at the
branch, the honesty check running), and `showing.py` mints it. When the app
file itself changed, the toss of the app at the SHA is the link instead, and
the picker already knows. Removing `?use=` after merge gives `app/?view=sessions`,
the ordinary result.

Finer selection, one component at the branch with the rest at `main`, has no
footing: the loader has one ref per document and the pre-build serves from one
ref. It also has no need. A branch that wants the rest of `main` merges `main`
in, and git does the combination.

### Combine a project page, Web Tools code, and private data from independent refs

The real case: the budget-drs app on a home branch `A`, a Web Tools kit it
loads on a web-tools branch `B`, and its data. What should come from where:
the page and its 21 relative scripts from `home@A`; its own-repo data from
`home@A` too, since a data branch and a page branch are the same repo and
usually the same branch; the hub lib from `web-tools@B`; the seven tenants
from their declared `main`.

What works today: the page and data at `A`, and the hub lib at `B` for the two
budget-drs pages that implement a page-level `?lib=` key and pass it as
`entry.js?ref=`. The link:

```
pages/toss-render.html#gh=mehrlander/home@A:projects/budget-drs/app/view/app.html?lib=B
```

What does not work: the same for any other page in another repo. A page that
imports plain `entry.js` gets `use=A` injected by the renderer's params shim,
and `entry.js` reads that as a web-tools ref, so the lib fetch fails at a
commit web-tools does not have. That is the third finding below, and it is
the one gap in the scenario.

Data at a third ref, `C`, in the same repo as the page: not expressible, and
no concrete case asks for it. A data-only branch carries `main`'s page, so
addressing the page at `C` shows exactly the combination wanted. Data or a
tenant in another repo at a branch: not expressible either. The one place it
could arise is a tenant previewed inside the budget-drs frame; the recorded
practice is to toss that tenant on its own, and nothing in the session store
asked for more.

Removing the selections after both branches merge gives the toss at
`home@main` with the hub at `main`: the ordinary result. Removing them after
only one merges gives a mixed result the link cannot warn about, which is
true of `?use=` today and is a reason to mint SHAs and to say in the caption
which branches a link combines.

## Repository-level selection, and the JSON map

Every version a link could usefully carry is a `(repository, ref)` pair, and
the three scenarios use at most two: the subject repo and the hub. A JSON map
of the shape `{"mehrlander/web-tools": "B", "mehrlander/home": "A"}` would
express both and could carry a third for a cross-repo tenant. It is the right
shape if a general mechanism is ever wanted, and the place it would live is
the renderer's `fetchShim`, rewriting the `ref` on any GitHub API or raw URL
whose repo the map names, which needs no cooperation from the page.

It is not warranted now. Two roles need two keys, `@<ref>` on the address and
one for the hub, and both exist in some form. No concrete case needs a third
repo pinned. A map carried on the link is a second grammar beside the address
grammar, it needs an encoding (the fragment holds one key by design), and it
would be read by nobody but the shim. The recommendation is to add the hub key
so that a map could subsume it later without changing any link: `window.__lib`
is, in effect, the map's one entry for the hub.

Ordinary links stay as they are: an address with `@<ref>`, or a deployed page
with `?use=`. The hub key appears only in the cross-repo combination.

## The smallest coherent extension

Six changes, each small, each on its own justification. Together they make
the three scenarios work for every page, keep every link, and restore the one
honesty check the toss route lacks.

1. **A host-side `?lib=<ref>` on the renderer**, stamped into the framed page
   as `window.__lib`, and `lib/entry.js` reading it. Precedence for the hub
   lib inside a framed page: `entry.js?ref=` written by the page; then
   `window.__lib`, stamped only when `?lib=` was given; then `?use=` in the
   page's query, real or injected; then `main`. This is the page-level key
   the two budget-drs pages already implement, lifted to the host so any page
   importing `entry.js` gets it. It does not override a hub subject's
   addressed branch, since `__lib` is never stamped unasked.
2. **Inject `use` only for a hub subject.** The params shim answers `use`
   with the addressed ref only when the subject repo is `mehrlander/web-tools`.
   Any other subject keeps `window.__ref` and gets no `use`. Fixes the third
   finding.
3. **Port the ignored-ref check into the toss.** `fab.js` `ignoredUse` returns
   empty when `viaToss` is true; inside a toss it can read the frame's
   `window.gh.ref` (same-origin in address mode) and compare it with the
   subject ref. Without this, a page whose boot hardcodes `main` renders at a
   branch with `main`'s lib and nothing says so.
4. **Stop minting the shell pin.** `ref-switch.js` `rideUrl` still writes
   `toss-render.html?use=<ref>#gh=…@<ref>:…`, the shape that kills Safari's web
   process on an iPhone, and `docs/show-repo.md` documents it as correct. Drop
   the `?use=` from the generator and correct the paragraph. The renderer
   keeps honoring a `?use=` on its own query, since the 585 recorded links
   work on a desktop and making them inert would change what they show.
5. **`showing.py` mints `?lib=`** when a web-tools lib change is previewed
   through a page in another repo (the declared framing app of a private
   repo), which today it cannot express.
6. **Name the host and frame contract in `showing.md`**: `__fabHosted`,
   `__ref`, `__lib`, the two shims, `__tossSubject` and the mark events, the
   four `__toss*` handles, and the compare-ref bridge. All exist; none is
   listed in one place.

Nothing is renamed, no document moves, no registry collapses. The mechanism
table gains one row (`?lib=`) and one note on the `toss-gh` row.

## What already works, and stays

- Address mode with the injected `use`, so a hub page at a branch runs its lib
  at that branch.
- `?use=` on a deployed page for a lib-only change, with the top-level honesty
  check.
- The app framing a page through the renderer (`?app=`), landings, the atlas.
- Typed routes for data, PDFs and envelopes, and a changed viewer addressed as
  a page (`#gh=web-tools@<sha>:pages/data-view.html?src=…`).
- The nested toss for a renderer change.
- `?w=` for width, the mark announced upward, `__tossLeave` for navigation.
- The picker in `showing.py`, which remains the answer to "which link".

## What survives from the earlier drafts

Kept: the verified account of the two mechanisms and the three ref channels;
the three findings; the corrected library precedence; the host and frame
contract table; the case table's rows for hub pages, private pages, data and
viewers; and the device experiments below.

Dropped, with the reason: the `render/` endpoint and forwarder (a rename,
justified only by the removal objective); the shared recipe adopted by the app
(one document fewer, but a change to five app sites and an unmeasured iPhone
shape, for a nesting nobody has complained about); keyless addresses and the
owner shorthand (length, which the removal of `?use=` from captions no longer
motivates); the automatic top-level handoff and `top=1` (the choice they
replaced is the one `showing.py` already makes, and `?use=` is staying); the
registry collapse.

## Questions that still need an experiment

1. **Does the current renderer survive the FAB tap on an iPhone while framing?**
   The 2026-09-08 matrix's surviving cell loaded the host's modules from
   jsDelivr; the host now uses a native import from Pages plus the contents
   API. `lib/entry.js` asserts survival; no tap after the route change was
   found in the session store.
2. **Which inliner candidate empties the budget-drs app's panes?** The one
   console line in `app-frame-outruns-the-inliner`. Until it is settled the
   third scenario's link renders chrome over empty panes, and the framed
   page on its own is the workaround.
3. **Is the frame's `gh.ref` readable at drawer-open time for every subject
   kind the FAB adopts?** Routed and local subjects have no loader of their
   own; the ported check must stand down there.

## A task, proposed rather than filed

"Extend toss-render: host-side `?lib=`, hub-only `use` injection, the ported
honesty check, and the ref-switch fix", size M, with this document as its
brief. Items 1 through 4 are one pull request; 5 and 6 follow it.
