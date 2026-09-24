# Project

A workspace whose manifest entry carries `installation` (a repo-root-relative
`installation.json`; see [manifest-fields.csv](manifest-fields.csv)) gets an
**Installation** pill on its project view (`?view=project&project=<path>&tab=installation`,
with the selected file as `&item=`). The pill lists the workspace's PowerShell
material by the areas the manifest declares (Profile, Modules, Forms, Scripts),
a form's controller beside its XAML, each file with its intended location under
the installation root and a state read from the workspace's observations ledger
(`lib/kits/installation.js`): `local state unknown`, `reported installed`,
`verified from supplied copy`, `GitHub changed since`, `local copy differs`, or
`repository only`. Areas the manifest names as local-only or unresolved are
listed without repository files. For the selected file: its source at the
captured revision, read-only, under a header that carries Copy GitHub text,
Download, and the comparison intakes (the clipboard through the app's Paste, a
chosen file, or a drop on the column; the page-wide paste and drop still aim at
that file, and a file that fails to decode is offered its encoding then), where
a copy compared there stays on the Overview. When the work computer's known
copy (a copy supplied in this browser, or the version the ledger last recorded)
differs from GitHub now, the pane opens on Changes. Each file carries a status icon (assumed in sync, confirmed, update pending, new
file, differs, repository only) whose menu, opened by a tap or a right-click,
holds the actions its state allows: **Confirm installed…**, which opens a confirm
showing the exact ledger row and commits it on the branch being browsed only when
the reader taps "I placed this on the work computer"; Record the match or the
difference, which promotes a browser-local check to a `verified` or `differs` row
the same way; Show changes; and Open in Code. A comparison, copy, or
download never writes a row; the ledger is appended, never rewritten, and a
later session reads the same states from the repository.
