# show-repo: browse, stage, and move files across repos

⭐ **Open it:** [show-repo](https://mehrlander.github.io/web-tools/pages/show-repo/show-repo.html) (the hosted shell; append `?repo=owner/repo` to open a repo)

show-repo is one hosted page that browses **any** GitHub repo and moves files
**between** repos. It is the cross-repo instrument: a session hands the user a
link into it, or configures a repo so the shell presents it well. Rendering a
page is a different job (that is `toss-render`, see the boundary below); show-repo
shows and moves files.

This doc is the reference. The `#stage=` link is also a surfacing primitive in
[`CONVENTIONS.md`](CONVENTIONS.md) ("Stage a fileset 🗂️"), the transfer-side
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
Deep-link params: `&view=pages|atlas|files|stage|branches|public|surfaces|todo|activity`, `&file=<path>`, `&path=<dir>`.

**Two context levels.** The page is either in the **estate** (the global,
all-repo context) or in a **repo** (a per-repo context with its own views).

The **header carries the app-level nav**: a fixed, app-owned set of the estate's
own views, **Activity** (first), **Repos**, **Surfaces**, **Stage**, and
**Public browse**, as icon buttons (icon + label on desktop, icon-only on
mobile), lit on the active view and present on every viewport. Beside them, in a
repo, sits a compact `owner/name @ref` readout (the ref switcher is kept; the
GitHub jump too), and on the right the auth shield (token / config dialog). The
brand icon returns to the **dashboard**: Activity for a signed-in viewer, Repos
for a signed-out one. There is no repo-list dropdown and no quick-links row:
**repo selection happens on the Repos dashboard** (a card opens the repo), which
reads better than a dropdown and keeps the header a fixed set rather than one
repos opt into.

The **sidebar** holds what is contextual: in a repo, its views (landing, atlas,
files, branches) plus pins and recents; in the estate, only the repo-sourced
**app views** (promoted with `appView:true`, e.g. News), since those are the
ones repos opt into. The header set never appears in the sidebar. On desktop the
pinned sidebar hides entirely when the estate has no app views, so the dashboard
runs full-width; on mobile it is a drawer behind the hamburger. See "The
estate", "The stage", and "Public browse" below.

The per-repo views in the sidebar:

- **landing**: the repo's front door. `landingKind(repo)` decides: web-tools →
  its page gallery; a repo whose manifest names a `landing` → that custom page
  (rendered live through toss-render `#gh=`), even if the same manifest also
  declares a `pages` catalog; a repo with a `pages` catalog and no `landing` →
  the gallery, fed from that catalog; every other repo → a synthesized
  overview (stats + README + a jump to the atlas). `landing` outranks `pages`
  for this one front-door slot, but never hides the catalog: see **pages**
  below.
- **pages** *(shown only when it adds something the landing button doesn't
  already)*: the standalone gallery entry, for a repo whose manifest declares
  both `landing` and `pages` — the front door went to the custom page, so this
  is where the catalog lives instead. Renders the identical gallery component
  the landing view uses when `landingKind()==='gallery'`; a repo without both
  fields set never needs it and the sidebar omits it.
- **atlas**: a standing structural view, available for every repo regardless of
  its landing.
- **files**: the explorer: breadcrumb + listing, selected file's content
  beneath. Each row has a `+` that stages the file.
- **branches**: the branch review (below).

**GitHub jump-overs.** show-repo is a wrapper over GitHub, not a wall: every
view keeps a one-tap route to the GitHub presentation of what it is showing.
The sidebar top bar links the open repo@ref, the explorer breadcrumb links the
current folder, the viewer's actions link the open file's blob, and every
estate card and surface item carries its github-logo link. A new view should
ship with its jump-over.

## The estate: the all-repo view

The estate (`lib/alpineComponents/estate.js`) is the central dashboard over the
whole repo constellation, and the page's global context (above any single repo,
reached from the header selector's "Repositories" entry, the brand icon, or a
bare page open). It is a context with **three views of its own**, switched from
the sidebar the way a repo shows landing/atlas/files/…:

