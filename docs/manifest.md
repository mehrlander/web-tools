# `.web-tools.json`: the repo manifest

The manifest is how a repository tells the Web Tools app, and any other
web-tools page, how to present it. This is its reference: the file's contract, the
membership rule, the config cache, errands, inbox and outbox, proposals, and
editing the manifest from the app. The field list itself
stays data, one row per key in [manifest-fields.csv](manifest-fields.csv), held
to the estate's real manifests by `node/test/manifest-registry.test.mjs`; this
doc is the prose around that registry, not a second copy of it.

Each registry row gives a key's type, the tool that reads it (`consumer`), and
what it does. Members of an array or object key are rows of their own
(`pages[].path`, `stage.files`), and a `required` column says whether a member
has to be present. The gate checks every key present in a real manifest against
a row, so a field used without being written down fails the test. What stays in
prose is design rationale and cross-field behaviour.

Root `.web-tools.json` is the repo's canonical **web-tools config file** and the
only config filename any reader uses. Its fields sit at the top level, not under
a tool-specific key, because any web-tools page may read them; the Web Tools app
is one consumer, reading `landing`, `pins`, and `stage` to decide how to present
the repo. The app probes the file once per `repo@ref` (a 404 means no config)
and parses it as **data**, never executed. Fields:

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

**Every promoted page declares one.** The shell's `stamp()` rewrites the address on
every navigation, writing the slug where the open view has one and the five-key
`appRepo`/`appPath`/`appLabel`/`appIcon` form where it does not. A page without
a slug therefore cannot hold a short address: the middle form,
`?app=owner/repo[@ref]:path`, parses and opens, but the first tap inside the app
replaces it with the long one.

A deep link INTO a promoted page rides the fragment, not the query. The shell
owns the query and the subject owns the fragment, so
`?app=news#view=archive&q=budget` hands `view=archive&q=budget` to the page as
its own params, and neither side needs to know the other's key names (the
shell's route table and a framed page's params already collide on `view` and
`tab`). The rule and its fallback for contexts that strip the '#' are in
[`lib/kits/url-params.js`](../lib/kits/url-params.js) (`subject()`), pinned by
`node/test/url-params.test.mjs` and `node/test/app-view-address.test.mjs`.

Every path in the config is an address, and `dead-links.py`, which reads only
Markdown, never sees one. [`python/declared-paths.py`](../python/declared-paths.py) checks `landing`,
`pages[].path` and `stage.files` against the working tree and sibling checkouts;
run it in the declaring repo's own verify suite, since the mover is the only
party who can catch a rename at the moment of the rename. If a page is worth
another repo embedding, it is worth declaring here.

**Membership is a repo property.** There is no registry list of repos. All
fields are optional, and a repo with no config is simply off the estate.

**`hidden` is the one field about the viewer.** It lives only in the private
registry's own manifest, as an array of `owner/repo` strings, and it is the
single exception to the no-registry-list rule: it decides nothing about a repo,
and a hidden repo keeps `estate: true` and every field it declared. Its effect
is in its [manifest-fields.csv](manifest-fields.csv) row (opening a hidden repo
by address still works), and
[views/repos.md](views/repos.md) separates it from `conventions: 'optout'`.

**`landing` and `pages` are not mutually exclusive.** A repo setting both gets
the custom page as its front door and the catalog as a standalone Pages view;
setting only `pages` gets the gallery as the landing. Neither arrangement hides
the other.

**When an app view is the right call.** A view whose subject is *the estate* is
built into the shell (the rows of [app-routes.csv](app-routes.csv) with group
`estate`, the Lists pane among them). A view whose subject is *content* is an
app view over the repo that owns it: the renderer stays public here, the content
stays wherever it belongs. News and Links are both that shape, home's data
through a web-tools page. Two consequences before building one: the page gets
the main area minus the sidebar, so it has to survive at two thirds width; and
the shell already supplies a header and the sidebar label, so a promoted page
should stand its own masthead down when `window.self !== window.top`
(`pages/links.html` does, `pages/news/news.html` does not yet). An app view
cannot reach the shell's chrome at all, being in an iframe, so anything wanting
persistent presence has to be built into the shell instead.

