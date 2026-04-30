# Local-first CRDTs in 2026: convergence is the easy part

CRDTs have a marketing problem. Pitch decks promise "automatic conflict resolution," and the demos always show two cursors typing into the same paragraph. Then you try to ship a real product and discover that *converging on a single state* and *converging on the state the user wanted* are different problems. The first is solved. The second is not.

This is a survey of where the field actually stands — what CRDTs do well, where they break down, and which categories of web tools should and shouldn't reach for them.

## The libraries are good now

Three libraries dominate the JavaScript-flavored CRDT world, and they've converged enough that the choice is largely about ergonomics and history.

**Yjs** is the production workhorse. JupyterLab, Serenity Notes, and a long tail of collaborative editors run on it. It uses the YATA algorithm for sequences and stores state as a flat operation log plus a delete set. That keeps the runtime fast, but it means Yjs doesn't natively retain a full DAG of edit history — you reconstruct history from snapshots.

**Automerge** is the JSON-shaped one. It keeps the full operation DAG, which is genuinely useful for time travel and audit, at the cost of more storage. Its sequence algorithm is RGA. Automerge Repo (the "batteries-included" wrapper) splits cleanly into a `Repo` plus pluggable `StorageAdapter` (IndexedDB, NodeFS, S3) and `NetworkAdapter` (WebSocket, MessageChannel, BroadcastChannel) — so the boring parts of "where does this document live and how does it sync" are no longer your problem.

**Loro** is the new entrant. It implements **Fugue** for text, supports movable trees and lists natively (a real pain point in Yjs/Automerge — try modeling an outliner), and stores the full history DAG like Automerge. Maintainers describe it as not yet production-ready, but the algorithm choices are forward-looking.

The thing nobody told me until I went looking: most CRDT and OT algorithms exhibit an **interleaving anomaly**. When two users insert text at the same position concurrently, the merge can interleave their characters into garbage. Weidner & Kleppmann's 2023 paper *The Art of the Fugue* introduced the formal property of "maximal non-interleaving" and showed that almost every popular algorithm fails it. Yjs's YATA mitigates the problem in practice; Fugue (now in Loro) is the first to provably solve it. If your product is text-heavy, this matters.

## Where CRDTs actually break down

The 2019 Ink & Switch paper made CRDTs sound like a finished product. The follow-up lessons from teams that shipped on top of them tell a more complicated story.

**1. Convergence ≠ correctness.** A CRDT guarantees every replica ends up with the same state. It does not guarantee that state is what either user wanted. Two users edit the same JSON field; last-write-wins picks one deterministically; the loser's intent is silently dropped. The merge "succeeded." That's a semantic conflict, and the CRDT can't see it.

**2. Hard invariants are unenforceable.** The canonical example is a bank balance. A CRDT counter merges, it doesn't reject. Two concurrent $80 withdrawals on a $100 balance both succeed locally, and after merge the balance is -$60. There is no application-level fix — the data structure cannot represent the constraint "≥ 0." Anything with a hard invariant (inventory counts, seat reservations, unique usernames, double-entry bookkeeping) needs server-side coordination, period.

**3. Schema migrations are an open problem.** Once a CRDT document has months of history, changing its shape is genuinely hard. You can't just run a migration — old peers may still be holding ops against the old schema, and merging them into the new one is undefined behavior unless you've planned for it. This is the part the demos never show.

## Who's actually shipping what

The interesting pattern in 2025–26 is how few of the visible "real-time collaborative" products are pure-CRDT.

**Figma** built its own thing. They started with operational transforms, looked at CRDTs, and ended up with a hybrid: object-creation looks like a last-writer-wins set, per-property edits use last-writer-wins registers, and the genuinely hard problem (the layer tree, with reparenting) gets a custom non-CRDT algorithm. Their stated reason is that for design tools, semantic correctness on the tree matters more than offline-first.

**Linear** explicitly does not use CRDTs. Their sync engine ships every change as a "mutation" to a server that linearizes them, then clients rebase against the server's authoritative log. IndexedDB is the local cache; the server is the truth. They get the local-first feel (instant search, offline reads) without the semantic-merge headaches, at the cost of needing a server for writes.