- **Repos** (`?view=estate`) — the repo cards.
- **Surfaces** (`?view=surfaces`) — the curated surfaces.
- **To-do** (`?view=todo`) — a general personal checklist (below).
- **Activity** (`?view=activity`) — the cross-repo activity read (below).

One component renders all three, switching on the shell view, sharing one lazy mount.

**Repos: membership and fields live on each repo.** A repo appears on the estate
by opting in with `estate: true` in its **own** `.web-tools.json`. Every
descriptive field is the repo's too: `group`, `note`, `icon`, `order`, plus its
`pins` and `landing`. The registry holds **no per-repo config**. The single
source of truth for how a repo appears is the repo.

The estate discovers members by enumerating the account's repos (`gh.repos()`,
one list call that also carries description / visibility / pushed-ago) and
reading each one's config. Reads are served through the registry's **config
cache** (`state/configs.json`, below), so a normal load is two GETs, not an
N-repo scan; a cold cache falls back to a live per-repo scan and then rebuilds.

Cards lay out full-width as a three-wide grid grouped by `group` (a section
header + count per group, like the pages index). Group order and within-group
order both derive from each repo's `order` (a group sorts by its lowest member's
order). An `owner/foo-private` companion folds into `owner/foo`'s card by naming
convention (both on the estate; no field), where the visibility glyph becomes a
**toggle**: tap it to flip the card to the private repo's face (title, icon,
note, gear, jumps all switch) and back. The card name opens the repo in the
shell; the github-logo opens it on GitHub; the cloud-download icon opens the repo
in **Public browse**; the `pins` render as direct-jump chips. The gear opens the
shared repo dialog on its **Settings** tab (a form for `icon` / `group` / `note`
/ …, beside the raw-JSON **Config** tab and the **Info** tab), which writes the
repo's own `.web-tools.json` without navigating away.

**Adding a repo** sets `estate: true` (plus `group` / `note`) in the chosen
repo's own config through the viewer's token (candidates come from the header
picker's account list, minus current members). So both add and edit write the
**repo**, never a registry list.

**Surfaces** are `surfaces/*.surface` files in the **registry** (these are
estate content, not a repo describing itself, so they stay there): the surfacer's
format (a `manifest` block and an `items` array; see the home repo's
`projects/surfacer/VISION.md`). They render tabbed, sorted `default` → `standing`
→ `showcase` (`archive` excluded), each editable in place through a JSON dialog
(gear on the surface header; "New" seeds a fresh one). Rendered item kinds:
`github_blob` / `github_dir` (open-in-shell + GitHub link; target as `{repo, ref,
path}` or a github.com URL), `url` (external link), `note` / `story` (inline
body). An agent session with registry access can write or extend a surface; the
estate shows it on next load.

**To-do** (`?view=todo`) is a general, personal checklist: not repo-scoped and
not a surface, so it keeps its own tiny file, `state/todo.json` in the
registry (`{items: [{id, text, done, created_at, done_at}]}`), rather than
reusing the surfaces schema. Add a line, check it off, or delete it; a
checked item moves into a collapsed "done" pile instead of disappearing, so
delete is the only way an item actually goes away. Every mutation writes the
whole file straight through the viewer's token (`gh-store.js`'s `save`), the
same as a surface edit, so it is durable across browsers and devices, not a
per-browser `localStorage` list. Token-gated like Surfaces: no token, no list.

**Activity** (`?view=activity`) is the cross-repo read: recent commits across
the estate, a per-repo rollup (branch counts, landed / stranded, open PRs), and
a peek at each repo's open PRs and stranded branch names, every row deep-linking
into that repo's branch review. It reads the registry's **activity cache**
(`state/activity.json`, below) in one GET, so the whole estate renders without a
per-repo API fanout. The Repos view borrows the same cache twice: a **recent-
activity strip** at the top (the landing widget, a few freshest commits with a
jump to Activity) and a **freshness rollup** on each card (branch count, stranded
count, open-PR count, the branch count a one-tap route into the branch review).
The view's Refresh forces the crawl through the shell (`refreshActivity`); a
normal visit kicks it throttled.

