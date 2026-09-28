# One public way to show content off the deployed page

A design proposal, first written 2026-09-27 against web-tools `8574a50` and
revised 2026-09-28 around a shared renderer and a `render/` endpoint. Nothing
in it is implemented. It answers one question: can Web Tools offer a single
public mechanism for showing content that is not the normally deployed page,
so that a reader or a session names what to show and which version without
first understanding the loading and framing machinery? The answer is yes, at
the cost stated in [What it costs](#what-it-costs).

The mechanisms it consolidates are the rows of
[`showing-mechanisms.csv`](showing-mechanisms.csv); the reasoning behind the
current boundaries is [`showing.md`](showing.md); the loader half is
[`loader.md`](loader.md). Every claim about current behavior below was checked
against the file it names, since several documents were found to describe an
earlier state.

## Summary

**The design.** One rendering recipe, `lib/render.js`, used by two documents:
a light endpoint, `render/`, which replaces `pages/toss-render.html`, and the
app, which frames pages through the recipe directly instead of framing the
renderer page. A caller writes an address and, when relevant, a version:

```
render/#owner/repo@<ref>:<path>          a page or a file, at a version
render/?lib=<ref>#owner/repo:<path>       the same, drawn with Web Tools at <ref>
render/#gz=<payload>                      inline HTML, untrusted
```

The endpoint chooses the viewer by file kind, chooses between a frame and a
top-level handoff by what the frame can and cannot show, and nests a branch
copy of itself when the display code is what changed. Route keys and `?use=`
survive as accepted spellings and as internal operations; neither is written
by hand.

**What changes for a reader.** The address is shorter and keyless, one
parameter (`lib=`) covers every "test the display code" case, and the choice
between a toss and `?use=` is gone from ordinary use.

**What does not change.** Every existing link resolves. The address grammar,
the payload modes, the owner allowlist, the two sandbox levels, and the
loader's `?use=` convention all stay.

**Three findings that stand on their own.**

1. The ref switch still mints the link shape that crashes Safari on an iPhone
   (`lib/alpineComponents/ref-switch.js`, `rideUrl`), and `docs/show-repo.md`
   documents that shape as correct. `scripts/showing.py` retired it on
   2026-09-08.
2. Inside a toss the FAB's "`?use=` ignored" check is switched off
   (`fab.js`, `ignoredUse` returns empty when `viaToss` is true).
3. The renderer's params shim injects `use=<ref>` into every framed page,
   whatever repo the page belongs to. For a page outside the hub, `use` then
   names that repo's ref while `lib/entry.js` reads it as a web-tools ref.

## What the code does today

### The two mechanisms, as implemented

| | `?use=<ref>` on a deployed page | `#gh=<repo>@<ref>:<path>` on the renderer |
| --- | --- | --- |
| Page file | GitHub Pages, default branch | contents API at `<ref>`, token, owner allowlist |
| The page's relative scripts, stylesheets and `fetch()` calls | Pages, default branch | inlined or rerouted at `<ref>` |
| Hub lib (`lib/*` through `gh.load`) | `<ref>`, via `lib/entry.js` | `<ref>` for a web-tools page, because the shim injects `use=<ref>`; `main` otherwise, unless the page pins `entry.js?ref=` |
| Pre-build (`dist/*.js`) | raw at `<ref>`, blob-imported, by a block in each of 10 pages | the same block, reading the injected `use` |
| Top-level document | the page | the renderer, at `main` |
| FAB and Alpine bundle around the view | the page's, at `<ref>` | the renderer's, at `main` |
| Tab title, favicon, address bar, history | the page's | the renderer's; title and icon announced upward; history calls made no-ops |
| Private repo | unreachable | reachable |
| Honesty check when the pin was ignored | `fab.js` `ignoredUse` | disabled |

### The three channels that hand a framed page its ref

All three are stamped by `addressHtml` in `pages/toss-render.html`.

| Channel | Read by | Means |
| --- | --- | --- |
| `URLSearchParams.prototype.get('use')`, patched to answer `<ref>` | `lib/entry.js`; the 12 pages reading `use` themselves | the hub lib ref for a web-tools page; for any other page, whatever that page takes `use` to mean |
| `window.__ref` | budget-drs `app.html` and `submittal.html`, `doc-audit/viewer` | the subject repo's ref, for its own data and embeds |
| `entry.js?ref=<ref>` on the import URL (since 2026-09-26) | `lib/entry.js`, which prefers it over `?use=` | the hub lib ref, chosen by the page (budget-drs passes its `?lib=` or an inherited `window.__lib`) |

### What frames what

The app, `app/index.html`, boots its 4.9 MB pre-build and then frames
`pages/toss-render.html` in an iframe for every live view it shows: app views
(`?app=`), a repo's landing, a project's landing, the atlas, and the gallery
thumbnails (five `<iframe :src>` sites). A promoted page in the app is
therefore three documents deep. The app also accepts the address grammar as
its own key, `app/?app=owner/repo@ref:path`, for any allowlisted file, which
makes it a second public render entry today. budget-drs's `app.html` carries a
third copy of the inline-and-stamp recipe (`embedView`, `fetchEmbedText`) for
its own tenants.

### Who mints links

`scripts/showing.py` (the only generator with tests); `ref-switch.js`
`rideUrl` (the crashing shape); `fab.js` (`tossUrl`, `widthUrl`,
`returnToLive`, `renderAtRef`); `app/index.html` (`appViewUrl`, landings);
`bookmarklets/toss-render.js` (`#gz=`); the prose templates in
`SURFACING.md`, `surfacing-extended.md` and home's `CLAUDE.md`. The session
store holds about 2,900 fragment-addressed links and 585 with the retired
`?use=` shell pin.

## The design

### The endpoint and the recipe

`lib/render.js` is one plain script body: no `import`, no Alpine, no loader
dependence, so it runs from a static `<script src>` and folds into the
pre-build unchanged. It carries the recipe now spread through
`toss-render.html`: parse an address or payload, fetch at a ref, inline the
subject's relative dependencies, stamp the prelude (`<base>`, the params and
fetch shims, `__ref`, `__lib`, `__fabHosted`, the history and hash shims),
mount on a blob URL with the sandbox for its trust level, announce the
subject and its mark, and decide the viewer and the top-level handoff. It
also carries the route table, inline, mirrored to `routes.json` by the
existing test.

