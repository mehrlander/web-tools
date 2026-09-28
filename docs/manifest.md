# `.web-tools.json`: the repo manifest

The manifest is how a repository tells the Web Tools app, and any other
web-tools page, how to present it. This is its reference: the file's contract, the
membership rule, the config cache, errands, inbox and outbox, proposals,
the repo menu, and editing the manifest from the app. The field list itself
stays data, one row per key in [manifest-fields.csv](manifest-fields.csv), held
to the estate's real manifests by `tools/test/manifest-registry.test.mjs`; this
doc is the prose around that registry, not a second copy of it.

That registry is the structured stage for the field reference: one row per key, with its type, the tool that reads
it, and what it does. What stays in prose is the part a registry cannot carry,
design rationale and cross-field behaviour. The gate checks every key present in
a real manifest against a row, so a field that gets used without being written
down is a test failure rather than a discovery three months later. `consumer`
records which tool reads each key: the file is shared, and which tool reads a
key is a property of the key.

It went flat on 2026-08-16. The members of an array or object key used to sit
nested inside their parent's row, which meant the registry counted **20 rows while
its own scope claimed every key in use**. There are 46. They are rows now,
addressed `pages[].path` and `stage.files`, and a `required` column says whether
a member has to be present, blank on a top-level key because that was never
recorded.

Root `.web-tools.json` is the repo's canonical **web-tools config file**.
The Web Tools app is one consumer: it reads the
`landing`, `pins`, and `stage` fields to decide how to present the repo. Those
fields sit at the top level, not under a `showRepo` key, because they describe the
repo in ways any web-tools page may read, not just this app. The app probes
the file once per `repo@ref` (a 404 means no config) and parses it as **data**,
never executed. It is the only name read: the legacy `.show-repo.json` fallback
was removed on its 2026-08-15 sunset, once the config cache showed every
configured repo already on the new name. Fields:

```json
{
  "icon": "ph-scales",
  "estate": true,
  "group": "data",
  "note": "One-line description shown on the estate card.",
  "order": 30,
  "landing": "pages/landing.html",
  "pages": [
    { "path": "pages/news/news.html", "title": "News", "note": "The news dashboard.",
      "appView": true, "viewLabel": "News", "icon": "ph-newspaper", "slug": "news" }
  ],
  "pins": ["pages", "lib/alpineComponents", "docs/SURFACING.md"],
  "stage": {
    "files": ["lib/foo.js", "owner/repo@ref:path/to/bar.js"],
    "targets": ["owner/repo:dir"]
  },
  "conventions": "optout"
}
```

A promoted page's `slug` is the one field that is an address rather than a
description of one, and a slug no repo declares lands the reader on the estate
rather than an empty frame. The registry row carries the rest of its contract.

**Every promoted page declares one**, which is a rule about the set rather than
about the field, so it lives here. The shell's `stamp()` rewrites the address on
every navigation, writing the slug where the open view has one and the five-key
`appRepo`/`appPath`/`appLabel`/`appIcon` form where it does not. A page without
a slug therefore cannot hold a short address: the middle form,
`?app=owner/repo[@ref]:path`, parses and opens, but the first tap inside the app
replaces it with the long one. That was the state of five of the estate's six
promoted views until 2026-09-04, when only the budget-drs lens carried a slug,
because `?app=` was built for it (tracker task `app-view-address-and-icon-tc1a91`)
and the field was applied once rather than across the set.

A deep link INTO a promoted page rides the fragment, not the query. The shell
owns the query and the subject owns the fragment, so
`?app=news#view=archive&q=budget` hands `view=archive&q=budget` to the page as
its own params, and neither side needs to know the other's key names. That
matters because they would otherwise have to: the shell's route table and a
framed page's params already collide on `view` and `tab`, and the pages gallery
claims `q` from outside the route table, where a convention would never have
looked. The rule and its fallback for contexts that strip the '#' are in
[`lib/kits/url-params.js`](../lib/kits/url-params.js) (`subject()`), pinned by
`tools/test/url-params.test.mjs` and `tools/test/app-view-address.test.mjs`.

