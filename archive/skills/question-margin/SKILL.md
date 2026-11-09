---
name: question-margin
description: Read a transcript, a reply, or a document as the questions it answers, and emit them as a margin beside the text or as a standalone list with each answer. Use when the user wants to know what a conversation settled and what it left open, asks for a question index or a Q&A view of something already written, wants to find what was raised and never resolved, or says "question margin", "what did we settle", "what is still open in this". Also for auditing a document, since a section that yields no distinct question is carrying no criterion. Concerns the questions a text answers, asked or not, never the questions it should have asked.
---

# Question Margin

## Objective

Re-express a piece of writing as the questions it answers, one per unit, each with its answer. The output runs beside the text as a margin, or replaces it as a list. You are not summarizing. A summary compresses by dropping; this keeps every unit and changes its form, so nothing is lost and the index is complete, and a missing question becomes visible where a gap in answer form would not.

The measurements behind the rules below are recorded in [`chron/2026/08/2026-08-28-discussion-as-questions.md`](https://github.com/mehrlander/home/blob/main/chron/2026/08/2026-08-28-discussion-as-questions.md) in `mehrlander/home`.

## Pick the grain first, and it decides the object

This is the one choice that cannot be deferred, because the two grains attach to different things.

| grain | unit | object | count |
| --- | --- | --- | --- |
| paragraph | one paragraph | **one reply or one document section** | ~9 prose paragraphs a reply |
| exchange | one user ask and its answer | **one session** | ~10 exchanges a session |

A session at paragraph grain runs to about 200 rows, a corpus rather than a view. So paragraph grain annotates a reply and never a whole session; exchange grain indexes a session and is too coarse for one reply. Do not mix them in one artifact.

**Where the source has no paragraph breaks, the paragraph is not the unit.** Dictated prose arrives as one block and carries its boundaries in discourse markers instead of whitespace: *"And then in addition to that"*, *"So it's possible that"*, *"Maybe the natural thought is"*, *"Anyway"*. Segment on the shift of subject and take those phrases as the cue. Never report a wall of dictation as a single question.

Non-prose blocks get no question of their own, and **which way they attach depends on what they are**. A list, table or code fence attaches **upward**, to the paragraph that introduced it. A heading, and any bare transition sentence under it (*"The landing turned up things my checks could not see:"*), attaches **downward**, to the section it opens. Attached upward, a heading lands on the block above and orphans the section it was announcing.

## The question is what the unit answers, asked or not

Most units answer a question nobody posed. A prompt carrying no question (*"Done."*) is not a low-content exchange; it is often the highest-content one, because it is where the work was handed over.

So every row carries a provenance mark, and the mark is epistemic rather than decorative:

- **`?`** a question somebody actually asked. Derived from their words.
- **`·`** a question the content answers without posing. Written by you, after the fact.

A `·` row is a model artifact with a model's failure modes: it can fluently name a question the passage does not actually answer. Never merge the two marks into one column; this is the distinction the `content-registry` skill's `creation_mode` keeps, and a table that blurs it claims provenance it does not have.

## Writing the answer

**Every answer stands alone without its question.** The failure to avoid: a bad answer inherits its subject from the question and keeps only the modifier.

| written | fails because |
| --- | --- |
| `both, in that order` | no subject, no verb, no fact |
| `chain, README row, both mirrors, PR closed` | four nouns, nothing said about them |
| `five fixes, 221 tests` | a count of facts where the facts are the answer |

Three rules fix all three:

1. **Lead with the direct answer** where the question is yes-or-no. Yes. No.
2. **Name the subject** rather than borrowing it from the question.
3. **Carry the fact, not a label for the fact.**

So `No. An orphaned artifact keeps serving a withdrawn link, and I did not fix it.` rather than `no, and I left it unfixed`.

Length is not the constraint: "Merged into shortcut-tools main" is four words and complete; "both, in that order" is four words and useless. A short answer is right where the fact is short, and nowhere else.

## Mood sorts the kinds apart

Three moods, and they separate themselves without help:

| mood | shape | what a turn full of them is |
| --- | --- | --- |
| **report** | *did this happen*, *what went in* | a wrap-up |
| **finding** | *does this work*, *is this true* | a self-audit |
| **proposal** | *can we*, *should we* | a design conversation |

On the page a finding buried among status reports has the same shape as they do; in the margin, the one question in a different mood stands out with no colour, status field or convention doing the work.

Do not add a status column to encode this. The grammar already carries it, and a column would invite you to write the mood rather than let it fall out.

**State the mix alongside the table** (six reports to one finding, say), since it says what kind of turn you are reading before you read it.

## The open-loop filter (exchange grain only)

At exchange grain a question can outlive the turn that raised it. Count how many later user messages it survived, and that number is both the severity signal and the filter:

> **An open loop is a question that was explicitly asked and did not settle inside the turn that raised it.**

The rows it drops are the ones asked and answered in one breath, the population a list was never needed for. Show the count as `×N` and let a zero render as nothing.

The full list and the filtered one are **one structure with two masks**, never two artifacts. Deriving the second from the first is what keeps them from drifting.

**Withdrawn is not settled, and the filter cannot see the difference.** A question can be raised and parked in the same breath: *"I kinda want it to be a little bit like Wikipedia where you can go in and edit the section. But maybe that's not really feasible there for now."* That closes inside its turn, so the open-loop filter drops it, but it closed by abandonment rather than by an answer. Mark it `~` and give it the asker's own reason as its answer. It is usually the one item in a turn that nobody will come back to, which is why it is worth a row.

Two independent passes are expected to agree on the contents at the high-severity end and not on the count; no second pass has been run to test it. Present the list as approximately right: no total, no "N of M resolved."

## Output

Default to a markdown table in chat, since the point is to be cheap enough to actually run:

```
| ? | question | answer |
| --- | --- | --- |
| ? | Does `--publish` remove a mirror whose chain is gone? | No. An orphaned artifact keeps serving a withdrawn link, and I did not fix it. |
| · | Does script run inside the sheet? | Yes. The sheet is a full browsing context, not a viewer. |
```

Three densities are available and worth naming when handing one over: **prose** leaves the text untouched with the index beside it, **answers** keeps the shape and drops the argument, **questions** is what the text was for. Answers is the useful default.

A rendered page is worth it only when the margin has to sit beside the prose to make its point. Prototypes: `dump/2026-08-28-question-margin.html` (paragraph grain) and `dump/2026-08-28-question-lane.html` (exchange grain) in `mehrlander/web-tools`, each with its build script beside it.

The mood sort rests on one reply, the open-loop filter on one session and the document audit below on one section, all read after the fact and none across authors. Granularity also tracks the writer's formatting: an enumerated ask splits the same way every time, a paragraph carrying three concerns does not, and no rule covers that case. Say so when a result you hand over leans on any of these.

## Auditing a document

Run at paragraph grain over a document and **a section that yields no distinct question is carrying no criterion.** A definition list is already in answer form and yields one question repeated once per item; the prose that states its boundaries yields the distinct questions. Report the sections that produced nothing rather than padding them with a question you had to invent.

## Relation to atomic-decomposition

[`atomic-decomposition`](../atomic-decomposition/SKILL.md) breaks a document into the claims it makes, paragraph-anchored, tagged by commitment type. This is the same operation on the same text with the polarity flipped: **a claim is what a paragraph asserts, a question is what it answers.**

Pick by what the reader is meant to do. Inventory what a document commits to, including what it presupposes, and the answer is claims. Find what a discussion settled and what it left open, and the answer is questions. Running both over one text is legitimate and produces two lists that do not fold together.
