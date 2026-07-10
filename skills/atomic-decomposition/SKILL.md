---
name: atomic-decomposition
description: Break a document into the claims it makes, tagging what kind of commitment each one is (stated fact, assumed existence, implied causation, opinion) and linking it back to the text it came from. Useful when someone wants to inventory what a piece of writing actually asserts, including what it asserts without saying, or wants a structured pass over a document too large to hold in the head at once before editing or fact-checking it. Concerns decomposition into claims, not summarizing or rewriting.
---

# Atomic Decomposition

## Objective

Turn running prose into a structured list of the claims it makes. Each claim is stated plainly as a standalone proposition, tagged by what kind of commitment it is, and linked back to the text it came from. The goal is to inventory what the document asserts, including what it asserts without saying. You are not checking truth. A claim goes on the list whether it is true, false, or unfalsifiable.

This is a decomposition tool, not a fact-checker. The factuality literature it draws from decomposes in order to verify, and so it discards anything not checkable. This skill keeps the decomposition and drops the verification motive, which widens the net: an opinion is as much a thing being said as a statistic, so it stays.

## A claim is produced, not located

Two different objects are in play, and conflating them is the central error. There is the **span**, a stretch of the source text. And there is the **claim**, a proposition you state, in your own words, that the span gives rise to. The span is found. The claim is distilled. They are not the same, and the relationship between them is not always lifting words out:

- Sometimes the claim is essentially in the text and you restate it plainly. "launched in 2019" becomes "The program launched in 2019."
- Sometimes the claim is underneath the text, presupposed by it but stated nowhere. "The reserve" presupposes that a reserve exists, a claim no contiguous span contains.
- Sometimes the claim comes from the arrangement of spans, not from any one of them. Two events placed in sequence can assert that one caused the other.

So every entry carries both: the `span` it anchors to, and the `claim` as you have stated it. When the claim is presupposed or structural, the span points at the trigger, the definite phrase or the pair of clauses, even though the claim itself is not written there.

## Claim types

Each claim gets one `type`. The four mark genuinely different ways a text commits, and three of them catch things a plain reading nods past.

- **stated.** A fact asserted on the surface. Checkable in principle. The default, and most claims are these.
- **existence.** The presupposition, carried by a definite reference, that some entity or event is real. "The actuary," "the fee increase," "the program" each assert *this thing exists* without ever predicating it. This is the most hidden type, because it never appears as a sentence: the document leans on the thing without ever asserting it outright. Subject to the load-bearing threshold below.
- **causal.** Asserts that one thing brought about another. Flagged as its own type because prose smuggles causation constantly through juxtaposition or a soft connective ("following," "led to," "after which," "in the wake of") while looking like mere sequence. The causal claim is the one a reader absorbs without noticing it was a claim. When the cause is implied by arrangement rather than stated outright, mark the entry `implied: true`, so the sequence-versus-cause question stays queryable.
- **evaluative.** A judgment the text commits to. "Well run," "the best account," "a troubled program." Not checkable against a source, which is why verification pipelines discard it, but fully a thing being said, so it is kept.

Chronology is deliberately not a type. "X happened, then Y happened" wears its temporal claim on its surface; it is a stated claim, not a hidden one, and needs no special tag. Causation is flagged precisely because it looks like chronology and asserts more.

## Stated vs evaluative: split the fused phrase

This is the fuzziest call in practice, the type-system equivalent of the grain problem, and prose makes it constantly. Pure cases are easy: "the program ran three years over schedule" is stated, "the troubled program" is evaluative. But most phrasing fuses them, a judgment wrapped around a factual core: "the program struggled with delays" asserts both that there were delays (stated) and that this amounted to struggling (evaluative).

Do not tag the fused phrase as one or the other. Split it, the same way a sentence bundling four facts gets split:

- *"The program struggled with delays."* -> **stated:** "The program experienced delays." **evaluative:** "The program's delays amounted to struggling." 

The factual core and the judgment are separate commitments and a reader can accept one while rejecting the other. Tagging by "dominant commitment" would collapse them and lose whichever one lost, usually the buried stated fact, which is exactly the content the inventory exists to surface. When a phrase genuinely carries only a judgment with no factual core ("a fine result"), it is simply evaluative, no split needed.

## The load-bearing threshold for existence

Presuppositions are unbounded. Every definite phrase technically presupposes existence, and most are trivially carried and not worth recording. The threshold is **text-internal**, a question about how the prose treats the thing, not about whether the thing is real. Surface an existence claim when the document **leans on** the entity: refers to it as established, builds later claims on it, treats it as given rather than mentioning it in passing. "A Fund 600 reserve exists," yes, because the document refers to the reserve as a settled fact and hangs figures on it. "The year 2019 exists," no, because nothing rests on it as a contestable entity; it is just a date.

