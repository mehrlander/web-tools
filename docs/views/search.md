# Search

For a PowerShell or XAML file open in Search, **Compare copy** accepts pasted
text, a dropped file, or a chosen file (including on a phone). App-wide paste
and drop use the open file as context. A
`# @file projects/wps/app/Modules/Forms/Forms.psm1` line instead names a
repository-relative PowerShell file; the app supplies the current repository
and branch. XAML uses the selected file. When a declaration conflicts with the
open file, the user chooses which association to use. Paste inside an editing
field remains native. Auto file decoding accepts UTF-8 and BOM-marked UTF-16;
the file chooser also offers explicit UTF-16 and Windows-1252 for older files.
An undecodable file produces an error rather than disappearing.

The incoming text is held intact and compared in the existing Stage reader
against a pinned repository revision. Repeating a check reuses that Stage
repository item while keeping each submitted copy and dated check separate.
For a correspondence pair, Stage normalizes CRLF and CR to LF in its displayed
diff. A check labels a difference caused only by line endings; its exact-match
observation remains strict, and the submitted text and hash stay unchanged.
The check stores the submitted text, path, repository, branch, revision and
hashes in browser IndexedDB; the Search panel can reopen it or export its JSON.
If repository lookup fails, the submission remains in Stage and in a
browser-local unfinished list in **Compare copy**. From there, retry its
address or associate it with the currently open file. A match describes only
the submitted text at that revision, not the saved file on another computer.
Clearing browser site data removes checks and unfinished submissions, so
export checks for a backup. Any transfer to or from a separate installation
remains manual.

### Search (`?view=search`)

**Search** (`lib/alpineComponents/search-view.js`) finds files and records and
reads a hit in place. Its modes sit behind a pill row, all served by the same core the
sidebar finder uses ([`lib/kits/estate-search.js`](../lib/kits/estate-search.js),
one implementation, one cache, so a tree the finder fetched is a tree this view
never re-fetches):

| Mode | Reaches | Misses |
| --- | --- | --- |
| **Names** | the repo trees, at **any ref**, under any folder: browsed one level or matched recursively | nothing inside a file |
| **Contents** | full text, through the code-search API | non-default branches, a push the index has not caught, files over ~384 KB, past ten calls a minute |
| **Sessions** | the captured session records (the opening ask, every stored prompt and reply, the closing message) | anything not captured |

**Names is two readings of one corpus, and the query box is the switch.** Type
and it is a recursive match: every path under the scope that contains what you
typed, flat, stated relative to the scope. Clear the box and it is **one level**:
the folders and files sitting directly in the scope, folders first with the
count of blobs below each, a `..` at the top, and a folder row that descends
rather than opening anything. That second reading is the file tree, and it has
folders in it, which a recursive match structurally cannot: this is why an empty
query here is an answer rather than a miss, and why the two are one control
rather than a browse toggle beside a search box.

Both readings come off the same cached recursive tree
(`EstateSearch.names` and `EstateSearch.level`), so descending a folder after
the repo's first read costs no fetch at all. A level needs a repo, since a level
of "every repo at once" is not a place; under **All** an empty query stays the
recursive listing.

**The controls say what they are; the prose says only what is missing.** The
slot under them used to carry a paragraph per mode explaining what that mode
was, above controls already saying it. A Files pill over a repo rail over a
branch picker does not need telling. What no layout can show is a **limit**, so
that is all the line carries now: Contents keeps its caveats, Sessions names the
corpus it greps, Files says nothing at all except in the one state where its
button is dead. An error still surfaces whole.

Each scope is the control its subject deserves:

- **Repos are a rail**, single-select badges with "tap it again for all", the
  stage's Recent filter idiom. The set is small, fixed, and the thing switched
  most, which is the case a `<select>` serves worst: it hides every option
  behind a tap and reports the current one in a slot that reads as a form field
  rather than as a place you are standing.
