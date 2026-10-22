# The session form

A session is an object of type `session` ([subjects.csv](../subjects.csv)): one
record from the private store's `sessions/` folder, drawn by
[`lib/alpineComponents/session-brief.js`](../../lib/alpineComponents/session-brief.js).
It has two carriers:

- **In the app:** the Sessions view opens it over the list, addressed by
  `&session=<short id>` ([views/sessions.md](../views/sessions.md)).
- **Standalone:** [`pages/session.html`](../../pages/session.html), addressed
  `#id=<short>`, `#gh=owner/repo[@ref]:path`, or `#gz=<base64url>` for a reader
  with no token. The store is private, so `#id=` and `#gh=` need the viewer's
  token.

The summary, the topics and a summary of each turn come from the session's
topics file, `sessions/topics/` on the store's `background` branch, which the
laptop daemon writes. The Sessions row lends the summary and topics until the
file is read, so a slide shows them at once and the standalone page shows them
once the file arrives. A turn's summary is a line on its Outline row.
