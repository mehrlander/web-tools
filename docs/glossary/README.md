# Glossary

The glossary lists the terms of art used in the estate's prose, meaning the prose of the owner's repositories. It also lists the plain English words that one of those terms could be confused with. A writer checks it to learn whether a reader will take a word in its plain sense. There is one glossary for every repository, and each sense records its domain in a column. The [Alignment](../../programs/alignment/README.md) program owns it, and the Map view's [Glossary tab](https://mehrlander.github.io/web-tools/app/?view=map&tab=glossary) shows it.

## Files

| File | Holds | Written by |
| --- | --- | --- |
| [`terms.csv`](terms.csv) | one row per term: whether its plain sense is safe to use, its variant spellings, the terms to read beside it | hand |
| [`senses.csv`](senses.csv) | one row per sense of a term: its domain, its gloss (what it means), its `home` (the document that states the sense), and whether it is retired | hand |
| [`stats.csv`](stats.csv) | one row per term: how web-tools' own Markdown uses it | [`glossary-stats.py`](../../python/glossary-stats.py), run by the [commit hook](../../.githooks/pre-commit) |

Each column's meaning is in [`properties.csv`](../properties.csv), and the values of `general` and `status` are in [`vocabularies.csv`](../vocabularies.csv). A sense's `gloss` is one phrase drawn from the document in its `home` column. When the two differ, that document is right and the row is corrected.

## The entry bar

Add a term when at least one of these holds:

1. **Special sense.** The estate uses the term in a sense a reader could not get from ordinary English, such as "closing state" or "pre-build".
2. **Plain word with a second sense.** A plain word such as "list" or "form" also has an estate sense. A reader could take one sense for the other. Give the plain sense a row with domain `general`.
3. **Retirement.** A sense was renamed or retired. Keep it as a `retired` row naming its successor in `replaced_by`.
4. **Use before introduction.** Documents use the term without first saying what it means.

Leave out code identifiers that never appear in prose, named entities such as bills, statutes and agencies, terms whose meaning an outside authority sets, and a coinage that appears in one dated record only. When the estate narrows an outside term, a sense row records the narrowing, and the document in its `home` column cites the outside definition.

## Importance

`stats.csv` counts each term in the Markdown files that [`duplicated-claims.py`](../../python/duplicated-claims.py) scans in web-tools. Other repositories are not counted. For each term it records:

- `uses`, the number of matches;
- `areas`, the number of top-level folders with a match;
- `marked`, the share of matches in bold, in a code span or in a heading.

`importance` is `areas × marked × ln(1 + uses)`. The home repository's term lab ranks terms with the same product, in `projects/text/instruments/concept-lab/termlab.py`.

The score has two known limits. It does not discount a word for being common across documents, as [TF-IDF](https://en.wikipedia.org/wiki/Tf%E2%80%93idf) does. It does not compare a term's rate with its rate in ordinary English. In the current scan, the plain word "form" scores 10.9 and the coinage "closing state" scores 1.7. No [gold set](../../skills/gold-set/SKILL.md) has checked it against a hand ranking.

## Adding terms

`python3 python/glossary-stats.py --candidates 40` lists phrases that are bolded where a sentence defines them and that no term matches, ordered by `areas`. `--also <checkout>` adds another repository's checkout to the scan. The command prints the list and writes no file. Keep the candidates that meet the entry bar and add them in one reviewed batch. The method finds only terms that some document already defines in bold. It cannot find the terms that entry bar 4 describes.
