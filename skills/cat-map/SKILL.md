---
name: cat-map
description: "Examine a set of category words that blur together: what each implies, whether together they carve the things they name into clean boxes or sit on different axes, and where usage has drifted from meaning, before renaming anything. Ends in an answer drawn as a poster: which word to use, which names change, what is left to decide. Use when words for kinds of things overlap, when one word covers several kinds, when a session is about to coin a term or choose between near-synonyms for a category, when asked what kind of thing something is among similar ones, or on /cat-map."
---

# Category map

## Premise

The subject is the categories, not the things. Each word for a kind of thing (registry, stream, list; standing, occasioned, recurring) implies values of a few characteristics. Laid out together, those implications partition a space, sit on different axes, overlap or leave gaps. The things the words are applied to test the implications: a thing called by a word without the values the word implies is usage drifting from meaning. Recovering the space behind a set of existing types is what Lazarsfeld and Barton called substruction. Arguing from the words, or coining another, skips both the space and the test.

## Goal and output

A poster that answers the question the map was made for, drawn by web-tools `pages/cat-map.html` from one `catmap/1` file, and the answer in the reply. In a web-tools checkout, render the poster to an image and send it as a file card:

```bash
npm run shot -- pages/cat-map.html --hash 'src=../<path>.json&poster=1' --width 720 --scale 2 --full --out poster.png
```

For a map outside web-tools, `gz=` and the file gzipped and base64url-encoded replace `src=`. Hand the page over too, for the evidence behind the poster: `https://mehrlander.github.io/web-tools/pages/cat-map.html#gh=<owner>/<repo>@<ref>:<path>`.

The file is JSON: `format: "catmap/1"`, `title`, `answer`, `steps` (optional), `made`, and `runs`, one per run, several when blind readers take one question. The poster draws the answer:

- `title`, `lede`: the question in the owner's words ("What kind of collection is it?") and the answer in a sentence.
- `basis`: the run whose coded instances supply the examples.
- `grid`: the two characteristics that decide the word, `{across, down, cells}`. Each axis is `{char, values}` and each value `{is, label}`: `char` is a characteristic of the basis run, `is` the coded value or values the column or row takes, `label` the plain question ("Each entry is a thing"). Each cell is `{word, means, examples}`: the word, empty where none fits yet; what it means, in plain words; two or three instance ids. `note`, optional, settles a case the two questions leave open.
- `add`: words that add to the name when they apply, `{word, icon, means, requires, called, examples}`. `requires` maps characteristics to values and `called` lists senses, at least one of which must call the thing: the condition each example is held to; `icon` is a Phosphor icon name.
- `renames`: names the answer changes, `{things, from, becomes, why}`, `things` being the instances now called `from`.
- `open`: what only the owner can decide, `{question, recommend, why}`, with `recommend` empty where no recommendation is warranted.
- `by`: whose answer it is and where its examples come from, the poster's footnote. With several runs, each row lists the runs that state it in `runs`.

`steps` lists how the map was made, `{step, gloss, example}`, for the page's account of how the answer was reached. A run holds:

- `by`, `method`: who coded the run, and how.
- `characteristics`: `{id, label, short, values}`, a question and its values.
- `categories`: one per sense, `{id, word, sense, tag, where, requires, kind, verdict}`. `requires` maps a characteristic to the value the sense implies; a characteristic it leaves out is open. `where` is the line that defines or uses the sense.
- `instances`: `{id, name, called, where, values, evidence}`. `name` is how the poster shows it; `called` lists the senses the thing is called by, empty for a contrast instance; `where` is the line that calls it so; `values` has every characteristic, `n/a` where the question does not apply; `evidence` lists `{char, evidence}`, the source for any value the instance does not show on its face.
- `pairs` (the instances the user is unsure about), `field` (`{x, y}`, the two characteristics the page plots first), `findings` (written by the script, each answered in its `rationale`), `outcome` (`{kinds, summary}`).

`kind` is one of `value` (fixes one characteristic), `region` (fixes two or more at once), `list` (membership in a curated list is its only separating characteristic), `outside` (`n/a` on the characteristics the other senses share: another kind of thing) or `fuzzy` (typical and borderline members, no clean edge). `outcome.summary` says whether the words are alternatives on one axis, values on different axes, or a mix.

## Process

