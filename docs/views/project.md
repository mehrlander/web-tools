# Project

`?view=project&project=<path>[&tab=overview|board|pages|docs|code]` is one
workspace declared in its repo's `.web-tools.json` `projects`. Board, Pages and
Docs reuse shell components. A workspace declaring `installation` (a
repo-root-relative `installation.json`; [manifest-fields.csv](../manifest-fields.csv))
gets two more things:

- **Overview** becomes the installation view when there is no landing page
  (`lib/alpineComponents/installation-view.js`, `lib/kits/installation.js`).
  The retired `&tab=installation` address resolves here.
- **Code** (`&tab=code&item=<file>`) is the PowerShell workspace,
  documented in [powershell-workspace.md](../powershell-workspace.md).

## The installation view

It lists the workspace's PowerShell and XAML files by the manifest's areas, each
with its intended location under the installation root and a state derived from
the workspace's observations ledger (`installation.js` names the states). The
selected file shows its source at the captured revision and opens on **Changes**
when the work computer's known copy differs from GitHub.

**The ledger is the one write, and it is gated.** A file's status menu offers
Confirm installed, and Record the match or the difference for a browser-local
check. Each opens a confirm showing the exact ledger row and commits it on the
browsed branch only after the reader taps "I placed this on the work computer".
Comparing, copying, downloading and the transfer script never write a row. The ledger is appended,
never rewritten.
