---
name: cat-map
description: "Examine a set of category words that blur together: what each implies, whether together they carve the things they name into clean boxes or sit on different axes, and where usage has drifted from meaning, before renaming anything. Use when words for kinds of things overlap, when one word covers several kinds, when a session is about to coin a term or choose between near-synonyms for a category, when asked what kind of thing something is among similar ones, or on /cat-map."
---

# Category map

## Premise

The subject is the categories, not the things. Each word for a kind of thing (registry, stream, list; standing, occasioned, recurring) implies values of a few characteristics. Laid out together, those implications partition a space, sit on different axes, overlap or leave gaps. The things the words are applied to test the implications: a thing called by a word without the values the word implies is usage drifting from meaning. Recovering the space behind a set of existing types is what Lazarsfeld and Barton called substruction. Arguing from the words, or coining another, skips both the space and the test.

## Goal and output

One `catmap/1` file, drawn by web-tools `pages/cat-map.html`, and the verdict in the reply. Hand the page over as `https://mehrlander.github.io/web-tools/pages/cat-map.html#gh=<owner>/<repo>@<ref>:<path>`, or `#gz=` for an uncommitted file.

The file is JSON: `format: "catmap/1"`, `title`, `question`, `made`, and `runs`, one per run, several when blind readers map one question. A run holds:

- `by`, `method`: who coded it and how.
- `characteristics`: `{id, label, short, values}`, a question and its values.
- `categories`: one per sense, `{id, word, sense, tag, at, requires, kind, verdict}`. `requires` maps a characteristic to the value the sense implies; a characteristic it leaves out is open. `at` is where the sense is defined or used.
- `instances`: `{id, called, where, values, evidence}`. `called` lists the senses the thing is called by, empty for a contrast instance; `where` is the line that calls it so; `values` has every characteristic, `n/a` where the question does not apply; `evidence` lists `{char, evidence}`, the source for any value the instance does not show on its face.
- `pairs` (the instances the user is unsure about), `field` (`{x, y}`, the two characteristics the page plots first), `findings` (written by the script), `outcome` (`{kinds, summary}`).

`kind` is one of `value` (fixes one characteristic), `region` (fixes two or more at once), `list` (membership in a curated list is its only separating characteristic), `outside` (`n/a` on the characteristics the other senses share: another kind of thing) or `fuzzy` (typical and borderline members, no clean edge). `outcome.summary` says whether the words are alternatives on one axis, values on different axes, or a mix.

## Process

1. **Categories.** List the words under test and, for a word used in more than one sense, each sense, with `at`. For each sense write `requires`, from its definitions read sentence by sentence (`atomic-decomposition`) and from how it is used. Output: `categories`.
2. **Space.** Gather the characteristics the senses imply into `characteristics`, each a question with its values. Add a characteristic where two senses differ and no definition says how, found by comparing instances three at a time, two from an unsure pair: what do two share that the third lacks. Set `field` to the pair most senses constrain. Output: `characteristics`, `field`.
3. **Instances.** Collect what each sense is applied to: search the repositories, counting referents, not occurrences. Add near neighbors no word is applied to. Code every instance on every characteristic. A value states what is observed ("edited in place"); it does not use a word under test. Stop when a new instance would add no new value. Run `separation-checks.py <map>.json --write` and answer each finding:
   - one value wherever it applies: drop the characteristic;
   - the same split as another, or fixed by another: merge them, or find an instance that separates them;
   - an unsure pair nothing separates: a characteristic is missing;
   - a combination no instance has: say why it is impossible, or search for an instance.

   Output: `instances`, `pairs`, `findings`.
4. **Verdict.** Give each sense its `kind` and a one-line `verdict`, and the set its `outcome`. Propose a name only where a verdict calls for one, in this order: a standard term whose meaning matches the values; a phrase built from the values; the identifier itself for a one-member sense. Check each against the repository's declared vocabulary (`concept-index`). Output: `kind`, `verdict`, `outcome`.

## Key insights

- **The categories are the subject; the instances are the test.** A sense's `requires` comes from its definitions and use, and the instances show whether it holds.
- **Rivals share an axis.** Two words that constrain different characteristics are not alternatives, and cannot be made exhaustive and exclusive; each becomes a value on its own axis. "Transient" was whether entries leave; "stack" was the order a view reads them in.
- **One word can fix two characteristics.** Registry and stream each fix what an entry stands for and whether it is edited; the estate held both combinations the pair left out.
- **A characteristic earns its place by separating instances**, not by appearing in a definition. "Found by a stable key", from web-tools' definition of a registry in `docs/registries.md`, separated nothing: the estate's notes stream has a key too.
- **An empty combination is a question.** It is impossible, or the sample missed it, and only a search tells which.
- **A list can be its only characteristic.** When membership in a curated list is all that separates members from neighbors, the category is the list, and its name should say so.
- **`n/a` across the shared characteristics marks another kind of thing.** The web-tools-private repository holds collections and is not one.
- **One example underdetermines a category.** Give two instances per value where the sample has them.
- **Readers who disagree have found something.** Two blind runs that code one cell differently point at a characteristic whose test is unclear.

Worked instance: web-tools `research/category-mapping/registry-map.json`.

## Bundled

- `separation-checks.py`: step 3. `--write` puts the findings into each run, where the page strikes a characteristic that separates nothing and marks one fixed by another. It also reads a CSV of instances by characteristics, with pairs (`"a|b"`) and crosses (`x:c1,c2`) as arguments.

## Extending

- Blind readers: several runs of one question in one file, set side by side by the page's Compare view.