The cache is what makes this affordable. The branch review costs ~2 + 2N calls to
survey N branches, so surveying every repo live on a dashboard is a flood.
Instead `refreshActivityCache` crawls each estate repo on a ~12h per-browser
throttle (heavier than the config crawl, so a longer interval) and stores the
capped landed/stranded survey plus cheap summary signals; the branch review, the
estate cards, and this view all render from the stored result. The per-repo
branch review is **cache-first** too: with a token it renders Landed / Stranded
from `state/activity.json` and marks the header `cached`, running the live fanout
only on an explicit Refresh or where the cache has no coverage. Same survey math
either way (`lib/branch-survey.js` `surveyBranchLive`, shared by the view and the
crawl). Source-of-truth rule as ever: the cache is derived and may be briefly
stale; Refresh re-surveys live.

Token gating: no token means the public default card only, no surfaces, no
activity, and no write controls. In that state the Repos view leads with a
**public banner** that says exactly what is and isn't available and offers the
two real next steps, a token or Public browse, instead of a vague "set a token"
aside. Deep links: `?view=estate` (the bare URL is the Repos estate already; the
param is stamped only when a `repo`/`ref` param is also present), `?view=surfaces`
and `?view=activity` (always stamped, so each is shareable on its own).

**The shield dialog is scoped by context.** Opened from the sidebar shield at the
estate level it is an **account panel**: the token control plus the estate
actions (**Refresh views**, which forces a config-cache rebuild), with no repo
tabs. Opened from a card gear or the repo-level shield it is the **repo dialog**:
the **Info** tab (repo facts, the token control, a Public-browse shortcut, and
the repo name as the one-tap GitHub link), plus the **Settings** and **Config**
tabs. The dialog's former GitHub / jsDelivr-CDN / flat-tree link list was retired
(2026-07-19): GitHub is the header link, and a file listing lives in Public
browse.

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

## The stage: a cross-repo fileset

The stage is `store.stage`, a list of `{repo, ref, path}` refs (plus transient
local items from drops). It is an **estate view**, beside Repos and Surfaces:
one stage above any repo, since every item carries its own origin. Takes from:

1. upload: the drop-zone (a file, or pasted text; pasted ref lines stage as refs),
2. a repo: the grab picker in the view (a tap-through path selector over the
   estate's repos; no text input, so no keyboard or iOS focus zoom), or the
   explorer's `+` buttons while visiting a repo,
3. a repo manifest's `stage.files` (seeds an empty stage when that repo opens),
4. a `#stage=` link.

Stage-view actions:

- **Recent / Search**: the finder, two tabs. Recent is the latest committed
  files across the estate's root repos (one `recentFiles()` sweep per repo,
  loaded when the stage is first shown), filterable by per-repo pills
  (single-select: tap to show only that repo, tap again for all). Search is
  filename-contains over the same repos' full trees (one cached
  recursive-tree call per repo; matching is local per keystroke). Either way
  each row is one tap to stage, a second to unstage, and the muted line reads
  `repo · folder`;
- **view** a staged file inline (a preview panel in the stage itself, with a
  GitHub jump-over to the file's true home; it never routes through a repo's
  Files view);
- **Out / Diff**: the deposit surface, two lenses in the finder's open style.
  Out covers everything leaving the stage: the concatenated bundle (each file
  under a `// === owner/repo[@ref]:path ===` header; icon actions to view,
  refresh, copy, download — the block renders on demand, since copy and
  download never needed it on screen) and the send-to-repo (destination is
  the tap-through selector in folder mode; two-tap Send). Diff is a line diff
  of two staged items (a pasted local file counts), each side optionally read
  at an override ref, so the same file picked twice with one ref changed is
  the version diff. (The base...head branch compare is not here: it lives
  under the Branches view, with the review it serves.);
- **Save stage**: write the ref list to a NAMED repo's `.web-tools.json`
  `stage.files`. The stage belongs to no repo, so saving one means saying
  where: the registry by default (a general staging), or any repo the field
  names. Refs outside the target save fully qualified;
