# One public way to show content off the deployed page

A design proposal, written 2026-09-27 against the code at web-tools `8574a50`.
Nothing in it is implemented. It answers one question: can Web Tools offer a
single public mechanism for showing content that is not the normally deployed
page, so that a reader or a session names what to show and which version
without first working out where the code lives? The short answer is yes, at a
known cost, and the cost is stated in [What consolidation costs](#what-consolidation-costs).

The mechanisms it consolidates are the rows of
[`showing-mechanisms.csv`](showing-mechanisms.csv); the reasoning behind the
current boundaries is [`showing.md`](showing.md); the loader half is
[`loader.md`](loader.md). This document does not restate them. Every claim
about current behavior below was checked against the file it names, since
several of the documents were found to describe an earlier state.

## Summary

**Recommendation.** Make the toss renderer, `pages/toss-render.html`, the one
public entry point, addressed by the `owner/repo[@ref]:path` grammar it already
parses. Keep `?use=` as the loader convention every page honors, but stop
minting it in public links: the renderer supplies it to a framed page, as it
does today, and a new host-side flag asks the renderer to hand off to the
deployed page with `?use=` for the two cases a frame cannot reach. The
mechanism choice then moves from the link author into the renderer and
`scripts/showing.py`, where it can be tested.

**What changes for a reader.** One link shape for every case that renders:
`toss-render.html#gh=<repo>@<ref>:<path>`, with `#<route>=` for content that
needs a viewer and `#gz=` for inline HTML. The `?use=` link shape stops
appearing in captions, PR bodies, and the ref switch.

**What does not change.** Every existing link keeps resolving. The address
grammar, the route keys, the payload modes, the owner allowlist, and the sandbox
split between fetched and inline content are all unchanged.

**Three findings worth acting on whether or not the design is adopted.**

1. The ref switch component still mints the link shape that crashes Safari on
   an iPhone (`lib/alpineComponents/ref-switch.js`, `rideUrl`), and
   `docs/show-repo.md` documents that shape as correct. The snag entry and
   `scripts/showing.py` retired it on 2026-09-08; the component did not follow.
2. Inside a toss, the FAB's "`?use=` ignored" check is switched off
   (`fab.js`, `ignoredUse` returns empty when `viaToss` is true). The one
   honesty check `showing.md` says stands between a stale preview and a
   confident reader does not run on the route every branch page is handed over
   on.
3. The renderer's params shim injects `use=<ref>` into every framed page,
   whatever repo the page belongs to. For a page in another repo, `use` then
   names that repo's ref while `lib/entry.js` reads it as a web-tools ref. The
   budget-drs pages avoid the trap with their own `?lib=` key and
   `entry.js?ref=`; any other page in another repo that imports plain
   `entry.js` and is tossed at a branch would try to fetch web-tools at a
   commit that does not exist there.

## What the code does today

### The two mechanisms, as implemented

| | `?use=<ref>` on a deployed page | `#gh=<repo>@<ref>:<path>` on the renderer |
| --- | --- | --- |
| Page file | GitHub Pages, default branch | contents API at `<ref>`, token, owner allowlist |
| Page's own relative `<script src>` and stylesheets | Pages, default branch | inlined from `<ref>` before mounting (`inlineRelativeDeps`) |
| Page's runtime relative `fetch()` | Pages, default branch | rerouted to the contents API at `<ref>` (`fetchShim`) |
| Hub lib (`lib/*` through `gh.load`) | `<ref>`, via `lib/entry.js` | `<ref>` when the page is a web-tools page, because the shim injects `use=<ref>`; `main` otherwise, unless the page pins `entry.js?ref=` |
| Pre-build (`dist/*.js`) | raw at `<ref>`, blob-imported, by a block in each of 10 pages | the same block, reading the injected `use` |
| Top-level document | the page itself | the renderer, on `main` |
| FAB, Alpine bundle around the view | the page's, at `<ref>` | the renderer's, at `main`; the page's declines to mount (`__fabHosted`) |
| Tab title, favicon, address bar, history | the page's | the renderer's; title and icon are announced upward, history calls are made no-ops |
| Private repo | not reachable (no Pages site) | reachable |
| Honesty check when the pin was ignored | `fab.js` `ignoredUse` | disabled |

The last row is not documented anywhere. The check compares the ref asked for
in `location.search` with `window.gh.ref`. Inside a toss the FAB is the
renderer's, its `location.search` is the renderer's, and the code returns empty
before comparing anything.

### How the renderer hands the ref to the framed page's loader

Three channels reach the framed page, and they are not one channel with three
names. All three are stamped by `addressHtml` in `pages/toss-render.html`.

| Channel | Set when | Read by | Means |
| --- | --- | --- | --- |
| `URLSearchParams.prototype.get('use')`, patched to answer `<ref>` when the page's own query has no `use` | the address carried `@<ref>` | `lib/entry.js`, and the 12 pages that read `use` themselves (the pre-build family and `app/index.html`) | for a web-tools page, the hub lib ref; for any other page, whatever that page takes `use` to mean |
| `window.__ref = "<ref>"` | the address carried `@<ref>` | budget-drs `app.html` and `submittal.html`, `doc-audit/viewer` | the subject repo's ref, used for that repo's own data and embeds |
| `entry.js?ref=<ref>` on the import URL, since 2026-09-26 | the page writes it | `lib/entry.js`, which prefers it over `?use=` | the hub lib ref, chosen by the page (budget-drs passes its `?lib=` or an inherited `window.__lib`) |

So the renderer already separates "which version of the subject" from "which
version of the hub code that displays it". The separation is carried by the
page rather than by the address: a web-tools page conflates the two through
`use`, and a page elsewhere has to know to pin `entry.js?ref=` itself.

### What frames what

Four nestings exist, and the FAB's layer strip walks them (`fab.js`,
`readLayers`).

