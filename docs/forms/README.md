# Forms

A **form** is the standard way to show one type of object or to ask for one
kind of answer, so that a reader recognizes the form before reading the
content. Before building a page, find the
job it does here and reuse a form that serves it. A page that fits no form
proposes one.

## Jobs

Every page and view is tagged with the jobs it does for the reader. A page
that does two jobs carries both tags, and neither is primary.

| Job | The reader | Forms |
| --- | --- | --- |
| respond | judges something work raised | one per answer, below |
| follow | keeps track of something ongoing | the [branch](../../pages/branch.html); the [session](../../pages/session.html); an inbox |
| read | takes in a document or a result | none named yet |
| explore | finds their way through a repo, a dataset or a collection | none named yet |
| make | works on something they bring or own | none named yet |

An **inbox** holds respond items until each is answered, so it carries both
tags: the Waiting, Proposals and Tending views.

The test for each tag is its row in
[data/ui-units/codes.csv](../../data/ui-units/codes.csv), and each page's tags
are in [coded.csv](../../data/ui-units/coded.csv). The Map view's Pages tab groups
the pages by any one tag, listing a page under each of its tags. Read, explore
and make have pages but no named form yet; the Pages tab puts each job's pages
side by side, which is where one gets chosen.

## Respond forms

A respond form usually opens on a payload that work made for the reader,
carried by its link or file, under a contract: an
[envelope](../envelopes/README.md) or the user call (`user-call/1`). It is
known by the answer it asks for.

| Answer | The reader | Form | The answer lands in |
| --- | --- | --- | --- |
| approval | authorizes one proposal or returns it | the [Approve page](../../pages/approve.html) (`approval/1`); a user call that recommends an answer or confirms a merge | a verdict file beside the request; the call's `answers.jsonl` |
| choice | picks one or more of several alternatives | for found images, the [image board](../../pages/image-board.html), and for a design sprint's concepts, the [idea board](../../pages/idea-board.html), each opened on a pick call (a user call of kind `pick`) | the call's `answers.jsonl` |
| change | keeps or discards each proposed edit | the call page for a documentation call, which Dictate and the Map's Docs tab also answer; the Proposals view | the call's `answers.jsonl`; the target file |
| label | gives each item one label from a fixed set | the audit render (`audit/1`) | the standoff file, saved back to its path |
| reaction | votes or comments, closing nothing | Text Lab; the Tending view | home's `reviews.jsonl`; the notes store |
| questionnaire | fills in named boxes | the Inquiry page (`inquiry/1`) | the payload's `reply_to` |

An answer counts only once the form writes it where the session or run that
asked will read it. Two forms fall short of that. The **lineup** draws one page
once per option under a strip that switches between them, for a choice among
working versions of that page; the header of
[`docs/prototypes/lists-options.html`](../prototypes/lists-options.html) says
how a lineup is built. The [Review page](../../pages/review.html), tagged
respond, collects a judgment of a changeset. On both, what the reader decides
reaches the session only through chat.

A diff is a way of drawing a change, not a kind of form: a diff of a proposed
edit belongs to a change form, and a diff of two pasted texts is a make tool.
