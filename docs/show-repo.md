# show-repo: the shell of the Web Tools app

⭐ **Open it:** [Web Tools](https://mehrlander.github.io/web-tools/app/) (the hosted shell; append `?repo=owner/repo` to open a repo)

show-repo is the one hosted page behind the **Web Tools app**, the front door
to the estate. It began as a repo browser and file mover, and that trunk still
organizes this doc, but the scope is wider now: the estate dashboard and its
activity, session, guide, and chat readings, the stage, the lists, the map,
and the tools, every destination declared in
[app-routes.csv](app-routes.csv). [APP.md](APP.md) states the mission and
the name split (Web Tools where a reader is addressed; show-repo for the file,
the routes, and this doc). It is the cross-repo instrument: a session hands
the user a link into it, or configures a repo so the shell presents it well.
Rendering a page is a different job (that is `toss-render`, see the boundary
below); show-repo shows, moves, and operates.

This doc is the reference. The `#stage=` link is also a surfacing primitive in
[`SURFACING.md`](SURFACING.md) ("Stage a fileset 🗂️"), the transfer-side
sibling of the toss `#gh=`/`#gz=` forms.

## The one honesty caveat, up front

A `#stage=` link and any private-repo browse are **token-gated**: they work only
in a browser that holds the viewer's stored `ghToken`, and only for the token
owner. This is the same constraint as toss-render's `#gh=` address mode. Two
consequences:

- A stage link sent to someone without an authorized token fails. The **Claude
  app's in-app browser** keeps its own storage, so the token is not guaranteed
  there (historically absent, but it can be entered, after which the link works);
  treat it as possibly token-less, not certainly so.
- The token-less, works-for-anyone `#gz=` content-carrying form that toss-render
  has is **contemplated but not built** for the stage. To hand a fileset to a
  token-less reader today, download the concatenated bundle and `SendUserFile`
  it, or (for a single page) `#gz=` toss it.

State this whenever you hand over a stage link, the way the toss primitive
states its `#gh=`-vs-`#gz=` split.

## Browsing: the shell and its views

Open a repo with `?repo=owner/repo`, optionally `&ref=<branch|tag|sha>`. Public
repos browse with no auth; private repos and branches need the viewer's token.
Deep-link params: `&view=` takes any of `estate`, `activity`, `sessions`,
`chats`, `todo`, `jots`, `stage`, `surfaces`, `tools`, `map`,
`state`, `search`, `proposals`, `public`, `app` (the estate's own views) or
`landing`, `pages`, `atlas`, `config`, `files`, `project` (a repo's).
`branches` is a retired per-repo view whose key still resolves, to Activity.
Beside it: `&file=<path>`, `&path=<dir>`, and a second key for the views that
carry one, `&tab=<tab>` (**project**'s pill row, **Map**'s tabs), `&item=`
(**State**), `&detail=` (**Branches**), the `&sq=` family (**Search**: `sq`,
`smode`, `srepo`, `sref`, `spath`, `sfile`), `&window=`. A view
keeps its default second key out of the URL, so an existing bare link still
opens where it always did. `&view=portable` is a retired alias that still
resolves to the Map. Across all of them, `&shell=nav|none` says how much of the
app is drawn around whichever view the address names (below).

**Every view is addressable, and one table says so.** The shell holds a `VIEWS`
table, each row naming a view's URL key, how a link opens it, and what it stamps
back; `routeFromUrl` dispatches through it at boot and again on popstate, and
`deepLinkParams` stamps through it. Adding a row is the whole of adding an
addressable view.

It was three hand-copied else-if chains until 2026-08-11 (a dispatch chain in
`init`, the same chain in `restoreFromUrl` for Back, and the stamp chain in
`deepLinkParams`), and by then all three ways of drifting had happened at once:
`?view=pages` stamped and restorable but absent from boot, `?view=proposals`
dispatched by both chains and stamped by neither, `?view=estate` stamped only
beside a `repo`/`ref` param on a premise that had expired. Each was a view the
app could reach and could not name, and none of the three was visible from
inside any one chain.
[`tools/test/shell-routing.test.mjs`](../tools/test/shell-routing.test.mjs)
keeps the collapse honest (no view name may be compared directly inside the
routing functions; every view the shell enters has a row) and then re-parses
each row's own stamped address, on the default repo and on another, since the
`repo` key is dropped as redundant on the first and that is the case estate
broke in.

**The landing names itself by naming its repo.** A repo's front page is
`?repo=owner/name`, with no `?view=` beside it, since a view key on the
most-linked shape in the app would be redundant on every one of them.
`?view=landing` still resolves, and then clears itself back to the plain form.
The catch was the **default repo**, whose `repo` key is dropped as redundant
everywhere else: that left the hub's own landing with an empty query and no
address at all, the same defect estate had. The landing row puts `repo` back for
that one view, so `?repo=mehrlander/web-tools` persists and reopens where it
says. No other URL changes shape.

**Two context levels.** The page is either in the **estate** (the global,
all-repo context) or in a **repo** (a per-repo context with its own views).

The **header carries the app-level nav**: a fixed, app-owned set of the estate's
own views, **Activity** (Sessions / Branches and four more by pill), **Lists**, **Repos**,
**Stage**, **Tools**, and **Map**, as icon buttons (icon + label on desktop,
icon-only on mobile), lit on the active view and present on every viewport. The
`#repo` component sits beside the nav but renders nothing (it is the repo/auth
controller and hosts the shared dialog), and there is neither an auth shield nor
a brand icon. The far end of the row carries two desktop-only clusters, both
described below: the **rail** (the manifest's `rail: true` links) and the **ref
switch**. The mark left the header because its tap was the
**dashboard** (Activity for a signed-in viewer, Repos for a signed-out one) and
both of those are the first item of the nav it sat against: a second route to a
destination named a few pixels away. It still leads the sidebar crumb trail,
where it is the route home from inside a repo, so the app keeps one copy of it
rather than two. There is no repo-list dropdown and no quick-links row:
**repo selection happens on the Repos dashboard** (a card opens the repo), which
reads better than a dropdown and keeps the header a fixed set rather than one
repos opt into.

### The shell mode: how much of the app surrounds the view

`?shell=` decides how much of show-repo is drawn around whichever view the rest
of the address names. Three values:

| Value | Header | Sidebar |
| --- | --- | --- |
| `full` | yes | out on a wide screen, away on a phone |
| `nav` | yes | away at every width; the header's hamburger opens it |
| `none` | no | away; the launcher's menu and the FAB's Render tab are the way back |

**The default is per view, not one constant.** An app view opens at `none`,
every other route at `full`, and whichever applies stays out of the URL. So
`?app=budget-drs` is already "that page, bare", and turning the header on there
is what gets recorded (`&shell=full`), which is the honest reading of a screen
showing the app's chrome around a promoted page. A promoted page is one page
some repo published, framed whole; the reader who addressed it by name asked
for the page, not for the app around it, and a home-screen tile is the case
that makes it obvious.

It is derived per view rather than latched at boot, and a toggle back to a
view's own default clears itself rather than latching. Both exist for one
failure: a mode that follows the reader out of an app view leaves the estate
dashboard with no nav at all, reachable only through the FAB.

**It exists because most of these views have no page behind them.** Four do: a
custom landing, a project landing, an app view, and the atlas are all iframes
over a real standalone page, so the FAB offers a **bust-out** that leaves the
embed and opens that page full-viewport. Files, Branches, Map, Search, State,
Activity, and a repo's default overview are the shell's own, with nothing to
bust out to. `?shell=none` is the address that shows one of them alone, and it
is what an app view does without being asked.

**An app view names and pictures itself.** The shell ships a 180 × 180 raster
hex nut and an explicit `Web Tools` mobile title for the default iOS Home Screen
tile. The tab and bookmark read the shell's `<title>`; the tile reads the
`apple-mobile-web-app-title` and icon link. One identity for every route made
`?app=budget-drs` indistinguishable from the dashboard on all three. An open app
view now takes them: its name leads the tab (`Budget DRS · Web Tools`) and is
the tile's short title, while the framed page's own icon replaces both Web
Tools icons. The replacement is rasterized to a PNG because iOS will not take
the SVG most pages declare. The title and icon come from `toss-render`, which
resolves the subject's mark anyway and announces it up undimmed on
`toss-subject-mark`; its own tab keeps the dimming, because a toss is a
rendering of a page and a promoted view is a destination. The promoted mark
drops with the view, so Web Tools' raster tile and favicon return together.

**The sidebar is one boolean at every width now** (`sidebarOpen`), and the
viewports differ in two things only: below `lg` it overlays with a scrim, at
`lg` and up it is a column the main area sits beside, and it starts out on the
wide one and away on the phone. Before this it could not be closed on a desktop
at all: an unconditional `lg:translate-x-0` pinned the column open and the
hamburger that would have collapsed it was `lg:hidden`. The header now carries
that toggle at every width, lit while the sidebar is out, and the sidebar's own
X is no longer phone-only either.

**Toggling the sidebar does not touch the URL.** `syncUrl` pushes a history
entry per distinct address, so an addressable sidebar would stack one on every
tap and make Back walk them. The mode already carries the part worth linking
to, which is how the screen **opens**; moving the sidebar inside a mode is
reading, not navigation.

It is a **reading parameter**, in the class `?use=`, `?overlay=`, and `?window=`
belong to: it says how to present the screen, not which screen. So it gets no
`VIEWS` row and is stamped unconditionally beside whatever the view table
stamped, which is also what carries it through a ref switch (that mints its
address from an empty base, where `?use=` must not survive but this must).
`shell-routing.test.mjs` holds the two properties the table's own rows get
for free: the address reopens as itself, and an unrecognized value reads as
`full` rather than hiding the header with no way back.

**Named `shell` because that is already this app's word for it**, the heading
this section sits under and the `window.__shell` the page hangs its state on.
`chrome` was the first name and was dropped: in a browser the chrome is the
browser's, which is the one thing this cannot touch. `frame` was dropped too,
since the drawer's width bar already means a frame and two meanings in one tab
is how a bar gets misread.

**The FAB's Render tab carries the header half of it**, as one on/off control
sharing the row with the width presets, which is what makes `none` a mode rather
than a trap: the same control that sets it brings the app back. It offers the
header and nothing else. The sidebar already has two owners a reader can reach,
the header's hamburger and `?shell=nav` in the address, so a third copy in the
drawer would be a control for the thing standing next to it; the header is the
part with no in-app control, since the header cannot carry the button that hides
the header. That leaves the drawer a binary, and a binary needs no row of its
own. Since the drawer offers one control over three modes, the shell remembers
which header-bearing mode it left, so turning the header off and back on from a
`?shell=nav` link does not silently promote the reader to `full` and spring the
sidebar out at them.

That control is not hard-coded. The drawer's opt-in contract now has a **state**
half beside the `actions` half a page already had: a component exposing
`toggles` as `[{ key, label, icon, on, title, set }]` gets one control per
entry, inline with the presets past a hairline, and the FAB reads and calls
without holding an opinion about what a toggle means. Unlike `actions`, a
toggle is re-read from the live component on every paint, since a verb is fully
described by a closure and a state is not.

**The row holds one line, and that decides the labelling.** Four labelled width
presets plus one labelled toggle wrapped on a 390pt device, so the presets went
**icon-only under a single `Width` label**: one word for the group instead of
four for its members, with a phone, a tablet, and a monitor carrying what they
name and the arrows meaning the device in your hand. The toggle keeps its word,
since an icon alone cannot say which part of a page it means and it is the odd
one out in a row otherwise about size. Nothing on the row explains itself in
prose either: a contributed `hint` line was tried and dropped, having spent two
lines saying what the tooltip and the address already said. The one line that
survives is the width caveat, which appears only off Actual and reports what no
icon can.

Fixing that surfaced an older defect in the same scan: the contract was read
through `Alpine.$data(el)`, which returns the merged data **stack**, so every
component nested inside the shell answered for the shell's properties as its
own. It arrived visible (fourteen identical bars, one per nested component) and
had been sitting quietly in `description` and `actions`, whose values happened
to be empty wherever anyone looked. The scan now reads the element's own scope.

**A third half arrived on 2026-08-19: `menu`,** which fills the launcher's
long-press menu rather than anything inside the drawer. A component exposing
`[{ label, icon, run }]` gets one row per entry under the built-in rows. The
contract exists because the drawer is the wrong place for a verb you want
*before* the drawer: opening it is a tap and a tab, and for a paste
specifically it would also spend the user activation a clipboard read has to
ride.

**It has no user now, and that is the contract working rather than failing.**
show-repo contributed exactly one row through it, the app-wide paste, and on
2026-08-22 that row was promoted into the fab beside "Take a note" and "Web
Tools home". The promotion is the argument: a paste is worth most exactly where
there is no other way in, and a contributed row could only ever appear on the
page that already had a Stage on screen. What being everywhere costs is
somewhere to hold the paste, since the stage is `Alpine.store('browser').stage`,
a store array held for one page load, and the navigation that reaches a Stage is
what would otherwise discard the paste. So the fab defers to `pasteAnywhere` on
a document that renders the Stage, and parks the clipboard's flavors through
[`kits/stage-handoff.js`](../lib/kits/stage-handoff.js) everywhere else, for
this app to drain at boot. The handoff moves **flavors, not staged items**: what
a pasted thing becomes is this file's intake decision, and making the sending
page decide would mean pulling the 233K stage component on a long press for a
paste that may never happen.

Two things are load-bearing about it. **Rows are read when the menu opens, not
when the drawer scans.** `detect()` runs on drawer open, so a menu sourced from
its output would be empty on the first long press of a page load, which is the
press that matters; `readPageMenu()` does its own narrow pass over `[x-data]`,
cheap enough to redo every time and therefore correct on a view that mounted
late. And **every row is one line.** "Take a note" carried a two-line
explanation until this change, and it went for the same reason the toggle bar's
`hint` did: a menu raised by a held finger is read in the half-second before the
finger lifts, so a paragraph there is something to get past rather than
something to read. There is no `desc` field to put one in.

### The ref switch: which ref show-repo itself is running

Past the rail, behind a hairline, sits the **ref switch**
(`lib/alpineComponents/refSwitch`), which answers a question none of the rest of
the chrome does: *which ref is this page running off?* and lets you change the
answer.

It is a **text box, always present**, not a button that reveals one. Paste a
branch, tag, or sha, press Enter, and the page reloads running from it. That is
the primary verb and it is deliberately not behind a tap: the state it serves
best is the default branch, where there is nothing to report and everything to
do, so a control you have to open first puts a door in front of the one thing it
exists for.

The same box is the **readout**. It holds the current ref as its value and goes
warning-tinted off the default branch, where a house button appears beside it
back to the live page. One slot answers "what am I running" and "take me
somewhere else", rather than a chip and a field competing for the same corner.
Focus selects the whole value so a paste replaces it; Escape puts the readout
back. Until the box is edited its value is a readout rather than a query, so it
does not filter the list and Enter on it goes nowhere.

Two buttons flank it: a **caret** opening the branch list (typing filters it,
and a Go row appears for a name that is not in the list), and a **lightning
button that jumps to the most recently committed branch**, which hides itself
when the newest branch is the default one.

**It is not the Search view's ref picker, and the two are easy to confuse.**
That one chooses which ref of the *browsed* repo you are reading; this one
chooses which ref of `mehrlander/web-tools` **show-repo itself runs from**. Same
vocabulary, different subject, so the panel spells out the repo and path it acts
on every time it opens. This one stays its own component rather than adopting
`refPicker`, because picking a ref and *navigating to it* are different verbs.

It switches by navigating to the toss renderer with the ref pinned on **both
halves**, `?use=<ref>` for the renderer's own lib chain and `#gh=…@<ref>:…` for
the page, since `?use=` alone re-pins only the lib a page loads and would leave
the shell (this header included) at the deployed version. The page's current
deep link rides along as the trailing `?query`, so a switch lands on the screen
you were already looking at rather than at the front door.

The branch list is the same scan the fab's Render tab runs
(`branchesForPath`, degrading to an undated list without a token) and it loads
**on hover or focus, once**: a page nobody touches the control on pays nothing.
The fab holds it to the same rule since 2026-09-02: its ref dropdown scans when
opened, and the guide under it reads with one pull-request call on open.

The fab remains the fuller instrument, and the only one on a phone, since this
cluster is desktop-only, like the rail and for the same overflow reason; the
fab's launcher goes warning-tinted off the default branch on every viewport. The
two answer different questions now. This box switches refs and says which one
you are on. The fab's Render tab reads the ref you landed on, in this order:

- **repo and path as one picker.** Tapping either line opens the tree
  (`pathPicker`, the same tap-through selector this shell uses), rooted at every
  repo the token can see with the current one first at the ref on display.
  Choosing a file renders it **in place**, the same gesture as switching a ref:
  a page through the toss, anything else through the data view, which mounts the
  shared multi-mode viewer (`lib/alpineComponents/viewer.js`) whose modules
  declare their own coverage and whose `raw` module always passes, so no file
  type resolves nowhere. Inside a toss neither is a navigation at all, only a
  re-address: `__tossNavigate` for a page, `__tossRoute` for anything routed,
  which keeps the route map owned by `toss-render.html`. The thing being chosen is a file somewhere, so splitting it in two
  left the repo half inert and the path half unable to leave its own repo.

  **A routed subject is the file, not the app showing it.** A route resolves by
  fetching the renderer page and handing it the envelope, so the shell's own
  stamp names `pages/data-view.html` and the drawer over a markdown read
  reported that as the thing on screen. It is not: a route is a rendering
  strategy for a file the same way the frame is one for a page, and neither is
  what was addressed. `showRoute` re-stamps with the envelope, carrying the
  route key and a `via` naming the renderer, so the identity block, the ref bar,
  the github menu, and the guide all follow the file, a ref switch comes back
  through the same route rather than trying to mount a `.md` as a page, and the
  default-branch row re-addresses instead of leaving for a `canonicalUrl` that
  does not exist. One thing deliberately follows `via` instead: the **take
  grid**, which reaches into the frame's DOM for real, so zipping a markdown
  read gets you `data-view.html` and says so.
  Beside it the github mark is a **menu** rather than a link to one blob: this
  file, its commits, then the repo rows `lib/kits/github-links.js` gives the sidebar
  (repository, pull requests, issues, branches, commits at this ref, actions).
- **the ref bar**, which is the picker. One tap on a row renders there.
- **the guide**: the branch's PR body, rendered, with the blob links inside it
  re-aimed at what can show them (a page becomes a toss, markdown and data
  become a data-view read) and lifted into a chip strip, deduped by file so the
  convention's `[new]` and `[main]` pair does not list everything twice. Arrows
  step through **every PR the branch has had**, newest first, since a merge ends
  a PR but not the branch and the merged one's body is often the better account.
  With no PR the pane still reports the ref's standing: the commit it is at, the
  PR that code came from, and how long ago. That last part is where the version
  chip went; it used to sit above the guide, where its PR number was the one the
  *code* came from and read as competing with the one the *branch* is for.

So the header box is for moving between refs and the fab is for reading the one
you landed on.

The sidebar's **top bar is a crumb trail** (`crumbBar`, the shell's
`sidebarCrumbs`) in both contexts. At the app level it is the **product mark
alone**, which says what a "Views" label used to say and says it in the
vocabulary the repo trail already teaches. In a repo it is the mark, the repo,
and the ref only when it is off the default. The mark is the route to the
dashboard from inside a repo, and now the only one in the chrome; dropping the
owner prefix, always this account, is what pays for its slot, and the full
`owner/name` stays in the tooltip. The mark renders grayscale at rest and in colour on hover,
so it reads as a control rather than as branding. Tapping the repo crumb opens a
**repo switcher**: which repository is showing, current one checked, and nothing
else. A trail names where you are, so the only menu it earns is the set of other
places that slot could hold; acting on a repo lives in the row menu below.
**The drawer no longer closes when you navigate.** It used to dismiss itself on
every tap, on the reasoning that it covers the main area on mobile. But the
sidebar is also the thing you navigate *with*: closing it after each tap means
reopening it for the next, and it hides the fact that the list itself just
changed (a repo's views for the estate's, say). It now closes only when you say
so, by the scrim or the X, which makes the mobile drawer behave like the pinned
desktop sidebar that never closed.

The **sidebar** holds what is contextual: in a repo, its views (Overview, Pages,
Atlas, Config), its projects, a route out to Files, plus pins and recents; in the estate, the Repos index and the
repo-sourced **app views** (promoted with `appView:true`, e.g. News). The app's
own view set never appears in the sidebar; the app views appear in both places,
since the header is the one-tap route and the sidebar is the one that holds up
when the header nav is too narrow to show them. On desktop the
pinned sidebar hides entirely when the estate has no app views, so the dashboard
runs full-width; on mobile it is a drawer behind the hamburger. See "The
estate", "The stage", and "Public browse" below.

The per-repo views in the sidebar:

- **landing**: the repo's front page, and it is the **README**, for every repo.
  Stats, the description, the README rendered, and a jump to the atlas.

  It used to be a decision. `landingKind()` picked one of three things for this
  slot, and the two that were not the README won whenever they were declared:
  the hub got its page gallery, any repo with a `pages` catalog got the same,
  and a repo naming a `landing` got that page. So the one thing every
  repository has, and the first thing a reader arriving at one is looking for,
  was the thing displaced. A front door showing something other than the README
  has to be worth more than the README, and a gallery and a custom page are
  destinations rather than front doors. Both moved out to rows of their own
  (2026-08-14), where each says what it is instead of standing in for something
  else, and the overview's own carve-out went with them: it had skipped the
  README fetch on the hub, since the hub was the one repo that never rendered
  one.
- **pages**: the gallery, from web-tools' `pages/pages.csv` or any repo's `pages`
  catalog. A standing row now, wherever there is a catalog; it used to appear
  only when a custom `landing` had taken the front door from it.
- **Landing** *(a repo declaring one)*: the repo's own declared front page,
  rendered live. It goes through the **app view** rather than a landing kind of
  its own, since "render this repo's page as an addressable view" is a thing
  this shell already does for `appView: true` pages. That deleted a branch
  rather than moving one, and the page keeps the FAB's full-page bust-out that
  every framed view has.
- **atlas**: a standing structural view, available for every repo.
- **files**: the repo's tree beside the file it opens. A project's **Files**
  tab is the same view based at the project folder (see Search, below).
- **config**: the repo's `.web-tools.json`, as a form and as raw JSON.

**`branches` was retired** (2026-08-14) for **Activity → Branches**, the same
rollup across every repo; `?view=branches` still resolves there. `files` was
retired with it and returned on 2026-09-24.

**`?ref=` is repo-scoped:** the browsed ref stamps beside `repo` from any repo
view, since the atlas, the config form, the pages gallery and mention all read it.

**GitHub jump-overs.** show-repo is a wrapper over GitHub, not a wall: every
view keeps a one-tap route to the GitHub presentation of what it is showing.
The sidebar top bar links the open repo@ref and its recent entries link their
files, the Files view's reader links the open file's blob at its own repo and
ref, each staged item and finder row links its own
`repo@ref`, each compare row links its blob at head, and every estate card and
surface item carries its github-logo link. A new view should ship with its
jump-over.

The one glyph carries four meanings, and two rules keep them apart:

| Meaning | Example | Treatment |
| --- | --- | --- |
| Repo **menu** | the sidebar row's github button (`lib/kits/github-links.js`) | icon opens a list |
| Repo or branch **destination** | an estate card, the atlas header's ref chip | plain icon |
| The **manifest** behind a whole view | Map's Showing, Tools' curated list | icon **plus a label** ("Curate"), at the header's far edge |
| An **exact file** | a set row, a route's renderer, a staged item | plain icon **plus a source peek** |

A **source peek** (`lib/kits/source-peek.js`) is a hover card showing the file:
markdown rendered, JSON pretty-printed, everything else as source, a 28-line
excerpt in small type with no footer (the measuring line, "first 28 of 79
lines," was dropped 2026-08-07 along with the JSON shape headline it carried: a
cut excerpt visibly ends mid-document, and the tap carries the full read). A call site adds one attribute,
`:data-peek="owner/repo[@ref]:path"`, and a delegated listener does the rest; a
view holding the bytes already (the Map's two manifests) passes them with
`SourcePeek.seed` so the peek costs no fetch. `lib/gh-boot.js` loads it, the way
it loads the FAB: standing equipment for every page that boots the chain, rather
than a line each page's boot block has to remember. That placement is also what
makes it previewable, since a page shell is served from main even under `?use=`. The peek is what makes the fourth
meaning self-evident: an icon that can show you the file is pointing at a file,
and one that cannot is pointing at something broader. So repo, branch, folder,
and menu icons have none, and neither do the viewer's and the config view's
GitHub actions, which sit above the file's full contents already on screen.

It opens on hover where the pointer can hover, and on focus for a keyboard
reader. On a touch screen it never opens: the icon keeps its single meaning,
which is a tap that jumps to GitHub.

**One address, one destination**, since 2026-09-04. The mark was four
attributes, `:href="hubUrl(p)" :data-peek="peek(p)" target="_blank"
rel="noopener"`, and nothing held the first two to the same file: a site could
open one path and preview another, silently, because both halves render fine
when they disagree. The `x-blob` directive
([`lib/alpine-bundle.js`](https://github.com/mehrlander/web-tools/blob/main/lib/alpine-bundle.js))
takes the address once and derives the href from it through `SourcePeek.blobUrl`,
the same builder the card's own head uses. The GLYPH stays at the call site,
because it is not invariant: a github mark says "the file on GitHub" and a
`ph-function` mark says "the builder that stamps this", which is a different
claim about the same kind of link. Nineteen sites in the Map view are converted;
`estate.js`, `stage.js`, `state-view.js` and `tools.js` still spell the pair by
hand. [`tools/test/x-blob.test.mjs`](https://github.com/mehrlander/web-tools/blob/main/tools/test/x-blob.test.mjs)
holds the directive and keeps the Map view's count from going back up.

The card's head carries a mark of its own (2026-09-04), inline after the
filename, and it is the same destination the trigger has: the card is enterable,
so a reader who has moved onto it to read the excerpt has left a 16 px glyph
behind, and going to GitHub meant travelling back to it. The URL is derived from
the address the head displays rather than read off the trigger's `href`, so a
card cannot name one commit and open another; a key that is not an address (the
stage's pasted flavors) names no repo and gets no mark. It is one anchor, not a
control: nothing at the call site changes, and the narrow rule above is
unaltered. Whether it can be pressed at all is a claim a browser has to make,
since mousedown focuses an anchor before the click resolves and the focus
handler used to dismiss on that, so [`tools/test/peek-head-link.mjs`](https://github.com/mehrlander/web-tools/blob/main/tools/test/peek-head-link.mjs)
(`npm run test:peek-link`) drives a real press.

## The estate: the all-repo view

The estate (`lib/alpineComponents/estate.js`) is the central dashboard over the
whole repo constellation, and the page's global context (above any single repo,
reached from the header nav, the sidebar crumb trail's mark, or a bare page
open). It is a context with **views of its own**, switched from
the header nav the way a repo shows landing/atlas/files/…:

- **Repos** (`?view=estate`) — the repo cards.
- **Stage** (`?view=stage`) — the cross-repo working set (below). It carried a
  second sub-view, Saved, until 2026-08-27; `?view=surfaces` is now a retired
  alias onto the bench.
- **Activity** — the estate's own motion: one nav stop with five pill-switched
  sub-tabs, each keeping its own deep link: **Sessions** (`?view=sessions`),
  **Branches** (`?view=activity`), **State** (`?view=state`), **Chats**
  (`?view=chats`), and **Routes** (`?view=routes`) (all below).
- **Lists** — the two personal piles, To-do over Jot, in one pane rather than
  two tabs. Both `?view=todo` and `?view=jots` resolve here (below).
- **Search** (`?view=search`) — file names at any ref under any folder, contents through the code-search API, the session records and the chat catalog, with a hit read in place (below).

- **Tools** (`?view=tools`) — a curated gallery of utility pages (below).
- **Map** (`?view=map`, `&tab=` deep-links a tab or subview): Distribution, Surfacing, Showing, Docs with Inventory, Purpose, and Growth, and Harness with Automation and Tests (below). Per-repo scope and adoption live on the Repos cards.
- **Proposals** (`?view=proposals`) — pending cross-repo edits awaiting a confirm
  (below). The one conditional entry: shown only while something is pending.

The estate component renders Repos / Stage / Activity / Sessions / Lists, sharing one lazy mount;
Tools and Map are their own components on their own lazy mounts.

Behind those, past a hairline rule, the header carries a **second nav group: the
repo-sponsored app views** (`appView:true`), one button each, carrying the icon
its repo declared. Each is addressable as
`?view=app&appRepo=<owner/repo>&appPath=<path>`, and the link stands alone the
way a Surfaces link does: it stamps the promoted page's repo and path
independent of whichever repo is open, so it is shareable on its own. The entry
is a peer of Repos and Surfaces rather than a card in the estate grid, and the
main area renders it live through toss-render `#gh=`.

The list is the sidebar's list (`appNav` reads
`sidebarAppViews`), so the two cannot disagree, and it is the same on desktop and
mobile: the nav scrolls rather than clipping, and the sidebar copy is what a
phone reaches without scrolling it. The rule plus the icons is the whole of the
separation; the app's own entries stay label-only. The header used to be a closed
set the app owned, which left room beside it unused and a published view
reachable only through the drawer. What did not move is the **swipe carousel**,
which still pages `estateNav` alone: an app view renders as an iframe that owns
its own gesture surface, so a swipe could page in and not back out.

**Activity** gathers the estate's own motion under one header-nav stop. Five
panes on a segmented pill (the shared internal-tab style), switching at every
width, each keeping its own view key so `?view=activity`, `?view=sessions`,
`?view=chats`, and `?view=routes` deep-link directly. Where a
pane reads a cache, its **age pill** rides the pill row: it states the age at
every width and opens the **State** view, where that cache's Refresh lives
beside its cost and its throttle. It replaced an as-of reading that was hidden
below `sm` next to a Refresh button that was not.

The first two are readings of the repos. **Branches** is what is in flight and
**Sessions** is the work that made it: a branch is the artifact and a session is
the act, and each row cross-references the other.
**Guides was a third reading and left 2026-08-23:** the view held one file
estate-wide, and its "in flight" was the open PRs Branches and Sessions already
carry. `pages/guides/` stays, indexed by Pages; so does `kits/guide-render.js`,
which renders a guide PR body and is a different thing wearing a similar name.

## Public browse: the no-token file browser

Public browse (`lib/alpineComponents/public-browse.js`) is the intentional
**non-auth** capability, an estate-level view beside Repos / Surfaces / Stage. It
lists and previews any **public** repo entirely through jsDelivr: `GH.flatTree()`
(the `data.jsdelivr.com` flat listing) for the file tree and `GH.rawUrl()` (the
`cdn.jsdelivr.net` raw address) for a file's bytes. The point is the signed-out
case: GitHub's anonymous REST API is capped at 60 requests/hour/IP and
`recentFiles` alone can spend that, whereas jsDelivr serves public repos from its
CDN with no token and no GitHub quota. It works signed in too, as a rate-safe
listing. Honest limits: public repos only (a private repo 404s, with a specific
message pointing at the token), and the listing is jsDelivr's cache of a ref, so
a brand-new push can lag ~12h. Reached from the sidebar, an estate card's
cloud-download icon (which seeds it to that repo via the reactive `publicSeed`),
or `?view=public`. Further jsDelivr endpoints (versions, resolved, stats) are a
tracker follow-up.

## The stage: the working surface

The stage's contract lives in its own reference now, [stage.md](stage.md):
the bench, intake (the paste offer bar, the Add panes, manifest seeds), the
walkable preview and its diff, the Out surface, and the `#stage=` link grammar,
whose four parts are refs, content (`&gz=`, which carries pasted text in the link
itself and is what a token-less review handoff rides), commentary (`&prompts=`)
and intent (`&mode=`, `&cmp=`, `&view=`, `&dest=`). What stays here is the boundary: the stage is
`store.stage`, one list of `{repo, ref, path}` refs (plus local items) sitting
above any repo, which is why it is a nav stop of the estate rather than
anything a repo owns.

The other things that stay here are the **app-wide drop and paste**, because
they are the shell's gestures rather than the stage's: a file dropped, or
anything pasted, on any view is staged, routes to the Stage, and opens in the
preview when it is the only one. The shell owns the listeners, the drag cue,
and the routing (`wireAppDrop`, `wireAppPaste`); what an arriving thing becomes
is `window.StageIntake`'s, one answer shared with the bench's own drop-zone.
Both gestures used to work only on the Stage, which meant you had to already be
where you were trying to get to.

The paste is the shell's **only** window paste listener, and that is a
constraint rather than a tidiness note. Window listeners fire in registration
order and `init()` runs before any component mounts, so a second listener in the
stage could not use `defaultPrevented` to tell that this one had already acted;
one reader is also what keeps a paste's several flavors from being split between
two handlers. The stage's own listener was removed when this one arrived
(2026-08-18).

**The platform floor underneath all of it is that a phone has no paste event at
all.** iOS Safari fires one only when an editable is focused, so the window
listener that is the desktop's whole story is worth nothing there and the
gesture the platform does give is a tap. So there are two tap triggers behind
the one call (`pasteAnywhere` → `StageIntake.takeClipboard`), and they are two
answers to "where would you reach for this", not two implementations:

* the **launcher's long-press menu**, which the shell fills through the FAB's
  `menu` contract (below), a gesture on a control already floating over every
  view;
* the **bench's own Paste button**, for when you are already on the Stage.

**A header button was the third for one day** (shipped and removed 2026-08-19),
and the fact that it went is the part worth recording. It was the discoverable
route: visible without knowing a gesture exists, which the long press is not.
It came out because the header is the app's scarcest row, holding identity, a
nav that already scrolls at phone widths, and the sidebar toggle, and because
the long press was confirmed working on a device first. That leaves the phone's
only intake behind an undiscoverable gesture, which is a real cost knowingly
taken rather than an oversight; if the menu proves too well hidden the button
is twenty lines and comes back.

Each trigger must read the clipboard on the tap's **own** user activation,
which is why `pasteAnywhere` awaits nothing before `takeClipboard`, why
`takeClipboard` throws rather than lazily fetching `kits/io.js`, and why the
shell preloads that kit at boot. An `await` before the read spends the gesture,
and the failure then looks like a clipboard problem rather than a sequencing
one.

**An empty clipboard is reported as information, not as an error** (changed
2026-08-19, from a phone). `io.pasteItems()` returns an empty list both for a
genuinely empty clipboard and for a read the platform refused without throwing,
and nothing downstream can tell those apart, so the message says what happened
("Nothing came off the clipboard") rather than guessing why. Tapping Paste
before copying anything is the ordinary case, and the red alert it used to raise
read as a broken button. A read that *throws* is a real failure and keeps the
error colour.

### Where a takeover sits

A swipe-deck takeover (the file preview, the branch reader, the Map's docs, the
transform workbench) is framed by two CSS variables the kit reads and this app
sets: `--deck-left` and `--deck-top`, both defaulting to zero, so a page with no
chrome beside its content gets the whole viewport as every consumer always did.

**At `lg` and up the takeover lives in the view pane; below it takes the
window.** One breakpoint for both axes, and it is the sidebar's, because that is
where the sidebar stops being an off-canvas drawer and starts taking layout
space. Above it the deck starts after the sidebar and below the header, so both
stay visible and usable while it is open. Below it the deck covers everything,
which is what a phone always did and what a short screen wants.

Until 2026-08-18 the panel was a centred `max-w-4xl` card with a margin, a
rounded border and a shadow, over a full-viewport overlay. That reads as a
dialog pasted on top of the app rather than part of it, and here it floated
across the sidebar, so chrome you were still meant to use sat under something
you had to dismiss first. The phone case was already right; this makes the
desktop match it.

Two things the change costs, both stated because they are silent. The overlay's
desktop margin used to be the click-outside-to-dismiss target and a filled frame
leaves none, so ✕, Escape and the Back button carry dismissal everywhere now,
as they already did on a phone. And the sidebar is reachable during a takeover
for the first time, so navigating while one is open changes the view underneath
it rather than being blocked.

**Leaving the view closes the takeover.** Newly reachable and newly a problem:
the deck no longer covers the chrome, so a tap navigates while the deck keeps
painting the view you left. Measured before fixing, opening the workbench on the
Stage and tapping Map left the workbench on screen with the rail and the URL
both saying Map. It hangs off `syncUrl()` rather than a watcher on `view`, for
ordering rather than taste: every `go*` method routes through there
synchronously, so at the moment a paste calls `goStage()` no deck exists yet and
it is a no-op, where a queued watcher could as easily have fired after the
preview opened and closed the very thing the paste was routing to. It uses the
kit's `drop()` rather than `close()`, since the navigation is already the
history event.

**The breakpoint alone is not the condition,** which is the trap: the desktop
sidebar is conditional (`showSidebar`, `sidebarOpen`, and the `lg:hidden` on the
aside), so a signed-out dashboard or a put-away sidebar has no column there. A
deck inset by a column that is not present clips the very view it is covering.
CSS owns the widths, `syncDeckFrame()` owns whether they apply, and the header's
height is measured rather than restated, since it is conditional too and a
hidden header measures zero for free.

## `.web-tools.json`: the repo manifest

The manifest's contract lives in its own reference now,
[manifest.md](manifest.md): the file's shape, the membership rule, the config
cache, the mailbox, inbox and outbox, proposals, the repo menu, and editing
the manifest from the shell, with the field list as data in
[manifest-fields.csv](manifest-fields.csv). What stays here is the consumer's boundary:
show-repo reads `landing`, `pages`, `pins`, and `stage` to decide how to
present a repo, probes the file once per `repo@ref`, and parses it as data,
never executed; a 404 means no config.

## Transfer: moving files to another repo

"Copy to repo" writes the staged fileset to a destination via `gh-transfer.js`
(lazy-loaded on first send). Mechanics:

- Destination spec: `owner/repo`, `owner/repo:dir`, or `owner/repo@ref:dir`.
- The whole deposit lands as **one commit** through the Git Data API (a blob per
  file, one tree over the branch's current one, one commit, then the ref moves).
  The payload stays **base64 end to end**, so binaries copy as faithfully as
  text, and refs and pasted files ride the same commit. `gh.copyTo` is still
  there and still writes one commit per file through the Contents API; nothing
  in the app calls it now.
- The commit message names the deposit and lists its paths, capped at twenty:
  that list is what the per-file messages used to carry, and once a deposit is
  one commit it is the only record of what was in it.
- A source file that cannot be read is **reported and left out**, and the rest
  still commit; when nothing reads, no commit is made. The tolerance is the one
  `copyTo` always had. The atomic part is the write.
- A branch that takes another commit while the blobs upload makes the ref move
  fail rather than clobber it, and the tree is rebuilt on the new tip. Three
  attempts, then the error stands.
- **Two-tap confirm**: the first tap arms for 3 seconds, the second sends. A
  cross-repo write with the viewer's token stays a deliberate gesture.
- Writes land on the destination's **default branch** unless an `@ref`/branch is
  given.
- A file over the Contents API's ~1 MB cap comes back as metadata with an
  **empty content string**, which is the one answer a deposit must never pass
  on: an empty string is valid base64 for zero bytes, so a write takes it and
  lands an empty file while reporting success. `getRaw` reads such a file
  through `git/blobs/<sha>` instead, the same fallback `gh.bytes` has always
  had, so read and write now meet at roughly 100 MB rather than 1 MB apart. The
  extra request fires only on a file that would otherwise have failed; past
  about 100 MB the blob endpoint withholds the bytes too and the error names
  the size. A file's mode is still not carried: the Contents API never returned
  one, so everything lands `100644`.
- A file that would copy onto itself (same repo, no `:dir`, same ref) is
  refused with a prompt to add a `:dir` or `@ref`.

## Boundary: show-repo vs toss-render vs artifacts

Three cross-repo live-view channels, one job each:

- **show-repo** *shows and moves* files (browse, stage, transfer, manifest). Its
  own marker in chat is 🗂️ for a stage link.
- **toss-render** (`#gh=` / `#gz=`, marked 🥏) *runs* a page: it renders HTML
  live. show-repo's custom landings and the viewer's "Toss render" action both
  hand a file to toss-render at its own `repo@ref`.
- **artifacts** (marked 📦) *publish* a self-contained snapshot to a stable
  `claude.ai` URL, which renders in the Claude app on sign-in alone, so it needs
  no token where a toss or stage would want one. See [`artifacts.md`](artifacts.md).
- **review** (`pages/review.html`, marked 🔍) *reads* a changeset: one card per
  changed file with a CM6 diff against the base, patch text, and the caption's
  `[new]/[main]/[diff]` links. Address grammar `#gh=owner/repo[@ref][:path][&base=…]`
  (the toss `#gh=` address plus a base); token-gated the same way. Its per-file
  dossier (`lib/alpineComponents/file-review.js`) is already in this shell: the
  branch view mounts `branchBrief`, which builds the same `fileReview` cards and
  drills into them through `kits/file-deck.js`. So `review.html` is the
  standalone ADDRESS for a changeset rather than a capability the app lacks.

## Using it from a Claude session

- **Hand the user a browse link:** `…/app/?repo=owner/repo` (add
  `&ref=` for a branch, `&view=files&path=<dir>` to land in a folder). The
  bare page URL is the estate (the all-repo dashboard).
- **Hand the user a stage link (🗂️):** mint `#stage=…` per the grammar above.
  State the token caveat. For a token-less reader, download the concatenated
  bundle and `SendUserFile` it instead.
- **Set a repo up for show-repo:** write its `.web-tools.json` (`landing`,
  `pins`, `stage.files`, `stage.targets`).
- **Surface something for the user:** with registry access, add an item to a
  `surfaces/*.surface` file in `web-tools-private` (or add a new surface file);
  the estate renders it on the user's next visit. Items follow the surfacer
  schema (`id`, `title`, `kind`, `snippet`, `facet`, `commentary`, `added_at`,
  plus kind fields); flip a surface's `category` to `archive` to retire it. For a
  surface that belongs to one repo rather than the whole estate, commit the
  `.surface` file **in that repo** and name it in the repo's `.web-tools.json`
  (`surface`: path or list); it renders under that repo's section in the estate,
  no registry access needed.