Every path in that config is an address, and nothing used to read them: `dead-links.py` enumerates a repo with `git ls-files *.md`, so a declared page could be moved or deleted with no check anywhere noticing. [`scripts/declared-paths.py`](../scripts/declared-paths.py) checks `landing`, `pages[].path` and `stage.files` against the working tree and sibling checkouts, and belongs in the declaring repo's own verify suite: the mover is the only party who can catch a rename at the moment of the rename. That makes declaring a page load-bearing rather than decorative. If it is worth another repo embedding, it is worth declaring here.

The fields themselves are **not listed here.** They live as data in
[`docs/manifest.json`](manifest.json), one row per field with its type, its
consumer, and what it does, held to the estate's real manifests by
`tools/test/manifest-registry.test.mjs`. This section used to carry that list as
3,000 words of prose, 8% of all documentation in the repo, and prose could not
be checked against anything: `quickLink` was live in two of the four manifests
and appeared in no field list, and `pages[].order` was declared by two repos and
read by no code at all. Both surfaced on the gate's first run.

What stays here is the part a field registry cannot carry: how fields interact,
and why the mechanisms behind them are shaped the way they are.

**Membership is a repo property.** There is no registry list of repos. All
fields are optional, and a repo with no config is simply off the estate.

**`hidden` is the one field about the viewer, and it lives in one file.** Every
other key here describes the repo it sits in, which is why membership needs no
central list. "I would rather not look at this one" describes the person
looking, so it is a key in the **private registry's own** manifest, an array of
`owner/repo` strings, and it is the single exception to the no-registry-list
rule rather than a crack in it: it does not decide membership, grouping, order,
or anything else about a repo, and a hidden repo keeps `estate: true` and every
field it declared. It goes off the sidebar Repos index, the app-view nav (its
promoted pages with it), the Repos grid, and the activity crawl, which is the
whole of the effect; opening it by address still works, and the Repos view's
folded **Hidden** section is the way back.

It sits beside `conventions: 'optout'` without overlapping it, and the pair is
worth keeping straight because the two questions sound alike: optout is the
repo saying it is not part of this estate, so the session-start directive stops
asking; `hidden` is the dashboard being told what to draw. A repo can be a full
member and hidden, which is exactly the case that has no other answer: setting
`estate: false` would drop its group, note, icon and order on the way out and
make coming back an act of reconstruction rather than a toggle.

**`landing` and `pages` are not mutually exclusive.** A repo setting both gets
the custom page as its front door and the catalog as a standalone Pages view;
setting only `pages` gets the gallery as the landing. Neither arrangement hides
the other.

**When an app view is the right call.** A view whose subject is *the estate* is
built into the shell (Activity, Sessions, Repos, Surfaces, Stage, Map,
Proposals, and the Lists pane, which is operational to the tool). A view whose subject
is *content* is an app view over the repo that owns it: the renderer stays
public here, the content stays wherever it belongs. News and Links are both that
shape, home's data through a web-tools page. Two consequences before building
one: the page gets the main area minus the sidebar, so it has to survive at two
thirds width; and the shell already supplies a header and the sidebar label, so
a promoted page should stand its own masthead down when `window.self !==
window.top` (`pages/links.html` does, `pages/news/news.html` does not yet). An
app view cannot reach the shell's chrome at all, being in an iframe, so anything
wanting persistent presence has to be built into the shell instead.

**Checks: the boundary, and why the estate can afford them.** A check asks a
question about *data* and never runs code; anything needing execution stays in a
test suite. That is what keeps the convention cheap and portable, and why a repo
declaring no checks pays nothing. Only what is *not* passing renders, on either
surface: badging green states would make the block furniture, and furniture
stops being read. A check that cannot be evaluated renders too, in grey rather
than amber, because a check whose file was renamed out from under it has been
silently invalidated and silence there is the failure the mechanism exists to
prevent.