`render/index.html` is the endpoint: about two hundred lines. It includes
`kits/repo-address.js` and `render.js` statically, reads its fragment and
query, calls the recipe, applies `?w=`, and loads the FAB afterwards through
`entry.js?ref=main`. With no address it shows one line and a link to the
app; the clipboard viewer moves to the app's Stage, which already takes
clipboard content. `pages/toss-render.html` becomes a forwarder that carries
its query and fragment to `render/`.

`app/index.html` calls the recipe at its five iframe sites: fetch, stamp and
mount the page into its own frame. The renderer document between the app and
the page goes away.

### What a caller specifies

| Intent | Write | Default when omitted |
| --- | --- | --- |
| Show a page or a file | `render/#owner/repo:path` | the repo's default branch; a viewer by file kind |
| At a version | `@<ref>` after the repo | default branch |
| Inline content | `render/#gz=<payload>` | |
| Test changed display code | `render/?lib=<ref>#…` | the subject's ref when the subject is a web-tools page; `main` for everything else |
| Force a viewer | `render/#<route>=…` | the kind's viewer from `routes-kinds.csv` |
| A width | `render/?w=<px>` | the device |

Nothing else is public. The endpoint reads `#gh=`, `#html=`, `#url=` and a
`?use=` on its own query for compatibility, and the last is inert.

### Viewer selection, chosen internally

`routes-kinds.csv` already maps a file kind to its renderer. A keyless
address resolves through it: an `.html` file draws itself, `.csv`, `.json`
and `.md` go to `data-view.html`, a `.pdf` goes to `data-view.html`'s first
look. The route key remains the override, and it is needed in two places: the
PDF workbench (`#pdf=`), and the envelope routes (`#chat-results=`,
`#shorter=`), whose caller produced the envelope and so already knows the
route. What a caller no longer needs to know is that data is "routed" at all.

### Top-level execution, chosen internally

