# The session form

A session is an object of type `session` ([subjects.csv](../subjects.csv)): one
record from the private store's `sessions/` folder. Its form is a swipe deck
built by [`lib/kits/session-render.js`](../../lib/kits/session-render.js), one
card per exchange, and it has two carriers:

- **In the app:** the Sessions view opens it over the list, addressed by
  `&session=<short id>` ([views/sessions.md](../views/sessions.md)).
- **Standalone:** [`pages/session.html`](../../pages/session.html), addressed
  `#id=<short>`, `#gh=owner/repo[@ref]:path`, or `#gz=<base64url>` for a reader
  with no token. The store is private, so `#id=` and `#gh=` need the viewer's
  token.

A card holds the question, the reply, and the work between them folded to one
line: a step is a run of tool calls with the sentence that announced it, and
adjacent steps fold together. The first card names what the record could not
hold; the last is the summary (files by read, edit and write, the tool
histogram, tokens). The record is cached per id, and the renderer chain loads
on first use.
