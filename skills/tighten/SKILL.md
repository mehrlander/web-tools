---
name: tighten
description: "Rewrite a span of text, or a set of authored values such as a spreadsheet column of descriptions, so it says the same thing in fewer words. Use when the user hands over writing and asks to tighten, compress, shorten or cut the filler from it, and when a column of descriptions, summaries or labels was authored a row at a time and now reads as inconsistent down the column. Content is fixed here and only the wording moves, which is what separates it from succinct-text, where what the document contains and how it is organized are both in scope."
---

# Tighten

## Premise

Two asks converge on one operation.

A single span runs longer than its job. A field description, a tooltip, a card
summary, a line in a doc: the content is settled and the phrasing is loose.

A set of authored values was written a row at a time. Each value is defensible
alone and the set is not: three terms for one thing, four grammatical
constructions, lengths from four words to thirty. A column is read down its left
edge, so that variation reads as meaning the data does not carry.

Neither ask wants the document restructured. Content is fixed, so the pass stays
narrow: only wording moves, and a rewrite that says something different is wrong
rather than terse. That narrowness is what makes the result checkable.

The compression discipline is adapted from `caveman`
(github.com/JuliusBrussee/caveman, MIT), whose payload is two separable things:
a discipline about which words carry nothing, and a broken-grammar register.
The discipline transfers. The register does not, since these values land in
committed data and are read by someone next week.

Family: writing support, and text processing where the input is a set, since
there the decisions are an artifact the rewrite is written against.

## Goal and output

**One span.** The rewrite. Where a phrase resisted cutting because removing it
put meaning at risk, name it in one line underneath.

**A set.** Two artifacts, in this order.

1. *Decisions*, settled before any row is rewritten: the term fixed for each
   recurring thing, the construction every row takes, any word the whole set
   shares that is therefore dropped, and the word band.
2. *The table*: one row per input row, in input order, carrying the input key,
   the original, and the rewrite. Key on the input's own identifier where it has
   one, on line position where it does not. A row already at its floor comes back
   unchanged and marked `unchanged`, rather than churned to look like work. A row
   whose rewrite gave something up is marked, not quietly shipped.

Never return a set smaller than the one that arrived.

## Process

One span is a single pass. The moves below shape it. They are not stages and
leave nothing to inspect between them.

A set is two passes, and the first produces the artifact the second is written
against: settle the decisions, show them, then rewrite each row against them.
Deciding per row is what produced the column that needed this skill, and on a
long column the decisions are also the cheap place to be corrected, before two
hundred rows are written the wrong way.

## Key insights

- **Content is fixed; wording moves.** Nothing is extracted, merged, reordered,
  or delegated to another document. Where the span makes three claims the
  rewrite makes the same three. Where the live question is whether a claim
  belongs at all, or where it should live, that is `succinct-text`.

- **Never add a word to sound terse.** Compression only shortens. No faked
  broken grammar, no dropped copula that costs a word back elsewhere, and no
  invented abbreviation (`cfg`, `impl`, `req`): the reader pays in decoding what
  the line saved in characters, and in a committed column the next person greps
  for `config`. Where the terse phrasing is not shorter than the plain one, keep
  the plain one.

- **One class of word is not filler, and the pass is mechanical about it.**
  `not`, `never`, `no`, `only`, `except`, `unless`: dropping one inverts the
  value. Numbers, units, dates, identifiers, file paths, API and column names,
  code spans, and quoted error text survive verbatim. Proper nouns keep their
  spelling.

- **A set is one object, not many spans.** Four obligations hold across rows,
  and none of them exists for a single span.
  - *One term per thing.* A term that varies down a column reads as a
    distinction the data does not have.
  - *One construction.* Where most rows are noun phrases, every row is a noun
    phrase. The eye compares row openings, so a row that starts differently
    reads as a different kind of thing.
  - *Drop what every row shares.* Forty rows opening with "Handles" carry that
    word forty times and say it once. This applies only where a header or the
    surrounding context still supplies it.
  - *One length band.* Set the band from what the richest row needs, not from
    the shortest. A column running four to thirty words reads as unfinished.

- **Alignment is the contract.** One row out per row in, in input order, keyed.
  Never merge two rows that say similar things, never drop a blank one, never
  sort. The table is joined back to its source, so 38 rows returned against 40
  is unusable whatever the prose quality.

- **Stop where compression buys ambiguity.** Where dropping an article or a
  conjunction leaves a scope or an order unclear, keep it. A warning, a
  destructive action, and a sequence whose steps depend on order stay plain.
  Brevity is the means. A value that reads fast and is wrong costs more than the
  words it saved.

## The dial

Two levels, and the value's job picks one.

| Level | What changes | For |
| --- | --- | --- |
| `trim` | Filler, hedging, throat-clearing and connective padding go. Sentences stay whole, articles stay. | Prose read in sentences: a paragraph, a doc line, a description read aloud. |
| `clip` | Articles, copulas and leading pronouns go where a fragment carries the job. | Labels, column values, table cells, tooltips: read at a glance. |

Do not add a third. Where `clip` is not short enough, the content is too big for
the field, which is a different problem.

## Worked examples

**One span, `trim`.**

> It's worth noting that the pre-commit hook will generally attempt to
> regenerate the board, but only if a task file has actually been staged.

> The pre-commit hook regenerates the board only when a task file is staged.

`only` survives. Dropping it turns a necessary condition into a sufficient one,
which is the inversion the third insight above exists to prevent.

**A set, `clip`.** A column of field descriptions, authored a row at a time:

| key | description |
| --- | --- |
| `fund_600` | This column holds the fund number for the account. |
| `ea_code` | The EA code that is associated with the transaction, if there is one. |
| `amount` | Dollar amount. |
| `posted_at` | This is the date on which the entry was posted to AFRS. |

Decisions: every row describes a column, and the header says so, so "this
column holds" goes; construction is a noun phrase; band is three to eight words.

| key | rewrite | note |
| --- | --- | --- |
| `fund_600` | Fund number for the account. | |
| `ea_code` | EA code for the transaction, where one exists. | |
| `amount` | Dollar amount. | `unchanged` |
| `posted_at` | Date the entry posted to AFRS. | |

`ea_code` keeps its final clause: dropping it would assert the code is always
present. `amount` was already at its floor and comes back untouched.

## Boundaries

- Not `succinct-text`, which settles audience, theme and altitude, moves
  material out to its own linked pieces, and proves losslessness with a
  crosswalk. Reach for that one when what the document contains is in question.
  Reach here when only the phrasing is.
- Not `state-the-rule`, which separates binding declarations from explanation in
  a document an agent loads and executes.
- Not for a record. In a dated entry, a quoted source, or a chat log, the
  wording is the evidence.
- Rewriting a column another person authored changes what they said. The table
  shows both sides so they can approve it.

## Extending

The alignment contract is mechanically checkable and nothing checks it. A script
over the two sides could hold row count, key match, input order, and the
survival of every preserved token class (numbers, units, identifiers, polarity
words). That is the next thing this skill should carry, per this repo's rule
that a correction landing twice becomes a check.
