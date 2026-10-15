# Doc growth

[⭐ Doc Growth](https://mehrlander.github.io/web-tools/pages/doc-growth.html) is
an animated bubble chart of a repository's markdown over time, in the style of
Gapminder. [`python/doc-growth.py`](../python/doc-growth.py) writes a JSON data
file holding each markdown file's word counts and edits at every sample, and
[`pages/doc-growth.html`](../pages/doc-growth.html) draws it.

Every file is a bubble: **x** is its length in words on a log scale, bubble area
is lifetime edit count, and the play control sweeps the history one sample at a
time. The page opens paused on the last sample and draws only files with at
least 5 edits until the min edits slider (1 to 30) is lowered. **y** is one of
three measures per sample:

| Mode | y is |
| --- | --- |
| Effort | edits in the trailing four samples |
| Net change | lines added minus lines deleted, from `git log --numstat` |
| Settled | days since the last sample with an edit, in multiples of `--days` |

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

**Renames are not followed.** The log runs with `--no-renames`, so a moved file
starts over under its new path with one edit, and its old path ends.

## Opening a data file

The page reads `#gz=<data>` (the data file gzipped and base64url-encoded), else
`?url=<address>`, else `?src=owner/repo[@ref]:path`, which uses the viewer's
stored `ghToken` and is the only route that reaches a private repo. With none of
these it reads web-tools' own `data/doc-growth/web-tools.json`.

## Where it appears

A repo whose `.web-tools.json` sets `growth` to its data file's path
([field reference](manifest-fields.csv)) is listed in Map → Docs → Growth, which
frames this page with `?src=` pointed at the selected repo. The web-tools data
file needs no token; every other repo's needs the viewer's token. In Map → Docs →
Inventory, the web-tools data file adds a sparkline and a net word change to each
document row; the rows render without them when the file is missing.

## Refreshing

The data file is refreshed on demand, not by the commit hook. Every commit shifts
the last frame, so a hook that regenerated the file would make every commit
touch it. The file's `generated` field is also the day the script ran, so the
same history gives different bytes on different days. Nothing flags a stale
file: compare `generated` with today. To refresh the web-tools data file, run
the command above from the root of an unshallowed clone, with `.` as the clone,
`data/doc-growth/web-tools.json` as the output, and `--name mehrlander/web-tools`.
