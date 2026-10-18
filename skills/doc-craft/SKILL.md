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
- **Integrate explanations**:  Prefer editing an existing sentence, parameter entry, or bullet to adding a section.
- **Earn each sentence**: If material can be removed and it is unlikely to affect future assistant behavior, it likely should be.
- **State current reality**: Omit debugging narratives, discovery steps, and authoring commentary.
- **Retain actionable rationale**: Include reasons only when they directly clarify intent, and then as minimally as possible.
- **Format non-obvious restrictions**: State the trigger condition, failure symptom, and required mitigation.
- **Be concrete**: Name exact files, commands, flags, components, and actors.
- **Hedge**: Use careful, precise language. Prefer "avoid" or "do not" over "never".
- **Verify continuity**: Confirm that removals or edits do not break prerequisites, cross-references, or transitions.

## Review

- **Show new text as a diff**: Before committing a change to a document, show each added or rewritten sentence in chat as a fenced `diff` block, with enough unchanged lines to locate each change. Check new text against **Consider the context** and **Earn each sentence** before showing it.
- **List corrections separately**: A correction replaces a wrong word, number, path, or link without changing what the sentence asks the reader to do. List corrections after the diff, one line each.