A frame cannot show what a change does to the tab or to the host's own FAB.
Today that class is reached by writing `pages/<page>.html?use=<sha>` by hand.
The endpoint can decide it instead, on one test: **the subject's own files
are unchanged at the addressed ref.** Concretely, the page file and every
relative static dependency the inliner would fetch have the same blob SHA at
`<ref>` and at the default branch, the repo is `mehrlander/web-tools`, and
the repo serves Pages. When the test passes, nothing in the frame would
differ from the deployed page except the lib, so the endpoint navigates to
`https://mehrlander.github.io/web-tools/<path>?use=<ref>` with the address's
`?query` and `#frag` carried across. The reader gets the fuller preview: the
tab, the FAB at `<ref>`, and the existing top-level honesty check. When the
test fails, the frame is the only route that shows the page file, and the
endpoint frames.

`?w=` forces the frame, since the width is a frame. A nested endpoint never
hands off, since it is not the top. The test costs two to a handful of
metadata reads on the public hub, made with the stored token when there is
one.

What this asks of a caller: nothing. What it asks of `showing.py`: nothing
new, since it mints the same address either way. What it loses: the `top=1`
flag proposed on 2026-09-27, which required the caller to know which files
the host contributes. Whether the automatic choice reads well in practice,
with the address bar changing after the link is opened, is the one design
question left for a trial rather than an argument.

### Display code, chosen with one parameter

`?lib=<ref>` means "draw this with Web Tools at `<ref>`", and the endpoint
applies it at the outermost point that can honor it:

- When `<ref>` is the default branch, or is omitted: the endpoint renders as
  itself. A web-tools subject gets `use=<subject ref>` injected; any other
  subject gets no `use` and no `__lib`, so its loader defaults to `main`.
- When `<ref>` is anything else: the endpoint renders `web-tools@<ref>:render/index.html`
  as its subject and hands the original address down as that page's fragment.
  The nested endpoint's relative `../lib/render.js` is inlined at `<ref>`,
  its route table resolves viewers at `<ref>`, and it stamps `__lib=<ref>`
  into a subject outside the hub. One knob covers a viewer change, a recipe
  change, and a foreign page against a hub lib branch, and the mechanism that
  does it is the nested toss the table already lists, chosen by the endpoint.

An endpoint therefore has a **self ref**: `main` when served from Pages, and
`window.__ref` when it was itself rendered as a subject. Routes resolve at
the self ref, which replaces the `main` hard-coded in the route table.

### Library precedence, corrected

The 2026-09-27 draft said the renderer should "always stamp `__ref` and
`__lib` (from `?lib=`, default `main`)" and that `entry.js` should read
`__lib` before `?use=`. Together those two lines would pin every web-tools
subject's lib to `main`, overriding the addressed branch. The rule is instead:

| Precedence for the hub lib ref inside a framed page | Set by |
| --- | --- |
| 1. `entry.js?ref=<ref>` on the import URL | the page itself |
| 2. `window.__lib` | the host, **only** when a `?lib=` was given or the host is a nested endpoint off `main`; never stamped otherwise |
| 3. `?use=` in the page's query, real or injected | the host injects it only for a web-tools subject, and only into an absent key |
| 4. `main` | |

Under that order a web-tools page at branch B with no `?lib=` runs its lib at
B through the injected `use`, a foreign page runs `main`, and
`?lib=A#web-tools@B:pages/x.html` runs the page file at B with the lib at A,
which is the one two-ref case anyone has asked for. `window.__ref` is
stamped whenever a ref was addressed, as today.

### Boundaries that disappear, and boundaries that remain

| Boundary | Fate | Why |
| --- | --- | --- |
| The renderer document between the app and a framed page | goes | the app runs the recipe; one document fewer, one layer-strip row fewer, no mark relay |
| The renderer's inline copy of the address grammar | goes | the endpoint includes `kits/repo-address.js` statically |
| The route table's hard-coded `main` | goes | routes resolve at the self ref |
| `top=1` and hand-written `?use=` links | go | chosen internally |
| The renderer page as a catalogued tool | goes | the endpoint has no empty-state UI; the clipboard viewer lives in the Stage |
| Endpoint document against app document | stays | a render link is opened on a phone from chat and must not pay the app's boot; the endpoint fetches the subject before loading anything of its own |
| Host document against subject frame | stays | the sandbox levels and the tab are properties of documents, not of code |
| Hub subject against foreign subject | stays | one gets its lib from the address, the other from `main` or `?lib=` |
| budget-drs's own tenant inliner | stays, for now | another repo's code; it can adopt `render.js` through `gh.load` in its own change |
| The loader's `?use=` convention | stays | it is how the recipe and the handoff pin a page's lib; only the hand-written link goes |

