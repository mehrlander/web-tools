# The session form

A session is an object of type `session` ([subjects.csv](../subjects.csv)): one
record from the private store's `sessions/` folder, drawn by
[`lib/alpineComponents/session-brief.js`](../../lib/alpineComponents/session-brief.js).
It has two carriers:

- **In the app:** the Sessions view opens it over the list, addressed by
  `&session=<short id>`.
- **Standalone:** [`pages/session.html`](../../pages/session.html), addressed
  `#id=<short>`, `#gh=owner/repo[@ref]:path`, or `#gz=<base64url>` for a reader
  with no token. The store is private, so `#id=` and `#gh=` need the viewer's
  token.

The summary, topics and turn summaries come from the session's topics file,
`sessions/topics/` on the store's `background` branch. Until it is read, a
slide shows the Sessions row's copy.
