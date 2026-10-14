# Passage reading (`passage-reading/1`)

A **reading** is one JSON file: a model's sentence-by-sentence account of one
passage, written with whatever surrounding document it was given as context.
Two pieces hang off this format and know nothing of each other: a skill that
writes a reading, and a viewer that renders any reading. This folder holds the
format and the committed sample readings.
[`skill-prefs-description.json`](skill-prefs-description.json) is the first
instance, and the place to judge the format from.

**Probe status, stated 2026-10-14.** This folder, and the viewer page and
skill still to be built, are one probe. After the skill is tested on a passage
it has not seen, the probe either graduates (the format moves into the skill's
folder and the viewer leaves `pages/scratch/`) or all three are deleted
together.

## The file

| Field | Holds |
| --- | --- |
| `format` | `passage-reading/1` |
| `title` | A name for the reading |
| `made` | The date the reading was written |
| `source` | `path` and a `note` saying where the passage comes from |
| `gist` | One sentence on what the passage does, start to end |
| `context` | The documents supplied as context: `id`, `path`, `ref` (a commit), `why` |
| `entities` | Keyed by id: `label`, `gloss`, `basis`, and `ctx` when `basis` is `context` |
| `lead` | A run-in heading before the first sentence, if the passage has one |
| `sentences` | In order, numbered `n` from 1 |

An entity is a thing the passage names that a later sentence depends on, or a
term a reader may need explained. The passage's frame noun (here, *skill*) is
left out: highlighting it in every sentence marks nothing. `basis` says where
the gloss comes from: `passage`, `context` (with `ctx`, a list of `doc` and
`quote` pairs), or `general` (the model's own knowledge, which the reader
cannot check from the page).

## A sentence

`n`, `text` (exact, inline code in backticks), `role`, and three lists:

- **`mentions`**: each place the sentence refers to an entity. `e` is the
  entity id and `quote` is the span. `form` is omitted when the words name the
  entity, `anaphor` when they need an antecedent to be understood (a pronoun, a
  demonstrative, or a definite description such as *that one decision*), and
  `ellipsis` when the entity is not written at all and `quote` is the word that
  governs the gap (the description is the unstated object of *Write*). An
  anaphor or ellipsis resolves to the entity's first named mention; `ante: <n>`
  overrides that, and `note` records a resolution a reader could get wrong.
- **`links`**: connections to an earlier sentence that no mention carries.
  `to` is the earlier sentence, `kind` is below, `here` and `there` are the
  spans at each end, `gloss` says the connection in plain words, and
  `implied: true` marks one that no connective states.
- **`atoms`**: the separate claims the sentence makes, after
  [atomic-decomposition](../../skills/atomic-decomposition/SKILL.md): `id` (a
  letter), `role`, `claim` (stated plainly, its references resolved, standing
  alone), `quote`, and optionally `for` (the atom an evidence or example atom
  serves), `implied`, `note`.

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

Link `kind`, read as "this sentence *kind* sentence `to`", loosely after the
relations of Rhetorical Structure Theory:

| Kind | This sentence |
| --- | --- |
| `elaborates` | spells out what or how for the earlier one |
| `rests-on` | takes its reason from the earlier one |
| `narrows` | limits the earlier one or carves a case out of it |
| `contrasts` | sets itself against the earlier one |
| `supports` | offers evidence or an example for the earlier one |

## Anchoring

Every `quote`, `here` and `there` is an exact substring of its sentence's
`text` and occurs there once; where a phrase repeats, the quote is lengthened
until it is unique. A `ctx` quote is an exact substring of the context document
at its `ref`. Spans are found by text, never by character offset, because a
model counts characters badly and a quote can be checked by eye.

## Derived by the viewer, never stored

Each of these is a reading of the stored fields, so the file holds each fact
once and has no second copy to disagree with:

- **New here**: entities whose first mention is this sentence.
- **In play**: entities mentioned here that appeared earlier.
- **Carried in**: each anaphor or ellipsis whose antecedent is in an earlier
  sentence, followed by the sentence's `links`.
- **Carried forward**: every later sentence whose carried-in list points here.