- **Persistent link**: mint the `#stage=` URL that reopens this exact stage
  anywhere (ref items only; local files cannot ride a link).

### The `#stage=` link grammar

```
#stage=owner/repo[@ref]:path1,path2;owner2/repo2:path3
```

Groups are `;`-separated, paths `,`-separated within a group, `@ref` optional
(absent means the source repo's default branch). Paths are URL-encoded per
component with `/` left readable. The link carries **refs only**; file content
stays behind the viewer's token. Full base:

```
https://mehrlander.github.io/web-tools/pages/show-repo/show-repo.html#stage=owner/repo@ref:path1,path2
```

Mint one by hand by grouping items by `repo@ref` and joining. Example: two files
from a branch of this repo plus one from another repo →

```
…/show-repo.html#stage=mehrlander/web-tools@my-branch:lib/gh-api.js,lib/stage.js;mehrlander/home:inbox/note.md
```

#### Commentary: the `&prompts=` param

A link is one object with two halves, **refs** (the `#stage=` spec) and
**commentary** (an optional `&prompts=` param). The refs are pointers, so their
content stays behind the token; the prompts are authored text, so they ride the
link. `prompts=` is a base64url'd JSON list of `{label, ask}` review asks:

```
…/show-repo.html#stage=owner/repo@ref:before.md;owner/repo@head:before.md&prompts=<base64url(JSON)>
```

The Diff lens shows those bespoke asks first (a sparkle marks them), above its
six fixed general prompts, each still one-click-copying both compared texts plus
the diff plus that ask.

An optional `&mode=diff` is the third part of the object: the intent that this
stage opens as a diff. A `mode=diff` link opens on the **Diff** tab and runs the
compare on open (no click), so a review link lands the reviewer straight on the
diff; without it a stage opens on **Out** (a bundle handoff). `StageLink.mint(items,
base, { prompts, mode })` encodes all of it (a bare prompts array is still
accepted for the legacy call), and `StageLink.parseLink(hash)` returns `{ items,
prompts, mode }`; the bare `StageLink.parse(hash)` still returns just the items
for callers that only want refs. A soft cap (24 entries) keeps a runaway prompt
list from bloating the URL. This `{refs, commentary, mode}` shape is the seed of
a richer surface schema: the same object a manifest's `stage` block or a future
standalone surface file would carry, with file content the file-only extra the
token-gated link cannot hold.

`StageLink.read(location)` reads that object from the **hash first, then the
`?query`** (same keys: `stage`, `prompts`, `mode`). The fragment stays the
default and the private form; the query fallback is what lets a stage ride a
context that eats the `#`: a `toss-render` srcdoc (whose params shim answers
`?query` lookups, so `…show-repo.html?stage=…&mode=diff` renders a staged diff
inside the toss), an email or chat that strips the fragment, a deep link. When
minting a query-form link into a toss `#gh=` address, encode the inner `&`
separators as `%26` so the toss's own hash parser keeps them inside the `gh=`
value.

## The branch review: landed / stranded per branch

The **branches** view (`lib/alpineComponents/branches.js`) rolls every branch of
the open repo into **recently active** (commits in the last 14 days; judge
nothing yet), **likely landed**, and **likely stranded**, on a content-level
signal rather than `ahead_by`: which of the branch's uniquely-touched paths
hold, at the branch tip, bytes the default branch holds right now, at the same
path or moved anywhere in the tree. **Missing** counts paths absent from the
default branch in both path and bytes, the strong stranded evidence. Squash
merges and history rewrites make ref-level "unmerged" (and `ahead_by`, whose
count on a rewrite-orphaned branch spans its whole line, marked `*`) unreliable;
the content columns are the ones to read.

The math is the browser port of home's `tools/branch-survey.sh` (the CLI
reference instrument), lives in `lib/branch-survey.js` as pure unit-tested
functions, and is held in agreement with the CLI by
`scripts/check-branch-survey.mjs` (on home's 56-branch estate: 52 exact, 4
divergent only where the CLI's git rename detection credits moved-and-evolved
content the API cannot see, all in the conservative direction). Fetch cost: one
branch list, one recursive tree for the default branch, then per branch one
compare (with a commits-list fallback for no-merge-base branches) and one
recursive tree, streamed so rows fill in as they land.

