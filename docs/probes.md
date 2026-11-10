# Probes

A probe is an inquiry meant to resolve some uncertainty of interest. It is filed as [research](CONSTELLATION.md#projects-and-research): alone, or with others in a folder that keeps a registry.

## Filing a probe

A probe keeps its question, what was tried, and what it found. A probe that stands alone is a write-up the repository's [`.web-tools.json`](manifest.md#research-declarations) lists among its research declarations, with `"kind": "probe"`. Several probes kept together share a folder: the folder's `README.md` is the declared entry, and beside it sit:

- `probes.csv`, the registry: one row per probe, the source of truth for what the folder holds.
- Each probe's write-up, where it has one: a file named `YYYY-MM-DD-slug.md`, or a folder of that name when the probe has more than one file. A probe whose whole record fits in its row has only the row.

The folder's README links the term probes to this file and says only what is particular to the folder. Any view of the registry, such as a page that lists the probes or a generated log, belongs to the folder and reads `probes.csv`.

## Registry columns

Required in every row:

| Column | Holds |
| --- | --- |
| `probe` | The id: lowercase letters, digits and hyphens, unique in the registry. A write-up's id is its name without `.md`. |
| `date` | The probe's as-of date, `YYYY-MM-DD`. |
| `title` | A short topical name, for lists. |
| `question` | What the probe asks. |
| `summary` | Its findings, in a sentence or two. |

Read when present:

| Column | Holds |
| --- | --- |
| `path` | The write-up, relative to the folder: a file, or a file inside a probe's folder. |
| `standing` | How the probe came out: `worked`, `mixed`, `failed` or `open`. |
| `tags` | Terms a search might use, separated by `;`. |

A folder may add columns of its own, which the check ignores.

## The check

[`python/probes.py`](../python/probes.py) `[--root DIR]` checks every declared probes folder that has a `probes.csv` against the columns above, and fails on a dated file or folder beside the registry that no row's `path` names. Its docstring lists each rule. `--new FOLDER` writes an empty registry, its header only. A repository runs the check in its own suite, as it runs the [source-bundles](source-bundles.md) check.

Register a probe in the commit that adds its write-up.
