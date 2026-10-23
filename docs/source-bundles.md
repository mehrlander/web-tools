# Source bundles

A **source bundle** is a folder of material from outside the repository, kept
because we need to know where it came from. Its README's frontmatter records
that provenance, and a script writes two tables from every bundle a repository
declares. Keep provenance in the frontmatter, which is all the tables read,
rather than in a per-bundle file such as `source.json`.

## What a bundle is

A bundle is a folder holding a tracked `README.md`, either one level below a
declared root or named under `folders`. Everything tracked beside and below the
README belongs to it, except path parts that start with a dot, `__pycache__`,
and names listed under `skip`.

A bundle holds one intake, in a dated `YYYY-MM-DD-slug/` folder that is not
revised (a later pull is a new folder), or a series: one publisher's product
across intakes, usually as dated snapshots inside it.

A running record that a scheduled writer extends, such as a weekly ledger, is
not a bundle, since each run would leave the file table behind. List its folder
under `exclude` and describe it in the manifest's [`stores`](manifest.md#stores).

## The README's frontmatter

A leading `---` block. Quote every value, so a YAML parser reads `2026-05-18`
and `no` as strings and accepts a value holding `: `.

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

Other keys are allowed; the tables ignore them.

## The tables

The script writes a bundle table, one row per bundle from its frontmatter, and
a file table, one row per file with its size and `sha256`. Edit the READMEs,
not the tables. A bundle with more files than `enumerateMax` (300 unless
declared) gets one totals row in the file table and must keep an inventory of
its own, such as a manifest. An optional authored table under `fileSources`
records what the source said about individual files; each of its rows must name
a file the file table lists.

## Declaring and running

A repository declares its bundle sets in `.web-tools.json`;
[manifest-fields.csv](manifest-fields.csv) lists the keys. budget-drs's
declaration:

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

`base` is optional; the other paths, and the tables' `bundle` and `root`
columns, are relative to it.

```sh
python3 <web-tools>/python/source-bundles.py --root <checkout>          # write both tables
python3 <web-tools>/python/source-bundles.py --root <checkout> --check  # fail if either is behind
```

The script reads membership, sizes and checksums from the Git index. Stage a
new or changed bundle before writing: an unstaged file is left out, and
`--check` fails once it is committed.

Run `--check` in the repository's verification suite, resolving the script as
[`dead-links.py`](../python/dead-links.py) is resolved: a fetched copy, then the
marketplace clone, then a sibling web-tools checkout.