Advisory and read-only, matching the CLI's posture: the view frames the
per-branch reconcile judgment and decides nothing. Each row jumps to the branch
tree and `main...branch` compare on GitHub (ground truth), opens the branch or
the in-shell compare here, and the header links GitHub's branches UI, where the
delete action itself lives. Deep link: `?view=branches`.

## `.web-tools.json`: the repo manifest

Root `.web-tools.json` is the repo's **web-tools config file** (canonical location
documented in [PORTABLE.md](PORTABLE.md)). show-repo is one consumer: it reads the
`landing`, `pins`, and `stage` fields to decide how to present the repo. Those
fields sit at the top level, not under a `showRepo` key, because they describe the
repo in ways any web-tools page may read, not just this shell. The shell probes
the file once per `repo@ref` (a 404 means no config), parses it as **data**, never
executed, and falls back to the legacy `.show-repo.json` name during the rename's
deprecation window. Fields:

```json
{
  "icon": "ph-scales",
  "estate": true,
  "group": "data",
  "note": "One-line description shown on the estate card.",
  "order": 30,
  "quickLink": true,
  "landing": "pages/landing.html",
  "pages": [
    { "path": "pages/news/news.html", "title": "News", "note": "The news dashboard.",
      "appView": true, "viewLabel": "News", "icon": "ph-newspaper" }
  ],
  "pins": ["pages", "lib/alpineComponents", "docs/CONVENTIONS.md"],
  "stage": {
    "files": ["lib/foo.js", "owner/repo@ref:path/to/bar.js"],
    "targets": ["owner/repo:dir"]
  },
  "conventions": "optout"
}
```

The **estate placement** fields let a repo describe how it appears on the
all-repo estate. Membership is a repo property: there is no registry list of
repos. All are optional; a repo with no config is simply off the estate.

- **icon**: Phosphor icon class (e.g. `"ph-scales"`) for the repo's estate card
  and its header quick-link button. The repo owns it.
- **estate**: `true` to appear on the estate. The estate enumerates the account's
  repos and includes those whose config sets this.
