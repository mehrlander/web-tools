# The container: what the box is, and what persists

What the Claude Code web sandbox *is* as a machine, and — the part that bites —
what state carries across sessions and what doesn't. For what it can run and
reach, see [capabilities.md](capabilities.md).

## The sandbox

*(verified 2026-05-30)*

- Runs in a **remote, ephemeral container**. The working tree is laid down from a
  baked image, not minted at session start (see "Container provenance" below),
  and the box is reclaimed after inactivity. Anything worth keeping must be
  committed and pushed.
- Working dir `/home/user/web-tools`.
- Resource ceilings (approx, may shift): **4 vCPU, 16 GB RAM, 30 GB disk**.
  Memory-heavy builds or tests can be killed.

## Container provenance: what carries across sessions

*(verified 2026-05-30)*

"Ephemeral" hides a wrinkle that governs what can leak between sessions. Two
separate axes are at play, and it's easy to prove one and quietly claim the other.

**Provable from inside one container:**

- **The working tree predates the session.** `.git`'s mtime is hours older than
  the boot time (`uptime -s`), so the clone is inherited from a baked image, not
  minted at session start. Boot just fetches and checks out a branch on top.
- **"The repo" is GitHub, not your laptop.** `origin` is a loopback proxy
  (`http://local_proxy@127.0.0.1:PORT/git/<owner>/<repo>`) forwarding to
  github.com. One remote, no second, no path to a laptop's synced copy. Your
  laptop and this box are independent clones sharing a center, never touching.
- **It is a shallow clone** (`.git/shallow` present). Heavy history isn't dragged
  down in full.
- **Local `main` can lag `origin/main`.** If the image baked before a history
  rewrite landed, the local ref stays frozen at bake time while the session
  updates only the remote-tracking ref. That stale pointer is why a box can still
  hold blobs already gone from the authoritative remote: snapshot leftover, not
  memory of a past chat.
- **Runtime writes are private to their session.** Two concurrent sessions can't
  see each other's uncommitted files: a marker written in one was invisible in a
  sibling, both ways. Only **commit + push** crosses between sessions. (This is
  *isolation*, proven sideways between live siblings. It says nothing about whether
  a single session's disk survives its own re-provision: that's untested and
  untestable from inside.)

**Not provable from inside (don't overclaim):** whether the image is **reused**
across sessions or **rebaked per session**, and whether a session's disk **survives
its own re-provision**. You only ever see one container, in one continuous run. The
defensible claims are narrow: *this session's clone predates its boot*, and *live
siblings are isolated*. Anything about a disk "following a session forward" reaches
past the evidence.

The durable state is only what's committed and pushed. A big file in history isn't
re-moved by hand each session: it arrives once with the (shallow) clone, and after
a rewrite future images carry a lean repo. A purged artifact lingers only in a box
baked just before the rewrite, until that box is reclaimed.

```bash
stat -c '%y %n' .git      # snapshot-bake time...
uptime -s                 # ...vs this session's boot
git remote -v             # loopback proxy to GitHub; no laptop remote
test -f .git/shallow && echo "shallow clone"
git rev-parse main origin/main   # do they differ? stale pointer = bake predates a rewrite
```

> **Provenance discipline.** A result that matches the documented design proves
> nothing about the mechanism: you can't tell understanding from recitation. The
> stale local `main` was useful precisely because it shouldn't have been there. It
> forced a check against the filesystem instead of the story, and caught a sloppy
> phrase ("leftover from before the rollback") that had smuggled in persistence
> nobody earned. Trust an anomaly over a tidy match: it teaches the mechanism and
> audits the explainer at once.