### The host and frame contract

The handles below exist and are read by at least two files each; the
proposal lists them in one place and adds the last row.

| Handle | Direction | Purpose |
| --- | --- | --- |
| `__fabHosted` | host to frame | the frame's FAB declines to mount |
| `__ref`, `__lib` | host to frame | the subject repo's ref; the hub lib ref when chosen |
| `URLSearchParams` and `fetch` shims | host to frame | the addressed `?query`, the injected `use`, relative reads at the ref |
| `__tossSubject`, `toss-subject` | frame or host to the FAB | what is on screen |
| `__tossSubjectMark`, `toss-subject-mark` | frame to host | title and icon |
| `__tossNavigate`, `__tossRoute`, `__tossLeave`, `__tossWidth` | FAB to host | re-address, route, leave, width |
| `__compareRef`, `web-tools:compare-ref` | host to frame | the drawer's comparison choice |
| frame `hashchange` mirrored into the host's address | frame to host | new: a copied address reopens where the reader was |

Three constraints are the browser's and keep their channels: the tab (title,
icon), the address bar and history, and top-level navigation from a sandboxed
frame. Everything else in the table is a design choice, kept because it gives
every render the same drawer.

## Representative cases

`W` is `mehrlander/web-tools`, `H` is `mehrlander/home`, `s` a commit SHA.
"Faithful" means the proposed link runs the version it names for every part a
reader would look at.

| Case | Today | Proposed | Endpoint does | Faithful |
| --- | --- | --- | --- | --- |
| Hub page file changed | `#gh=W@s:pages/x.html` | `render/#W@s:pages/x.html` | frames; lib at `s` via injected `use` | yes |
| Hub lib-only change | `pages/x.html?use=s` | `render/#W@s:pages/x.html` | files unchanged at `s`, hands off to `pages/x.html?use=s` | yes, and the tab and FAB are at `s` |
| Hub page and lib changed together | `#gh=W@s:pages/x.html` | same address | frames; both at `s` | yes |
| A change to `fab.js` only | `pages/x.html?use=s` | same address | hands off | yes |
| A change to `fab.js` and to the page file | none | same address | frames; the drawer is `main`'s | no, as today; the layer strip must say so |
| Private page at a branch | `#gh=H@s:…/submittal.html` | `render/#H@s:…/submittal.html` | frames; hub lib `main` | yes |
| Private page against a hub lib branch | budget-drs's own `?lib=` | `render/?lib=s#H:…/submittal.html` | nests the endpoint at `s`, which stamps `__lib=s` | yes, and for any page importing `entry.js` |
| Data file | `#data=H@s:rows.csv` | `render/#H@s:rows.csv` | viewer by kind, at the self ref | yes |
| Viewer changed | `#gh=W@s:pages/data-view.html?src=…` | `render/?lib=s#H:rows.csv` | nests at `s`; routes resolve at `s` | yes |
| Recipe or endpoint changed | nested `#gh=` | `render/?lib=s#H:…/page.html` | nests at `s`; `../lib/render.js` inlined at `s` | routing, mounting, parsing yes; the endpoint's own tab handling no, as today |
| The app at a branch, deep link kept (ref switch) | `?use=r#gh=W@r:app/index.html?view=map` (crashes) | `render/#W@r:app/index.html?view=map` | hands off to `app/?use=r&view=map` when the app file is unchanged, else frames | yes |
| Interface on main, content on a branch | `app/?app=H@s:path` | same | the app frames the page through the recipe | yes |
| Inline HTML | `#gz=…` | `render/#gz=…` | opaque frame | yes; relative dependencies missing, as today |
| Phone width | `?w=390#gh=…` | `render/?w=390#W@s:pages/x.html` | frames, never hands off | yes |
| A hub page that skips the loader, lib changed | `?use=s`, silently ignored | `render/#W@s:pages/transform.html` | hands off; the FAB's top-level check reports the ignored ref | honest, not faithful, as today |
| The same page with its file changed too | `#gh=` | same address | frames; lib `main`, silently | no, until the check is ported into the frame |

