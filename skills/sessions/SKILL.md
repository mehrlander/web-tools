---
name: sessions
description: >-
  Put this session on the record. Attach and clone the session-record store
  (the checkout whose .web-tools.json declares `sessions`) beside the project
  root when nothing has, so the portable plugin's Stop hook can find it. Use
  when the session-start directive says to, when the user asks whether this
  session is being recorded, says "get on the bus", "record this session",
  or "web-tools-private is not checked out", or when invoked explicitly as
  /portable:sessions.
---

# Put this session on the record

**Stop if a store is already checked out.** A checkout that declares
`"sessions": "<dir>"` in its `.web-tools.json` and carries
`<dir>/tools/on-stop.sh` is the store, and the Stop hook finds it on its own.
Look at the project root, its children, and its siblings, which is exactly the
search the hook runs. If one is there, say so in one line and do nothing else.

**Find the store's name.** It is not in the plugin, on purpose. Read it from
`SESSIONS_STORE_REPO` in the environment, or failing that from the first
`.web-tools.json` in that same search that declares
`"sessionsStore": "<owner>/<repo>"`. No name means nothing asked for this
session to be recorded; say so and stop.

**Attach, then clone beside the other checkouts.** An unattached private repo
is unreachable from a shell here, so attach it first with the session's
repository tool (`add_repo`, with push access, since the recorder pushes one
commit per record). Then clone it, shallow, into the directory that holds the
other checkouts: `<parent of the project root>/<repo>` when the root is itself a
checkout, or `<project root>/<repo>` when the root sits above them. Either
puts it where the hook looks. Register the clone with the session afterwards
(`register_repo_root`) so its own instructions load.

**Confirm, in one line, then end the turn.** Check that the clone's manifest
declares `sessions` and that `tools/on-stop.sh` exists under it, and say the
session will be recorded from the next Stop. Then end the turn rather than
chaining into other work: Stop fires when the session idles, not once per
message, so a turn the harness auto-continues writes no record. The first
record appears on the store's `main` within seconds of the next idle.

What this does not do: install anything, edit settings, or touch the store's
contents. The recorder ships in the plugin already; the only thing a spawned
session lacks is the checkout, and that is all this supplies.
