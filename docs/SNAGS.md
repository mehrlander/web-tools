# Snags

Things learned the hard way: small friction you trip over, noted so you trip on
it once, not three times. A triage queue, not just a diary. Each entry is a
one-liner (symptom, then the corrected move) with a `→` to the durable doc that
carries the full fix. Newest on top.

**Recurrence is the signal.** One trip is noise; the same trip two or three
times earns a systematic fix. An entry tracks how often it bit; a snag that
keeps recurring graduates to a [tracker](../tracker/) task that removes the
cause. The log triages, the tracker does the work.

Distinct from the other logs by what it keys on: the tracker keys on a **task**
(intent), the [merge guide](MERGE-GUIDE.md) on a **PR** (delivery), this on a
**snag** (a recurring friction), atomic and cross-PR. Entries stay an index (a
one-liner plus a `→`), so they cannot drift from the docs that hold the fix.

*(Provisional. Whether snags are authored in guide-PR bodies and projected here
like the merge guide, the recurrence mechanism, and the format are open in
tracker task 0014. Each entry leads with a slug so a repeat can be matched and
counted.)*

---

### x-collapse-needs-x-show — a panel renders at zero size
A component mounts with correct state yet renders at zero size: `x-collapse` with
no companion `x-show` sets `el.hidden` (the plugin keys on `_x_isShown`). Pair
the two, or use a plain `x-if` for presence toggling. A green logic test won't
catch it; only a render does. *(seen: 2026-07-15)*
→ [environment/testing.md](environment/testing.md)

### mcp-approval-is-often-routing — an approval prompt that is really a wall
A GitHub MCP call "requires approval" though the same operation runs clean
elsewhere: a reconnected second server (a per-connection UUID twin) is holding
the call. Retry on the stable `mcp__github__*` server before re-approving.
*(seen: 2026-07-15)*
→ [github/mcp-server-routing.md](github/mcp-server-routing.md)
