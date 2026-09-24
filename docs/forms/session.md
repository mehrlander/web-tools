# The session form

Tapping a row, on either the ask or the short id, opens the session as a
**conversation**: the record is fetched and handed to the swipe deck
(`lib/kits/session-render.js`), one card per exchange, so a slide carries a
question, every sentence of its answer, and everything that ran in between.
The work folds into one line: a run of tool calls plus the short sentence that
announced it is a **step**, and a run of adjacent steps collapses into a single
fold. So a card closed is the question, one line for everything done to answer
it, and the reply; opening that line lays the work out flat, sentence then
calls, step after step. The calls carry their
arguments and whatever body the record kept, and fenced blocks get chat-render's
live views. The record is cached per id, and the
renderer chain loads on first use, so a visit that never opens a session pays
nothing for it.

The deck's first card names what the record could not hold, and its last is the
closing summary: the files with their read/edit/write breakdown, the tool
histogram, and the tokens. Those two cards are the whole of what an inline
expansion used to show below the row. That expansion is gone, and its going is
the point: it put a summary between the reader and the conversation, so reaching
the thing worth reading took two taps through a pane answering a question nobody
had asked, and it made one record two surfaces to keep honest.

A branch chip opens **that branch**, at [`pages/branch.html`](../pages/branch.html)
(🌿), the estate's canonical single-branch address. It used to switch panes and
filter Branches by repo, which answers "show me this branch" by leaving the
reader somewhere else with the branch still to find and the session they were
reading lost. A session's branch is frequently merged and so absent from that
list altogether, which the old filter could not express.

The same deck has a page of its own at [`pages/session.html`](../pages/session.html),
addressed `#id=<short>`, `#gh=owner/repo:path`, or `#gz=` for a reader with no
token. It opens the conversation on arrival; its facts card is the after-close
state, not a waiting room.
