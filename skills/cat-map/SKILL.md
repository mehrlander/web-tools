---
name: cat-map
description: "Find the characteristics that separate a set of things before naming their categories, and check that each one separates something. Use when words for a kind of thing overlap, when one word covers several kinds, when a session is about to coin a term or choose between near-synonyms for a category, when asked what kind of thing something is among similar ones, or on /cat-map."
---

# Category map

## Premise

Words for kinds of things drift. One word gathers several senses, as "registry" names a listed CSV, a collection shape and a repository; several words share one sense, as list, log and stream do. Arguing from the words does not settle which kinds exist, and a coined word hides the distinction it was meant to carry. The things themselves settle it: what the words are applied to, and the characteristics on which those things differ. A table of characteristics, each with its range of values and an instance for each value, separates what the words ran together, and a name chosen afterwards can state its distinction instead of implying it.

## Goal and output

Four files, one per step, in the scratchpad or, for a case worth keeping, a research folder:

- `instances.csv`: one row per instance, with `instance` (its exact path or identifier), `called` (the word applied to it, blank for a contrast instance) and `where` (the line that applies it).
- `characteristics.csv` and `coded.csv`: one row per characteristic, with `characteristic`, `question`, `values` and `test`; then one row per instance and one column per characteristic, each cell a value or `n/a`.
- `checks.txt`: the script's report, with the response to each finding.
- `names.md`: the groups, each with its defining values, its typical and borderline members, a proposed term, and the text that would change.

The reply shows the characteristic table (characteristic, values, an instance for each value) and the recommendation.

## Process

1. **Gather.** State the words under test and the pairs of instances the user is unsure about. List every thing the words are applied to: search the repositories for the words and count referents, not occurrences. Add near neighbors the words are not applied to. Stop when a new instance would add no new value.
2. **Code.** Take characteristics from every existing definition of the words, sentence by sentence, then from instances compared three at a time, two from an unsure pair: what do two share that the third lacks. Give each a question, its values, and a test decidable from a named source. Code every instance on every characteristic; `n/a` where the question does not apply. A value states what is observed ("edited in place"); it does not use a word under test or any category name.
3. **Check.** Run `separation-checks.py` on `coded.csv` with the unsure pairs and the crosses in question, and answer each finding:
   - one value wherever it applies: drop the characteristic;
   - the same split as another, or fixed by another: merge them, or find an instance that separates them;
   - an unsure pair that nothing separates, or rows the user expects to differ that are identical: a characteristic is missing;
   - a combination no instance has: state why it is impossible, or search for an instance.

   Repeat steps 1 to 3 until every unsure pair is separated and every finding has an answer. The table is then fixed.
4. **Name.** Read only the fixed table. Group the instances that match on a minimal set of characteristics. Propose a term for each group in this order: a standard term whose standard meaning matches the defining values; a phrase built from those values; the identifier itself for a one-member group. Check each against the repository's declared vocabulary (`concept-index`), and give one term one concept. A name that needs a characteristic the table lacks sends the work back to step 2, where that characteristic is coded for every instance.

## Key insights

- **Name last.** A value chosen with a category in mind confirms the category. The bar on category words in values and the fixed table keep examining apart from naming.
- **A characteristic earns its place by separating instances**, not by appearing in a definition. "Found by a stable key", from web-tools' definition of a registry in `docs/registries.md`, separated nothing: the estate's notes stream has a key too.
- **One pair of words can bundle two characteristics.** Registry and stream each fix two values, what an entry stands for and whether it is edited; the estate held both combinations the pair left out.
- **An empty combination is a question.** It is impossible, or the sample missed it, and only a search tells which.
- **`n/a` across most characteristics marks another kind of thing.** The web-tools-private repository holds collections and is not one.
- **A list can be its only characteristic.** When membership in a curated list is all that separates members from neighbors, the category is the list, and its name should say so.
- **How a view orders items is not a property of the collection.** "Stack" described the tracker board, not the task files.
- **One example underdetermines a category.** Give two instances per value where the sample has them.
- **The sample bounds the result.** The checks report what the table supports. A second coder, scored as a `gold-set`, tests the codes.

Worked instance: the test on "registry", web-tools `research/category-mapping/README.md`.

## Bundled

- `separation-checks.py`: step 3. Arguments after the CSV are pairs (`"a|b"`) and crosses (`x:c1,c2`). It searches every subset of characteristics, so keep a table under about 15.

## Extending

- A blind namer: a subagent given only the fixed table, its terms compared with the session's.
- A second coder's `coded.csv`, scored against the first.
