# Source bundles

A **source bundle** is a folder of material from outside the repository, kept
because we need to know where it came from. Each bundle has a README whose
frontmatter states what a person knows about the material: what it is, who
published it, where it was taken from and when. A script reads every bundle a
repository declares and writes two tables from them, so the whole holding can
be read in one place and an empty field shows. Do not add a per-bundle
manifest file such as `source.json`: budget-drs retired 35 of them on
2026-09-10 because nothing read them and they hid which fields were empty.

## What a bundle is

A bundle is a folder one level below a declared root that holds a tracked
`README.md`. Everything tracked beside and below that README belongs to the
bundle, except path parts that start with a dot, `__pycache__`, and the names a
declaration lists under `skip`.

A bundle takes one of two shapes:

- **An intake**: a dated folder, `YYYY-MM-DD-slug/`, holding one acquisition.
  It is not revised; a later pull is a new folder. budget-drs's
  `data/source/` takes this shape.
- **A series**: a folder holding one publisher's product across repeated
  intakes, usually as dated snapshots inside it. budget-wa's
  `sources/<publisher-product>/` folders take this shape.

A running record that a scheduled writer extends, such as a weekly pull folded
into one ledger, is not a bundle: each run would leave the file table behind.
List its folder under the declaration's `exclude` and describe it in the
manifest's [`stores`](manifest.md#stores) instead.

## The README's frontmatter

The frontmatter is a leading `---` block. Every value is double-quoted: an
unquoted YAML value can read `2026-05-18` as a date, a bare `no` as false, and
fails outright on a value holding `: `. The script's reader uses only Python's
standard library and reads only quoted scalars and block lists.

| Field | Required | Holds |
|---|---|---|
| `title` | yes | what the material is |
| `acquired` | yes | the date it was taken, `YYYY-MM-DD`; for a series, the latest intake |
| `publisher` | no | the organization that published it, by its usual short name: `OFM`, `LEAP` |
| `source_page` | no | the address it was taken from |
| `arrival` | no | how it reached the repository, where that was not a pull from `source_page`: supplied in a session, a screenshot, a forwarded file |
| `note` | no | what a reader of the bundle table needs and the title does not say |
| `not_taken` | no | a block list of `what` and `why` mappings: material at the source deliberately left out |

```yaml
---
title: "OFM State HR workforce files"
publisher: "OFM"
source_page: "https://ofm.wa.gov/data-research/state-employee-workforce/"
acquired: "2026-10-21"
not_taken:
  - what: "The Power BI dashboards"
    why: "agency totals only; a pull would need the query endpoint"
---
```

Other keys are allowed, and the tables ignore them. budget-drs's READMEs also
carry `type`, `status` and `summary`.

## The two tables

| Table | One row per | Made by |
|---|---|---|
| bundle table | bundle: `bundle`, `root`, the frontmatter fields, `files`, `bytes` | authored: read from the frontmatter, which a person writes |
| file table | file: `bundle`, `path`, `bytes`, `sha256` | derived: read from the Git index on every run |

The file table is the only record that catches a held file changing. A bundle
with more files than `enumerateMax` (300 unless declared) gets one totals row in
it instead, and must keep an inventory of its own, such as a manifest.

A repository may also keep a per-file table of what the source said about
individual files (`fileSources`). It is authored, so it stays apart from the
derived file table, and the script fails when one of its rows names a file the
file table lacks.

## Declaring and running

A repository declares its bundle sets in `.web-tools.json`
([manifest-fields.csv](manifest-fields.csv) lists the keys):

```json
"bundles": [
  {
    "base": "projects/budget-drs",
    "roots": ["data/source", "submittal/source-docs"],
    "table": "data/design/catalog/bundles.csv",
    "fileTable": "data/design/catalog/bundle-files.csv",
    "fileSources": "data/design/catalog/bundle-file-sources.csv",
    "skip": ["cache", "pages", "renditions"]
  }
]
```

`base` is optional. The other paths are relative to it, and so are the
`bundle` and `root` columns, which lets a project inside a repository keep its
own paths.

```sh
python3 <web-tools>/python/source-bundles.py --root <checkout>          # write both tables
python3 <web-tools>/python/source-bundles.py --root <checkout> --check  # fail if either is behind
```

Membership, sizes and checksums come from the Git index, as in the
[CSV census](csv-census.md), so an untracked cache cannot enter the tables and
a Windows checkout that converts line endings changes nothing. The cost is one
restriction: a file written into a bundle but not yet staged is left out of the
file table, and `--check` fails once it is committed. Run `git add` on the
bundle before writing. The script also fails on a bundle whose frontmatter
lacks `title` or `acquired`.

Run `--check` in the repository's own verification suite. A consumer finds the
script the way it finds [`dead-links.py`](../python/dead-links.py): a fetched
copy, then the marketplace clone, then a sibling web-tools checkout.

What a project builds on the tables stays with the project. budget-drs's
[catalog README](https://github.com/mehrlander/home/blob/main/projects/budget-drs/data/design/catalog/README.md)
is the worked example: a data catalog with one row per dataset, and a lineage
graph.
