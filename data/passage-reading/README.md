# Passage reading (`passage-reading/1`)

A **reading** is one JSON file: a model's sentence-by-sentence account of one passage, written with whatever surrounding document it was given as context. A skill writes a reading, and the Passage reader page renders any reading; neither depends on the other beyond this format. This folder holds the format and the sample readings. [`skill-prefs-description.json`](skill-prefs-description.json) is the first sample, and [`pages/scratch/passage-reader.html`](../../pages/scratch/passage-reader.html) renders it, or any reading addressed with `#gh=owner/repo[@ref]:path` or held in the link as `#gz=`.

This folder, the Passage reader page, and the skill still to be written are one probe. After the skill is tested on a passage it has not seen, the three graduate together (the format moves into the skill's folder and the page leaves `pages/scratch/`) or are deleted together.

## The file

| Field | Holds |
| --- | --- |
| `format` | `passage-reading/1` |
| `title` | A name for the reading |
| `made` | The date the reading was written |
| `source` | `path` and a `note` saying where the passage comes from, and `repo` when it lives in one |
| `gist` | One sentence on what the passage does, start to end |
| `topic` | The id of the entity the passage is about; an ellipsis of it is not listed as a connection |
| `context` | The documents supplied as context: `id`, `repo`, `path`, `ref` (a commit), `why` |
| `entities` | Keyed by id: `label`, `gloss`, `basis`, and `ctx` when `basis` is `context` |
| `lead` | A run-in heading before the first sentence, if the passage has one |
| `sentences` | In order, numbered `n` from 1 |

An entity is a thing the passage names that a later sentence depends on, or a term a reader may need explained. The noun every sentence is about (here, *skill*) is not an entity. `basis` says where the gloss comes from: `passage`, `context` (with `ctx`, a list of `doc` and `quote` pairs), or `general` (the model's own knowledge, which the reader cannot check against the page).

## A sentence

`n`, `text` (exact, inline code in backticks), `role`, and three lists:

- **`mentions`**: each place the sentence refers to an entity. `e` is the entity id and `quote` is the span. `form` is omitted when the words name the entity. It is `anaphor` when the words need an antecedent to be understood: a pronoun, a demonstrative, or a definite description such as *that one decision*. It is `ellipsis` when the entity is not written at all; `quote` is then the span the gap follows, usually the word that governs it (the description is the unstated object of *Write*), and `fill` holds the words that complete it. Where `quote` occurs more than once in the sentence, `in` gives a longer span that contains it once (each *its* in *its own prompts* and *its own output*). An anaphor or ellipsis resolves to the entity's first named mention; `ante: <n>` overrides that, and `note` records a resolution a reader could get wrong.
- **`links`**: connections to an earlier sentence that no mention makes. `to` is the earlier sentence, `kind` is below, `here` and `there` are the spans at each end, `gloss` states how the two sentences connect, and `implied: true` marks a connection that no connective states. A claim that follows from the connection without being written goes in an implied atom, not in the gloss.
- **`atoms`**: the separate claims the sentence makes, after [atomic-decomposition](../../skills/atomic-decomposition/SKILL.md): `id` (a letter), `role`, `claim` (stated plainly, its references resolved, standing alone), `quote`, and optionally `for` (the atom an evidence or example atom serves), `implied`, `note`.

## Vocabularies

`role`, for sentences and atoms alike:

| Role | The sentence or claim |
| --- | --- |
| `definition` | says what a term means or what a thing is |
| `premise` | states a fact the passage builds on |
| `claim` | asserts something the passage argues for |
| `rule` | directs the reader to do or avoid something |
| `evidence` | offers a case or observation in support of another statement |
| `example` | illustrates another statement with an instance or a form |
| `exception` | carves a case out of another statement |

Link `kind`, read as "this sentence *kind* sentence `to`", loosely after the relations of Rhetorical Structure Theory:

| Kind | This sentence |
| --- | --- |
| `elaborates` | spells out what or how for the earlier one |
| `rests-on` | takes its reason from the earlier one |
| `narrows` | limits the earlier one or carves a case out of it |
| `contrasts` | sets itself against the earlier one |
| `supports` | offers evidence or an example for the earlier one |

## Anchoring

Every `quote`, `here` and `there` is an exact substring of its sentence's `text` and occurs there once; where a phrase repeats, lengthen the quote until it is unique. A `ctx` quote is an exact substring of the context document at its `ref`. Spans are found by text, not by character offset.

## What the page derives

The page computes these from the stored fields, and a reading does not store them:

- **New here**: entities whose first mention is this sentence.
- **In play**: entities mentioned here that appeared earlier.
- **Carried in**: each anaphor or ellipsis whose antecedent is in an earlier sentence, followed by the sentence's `links`. An ellipsis of the topic is left out unless it has a `note`.
- **Within the sentence**: each anaphor whose antecedent is in the same sentence.
- **Carried forward**: every later sentence whose carried-in list points here.
