---
name: doc-craft
description: Revise documentation so each edit serves its critical objective and keeps the whole system recognizable, navigable, and maintainable; living docs state current behavior and rules, records stay as written, generated docs are edited at source.
---

# Doc Craft

Documentation guides a living system. When successful, it delivers insight where needed and is unheard otherwise. Improvement is deceptively challenging. Any edit changes what future participants are likely to notice and do, what they must hold in mind, and what someone must keep consistent later. A passage can become clearer while the system becomes harder to understand and govern.

The burden on any edit is higher than is typically recognized. The inclination is to patch: close a gap from the immediate perspective, but each patch erodes the integrity of the whole. While it spotlights every contour of its own point, the audience leaves. Ideally, every change would reconsider all relevant context, but review is expensive and churn is itself costly.

Deep attention to the editing process is vital for consideration of latent structure, balance, and alignment of focus. What is the critical objective of the edit, and what are the options for achieving it? A slight adjustment in framing can solve a problem and preserve flow. Revisions must obsessively focus on keeping the whole recognizable, navigable, and maintainable.

## Classification

Before revising, identify the document type:

- **Living**: Describe current system behavior, interfaces, and operating instructions.
- **Record**: Preserve point-in-time accounts. When a claim proves wrong, say so in an ordinary sentence that carries the date and links the successor; do not rewrite the original claim.
- **Generated**: Edit the upstream source or generator, then regenerate.

## Editing Mechanics

- **Edit at the smallest useful unit**: Read the entire file before changing a part. Prefer editing an existing sentence, parameter entry, or bullet to adding a section.
- **Integrate explanations**: Put a constraint or explanation in the smallest existing unit that can carry it. Add a section only when the material introduces a distinct concern that needs sustained treatment or a stable link target.
- **Match the document**: Keep the surrounding section’s level of detail and heading structure.

## Living Documentation Rules

- **Earn each sentence**: Name the decision a sentence changes for the next assistant. If there is none, cut it.
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

To separate the binding rules of an executed document (a `CLAUDE.md`, a `SKILL.md`) from the explanation around them, use [state-the-rule](../state-the-rule/SKILL.md), which checks the cut mechanically.