This is a judgment call, like the grain, so apply it the same way each time: flag the existence of entities and events the document treats as load-bearing, not the existence of common nouns and calendar machinery. Whether a load-bearing entity turns out to be real is the next step's question, not this one's. This step only marks that the document is committed to it.

## The one decision that governs consistency: grain

Everything that makes this inconsistent run to run is grain. How small is a claim. The same sentence can yield one claim or four, and across published methods the count per document swings by half depending on whose rule you follow. So the grain is fixed up front and held the same every time.

The target is **not the smallest possible claim.** A claim broken to its atoms loses the context that lets it be interpreted, and a bare fragment like "won a medal" attaches to the wrong subject the moment it leaves its paragraph. The target is the **smallest claim that still stands on its own.** Two criteria set the level:

- **Stands alone.** Read in isolation, with no surrounding text, the claim must point unambiguously to the right entities, events, and context. A pronoun with no referent fails this. So does a name that could be three different people.
- **Minimal.** Add as little as possible to make it stand alone. Every extra detail you fold in is a detail that must independently hold, and it narrows the claim to fewer supporting contexts. Add what disambiguates. Stop there.

These two pull against each other on purpose. Standing alone wants more context; minimal wants less. The claim sits where they balance: self-sufficient, nothing spare.

Type is orthogonal to grain. Grain decides how small one claim is; type labels what kind of commitment that claim is. A single entry might be a causal claim at the chosen grain. Decide the grain first, tag the type second.

## Method

Work strictly local, sentence by sentence, paragraph by paragraph. This is what lets you decompose a long document without holding all of it at once: each sentence is processed against its own paragraph for context, not against the whole.

1. **Split into sentences.** Keep citations, references, and parenthetical asides whole. Do not let a reference like "(Smith et al., 2023)" shatter into fragments.
2. **Find the claims in each sentence.** A sentence usually makes several. Pass over it for each type: what does it state, what does it presuppose into existence (above threshold), what does it assert causally, what does it judge. Each claim you pull out should be a single proposition, not a bundle of several.
3. **State each claim plainly and make it stand alone, minimally.** Distil the proposition in your own words. Resolve pronouns and partial names using the paragraph as context. Add the least disambiguating detail needed, no more.
4. **Tag and anchor.** Give each entry its `type` and its `span`. For presupposed or structural claims the span points at the trigger.
5. **Process every sentence.** A sentence that yields no claim contributes no entry, and that is a correct result, not an omission. Move on without forcing one out of it.

## What a single stated claim looks like

A claim is a single proposition, something that could be marked true or false on its own. The canonical illustration: "Thierry Henry, born 17 August 1977, is a French former football player and pundit" yields four of them. *Thierry Henry was born on 17 August 1977. Thierry Henry is French. Thierry Henry is a former football player. Thierry Henry is a football pundit.* Each is singular and stands alone. The sentence bundled four; the decomposition separates them.

## What counts as a claim

The obvious ones announce themselves: a figure, a date, a dollar amount, a named quote. These categories catch the ones that hide in plainer prose:

- **Characterizations stated as fact.** "The troubled program" asserts trouble. "The leading vendor" asserts a ranking. (Often `evaluative`.)
- **Attributions.** "X said Y" is potentially two claims: that X said it, and, if Y is asserted as true, Y itself.
- **Causal and sequence links.** "Because," "led to," "after which" assert a relationship the prose may be smuggling in. (Often `causal`.)
- **Superlatives and firsts.** "Only," "first," "largest," "unprecedented."
- **Definite references.** "The reserve," "the agreement." Each presupposes its subject into existence. (Often `existence`.)
- **Numbers buried in prose.** A percentage inside a clause is as much a claim as one in a table.

## Standing alone, minimally: worked examples

The grain lives in examples more than in rules. Hold these as the calibration.

- *In context:* "He served in the National Guard." -> **Stands alone, minimal:** "Kenneth Holland served in the National Guard." Pronoun resolved, nothing added. *Too much:* "Kenneth Holland, born November 24 1934 in Hickory, former U.S. Representative from South Carolina, served in the National Guard from 1952 to 1959." Now the claim drags four extra facts that each have to hold, and it will fail to match an evidence context that confirms only the service.
- *Ambiguous subject:* a paragraph about a "David Heyman." -> "David Heyman, the film producer, founded Heyday Films." The descriptor is added because the name alone is ambiguous, and it is durable and widely attested. Profession disambiguates with one phrase. Birthdate would over-specify.
- *Necessary addition:* "All taxes must be paid by April 15." -> "In the US, all taxes must be paid by April 15." The added context is not padding. Without it the claim is not interpretable, so it is the minimal move, not a violation of minimality.

