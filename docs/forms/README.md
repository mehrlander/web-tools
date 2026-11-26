# Forms

A **form** is the standard layout for one type of content, so that a reader recognizes the form before reading the content. A form is one of two kinds, told apart by whether it writes an answer:

- A **display form** shows a fixed set of fields for reading. The fields can come from several objects: the [branch page](../../pages/branch.html) draws a branch's guide, its pull requests and its diff.
- A **call form** opens on one request that a session or a run made for the reader. It writes the reader's answer where that session or run will read it.

A page can hold both kinds. The [session page](../../pages/session.html) displays one session's record and holds a call form for each user call the session filed. A user call is one question for the owner, kept as a JSON file in web-tools-private.

A row of [coded.csv](../../data/ui-units/coded.csv) with an `answer` code marks a page or region that holds a call form.

Before building a page, find the job it does here and reuse a form that serves it. When a page fits no form, propose a new form for it.

## Jobs

Every page and view is tagged with the jobs it does for the reader. A page
that does two jobs carries both tags, and neither is primary.

| Job | The reader | Forms |
| --- | --- | --- |
| respond | judges a request that a session or a run made | a call form per answer, below |
| follow | keeps track of a branch, a session or a queue as it changes | the [branch](../../pages/branch.html); the [session](../../pages/session.html); an inbox |
| read | takes in a document or a result | none named yet |
| explore | finds their way through a repo, a dataset or a collection | none named yet |
| make | works on something they bring or own | none named yet |

An **inbox** lists the requests that wait on the reader. It does both jobs, respond and follow. The [Waiting](../../app/?view=waiting), [Proposals](../../app/?view=proposals) and [Tending](../../app/?view=tending) views are inboxes.

The test for each tag is its row in
[data/ui-units/codes.csv](../../data/ui-units/codes.csv), and each page's tags
are in [coded.csv](../../data/ui-units/coded.csv). The Map view's Pages tab groups
the pages by any one tag, listing a page under each of its tags. Read, explore
and make have pages but no named form yet; the Pages tab puts each job's pages
side by side, which is where one gets chosen.

## Call forms

Each request follows a contract: an [envelope](../envelopes/README.md) or the user call (`user-call/1`).

| Answer | The reader | Form | The answer lands in |
| --- | --- | --- | --- |
| approval | authorizes one proposal or returns it | the [Approve page](../../pages/approve.html) (`approval/1`); a user call that recommends an answer | a verdict file beside the request; the call's `answers.jsonl` |
| choice | picks one or more of several alternatives | for found images, the [image board](../../pages/image-board.html), and for a design sprint's concepts, the [idea board](../../pages/idea-board.html), each opened on a pick call (a user call of kind `pick`) | the call's `answers.jsonl` |
| change | keeps or discards each proposed edit | the call page for a documentation call, which Dictate and the Map's Docs tab also answer; the Proposals view | the call's `answers.jsonl`; the target file |
| label | gives each item one label from a fixed set | the audit render (`audit/1`) | the standoff file, saved back to its path |
| inspection | notes each output a model or a script made from its input and gives each a verdict where the payload declares verdicts | the [Inspection page](../../pages/inspection.html) (`inspection/1`) | the payload's answers file |
| reaction | votes or comments, closing nothing | Text Lab; the Tending view | home's `reviews.jsonl`; the notes store |
| questionnaire | fills in named boxes | the Inquiry page (`inquiry/1`) | the payload's `reply_to` |

The lineup and the Review page collect a decision without writing an answer, and both count as display forms. The **lineup** shows one working version of a page per option. A strip of tabs above it switches between the versions. The header of [`docs/prototypes/lists-options.html`](../prototypes/lists-options.html) says how a lineup is built. The [Review page](../../pages/review.html), tagged respond, collects a judgment of a changeset. On both pages, what the reader decides reaches the session only through chat.

A diff is a way of drawing a change, not a kind of form: a diff of a proposed
edit belongs to a change form, and a diff of two pasted texts is a make tool.
