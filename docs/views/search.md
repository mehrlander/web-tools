# Search and Files

**Search** finds files and records across the estate and opens a hit in place.
**Files**, a repo view and a project's Files tab, walks one repo's folders
beside the open file. Search finds; Files browses. Pins, recents, Docs and the
sidebar finder's file hits open in Files at the file's folder.

## Modes

| Mode | Finds | Misses |
| --- | --- | --- |
| **Names** | file names in any repo, branch or folder | anything inside a file; with no repo chosen, files pushed since the estate's file list was last refreshed, and the files inside a folder of more than 2,000 |
| **Contents** | text inside files, through GitHub's code search | branches other than the default, pushes GitHub has not indexed yet, files over about 384 KB, more than ten searches a minute |
| **Sessions** | what was asked and answered in captured sessions | anything not captured |
| **Chats** | each chat's title, tags and summary, every month | the words spoken in a chat, which chat-histories' `tools/search_chats.py` searches |

In Names, typing matches anywhere in the chosen scope, and an empty box under a
repo lists that folder one level at a time.

## Scopes and links

- **Repo:** one, or none for every repo. Switching repo clears the branch and
  the folder.
- **Branch:** any branch; blank means the default.
- **Folder:** narrows Names and Contents to one folder.
- Opening Search with nothing chosen lists the repo you were browsing.
- The address carries the query, mode, repo, branch, folder and open file, so a
  link reopens the same screen.

## Reading a hit

A hit opens beside the results, or in place of them on a phone, in the reader
its file type suits (raw text past 300 KB). Its links point at the hit's own
repo and branch, and reading it never changes the repo you are browsing.
**Refresh caches** forgets the file lists and session records this page has
read, so the next search reads them fresh.

## Compare copy

For a PowerShell or XAML file open in Search, **Compare copy** takes pasted
text, a dropped file or a chosen file, and compares it in the Stage against a
pinned revision.

- A `# @file <repo-relative path>` line names which PowerShell file the copy
  is; two different declarations are refused. XAML compares against the open
  file.
- UTF-8 and UTF-16 with a byte-order mark are read automatically; plain UTF-16
  and Windows-1252 by choice. A file that decodes as neither is an error.
- A copy that differs only in line endings says so, and still does not count as
  an exact match.
- Checks and unfinished submissions are kept in this browser and export as
  JSON; clearing site data removes them. Nothing here writes to a repository;
  recording an installation belongs to the Project view ([project.md](project.md)).
