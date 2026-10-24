# Doc growth

[🔷 Doc Growth](https://mehrlander.github.io/web-tools/pages/doc-growth.html) is
an animated bubble chart of a repository's markdown over time, in the style of
Gapminder. [`python/doc-growth.py`](../python/doc-growth.py) writes a JSON data
file holding each markdown file's word counts and edits at every sample, and
[`lib/kits/doc-growth.js`](../lib/kits/doc-growth.js) draws it, both in the
Map's Docs → Growth tab and full page in
[`pages/doc-growth.html`](../pages/doc-growth.html).

Every file is a bubble: **x** is its length in words on a log scale, bubble area
is lifetime edit count, and the play control sweeps the history one sample at a
time. The page opens paused on the last sample and draws only files with at
least 5 edits until the min edits slider (1 to 30) is lowered. **y** is one of
four measures per sample:

| Mode | y is |
| --- | --- |
| Effort | edits in the trailing four samples |
| Net change | lines added minus lines deleted, from `git log --numstat` |
| Settled | days since the last sample with an edit, in multiples of `--days` |
| Care | focused edits to date, with a dashed line at 10 per thousand words |

A **focused edit** is a commit touching at most `--focus` markdown files
(default 5), so a sweep across many documents does not count as attention to
each. Care mode leaves out files a commit hook writes (`--generated`, marked
`gen` in the data file), since their edits are the hook's, and the slider then
counts focused edits. Logs, tracker tasks and archives stay in.

The Growth tab puts a **ranked list** over the chart: the same files as of the
last sample, each opening in the file deck. Its column heads sort it by focused
edits, focused edits per thousand words (the default) or words, and a second
click turns the order round. Picking a row rings its bubble and draws its
trail, and picking a bubble scrolls the list to its row. The tab opens the chart
on Care, where a row's rank and its bubble's height above the dashed line
agree. The full page opens on Effort; `?y=care`, `net` or `age` opens it on
another measure.

The tab has no minimum-edits slider: it lists and draws files with at least 5
focused edits, or 5 edits on the other measures. Above the list, one row of
count chips per facet narrows it, every value shown whatever the other row
picks:

- **Kind**, which `kind()` in the kit reads from the path alone: agent
  instructions, tracker task, thread, blog post, log entry, archive, skill,
  agent definition, README, skill reference, or any other document.
- **Folder**, the file's top-level folder, `(root)` for a file at the top, or
  two levels (`projects/budget-drs`) under a folder `--containers` names
  (`projects`, `packages` and `apps` by default).

A third row, **Colour**, gives the chart's colour to Kind or Folder, or one
colour to every listed file. The three most common values over the whole list
take a hue each and the rest a neutral, so a filter never repaints what it
keeps; the chosen row's chips carry the dots, as the legend. The chart keeps
every file and draws those outside the list faint. The tab fits the Map pane, so
only the list scrolls.

`w` counts every token; `r` skips fenced code blocks and YAML frontmatter.
Tables and indented code count in both, so a wide gap between the two means
mostly fenced code. The page toggles between them.

## Pointing it at a repository

```bash
python3 python/doc-growth.py <clone> -o data/doc-growth/<name>.json --name owner/repo
```

`npm run doc-growth --` runs the same command. `--name` is the label the page
shows; without it the label is the clone path. `--branch` defaults to `main`,
which must exist as a local branch of the clone. `--min-edits N` drops files
touched in fewer than N commits (default 1); on a repo carrying generated
markdown, `--min-edits 2` cuts most of the data file. `--days`, `--ext` and
`--containers` are listed by `--help`. The page's axis labels ("edits / month")
assume the default 7-day sample.

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

## Opening a data file

The page reads `#gz=<data>` (the data file gzipped and base64url-encoded), else
`?url=<address>`, else `?src=owner/repo[@ref]:path`, which uses the viewer's
stored `ghToken` and is the only route that reaches a private repo. With none of
these it reads web-tools' own `data/doc-growth/web-tools.json`.

## Where it appears

A repo whose `.web-tools.json` sets `growth` to its data file's path
([field reference](manifest-fields.csv)) is listed in Map → Docs → Growth, which
reads its data file at the selected repo's ref; `?growthrepo=` picks the repo and
`?growthy=` the chart's measure, written only when it is not the one the tab
opens on. The web-tools data file needs no token; every other repo's needs the
viewer's token. In Map → Docs → Inventory, the web-tools data file adds a
sparkline and a net word change to each document row; the rows render without
them when the file is missing.

## Refreshing

The data file is refreshed on demand, not by the commit hook. Every commit shifts
the last frame, so a hook that regenerated the file would make every commit
touch it. The file's `generated` field is also the day the script ran, so the
same history gives different bytes on different days. Nothing flags a stale
file: compare `generated` with today. To refresh the web-tools data file, run
the command above from the root of an unshallowed clone, with `.` as the clone,
`data/doc-growth/web-tools.json` as the output, and `--name mehrlander/web-tools`.