1. **Categories.** List the words under test and, for a word used in more than one sense, each sense, with `where`. For each sense write `requires`, from its definitions read sentence by sentence (`atomic-decomposition`) and from how it is used. Output: `categories`.
2. **Space.** Gather the characteristics the senses imply into `characteristics`, each a question with its values. Add a characteristic where two senses differ and no definition says how, found by comparing instances three at a time, two from an unsure pair: what do two share that the third lacks. Set `field` to the pair most senses constrain. Output: `characteristics`, `field`.
3. **Instances.** Collect what each sense is applied to: search the repositories, counting referents, not occurrences. Add near neighbors no word is applied to. Code every instance on every characteristic. A value states what is observed ("edited in place"); it does not use a word under test. Stop when a new instance would add no new value. Run `separation-checks.py <map>.json --write` and answer each finding:
   - one value wherever it applies: drop the characteristic;
   - the same split as another, or fixed by another: merge them, or find an instance that separates them;
   - an unsure pair nothing separates: a characteristic is missing;
   - a combination no instance has: say why it is impossible, or search for an instance.

   Output: `instances`, `pairs`, `findings`.
4. **Answer.** Give each sense its `kind` and a one-line `verdict`, and the set its `outcome`. Then answer the question the map was made for, as the poster will show it: the question in the owner's words; the two characteristics that decide the word, with a plain meaning and two or three examples from the basis run in each cell; the words that add to it, each with the condition that makes it apply; the names that change; and what only the owner can decide, with a recommendation where one is warranted. Propose a name only where the answer calls for one, in this order: a standard term whose meaning matches the values; a phrase built from the values; the identifier itself for a one-member sense. Check each against the repository's declared vocabulary (`concept-index`). With several runs, draw one answer from all of them and mark each row with the runs that state it. Run `answer-check.py <map>.json`, fix each problem it names, then render the poster and look at it. Output: `kind`, `verdict`, `outcome`, `answer`.

## The poster

- **It opens on the owner's question**, in the owner's words, and the lede answers it. How the map was made is one footnote line.
- **Every cell and word shows things the owner knows**, two or three, placed by the coding. A cell's examples are plain cases: one that also meets an add-on word's condition belongs under that word, and `answer-check.py` refuses it in the cell.
- **An example can be found**: a path or file name wherever a common name could mean two things. "The traffic logs" sent three readers to the wrong collection; `logs/traffic/` would not have.
- **A thing called by the wrong word shows it**, the old word struck through in red beside the name it should have.
- **It ends in calls for the owner**, not in description.
- **The canvas is 720 pixels wide, rendered at twice that**, with body text at 18 pixels or more and examples at 15 in monospace, so the image reads on a phone. One accent marks the answer's words; red marks only a wrong name.

## Key insights

- **A placement on the poster is a claim.** The first draft showed trackers.md as a plain registry, though its own coding made it a cache, and notes as a plain stream, though the Lists view lists it; the check exists because the eye passed both.
- **A map ends in an answer.** Verdicts on each sense describe the words; the owner asked what to call things. A map whose last step is a description leaves the reader to draw the answer, and four blind runs that agreed on nine of thirteen findings still did not write one down.
- **The categories are the subject; the instances are the test.** A sense's `requires` comes from its definitions and use, and the instances show whether it holds.
- **Rivals share an axis.** Two words that constrain different characteristics are not alternatives, and cannot be made exhaustive and exclusive; each becomes a value on its own axis. "Transient" was whether entries leave; "stack" was the order a view reads them in.
- **One word can fix two characteristics.** Registry and stream each fix what an entry stands for and whether it is edited; the estate held both combinations the pair left out.
- **A characteristic earns its place by separating instances**, not by appearing in a definition. "Found by a stable key", from web-tools' definition of a registry in `docs/registries.md`, separated nothing: the estate's notes stream has a key too.
- **An empty combination is a question.** It is impossible, or the sample missed it, and only a search tells which.
- **A list can be its only characteristic.** When membership in a curated list is all that separates members from neighbors, the category is the list, and its name should say so.
- **`n/a` across the shared characteristics marks another kind of thing.** The web-tools-private repository holds collections and is not one.
- **One example underdetermines a category.** Give two instances per value where the sample has them.
- **Readers who disagree have found something.** Two blind runs that code one cell differently point at a characteristic whose test is unclear.

Worked instances: web-tools `research/category-mapping/collections-map.json`, four blind runs and one answer, and `registry-map.json`, one run.

## Bundled

- `answer-check.py`: step 4. Holds every placement in the answer to the basis run's coding, and lists the instances the answer places nowhere.
- `separation-checks.py`: step 3. `--write` puts the findings into each run, where the page strikes a characteristic that separates nothing and marks one fixed by another. It also reads a CSV of instances by characteristics, with pairs (`"a|b"`) and crosses (`x:c1,c2`) as arguments.

## Extending

- Blind readers: several runs of one question in one file, set side by side by the page's Compare view.
