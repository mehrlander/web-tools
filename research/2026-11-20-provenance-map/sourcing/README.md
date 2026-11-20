# Sourcing measures and patterns

[`measure.py`](measure.py) writes [`measures.csv`](measures.csv), one row for each probe and research write-up the account surveys. Each row counts:

- words
- links into stores of fetched outside material
- external addresses
- links to other analysis
- files in the write-up's own folder
- quotations of more than 15 words

The script's docstring defines each column and gives the commands that extract the trees it reads.

[`patterns.csv`](patterns.csv) holds an authored call: each write-up's sourcing patterns, assigned by a subagent that read it, with the values the [account's pattern table](../README.md#how-the-write-ups-hold-their-sources) defines. A write-up the subagent did not single out got `estate-material`, plus `external-urls` where it cites a web address.

The same subagent recounted the own-folder files of five write-ups whose folders the script's naming rule misread. `measures.csv` keeps the script's counts; these are the counts as read:

| Write-up | Source files | Scripts | Tables | What the folder holds |
| --- | --- | --- | --- | --- |
| budget-drs [`2026-10-29-monthly-data-model`](https://github.com/mehrlander/budget-drs/tree/main/data/design/probes/2026-10-29-monthly-data-model) | 1 | 1 | 0 | a TSV the owner pasted |
| web-tools [`DOC_CRAFT_STUDY.md`](../../DOC_CRAFT_STUDY.md) | 2 | 0 | 0 | the original specimens |
| home [`concept-lab`](https://github.com/mehrlander/home/tree/main/projects/text/instruments/concept-lab) | 1 | 13 | 1 | fetched Google Books counts |
| home [`excel-validation-2026-09-24`](https://github.com/mehrlander/home/tree/main/projects/office/research/excel-validation-2026-09-24) | 0 | 12 | 16 | the run's own captures |
| home [`excel-chart-review-2026-09-25`](https://github.com/mehrlander/home/tree/main/projects/office/research/excel-chart-review-2026-09-25) | 6 | 2 | 2 | an earlier Gemini pass the owner handed in |