Two surfaces take two routes to one definition. A repo view evaluates live on
open: cheap for one repo, always current. The estate grid cannot, since M checks
across N repos on every load is the per-visit fanout the activity cache exists to
avoid, so the crawl probes each repo and the cards judge what it stored. That
works because `lib/kits/repo-checks.js` splits `probe` (gather each check's raw fact)
from `verdict` (facts plus a clock become pass or fail). A verdict is volatile
and a fact is not: `13d since 2026-07-18` becomes 14d tomorrow with nothing in
the repo having changed, while `2026-07-18` changes only when the repo does.
Caching verdicts would rehash every entry every day and commit on every crawl
forever, the same trap the activity cache's crawl-timestamp exclusion already
avoids. Caching facts keeps the hash stable and lets a card opened weeks after a
crawl render a correct, staler verdict with no network at all. A declaration
rides the hash beside its fact, so editing a threshold reaches the cards on the
next crawl; a crawl that ran checks and found none clears them, while one that
skipped keeps what it had, or a retired check would haunt a card forever.

**`tracker` is the one content-typed check kind.** The other five ask about a
path's shape or age; this one reads a tracker's typed projection
([TRACKER.md](TRACKER.md)) and counts. It still sits inside the boundary, since a
projection is a committed file and the check is one API read. It is what puts
*"6 awaiting someone"* on a repo card, the fact a board cannot state from a card
and the one a person wants when deciding what to pick up. Quiet is measured from
the *oldest open task* and only when `staleAfterDays` is declared, since how long
a backlog may sit is a per-workspace judgment; done tasks are excluded from every
count, so old history cannot hold a tracker stale.

**Links: two declarative layers, and the split is what keeps the rail honest.**
*Which board* is the `links` field, editable through the repo dialog's Config
tab. *What is on the rail* is the board itself: the `rail` flag, array order, and
each item's `icon`, `title`, and `doors`. Nothing is re-authored, since the flag
already drives the board's own masthead band. Placement follows the verb: a rail
item leaves the app, or opens a repo in it, which is not what a nav item does, so
it sits at the far end of the header rather than as a third nav group, icon-only.
That cluster is desktop-only, the one place the two viewports differ, because
below `lg` the nav already scrolls and a second header cluster would compete for
the same overflow. The sidebar's Links block is the phone's route to the rail and
the wide reading of it on desktop. A `snippet` item is skipped in both: a
`javascript:` URL is something to copy, not somewhere to go.

**Projects: the defining convention.** A workspace running a tracker (a
`tracker/` directory holding `tasks/`, per [TRACKER.md](TRACKER.md)) is a
project. A tracker at the repo root marks the repo itself and earns no row, so
"repo or project" needs no separate registry of what counts. That convention is
also why the task-board button needs no declaration: the same layout puts the
generated rollup at `<workspace>/tracker/board.md`, so the row derives it.

The field is declarative rather than discovered live (walking a tree for
`tracker/` dirs is API-costly), which makes it generatable: home's
`tools/generate-tracker-registry.py` syncs it from the trackers it finds, so the
manifest cannot drift from the ground truth. All three lists hang their rows off
the same 1 px rule, placed on the centre of the glyph above them, which is what
says "these belong to that" without spending an indent. The estate sidebar reads
the field from the config cache it already holds, so those rows cost no extra
fetch; the open repo reads its own live manifest instead, the one `loadConfig`
fetched at the browsed ref, so inside a repo the list follows the ref and needs
no cache entry. That split is why a `projects` field existing only on a branch is
invisible from the estate (the cache is a main-derived artifact) until it merges,
while the repo's own sidebar shows it as soon as you browse the branch; the
**branch overlay** above previews the estate side live.

**Two fields are not the app's.** `conventions` is read by the portable
conventions and `sessions` by a plugin hook outside any page. The registry's
`consumer` column carries that distinction for every field, which is what the
prose kept losing by noting it in passing on two entries.

## One membership list

A repo is in the estate when its own `.web-tools.json` says `estate: true`. That
one answer, aggregated by the config cache, serves every consumer: the Repos
grid, the sidebar index (`estateRepos`), the activity crawl, the stage's repo
pickers, and the Map's adoption roster. The **one** private string this public
page names is the registry repo itself
(`REGISTRY_REPO = mehrlander/web-tools-private`), where the cache lives, never
the repos in it.

Two rival lists were retired in favor of it, and both had drifted:

- `quickLink: true` fed the header quick-link row. The header-nav redesign
  deleted the row, and by then the flag was set on seven of the eight members,
  so as a prominence subset it distinguished nothing.
- The registry manifest's `repos` array fed the Map's roster. It sat one member
  short, having never picked up a repo that joined the estate.

Each was a central list standing in for a property every repo can state itself,
which is what let them drift. If a prominence subset is wanted again, it belongs
in `order` on the membership, not in a second flag.

## Config cache (`state/configs.json`)

With a token, the app keeps a **derived** cache of the account's repo configs
in the registry repo, built by `lib/kits/repo-config-cache.js`. `refreshConfigCache`
enumerates the account's repos (`gh.repos()`) and folds each one's
`.web-tools.json` into `web-tools-private/state/configs.json`, appending a
bounded on-change version history per repo. A per-browser throttle
(`localStorage`, default 6h) keeps the crawl occasional, forced after a config
save; a material-change check keeps commits sparse.

This cache is the **read path** for estate membership, so
a normal load is two GETs (the cache + the account list), not an N-repo scan; a
cold cache falls back to a live per-repo scan and then rebuilds. Source of truth
stays each repo's own `.web-tools.json`; the cache is derived, for breadth
(reading across repos at once) and config history a single read can't show. The
per-repo write flows (add-to-estate, the placement editor) read a repo's **live**
config, not this cache, whenever they
operate on that repo. Stage history falls out for free: a repo's declared
`stage.files` lives in its config, so versioning the config versions the declared
stage. Layer model: `web-tools-private/DESIGN.md`.

## Errands (`errands/requests` → `errands/results`)

An errand is work a session needs this browser, or the person using it, to do.
Every errand carries a `note` saying what is wanted. Three optional fields say how:

- `action` names a mechanism the Stage performs itself: `tree`, `branches` or
  `fetch`, a read of one of your repos with your token.
- `run` describes what gets run: `script` (`owner/repo@ref:path`), `venue`,
  `method`, `outputReturn`, `outputType` and `outputSigned`. The methods, the
  venues each allows and how each returns its output are the registry
  [`run-methods.csv`](run-methods.csv). A `courier-bookmark` run executes on a
  page the session cannot reach; see `courier/README.md`. A `computer-use` run's
  script is a prompt rather than code: the person hands it to a computer-use
  agent on the home laptop, whichever product, pastes the agent's report onto
  the errand, and does the work themselves only when no agent can.
- `for` (also read as `task`) names the tracker task the errand serves, as
  `owner/repo:path`. It is a follow reference in the sense of
  [`locators.md`](locators.md): it means the task as it now stands, and the task
  does not store the errand back, since a derived lookup finds it.
- `purpose` is `test-script` (the output is evidence that code works) or
  `get-data` (the output is source material that lands and is used).

An errand with no `action` and no `run` asks for material only you have. `expect`
grades what arrives. A run with `outputSigned: true` wraps its output as an
`errand-result/1` envelope, which a paste anywhere on the Stage routes to its
errand. File `errands/requests/<id>.json` in the registry, with the fields in
`lib/kits/errands.js`, and hand the user `?view=stage&errand=<id>`. Nothing runs
until they tap, reads included. The answer lands at `errands/results/<id>.json`.

## Inbox and outbox

Two optional manifest fields naming where material lands and where it is
staged. `inbox` is the **receiver's** declared landing spot for a deposit that
names no directory; `outbox` is a **sender's** folder of material it is making
available to be pulled. Both are read by `lib/kits/repo-address.js`
(`RepoAddress.box(config, 'inbox'|'outbox', repo)`).

**A box is a folder by default, and can name a branch.** That was an open
design question, and it is settled as a per-repo choice rather than a global
one, with the discoverable option as the default:

| Declaration | Means |
| --- | --- |
| `"inbox": "inbox"` | the folder `inbox/` on the repo's default branch |
| `"outbox": "@share:out"` | the folder `out/` on the branch `share` |
| `"inbox": "owner/repo@ref:dir"` | a box that lives in another repo |
| absent | nothing declared (deposits land at the root) |

Folder is the default because a folder is visible in ordinary browsing while a
branch is invisible unless something points at it, and a consumer that forgets
the ref reads the default branch and silently finds nothing. Writing into a
branch also presumes the branch exists: the Contents API can PUT to an existing
one, but creating a ref needs the Git Data API, which this lib does not carry.
A repo that wants transient bulk kept off its main history says so by naming a
ref, and pays the discoverability cost knowingly.

**Inbox, on the send side.** The Stage view's send resolves an unaddressed
deposit (a repo picked with no directory) against the *destination* repo's
manifest, one read keyed to that repo, cached for the session. The armed
button names the resolved directory (`Send to inbox/ ?`), so the second tap
confirms where the files actually go rather than hiding a redirect. Root stays
the fallback, so a repo declaring nothing behaves exactly as before. Nothing
creates the folder in the background: the commit that lands the first file is
what makes it exist.

**A project can declare one too, and the repo's is the root project's.** A
`projects` entry takes an `inbox` in the same grammar, so a repo carrying
several workspaces can aim a deposit at the one that owns it. The two levels do
different jobs and neither replaces the other:

| | Repo-level `inbox` | A `projects` entry's `inbox` |
| --- | --- | --- |
| How many | exactly one | any number |
| Answers | a deposit addressed to `owner/repo` with no directory | a destination you choose |
| Reached by | automatic resolution at send | tapping its pill |

There is one repo-level box because the input carries nothing to discriminate
on: a file sent to `mehrlander/home` cannot be *inferred* to belong to a
particular workspace. A project inbox therefore never enters automatic
resolution. Conceptually the repo is its own root project, which is why its
default lives as a top-level key rather than as a synthetic entry in `projects`:
no migration, and the new field is purely additive.

**Declared, not derived,** which is where `inbox` parts from the sibling
`tracker` field. A board is derived from the convention (`<path>/tracker/board.md`)
because a board is a **link**, and a wrong guess costs a 404. An inbox is a
**write target**, and a wrong guess files a deposit into a plausible folder that
nothing drains, where it is not missing so much as quietly elsewhere. The
measured case: `mehrlander/home` ran an undeclared root `dump/` beside its
declared `chron/dump/` from 2026-07-30 to 2026-08-12, and because every reader
it had (its repo map, its staleness check, its drain skill) watched the declared
one, the map reported the tray empty while four files sat in the other.

**Destination pills.** The Stage view's Out pane renders every declared box
across the picker's repos as a one-tap strip under the destination picker, read
from the shell's config cache (one pass at load, already in memory), so the
strip costs no fetches. Only **declared** boxes appear. The picker beside it
already lists every folder that *exists*, which is a different claim, and the
difference is the point: a browser cannot tell you which plausible folder is
drained. A repo with no pill is visibly missing a declaration rather than
quietly defaulting, which is the pressure worth having. Tapping a pill sets the
destination and the picker's own trigger label together, since the picker
commits its label on a pick and would otherwise name one place while the send
went to another.

**Outbox, on the pull side.** A repo declaring one gets an **Open outbox** row
in its repo menu, which opens the Files view at that folder. The pull itself is
ordinary browsing or staging from there. For a **public** repo the outbox is
also the one cross-repo handoff that needs no token at all: `raw.githubusercontent.com/owner/repo/<ref>/<path>`
serves it to any reader, which is the gap the `#gz=` bundle form is contemplated
for on the private side.

## Proposals

The write-side counterpart to errands, the Proposals view, is documented in
[views/proposals.md](views/proposals.md).

## The repo menu

`repo-menu.js` is one panel showing one of **three lists** for one repo. It
hangs off a Repos row's two trailing buttons, and off the Activity view's repo
chip, as a dropdown anchored to whichever was used, positioned from its rect
(the rows sit in a scrolling column that would clip a nested panel) and flipped
above the trigger near the bottom of the list.

**Actions**, off the visibility marker, is where you act **on** a repo rather
than navigate to it: **Config**, its declared outbox, and **Copy browse link**.
It is a short list because every row that left had somewhere better to be. Files
and Branches expanded into the repo's folders and its branch list, and "what is
inside" is a browsing question the sidebar and the Files view already answer
once you are in the repo. **Open** went because tapping the row itself is what
opens the repo. **Switch to the `-private` companion** went because the sidebar
lists that companion as its own row: the jump was built for a list that shows
one of a pair and hides the other, which is the estate **cards** (they nest the
private repo inside its public parent), not this one. A menu offering a jump to
a row three lines down answers a question the list has already answered.
Nothing expands, so nothing carries a chevron.

**GitHub**, off the github-logo button beside it, is where that repo lives:
**Repository**, **Pull requests**, **Issues**, its **Task board** (the
`tracker` field), **Branches**, **Commits**, **Actions**, each with an
out-arrow. The list is `lib/kits/github-links.js`, a pure string builder with no
fetches, so the Activity view's repo chip fills the same panel from the same
rows. This was a single **Open on GitHub** row inside the actions list, pointing
at the repo root: the one destination a reader could have guessed, while the
rest of a repo's GitHub surface had no route at all. Splitting it out is what
let it grow, and it stays cheap because the lists share one panel, so hovering
from one trigger to another swaps the rows in place where separate panels would
close one under the pointer.

**Repo**, off the Activity view's chip, is both of the above in two sections.
The sidebar can afford to split its material across two buttons, because the
row itself opens the repo and the list shows every sibling; an Activity row is
about a **branch**, in a view with no sidebar on screen, so its chip is the
reader's only route to the repo and carries the lot. Sections rather than a
submenu: a submenu hides half the answer behind a second gesture, and seeing
where you can go is the whole point of a jump-over list.

It is **the repo, twice**, then where it goes on GitHub, as one flat list:

```
  Show web-tools branches only     ← contributed by the view
  ────────────────────────────
  ⟨⟩ web-tools                     ← opens the repo here
  ⌥ web-tools                   ↗  ← opens the repo on GitHub
  Pull requests · Issues · Task board · Branches · Commits · Actions ↗
```

**Flat, and flat again on purpose.** The list briefly grew two sections, each
with an indent and a bold head row, and then the app section lost its children;
one section is not a structure, and the styling was carrying a hierarchy that
had stopped existing. What separates the two halves now is the **out-arrow**,
which is the honest distinction anyway: those rows leave the app and these do
not. The only styling left is mono on the two rows whose label is a **repo
name** rather than a phrase, matching how repo names are set everywhere else,
and one rule under the caller's row, which acts on the list you are in rather
than going anywhere.

The app half used to carry **Files**, **Branch review** and **Config**. They
are gone for the reason the sidebar's own menu never had them: once the repo is
open, its views **are** the sidebar, so each row bought one tap and made the app
half look like a section when it is a destination.

The app's mark is drawn **inline** rather than loaded from `lib/favicon.svg`,
as an outline rendition of it: an `<img>` cannot take `currentColor`, so the
file would sit in brand blue beside a column of muted glyphs and stay blue on
hover. Two numbers in it are derived from Phosphor rather than chosen, and both
were wrong on the first pass: the **viewBox** is padded to 29 units around a
22-unit mark (~76%), since a Phosphor glyph keeps margin inside its own box and
a mark drawn edge-to-edge in the same 16 px reads a size larger; the **stroke**
is `29 × 16/256 = 1.81`, Phosphor's regular weight carried onto that viewBox.

That replaced an inert uppercase label plus a row underneath it: **Open repo**
and **Repository** were one idea named twice, and reading them together made
the two halves look like two vocabularies for the same thing. Now they are the
same name under two marks, and a rule does the separating that a label used to.

Both lists are flat, short, and **compact by pointer**: 26 px rows at 13 px for
a fine pointer, 32 px for a thumb, in a 184 px panel. Both heights are under the
44 px floor, which is for a cold target in chrome, not for a panel the pointer
has already aimed at and opened. A list where **every** row leaves the app drops
the out-arrow column: the GitHub menu's seven identical arrows said what the
github-logo that opened it already said. A mixed list, like the branch menu,
keeps them, since there the arrow marks the odd row out.

Where the pointer can hover (`(hover: hover) and (pointer: fine)`) either
trigger **opens on hover**, after ~140 ms so that crossing a row does not open
it, closing ~220 ms after the pointer leaves both the trigger and the panel,
which is what lets it cross the 2 px gap between them. A tap works everywhere,
and a second tap on the same trigger dismisses. The Activity view's two menus
(its repo chip and its per-branch GitHub menu) follow the same timings.

**The delay applies to a swap as well as to a first open**, which is the part
that had to be found by using it. The two triggers are neighbours and the panel
opens past both, so the pointer's route from one button to the panel runs over
the other; swapping on contact made the GitHub menu unreachable from the GitHub
button, the marker's menu replacing it every time. A crossing takes tens of
milliseconds and a decision takes longer, so one threshold separates them.

The pair replaced a three-icon cluster (visibility marker, config gear, GitHub
logo) on every row. Those icons measured about 16 px against a 44 px tap-target
floor and each bought exactly one tap. The two that came back each open a list
rather than a single destination; the marker is the old inert `<span>` promoted,
so the row keeps its public/private state while carrying its menu. They sit
tight together and carry **no chrome of their own** on a fine pointer (28 px
wide, no hover background), since a background per glyph made the pair read as
two tiles when the row's own tint is already the feedback and the glyph turning
primary is already the state. A thumb gets 40 px. Two other presentations were built here and taken
back out: a press-and-hold, since a visible control answering a single tap does
the same work without a gesture to discover, and a bottom sheet, since nothing
about a short list justifies throwing the menu to the far edge of the screen.

## Editing the manifest from the shell

Two surfaces edit the same file. The **Config view** (`lib/alpineComponents/config.js`,
the sidebar's Config row) is the roomy one and covers the **currently-open
repo**: a Settings form and a raw JSON pane side by side on desktop, tabbed on
mobile, kept in sync both ways. The **repo dialog** (`repoModal` in
`lib/alpineComponents/repo.js`) is the compact one and covers **any** repo
without navigating to it, reached from an estate card's gear, a sidebar Repos
row, or the Map; its **Settings** and **Config** tabs are the same two panes.

Either way the JSON editor loads the current `.web-tools.json` (or an all-empty
template when the repo has none, so the shape is there to fill in), validates on
every keystroke, links to this doc for the field format, and on Save commits the
file through the viewer's token (`gh-store.js`'s `save`, a Contents API PUT to
the repo's default branch). Editing needs auth, so Save is disabled without a
token.

- **Where it lives**: the open repo's config is a sidebar row like any other
  repo view, so it sits with the views rather than behind an icon; the sidebar's
  top-bar gear was retired as a duplicate of that row. Another repo's config
  stays a dialog, so opening it does not move you off the repo you are in.
- **Layout**: the Settings pane is two sections built the same way, **General**
  and **Projects**, each a header line over a bordered card. Field widths are
  **container** queries (`@container` on the column, `@md:`/`@xl:` on the grids),
  not viewport breakpoints, because that column is half a pane on desktop and a
  whole screen on a phone: `lg:grid-cols-6` would put six columns in a 360px
  column. Every control carries `w-full`, since daisyUI's `.input` and
  `.textarea` default to `width: 20rem` and otherwise stop short of their label.
  The pane's cap is high enough that on a 1440 screen its own width is what
  binds, and it gives the form three fifths to the JSON pane's two, the JSON
  being a mirror of the form rather than the thing people came to use. Both
  rules generalize and are in [the house style](../skills/html-style/SKILL.md).

  **Two things follow from the form being several screens long** once a repo
  declares projects and pages. The JSON pane **sticks** on desktop and fills the
  viewport (`lg:sticky` plus a `100dvh`-based height), because a pane that
  scrolled away after 600px left a tall dead column beside the rest of the form
  and stopped mirroring exactly when there was something to mirror. And the save
  bar sticks to the bottom of the scrolling pane at every width, since a button
  at the far end of three screens is a scroll each time you use it.
- **One manifest name**: a save writes `.web-tools.json`, the only name read.
  Both editors used to carry a migration path (read the legacy
  `.show-repo.json`, flag it, and land the new name on save); it went with the
  read fallback on the 2026-08-15 sunset, since a migration for zero repos is
  a branch nobody can reach.
- **Projects** (Config view only): the workspace list, `projects`, as its own
  section under the repo-level fields. It reconciles two facts that are easy to
  let drift apart. A project is **declared** by an entry in that array, which is
  what the sidebar, the Repos card, and the project view all read. A project is
  **detected** by the defining convention, a folder carrying `tracker/tasks/`,
  which is what **Scan** reads out of a recursive tree fetch (a button, not a
  load-time read: it is a whole-tree request and the form is useful without it).
  The section shows one list of both, so the two disagreements are visible where
  the fix is: a workspace running a tracker that nothing declares comes with a
  **Declare** button, and a declaration the scan cannot corroborate carries a
  quiet `no tracker` badge rather than an error, since declaring a workspace
  without a tracker is allowed. The repo-root tracker marks the repo itself and
  is never offered, matching home's `tools/generate-tracker-registry.py`, which
  performs the same walk to sync the same field. Detection keys on `tasks/`
  rather than `board.md` because the board is generated and a fresh tracker may
  not have one yet.

  Per entry the form edits `label`, `landing`, and `tracker` (with a **No board**
  checkbox for `tracker: false`). Two rules keep a save from restructuring a
  file nobody opened the form to restructure: an entry keeps the shape it was
  authored in, so a bare path string stays a string until a field is set on it
  and drops back to one when the last field is cleared; and an empty field
  clears its key rather than storing `""`, the same minimality the repo-level
  fields already follow. Adding a project is `projects` only. Creating the
  workspace, its tracker, and its README is repo work that happens in the repo.

- **Pages and Stage** (Config view only): the last two fields that were
  JSON-pane-only. **Pages** lists the catalog, one card per entry, with the path,
  title, note, and the app-view toggle editable and an add-by-path box; a
  qualified `owner/repo[@ref]:path` entry carries a `cross-repo` badge, since
  that file is not in this repo. A page's `icon`, `thumb`, `project`, and
  `viewLabel` are not rendered and are carried through untouched, which is the
  case `config-form.test.mjs` holds: a form that silently dropped the keys it
  does not show would be worse than no form. **Stage** is the two path lists as
  line-per-entry text, the same shape as Pins. **Scope** sits in General beside
  Note, since it is prose about the repo; it renders monospaced when its value
  is a `.md` path, which is the one hint that the field takes both forms.
- **Scope of the form**: every manifest field now has a control except a page's
  `icon`, `thumb`, `project`, and `viewLabel`, and the `links` board path. Those
  are preserved on save and edited in the JSON pane. An icon picker is still the
  open piece.