- **group**: the estate section this card sits in (e.g. `"core"`, `"data"`).
- **note**: the card's one-line description; overrides the GitHub description.
- **order**: arrangement weight. Group order (a group sorts by its lowest
  member's `order`) and within-group order both derive from it.
- **quickLink**: `true` to appear in the header quick-link row, ordered by
  `order`, icon from this repo's `icon`.
- **landing**: path to the repo's own landing page, rendered live via
  toss-render `#gh=` (token-authed, so private repos and branches work; gated by
  toss-render's OWNERS allowlist). "The repo builds its own page." Takes the
  front-door slot ahead of `pages` when a repo sets both: the custom page is
  the landing, and the catalog moves to the standalone **Pages** sidebar view
  instead of disappearing. A repo with only `pages` (no `landing`) still gets
  the gallery as its landing, unchanged.
- **pages**: a hand-declared page catalog: a flat list of `{ path, title, note }`
  entries (optional `icon`, `thumb`, and the app-view fields below). A repo
  declaring a non-empty `pages` gets the **gallery**: the same card grid
  with the screenshot / live / source toggle, chip grouping, and search that
  web-tools gets from its generated `pages.json`, but fed from this hand-declared
  catalog as one group. It surfaces as the **landing** when the repo has no
  `landing` field, or as a standalone **Pages** sidebar entry when the repo
  also has one (so `landing` and `pages` aren't mutually exclusive: a repo can
  set both, and both stay reachable). A private repo has no committed
  thumbnails, so each tile renders **live** through toss-render `#gh=`
  (token-authed, lazy on scroll); the source toggle reads the file through the
  viewer's token. This is a sibling to `pins`/`stage.files`, maintained by
  hand. (web-tools keeps its generated `pages.json` for its own gallery; the
  component reads whichever catalog a repo offers.)
  - **path**: the page. A **bare repo-relative path** (`"pages/foo.html"`, this
    repo at its default branch) or a **qualified cross-repo ref**
    (`"owner/repo[@ref]:path"`), the same grammar as `stage.files`. The
    cross-repo form lets a repo promote a page whose file lives elsewhere: home
    declares the news app view as `"mehrlander/web-tools:pages/news/news.html"`,
    owning the promotion while the renderer stays in web-tools (the page reads
    home's data through the viewer's token regardless of where it is hosted).
  - **title**: the card's heading (defaults to the filename).
  - **note**: the card's one-line description.
  - **icon**: Phosphor class, used as the app-view sidebar icon when promoted.
  - **appView**: `true` to promote this page to its own **estate-level view**,
    a peer of Repos / Surfaces / Stage in the switcher (the `quickLink` pattern,
    one level up: the target is a rendered page, not a repo). Collected across
    every repo's config through the config cache, token-gated (no token, no app
    view, like Surfaces), and rendered live in the estate main area via
    toss-render `#gh=`. The page still appears in the repo's own gallery too;
    the flag is additive.
  - **viewLabel**: the sidebar label for the promoted view (defaults to `title`,
    then the filename).
- **pins**: folders/files surfaced in the sidebar Pinned block. A last segment
  with an extension opens as a file; otherwise it opens the Files view at that
  folder.
- **stage.files**: a durable staged-files list. Entries are **bare paths**
  (`"lib/foo.js"`, meaning this repo at its default branch) or **qualified refs**
  (`"owner/repo[@ref]:path"`). Seeded into the stage only when the stage is
  otherwise empty, so a working set the user built always wins.
- **stage.targets**: default transfer destinations (`"owner/repo:dir"`
  strings), offered in the Copy-to-repo field.
- **conventions**: not a show-repo field. `"optout"` marks a repo that has
  deliberately not adopted the portable conventions, so a session-start nudge
  stops asking. Absent means unset. Documented in [PORTABLE.md](PORTABLE.md).

### Quick-link row

The header quick-link row is data-driven, not a hardcoded list. `show-repo` is a
public page, so its source must not enumerate private repos. The shell ships a
public-only default (`PUBLIC_QUICK_LINKS`, just the public web-tools repo). With
a token, `loadQuickLinks()` reads the **config cache** (below) and takes every
repo opting in with `quickLink: true`, ordered by its own `order`, icon from its
own `icon`. Membership is a repo property, like estate membership: there is no
registry list. The **one** private string this public page names is the registry
repo itself (`REGISTRY_REPO = mehrlander/web-tools-private`), where the cache
lives, never the repos in it. Editing a repo's config re-runs the load (via the
`web-tools:config-saved` event), so the row updates without a page reload. (A
legacy `quickLinks` list in the registry is still read as a fallback until the
cutover.)

### Config cache (`state/configs.json`)

With a token, show-repo keeps a **derived** cache of the account's repo configs
in the registry repo, built by `lib/repo-config-cache.js`. `refreshConfigCache`
enumerates the account's repos (`gh.repos()`) and folds each one's
`.web-tools.json` into `web-tools-private/state/configs.json`, appending a
bounded on-change version history per repo. A per-browser throttle
(`localStorage`, default 6h) keeps the crawl occasional, forced after a config
save; a material-change check keeps commits sparse.

This cache is the **read path** for estate membership and the quick-link row, so
a normal load is two GETs (the cache + the account list), not an N-repo scan; a
cold cache falls back to a live per-repo scan and then rebuilds. Source of truth
stays each repo's own `.web-tools.json`; the cache is derived, for breadth
(reading across repos at once) and config history a single read can't show. The
per-repo write flows (add-to-estate, the placement editor) read a repo's **live**
config, not this cache, whenever they
operate on that repo. Stage history falls out for free: a repo's declared
`stage.files` lives in its config, so versioning the config versions the declared
stage. Design and future ideas: `web-tools-private/DESIGN.md`.

