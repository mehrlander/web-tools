# Named check procedures

A check has a declared target, criterion, expected result and evidence. A
reported pass applies only to the material and tasks actually examined.

| Procedure | Required specification | Record |
|---|---|---|
| `trace_task` | Reader question and required answer facts or relationships | Answer obtained; fields, links or UI path used; missing or ambiguous steps. For a page, record actions required to reach the answer. A model passes only when its records carry the answer. Commentary alone is reported as a gap. |
| `source_support` | Named claims or a declared population of claims, with source locators | Claims examined; supporting excerpts or locations; unsupported assertions; preserved uncertainty. Separate facts, attributed claims, interpretations and proposed extensions. Explicitly state sampling or omissions. |
| `render_health` | Viewport widths, interactions and measurable limits from the brief | Screenshots, console errors, overflow measurements, required interaction results and broken assets. Use existing browser tooling. A successful load alone is insufficient. |
| `visual_requirements` | Specific requirements supplied by the person or house style | Named screen regions and observations for each requirement. A screenshot reader reports what is visible; the person's taste remains part of their review. |
| `dependency_compatibility` | A dependent view, its former dependency and the replacement version | Content, relationships and behavior compared. Identify why the existing view remains valid, or which changes it needs. Bind the result to both version IDs. |
| `person_review` | The question put to the person and the artifact versions shown | The person's actual response, or `unknown` while waiting. A bot cannot supply a pass on the person's behalf. |

Keep a concrete failure attached to its artifact and criterion. The coordinator
can then issue a revision with that failure as its reason and the same check as
its verification condition.

## Example: a structural revision

A reader asks why an incumbent who recently won an election is on the ballot
again. The source says the earlier win was for a partial term.

- **Target:** The candidate model and that worked case.
- **Expected trace:** Earlier election, partial-term scope, next contest, with
  source support for the stated connection.
- **Failure:** The answer appears in a paragraph but cannot be followed through
  populated records or relationships.
- **Action:** `revise_structure`, preserving the earlier cases.
- **Recheck:** `trace_task` against the new model version. Source support is a
  separate check if the revision adds or changes factual claims.

A later page revision can expose this same structural failure. Route the issue
to the model, preserve its earlier version and reconsider dependent sketches.

## Scripted validation

`scripts/validate_run.py` checks record structure, operation targets, output
kinds, files, effort accounting and dependency ancestry. It reports which views
consume superseded versions and which have recorded compatibility evidence.
It does not execute model calls, judge source truth, read a page as a person,
or establish the quality of a design. Record those checks using the procedures
above and the tools suited to the task.
