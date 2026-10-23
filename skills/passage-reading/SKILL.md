---
name: passage-reading
description: "Summoned when someone wants a dense passage read closely, a paragraph or a few, to see how its sentences connect: what each refers back to, introduces and claims. Not for summaries or a whole document's claims; use atomic-decomposition."
---

# Passage Reading

## Premise

A dense passage asks its reader to hold several things at once: what each sentence points back to, which terms it introduces, the separate statements packed into it, and which later sentences lean on it. A model can do that bookkeeping once, in a file, and the Passage reader page shows it one sentence at a time with the passage kept in view. The file is the product; the page is fixed. Family: text processing.

## Goal and output

One `passage-reading/1` JSON file per passage, to the contract in [`docs/envelopes/passage-reading.md`](https://github.com/mehrlander/web-tools/blob/main/docs/envelopes/passage-reading.md) (raw: `https://raw.githubusercontent.com/mehrlander/web-tools/main/docs/envelopes/passage-reading.md`), handed over as a link that opens it in the page. The contract is the authority on fields; this skill covers the judgments the fields leave open.

## Process

1. **Fix the passage and its context.** Copy the passage verbatim. List the context documents (the file the passage belongs to, files it names or leans on), each at a commit on the remote, since the page links to it. A document belongs in `context` when a gloss quotes it or the reading leans on it. A document you could not read is not context; a gloss resting on it second-hand says so. A pasted passage has no `repo`; its `source.path` says where it came from.
2. **Write the reading.** Read the contract, then the example. Write the file outside any repo unless the owner wants it kept.
3. **Check it.** Run
   `python3 -I "${CLAUDE_PLUGIN_ROOT}/passage-reading/scripts/check.py" READING.json --root CHECKOUT --link`
   where `CHECKOUT` holds the context documents (repeat `--root` for several). Where the plugin is absent, fetch the script from `https://raw.githubusercontent.com/mehrlander/web-tools/main/skills/passage-reading/scripts/check.py`. Fix every error and run it again. Then read the cards it prints as the reader will (see "The cards are the test").
4. **Hand it over.** With `--link`, the script's last line is a URL to the hosted page carrying the reading in its fragment; hand it over as `🔷 [<title>](<url>)`. No commit is needed and the fragment never reaches a server. For a reading the owner keeps, commit it where it belongs and link `https://mehrlander.github.io/web-tools/pages/toss-render.html#passage-reading=<owner>/<repo>@<ref>:<path>`. Where the context could not be checked (`--no-context`), say so.

## Key insights

- **Text is exact.** Sentence text is what a reader sees: Markdown emphasis dropped, inline code kept in its backticks, a hard-wrapped sentence joined with single spaces. A run-in heading is `lead`, not a sentence. Every span is found by text, so a quote that repeats in its sentence is lengthened until it is unique, or anchored with `in`.
- **Entities are what the passage leans on.** An entity is a thing a later sentence depends on, or a term a reader may need explained; most nouns are neither. The passage's subject is its `topic`. The background noun every sentence is about (in a passage on skill descriptions, *skill*) is not an entity. Choose each entity's `kind` by what its `gloss` describes, not by what it does in the passage: a general term takes the kind of the things it covers (*description* is a `record`, since each description is one), and an entity named for a role (*trigger*) takes the kind of whatever fills that role.
- **A gloss says where it comes from.** `basis` names the source of the gloss as written: `passage` when the passage's words supply it, `context` when it says what only a context document says (quoted, even where the passage also defines the term), `general` for the model's own knowledge or an inference no single quote supports. The reader cannot check a `general` gloss against anything on the page.
- **Mentions carry the reference work.** A naming mention has no `form`. `anaphor` marks words that need an antecedent: a pronoun, a demonstrative, a definite description such as *that one decision*. `ellipsis` marks a word with one of its grammatical slots empty, such as a verb with no object: quote that word, name the slot (*object of Write*) and give `fill`. Where a sentence is about an entity but no word in it has an empty slot (*Lead with what the skill does* is about the skill's description), there is no ellipsis; list the entity's id in the atoms' `on`. A `note` records a resolution a reader could get wrong. An anaphor whose entity the passage never names is shown only through that entity's gloss, so the gloss says what the words point to.
- **Links are what mentions miss.** A link records a connection to an earlier sentence that no mention makes, by one of five kinds read as "this sentence *kind* that one", with `implied` where no connective states it. The `gloss` says how the two connect; a claim that follows without being written is an implied atom, not part of the gloss.
- **Atoms are statements, typed by what they are.** One statement per atom, its references resolved, standing alone, typed `definition`, `assertion`, `judgment` or `rule`. Put the sentence's main statement first: the page labels the sentence with that atom's type. What an atom does for another (supports it, narrows it) is `for` and `as`, never a type. `on` lists the entities an atom is about, whether or not the sentence mentions them. An implied atom carries what the sentence commits to without writing it, with a `note` on why.
- **The cards are the test.** A clean check proves anchoring, not reading. Each card should tell a reader something the sentence alone does not: a reference resolved, a term glossed, a dependency named. A card that restates its sentence was read too lightly; a card listing every obvious tie was read too heavily.

## Bundled

- [`scripts/check.py`](scripts/check.py): run after every write. It checks what the JSON Schema cannot (every quote at its sentence, every context quote in its document at its commit, every link and atom target) and prints the cards the page will derive. Its docstring gives the flags.
- [`references/skill-prefs-description.json`](references/skill-prefs-description.json): a nine-sentence reading with two context documents. Read it before the first reading of a session; it is also what the page shows with no address.
