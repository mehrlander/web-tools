---
name: doc-craft
description: Revise documentation so each edit serves its critical objective and keeps the whole system recognizable, navigable, and maintainable.
---

# Doc Craft

Documentation guides a living system. Its value is direction and insight for completing tasks; its costs are attention and upkeep. Misfires can be costly and hard to discern.

Restraint is vital for any edit. Advice for entering a newsgroup or an open source project applies. Read the whole doc, and related docs. Identify the critical objective of any edit, and the minimal route to achieve it while keeping the whole recognizable, navigable, and maintainable.

Content should only be included where behavior depends on it. For a basic test: If we expect the assistant to succeed without it, leave it unsaid.

## General Principles

- **Consider the context**: Read the entire file and adjacent files before changing a part, to ensure that any change is aligned and exactly where it should be.
- **Open with the premise**: A document's first paragraph says what the document is for and who reads it, before any definition or mechanism. When an edit touches a document whose opening lacks a premise, say so in the review rather than widening the edit.
- **Integrate explanations**:  Prefer editing an existing sentence, parameter entry, or bullet to adding a section.
- **Earn each sentence**: If material can be removed and it is unlikely to affect future assistant behavior, it likely should be.
- **State current reality**: Omit debugging narratives, discovery steps, and authoring commentary.
- **Retain actionable rationale**: Include reasons only when they directly clarify intent, and then as minimally as possible.
- **Describe with a purpose**: Describe a mechanism only to state an insight or to tell the assistant about behavior it needs.
- **Format non-obvious restrictions**: State the trigger condition, failure symptom, and required mitigation.
- **Be concrete**: Name exact files, commands, flags, components, and actors.
- **Hedge**: Use careful, precise language. Prefer "avoid" or "do not" over "never".
- **Verify continuity**: Confirm that removals or edits do not break prerequisites, cross-references, or transitions.

## Review

Check changes against the principles above, make any needed revisions, and commit them on a branch. Then run the `portable:peeves-critic` agent on each changed document and fix what it finds, until a run returns PASS, and say how many runs that took.

Each changed document then goes to the owner as a user call of kind `documentation`, one per document, each edit with its background, its proposal and, where it fixes wrong text or poor wording, a `correct` or `clarify` note, filed with [`user-call.py`](https://github.com/mehrlander/web-tools-private/blob/main/user-calls/user-call.py); a document the main branch does not hold yet is marked new, as that script's documentation kind describes. The chat message offers all of them in one link that opens the deck of calls on the [session page](https://github.com/mehrlander/web-tools/blob/main/pages/session.html) at the first, `pages/session.html#id=<short>&user-call=<slug>`, where `<short>` is the session id's first eight characters; the reader swipes from each call to the next.

Revise on request, and merge only after the owner approves the wording. Approval covers documentation, the four places of [principle 5](https://github.com/mehrlander/web-tools/blob/main/docs/CONSTELLATION.md#principle-5-documentation-has-four-places-and-everything-else-is-a-question), including a doc of dated measurements. It does not cover an account: research a repository declares in `.web-tools.json`, its README included, or a record, which preserves a moment.
