# Search and Files

**Search** finds files and records across the estate and opens a hit in place.
**Files**, a repo view and a project's Files tab, browses one repo's folders.
The address carries the query, mode, repo, branch, folder and open file, so a
link reopens the same search.

## Modes

| Mode | Finds | Misses |
| --- | --- | --- |
| **Names** | file names in any repo, branch or folder | anything inside a file; with no repo chosen, files pushed since the estate's file list was last refreshed, and the files inside a folder of more than 2,000 |
| **Contents** | text inside files, through GitHub's code search | branches other than the default, pushes GitHub has not indexed yet, files over about 384 KB, more than ten searches a minute |
| **Sessions** | what was asked and answered in captured sessions | anything not captured |
| **Chats** | each chat's title, tags and summary, every month | the words spoken in a chat, which chat-histories' `tools/search_chats.py` searches |

## Compare copy

For a PowerShell or XAML file open in Search, **Compare copy** compares a
pasted, dropped or chosen copy against a pinned revision, in the Stage.

- A `# @file <repo-relative path>` line names which PowerShell file the copy
  is; two different declarations are refused. XAML compares against the open
  file.
- UTF-8 and UTF-16 with a byte-order mark are read automatically; plain UTF-16
  and Windows-1252 by choice.
- A copy that differs only in line endings is not an exact match.
- Checks are kept in this browser only and never written to a repository;
  recording an outpost observation belongs to the Project view ([project.md](project.md)).
