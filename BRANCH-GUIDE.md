# Branch guide: claude/inter-session-messaging-hvn2g2

Drafting a design proposal for an inter-session "message bus" / back-catalog
census: using the repo as a shared medium so resumed predecessor sessions can
self-classify and clean themselves up. Capturing the idea while it's still under
consideration; nothing is implemented.

⭐ [docs/proposals/inter-session-messaging.md](https://github.com/mehrlander/web-tools/blob/claude/inter-session-messaging-hvn2g2/docs/proposals/inter-session-messaging.md)

**Changed:**
- docs/proposals/inter-session-messaging.md (new) — the draft proposal, banner-flagged as not implemented

**Next steps / open threads:**
- Decide whether to build the minimal slice (orphan `bus` branch + `/check-census` skill + thin conductor).
- Load-bearing unknown to confirm first: does resuming an old/reclaimed session restore its conversation context? Everything depends on it.
- Possibly link the proposal from docs/README.md once it's less provisional.
- Note: replaced a stale branch guide carried over from `claude/unmerged-branches-review-bkn37j`.
