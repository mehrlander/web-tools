# Probes

A probe is an inquiry meant to resolve some uncertainty of interest. It is filed as [research](CONSTELLATION.md#projects-and-research): alone, or with others in a folder that keeps a registry.

## Filing a probe

A probe keeps its question, what was tried, and what it found. A probe that stands alone is a write-up the repository's [`.web-tools.json`](manifest.md#research-declarations) lists among its research declarations, with `"kind": "probe"`. Several probes kept together share a folder: the folder's `README.md` is the declared entry, and beside it sit:

- `probes.csv`, the registry: one row per probe, the source of truth for what the folder holds.
- Each probe's write-up, where it has one: a file named `YYYY-MM-DD-slug.md`, or a folder of that name when the probe has more than one file. A probe whose whole record fits in its row has only the row.

The folder's README links the term probes to this file and says only what is particular to the folder. Any view of the registry, such as a page that lists the probes or a generated log, belongs to the folder and reads `probes.csv`.

## Lifecycle

A probe's [research declaration](manifest.md#research-declarations) may give a `lifecycle`, the inquiry's current step: `planned`, `active`, `maintained` or `revising`. A probe whose write-up must not change after it lands on main is marked `edit=write-once` in [`.gitattributes`](../.gitattributes). A probe that is no longer maintained is moved to an [`archive/`](../archive/) folder.

## Sources

A probe that rests on documents from outside the repository cites a [source bundle](source-bundles.md) that holds them, or takes them in as a dated bundle of its own.

When a reader should be able to check each claim against its source's own words, list the claims in a `claims.csv`. Keep each claim's verbatim support in an `anchors.csv`, with the columns the [source-anchoring](../skills/source-anchoring/SKILL.md) skill gives. A check then finds each quote on its page, and the prose states each claim once and names its anchor. budget-drs's [`2026-11-07-gated-nonappropriated`](https://github.com/mehrlander/budget-drs/blob/main/data/design/probes/2026-11-07-gated-nonappropriated/FINDINGS.md) is the worked case, checked by its `build-probes.py`.

## Registry columns

Required in every row:

| Column | Holds |
| --- | --- |
| `probe` | The id: lowercase letters, digits and hyphens, unique in the registry. A write-up's id is its name without `.md`. |
| `date` | When the inquiry began, `YYYY-MM-DD`. A dated id or path begins with the same date. |
| `title` | A short topical name, for lists. |
| `question` | What the probe asks. |
| `summary` | Its findings, in a sentence or two. |

Read when present:

| Column | Holds |
| --- | --- |
| `path` | The write-up, relative to the folder: a file, or a file inside a probe's folder. |
| `tags` | Terms a search might use, separated by `;`. |
| `bundle` | The source bundle holding the documents the probe cites, as a path. |

A folder may add columns of its own, which the check ignores.

## The check

[`python/probes.py`](../python/probes.py) `[--root DIR]` checks every declared probes folder that has a `probes.csv` against the columns above, and fails on a dated file or folder beside the registry that no row's `path` names. Its docstring lists each rule. `--new FOLDER` writes an empty registry, its header only. A repository runs the check in its own suite, as it runs the [source-bundles](source-bundles.md) check.

Register a probe in the commit that adds its write-up.
