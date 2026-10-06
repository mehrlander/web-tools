# Project

`?view=project&project=<path>[&tab=overview|board|pages|docs|files]` is one
workspace declared in its repo's `.web-tools.json` `projects`. A workspace
declaring `powershellOutpost` (a repo-root-relative `outpost.json`;
[manifest-fields.csv](../manifest-fields.csv)) shows the PowerShell outpost
view in its Overview tab when it has no landing page.

## The PowerShell outpost view

An [outpost](../outposts.md) is a place outside Git that holds estate material.
This view serves one of them, the work computer's PowerShell suite, mirrored in
mehrlander/home's `projects/wps`. It shows each file's destination there and
what was last observed of it. It also compares a pasted copy with GitHub, holds
edits as browser drafts, and copies an install script. `powershell-outpost.js`
derives each file's state from the observations ledger.

**The ledger is the view's only write.** It is appended, never rewritten, one
row per confirmed file, committed on the browsed branch only after the reader
confirms the placement on the work computer. Comparing, copying and the install
script never write a row. State icons come from `lib/kits/sync-status.js`,
shared with the shortcut views.

The rest of what the code keeps:

- Source reads verify each file's Git blob bytes, and a draft keeps the file's
  BOM and line endings. A Windows-1252 file opens read-only, since a draft
  would re-encode it.
- Drafts live in browser storage, keyed by repo, project, ref and path, and
  publish together to a new branch, never an existing one.
- A file is scripted and confirmed only together with the still-pending files
  it strictly needs, as `PowerShellOutpost.installSet` defines them.
  mehrlander/home's `projects/wps/tools/outpost-check.py` applies the same
  rule; change both.
- The Problems list is lexical heuristics; an empty one proves nothing about
  Windows PowerShell 5.1.

Code: `lib/alpineComponents/powershell-outpost-view.js` (the view),
`lib/alpineComponents/powershell-file.js` (one file, in the view and its swipe
deck), `lib/kits/powershell-outpost.js` (states, ledger, install script),
`lib/kits/powershell-workspace.js` (reads, drafts, publishing). `npm test`
opens no browser, so a change to the file pane or editor also needs
`npm run test:powershell-outpost-source` and `npm run test:powershell-file`.
