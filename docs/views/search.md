# Search and Files

**Search** (`?view=search`, `lib/alpineComponents/search-view.js`) finds files
and records and reads a hit in place. **Files** (`?view=files`, a repo view, and
a project's Files tab; `lib/alpineComponents/file-browser.js`) walks one
scope's tree beside the open file. Search finds; Files browses. Pins, recents,
Docs and the sidebar finder's file hits open in Files at the file's folder
(`?view=files&path=&file=`).

## Modes

All four share the sidebar finder's core, [`lib/kits/estate-search.js`](../../lib/kits/estate-search.js):
one implementation and one cache.

| Mode | Reaches | Misses |
| --- | --- | --- |
| **Names** | repo trees at any ref, under any folder | anything inside a file |
| **Contents** | full text, through the code-search API | non-default branches, unindexed pushes, files over ~384 KB, past ten calls a minute |
| **Sessions** | captured session records (asks, prompts, replies) | anything not captured |
| **Chats** | the chat archive's catalog: each chat's title, tags, and hand or machine summary, every month (about 10 MB, once per session) | the words spoken in a chat; full text is chat-histories' `tools/search_chats.py` |

In Names, a query is a recursive match and an empty query under a repo is one
level of the tree (`EstateSearch.names`, `EstateSearch.level`, both off one
cached tree). An empty query with no repo scope is the only dead state.

## Scopes and address

- Repo: a single-select rail. Switching repo drops the ref and the folder.
- Ref: `refPicker` (`lib/alpineComponents/ref-picker.js`), the estate's only
  branch picker. It returns the default branch as `''`, never by name.
- Folder: `pathPicker` in `dir` mode. In Contents the scope rides the API's
  `path:` qualifier.
- A bare arrival lists the repo the shell is browsing.
- `?view=search&sq=&smode=&srepo=&sref=&spath=&sfile=` round-trips the screen;
  `sfile` is an `owner/repo[@ref]:path` address. The row stamps on any field.

## Reading a hit

The shared viewer (`viewer.js`, embedded with `bindStore:false`) opens the hit
beside the results, or in place of them on a phone, in the mode its type
deserves (raw past 300 KB). It carries the file's own `origin`, so its links
point at the hit's repo and ref, and reading a hit never switches the browsed
repo. **Refresh caches** is `EstateSearch.reset`.

## Compare copy

For a PowerShell or XAML file open in Search, **Compare copy** takes pasted
text, a dropped file or a chosen file and compares it in the Stage against a
pinned revision. [`lib/kits/file-correspondence.js`](../../lib/kits/file-correspondence.js)
owns the rules:

- A `# @file <repo-relative path>` line names the PowerShell file; conflicting
  declarations are refused. XAML uses the open file.
- Decoding: UTF-8 and BOM-marked UTF-16 automatically; UTF-16 and Windows-1252
  by choice. An undecodable file is an error.
- A difference caused only by line endings is labelled; the exact-match
  observation stays strict.
- Checks and unfinished submissions live in browser IndexedDB, exportable as
  JSON. Clearing site data removes them. Nothing here writes the repository;
  recording an installation is the Project view's
  ([project.md](project.md)).