Two cases the interface cannot express. A routed subject with the viewer at
one hub ref and the lib inside the viewer at another has one `lib=` and needs
two; nobody has needed it. And the endpoint's own top-level behavior, the
tab handling in `render/index.html`, is reachable by no link, as the renderer's
never was.

## Migration, each change on its own justification

**`render/` and the forwarder.** Justified on three counts independent of any
address change: the name says what the endpoint does, where "toss" is the chat
convention's verb for handing something over; the folder form drops
`pages/toss-render.html#gh=` to `render/#`, which alone takes a full-SHA hub
link from about 175 characters to about 130, under the 150-character cap that
keeps render links out of MCP-written PR bodies; and it stops being a
catalogued page, which is what "not a page as such" means. The forwarder keeps
every existing link working with one hop.

**The keyless address.** Justified on its own: one fewer token to know, and
the discriminator already exists (`RepoAddress.parse` returns null for
anything that is not an address, which is how `?app=` tells a slug from an
address). A payload cannot be mistaken for an address, since base64url carries
no `:`. Cost: the endpoint tries the address parse before the key parse. The
keyed forms stay accepted.

**The owner shorthand** (`home@<sha>:path` with the allowlist's one owner
implied). Deferred. Its whole gain is eleven characters, and it would add a
grammar rule to every parser and a second spelling for every address in the
estate. Whether the contents API resolves an abbreviated SHA is untested and
would save more; see the experiments.

**Existing links.** About 2,900 fragment-addressed links resolve unchanged
through the forwarder. The 585 carrying the retired `?use=` shell pin resolve
too, and the pin is inert, so they stop crashing an iPhone. `pages/*.html?use=`
links keep working because every page keeps honoring `?use=`; they are simply
no longer minted.

**Generators.** `showing.py` mints keyless `render/` addresses for every
changed page or file, with `?lib=<sha>` for a changed viewer or recipe, and
nothing for a lib-only change, since the endpoint hands off. Its `none`
outcome survives for a page-file change in the top-level class.
`ref-switch.js` mints the plain address. `fab.js` keeps `widthUrl` and gains
the ported honesty check and a host-row mark in the layer strip.
`app/index.html` stops building renderer URLs and calls the recipe. The
bookmarklet targets `render/`.

**Registries and documents.** `showing-mechanisms.csv` collapses to
`hosted`, `render` (address), `render-lib` (`?lib=`), `render-gz`, `artifact`
and `none`; `use`, `toss-app` and `toss-nested` become notes on `render`.
The picker in `routes.json` reduces to: a declared framing app takes the app;
a changed viewer or recipe takes `?lib=`; everything else takes the address.
`showing.md` replaces "The two mechanisms are inverses" with the self-ref and
handoff rules. `loader.md` marks `?use=` as supplied by the recipe or the
handoff. `show-repo.md`'s ref-switch paragraph is corrected now, independent
of the rest. `pages.csv` and `tools.csv` lose the renderer row.

## What it costs

- **A frame where there was a page, sometimes.** A lib-only change hands
  off and loses nothing; a page-file change frames and loses the tab and the
  host's FAB, as the toss always did. The one case that gets worse is a page
  whose file changed while the FAB also changed, and it was unreachable
  before too.
- **One honesty check has to be ported.** Inside a frame the FAB must read
  the frame's `gh.ref` and compare it with the subject ref. Without that the
  consolidation removes the route on which the check ran.
- **The app adopts the recipe at five sites**, and its `?use=` document
  hosting a frame becomes a shape the iPhone matrix never measured.
- **Metadata reads before a handoff.** Two to a handful per open, on the
  public hub.
- **The clipboard viewer moves.** One tap on the endpoint becomes the app's
  Stage, behind the app's boot.
- **Six documents, five generators, two registries.** None large.

Nothing is deleted from the loader. The consolidation changes who writes
`?use=` and who chooses the viewer and the frame, not whether they exist.

## Staged plan

