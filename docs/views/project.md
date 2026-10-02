# Project

`?view=project&project=<path>[&tab=overview|board|pages|docs|files]` is one
workspace declared in its repo's `.web-tools.json` `projects`. A workspace
declaring `installation` (a repo-root-relative `installation.json`;
[manifest-fields.csv](../manifest-fields.csv)) gets an **Overview** that is the
installation view when there is no landing page
(`lib/alpineComponents/installation-view.js`, `lib/kits/installation.js`). Its
source pane, file deck and publish panel are in
[powershell-workspace.md](../powershell-workspace.md). The retired
`&tab=installation` and `&tab=code` addresses resolve here.

## The installation view

Each PowerShell and XAML file's state is derived from the workspace's
observations ledger; `installation.js` names the states.

**The ledger is the view's only write.** It is appended, never rewritten, one
row per confirm, committed on the browsed branch only after the reader confirms
placing the file on the work computer. Comparing, copying and the install
script never write a row. State icons come from `lib/kits/sync-status.js`,
shared with the shortcut views.
