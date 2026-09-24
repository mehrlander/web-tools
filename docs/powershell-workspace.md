# PowerShell files in the Overview

A project whose manifest declares `installation` lists its PowerShell and XAML
files in the Overview (`?view=project&project=<path>[&item=<file>]`). The
Overview finds a file, shows it and records installation evidence; the **file
deck** steps through files one per slide. Both show a file through one component,
`powershell-file.js`. The Code tab was retired on 2026-09-24; `&tab=code`
opens the Overview.

## The Overview's source pane

- **Toolbar:** Open in deck and Copy (the GitHub text).
- **File pane:** the file component inline, one editor view reused across
  selections. Tabs: Code, Work copy (when a recorded or supplied version differs
  from GitHub; opens by default), Draft (when one exists), Problems, Outline. Its
  bar carries Edit, or Undo, Redo and Done, and a dropdown without the two copy
  actions the Overview already has.
- **Paste zone:** a tap reads the clipboard through the app's Paste; a drop or a
  page-wide paste arrives the same way. Only `.ps1 .psm1 .psd1 .ps1xml .xaml .txt`
  files count as a work copy; anything else goes to the Stage.
- **Summary card:** says whether the copy is signed (`# @file <repo path>`) for
  this file, and whether it matches exactly, except line endings, or except
  trailing spaces. Otherwise it lists functions changed (parameters added or
  dropped), added and removed, whether code outside functions changed, and new
  5.1 problems; for XAML, named controls and resource keys. Actions: Show line
  changes, Record the match or difference, Open as draft. The copy is held in
  memory until recorded.
- **Status menu:** Confirm installed; Record the match or difference; Copy
  install script, offered only when the work computer is behind (pending
  adoption, GitHub changed since, or a differing copy). The script writes the
  file's exact blob bytes and checks its Git hash; it records nothing.
- **Publish panel:** appears when browser drafts exist; publishes them together
  to a new branch. A draft whose file moved on GitHub since it began is refused.

## The file deck

One slide per file, over the files the Overview is showing. A slide has Code
(read-only until **Edit**), Draft (against its GitHub base, when one exists),
Problems and Outline. The deck header carries Edit, or Undo, Redo and Done, and a dropdown: Find,
Companion, Copy GitHub text, Copy install script (when behind), Copy draft text,
Discard draft, Publish drafts, Open on GitHub. Editing pauses the swipe and keeps
arrow keys and Escape in the editor. Opening the deck ends inline editing; closing
it reloads the inline pane, so the two never hold diverging drafts.

## Invariants

- Source reads verify each Git blob's bytes (`PowerShellWorkspace.readFile`,
  `readBytes`). A draft keeps the file's BOM and line separators.
- A Windows-1252 file (what Windows PowerShell 5.1 assumes without a BOM) is
  decoded as such and is read-only; a draft would re-encode it.
- Drafts live in browser storage keyed by repo, project, ref and path. Publishing
  creates a new branch and never updates an existing one.
- Nothing but a confirmed row writes to the observations ledger.
- Problems are lexical heuristics; an empty list proves nothing about 5.1.

## Files and tests

| Part | File | Held by |
| --- | --- | --- |
| Overview | `lib/alpineComponents/installation-view.js` | `installation-view.test.mjs`, `installation-source-browser.mjs` |
| File pane and deck slide | `lib/alpineComponents/powershell-file.js` | `installation-view.test.mjs`, both browser harnesses |
| Reads, drafts, publish | `lib/kits/powershell-workspace.js` | `powershell-workspace.test.mjs` |
| Analysis | `lib/kits/powershell-language.js` | `powershell-language.test.mjs` |
| Editor | `lib/kits/powershell-editor.js` (CodeMirror 6) | `powershell-file-browser.mjs` |
| Ledger, install script | `lib/kits/installation.js` | `installation.test.mjs` |

The two browser harnesses run with `npm run test:installation-source` and
`npm run test:powershell-file`; they need `npm install` for the CodeMirror
packages.
