# Text boundaries

This map answers one question about the text work: which project or program has a stake in each item it touches, and of what kind.

The stakeholders are of two kinds. A project in the [home](https://github.com/mehrlander/home) repository holds the files under its folder, `projects/<name>/`. A web-tools program governs the files its `governs` list in [`.web-tools.json`](../../../.web-tools.json) names. Either can also name an item it does not hold or govern, in its charter, its README or an index it keeps.

[`boundaries.html`](boundaries.html) draws the map as a matrix, items by project and program.

## Columns

| Column | How it is set |
| --- | --- |
| `project` | measured from the path |
| `program` | measured from `.web-tools.json` |
| `named_by` | recorded, with the place each naming is stated in `basis` |
| `proposed` | recorded: the project or program a pending proposal would move the item to |

The map marks an item with neither a project nor a program "no program".

## Scope

A row is an item of home's [Text project](https://github.com/mehrlander/home/blob/main/projects/text/README.md), or of a project or program next to it, whose placement a session or the owner has questioned. [`boundaries.csv`](boundaries.csv) lists them.
