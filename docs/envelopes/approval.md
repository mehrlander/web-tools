# The approval envelope

An `approval/1` surface asks for a **decision**, and it is the only envelope here whose reader is expected to refuse. Every other one carries content to a reader and ends there. [`inquiry/1`](surface.md) added a return leg, so answers come back. This adds the two things a decision needs that an answer does not: a verdict for the whole set, and a reason the author owed **before** asking rather than in response to being challenged.

It exists so a proposed edit arrives in a stylized form for efficient review and approval.

**Authoritative artifact:** [`schemas/profiles/approval-v1.schema.json`](schemas/profiles/approval-v1.schema.json). A document claiming this profile validates against it **and** against the core [surface v2](schemas/surface-v2.schema.json) schema.

## The three files

An approval is a request, a verdict, and a citation, and keeping them separate is what makes the gate checkable.

| | Written by | Lands at | Says |
| --- | --- | --- | --- |
| **request** | the session | `<reply_to>/<id>.request.json` | here is what I propose, and why |
| **verdict** | your browser, through your token | `<reply_to>/<id>.verdict.json` | approved, approved with edits, or returned |
| **citation** | the session | `Approved: <id>` in the commit message | the decision this commit rests on |

The gate reads the citation, resolves it to the verdict, and checks three things: the verdict exists, its decision is an approval, and the paths this commit touches are among the ones it names. Nothing about the request is trusted at gate time; the request is what you read before deciding, not what authorizes anything.

## The two kinds

`context.kind` picks which questions the author owed and which the page renders. Two values because two gates exist. A third belongs here when a third gate does, not before.

**`documentation`.** Items are files. Each carries its `change.patch` from the compare API, so the page mounts the same `fileReview` card [`pages/review.html`](../../pages/review.html) mounts, with CM6 split and unified diffs and word-level highlights. Each item's `commentary` says what the edit changes about what the document *claims*, which is the question a reader of a governing document actually has. `related[]` names the other documents the edit answers to, so the change is read against what already owns the subject.

**`task`.** Items are proposed tracker tasks. The diff pane is empty and one extra field is required, `metadata.deferred_because`: why this cannot be finished in the session proposing it. A task that could be done now and is filed instead has traded a deliverable for a record of a deliverable. That trade is sometimes right. The field is where it has to be defended, and a proposal that cannot fill it is one that should have been work.

## Addressing and rendering

[`pages/approve.html`](../../pages/approve.html) renders a request, using the same grammar every envelope here uses:

```
#src=owner/repo[@ref]:path        fetch through the viewer's stored token
#gz=<base64url gzip>              carry it inline, for a token-less reader
```

Both also read from `?query`, for a context that strips fragments.

**A framed approval is a broken approval**, for the reason `inquiry.html` states: the return leg needs the page's own origin and the viewer's token, and a sandboxed frame has neither. The page detects the frame and offers its direct address instead of failing at the moment of decision.

## What comes back

The verdict is one JSON file, appended rather than mutated, because a decision is a fact about a moment:

```json
{
  "id": "2026-09-16-marker-gate-docs",
  "decision": "approved",
  "decided_at": "2026-09-16T21:04:11Z",
  "paths": ["docs/SNAGS.md", ".claude/skills/markers/SKILL.md"],
  "notes": [
    { "item": "p2", "anchor": "a dated file stays put", "note": "drop this clause, it reads as the file being dated" }
  ]
}
```

`decision` is `approved`, `approved-with-edits`, or `returned`. The first two pass the gate; `returned` fails it and the notes are the reason. `paths` is what the gate checks a commit against, and it is written by the page from the request rather than typed, so the decision covers exactly what was shown.

`notes` is the annotator's output, pinned to selections in the diff. It is the same note set [`kits/annotate.js`](../../lib/kits/annotate.js) produces elsewhere, carried on the verdict rather than saved as its own jot, since here a note is part of a decision rather than a standalone reading.

## The other route, and why it stays

Approval does not have to go through the page. Saying so in chat works, on one condition: **the approval must name what it covers.** "Go ahead" does not. "Go ahead including the proposed documentation edits" does. When approval arrives that way the trailer quotes those words instead of citing an id, and the gate accepts the quotation, since it has nothing to resolve it against.

That route is weaker on purpose and it is not going away. The page is worth using when a change deserves reading; a sentence is right when you already know what is proposed and want it done. What neither route permits is a general delegation stretched to cover a specific act, which is the failure both gates were built for.
