# Probe registries

A folder that holds several [probes](CONSTELLATION.md#projects-and-research) keeps one registry of them, `probes.csv`, which [`python/probes.py`](../python/probes.py) checks. This file is the contract: read it to adopt a registry, to write a view of one, or to change the design. A probe declared on its own in `.web-tools.json` needs no registry.

## The model

A probes folder is a folder whose `README.md` the repository's `.web-tools.json` declares under `research`, with `"kind": "probe"`. Beside the README sit:

- `probes.csv`: one row per probe, the source of truth for what the folder holds.
- Each probe's write-up, where it has one: a file named `YYYY-MM-DD-slug.md`, or a folder of that name when the probe has more than one file. A probe whose whole record fits in its row needs no write-up.

The README links [probes](CONSTELLATION.md#projects-and-research) as a term and says only what is particular to the folder. Any view of the registry, such as a page that lists the probes or a generated log, is the folder's own and reads `probes.csv`.

## Columns

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
| `standing` | `worked`, `mixed`, `failed` or `open`. |
| `tags` | Terms a search might use, separated by `;`. |

Any other column belongs to the folder and passes unread, such as budget-drs's `bundle`, which names the source bundle a probe's claims cite.

## The check

`python3 python/probes.py [--root DIR]` reads every declared probes folder that holds a `probes.csv`. It fails when:

- a required column is missing, or a required cell is empty;
- two rows share an id, or an id is not lowercase letters, digits and hyphens;
- a date is not `YYYY-MM-DD`, or a dated id or path carries another date than its row's;
- a path names nothing in the folder;
- a dated file or folder beside the registry is named by no row's path;
- a standing is not one of the four values.

A declared probe folder with no `probes.csv` is counted and passes. `python3 python/probes.py --new FOLDER` writes an empty registry, its header only. A repository runs the check in its own suite, as home's `tools/verify-artifacts.sh` runs `python/source-bundles.py`.

Register a probe in the commit that adds its write-up: the check fails on a dated write-up that no row names.
