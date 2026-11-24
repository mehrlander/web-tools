# Text boundaries

This map answers one question about the text work: which home project or web-tools program claims each item it touches, and how.

A home project holds the files in its folder. A web-tools program governs the files its `governs` list in [`.web-tools.json`](../../../.web-tools.json) names. Either can also name an item it does not hold, in its charter, its README or an index it keeps.

## Files

[`boundaries.csv`](boundaries.csv) holds one row per item. [`boundaries.html`](boundaries.html) draws it as a matrix, items by claimant. [`boundaries-map.mjs`](boundaries-map.mjs) rewrites the measured columns, and its `--check` re-derives them.

## Columns

| Column | Holds | How it is set |
| --- | --- | --- |
| `project` | the home project whose folder holds the path | measured from the path |
| `program` | the web-tools program whose `governs` list covers the path | measured from `.web-tools.json` |
| `named_by` | each project or program that names the item without holding it | recorded, with the place it does so in `basis` |
| `proposed` | a project or program a pending proposal would move the item to | recorded |

An item with no project and no program is held by no one: the map marks it "no program".

## Scope

The rows are the items the text work has raised placement questions about: the Text project's instruments, probes and audit, the skills the audit's recipes name, the writing rules, the exemplars, and the tools that find repeated prose. An item joins when a session or the owner asks where it belongs.
