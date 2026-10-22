# Content envelopes

An **envelope** is a JSON document that carries a curated, annotated set of items for a reader to open, rendered by a web-tools page rather than by a bespoke viewer. Files, chats, and diffs stay where they live; the envelope layers selection, arrangement, and commentary over them, travels as one unit, and renders through a shared page. This folder is the family's home: the format contracts, the JSON Schemas that describe them, and this note on how the members relate.

The `schemas/` here are written contracts that nothing yet validates against (see [`surface.md`](surface.md)); the `.md` files carry concepts, conventions, and worked examples.

## The members

The members run from the most general to the most specific; [Membership](#membership) says what admits a format.

| Member | Contract | Renders through | Produced by | Carries |
| --- | --- | --- | --- | --- |
| **Surface** | [`surface.md`](surface.md) + [`schemas/surface-v2.schema.json`](schemas/surface-v2.schema.json) | [`pages/branch.html`](../../pages/branch.html), for a `branch-review/1` surface | none live; the Surfacer desktop app wrote v1 | a curated, annotated set of cross-repo items for any reason |
| **Chat-results** | [`chat-results.md`](chat-results.md) | [`pages/chat-results.html`](../../pages/chat-results.html) | the `chat-histories` search skill | what a search over the chat archives found |
| **Stage** | [`docs/stage.md`](../stage.md), `StageLink` | the Web Tools app | `StageLink.mint`, or by hand | a fileset in transit, plus authored review prompts and a mode |
| **Data view** | [`data-view.md`](data-view.md) | [`pages/data-view.html`](../../pages/data-view.html) | by hand; a bare file needs none | data itself: a CSV, a JSON array, a log, or several of them with a view each |
| **Shorter** | [`shorter.md`](shorter.md) | [`pages/shorter.html`](../../pages/shorter.html) | [audit-render](../../pages/audit-render.html)'s adjudicate link, or by hand | a document and, optionally, a shortening of it to adjudicate against it |
| **Workbook extract** | [`workbook-extract.md`](workbook-extract.md) + [`schemas/workbook-extract-v2.schema.json`](schemas/workbook-extract-v2.schema.json) | [`pages/data-view.html`](../../pages/data-view.html) | [`lib/kits/xlsx-extract.js`](../../lib/kits/xlsx-extract.js) | selected sheet readings and individual workbook objects, with provenance |
| **Passage reading** | [`passage-reading.md`](passage-reading.md) + [`schemas/passage-reading-v1.schema.json`](schemas/passage-reading-v1.schema.json) | [`pages/passage-reader.html`](../../pages/passage-reader.html) | the [`passage-reading`](../../skills/passage-reading/SKILL.md) skill | a passage read sentence by sentence, with each sentence's references, terms and claims |
| **Audit** | [`audit.md`](audit.md) | [`pages/audit-render.html`](../../pages/audit-render.html) | [`python/annotate/audit-payload.py`](../../python/annotate/audit-payload.py); the [`doc-audit`](../../skills/doc-audit/SKILL.md) skill | a document's units, each with a label from a declared vocabulary and a verdict on whether it stays |

**Surface** is the general substrate: the schema is deliberately light at the core (`role`, `view`, `context` optional and open) and tightens through named, versioned **profiles**, of which `branch-review/1` is the first (its schema is under [`schemas/profiles/`](schemas/profiles/)).

**Chat-results** is the search-archive envelope: `results[]` with excerpts or inline transcripts, optional `facets[]` and a `narrative`. It doubles as the serialization that pulls specific chats' content into another repo.

**Stage** is the transport behind the 🗂️ `#stage=` link. It is no longer a schema of its own: a stage item is a surface item's `target.source` triple (`{repository, ref, path}`) with the annotations empty, so the stage and the surface share one item grammar.

**Data view** is the plain case, and the only member a caller can skip entirely: a `#data=` toss accepts bare bytes (a CSV, a JSON array, a log) as readily as an `items` envelope, and [`lib/kits/data-payload.js`](../../lib/kits/data-payload.js) tells them apart rather than asking. Its envelope carries no roles, context, or profile, only what bare bytes cannot express: several files at once, and a default view and note per item.

**Shorter** is the narrowest: two strings rather than a set of items, so it is the one member that is not a collection. It earns its place by following the same rules, which is the point of listing it here: the `owner/repo[@ref]:path` address, the `#gz=`/`?src=` split, and a narrow bare-or-envelope discriminator in [`lib/kits/shorter-payload.js`](../../lib/kits/shorter-payload.js) modeled directly on data-view's. Bare text is the common case and needs no wrapper; the envelope exists only to carry a shortening someone already produced, so a link can open straight into the adjudication view.

**Workbook extract** is the family's first **profile over data-view**, and the
one member that adds a schema to a parent that has none. Its items are data-view
items, so it renders in `pages/data-view.html` unchanged; what it adds is
provenance, the one thing data-view deliberately does not carry. The reasoning,
the same three tests as the chat-results decision below reaching the opposite
answer, is in
[`workbook-extract.md`](workbook-extract.md#why-this-is-a-profile-over-data-view-rather-than-a-sibling).
A profile over data-view needs no change to
[`lib/kits/data-payload.js`](../../lib/kits/data-payload.js), whose discriminator
is structural rather than a `kind` check, so a superset kind is already admitted.

## Membership

A format is a member when three things hold: a producer (a skill or a script) writes its files, a shared web-tools page renders them, and they travel by the family's transport, an `owner/repo[@ref]:path` address read as `src` or the whole file carried as `#gz=`. Its contract lives here, with a schema under `schemas/` where one exists, even when the producer lives in another repo. Its renderer lives under `pages/`, with a toss route in [`docs/routes-routes.csv`](../routes-routes.csv) when it travels by link. The contract names the producer and the renderer; the producer names the contract and the link it hands over.

The family is indexed by format, not by page, because a page can be replaced while its format stays and one page can render two formats.

Not members: utility pages ([`docs/tools.csv`](../tools.csv)), subject pages ([`docs/subjects.csv`](../subjects.csv)), app views ([`docs/app-routes.csv`](../app-routes.csv)), and renderers bundled with their producer, such as the show-diff skill's template. Four formats with renderer pages are not yet listed: `approval/1`, `inquiry/1`, `user-call/1` and the idea board.

## The decision: chat-results stays a sibling

Chat-results is not a `chat-results/1` profile over the surface core but a peer schema that shares only delivery mechanics. Decided 2026-08-02: **sibling.** The family is one core schema with profiles for file-shaped curation, plus chat-results as a peer, and the shared layer is the transport conventions (the `owner/repo[@ref]:path` address, the `#gz=`/`?src=` split, live-code rendering) and the ref triple.

Three reasons, in order of weight:

1. **The shapes differ structurally, not cosmetically.** A chat result carries message arrays (`excerpts[]`, `transcript[]`, each `{role, md, ts?}`), which the surface item has no slot for: `content` and `snippet` are strings. And chat-results facets are many-to-many (`members[]`, one result in several groupings) where the surface `facet` is a single section key per item. A profile can constrain the core; it cannot restructure it, so `chat-results/1` would push the entire payload into open `metadata` and buy one validator in name only.
2. **The convergence that matters already happened.** A result's `source {repo, path, ref}` is the same ref triple as the surface's `target.source` and the stage item; that is what lets one envelope's items point where another's do. Nothing further is gained by unifying the wrapper around it.
3. **No concrete need is asking.** A mixed surface holding files and chats is covered by the existing posture ("each reader reads every kind, authors the kinds it knows"): a surface can hold a `type: chat` item whose `target.source` addresses the chat file, with no change to either schema.

Revisit when a real mixed-envelope need arrives that the `type: chat` posture cannot carry.

## Provenance

The repos that produce these formats outside web-tools (home's Surfacer app, `projects/surfacer/`; the `chat-histories` search skill, whose envelopes are that repo's `results/*.json`) defer the contract to this folder.
