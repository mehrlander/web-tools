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
Deep-link params: `&view=atlas|files|stage`, `&file=<path>`, `&path=<dir>`.

Views in the sidebar:

- **landing**: the repo's front door. `landingKind(repo)` decides: web-tools →
  its page gallery; a repo whose manifest names a `landing` → that custom page
  (rendered live through toss-render `#gh=`); every other repo → a synthesized
  overview (stats + README + a jump to the atlas).
- **atlas**: a standing structural view, available for every repo regardless of
  its landing.
- **files**: the explorer: breadcrumb + listing, selected file's content
  beneath. Each row has a `+` that stages the file.
- **stage**: the cross-repo fileset (below).

## The stage: a cross-repo fileset

The stage is `store.stage`, a list of `{repo, ref, path}` refs. Three feeders:

1. the explorer's `+` buttons (add the file you are looking at),
2. a repo manifest's `stage.files`,
3. a `#stage=` link.

Stage-view actions:

- **view** a staged file in the shared viewer (its external links point at the
  file's true home, not the open repo);
- **Concatenated**: the staged files spliced into one block, each under a
  `// === owner/repo[@ref]:path ===` header; **Copy** or **Download** it. Content
  is fetched once per file and cached, so add/remove is free after the first pull;
- **Copy to repo**: transfer the fileset to a destination (below);
- **Save stage**: write the current fileset to the open repo's
  `.web-tools.json` `stage.files`;
- **Copy link**: mint a `#stage=` link that reopens this exact stage.

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
  "landing": "pages/landing.html",
  "pins": ["pages", "lib/alpineComponents", "docs/CONVENTIONS.md"],
  "stage": {
    "files": ["lib/foo.js", "owner/repo@ref:path/to/bar.js"],
    "targets": ["owner/repo:dir"]
  },
  "conventions": "optout"
}
```

- **icon**: Phosphor icon class (e.g. `"ph-scales"`) a repo may self-declare for
  its quick-link button. The quick-link row's icon is actually taken from the
  registry entry (see below); this field is the repo's own suggestion for any
  consumer that reads it.
- **quickLinks** (registry repo only): the curated header quick-link list,
  `[{ repo, icon }]` — membership, order, and icon. Read from the private
  **registry repo** (`web-tools-private`), not from every repo. See "Quick-link
  registry" below.
- **landing**: path to the repo's own landing page, rendered live via
  toss-render `#gh=` (token-authed, so private repos and branches work; gated by
  toss-render's OWNERS allowlist). "The repo builds its own page."
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

### Quick-link registry

The header quick-link row is data-driven, not a hardcoded list. `show-repo` is a
public page, so its source must not enumerate private repos. The shell ships a
public-only default (`PUBLIC_QUICK_LINKS`, just the public web-tools repo). The
real, curated list lives in a **private registry repo** (`REGISTRY_REPO =
mehrlander/web-tools-private`) as a `quickLinks` field in its root
`.web-tools.json`:

```json
{ "quickLinks": [ { "repo": "mehrlander/home", "icon": "ph-house" }, … ] }
```

`loadQuickLinks()` fetches it when the viewer has a token; the registry repo is
private, so no token means the public default only. The **one** private string
this public page names is the registry repo itself, never the repos it lists.
Editing the registry's config in the shield dialog re-runs the load (via the
`web-tools:config-saved` event), so the row updates without a page reload. Adding
or reordering a quick link is: open `web-tools-private` in show-repo, edit its
config on the gear tab, save.

### Config cache (`state/configs.json`)

With a token, show-repo also keeps a **derived** cache of the participating
repos' configs in the registry repo, built by `lib/repo-config-cache.js`. On
load (and after a config edit), it crawls each quick-link repo's
`.web-tools.json` and folds it into `web-tools-private/state/configs.json`,
appending a bounded on-change version history per repo. A per-browser throttle
(`localStorage`, default 6h) keeps the crawl occasional; a material-change check
keeps commits sparse, so nav triggers cost nothing visible.

Source of truth stays each repo's own `.web-tools.json`; the cache is derived,
for breadth (looking across repos at once) and for config history a single read
can't show. show-repo reads a repo's **live** config, not this cache, whenever it
operates on that repo. Stage history falls out for free: a repo's declared
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

## Roadmap (not built)

- A content-carrying `#gz=`-style stage bundle for token-less contexts.
- Batch-as-one-commit transfer (needs the Git Data API; Contents-API
  per-file commits are the current scope).
- Private-repo landing federation via `mehrlander/home` (tracker task 0002):
  with a token, fold featured private repos' landings into the gallery through a
  single `HOME_REPO` hinge; no token, the private section is simply absent.

## Using it from a Claude session

- **Hand the user a browse link:** `…/show-repo.html?repo=owner/repo` (add
  `&ref=` for a branch, `&view=files&path=<dir>` to land in a folder).
- **Hand the user a stage link (🗂️):** mint `#stage=…` per the grammar above.
  State the token caveat. For a token-less reader, download the concatenated
  bundle and `SendUserFile` it instead.
- **Set a repo up for show-repo:** write its `.web-tools.json` (`landing`,
  `pins`, `stage.files`, `stage.targets`).
