---
name: doc-craft
description: Revise living engineering documentation to state current behavior, governing rules, and failure conditions without debugging history. Preserve dated records; edit generated docs at source.
---

# Doc Craft

## Classification

Before revising, identify the document type:

- **Living**: Describe current system behavior, interfaces, and operating instructions.
- **Record**: Preserve point-in-time accounts. Add dated corrections or status notes instead of rewriting historical claims.
- **Generated**: Edit the upstream source or generator, then regenerate.

## Editing Mechanics

- **Edit at the smallest useful unit**: Read the entire file before changing a part. Prefer editing an existing sentence, parameter entry, or bullet to adding a section.
- **Integrate explanations**: Put a constraint or explanation in the smallest existing unit that can carry it. Add a section only when the material introduces a distinct concern that needs sustained treatment or a stable link target.
- **Match the document**: Keep the surrounding section’s level of detail and heading structure.

## Living Documentation Rules

- **State current reality**: Lead with what exists, what it does, and what the reader must do. Omit debugging narratives, discovery steps, and authoring commentary.
- **Retain actionable rationale**: Include reasons only when they define a boundary, exception, condition, consequence, or trigger for reconsideration.
- **Format non-obvious restrictions**: State the trigger condition, failure symptom, and required mitigation.
- **Be concrete**: Name exact files, commands, flags, components, and actors. Use *detects* or *reports* unless a mechanism strictly *enforces*.
- **Check observable claims**: Verify paths, identifiers, commands, examples, and generated state with local tools. Treat text scans as candidates for review, not decisions.
- **Verify continuity**: Confirm that removals or edits do not break prerequisites, cross-references, or transitions.

## Output Contract

1. Produce the revised document or patch in the requested form.
2. Report only relocated content and unresolved ambiguities or unverified claims. Omit the report if neither exists.
3. Do not narrate routine edits.