**Checks.** A check asks a question about *data* and never runs code; anything
needing execution stays in a test suite, so a repo declaring no checks pays
nothing. Only what is *not* passing renders, on either surface. A check that
cannot be evaluated renders too, in grey rather than amber, since a check whose
file was renamed out from under it has been silently invalidated. A repo view
evaluates its checks live on open; the estate grid judges the facts the crawl
stored, so a threshold edit or a removed check reaches the cards on the next
crawl that runs checks (one that skipped them keeps what it had). Why the cache
holds facts rather than verdicts is the header of
[`lib/kits/repo-checks.js`](../lib/kits/repo-checks.js); the kinds and their
parameters are the `checks[]` rows of the registry.

**`tracker` is the one content-typed check kind.** It reads a tracker's typed
projection ([TRACKER.md](TRACKER.md)) and counts, which is what puts *"6
awaiting someone"* on a repo card. Quiet is measured from the *oldest open task*
and only when `staleAfterDays` is declared; done tasks are excluded from every
count.

**Links: two declarative layers.** *Which board* is the `links` field. *What is
on the rail* is the board itself: the `rail` flag, array order, and each item's
`icon`, `title`, and `doors`. The rail sits at the far end of the header,
icon-only and desktop-only; the sidebar's Links block is the phone's route to
the rail and the wide reading of it on desktop. A `snippet` item is skipped in
both: a `javascript:` URL is something to copy, not somewhere to go.

