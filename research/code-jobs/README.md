# Code jobs: finding one job done in several places

A probe, started 2026-10-24. The question: can a cheap model reader find
functions that do the same job in different files, when the code itself shares
little text? A copy detector (jscpd) and a comparison of file header comments
both missed the case that prompted it: two table engines, the transform
workbench and the tabular explorer, each with its own Profile and Pivot.

The method is the one the session topics follow-up uses
(web-tools-private `sessions/topics/`): read each unit and say what it does,
then group units by what was said. Here the unit is a function, not an exchange.

## Inputs, fixed before any model ran

| File | What it is |
| --- | --- |
| [`unitize.mjs`](unitize.mjs) | splits files into function units; a nested function is cut out of its parent, so each line belongs to one unit |
| [`batches.py`](batches.py) | packs the units into reader batches and writes the index |
| [`units.jsonl`](units.jsonl) | one row per unit: id, file, lines, name, sha |
| [`batches/`](batches/) | what every reader saw, 550 units from 14 files in 9 batches |
| [`key.json`](key.json) | eight groups of units known to share a job, with the evidence for each |
| [`prompt-summary.md`](prompt-summary.md) | the step 1 instruction every reader got |

The units are web-tools at `2df660117`, the main commit this branch starts from:

```
node research/code-jobs/unitize.mjs <out.jsonl> <the 14 files>
python3 research/code-jobs/batches.py <out.jsonl>
```

The 14 files are the two table engines and their neighbours (`xlsx.js`,
`xlsx-extract.js`, `report-layout.js`, `csv.js`, `row-menu.js`,
`json-explorer.js`, `pages/pivot-table.html`, `node/build/registries-load.mjs`),
and the swipe-deck kit with three components that hand-build its swiper
(`file-browser.js`, `here-view.js`, `user-call-form.js`).