1. **Renderer over page.** `toss-render.html#gh=…`. The common case.
2. **Renderer over a viewer over content.** `toss-render.html#data=…`,
   `#pdf=`, `#chat-results=`, `#shorter=`. The route table pins the viewer to
   `web-tools@main` and hands the content address through `?src=`; the content
   keeps its own ref.
3. **App over renderer over page.** `app/?app=<slug>` or
   `?app=owner/repo@ref:path`. `app/index.html` frames the renderer's `#gh=`
   address (`appViewUrl`); the app's own lib is `main`.
4. **Page over its own tenants.** budget-drs `app.html` carries a second
   inliner (`embedView`, `fetchEmbedText`) and stamps `window.__ref` and
   `window.__lib` into each tenant. The stamped ref wins over each tenant
   descriptor's declared `main`.

Only the first two are the renderer's. The third is the app's and the fourth
is one repo's. Any change to the contract has to be checked against all four.

### Who mints links

| Generator | Shape minted today | Notes |
| --- | --- | --- |
| `scripts/showing.py` | `?use=<sha>` for lib-only changes, `#gh=` for page changes, nested `#gh=` for the renderer, `#gh=` of the framing app for a declared view | the only generator with tests (`showing-pick.test.mjs`) |
| `lib/alpineComponents/ref-switch.js` `rideUrl` | `toss-render.html?use=<ref>#gh=…@<ref>:…` | the shape `shell-pin-kills-the-tab` retired |
| `lib/alpineComponents/fab.js` `tossUrl`, `widthUrl`, `returnToLive`, `renderAtRef` | `#gh=` at the picked ref; `?w=` on the renderer's query; drops `?use=` to return | in a toss, re-addresses in place through `__tossNavigate` and `__tossRoute` |
| `app/index.html` `appViewUrl`, landing, `_go` | `#gh=` at the declared ref | the app never mints `?use=` |
| `bookmarklets/toss-render.js` | `#gz=` | payload only |
| `docs/SURFACING.md`, `surfacing-extended.md`, home `CLAUDE.md` | prose templates for `#gh=`, `#gz=`, `#data=`; `?use=` appears only in the shortening ladder | |
| The session store | 2,753 `#gh=` links, 585 `?use=…#gh=` (the crashing shape, dated 2026-09-05 to 09-09 and a few later), 94 `#gz=`, 47 `#data=` | measured over `web-tools-private/sessions` |

## 1. The unified contract

### One grammar, three axes

The interface has three independent parts, and the design keeps them
independent because collapsing any two is what produces a link that renders
something plausible and wrong.

| Axis | Question | Where it rides | Form |
| --- | --- | --- | --- |
| Subject | what to show, at which version | the fragment | `owner/repo[@ref]:path[?query][#frag]`, or an inline payload |
| Display code | which page draws it | the fragment key | `gh` (the subject draws itself), `data`, `pdf`, `chat-results`, `shorter` (a registered viewer draws it), `gz` (inline HTML) |
| Presentation | how the host shows it | the host's query | `w=<px>` (width), `lib=<ref>` (hub code for a subject outside the hub), `top=1` (hand off to the deployed page) |

The subject address is what a reader or a session writes. The display code is
chosen by the fragment key, and for the two ambiguous file types (a PDF, a
markdown file) the key is the only way to say which viewer is wanted, which is
already how `#data=` and `#pdf=` differ. The presentation axis is the only
place a version selector other than the subject's appears, and it is optional.

### Proposed public forms

