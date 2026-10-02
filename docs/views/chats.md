# Chats

`?view=chats`, a pane of the Activity stop, reads the conversation archive in
`mehrlander/chat-histories` through [`lib/kits/chat-archive.js`](../../lib/kits/chat-archive.js).
No key joins a chat to a branch or a session, so the pane links chats only to
chats (by tag) and claims no other join.

- **Month shards, newest first.** The archive is sharded by month per annotation
  layer, and the pane reads one month at a time.
- **Staleness** comes from `annotations/catalog/frontier.json`, which
  chat-histories generates. A provider is due only past its own longest
  observed export gap.
- **No cache**, so no age pill and no State row: shards are immutable and the
  frontier moves only when an export lands in the other repo.
- The hand catalog wins every collision with the machine layer. Gemini chats
  have no per-chat address, so their titles are not links.
- A failed read is never memoized as empty, since an empty month and an
  unreachable one would look the same.
