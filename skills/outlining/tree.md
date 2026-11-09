# Question tree and depth

A document answers one question, its root: what a reader needs to know about its
subject. Each passage answers a question asked in order to answer the one above
it. The depth of a claim is how many questions down from the root its question
sits.

Build the tree for one document and place each of its claims
([`claims.md`](claims.md)) on it.

## The tree

- Write the root question first, in the reader's words, from the document's
  title and opening.
- A child question is one a reader would ask, or would need answered, in order
  to get the parent's answer. Write each in plain words a reader would use.
- Follow the document's content, not its headings: a heading may hold
  questions at several depths, and two headings may answer one question.
- Make a question only where at least one claim answers it.
- Build as deep as the content goes. A reader against a time limit tends to
  stop at depth 2, which flattens the measure.

## Placing claims

Each claim goes on the one question it most directly answers. Where a claim
answers no question a reader of this document would ask, or answers two equally,
say so in the note.

## Explanation cost

For each question, list what a newcomer to the document must already hold to
understand the question itself (not its answer): the terms, things and earlier
answers it presupposes. Count only what the document has not introduced by the
point where the question is first answered, and what it introduced, counting
each separately.

## Reading depth

Two readers of one document place a claim within one level of each other
almost always, but they build different numbers of intermediate questions.
Compare depths only within one reader's tree. The evidence is in home's
[detail model](https://github.com/mehrlander/home/blob/main/projects/text/detail-model.md).

## Output

Two CSVs at the paths you are given.

`questions`: `q,parent,depth,question,presupposes_new,presupposes_known,note`
- `q` an id (`Q0`, `Q1`, …), `parent` its parent's id (empty for the root),
  `depth` 0 for the root.
- `presupposes_new` and `presupposes_known`: the items, separated by `; `.

`placement`: `n,q,fit,note`
- `n` the claim number, `q` the question it answers, `fit` empty, or `none`
  (answers no reader's question), or `two` (answers two equally; name the
  second in the note).

Quote every field.
