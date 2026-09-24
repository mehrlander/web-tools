# Routes

### Routes (`?view=routes`)

**Routes** is the fifth pane and the first keyed to something other than git.
Branches, Sessions and Chats all answer *who was working, and when*: the
unit is a piece of work. Routes answers *on what*: the unit is a destination in
the app. The estate had no reading of that at all, though the UI layer is where
most of the work lands, and the app could not previously say what its own
destinations were: `VIEWS` in `show-repo.html` dispatches and stamps them and
carries no label, no gloss, and no idea which code draws the screen.

[`docs/app-routes.csv`](app-routes.csv) is that statement, one row per
address: what it is for, which group it is reached from, and the files that
render it. `tools/test/app-routes.test.mjs` holds it to the `VIEWS` table both
ways, so a route cannot exist in the router and not the manifest, and every
declared file has to exist. The word is overloaded on purpose-free grounds and
worth stating once: these are **app routes**, addresses in this page;
[`docs/routes-routes.csv`](routes-routes.csv)'s rows are **toss routes**, a content type
mapped to a renderer page. Different targets, so neither describes the other.

The pane reads the manifest and one `commits?path=` call per declared file
against the hub, ranks the rows freshest first, and joins each to the open pull
requests whose files it touches. Nothing is cached and nothing is crawled: these
routes belong to one page in one repo, so the read is about two dozen requests
and is taken live, which is also why this pane has no age pill.

**Every read is at the ref the code came from, not at main.** The manifest and
the `VIEWS` table are held to each other at a ref, so reading the code from one
and the manifest from another breaks the invariant the gate protects. Pinning
the manifest to main did exactly that on the first preview of the branch that
added it: the pane reported `GitHub Error 404` for a file that did not exist on
main yet, and the failure read as an auth problem even though the rate figure in
the same message showed the token had worked. `?use=` is the app's standing
answer to "which ref am I running" (the ref switch reads the same key) and a
`#gh=` toss injects the addressed ref under that key through toss-render's
params shim, so one read covers the deployed page, a `?use=` preview, and a
tossed branch alike. The commit dates ride the same ref, so the whole pane
speaks about one tree, and a non-default ref is shown as a chip in the header
rather than left to be inferred. The error names the address it could not read,
which is what the first diagnosis lacked.

**The join is files, and files are coarser than routes.** That is the pane's one
real limit and it is shown rather than filed:

- **The shell is excluded.** `app/index.html` holds the router,
  the header, the sidebar, and every pane's outer markup, so a commit to it
  would date every route at once. It gets a row of its own at the foot instead,
  because leaving it silently out would leave a reader wondering why the busiest
  file in the app never dates anything.
- **A wide file cannot be a row's reason.** Nine routes render from
  `estate.js`. A file carrying three or more routes still dates a row that has
  nothing narrower, and the row says `shared` beside the date, so a borrowed
  reading is never mistaken for a claim about that route in particular.
- **A blank `files` is a finding.** Three routes (landing, pages, project)
  render from components defined inline in the shell and so have no code of
  their own. The header counts them. That count is a reading of the app's shape,
  which is why the manifest grades `files` as `counted` rather than required.

A row's label opens the route through the shell's own dispatcher, so it is the
same navigation a header tab performs. Only a bare `?view=<key>` is offered: an
address carrying a placeholder (a repo, a file path, a promoted page) has no
single destination, and those rows show the address as text rather than a link
that would land nowhere. Such an address is also trimmed to its `?view=` half on
the row, with the full shape in the expanded detail: `?view=app&appRepo=<owner/
repo>&appPath=<path>` wrapped to two lines on a phone to say what the row's tone
now says. The `shell` group (App view, Public browse) reads muted, because
neither is a screen this app draws.

**Rows fold into nav stops, which is the level the router flattens away.** The
app addresses sub-tabs two ways: six are their own `?view=` key (Activity's
five, Lists' two, Stage's two) and twelve are `?view=<parent>&tab=` (Map's
eight, Project's four). The reason is archaeological rather than designed. Each
flattened key used to *be* a nav stop and kept its key when its pane moved under
another, so saved links keep resolving; Map's tabs were never separate
destinations and were born as `&tab=`. A view key that outlived its stop is a
fossil, and a flat list rendered fossils at the same rank as live destinations,
which is what read oddly. Each route therefore declares its `stop`, held to
`estateNav` by the gate, so the flattening is stated here rather than inferred,
and the header counts it once as a figure rather than repeating a sentence on
every folded stop. A stop owning one route is not a grouping and renders as a
plain row.

**The join runs both ways.** A route row lists the pull requests open against
it; a **Branches** row carries a chip strip of the routes it is working on, off
the same manifest, the same PR file lists, and the same narrow/wide rule, so the
two readings cannot disagree. That shared half (the manifest plus one
`pulls/N/files` per open PR, about six calls) loads on either pane, so visiting
one warms the other, and the Branches pane skips the per-file dating it has
no use for. A chip taps through to its route. Rows from every other repo carry
nothing rather than an empty strip: routes are one page in one repo, and a row
that cannot be answered should not look like a row with no answer.

**The grouping takes its order from the ranking rather than recomputing it.**
That is what keeps freshest-first true at both levels at once: stops appear in
the order their freshest member does, rows keep their rank order inside. An
earlier draft grouped by a fixed manifest order and cost the pane its headline,
an hour-old route sitting below a six-day-old one because they were in different
sections. Deriving the group order from the rank is what makes grouping safe.