```
# a page at a ref, drawn by itself (public or private repo)
https://mehrlander.github.io/web-tools/pages/toss-render.html#gh=mehrlander/home@<sha>:projects/budget-drs/submittal/submittal.html

# the same, opened on the page's own address
…/toss-render.html#gh=mehrlander/web-tools@<sha>:pages/branch.html#gh=mehrlander/web-tools&pr=812

# a page that routes on its query
…/toss-render.html#gh=mehrlander/web-tools@<sha>:app/index.html?view=map&tab=showing

# a data file through the multi-mode viewer
…/toss-render.html#data=mehrlander/home@<sha>:projects/budget-drs/data/rows.csv#item=2

# a PDF through the workbench
…/toss-render.html#pdf=mehrlander/home@<sha>:projects/budget-drs/data/source/…/some.pdf

# inline HTML, for a reader with no token
…/toss-render.html#gz=<base64url of gzipped HTML>

# rendered at a phone's width
…/toss-render.html?w=390#gh=mehrlander/web-tools@<sha>:pages/session.html

# a page in another repo, run against the hub's lib at a branch
…/toss-render.html?lib=<web-tools sha>#gh=mehrlander/home@main:projects/budget-drs/app/view/app.html

# a web-tools lib change that must run at the top level (the FAB, the tab)
…/toss-render.html?top=1#gh=mehrlander/web-tools@<sha>:pages/index.html
```

