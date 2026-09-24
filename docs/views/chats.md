# Chats

**Chats** is not a reading of the repos at all, and that is why it belongs
rather than despite it. It is a separate **venue**: the conversation half of the
work, read from `mehrlander/chat-histories`. No key joins a chat to a branch or
a session, the archive's ids are chat uuids while sessions carry harness
`session_...` ids, and the two corpora do not overlap in time, so the pane
cross-links chat to chat (tags) and claims no join it does not have. The test it
passes is the one the others pass, that it reports where work actually
happens; it is the only one that can say so about thinking done outside a
checkout. To-do and Jot failed exactly that test and left (below).

Three things about Chats follow from the archive rather than from taste.

- **It is read one month at a time.** The corpus is 14,844 conversations and
  the annotation layers alone are 1.9 MB and 9.9 MB, so nothing loads it. The
  archive is already sharded by month per layer, so the pane opens on the newest
  month and pages back on demand, two small requests each, and the footer says
  how many of the archive's months are loaded. That count is the honesty: a
  short list means "most of this is not on screen", not "this is all there is".
- **Staleness is the pane's headline.** This is the one subject that advances by
  hand, through an export requested on a website, so how far behind it is *is*
  the state of the venue. The banner reads
  `annotations/catalog/frontier.json`, which chat-histories generates for
  itself, and the repo's own declared `content-date` check reads the same file,
  so the pane and the estate card cannot disagree. Per provider it shows the
  newest chat held, days behind, and the export cadence to read that against,
  marking a provider due only when it is past its **own** longest observed gap.
  The archive can say when it last heard, never how much it is missing, and the
  banner says so where the number is read.
- **It has no cache, so it has no age pill and no Refresh.** The month shards
  are immutable once committed and the frontier moves only when an export lands,
  which is a commit to another repo rather than a crawl this page could run. So
  there is nothing for the State view to hold a row for: what can be stale here
  is the archive itself, and the banner reports that instead. This is the case
  the State view's "a Refresh where one is possible" leaves open, not an
  omission.

The hand catalog wins every collision with the machine layer, and gets a filter
chip of its own: it was summarized through the chat UI and is the archive's
precious layer, so showing the bulk read-through of a chat somebody hand-wrote
would display the lesser of the two. A Gemini row renders its title as text
rather than a link, since Gemini Apps chats have no per-conversation address.

`kits/chat-archive.js` holds the folds and the cached reader, in the memo plus
in-flight-dedup shape `kits/estate-search.js` established; a failed read is
never memoized as empty, because an empty month and an unreachable month look
identical on screen and mean opposite things.