Each stage is one pull request and stands on its own.

**Stage 0, on the device.** Four taps of the FAB on an iPhone, each with a
frame mounted: the current endpoint at its default (native import from Pages),
the same with `?use=main` on its query, the same with `entry.js?ref=main`
forced in the module script, and a nested endpoint. One console line on a toss
of budget-drs's app, from the `app-frame-outruns-the-inliner` entry.

**Stage 1, the renderer made safe and honest, no link shape changes.** The
host imports `entry.js?ref=main`, so a `?use=` on it is inert. The shim
injects `use` only for a web-tools subject; `__lib` is stamped only when
chosen; `entry.js` reads `__lib` under the precedence above. `fab.js`
`ignoredUse` reads the frame's `gh.ref` inside a toss, and the layer strip
marks the host row. `ref-switch.js` drops `?use=`; `show-repo.md` corrected.
Tests: `use-boot-block`, `toss-inline-deps`, `fab-toss`, `fab-layers`,
`ref-switch`, plus one headless scenario asserting the host's `gh.ref` is
`main` under a `?use=`.

**Stage 2, the recipe and the endpoint.** `lib/render.js` extracted from
`toss-render.html` with its tests moved (`toss-fragment`, `toss-inline-deps`,
`toss-routed-subject`, `toss-charset`, `toss-width`, `toss-microphone`).
`render/index.html` written on it; `pages/toss-render.html` becomes the
forwarder; the bookmarklet retargeted. The keyless address and the
kind-default viewer land here, since both are parser rules in the recipe.
Test: the same suite against `render/`, plus a forwarder test that a
`toss-render.html` URL with each key lands on the same render.

**Stage 3, the app runs the recipe.** The five iframe sites call
`Render`; `appViewUrl` and the landing builders go; the mark is read from
the frame directly. Gated by the Stage 0 tap for the app under `?use=`.
Tests: `shell-app-view-mark`, `shell-projects`, `app-routes`, and a headless
shot of `app/?app=…` counting one frame.

**Stage 4, the internal choices.** The handoff test and navigation; `?lib=`
nesting with the self ref; routes at the self ref. Tests: a unit test on the
eligibility function; a headless scenario intercepting the handoff
navigation; the nested case through `npm run shot -- render/index.html --hash …`.

**Stage 5, generators, registries, documents.** `showing.py` and its
fixtures, `showing-mechanisms.csv`, `routes.json`, `showing.md`, `loader.md`,
`CLAUDE.md`, `surfacing-extended.md`, `pages.csv`, `tools.csv`.

**Deferred.** The owner shorthand, on its own justification, if the length
still matters after Stage 2.

## Questions that need an experiment

1. **Does the current endpoint survive the FAB tap on an iPhone while
   framing?** The 2026-09-08 matrix's surviving cell loaded the host's modules
   from jsDelivr; the host now uses a native import from Pages plus the
   contents API. `lib/entry.js` asserts survival; no tap after the route
   change was found in the session store.
2. **Is a `?use=` on the host inert on the device once the host imports
   `entry.js?ref=main`?** If the crash follows the parameter rather than the
   blob import, the 585 recorded links need a redirect instead.
3. **Does the app under `?use=` with an app view open survive the tap?** It
   is a blob-imported document hosting a frame, the crashing shape by
   description, and was never a cell. Stage 3 waits on it.
4. **Does a nested endpoint survive the tap?** The same matrix, one more cell.
5. **Which inliner candidate empties the budget-drs app's panes?** The one
   console line in the snag entry.
6. **Does the contents API resolve an abbreviated SHA in `?ref=`?** If so,
   `showing.py` can mint twelve-character SHAs and the owner shorthand has no
   remaining case.
7. **Is the frame's `gh.ref` readable at drawer-open time for every subject
   the FAB adopts?** Routed and local subjects have no loader of their own;
   the check must stand down there rather than report a mismatch.
8. **Does the automatic handoff read well?** One branch with a lib-only
   change, opened from chat on a phone, before the rule is written into
   `showing.py`.

## A task, proposed rather than filed

"Consolidate showing on a shared renderer and a `render/` endpoint", size L,
with Stage 1 as the first deliverable and this document as its brief. Stage
0's taps need the device and come first.
