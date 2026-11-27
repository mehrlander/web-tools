---
name: orienting-notes
description: "Write an orienting note: the one line a reader meets before the thing it introduces, such as a look link's say= or intro= card, a reply's closing-state line, or a thread title in a PR guide. Use whenever a session writes one of these. The note says what the reader is looking at and why, in the fewest words that leave nothing to guess; the orienting-note-critic agent reviews it before it goes out."
---

# Orienting notes

## Premise

An orienting note is the one line a reader meets before the thing it introduces: the card a look link shows on a page, the closing-state line that ends a reply, a thread title in a PR guide. Its reader is the owner, arriving from other work, about to judge or act. The model is an usher who shows a visitor into a busy principal's office and orients the principal in a sentence, wasting no word and leaving nothing to guess.

A note can fail in two directions. A long note restates what the page shows or narrates how the session got there, and at forty words it already reads as a wall of text. An over-compressed note drops articles, verbs and qualifiers until the reader has to reconstruct it, which [Qualified writing](../../docs/QUALIFIED-WRITING.md) already argues against. The target is the shortest note that is still qualified writing.

Family: writing support.

## What a note answers

A note answers three questions, in this order, and skips any the surface already answers.

1. **Why is this in front of me?** Lead with the reason when the surface does not give it. For something the owner asked to see, lead with `By request:`. A closing state's glyph and bold lead already give the reason, so its line starts at the second question.
2. **What is it?** Name the thing as the reader knows it, plus the one qualifier that sets it apart from its neighbors: the branch, the version, draft or merged, which of several.
3. **What should I notice or do?** Give the single point the reader would miss alone: where the change is when the page looks the same, the control to tap, the decision asked.

## What to cut

- **What the target shows.** A card sits on its page, and a closing line follows its reply. Describing either repeats it.
- **The route.** Leave out what the session opened, tried or checked on the way.
- **Later steps.** A step that waits on a merge or another session belongs in the reply or the PR guide. Keep it in the note only when it is the action asked of the reader.
- **A second point.** A note with two things to notice is two notes, or a walkthrough of two steps.

## What to keep

- **Grammar.** Keep articles, verbs and whole sentences: "It looks unchanged", not "Looks unchanged". Avoid arrows, slashes, and abbreviations the reader has not been given.
- **The qualifier against a likely misreading.** Branch or live, shown or inferred, "about 60%", "the only policy left" rather than "the last policy".
- **What the reader needs to act.** A link, a PR number or a named control stays, in the forms [CONVERSATION.md](../../docs/CONVERSATION.md) gives.

## Length

| Surface | Holds | Aim |
| --- | --- | --- |
| `say=` card | one step's point | 8 to 20 words |
| `intro=` | what the whole link shows, and why | up to 15 words |
| Closing-state line | the state's content, after its bold lead | up to 25 words |
| PR guide thread title | the thread's subject, as a noun phrase | 2 to 5 words |

A count above the aim is a reason to look again, not a failure. A count below it does not excuse a missing qualifier.

## Example

A look link's card on the session page, which the owner had asked to see:

- *Before (40 words):* "The session page as it stands on the fix branch, opened at this session. It looks the same as the live page. The fix shows only when a link moves to another session, which you can try once #1484 merges."
- *After (20 words):* "By request: the session page on the fix branch. It looks unchanged; the fix shows when a link opens another session."

The rewrite drops the route ("opened at this session") and the later step ("once #1484 merges"), and keeps the branch and where the change lives.

## Review

Run the `orienting-note-critic` agent on each look link's cards, in one call per link, and on a closing line that runs past its aim. Give it the surface, the reason the reader is being shown the target, and what the target shows. Revise until it returns PASS.
