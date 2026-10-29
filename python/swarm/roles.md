# Reduction swarm: the roles

Each round, readers add entries to a shared ledger about one source passage,
then a harvester assembles the best reduction the ledger supports. `swarm.py
context` hands each agent the section for its role below the common brief.

## common

The goal is the same passage for the same reader in fewer words. The source is
fixed and split into units `S1`, `S2`, and so on; you never edit it, you add to
the ledger. Numbers, names, commands, flags, environment variables, file paths
and quoted errors survive verbatim. A point may be carried implicitly where the
reader would still act the same way. Be bold: propose the cut or restructure a
cautious editor would not, and let the votes and the harvest sort it out.

Write JSON Lines, one object per line, to the output path named below. The
kinds:

- `{"tag":"core","anchors":["S3"],"text":"..."}`: a payload item, something
  the reader must still know or do after the reduction, in 15 words or fewer.
- `{"tag":"tactic","anchors":["S2","S3"],"text":"..."}`: a structural move and
  its expected saving in words.
- `{"tag":"draft","anchors":["S2","S3"],"text":"...","builds_on":["1.t2"]}`:
  replacement wording for those units, read in place of them.
- `{"tag":"word","anchors":["S5"],"from":"exact phrase","text":"shorter phrase"}`:
  a phrase swap; `from` must appear verbatim in the anchored unit, and `text`
  may be empty for a cut.
- `{"vote":"1.d2","v":1}` or `{"vote":"1.d2","v":-1,"why":"..."}`: a vote on
  an existing entry; a `-1` names what a reader would lose or do wrongly.

`anchors` lists unit ids in source order, or `["ALL"]` for the whole passage.
`builds_on` is optional and lists the ids of ledger entries, shown below, that
an entry extends; your own entries get ids when the round is merged. Ids are for
`builds_on` and votes only: in any `text`, `why` or `note`, name an entry's
content by quoting a few of its words, since a reader of the result sees the
words and never the ids. Write only
the kinds your role names. Before returning, run the check command named below
and fix every line it reports.

## distiller

Write `core` entries: the smallest set of payload items that loses nothing a
reader acts on. One item per fact or instruction; none for framing,
transitions, emphasis or restatement. Anchor each to every unit that carries
it, so a unit with no core anchor reads as removable.

## tactician

Write at least five `tactic` entries, each anchored to the units it touches:
merge units, reorder, cut a unit whole, turn prose into a list, fold a clause
into a qualifier, move a point to where it is used. A tactic may be
conditional ("if S6 moves under S2, S7 can go"). Include at least one move
anchored `["ALL"]` that changes the shape of the whole passage.

## drafter

Write `draft` entries for runs of consecutive units, and `word` entries for
phrase swaps. Cover every unit at least once, with a draft or with a tactic's
cut. Where two drafts compete for the same units, write both.

## challenger

Write one `draft` anchored `["ALL"]`: the whole passage, in fewer words than
the current best, carrying every live core item. Build on the ledger's
strongest entries and list them in `builds_on`. Then add up to three `tactic`
entries naming what you tried and abandoned, so the next round need not repeat
it.

## builder

Turn open tactics into drafts, and combine drafts for adjacent units into one.
Vote `+1` on the entries the next harvest should use and `-1` on any entry,
including the current best's choices, that drops something a reader needs.
Challenge the payload too: `-1` a core item a reader would not miss, saying
why. Cast at least eight votes.

## harvester

Assemble the shortest reduction the ledger supports that carries every live
core item (one whose votes do not net below zero). Use top-voted entries, a
challenger's whole draft, or a splice of both, and smooth the seams. Write one
JSON object to the output path:

```json
{"text": "the reduced passage, in Markdown",
 "map": [{"quote": "an exact substring of text", "from": ["S1", "S2"], "uses": ["1.d1"]}],
 "core": [{"id": "1.c1", "quote": "exact substring of text"}, {"id": "1.c4", "lost": "why"}],
 "note": "one line: what changed from the current best"}
```

`map` covers the whole of `text` in order, one quote per sentence or list
item, each naming the source units it carries. A unit no quote names counts as
dropped. `core` lists every live core item once, by a quote that carries it or
the reason it was given up.

## ladder

This is an edit ladder: single edits to one passage, each judged on its own,
then ordered from safest to boldest so a reader can step from the original to
the shortest version and see where the risk begins. The passage is split into
paragraphs `P1`, `P2`, and so on; you never edit it, you write edits or rate
them. An edit replaces one exact run of words inside one paragraph with a
shorter run, or with nothing. Identifiers, file paths, commands, flags, numbers
and the words `not`, `never`, `no`, `only`, `except` and `unless` survive
verbatim: dropping one of those changes what the text says.

The three tiers:

- **green**: a reader loses nothing and would do nothing differently. Filler,
  hedges, restatement, throat-clearing, a pair of words where one serves.
- **yellow**: a reader still acts the same, but feels the pinch: a nuance, a
  reason, an example, the flow between sentences, or the voice is thinner.
- **red**: full caveman. Every fact a reader acts on is still there, in clipped
  fragments with articles, copulas and connectives gone, or with reasons cut
  to the bone; or the edit risks a reader acting differently.

A proposer writes JSON Lines to the output path, one edit per line:
`{"block":"P3","find":"exact words from P3","replace":"shorter words","why":"..."}`.
`replace` may be empty for a cut. Each edit stands alone against the original
paragraph, not against the proposer's other edits, so two may overlap. Before
returning, run the check command and fix every line it reports.

## trimmer

Write 6 to 12 green edits across the paragraphs; prefer the smallest edit
that does one thing.

## pincher

Write 6 to 15 yellow edits: the ones a careful editor would argue over.
Tighten a sentence at the cost of a nuance, cut an example or a reason, merge
two sentences. Where two ideas can become one phrase, write that edit
and say so in `why`.

## caveman

Write 6 to 20 red edits: full caveman. Rewrite whole sentences to
clipped fragments, cut every reason a reader could live without, merge
sentences hard. Keep every fact a reader acts on and every protected word
named above.

## judge

Rate every edit listed below, once each, as JSON Lines to the output path:
`{"edit":"e7","risk":"green","confidence":90,"brilliancy":"","brutality":"","note":""}`.

- `risk`: the tier the edit belongs in by the definitions above, whatever its
  proposer aimed at.
- `confidence`: 0 to 100, how sure you are that a reader of the edited
  paragraph acts as a reader of the original would. Under 30 means the edit
  loses or changes what the paragraph says.
- `brilliancy`: one line saying why, only for an edit that says the same thing
  in fewer words by joining two ideas or finding the phrase that carries what
  took a clause. Leave it empty for most edits.
- `brutality`: one line saying why, only for a cut that looks drastic and that
  the paragraph, on reflection, does not need. Leave it empty for most edits.
- `note`: optional, one line, for anything the reader of the path should know.

Judge each edit against the original paragraph. Before returning, run the
check command and fix every line it reports.
