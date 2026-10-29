# Discovering information structure

Working synthesis, 2026-10-28. The immediate goal is an inspectable JSON model
that helps a reader understand a subject. The modeler chooses the schema.
The subject may be a collection, a particular instance, a person's activity,
an ongoing process, or a body of knowledge.

The proposed improvement is to discover scope and internal structure together.
Examples can expose a poor scope choice as well as a poor schema. The two-source
pilot below now exercises those steps, with its requests and original responses
preserved for direct inspection.

## Findings from the JSON trials

The four [saved maps](object-map-review.html#map=1) preserve their requests,
original JSON, examples, and draft or revision status.

| Observation | Implication for the process |
|---|---|
| Asking for a conceptual sketch with two examples produced inspectable models. | Specify the kind of deliverable and exercise the structure with a small population. |
| The question-led map chose three core object types; two fresh conceptual drafts chose five. | Reader questions expose the reasons for a schema. Object count alone does not settle which model serves the purpose. |
| The revision connected Ryu's current House seat with her Senate candidacy, retaining the same five object types. | A consequential relationship can improve the explanation without adding object types. |
| The revision replaced its earlier examples with the linked races. | Preserve the cases used to assess a revision, or state which coverage was lost. |
| The requests fixed the purpose as understanding and comparing races in one article. The compact maps mainly organized contests and candidates. | The trials provide limited evidence about discovering activity within a campaign, a recurring election process, or a different scope. |

The swipe deck supports direct review, with a shared tab selection across
independent proposals. Its diagrams currently use adapters for the four saved
schemas; the deck has not established a general renderer for arbitrary JSON.

## Scope and evidence

A scope states what the reader is trying to understand, the unit of attention,
the relevant extent in time or space, and the boundary of the inquiry. A topic
such as an election permits several scopes: comparing contests, examining one
campaign, following election administration, or comparing recurring cycles.

The supplied material has its own coverage. A campaign model may identify
fundraising activity as important while the article supplies only one claim
about an early fundraising leader. A useful proposal can identify that
structure and the missing information. Populated facts must remain grounded
in the material.

The earlier [page-building method](method.md#half-two-project) already calls
for a governing question and a root. The proposed change brings that choice
before entity selection and revisits the choice as the model develops.

## Proposed discovery process

1. **Propose a scope.** Use the stated reader purpose. If the purpose is
   underspecified, make the reader assumption visible. Give a provisional
   scope, its benefit, and one consequential alternative.
2. **Investigate the chosen subject.** Look within the scope for meaningful
   objects, groupings, activities, events, states, sequences, flows,
   distinctions, and relationships. Examine recurring patterns and particular
   instances where relevant. Include structures because they reveal something
   useful; the directions in this list are prompts for exploration.
3. **Demonstrate the model.** Populate two small examples that exercise
   different structural choices. Keep source facts, interpretations, proposed
   extensions, and unknowns distinguishable. Identify what the examples leave
   untested.
4. **Challenge the scope and structure.** Find a consequential case that the
   model obscures, conflates, duplicates, or handles awkwardly. Revise where
   warranted, including the scope when necessary. Preserve the draft and
   assessment cases; account for any case dropped from the revision.
5. **Explain the resulting insight.** Name one relationship or comparison
   that the proposed structure helps a reader see. Point to the example that
   demonstrates the benefit. A brief statement of a useful view can accompany
   the model; page layout and HTML follow later.

Keep the model's scope provisional throughout these steps. An example that
requires unexplained connections outside the chosen boundary is a reason to
reconsider the boundary. An unused object or distinction is a reason to
reconsider the schema.

## Request for the next trial

Supply the reader purpose and source material after this request. The source
and request are kept with each original response.

```text
Develop a concise information model that would help the intended reader
understand this subject. Choose your own JSON schema.

First propose a useful scope and explain its benefit to the reader. Consider
one consequential alternative. Distinguish the scope of the inquiry from the
coverage of the supplied material.

Explore the internal structure of the chosen subject. Look for meaningful
things, groupings, activities, events, changes, recurring patterns, and other
relationships where they matter. Let the material and reader purpose determine
which structures earn a place. Reconsider the scope if the exploration reveals
a more useful organization.

Populate two small examples that exercise different structural choices. Explain
one consequential relationship or comparison the model makes understandable,
and identify what the examples leave untested.

Keep source-supported facts, interpretations, proposed structures needing more
information, and unknowns distinguishable. Use only the supplied material for
populated factual claims. Return readable, indented JSON, with no HTML or prose
outside the JSON.
```

## Pilot protocol

Use the same request and this broad reader purpose on two existing sources:

> Help a general reader understand the subject described by the material and
> the consequential connections within it. Explain what more specific reader
> job your chosen scope serves.

- [Legislative races](experiment/sources/races.txt): does the model justify
  its scope and discover supported internal relationships beyond comparable
  candidate records? A collection of contests remains a legitimate choice.
- [Aviation preliminary report](experiment/sources/dca.txt): does the model
  discover an appropriate scope and relationships in material with detailed
  events and timing? Preserve the report's preliminary status when interpreting
  the evidence.

Produce one draft per source, then one revision per draft: four JSON artifacts
in total. Give fresh contexts the same request, without suggesting particular
domain objects or desired discoveries. The revision keeps its original source,
reader purpose, draft, and assessment cases. Use this follow-up request:

```text
Review your model using the original source and reader purpose. Find one
consequential weakness in its scope or internal structure. Use a concrete case
to explain the weakness, and revise only where the change offers a reader
benefit. Retain the original two examples; you may add one brief challenge case.
Explain what changed, what the examples demonstrate, and what remains uncertain.
Choose your own JSON schema and return the complete revised model. Preserve
the distinction between source facts, interpretations, proposed extensions,
and unknowns. Return readable, indented JSON with no HTML or outside prose.
```

Keep the exact requests, source snapshots, original responses, and draft to
revision links with the results. This small pilot tests whether the
proposed process produces useful design choices across different material; it
does not isolate the effect of each sentence in the request.

Review each proposal through the same questions:

- Does the chosen scope serve the stated reader purpose, and does the model
  develop that scope?
- Does a concrete example demonstrate the claimed insight? A list of possible
  activities or view names alone does not demonstrate their structure.
- Are useful distinctions and relationships preserved without unnecessary
  complexity?
- Can the reader distinguish missing source evidence from a modeling omission?
- What changed in the revision, and what coverage did the revision retain or
  give up?

Use the swipe deck for the resulting review, with the scope and rationale
visible alongside the model, examples, exact request, and original JSON.
Mechanical checks cover JSON validity and preservation. Human assessment
concerns whether the proposed organization reveals something worth seeing.

## Pilot results, 2026-10-28

The [new swipe deck](discovery-review.html#map=1&tab=scope) contains four
models: an election draft and revision, then an aviation draft and revision.
Scope, Model, Examples, Review, JSON and Prompt tabs remain selected when the
reader changes slides. Nested tab selections also persist. The viewer uses
explicit adapters; its diagrams and review notes are separate from the saved
agent responses.

Each source received the same request and broad reader purpose in a fresh
agent context, without a suggested domain schema. The follow-up went to the
same agent. Both revisions retained their original two examples as equal JSON
values and added one challenge case. The [run record](discovery-pilot/run.json)
and [preservation checks](discovery-pilot/checks.json) link the requests,
source snapshots, outputs and hashes. These records preserve task messages and
files, rather than a provider API or hidden runtime transcript.

| Source | Draft's organizing choice | Revision's concrete change |
|---|---|---|
| Election article | Explain routes to changed representation. Distinguish overlapping competition in Hall's contest from linked openings around Mena's Senate run. | Broaden the scope to include continuing officeholders. A Krishnadasan challenge case connects an appointment, a partial-term special-election win and the next contest. The sketch grows from five types to six. |
| Aviation preliminary report | Explain separation arrangements and evidence across aircraft, communications and historical encounter groups. | Add conditional alert policy. A challenge case distinguishes the reported traffic advisory from the rules governing advisory availability, without asserting an exact device state. The sketch grows from nine types to ten. |

The two scopes lead to different structures even with the same broad reader
purpose. The election revision also supplies a concrete example of scope
changing during modeling: representation can continue through a new election,
so a scope centered on replacement misses part of the subject.

The aviation examples demonstrate another useful distinction. A recorded
instruction, a possible gap in its reception, and a reported cockpit
interpretation are separate claims. The historical example keeps encounter
counts attached to their thresholds and reporting window. The model explains
why those counts do not directly yield the share of flights affected. Selected
timestamps, thresholds, counts and the partial-term history were checked
against the saved sources; the check was not an exhaustive factual audit.

Several limitations remain visible:

- Both revisions add a type. Neither tests whether existing structures could
  express the same benefit with less complexity.
- The outputs are conceptual sketches with substantial explanatory prose.
  The election sketch has no consistent machine-readable field schema for its
  event histories. The aviation sketch lists fields and relationships, but
  does not populate every proposed type in its examples.
- The challenge cases exercise the added distinctions; they do not establish
  the usefulness of every object, or demonstrate navigation through a complete
  population. The aviation revision is about 31 KB, against a 20 KB draft;
  the election grows from about 14 KB to 22 KB despite the concise request.
- The election outputs contain a replacement character in the copied article
  title. The original JSON has been preserved. The source snapshots retain
  their original bytes.
- One draft and revision per source can expose useful choices. The pilot
  cannot attribute an improvement to a particular prompt sentence, establish
  a best schema, or demonstrate improved HTML.

Retain the scope proposal, contrasting examples and challenge revision as a
working process. The next useful check is to select a model and trace one
reader question through actual records and links. Where the answer currently
exists only in commentary, ask the modeler to encode the relationship using
the smallest useful structure. Preserve the same examples and allow replacing
or removing a type. That check would test the model's operational value before
generating a page from it.
