# Forms

A **form** is the standard way one kind of thing is shown, so that a reader
knows the kind before reading the content. Before building a page, find the
job it does here and reuse a form that serves it. A page that fits no form
proposes one.

## Jobs

Every page and view is tagged with the jobs it does for the reader. A page
that does two jobs carries both tags, and neither is primary.

| Job | The reader | Forms |
| --- | --- | --- |
| respond | judges something work raised | one per answer, below |
| follow | keeps track of something ongoing | the [branch](branch.md); the [session](session.md); an inbox |
| read | takes in a document or a result | none named yet |
| explore | finds their way through a repo, a dataset or a collection | none named yet |
| make | works on something they bring or own | none named yet |

An **inbox** holds respond items until each is answered, so it carries both
tags: the Waiting, Proposals and Tending views.

The test for each tag is its row in
[data/ui-units/codes.csv](../../data/ui-units/codes.csv), and each page's tags
are in [coded.csv](../../data/ui-units/coded.csv). The Map view's Gallery groups
the pages by any one tag, listing a page under each of its tags. Read, explore
and make have pages but no named form yet; the Gallery puts each job's pages
side by side, which is where one gets chosen.

## Respond forms

A respond form usually opens on a payload that work made for the reader,
carried by its link or file, under a contract: an
[envelope](../envelopes/README.md) or the user call (`user-call/1`). It is
known by the answer it asks for.

| Answer | The reader | Form | The answer lands in |
| --- | --- | --- | --- |
| decision | approves or returns one proposal | the Approve page (`approval/1`); a user call | a verdict file beside the request; the call's `answers.jsonl` |
| choice | picks one of several alternatives | none yet | |
| change | keeps or discards each proposed edit | Dictate and the Map's Docs tab for a documentation call; the Proposals view | the call's `answers.jsonl`; the target file |
| label | gives each item one label from a fixed set | the audit render (`audit/1`) | the standoff file, saved back to its path |
| reaction | votes or comments, closing nothing | Text Lab; the Tending view | home's `reviews.jsonl`; the notes store |
| questionnaire | fills in named boxes | the Inquiry page (`inquiry/1`) | the payload's `reply_to` |

An answer counts only where the form writes it for the work that raised it to
read. The idea board and the design sprint's option page collect a choice, and
the Review page a judgment of a changeset, but each keeps it in the browser or
records nothing, so it reaches the work only through chat. They are tagged
respond with no answer, and choice is a kind with no form yet.

A diff is a way of drawing a change, not a kind of form: a diff of a proposed
edit belongs to a change form, and a diff of two pasted texts is a make tool.
