---
name: docent
description: "Write a docent note: the one line a reader meets before the thing it introduces, such as a look link's say= or intro= card, a reply's closing-state line, or a thread title in a PR guide. Use whenever a session writes one of these. The note names the target, the reason it is shown and the one point to notice, in as few words as those three need; the docent-critic agent reviews it before it goes out."
---

# Docent

## Premise

A docent note is the one line a reader meets before the thing it introduces: the card on a [look link](../look-markers/SKILL.md), the [closing-state line](../../docs/CONVERSATION.md#every-reply) that ends a reply, or a thread title in a [PR guide](../../docs/CONVERSATION.md#a-reply-that-changed-files). The reader is the owner, arriving from other work and about to judge or act.

A note fails when it runs long, or when it drops articles, verbs and qualifiers until the reader has to reconstruct it. Aim for the shortest note that is still [qualified writing](../../docs/QUALIFIED-WRITING.md).

## What a note answers

A note answers three questions, in this order, and skips any the surface already answers.

1. **Why is this in front of me?** Lead with the reason when the surface does not give it. For a target the owner asked to see, lead with `By request:`. A closing-state line's glyph and bold lead already give the reason.
2. **What is it?** Name the thing as the reader knows it, plus the one qualifier that sets it apart from its neighbors: the branch, the version, draft or merged, which of several.
3. **What should I notice or do?** Give the single point the reader would otherwise miss: where the change is when the page looks the same, the control to tap, the decision asked.

## What to cut

- **What the target shows.** Describing the page under a card, or the reply above a closing-state line, repeats it.
- **The route.** Leave out what the session opened, tried or checked on the way.
- **Later steps.** A step that waits on a merge or another session belongs in the reply or the PR guide, unless it is the action asked of the reader.
- **A second point.** Split a note with two things to notice into two notes, or a walkthrough of two steps.

Keep the grammar: "It looks unchanged", not "Looks unchanged". Keep the qualifier against a likely misreading, such as branch or live. Keep what the reader needs to act, such as a link, a PR number or a named control.

## Length

| Surface | Holds | Aim |
| --- | --- | --- |
| `say=` card | one step's point | 8 to 20 words |
| `intro=` card | what the whole link shows, and why | up to 15 words |
| Closing-state line | the state's content, after its bold lead | up to 25 words |
| PR guide thread title | the thread's subject, as a noun phrase | 2 to 5 words |

## Example

A look link's card on the session page, which the owner had asked to see:

- *Before (40 words):* "The session page as it stands on the fix branch, opened at this session. It looks the same as the live page. The fix shows only when a link moves to another session, which you can try once #1484 merges."
- *After (19 words):* "By request: the fix branch's session page. It looks unchanged; the fix shows when a link opens another session."

## Review

Run the [`docent-critic`](../agents/docent-critic.md) agent on each look link's cards, in one call per link, and on a closing-state line that runs past its aim. Give it the surface, the reason the reader is being shown the target, and what the target shows. Revise until it returns PASS.
