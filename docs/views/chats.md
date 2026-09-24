# Chats

`?view=chats`, a pane of the Activity stop, reads the conversation archive in
`mehrlander/chat-histories` through [`lib/kits/chat-archive.js`](../../lib/kits/chat-archive.js).
It is a separate venue: no key joins a chat to a branch or a session, so the
pane links chats only to chats (by tag) and claims no other join.

- **One month at a time.** The archive is sharded by month per annotation
  layer; the pane opens on the newest month and pages back on demand. The
  footer states how many months are loaded.
- **Staleness is the headline.** The banner reads
  `annotations/catalog/frontier.json`, which chat-histories generates and its
  own `content-date` check also reads. A provider is marked due only past its
  own longest observed export gap.
- **No cache, so no age pill and no State row.** Month shards are immutable and
  the frontier moves only when an export lands in the other repo.
- The hand catalog wins every collision with the machine layer and has its own
  filter chip. Gemini rows have no per-chat address, so their titles are text.
- A failed read is never memoized as empty: an empty month and an unreachable
  month look the same on screen.
