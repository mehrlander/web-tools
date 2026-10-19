# Passage reading: the envelope contract

A **reading** is one JSON file, format `passage-reading/1`: a model's sentence-by-sentence account of one passage, written with whatever surrounding documents it was given as context. The [`passage-reading` skill](../../skills/passage-reading/SKILL.md) writes readings, and ⭐ [pages/passage-reader.html](https://mehrlander.github.io/web-tools/pages/passage-reader.html) renders any reading: the passage stays in view while a strip of cards, one per sentence, shows what each sentence refers back to, what it introduces, the separate claims it makes, and which later sentences depend on it. The skill and the page depend on each other only through this file. [`schemas/passage-reading-v1.schema.json`](schemas/passage-reading-v1.schema.json) validates its shape; the skill's [`scripts/check.py`](../../skills/passage-reading/scripts/check.py) checks what a schema cannot, that every quote is where the reading says it is. The skill's worked example is [`references/skill-prefs-description.json`](../../skills/passage-reading/references/skill-prefs-description.json).

## Delivery

First match wins:

| channel | form | use when |
| --- | --- | --- |
| `#gz=<base64url>` | the gzipped reading in the URL fragment | the default: a reading needs no commit, and the fragment never reaches a server |
| `#passage-reading=<spec>` | the toss route: `…/toss-render.html#passage-reading=<owner>/<repo>[@<ref>]:<path>` | the shortest link to a committed reading; resolves into this page's `?src=` |
| `?src=<spec>` | fetched via the contents API, `owner/repo[@ref]:path` | reaching the page directly |
| (none) | the skill's worked example | a look at the page |

Each key is read fragment first, query as fallback ([`lib/kits/url-params.js`](../../lib/kits/url-params.js)). A private reading needs the viewer's stored GitHub token, as every `?src=` read does; a `#gz=` link needs none. The page keeps the current sentence in the fragment as `s=<n>`, so `…passage-reader.html#gz=…&s=5` opens at sentence 5.

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
| `entities` | Keyed by id: `label`, `gloss`, `basis`, `ctx` when `basis` is `context`, and optionally `kind` |
| `lead` | A run-in heading before the first sentence, if the passage has one |
| `sentences` | In order, numbered `n` from 1 |

An entity is a thing the passage names that a later sentence depends on, or a term a reader may need explained. The `topic` is the entity the passage is about (in the example, *description*). A background noun that nearly every sentence assumes (there, *skill*) is not an entity at all. `basis` says where the gloss as written comes from: `passage` when the passage's own words supply it; `context` when it says what only a context document says, quoted in `ctx`, a list of `doc` and `quote` pairs, even where the passage also defines the term; `general` when it rests on the model's own knowledge or on an inference no single quote supports, which the reader cannot check against the page.

## A sentence

`n`, `text`, and three lists. `text` is the sentence as a reader sees it: Markdown emphasis and link syntax dropped, inline code kept in its backticks, and a hard-wrapped sentence joined with single spaces.

- **`mentions`**: each place the sentence refers to an entity. `e` is the entity id and `quote` is the span. `form` is omitted when the words name the entity. It is `anaphor` when the words need an antecedent to be understood: a pronoun, a demonstrative, or a definite description such as *that one decision*. It is `ellipsis` when a word leaves a slot of its own empty: `quote` is that word, `slot` names the slot (*object of Write*), and `fill` holds the missing words. Where `quote` occurs more than once in the sentence, `in` gives a longer span that contains it once (each *its* in *its own prompts* and *its own output*). An anaphor or ellipsis resolves to the entity's first named mention; `ante: <n>` overrides that, and `note` records a resolution a reader could get wrong. Where the passage never names the entity (a *this* that points at the document the passage opens), the mention is not a connection: the page shows the entity in its lists with its gloss, so the gloss carries what the words point to.
- **`links`**: connections to an earlier sentence that no mention makes. `to` is the earlier sentence, `kind` is below, `here` and `there` are the spans at each end, `gloss` states how the two sentences connect, and `implied: true` marks a connection that no connective states. A claim that follows from the connection without being written goes in an implied atom, not in the gloss.
- **`atoms`**: the separate claims the sentence makes, after [atomic-decomposition](../../skills/atomic-decomposition/SKILL.md): `id` (a letter), `type`, `claim` (stated plainly, its references resolved, standing alone), `quote`, and optionally `on` (the entities the claim is about, named in the sentence or not), `for` and `as` (the atom of the same sentence this one serves, and how, from the link vocabulary below: an example `supports` the rule it illustrates), `implied`, `note`.

## Vocabularies

`type`, one for every atom, saying what kind of statement it is:

| Type | The atom |
| --- | --- |
| `definition` | says what a term means or what a thing is |
| `assertion` | says that something is so: a fact, a cause, or an assumption the text relies on |
| `judgment` | evaluates something: good or bad, a model or a warning |
| `rule` | directs the reader to do or avoid something |

What a statement does for another statement (rests on it, supports it, narrows it) is a relation, not a type: `for` and `as` between the atoms of one sentence, `links` between sentences.

Link `kind`, read as "this sentence *kind* sentence `to`", loosely after the relations of Rhetorical Structure Theory; an atom's `as` takes the same values and reads the same way, with `for` in place of `to`:

| Kind | This sentence or atom |
| --- | --- |
| `elaborates` | spells out what or how for the earlier one |
| `rests-on` | takes its reason from the earlier one |
| `narrows` | limits the earlier one or carves a case out of it |
| `contrasts` | sets itself against the earlier one |
| `supports` | offers evidence or an example for the earlier one |

Entity `kind`, optional, saying what sort of thing the entity is:

| Kind | The entity |
| --- | --- |
| `thing` | a physical object, or a running system that does not decide: a chair, a server |
| `record` | a document or part of one: a file, a field, a message, a listing |
| `actor` | a person, group or system that decides: a reader, an agency, a model |
| `event` | something that happens or is done |
| `measure` | an amount, a count or a limit, including a limit stated as a rule |
| `condition` | a circumstance something can be in |
| `concept` | an idea or principle that fits no row above |

## Anchoring

Every `quote`, `here` and `there` is an exact substring of its sentence's `text` and occurs there once; where a phrase repeats, lengthen the quote until it is unique. A `ctx` quote is an exact substring of the context document at its `ref`, compared with runs of whitespace collapsed, so a quote may cross a hard line break. A `ref` is a commit on the remote, since the page links to it. Spans are found by text, not by character offset.

## What the page derives

The page computes these from the stored fields, and a reading does not store them:

- **A sentence's kind**: the type of its first atom.
- **New here**: entities whose first mention is this sentence.
- **In play**: entities the sentence mentions, the topic aside, and entities its atoms list in `on`; one first mentioned here is New here instead.
- **Carried in**: each anaphor or ellipsis whose antecedent is in an earlier sentence, followed by the sentence's `links`. An ellipsis of the topic is left out unless it has a `note`.
- **Within**: each anaphor whose antecedent is in the same sentence.
- **Carried forward**: every later sentence whose carried-in list points here.
