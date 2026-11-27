# Glossary

The glossary lists the terms of art used in the estate's prose, meaning the prose of the owner's repositories. It also lists the plain English words that one of those terms could be confused with. A writer checks it to learn whether a reader will take a word in its plain sense. There is one glossary for every repository, and each sense records its domain in a column. The [Alignment](../../programs/alignment/README.md) program owns it. The Map view's [Glossary tab](https://mehrlander.github.io/web-tools/app/?view=map&tab=glossary) shows it.

## Files

| File | Holds | Written by |
| --- | --- | --- |
| [`terms.csv`](terms.csv) | one row per term | hand |
| [`senses.csv`](senses.csv) | one row per sense of a term | hand |
| [`stats.csv`](stats.csv) | one row per term, counted from Markdown | [`glossary-stats.py`](../../python/glossary-stats.py), run by the [commit hook](../../.githooks/pre-commit) |

Each column's meaning is in [`properties.csv`](../properties.csv), and the values of `general` and `status` are in [`vocabularies.csv`](../vocabularies.csv). A sense's `gloss` is one phrase drawn from the document in its `home` column. When the two differ, that document is right and the row is corrected.

## The entry bar

Add a term when at least one of these holds:

1. **Special sense.** The estate uses the term in a sense a reader could not get from ordinary English, such as "closing state" or "pre-build".
2. **Plain word with a second sense.** A plain word such as "list" or "form" also has an estate sense. A reader could take one sense for the other. Give the plain sense a row with domain `general`.
3. **Retirement.** A sense was renamed or retired. Keep it as a `retired` row naming its successor in `replaced_by`.
4. **Use before introduction.** Documents use the term without first saying what it means.

Leave out code identifiers that never appear in prose, named entities such as bills, statutes and agencies, terms whose meaning an outside authority sets, and a coinage that appears in one dated record only. When the estate narrows an outside term, a sense row records the narrowing. The document in its `home` column cites the outside definition.

## Importance

`stats.csv` counts each term in the web-tools Markdown files that [`duplicated-claims.py`](../../python/duplicated-claims.py) scans. The count leaves out this folder and every file in other repositories. The `glossary-stats` rows of [`properties.csv`](../properties.csv) define its columns, including the formula for `importance`. The formula comes from `termlab.py`, a script in the owner's private `home` repository that ranks the terms a set of documents uses.

The score has two known limits. It does not discount a word for being common across documents, as [TF-IDF](https://en.wikipedia.org/wiki/Tf%E2%80%93idf) does. It does not compare a term's rate with its rate in ordinary English. As a result, a plain word such as "form" scores far higher than a coinage such as "closing state". No [gold set](../../skills/gold-set/SKILL.md) has checked the score against a hand ranking.

## Adding terms

[`glossary-stats.py`](../../python/glossary-stats.py) run with `--candidates 40` lists phrases that are bolded where a sentence defines them and that no term matches, ordered by `areas`. `--also <checkout>` adds another repository's checkout to the scan. The list goes to the terminal only. Keep the candidates that meet the entry bar and add them in one reviewed batch. The method finds only terms that a document in the scan already defines in bold. It cannot find the terms that entry bar 4 describes.
