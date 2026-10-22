# Forms

A **form** is the standard way one thing of a kind is shown, so that a reader
knows the kind before reading the content. Forms come in two families, told
apart by what brings the reader to them.

- **Standing forms** show an object that persists and is revisited, reached by
  navigating. Their objects are the types in [subjects.csv](../subjects.csv)
  that need a form: the [branch](branch.md) and the [session](session.md).
- **Occasioned forms** show one payload that work raised for the reader's
  judgment: a proposed edit, a decision a session needs, items to label,
  options to pick from. The link or file that opens one carries its content,
  and most take an answer and then stand as a record. Their contracts are the
  [envelopes](../envelopes/README.md) and the user call (`user-call/1`).

An **inbox** is a standing view that holds occasioned items until each is
answered: the Waiting, Proposals and Tending views.

## Answers

An occasioned form is known by the answer it asks for.

| Answer | The reader | Form | The answer lands in |
| --- | --- | --- | --- |
| decision | approves or returns one proposal | the Approve page (`approval/1`); a user call | a verdict file beside the request; the call's `answers.jsonl` |
| choice | picks one of several alternatives | the idea board; the design sprint's option page | chat |
| change | keeps or discards each proposed edit | Dictate and the Map's Docs tab for a documentation call; the Proposals view | the call's `answers.jsonl`; the target file |
| label | gives each item one label from a fixed set | none yet | |
| reaction | votes or comments, closing nothing | Text Lab; the Tending view | home's `reviews.jsonl`; the notes store |
| questionnaire | fills in named boxes | the Inquiry page (`inquiry/1`) | the payload's `reply_to` |

A diff is a way of drawing a change, not a kind of form: a diff of a proposed
edit belongs to a change form, and a diff of two pasted texts is a tool.

Before building a page that asks the reader for a judgment, find its kind here
and reuse that kind's form. A page that fits no kind proposes one.

## Where each page falls

Every coded page and view carries an `occasion` and an `answer` code in the
[UI codebook](../../data/ui-units/codebook.md), beside how it is laid out. The
Map view's Dimensions and Gallery tabs group the units by either.