### Mailbox (`mailbox/requests` → `mailbox/results`)

An async request/response channel between an agent session (limited repo scope)
and show-repo (the user's full-access token), built by `lib/repo-mailbox.js`.
The agent drops a request file in the registry repo; show-repo, on load with a
token, fulfills every pending request and writes the result back; the agent
reads it on a later turn. This lets the agent see files and answers from repos it
never added to its own scope, by borrowing the browser's token asynchronously.

`processMailbox()` polls once per page load (a pending request wants prompt
service, and listing is one call), keyed by request filename so nothing re-runs.
It is **read-only**: the kinds (`tree`, `branches`, `fetch`) only read the user's
repos and only write results into the mailbox, so auto-fulfilling on load never
spends write access on agent-authored instructions. It is manual-triggered, not
live: show-repo is the worker and only runs when the user opens it. Protocol and
schema: `web-tools-private/mailbox/README.md`.

### Editing the manifest from the shell

The sidebar **shield** dialog (the repo dialog, `repoModal` in
`lib/alpineComponents/repo.js`) has two tabs, switched top-right: a **link** tab
(repo info, stats, auth, and URLs) and a **gear** tab, the config editor for the
**currently-open repo**. The editor is a JSON editor over the repo's manifest:
it loads the current `.web-tools.json` (or an all-empty template when the repo
has none, so the shape is there to fill in), validates on every keystroke, links
to this doc for the field format, and on Save commits the file through the
viewer's token (`gh-store.js`'s `save`, a Contents API PUT to the repo's default
branch). Editing needs auth, so Save is disabled until the link tab's token is
set.

- **Where it lives**: a tab in the shield dialog rather than a standalone
  control, so the repo's stats, links, auth, and config sit in one place.
  Switching to the gear tab seeds the editor.
- **Auto-migration**: a save always writes `.web-tools.json`. A repo still on the
  legacy `.show-repo.json` is edited the same way; the save lands the new name,
  which readers already prefer, so the legacy file goes inert. No delete step
  (the gh layer has no delete helper), and the section flags the migration when
  it loaded from the legacy name.
- **Scope**: this is a raw-JSON editor, the thin first slice of the config-edit
  surface (tracker task 0013). Per-field controls (an icon picker, a pins list)
  are the larger goal, not built here.

## Transfer: moving files to another repo

"Copy to repo" writes the staged fileset to a destination via `gh-transfer.js`
(lazy-loaded on first send). Mechanics:

- Destination spec: `owner/repo`, `owner/repo:dir`, or `owner/repo@ref:dir`.
- Each file lands as **its own commit** through the Contents API; the payload
  stays **base64 end to end**, so binaries copy as faithfully as text.
- **Two-tap confirm**: the first tap arms for 3 seconds, the second sends. A
  cross-repo write with the viewer's token stays a deliberate gesture.
- Writes land on the destination's **default branch** unless an `@ref`/branch is
  given.
- The Contents API caps a file at ~1 MB; a larger file **errors** rather than
  writing an empty file at the destination.
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
  (the toss `#gh=` address plus a base); token-gated the same way. Folding its
  per-file dossier (`lib/alpineComponents/file-review.js`) into this shell as a
  view is on the roadmap below.

## Roadmap (not built)

- A content-carrying `#gz=`-style stage bundle for token-less contexts.
- A review view: mount `fileReview` cards (pages/review.html's dossier) over
  the stage's Compare result, so a ref-diff reads in place instead of only
  listing files.
- Batch-as-one-commit transfer (needs the Git Data API; Contents-API
  per-file commits are the current scope).
- Private-repo landing federation via `mehrlander/home` (tracker task 0002):
  with a token, fold featured private repos' landings into the gallery through a
  single `HOME_REPO` hinge; no token, the private section is simply absent.

## Using it from a Claude session

- **Hand the user a browse link:** `…/show-repo.html?repo=owner/repo` (add
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
  plus kind fields); flip a surface's `category` to `archive` to retire it.
