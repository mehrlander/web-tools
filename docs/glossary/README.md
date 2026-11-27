# Glossary

The glossary records the words the estate's prose uses in a sense of its own,
and the plain words those senses collide with, so that a writer can tell
whether a word will be read in its plain English sense. It is one glossary for
the whole estate. A domain is a field on each sense, not a separate glossary.
The [Alignment](../../programs/alignment/README.md) program owns it, and the
Map view's [Glossary tab](https://mehrlander.github.io/web-tools/app/?view=map&tab=glossary)
shows it.

## Files

| File | Holds | Written by |
| --- | --- | --- |
| [`terms.csv`](terms.csv) | one row per term: whether its plain sense is safe to use, its variant spellings, the terms to read beside it | hand |
| [`senses.csv`](senses.csv) | one row per sense of a term: its domain, its gloss (what it means), the document that states it, and whether it is retired | hand |
| [`stats.csv`](stats.csv) | one row per term: how the hub's prose uses it | [`glossary-stats.py`](../../python/glossary-stats.py), through the commit hook |

Each column's meaning is in [`properties.csv`](../properties.csv), and the
values of `general` and `status` are in [`vocabularies.csv`](../vocabularies.csv).
A sense's `gloss` is one phrase drawn from its home document. When the two
differ, the home document is right and the row is corrected.

## The entry bar

Add a term when at least one of these holds:

1. **Special sense.** The estate uses the term in a sense a reader could not get from ordinary English, such as "closing state" or "pre-build".
2. **Collision.** A plain word has an estate sense, so the plain sense needs protecting, such as "list" or "form". Give the plain sense a row with domain `general`.
3. **Retirement.** A sense was renamed or retired. Keep it as a `retired` row naming its successor in `replaced_by`.
4. **Use before introduction.** Documents lean on the term without introducing it.

Leave out code identifiers that never appear in prose, named entities such as
bills, statutes and agencies, terms whose meaning an outside authority sets,
and a coinage that appears in one dated record only. When the estate narrows an
outside term, a sense row records the narrowing and its home cites the outside
definition.

## Importance

`stats.csv` measures each term over the Markdown that
[`duplicated-claims.py`](../../python/duplicated-claims.py) scans. Its
`importance` column multiplies spread (top-level folders that use the term),
markedness (the share of uses in bold, in a code span or in a heading) and the
logarithm of uses. The formula is the term lab's signature score, from
`projects/text/instruments/concept-lab/termlab.py` in the home repository. No
[gold set](../../skills/gold-set/SKILL.md) has scored it yet, so read it as one
signal beside the others, not as a ranking to act on alone.

## Adding terms

`python3 python/glossary-stats.py --candidates 40` lists phrases bolded in a
defining position that no term covers, ranked by spread. `--also <checkout>`
adds another repository's checkout to the list. The list is printed and not
committed. Cut it by the entry bar, then add the terms that pass in one
reviewed batch.
