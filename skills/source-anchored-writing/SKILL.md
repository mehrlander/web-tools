---
name: source-anchored-writing
description: Generates documents where every factual claim is visibly anchored to a specific source, or explicitly flagged as unsupported, in the manner of a heavily contested encyclopedia entry. Fires only on an explicit request such as "include sources," "add footnotes," "cite where this came from," "I need to back this up," "no hallucinations," or a direct ask to source a document. Do not infer the need from stakes alone. A plain request to summarize, draft, explain, or write, with no request to source it, is not a trigger. Do NOT use for casual chats, brainstorming, or routine updates.
---

# Source-Anchored Writing

## Objective

Provenance over truth. The deliverable embeds its own audit trail through dense, inline citations: the reader never has to guess where a fact, figure, or claim came from. The enemy is the plausible hallucination dressed up as a sourced fact. There is one document, not a clean copy plus a private audit. The citations are the texture of the deliverable, not scaffolding to strip.

## This fires on request, not on a hunch

The explicit ask is the trigger. If the user asks for a summary, draft, or any ordinary piece of writing and does not ask to source it, this is not the mode they want, even when the topic is weighty. Do not decide on their behalf that a document needs it. When they want claims anchored they will say so.

## Two-pass method

Do not draft and audit at once. The drafting voice waves weak claims through on momentum.

1. **Draft.** Write naturally, prioritizing good prose and clear structure.
2. **Audit cold.** Segment every sentence into discrete factual claims. Assign each a provenance state and attach its citation.

## What counts as a claim

The audit fails the moment Pass 2 skims past a claim without noticing it is one. The obvious claims announce themselves: a figure, a date, a dollar amount, a named quote. The ones that slip through hide in plainer prose:

- **Characterizations stated as fact.** "The troubled program" asserts trouble. "The largest fund" asserts a ranking.
- **Attributions.** "X said Y" is two claims: that X said it, and, if you assert Y as true, Y itself.
- **Causal and sequence links.** "Because," "led to," "after which" assert a relationship the source may not.
- **Superlatives and firsts.** "Only," "first," "largest," "unprecedented" are claims, and the easiest to wave through.
- **Numbers buried in prose.** A percentage or count inside a sentence is as checkable as one in a table.

A claim you never isolated is a claim you never anchored. (This noticing is the one piece of professional fact-checking tradecraft the skill borrows, drawn from the Truth in Journalism (TiJ) guide. The rest of that craft, grading source reliability and corroboration, is verification, a different job.)

## Provenance states

Evaluate every discrete claim (figures, dates, specific assertions). Opinions, framing, and transitions are not claims.

| State | Definition | Citation action |
|---|---|---|
| **Quoted** | Reproduces a source's exact words. | Cite the specific location, include the quoted text. |
| **Supported** | Paraphrases something a source directly states. | Cite the specific location. *Cold-read rule: if you cannot produce a direct quote that backs the paraphrase, it is not Supported.* |
| **Inferred** | Combines or extrapolates across sources to produce something none states outright. | Say so in the note: "Inferred from [A] and [B]. No source states this directly." |
| **Unfiled** | Asserted by the user in chat, or genuine common knowledge. | Name the origin: "from the user, in conversation" or "common knowledge, no source." |
| **Unsupported** | No backing of any kind. | Flag it inline with `[citation needed]`. Never invent a source, hedge the phrasing into deniability, or quietly drop the claim. |

Surfacing the unsupported claim is the whole point of the skill. A reader is far better served by a visible flag than by a confident sentence that turns out to be air.

## The line the skill turns on: Inferred vs Supported

Restatement stays Supported. Stitching crosses into Inferred. Hold this precisely, because the inferred sentence reads exactly as sourced as the supported one.

- *Source:* "OneWA released $4.2M in Q3." *You write:* "OneWA's Q3 release was $4.2M." **Supported.** Same fact, reworded.
- *Source A:* "OneWA released $4.2M in Q3." *Source B:* "Q3 releases recur each biennium." *You write:* "OneWA will release $4.2M again next biennium." **Inferred.** No source says that. You built it from two that say less.

When two true facts produce a third nobody stated, the third is yours, and the note says so.

## Anchoring precision

Never anchor to a document in general. A reader should be able to verify the claim in under a minute.

- **PDF or report:** page number, plus section heading or a short anchor quote.
- **Web page:** URL, plus the heading or a short anchor quote.
- **Spreadsheet:** sheet name, plus the specific cell or range.

For the mechanics of placing footnotes or endnotes, follow the relevant document skill (docx and so on). The references section will be long. That is correct.

## Guardrails

- **Over-cite.** Generosity is required. Three distinct claims in a sentence take three distinct citations. Do not use one decorative footnote at the end of a paragraph to cover mixed claims.
- **Web is welcome.** Using the web to find sources is fine and often the point. Reach for backing where needed.
- **Tone.** Matter-of-fact, not alarmed. Never apologize for flagging an unsupported claim. Exposing the gap is the skill working as intended.