**Projects.** A project gathers related work that needs an ongoing home.
Its declaration in `projects` makes it visible in the sidebar and Map. A tracker
is optional: `tracker: false` declares a project with no board. When present,
the conventional board is `<workspace>/tracker/board.md`; a custom `tracker`
path names another board. A repo-root tracker belongs to the repo itself.
The shared placement rule is in [CONSTELLATION.md](CONSTELLATION.md#projects-and-research).

The field is declarative rather than discovered live (walking a tree for
`tracker/` dirs is API-costly). A generator may discover projects from
trackers, but must retain explicitly declared projects without trackers. The
estate sidebar reads the field from the config cache; the open repo reads its
own live manifest at the browsed ref. So a `projects` field existing only on a
branch is invisible from the estate (the cache is a main-derived artifact) until
it merges, while the repo's own sidebar shows it as soon as you browse the
branch.

**Two fields are not the app's.** `conventions` is read by the portable
conventions and `sessions` by a plugin hook outside any page. The registry's
`consumer` column carries that distinction for every field.

## Research declarations

`research` is an optional array of retained research accounts. Each entry has a
repository-relative Markdown `path`, a short `label`, and `kind` set to `probe`
or `exploration`. The label names the inquiry; the account holds the findings
and links to its materials. A package's `README.md` represents its folder.
An individual Markdown report represents itself. Do not declare research under
`docs/`. Existing research elsewhere can be declared without renaming it.

Map reads the selected hub revision and the other repositories' configuration
cache. Projects are matched by the longest declared project path containing
the account. A repository-level account needs no artificial project. Docs
excludes declared research, plus folders named `research` or `probes`, from
the cross-repository Markdown listing. The crawl remains an inventory of
Markdown bytes; classification belongs to the view, not the file extension.

## Stores

`stores` declares a repository's collections of entries other than its CSV
registries, each with a shape and a provenance
([registries.md](registries.md#registries-and-streams)). Each repository declares
its own, so this public hub names no private layout. `writers` are keys in the
[writers registry](writers.csv).

```json
"stores": [
  { "path": "notes/notes.jsonl", "shape": "stream", "provenance": "authored",
    "key": "id", "time": "at", "writers": ["session-web", "session-local", "app-tap"] }
]
```

The single-path keys (`notes`, `sessions`, `captures`, `inbox`) stay: they tell a
tool where to write, and a store at the same path says what the collection is.

## One membership list

A repo is in the estate when its own `.web-tools.json` says `estate: true`. That
one answer, aggregated by the config cache, serves every consumer: the Repos
grid, the sidebar index (`estateRepos`), the activity crawl, the stage's repo
pickers, and the Map's adoption roster. The **one** private string this public
page names is the registry repo itself
(`REGISTRY_REPO = mehrlander/web-tools-private`), where the cache lives, never
the repos in it. A prominence subset, if one is wanted, belongs in `order` on
the membership, not in a second flag or a central list.

## Config cache (`state/configs.json`)

Map Tests uses this cache to discover repositories' current execution
declarations and dated check readings. The declaring repository owns both;
their placement and the distinction between a workflow and its results are
explained in [the Map's Tests account](views/map.md#tests-what-checks-protect-and-how-they-run).

With a token, the app keeps a **derived** cache of the account's repo configs
in the registry repo, built by `lib/kits/repo-config-cache.js`. `refreshConfigCache`
enumerates the account's repos (`gh.repos()`) and folds each one's
`.web-tools.json` into `web-tools-private/state/configs.json`, appending a
bounded on-change version history per repo. A repo not pushed since this
browser last read its config is skipped (a `pushed_at` mark in `localStorage`),
so a pass over a quiet account reads no repo's config; a config save forces a
full pass, and a material-change check keeps commits sparse.

This cache is the **read path** for estate membership, so
a normal load is two GETs (the cache + the account list), not an N-repo scan; a
cold cache falls back to a live per-repo scan and then rebuilds. Source of truth
stays each repo's own `.web-tools.json`; the cache is derived, for breadth
(reading across repos at once) and config history a single read can't show. The
per-repo write flows (add-to-estate, the placement editor) read a repo's **live**
config, not this cache, whenever they
operate on that repo. A repo's declared `stage.files` lives in its config, so
versioning the config versions the declared stage. Layer model: `web-tools-private/README.md`, "Three layers".

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
errand. File `errands/requests/<id>.json` on the registry's `background`
branch, not main, with the fields in `lib/kits/errands.js`, and hand the user
`?view=stage&errand=<id>`. Nothing the Stage performs runs until they tap,
reads included. The answer lands at `errands/results/<id>.json` on the same
branch. The scripts an errand runs stay on main (`errands/prompts/`, `sites/`),
where `run.script` addresses them; web-tools-private's README, "Three layers",
says why the records moved.

Three methods need no one at the Stage, because none borrows the Stage's
token:

- **`workflow-run`** (venue `actions-hosted`) is a script run by
  `.github/workflows/errand-browser.yml` on a GitHub-hosted runner, under the
  job's own read-only token. The session dispatches it, reads the `RESULT`
  line from the job log, and writes the result file to `background` itself. Use it for any
  check a browser can make without a person: live GitHub, WebKit, Chromium.
- **`device-link`** (venue `iphone`) is one link the person opens on the
  device: `pages/scratch/toss-top-probe.html` with `probe=<id>` and a `steps=`
  list. The page runs every step itself, shows its progress in a banner, and
  writes `errands/results/<id>.json` with the token the device already holds.
  Use it only for what a device alone can say, such as whether iOS keeps the
  tab alive; `node/test/probe-driver.mjs` checks the driver before a person
  is asked to open anything.
- **`laptop-daemon`** (venue `personal-laptop`) asks Gemini, through the
  laptop daemon, to do something, usually to answer a prompt. File
  it with `sessions/tools/errand_runner.py` in web-tools-private. While the
  laptop is awake, the daemon forwards the errand to Gemini and writes Gemini's
  reply to the result file. Declining the errand on the Stage cancels it.

## Inbox and outbox

Two optional manifest fields naming where material lands and where it is
staged. `inbox` is the **receiver's** declared landing spot for a deposit that
names no directory; `outbox` is a **sender's** folder of material it is making
available to be pulled. Both are read by `lib/kits/repo-address.js`
(`RepoAddress.box(config, 'inbox'|'outbox', repo)`).

**A box is a folder by default, and can name a branch**, as a per-repo choice:

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
one but cannot create a ref. A repo that wants transient bulk kept off its main
history names a ref.

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

**Declared, not derived**, unlike the sibling `tracker` field: a wrong guess at
a write target files a deposit into a plausible folder that nothing drains. The
`inbox`, `projects` and `projects[].inbox` rows of the registry give the
reasoning.

**Destination pills.** The Stage view's Out pane renders every declared box
across the picker's repos as a one-tap strip under the destination picker, read
from the shell's config cache, so the strip costs no fetches. Only **declared**
boxes appear; the picker beside it lists every folder that exists, and a repo
with no pill is visibly missing a declaration. Tapping a pill sets the
destination and the picker's own trigger label together.

**Outbox, on the pull side.** A repo declaring one gets an **Open outbox** row
in its repo menu, which opens the Files view at that folder. The menu itself is
`lib/alpineComponents/repo-menu.js`, and the comment above `repoMenuItems` in
`app/index.html` describes its lists. The pull itself is ordinary browsing or
staging from there. For a **public** repo the outbox is also the one cross-repo
handoff that needs no token at all:
`raw.githubusercontent.com/owner/repo/<ref>/<path>` serves it to any reader.
On the private side, pasted text (not repo files) can ride a `#gz=` stage link
with no token ([stage.md](stage.md#content-the-gz-param)).

## Proposals

The write-side counterpart to errands, the Proposals view, is documented in
[views/proposals.md](views/proposals.md).

## Editing the manifest from the shell

Two surfaces edit the same file. The **Config view** (`lib/alpineComponents/config.js`,
the sidebar's Config row) covers the **currently-open repo**: a Settings form
and a raw JSON pane, kept in sync both ways. The **repo dialog** (`repoModal` in
`lib/alpineComponents/repo.js`) covers **any** repo without navigating to it,
reached from an estate card's gear, a sidebar Repos row, or the Map; its
**Settings** and **Config** tabs are the same two panes. The layout is
described in `config.js`'s comments; the rules that generalize are in
[the house style](../skills/html-style/SKILL.md).

Either way the JSON editor loads the current `.web-tools.json` (or an all-empty
template when the repo has none), validates on every keystroke, links to this
doc for the field format, and on Save commits the file through the viewer's
token (`gh-store.js`'s `save`, a Contents API PUT to the repo's default
branch). Save is disabled without a token. A save writes `.web-tools.json`, the
only name read.

- **Projects** (Config view only) edits `projects` and lists declared and
  detected workspaces together. A folder carrying `tracker/tasks/` is detected
  by **Scan**, a button because it is a whole-tree request. A workspace running
  a tracker that nothing declares gets a **Declare** button; a declaration the
  scan cannot corroborate gets a quiet `no tracker` badge, since a project
  without a tracker is allowed. The repo-root tracker marks the repo itself and
  is never offered, matching home's `tools/generate-tracker-registry.py`. Per
  entry the form edits `label`, `landing`, and `tracker` (with a **No board**
  checkbox for `tracker: false`). An entry keeps the shape it was authored in,
  so a bare path string stays a string until a field is set on it and drops
  back to one when the last field is cleared, and an empty field clears its key
  rather than storing `""`. Adding a project writes `projects` only; creating
  the workspace, its tracker, and its README is repo work.
- **Pages and Stage** (Config view only): **Pages** edits each catalog entry's
  path, title, note, and app-view toggle, with an add-by-path box; **Stage** is
  the two path lists, one entry per line.
- **Scope of the form**: the form edits only the keys its sections show. Every
  other key, a page's `icon`, `thumb`, `project`, and `viewLabel` among them, is
  preserved on save, which `config-form.test.mjs` holds, and edited in the JSON
  pane.