The last form is the one addition to the grammar with any semantic weight, and
it is discussed under [What still requires the top-level document](#3-what-still-requires-the-top-level-document).
The `lib=` form exists today in budget-drs as a page-level key; the proposal
lifts it to the host so a page does not have to implement it.

### The distinction the grammar preserves

Selecting repository content and selecting the code that displays it are
different choices, and the grammar keeps them in different places:

- `#gh=home@<sha>:submittal.html` selects content **and** the code that draws
  it, because a page draws itself. Its own repo's relative files come from the
  same `<sha>`. That is the sensible default and needs no second selector.
- `#data=home@<sha>:rows.csv` selects content at `<sha>` and display code at
  `web-tools@main`, from the route table. A change to the viewer is shown by
  addressing the viewer as a page: `#gh=web-tools@<sha>:pages/data-view.html?src=home@main:rows.csv`.
  That form works today and needs no new key; the route table's pin to `main`
  is what makes the short form safe.
- `?lib=<ref>` selects the hub's library for a subject that is not in the
  hub. It defaults to `main`, which is what a private repo's pages run against
  when deployed, so an unpinned toss shows what the reader would see.

### How the existing viewers fit

Every registered viewer (`docs/routes-routes.csv`) already reads its content
address fragment-first through `lib/kits/url-params.js`, and the renderer
delivers `?src=` through the params shim. Nothing changes for them. The one
rule to add to the registry is that a viewer is addressed at `main` by its
route key and at any other ref by `#gh=`, so that a viewer change is never
handed over as a `#data=` link.

### Private repositories and inline content

Both are already in the grammar and both keep their trust level. A `#gh=`
address renders same-origin so that the page's own `gh.load` chain and stored
token work, gated by the `OWNERS` allowlist. A `#gz=` payload renders under an
opaque origin so that arbitrary HTML cannot read the token. The proposal adds
no third level and moves nothing across the line. The `top=1` flag is the one
new thing that navigates, and it can only navigate to a Pages URL of an
allowlisted repo, which is a narrower set than `#gh=` already accepts.

## 2. The actual layers

### The minimum boundaries

| Layer | Document | Code comes from | Version selector | Proposed default |
| --- | --- | --- | --- | --- |
| Host | `toss-render.html`, top level | Pages, `main` | none; `?use=` on it is the prohibited shape | always `main`; the host imports `entry.js?ref=main` so a stray `?use=` is inert |
| Host controls | FAB, Alpine bundle, width, layer strip | the host's lib, `main` | none | `main`; a change here is a `top=1` case |
| Subject | the framed page | contents API at the subject ref | `@<ref>` in the address | as addressed |
| Subject's own repo files | relative scripts, styles, fetches | contents API at the subject ref | inherits `@<ref>` | inherits |
| Hub lib inside the subject | `lib/*` via `gh.load`, or `dist/*.js` | raw or contents API | `use` injected (hub page) or `entry.js?ref=` (other repo) | subject ref when the subject is in the hub, else `main`; `?lib=` overrides |
| Viewer (routed content) | `data-view.html` and the others | contents API at `web-tools@main` | the route table | `main`; address the viewer as a page to change it |
| Framing app | `app/index.html` | Pages, `main` | none | `main`; the app is the interface, the subject is the content |

Seven rows, and only two carry a selector a caller can set: the subject ref
and the hub lib ref. That is the whole of "sensible defaults over independent
switches". Everything a reader might want to pin follows from those two.

### Where versions are coupled today

- **`use` couples the hub lib to the subject ref by name.** For a web-tools
  page that coupling is right and cheap. For a page elsewhere it is wrong, and
  it is avoided only by each page knowing to pin `entry.js?ref=`. The proposal
  makes the renderer inject `use` only when the subject repo is the hub, and
  stamp `window.__ref` and `window.__lib` always. `entry.js` then reads
  `window.__lib` before `?use=`, which is one line.
- **The host's lib is coupled to the host's document.** A change to `fab.js`
  or `alpine-bundle.js` is not visible through a toss, and nothing says so.
  The layer strip can say it: the host row carries `main` today, and it should
  carry a mark when the subject is off `main`, reading "the drawer around this
  view is main's".
- **The pre-build is coupled to the commit.** A toss at a SHA of a page that
  imports `dist/web-tools.js` runs the bundle committed at that SHA. The
  commit hook keeps it current; `showing.py` warns when `lib/` moved and
  `dist/` did not. Unchanged.
- **The route table couples every viewer to `main`.** Deliberate, and the
  reason a `#data=` link stays short.

### The whole branch app, or the interface on main with branch content

Both are available today and both survive the proposal; the contract only has
to name them.

- **The whole branch app**: `#gh=mehrlander/web-tools@<sha>:app/index.html?view=sessions`.
  The app's page file and its `dist/app.js` both come from `<sha>`. What is
  not at `<sha>` is the renderer around it and the tab. `showing.py` mints
  this today only when `app/index.html` itself changed; for a lib-only change
  it mints `app/?use=<sha>&view=sessions`. Under the proposal it mints the
  toss in both cases and adds `top=1` when the change needs the top level.
- **The interface on main, content on a branch**: `app/?app=mehrlander/home@<sha>:projects/budget-drs/app/view/app.html`.
  The app frames the renderer, which frames the page at `<sha>`. The title
  and icon come up through `toss-subject-mark`. Unchanged.

The default when a caller names only a subject ref is the first shape for a
hub page and the toss without the app for any other page, which is what the
picker does now.

## 3. What still requires the top-level document

### Browser constraints against design choices

| Concern | Browser constraint or design choice | Today | Proposal |
| --- | --- | --- | --- |
| Tab title | constraint: only the top document owns the tab | host sets `Toss · <name>`; the subject's `<title>` is announced up on `toss-subject-mark`, consumed by the app view, not by the bare host | the host adopts the announced title with a prefix, so a bare toss reads as the page |
| Favicon, home-screen icon | constraint | announced up; the host draws it dimmed; the app draws it undimmed | unchanged |
| Address bar and history | constraint: the frame is a `blob:` document; `pushState` against the stamped `<base>` throws | shimmed to a no-op; the frame's own hash changes are invisible in the address bar | explicit coordination: the host listens to the frame's `hashchange` and mirrors the new fragment into its own `#gh=` address with `replaceState`, so a copied address reopens where the reader was. The fab's Link action already rebuilds the bookmark; this keeps the bar in step |
| Top-level navigation | constraint: sandbox without `allow-top-navigation` | `window.__tossLeave(url)` | name it in the contract table; unchanged |
| Reloading with a new query | constraint: a `blob:` frame cannot re-navigate itself (`reload-control-dies-in-a-toss`) | pages drive state through handles | unchanged; the snag is the rule |
| The FAB | design choice: one FAB per viewport, owned by the host | `__fabHosted` stamp; subject actions collected across the boundary | unchanged; the choice is what gives every toss the same drawer |
| Alpine | neither: each document boots its own | the host's Alpine is `main`'s, the subject's is the subject's | unchanged |
| The host's own boot preamble | design choice: the loader cannot load itself | not previewable except by nesting | unchanged; the nested route stays |
| The subject's boot preamble | none | previewed by the toss, since the page file is fetched whole | unchanged |
| Microphone, popups, forms, downloads | design choice: sandbox flags per trust level | granted in address mode | unchanged |

Only the first three rows are hard constraints, and all three already have a
channel. The proposal names the channels as one contract and extends the
history one.

### The host-frame contract, named

The globals and events below exist and are read by at least two files each.
They are the coordination the question asks about, and the proposal's only
change is to list them in one place (`docs/showing.md` or a new registry) and
add the two rows marked new.

| Handle | Direction | Purpose |
| --- | --- | --- |
| `__fabHosted` | host to frame | the frame's FAB declines to mount |
| `__ref`, `__lib` | host to frame | the subject repo's ref; the hub lib ref (new for the renderer: it stamps `__ref` today, `__lib` only budget-drs does) |
| `URLSearchParams` shim | host to frame | the addressed `?query`, plus `use` for a hub page |
| `fetch` shim | host to frame | relative reads at the subject ref |
| `__tossSubject`, `toss-subject` | frame or host to the FAB | what is on screen |
| `__tossSubjectMark`, `toss-subject-mark` | frame to host and app | title and icon |
| `__tossNavigate`, `__tossRoute`, `__tossLeave`, `__tossWidth` | FAB to host | re-address, route, leave, width |
| `__compareRef`, `web-tools:compare-ref` | host to frame | the drawer's comparison choice |
| `__embedOpen` | app to tenant (budget-drs) | the fragment to open on |
| frame `hashchange` mirrored into `#gh=` | frame to host | new: keep the address bar in step |

### Direct top-level execution, selected by the same entry point

Two cases need the page to be the top-level document with branch code:

1. A change to what the host contributes: `lib/alpineComponents/fab.js`,
   `alpine-bundle.js`, `path-picker.js`, and whatever `gh-boot.js` mounts.
2. A change in a lib module that acts on the top-level document: title,
   favicon, `history`, `location`. `showing.py` already greps a diff for
   this class (`TOP_LEVEL`).

Both are web-tools cases, since only web-tools serves Pages in the estate, and
both are reached today by `pages/<page>.html?use=<sha>`. The proposal is that
the same public entry point selects it: `toss-render.html?top=1#gh=mehrlander/web-tools@<sha>:pages/<page>.html`
makes the renderer check that the repo is the hub and serves Pages, then
navigate to `https://mehrlander.github.io/web-tools/pages/<page>.html?use=<sha>`
with the address's `?query` and `#frag` carried across. Anything else is
refused with the reason on the panel. `?use=` is then an internal operation
of the renderer, minted by it and by `showing.py`, and it never has to be
composed by hand.

What the reader loses on that route is what `?use=` always lost: the page
file is `main`'s. The renderer can say so before navigating, by comparing the
page file's blob SHA at `<sha>` and at `main` (two metadata reads), and
refusing when they differ, since then no link shows the change and the honest
answer is a screenshot. That refusal is the executable form of the `none` row
in the mechanism table.

Whether `top=1` should be selected automatically when a lib-only change is
detected, rather than asked for, is left open. Automatic selection changes
what the address bar shows after the link is opened, and it makes the toss
sometimes not a toss. The recommendation is explicit: `showing.py` writes the
flag when the diff is in the two classes above, and the FAB offers "open at
the top level" whenever the check passes.

## 4. What would prevent consolidation

### The iPhone failure: what is demonstrated and what is not

The record is `shell-pin-kills-the-tab` in [`SNAGS.md`](SNAGS.md), the
retirement is in `scripts/showing.py` and `tools/test/showing-pick.test.mjs`,
and the matrix was run on the device on 2026-09-08.

**Demonstrated.** With `?use=<ref>` on the renderer's own query and a frame
mounted, tapping the FAB kills Safari's web process, whatever the frame holds
and whatever ref is named. The same pin with no frame survives. A frame under
an unpinned renderer survives with the subject pinned by `@<ref>`.

**Not demonstrated, and stated as if it were.** `lib/entry.js` says the
renderer "survives" the native import route "and dies on the blob route,
measured on the device". The measurement predates the route change of
2026-09-26. On 2026-09-08 the surviving cell loaded the host's modules from
jsDelivr; today the unpinned host imports `gh-api.js` natively from Pages and
then reads every module through the contents API, which is closer to the
crashing cell than the surviving one was. No record of a tap on the current
default was found in the session store. That is the first experiment below.

**Not established: the mechanism.** Eight candidate causes were tried and
withdrawn; the fix rests on the measurement. Two candidates have not been
named in the record and are cheap to test: the host's `URL.revokeObjectURL`
of its own blob-imported `gh-api.js` while the frame is itself a `blob:`
document, and `cache: 'no-store'` on the raw fetch. Neither is asserted here.

**What it means for the design.** The prohibited shape is a host-side pin
while framing. The proposal removes the shape by construction: the host
imports `entry.js?ref=main`, which `entry.js` already prefers over `?use=`,
so a `?use=` on the host's query becomes inert. That also defuses the 585
recorded links and the ref switch's output without touching either. The cost
is that the host's own lib can never be previewed through a toss, which is
already true in practice and is the `top=1` case.

### The trust boundary

Nothing in the proposal moves content across the fetched-versus-inline line.
The owner allowlist, the same-origin sandbox for `#gh=`, the opaque sandbox
for `#gz=`, and the refusal of `#gh=` for any other owner all stay. The two
additions, `?lib=` and `?top=1`, are read by the host from its own query and
act only on allowlisted repos: `lib=` chooses a ref of `mehrlander/web-tools`
and `top=1` navigates to a `mehrlander.github.io` URL. A crafted link cannot
use either to reach a repo the allowlist refuses.

### The disabled honesty check

`fab.js` `ignoredUse` returns empty inside a toss. So a page that hardcodes
`main` in its boot (`page-skips-the-loader-ignores-use`) renders through a
toss at `<sha>` with the page file at `<sha>` and the lib at `main`, and the
drawer says nothing. This is not a new failure the proposal introduces; it is
one the proposal would make the only route for. It has to be ported before
the `?use=` route is retired from ordinary use: inside a toss the FAB can read
`window.__tossFrame.contentWindow.gh.ref` (same-origin in address mode) and
compare it with the subject ref, and say "the page's loader booted `main`"
when they differ.

### The unresolved inliner failure

`app-frame-outruns-the-inliner` (2026-09-17): a toss of budget-drs's app draws
the chrome and empty panes, while the same views tossed on their own render.
The cause is unsettled and one console line separates the two candidates.
`showing.py` prints the app route regardless. The proposal inherits this, and
it is the second experiment below. It does not block the design, since the
app is one subject among many, but it blocks retiring the "hand over the
framed page on its own" workaround in home's `CLAUDE.md`.

### The `use` name

`use` means "the ref to pin the hub lib to" in `entry.js` and "the ref of
whatever repo this page is in" in the params shim. The two readings agree
only for web-tools pages. Consolidation does not require renaming `use`; it
requires the renderer to stop injecting it for pages outside the hub and to
stamp `__lib` instead. The name can stay as the internal loader key.

## 5. Migration

### Existing links

| Link shape | Count in the session store | After the change |
| --- | --- | --- |
| `#gh=`, `#data=`, `#pdf=`, `#chat-results=`, `#shorter=`, `#gz=` | about 2,900 | unchanged |
| `toss-render.html?use=<ref>#gh=…` | 585 | still resolves; the host pin becomes inert, so the link stops crashing an iPhone and renders exactly what its fragment names |
| `toss-render.html?w=…` | 13 | unchanged |
| `pages/<page>.html?use=<ref>` | not counted; minted by `showing.py` for lib-only changes until now | still honored by every page; no longer minted |

### Direct `?use=` usage

Twelve pages and `app/index.html` read `use` themselves for the pre-build
family, and `lib/entry.js` reads it for everyone else. All of that stays. The
pre-build blocks also stay, since a toss at `<sha>` reaches them through the
injected `use`. `use-boot-block.test.mjs` continues to hold their shape.

### Generators

| Generator | Change |
| --- | --- |
| `scripts/showing.py` | the `use` mechanism becomes the toss at the SHA; the `TOP_LEVEL` and host-lib classes add `?top=1`; `none` becomes the refusal case the renderer can also produce; fixtures in `showing-pick.test.mjs` updated |
| `ref-switch.js` `rideUrl` | drop `?use=`; keep `#gh=…@<ref>` and the deep link; `ref-switch.test.mjs` updated |
| `fab.js` | `widthUrl` unchanged; layer strip marks the host row; `ignoredUse` ported into the toss; an "open at top level" row when eligible |
| `app/index.html` | unchanged |
| `docs/show-repo.md`, ref switch paragraph | corrected now, independent of the rest |

### Map, Showing tab

`showing-mechanisms.csv` collapses from eight rows to six: `hosted`,
`toss-gh`, `toss-route` (the typed tosses, absent today), `toss-gz`,
`artifact`, and `top` (the former `use` row, reached through the renderer).
`toss-app` and `toss-nested` become notes on `toss-gh`, since both are
`#gh=` addresses of a particular page. The `none` row survives as the
renderer's refusal. The picker in `routes.json` reduces to three rules: a
declared framing app takes the app; anything else takes the toss at the SHA;
a diff in the top-level class adds `top=1`. `routes-manifest.test.mjs`
already holds the CSV to `routes.json`.

### Documentation

- `showing.md`: the section "The two mechanisms are inverses" is replaced by
  a section on the two selectors and the `top` handoff. The nesting section,
  the three reasons a change resists preview, and the honesty rule stay.
- `loader.md`: `?use=` is described as the loader's internal convention,
  supplied by the renderer or by `top=1`, and `entry.js` gains the `__lib`
  read.
- `CLAUDE.md`, "Showing": the section already says run the script rather than
  read; the prose about the `?use=` trap shrinks to a pointer.
- home `CLAUDE.md`, "Render path": unchanged in substance; the app-frame
  exception paragraph goes when the inliner failure is settled.
- `SURFACING.md`: the toss line is unchanged. `surfacing-extended.md`'s
  shortening ladder loses its first row.
- `SNAGS.md`: entries stay as records. `shell-pin-kills-the-tab` gains a
  sighting line when the ref switch is fixed.

### Where the proposed mechanism would show something plausible without running the intended version

| Case | What appears | Why it is wrong | Guard |
| --- | --- | --- | --- |
| A lib-only change shown by a toss at `<sha>` | the page, correctly, with `main`'s drawer around it | a change to `fab.js` or the Alpine bundle is not there | layer strip marks the host row; `showing.py` adds `top=1` for those paths |
| A page whose boot hardcodes `main`, tossed at `<sha>` | the page file at `<sha>`, lib at `main` | the loader ignored the injected ref | the ported `ignoredUse` check |
| A page in another repo tossed at that repo's branch, importing plain `entry.js` | today: a boot failure, white page under `x-cloak` | `use` is read as a web-tools ref | inject `use` only for hub pages; stamp `__lib`; `entry.js` reads it |
| A toss at a branch name rather than a SHA | the branch as it was when the browser cached it | branch names move | unchanged rule: mint SHAs (`use-ref-stale-bundle`) |
| A toss at `<sha>` of a page importing a pre-build, when `dist/` was not rebuilt | old lib | the bundle at `<sha>` is stale | `showing.py`'s existing `build:lib` warning |
| `#gz=` of a page with relative dependencies | the page without them | payloads carry one file | documented; the panel could name the unresolved `src`s |
| A `top=1` handoff when the page file differs between `<sha>` and `main` | `main`'s page with `<sha>`'s lib | the page change is lost | the renderer compares blob SHAs and refuses |
| A toss of the budget-drs app at a home branch | chrome and empty panes | unsettled | experiment 2; until then hand over the framed page |

## Representative cases

| Case | Today | Proposed link | Reaches | Misses |
| --- | --- | --- | --- | --- |
| Hub page file changed | `#gh=web-tools@sha:pages/x.html` | same | page, its lib, its pre-build | tab, host drawer |
| Hub lib-only change (a kit a page loads) | `pages/x.html?use=sha` | `#gh=web-tools@sha:pages/x.html` | the same code path, in a frame | tab, host drawer |
| Hub lib change to the FAB or a top-level effect | `pages/x.html?use=sha` | `?top=1#gh=web-tools@sha:pages/x.html` | everything, at the top level | the page file, which the renderer confirms is unchanged first |
| App view changed in lib | `app/?use=sha&view=map` | `#gh=web-tools@sha:app/index.html?view=map` | the app at sha | tab, host drawer |
| Private repo page at a branch | `#gh=home@sha:…/submittal.html` | same | page, its repo's files at sha, hub lib at main | nothing new |
| Private repo page against a hub lib branch | page-level `?lib=` (budget-drs only) | `?lib=<wt sha>#gh=home@main:…/app.html` | hub lib at the branch inside the page | host drawer |
| Framed view of a private app | `#gh=home@sha:…/app.html?view=submittal` | same | the app carrying the view | pixels headless; unresolved inliner failure |
| Interface on main, content on a branch | `app/?app=home@sha:…/app.html` | same | the app's chrome around branch content | nothing new |
| Data file | `#data=home@sha:rows.csv` | same | the viewer at main over content at sha | a viewer change |
| Viewer changed | not in the table | `#gh=web-tools@sha:pages/data-view.html?src=home@main:rows.csv` | the viewer at sha | nothing new |
| Renderer changed | nested `#gh=` | same | routing, mounting, parsing | top-level effects |
| Tokenless reader | `#gz=` or an artifact | same | any reader | relative dependencies |
| Show-repo at a branch, keeping the deep link | `?use=ref#gh=…@ref:app/index.html?view=…` (crashes) | `#gh=web-tools@ref:app/index.html?view=…` | the app at the ref | host drawer |
| Phone width | `?w=390#gh=…` | same | layout at that width | pointer and hover |

## What consolidation costs

- **One route becomes two documents where it was one.** A lib-only change
  that a reader now opens at the top level opens in a frame, with the host's
  drawer around it. For the common case that is a better preview, since the
  page file is fetched at the same SHA. For the FAB and top-level classes it
  is a worse one, which is why `top=1` exists rather than the `?use=` route
  being deleted.
- **A check has to be ported.** The ignored-ref check is the price of making
  the toss the only route; without it the consolidation is a regression in
  honesty.
- **Two experiments have to be run on a device.** The iPhone measurement
  against the current default, and the inliner failure. Neither can be settled
  from the sandbox.
- **Six documents and four generators change.** Listed above. None is large.
- **Nothing is deleted.** `?use=` remains the loader convention, and every
  page keeps honoring it, because the renderer depends on it to pin the
  framed page's lib. The consolidation is a change in who writes the
  parameter, not in whether it exists.

The alternative, keeping both public routes and teaching the choice better,
has been tried three times in prose and once as a script, and the script is
the only one that held. The proposal moves the remaining choice into the same
script and into the renderer, where tests can reach it.

## Staged plan and verification

Each stage is one pull request and is independently useful. Stage 1 ships
before anything else and is worth shipping alone.

**Stage 0: two device experiments** (no code). Recorded in `SNAGS.md` under
the existing entries.

1. On an iPhone, open the current default host framing a twenty-line page
   (`#gh=` at `main`) and tap the FAB. Then the same with a `?use=main` pin
   on the host. Then the pin with `entry.js?ref=main` forced in the host's
   module script, which is the proposed inert form. Three taps settle whether
   the current route survives and whether the inert pin is inert.
2. In the frame's console on a toss of budget-drs's app, run the one line the
   snag names. The answer routes the fix to the inliner or to `embedView`.

**Stage 1: make the renderer safe and honest, changing no link shape.**

- The host's module script imports `entry.js?ref=main`. A `?use=` on the
  host is thereby inert. Test: a static read of `toss-render.html` in
  `use-boot-block.test.mjs`, plus a headless scenario that opens the host with
  `?use=<other>` and asserts `window.gh.ref === 'main'`.
- `addressHtml` injects `use` only when the subject repo is `mehrlander/web-tools`,
  and always stamps `__ref` and `__lib` (from `?lib=`, default `main`).
  `entry.js` reads `window.__lib` before `?use=`. Test: extend
  `toss-inline-deps.test.mjs`'s pattern with the stamped prelude for a hub
  page and a foreign page.
- `fab.js` `ignoredUse` reads the frame's `gh.ref` inside a toss. Test: a case
  in `fab-toss.test.mjs` with a stub frame whose `gh.ref` differs from the
  announced subject.
- The layer strip marks the host row when the subject is off `main`. Test:
  `fab-layers.test.mjs`.
- `ref-switch.js` `rideUrl` drops `?use=`; `docs/show-repo.md` corrected.
  Test: `ref-switch.test.mjs`.
- The host mirrors the frame's `hashchange` into its `#gh=` address. Test: a
  headless scenario through `npm run shot -- pages/toss-render.html --hash 'gh=…:pages/data-view.html…'`
  that changes the frame's hash and reads the host's `location.hash`.

**Stage 2: the generators.** `showing.py` mints the toss for lib-only changes
and adds `top=1` for the two classes; fixtures in `showing-pick.test.mjs`
change accordingly. The `none` outcome is kept for a page-file change in the
top-level class, with the refusal text unchanged.

**Stage 3: the `top=1` handoff.** The renderer reads `top`, checks the repo is
the hub and serves Pages (`repoInfo` already asks), compares the page's blob
SHA at the address ref and at `main`, and navigates or refuses. The FAB offers
the row when the check passes. Test: a headless scenario that intercepts the
navigation and asserts the target URL; a unit test on the eligibility
function, extracted to a kit so it can be imported.

**Stage 4: registries and documents.** `showing-mechanisms.csv`,
`routes.json`'s picker, `showing.md`, `loader.md`, `CLAUDE.md`,
`surfacing-extended.md`. `routes-manifest.test.mjs` and
`docs-registry.test.mjs` hold the shapes. The Map view's Showing tab renders
the new rows with no code change.

**Stage 5: sunset of the public `?use=` shape.** Nothing to remove. A search
of the session store for newly minted `pages/*.html?use=` links, three weeks
after Stage 2, is the check that the generators are the only writers.

### Verification that stands on its own

- `npm test` at each stage, and the named test files above.
- `npm run showing` on a branch that changes only a kit, then only a page,
  then only `fab.js`: three lines, each pasted into a headless shot with
  `--ref` and read for the loaded ref in `window.__loadedScripts`.
- The device taps of Stage 0, recorded with the case tag the FAB's crash
  report carries.

## Uncertainties that need a focused experiment

1. **Does the current default host survive the FAB tap on an iPhone while
   framing?** The record says the pinned host dies and an unpinned one
   survived on 2026-09-08, when the unpinned host used jsDelivr. The unpinned
   host now uses a native import from Pages plus the contents API. Stage 0,
   experiment 1.
2. **Is a `?use=` on the host inert once the host imports `entry.js?ref=main`,
   on the device?** Same matrix, one more cell. If the crash follows the
   parameter's presence rather than the blob import, the proposal's defusing
   of the 585 recorded links does not hold and those links need a redirect
   instead.
3. **Which of the two inliner candidates empties the budget-drs app's panes?**
   Stage 0, experiment 2.
4. **Is the frame's `gh.ref` readable at drawer-open time in every case the
   FAB adopts a subject?** The routed and local subjects have no loader of
   their own; the check must stand down there rather than report a mismatch.
   A jsdom test can hold the three shapes, and one headless open of each
   confirms it.
5. **Should `top=1` be selected automatically for a lib-only change, or only
   when asked for?** A design choice rather than a measurement. The
   recommendation above is explicit selection by the script and an offer in
   the FAB; the alternative should be tried on one branch before the rule is
   written down.

## A task, proposed rather than filed

Per the tracker convention a task is proposed here and filed only on a go:
"Consolidate showing on the toss renderer", size L, with Stage 1 as the first
deliverable and this document as its brief. Stage 0's two experiments are the
task's opening step and need the device.
