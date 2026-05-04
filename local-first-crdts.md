# Local-first without multiplayer: when (and when not) to reach for a CRDT

I build single-user browser tools — compression helpers, repo viewers, bookmarklet packers, table dumpers. They run entirely in the page; state lives in IndexedDB through a small `persistence.js` kit that maps string paths like `"compress.input"` to structured-cloned blobs. No server, no accounts, no merge problem. Already local-first by the definition that matters: the data is mine, on my device, available offline by default.

So I went looking at the CRDT discourse expecting it to be relevant to me, and came back convinced of the opposite — that "local-first" has been quietly redefined as "multi-device collaborative editing," and the conflation makes it harder, not easier, to build solo tools well. This is what I learned, framed for someone in roughly my position.

## Local-first and collaborative are orthogonal

The 2019 Ink & Switch paper listed seven ideals for local-first software. Three of them are about *where data lives* (on your device, offline-capable, long-lived). Four are about *how multiple people or devices see it* (sync, collaboration, security, user control). CRDTs address the second cluster. They're irrelevant to the first.

This matters because most of the writing about local-first in 2024–26 collapses the two. "Build a local-first app" almost always means "pick a CRDT library." But a tool that runs offline in a single tab, with no sync surface at all, is already local-first. It just isn't *collaborative*. The CRDT question only kicks in if you're crossing a device boundary.

## What CRDTs actually solve

If you do cross that boundary, three libraries dominate the JS world:

**Yjs** is the production workhorse — JupyterLab, Serenity Notes, a long tail of editors. YATA algorithm for sequences, flat operation log plus delete set, fast.

**Automerge** is the JSON-shaped one. Full operation DAG (good for time travel, costly in storage), RGA for sequences. Automerge Repo wraps it in a `Repo` + pluggable `StorageAdapter` (IndexedDB, NodeFS, S3) + `NetworkAdapter` (WebSocket, MessageChannel) so the plumbing is solved.

**Loro** is the new entrant. Implements **Fugue** for text, supports movable trees and lists natively, full history DAG. Maintainers say it's not yet production-ready, but the algorithm choices are the most forward-looking of the three.

One detail worth surfacing: most CRDT and OT algorithms exhibit an *interleaving anomaly* — when two users insert at the same position concurrently, characters can interleave into garbage. Weidner & Kleppmann's 2023 *Art of the Fugue* paper formalized "maximal non-interleaving" and showed almost every popular algorithm fails it. Yjs mitigates in practice; Fugue (in Loro) is the first to provably solve it. Matters if you're doing rich text. Doesn't matter at all if you're not.

## What CRDTs don't solve, and why most tools don't need them

Three failure modes are worth knowing even if you never write a CRDT line:

**1. Convergence ≠ semantic correctness.** Every replica ends up with the same state, but that state isn't necessarily what either user wanted. Last-write-wins on a JSON field silently drops the loser's intent. The merge "succeeded." For free-form text or ink that's fine; for structured data with meaning attached to fields, it's a UX bug the algorithm can't see.

**2. Hard invariants are unenforceable.** A CRDT counter merges, it doesn't reject. Two concurrent withdrawals on a $100 balance both succeed locally, and after merge the balance is -$60. There is no application-level fix — you can't represent "≥ 0" as a CRDT property. Anything with a hard invariant (counts, quotas, uniqueness, capacity) needs server-side coordination.

**3. Schema evolution is an open problem.** Imagine `persistence.save('compress.input', { text, mode })` synced between devices. Six months later, `mode` becomes `{ kind, level }`. Old peers may still be holding ops against the old shape. CRDTs mostly assume an immortal schema, and the migration story is basically "design it before you have data" — exactly the moment when you don't yet know what you need.

These aren't reasons not to use CRDTs. They're reasons most tools shouldn't *start* there.

## What teams actually ship

The interesting pattern is how few visible "real-time collaborative" products are pure-CRDT.

**Linear** explicitly isn't. Their sync engine ships every change as a *mutation* to a server that linearizes it, then clients rebase against the server's authoritative log. IndexedDB is the local cache, the server is the truth. They get the local-first feel — instant search, offline reads, optimistic writes — without the semantic-merge headaches.

**Figma** went hybrid. Started with OT, looked at CRDTs, ended up with a custom design: object-creation as a last-writer-wins set, per-property edits as LWW registers, and a bespoke non-CRDT algorithm for the genuinely hard problem (the layer tree with reparenting). Their reason: for design tools, semantic correctness on the tree mattered more than offline-first.

