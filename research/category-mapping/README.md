# Category mapping: which word fits

Two questions the estate keeps asking, each answered as a poster: what kind of
collection a set of entries is (registry, stream, cache, tracker, inbox, list),
and what kind of thing a piece of work is by when it acts (scheduled, standing,
one-off, ad hoc). The answers are [`collections.json`](collections.json) and
[`timing.json`](timing.json), drawn by
[`pages/cat-map.html`](../../pages/cat-map.html)
([collections](https://mehrlander.github.io/web-tools/pages/cat-map.html),
[timing](https://mehrlander.github.io/web-tools/pages/cat-map.html#src=../research/category-mapping/timing.json)).
Gathered 2026-10-22 to 2026-10-25 in session
[5ff9f92b](https://mehrlander.github.io/web-tools/pages/session.html#id=5ff9f92b).

This account was cut on 2026-10-25 from a 634-line version that also carried a
survey of classification methods, a proposed `cat-map` skill with two scripts,
and the hand-coded maps behind both posters. That version is kept at commit
[`07357db1`](https://github.com/mehrlander/web-tools/blob/07357db10b676337a40298a0f927116317a41634/research/category-mapping/README.md).
A seven-seat review found the method and the skill over-built for what they
returned; "What did not hold up" below says why.

## Where the question came from

In session
[007acb88](https://mehrlander.github.io/web-tools/pages/session.html#id=007acb88)
the question was what kind of collection a manager persona's dated entries
belong in: a list, a log, a stream or a tracker. The step that helped was a
table whose rows were characteristics (what one entry stands for, whether it
changes after it is written, whether entries leave), each with its values and
an estate example for each value. "Transient" turned out to be one value range,
whether entries leave. The posters make that step a picture.

## The two answers

**Collections.** Two questions place a collection: does each entry stand for a
thing or an event, and does an entry change after it is written. A registry is
a thing kept current; a stream is an event never edited, also called a log or a
ledger. The other two boxes have no word yet: an event's record rewritten
until the event ends (`sessions/`, `window.__traffic`), and a thing's record
never edited (`errands/`, `proposals/`). Cache, tracker, inbox and list add to
whichever box applies. Where the coding disagreed with
[`docs/registries.md`](../../docs/registries.md#registries-and-streams), the
poster follows the document: a snapshot is one stream entry, not a box of its
own. Collections of material, such as `lists/jot.json` and `chron/dump/`, fit
neither column, and the poster puts them in a call rather than claiming them.

**Timing.** Two questions place a piece of work: does the clock set it off,
and does it act once, again as written down, or again decided each time.
One-off, scheduled, standing and ad hoc fill four of the six boxes; a timer set
to go off once has no word (the poster recommends reminder); a clock that
decides anew each time is impossible. On request, gated, polled and routine add
to it. One reader coded this one, and no second reader has checked it.

## Back to the persona's entries

Placed on the collections poster, a persona's dated record of what it noticed
is an event never edited, so it is a stream, and the estate already keeps one
for this purpose: the notes store, whose entries are signed, dated
observations that are never edited. If the entries were instead concerns the
persona returns to and closes, each would be a thing that changes and carries a
status: a tracker. The poster turns the original question into those two
questions about the entries. This placement is the session's own, not a blind
test.

## What the tests showed, and what they did not

- **The registry test** (one reader, 15 instances) found that the
  registry-and-stream table bundled two characteristics: on its first twelve
  instances, "what an entry stands for" and "whether it changes" divided them
  identically. A tending finding and a session record pulled the two apart.
- **The blind test** (four readers, the nine collection words, 30 to 35
  collections each) produced the same two questions and the same four add-on
  words from every reader. Home's
  [2026-10-12 survey of the estate's stores](https://github.com/mehrlander/home/blob/main/chron/2026/10/2026-10-12-surveying-the-estates-stores.md)
  already had the thing-or-event split, snapshot as a third shape, provenance
  crossing shape, the capped window and session records rewritten while
  live, and nothing kept the readers from it, so the agreement is partly that
  survey read four times.
- **The poster test** gave three readers only the poster image and eight
  collections it does not show. They chose the same box as one another for all
  seven scored collections, and matched the key's box on 5 of 7 each. The
  key came from the poster's own rules applied to one reader's coding, two of
  its entries were corrected after the readers traced their departures to it,
  and no control group worked without the poster.

**What did not hold up.** The reader given no method reached the same two
questions and the same main findings as the three following it; the method's
measurable addition was two characteristics. The coded format grew to answer
each of twelve places a reader had to guess, and the larger map file reached
6,331 lines, most of it feeding views no poster draws. The recurring need
turned out to be placing a new thing against a settled vocabulary, not mapping
a new family of words, so no skill was published.

## Misnamed things

What each thing is called, against what the hand coding found it to be.

| Thing | Called | What it is | On the poster |
| --- | --- | --- | --- |
| `sessions/` | stream | a record rewritten until the session ends | renamed |
| `window.__traffic` | ledger | each request added with status 0, filled in when it settles | renamed |
| `state/constellation-atlas.json`, the occurrence index | snapshot | rebuilt in place from other files, may lag them | renamed to cache |
| web-tools-private | registry | a repository holding several collections | renamed |
| home's `chron/` log | log | material, edited in place | call 1 |
| the decision ledger | ledger | events whose entries change, derived and held by a check | not placed: the poster readers called it a stream and a cache |
| `tracker/board.csv` | tracker | the generated rollup of the task files | not placed: the task files are the tracker |
| news-fetch | scheduled | runs at session start once two days have passed | renamed to standing |
| config crawl | periodic | runs when a view that reads it opens | renamed to standing |
| `scheduled-tasks.yml` | triggered | an hourly cron | renamed to scheduled |
| morning brief | routine | a Claude scheduled task on a cron | renamed to scheduled |
| PR check-in | scheduled | set once, by the clock | renamed, word open (call 2) |
| spike-report prompt | ad hoc | the same written steps, used on request | renamed to on request |

## Findings for the estate

None of these is acted on here; each is a separate decision.

1. [`docs/direct-to-main.csv`](../../docs/direct-to-main.csv) has no row in
   [`docs/registries.csv`](../../docs/registries.csv), though the rule in
   `CLAUDE.md` gives every committed CSV that inventories part of the tree one.
2. The first sentence of [`docs/registries.md`](../../docs/registries.md)
   describes a registry's entries as "found by a stable key", which every
   collection's entries are, streams included. What separates a registry entry
   from a stream entry is what the key identifies.
3. web-tools-private is called a registry, the repository the app's
   `REGISTRY_REPO` points at, though it holds several collections and is not
   one.
4. The collections grid could move into "Registries and streams" in
   `docs/registries.md`, the document that owns the vocabulary, with the
   poster rendering it from there, once the calls on the poster are settled.

## Sources

The methods surveyed in the earlier version, read in their primary texts where reachable (the ISO standards in their preview samples):

- Ranganathan, S. R. *Prolegomena to Library Classification*, 1937: the canons for a characteristic, differentiation first.
- Barton, Allen H. "The concept of property-space in social research", 1955; Bailey, Kenneth D. *Typologies and Taxonomies*, 1994: crossing characteristics into cells, and dropping the empty ones.
- Collier, David, Jody LaPorte and Jason Seawright. "Putting typologies to work", 2012: name a cell only after its values are fixed.
- Ganter, Bernhard, and Rudolf Wille. *Formal Concept Analysis*, 1999; Pawlak, Zdzisław. "Rough sets", 1982: mechanical tests for a characteristic that separates nothing.
- Spradley, James P. *The Ethnographic Interview*, 1979: the paradigm worksheet, the closest published method to the 007acb88 table.
- ISO 704:2022 and ISO 1087:2019: from characteristics to concepts, with the name assigned last.
- Rosch, Eleanor. "Principles of categorization", 1978: a borderline member is expected, not a defect.
