# Learnings

Tiny insights from failure: "here is a thing to do differently next time." A
diary, not a manual. Each entry is a one-liner (symptom, then the corrected
move) with a `→` pointer to the durable doc that carries the full fix, where one
exists. Newest on top.

This is distinct from the other logs by what it keys on: the [tracker](../tracker/)
keys on a **task** (intent), the [merge guide](MERGE-GUIDE.md) on a **PR**
(delivery), this on an **insight** (a correction), atomic and cross-cutting. It
stays an index: a substantial learning graduates into a topical doc and the
entry links to it; a trivial one lives only here. So it cannot drift from the
docs the way a parallel narrative would.

*(Provisional format. The shape, the harvest cadence, and whether entries are
projected from guide-PR bodies like the merge guide are open in tracker task
0014.)*

---

### 2026-07-15 · An MCP approval prompt can be a routing artifact, not a wall
A GitHub MCP call "requires approval" though the same operation runs clean
elsewhere: a reconnected second server (a per-connection UUID twin) is holding
the call. Retry it on the stable `mcp__github__*` server before re-approving.
→ [github/mcp-server-routing.md](github/mcp-server-routing.md)

### 2026-07-15 · `x-collapse` without `x-show` hides the element
A component mounts with correct state yet renders at zero size: `x-collapse` with
no companion `x-show` sets `el.hidden` (the plugin keys on `_x_isShown`). Pair
the two, or use a plain `x-if` for presence toggling. A green logic test won't
catch it; only a render does.
→ [environment/testing.md](environment/testing.md)