**Pure CRDT shops** (Trail Runner, Triplit, Ink & Switch's various sketches) lean in fully and accept the constraint: their domain is one where last-write-wins on a field is genuinely fine. Notes. Outlines. Drawings.

The pattern is consistent. The more your data has hard invariants or structural meaning, the further from pure CRDTs production teams end up. The more your data is genuinely commutative — text, ink, free-form trees — the more CRDTs are a gift.

## Decision tree, framed for solo local-first tools

Reframing all of this from the angle of someone with a working IndexedDB-backed toolkit, asking "what would I do if I ever wanted sync":

- **No sync needed (the current state of every tool I build).** IndexedDB through `persistence.js`. Already done. CRDT consideration: skip.
- **Sync between my own devices, no concurrent edits expected.** This is the case for things like compression-helper state or repo-viewer settings — I'm not editing them on two devices at once. A Linear-style mutation log to a personal sync server, replayed against `persistence.save` on each device, is dramatically simpler than a CRDT and gives me what I actually want. Even simpler: a "push current state" button that uploads a blob and a "pull" button that overwrites.
- **Sync where two devices might genuinely conflict on free-form content.** Shared notes, drawings, outliners. Yjs (mature) or Loro (if rich text and movable trees are central). This is the only case where the CRDT premium is paid for honestly.
- **Sync with hard invariants.** Server-authoritative, period. Not a CRDT job.

For my situation specifically, the second branch is the only one that matters in practice, and it doesn't lead to a CRDT.

## What this would look like in this repo

If sync ever lands here, the shape is already mostly visible. `persistence.js` is the local half of any local-first sync layer — string paths into IndexedDB with structured-clone fidelity, exactly the substrate Linear's engine sits on. `messaging.js` is the in-process version of the wire protocol: subscribe to a path, receive `(occasion, data, path)` callbacks. Swap the in-memory `Map` for a network adapter and the API surface barely changes.

The thing that would need to be designed *before* sync, not after, is schema versioning on persisted blobs. Right now `persistence.save('compress.input', { ... })` writes whatever shape the page happens to use today. The moment two devices hold blobs of different generations, that becomes a migration. A version field plus a migration registry, added now, is cheap; added after divergence, painful.

The CRDT discourse has very little to teach me about that problem, because it isn't a CRDT problem. It's a "long-lived structured data on disk" problem, and it predates CRDTs by decades. The honest summary of the field, from where I'm standing, is: CRDTs solved an algorithm I don't need; the product problems they didn't solve are the same product problems I have anyway.

---

## Sources

- [Local-first software: you own your data, in spite of the cloud](https://www.inkandswitch.com/essay/local-first/) — Ink & Switch, 2019
- [Local, first, forever](https://tonsky.me/blog/crdt-filesync/) — Nikita Prokopov
- [Yjs vs Loro discussion thread](https://discuss.yjs.dev/t/yjs-vs-loro-new-crdt-lib/2567) — Yjs Community
- [JS/WASM CRDT Benchmarks](https://loro.dev/docs/performance) — Loro
- [crdt-benchmarks repository](https://github.com/dmonad/crdt-benchmarks) — Kevin Jahns
- [The Art of the Fugue: Minimizing Interleaving in Collaborative Text Editing](https://arxiv.org/abs/2305.00583) — Weidner & Kleppmann, 2023
- [Interleaving anomalies in collaborative text editors](https://martin.kleppmann.com/papers/interleaving-papoc19.pdf) — Kleppmann, 2019
- [When Not to Use CRDTs](https://loro.dev/docs/concepts/when_not_crdt) — Loro docs
- [Automerge Repo: a "batteries-included" toolkit for building local-first applications](https://automerge.org/blog/automerge-repo/) — Automerge team
- [Automerge Repo on GitHub](https://github.com/automerge/automerge-repo)
- [How Figma's multiplayer technology works](https://www.figma.com/blog/how-figmas-multiplayer-technology-works/) — Figma blog
- [Linear's sync engine architecture](https://www.fujimon.com/blog/linear-sync-engine) — Fujimon
- [Linear sent me down a local-first rabbit hole](https://bytemash.net/posts/i-went-down-the-linear-rabbit-hole/) — Bytemash
- [A Pragmatic Approach to Live Collaboration](https://hex.tech/blog/a-pragmatic-approach-to-live-collaboration/) — Hex