- **The ref is a picker** (`lib/alpineComponents/refPicker`), a dated
  newest-first branch list with the default branch as its own row. It is the
  the estate's only branch picker as of 2026-08-14. It replaced the explorer's
  hand-rolled copy, and with it a silent defect: that copy read the browser
  store's `ensureBranches`, one uncapped-at-100 REST page in alphabetical order,
  so a repo past a hundred branches was quietly missing rows and the newest was
  rarely near the top. The picker paginates `branchesDated`. (`repo.js` keeps
  its own, in the non-inline template two demo pages mount; it is the last
  copy.) Its box
  **filters** rather than leads, which inverts the header ref switch on purpose:
  there you know the name of where you are going, here you are choosing among
  what exists. A tag, a sha, or a branch past the scan's reach is still
  reachable, offered as typed at exactly the point the list runs out of
  matches. The default branch is handed back as `''`, never by name, so a scope
  meaning "whatever this repo calls its default" keeps meaning that when the
  repo changes. It stands down under **All**, where there is no one repo to
  list and each answers at its own default.
- **The folder is the tap-through picker** (`pathPicker` in `dir` mode), rooted
  at the scoped repo at the scoped ref and opening *inside* it, since a one-row
  "pick a repo" level in a control two slots right of the repo rail is a tap
  asking a question with one answer.

Switching repos drops the ref and the folder with it: both name places inside
the repo you just left.

**Four filters over one list, not a search box with extras.** A query, a repo,
a ref, and a folder scope each narrow the same set, and none of the four is
required except in the sense that something has to be: **an empty query under a
repo or a folder is a listing**, so the button reads *List* rather than
*Search* and the same call serves browsing. Only an unscoped empty query is a
miss, since reading every tree the token can see is not a listing anyone asked
for, and that one dead state says so in its facts line rather than only greying
out its own button. (Under a repo, an empty query is never dead: it is the walk.)

**A bare arrival lists the browsed repo.** Nothing seeded is still a request,
and the request is "show me files". The view first shipped landing on an empty
box over an empty list with the button dead and no account of why, which is a
front door that reports nothing; it now scopes to whatever repo the shell is
browsing, at the ref being browsed when that is off the default, and lists it.
Only a bare arrival: a seed carrying a query means that query, over whatever
scope it named, every repo included. The repo select carries the scoped repo as
an option even when it is not on the estate, since a select holding a value it
has no option for renders blank, which reads as no scope while the list under it
is scoped.

The scope narrows before the cap is spent, and in Contents it rides the
API's own `path:` qualifier, so scoping narrows the search rather than the
results it already paid for. A row is stated **relative to the scope** and drops
the repo badge when a single repo is the scope, which is what stops a scoped
listing from repeating itself on every line and truncating the only part that
differs. The folder icon on a row scopes to it, and appears only where that
would go somewhere; the crumb trail above walks back out.

**A hit opens where it was found.** The shared viewer (`viewer.js`, embedded
with `bindStore:false`, the same way the stage previews a staged file) renders
the file beside the results on a wide screen and in place of them on a phone,
with a labelled way back. It opens in the mode the file's type deserves rather
than the tree walk's `raw`: markdown rendered, JSON as a tree, delimited data as
a table, everything else syntax-highlighted, and raw past 300 KB, since Prism
highlights synchronously and this estate holds megabyte files. It carries the file's true `origin`, so its GitHub /
Raw / CDN / toss links point at the file's own repo and ref rather than at
whatever repo the shell happens to be browsing, and reading a hit never switches
that repo. The position steps through the file hits, so a result set is walkable
without returning to the list. One button leaves for the repo's **Files** view,
for when the question is where a file *sits* rather than what it says.

**Search finds; Files browses.** A repo's **Files** view and a project's
**Files** tab (`lib/alpineComponents/file-browser.js`) walk one scope's tree
beside the open file: the Stage's picker, inline and based at the scope, next to
the shared reader. Pins, recents, Docs and the finder's file hits open there,
on the file's folder (`?view=files&path=&file=`).

**The screen is the address, not the query behind it.**
`?view=search&sq=&smode=&srepo=&sref=&spath=&sfile=` round-trips the query, the
mode, both scopes, and the open file, `sfile` being an `owner/repo[@ref]:path`
address. A screen with no query at all is still worth addressing, which is why
the row stamps on any field rather than on `sq` alone.

Every run re-executes; the caches underneath make re-matching cheap, and
**Refresh caches** (`EstateSearch.reset`) is the explicit way to force fresh
fetches, which is the view-level answer to "the results seem cached". **Show
more** raises the cap and re-runs, and appears only where more can actually come
from: the names lane holds the whole match set in memory, the code-search API
pages at 100 and this view reads one page, and the session grep returns
everything already.
