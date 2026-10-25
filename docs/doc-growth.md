# Doc growth

[🔷 Doc Growth](https://mehrlander.github.io/web-tools/pages/doc-growth.html) is
an animated bubble chart of a repository's markdown over time, in the style of
Gapminder. Two data files feed it. [`python/doc-growth.py`](../python/doc-growth.py)
writes each markdown file's words and edits at every weekly sample, from the
repository's history. [`python/doc-reads.py`](../python/doc-reads.py) writes
the sessions that opened each file, from the session records.
[`lib/kits/doc-growth.js`](../lib/kits/doc-growth.js) joins and draws them, both
in the Map's Docs → Growth tab and full page in
[`pages/doc-growth.html`](../pages/doc-growth.html).

Every file is a bubble, and each of its three dimensions counts one thing:

| Dimension | Counts |
| --- | --- |
| Area | the file's words at the sample in view |
| Across (x) | its edits to date: the commits that changed it |
| Up (y) | the sessions that opened it to date |

Both axes are scaled by log(1 + n), so a file at zero has a place and one
session reads apart from none. The play control sweeps the samples, so a file
drifts right as it is edited, up as it is read, and swells as it grows. Files a
commit hook writes (`--generated`, marked `gen` in the data file) are left out,
since their edits are the hook's.

Two drawing rules keep the picture readable without changing a count. Counts
are whole numbers, so many files share one place, most often one edit and no
opening session; each file is moved by its own fixed offsets, at most 30% of
the way to the next whole count and never more than 12 pixels. And where the
largest size any file has reached, at any sample, is more than sixteen times
the words of the 90th-percentile file at the last sample, every file above
that sixteen-times size is drawn at it, so one large source extract does not
shrink every document to a dot.

## What counts as opening a file

A session opened a file when one of its calls, a subagent's included, did, or,
for a record that kept no calls, when its own tally of files lists the file as
read:

| Route | The call |
| --- | --- |
| file tool | the Read tool, a GitHub MCP file read, or a WebFetch of the file |
| shell | a command led by `cat`, `head`, `tail`, `sed` (not `sed -i`), `awk`, `less`, `more`, `nl`, `grep`, `egrep`, `rg`, `diff`, `bat` or `git show`, naming the file other than as a search pattern or a redirect's target |
| skill | the Skill tool, which loads a skill's `SKILL.md` with no file tool |

A session counts once however many times it opened the file, dated by the first
time. Being in context at startup, as a CLAUDE.md is, is a separate count and
is never added to opening, since a file the harness loads into every session
was not chosen by any of them. The file panel shows both, as the Inventory's
readership column does.

A path counts however the session reached it: a checkout (`/home/user/<repo>/`),
a raw.githubusercontent.com or GitHub blob link, the plugin marketplace's
clone, or the plugin cache, mapped back through each plugin's `source` in
`.claude-plugin/marketplace.json`. A copy a build writes from a source counts
for the source (`node/build/vendor-docs.mjs`'s `VENDORED`, so
`skills/default/CONVERSATION.md` counts for `docs/CONVERSATION.md`). Renames are
followed, so a read of `docs/SURFACING.md` counts for `docs/CONVERSATION.md`. A
relative path counts when the command's own `cd` or `git -C` places it, or when
exactly one repository has ever held that path; `README.md` with no `cd` is not
attributed. A path a command builds (a variable, a glob) and a file a script
opens are not seen.

## The Growth tab

A list over the chart. The list holds the files the last sample still has, with
the chart's three counts as of that sample, as Words, Edits and Opened columns;
the chart draws every file present at the sample in view. A column's
head sorts by it and a second click turns the order round, and the list opens
sorted by Opened. A phone keeps Edits and Opened. A path too long for its line
loses its start, so the file's name stays in view.

Tapping a name opens the file's panel: its folder over its name, with the file
deck's icon beside them, which reads the file in place; its kind, its place in
the list's order and its last edit; its edits and its opening sessions as a bar
a week over the same weeks; and its counts, with the opening sessions split by
route and the sessions it was in context for. Picking a row rings its bubble
and draws its trail, and picking a bubble scrolls the list to its row.

Above the list, one row of count chips per facet narrows it, every value shown
whatever the other row picks:

- **Kind**, which `kind()` in the kit reads from the path alone: agent
  instructions, tracker task, thread, blog post, log entry, archive, skill,
  agent definition, README, skill reference, or any other document.
- **Folder**, the file's top-level folder, `(root)` for a file at the top, or
  two levels (`projects/budget-drs`) for a file inside a subfolder of a folder
  `--containers` names (`projects`, `packages` and `apps` by default).

Above the plot sit the y axis's title, with an info button whose panel says
what each dimension counts, and at the right the size key and a **colour box**,
which a tap steps through Kind, Folder and one colour. The three most common
values over the whole list take a hue each and the rest a neutral, so a filter
never repaints what it keeps; the coloured row's chips carry the dots, as the
legend. The chart keeps every file and draws those outside the list faint. The
tab fits the Map pane, so only the list scrolls. Without the session counts,
every file sits at zero up the chart and the Opened column is blank.

## Pointing it at a repository

```bash
python3 python/doc-growth.py <clone> -o data/doc-growth/<name>.json --name owner/repo
```

`npm run doc-growth --` runs the same command. `--name` is the label the page
shows and the key the full page joins the session counts on; the Growth tab
joins them on the repository that declares the data file. Without `--name` the
label is the clone path. `--branch` defaults to `main`, which must exist as a branch of the
clone. `--min-edits N` drops files touched in fewer than N commits (default 1).
`--days`, `--ext` and `--containers` are listed by `--help`.

**Empty frames are trimmed.** The extractor drops leading and trailing samples
that hold none of the kept files, so the player never opens on an empty plot,
which looks like a player that has not finished loading.

**A shallow clone truncates the history.** Claude Code web checks out shallow,
so the chart starts at the shallow boundary however old the repo is. Run
`git fetch --unshallow` first, and do not clone with `--filter=blob:none`, since
`git log --numstat` would then fetch every blob over the network.

**Renames are followed.** The log runs with rename detection, and each earlier
path is filed under the file's current one, so `docs/CONVERSATION.md` carries
the history of `docs/SURFACING.md`. A move across repositories is not followed.
`--branch` must be current: a stale local `main` drops everything after it.

## The session counts

```bash
python3 python/doc-reads.py <store clone> --ref origin/main \
    --repo mehrlander/web-tools=<clone> --repo mehrlander/home=<clone> \
    -o <store clone>/state/doc-reads.json
```

The store is web-tools-private, whose `sessions/` holds one record per session;
the script reads the records at `--ref` through `git cat-file`, so the store's
working tree is not touched. Each `--repo` names a repository by the label its
growth data file carries and a clone of it, read at `--branch` (default `main`)
for its Markdown paths, renames, plugin sources and vendored copies. The output holds, per
repository and file, `opened` and `context`, each a list of one day per session
counted as days after `from`, the first record's day; `via`, the opening
sessions by route; and `basis`, the context sessions by how the record knows
(`receipt` or `reconstructed`). It is derived from the records, so it stays in
web-tools-private, on its `background` branch, never in a public repository.
The laptop daemon rebuilds it there daily: the `doc-reads` row of that repo's
`data/design/scheduled-tasks.csv` runs `sessions/tools/doc_reads.py`, which
fetches the laptop's clones of the repositories the Docs tab indexes, less
chat-histories, and runs this command over them.

## Opening a data file

The page reads `#gz=<data>` (the data file gzipped and base64url-encoded), else
`?url=<address>`, else `?src=owner/repo[@ref]:path`, which uses the viewer's
stored `ghToken` and is the only route that reaches a private repo. With none of
these it reads web-tools' own `data/doc-growth/web-tools.json`. The session
counts come from `?reads=owner/repo[@ref]:path`, else web-tools-private's
`state/doc-reads.json` on its `background` branch, through the same stored
token. `?view=table` opens the
page on its table in place of the chart.

## Where it appears

A repo whose `.web-tools.json` sets `growth` to its data file's path
([field reference](manifest-fields.csv)) is listed in Map → Docs → Growth, which
reads its data file at the selected repo's ref and the session counts on
web-tools-private's `background` branch; `?growthrepo=` picks the repo. The web-tools data file
needs no token; every other repo's, and the session counts, need the viewer's
token. In Map → Docs → Inventory, the web-tools data file adds a sparkline and a
net word change to each of the hub's document rows that the file holds at two
or more samples; the rows render without them when the file is missing. Its
readership column reads the same session counts, so both tabs count a read
alike.

## Refreshing

The growth file is refreshed on demand, not by the commit hook. Every commit
shifts the last frame, so a hook that regenerated the file would make every
commit touch it. The session counts are rebuilt daily by the laptop daemon, as
above. Each file's `generated` field is also the day the script ran, so the same
inputs give different bytes on different days. Nothing flags a stale growth
file: compare `generated` with today. To refresh the web-tools growth file,
run the first command from the root of an unshallowed clone, with `.` as the
clone, `data/doc-growth/web-tools.json` as the output, and
`--name mehrlander/web-tools`. The chart's last sample counts every recorded
session, so session counts newer than the growth file still show in full there.