**Automerge-shaped products** (Trail Runner, Triplit, the Ink & Switch sketches) lean into the CRDT all the way and accept the constraint that their domain is one where last-write-wins on a field is genuinely fine — notes, outlines, drawings.

The pattern: the more your data has hard invariants, the further from pure CRDTs you end up. The more your data is genuinely commutative (text, ink, free-form trees), the more CRDTs are a gift.

## A decision tree for the rest of us

If you're picking an architecture for a collaborative web tool, the question isn't "should I use a CRDT." It's "which axis of correctness am I willing to compromise on."

- **Domain is text, ink, or free-form structure; offline matters; no hard invariants** → reach for Yjs (mature) or Loro (if rich text and movable trees are central). Use Automerge Repo if you want the storage/network plumbing solved for you.
- **Domain has a tree with reparenting (outliners, file managers, design canvases)** → either Loro's tree CRDT, or a custom algorithm in the Figma vein. Yjs and Automerge will fight you here.
- **Domain has hard invariants (money, inventory, uniqueness, capacity)** → server-authoritative with a mutation log (Linear's model). You can still be local-first for reads and optimistic for writes, but the server has to be able to reject.
- **Domain is "Google Docs but for X"** → honestly, OT with a server is still fine. CRDTs win on offline and on P2P; if you don't need either, the complexity isn't free.

## What I'd actually research next

The interesting open questions, in rough order of how much I'd want to read about them:

1. **Schema evolution in long-lived CRDT documents.** What happens to a five-year-old Automerge doc when you change its shape? Nobody has a clean answer.
2. **Auth and access control on top of CRDTs.** The merge function doesn't know who you are. End-to-end encrypted CRDTs (Matrix's experiments, Keyhive) are early.
3. **Hybrid models in production.** Linear's mutation log + IndexedDB approach seems to be quietly winning over pure CRDTs for app-shaped products. Is that just because the domain has invariants, or is it a sign that the CRDT abstraction leaks too much for general use?
4. **Sync-server economics.** Self-hosting y-websocket or automerge-repo's WebSocket server is straightforward. The hard part is multi-tenant auth, presence, and storage at scale — and there's no obvious open-source story for it yet.

The headline I'd put on the field: CRDTs solved the algorithm. The product problems — invariants, schema, auth, semantic merges — are where the next decade goes.

---

## Sources

- [Yjs vs Loro discussion thread](https://discuss.yjs.dev/t/yjs-vs-loro-new-crdt-lib/2567) — Yjs Community
- [JS/WASM CRDT Benchmarks](https://loro.dev/docs/performance) — Loro
- [crdt-benchmarks repository](https://github.com/dmonad/crdt-benchmarks) — Kevin Jahns
- [The Art of the Fugue: Minimizing Interleaving in Collaborative Text Editing](https://arxiv.org/abs/2305.00583) — Weidner & Kleppmann, 2023
- [Interleaving anomalies in collaborative text editors](https://martin.kleppmann.com/papers/interleaving-papoc19.pdf) — Kleppmann, 2019
- [When Not to Use CRDTs](https://loro.dev/docs/concepts/when_not_crdt) — Loro docs
- [Local-first software: you own your data, in spite of the cloud](https://www.inkandswitch.com/essay/local-first/) — Ink & Switch, 2019
- [Local, first, forever](https://tonsky.me/blog/crdt-filesync/) — Nikita Prokopov
- [Automerge Repo: a "batteries-included" toolkit for building local-first applications](https://automerge.org/blog/automerge-repo/) — Automerge team
- [Automerge Repo on GitHub](https://github.com/automerge/automerge-repo)
- [How Figma's multiplayer technology works](https://www.figma.com/blog/how-figmas-multiplayer-technology-works/) — Figma blog
- [Linear's sync engine architecture](https://www.fujimon.com/blog/linear-sync-engine) — Fujimon
- [Linear sent me down a local-first rabbit hole](https://bytemash.net/posts/i-went-down-the-linear-rabbit-hole/) — Bytemash
- [OT vs CRDT in 2026: Multiplayer Algorithm Comparison](https://www.taskade.com/blog/ot-vs-crdt) — Taskade
- [A Pragmatic Approach to Live Collaboration](https://hex.tech/blog/a-pragmatic-approach-to-live-collaboration/) — Hex