The rule under all three: add a detail only when its absence leaves the line ambiguous, and prefer the disambiguating detail that the most sources would attest.

## The trap: decontextualization re-bundles

This is the documented failure mode, and it is where the work goes wrong quietly. Making a fragment stand alone tempts you to fold in a second fact, and now the entry is no longer one claim. "The album was released in 2018" becomes "The 'Blackpink in Your Area' compilation album was released in 2018," which has smuggled in a second claim: that the album is a compilation. The entry now reads as one assertion but carries two, and anyone checking it cannot tell which part failed.

Hold the line: resolve references, but do not annex neighboring facts. If standing alone seems to require a second full claim, that is a signal the two were never separable, and they stay as one entry marked `composite`, rather than one entry pretending to be atomic.

## Composite vs singular: the call you will keep facing

The grain is a choice, not a discovery, so this is the one judgment the procedure cannot remove. It can only make it repeatable. "She was a medallist at the European Championships in 1986" can be kept as one claim or split into three: that she medalled, the venue, the year. There is no universal right answer, only a consistent one.

The rule: **keep facts in one entry when they form a single event reported together, split them when each is independently checkable and independently interesting.** A date or venue bound to an event stays with it. A fact that could be true while the others are false gets its own entry.

The paired call, on the medallist sentence:

- *Kept whole:* "She was a medallist at the 1986 European Athletics Championships." Defensible because the medal, the event, and the year describe one occasion. Checking it means checking one thing: did this happen.
- *Split:* "She won a medal at the European Athletics Championships." / "The medal was won in 1986." Defensible when the year is contestable on its own, so the achievement could be real while the date is wrong, and you want the date to fail independently.

Pick one reading of "event reported together" and apply it to every sentence in the document. The inventory stays comparable only if the same call is made the same way throughout.

## Output

The stored format is a flat list of claim objects, in document order. This is the canonical artifact, because it is data: a later step can join it to the source to compute repetition, claim density, or an existence checklist, and can render it as an inline-footnoted document on demand. Storing the structured object and rendering the footnoted view from it is the right direction; parsing footnotes back into structure is the wrong one.

Each object:

The flags answer separate questions and do not constrain each other: `type` is the kind of commitment, `implied` is whether the claim is surfaced or hidden (it cuts across types, though in practice it lands mostly on causal and existence), and `composite` is a grain note marking an entry that holds more than one fact on purpose. A claim can be any combination.

```json
{
  "id": 4,
  "sent": 1,
  "span": "Following ... recovered the next quarter",
  "type": "causal",
  "claim": "The fee increase caused disbursements to recover.",
  "implied": true,
  "composite": false,
  "note": "carried by 'following', no stated 'because'"
}
```

- `id`: stable integer, claim order.
- `sent`: index of the source sentence. Anchor by sentence index plus `span`, not by character offset; offsets break the moment the source is edited, and this list is meant to be stored and re-read.
- `span`: short anchor phrase into the source. For presupposed or structural claims, the trigger.
- `type`: one of `stated`, `existence`, `causal`, `evaluative`.
- `claim`: the proposition, stated plainly, standing alone.
- `implied`: true when the claim is carried by arrangement or presupposition rather than stated outright, chiefly for smuggled causation. Lets a downstream step filter for the hidden claims without parsing prose. Omit or false otherwise.
- `composite`: true only for the held-together case above. Omit or false otherwise.
- `note`: optional free text, for genuine observations not captured by a field.

For a human reading rather than a downstream process, render a plain numbered list of the `claim` fields, optionally grouped by `type`. No verdict or support field appears here. Marking truth is verification, a separate job that operates on this output and adds its own field.

## Guardrails

- **Inventory, do not edit.** This skill produces the list. Cutting comes after, as a separate pass that works from the list. Do not rewrite the source here.
- **What's said, not what's true.** Every claim is recorded regardless of truth, including opinions and claims that turn out false. The point is to surface what the document commits to.
- **Hold the grain, and hold the threshold.** Two judgment calls drift as you tire: the grain creeps finer, and the existence threshold creeps toward listing presuppositions the document never actually leans on. Re-read the worked examples mid-document if either starts slipping.
