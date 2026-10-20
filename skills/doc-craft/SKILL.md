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
- **Describe with a purpose**: Describe a mechanism only to state an insight or to tell the assistant about behavior it needs.
- **Format non-obvious restrictions**: State the trigger condition, failure symptom, and required mitigation.
- **Be concrete**: Name exact files, commands, flags, components, and actors.
- **Hedge**: Use careful, precise language. Prefer "avoid" or "do not" over "never".
- **Verify continuity**: Confirm that removals or edits do not break prerequisites, cross-references, or transitions.

## Review

Check changes against the principles above, make any needed revisions, commit them on a branch, then present them in chat as a doc review:

- **Open with the work**: A `📝 Doc review: <topic>` heading, one or two sentences on the work behind the edits, and a link to the commit.
- **Caption each document**: Its plain name, 🥏 render link, and one line on what it covers.
- **Label each edit**: `Edit N · <kind> · <origin>`. Kind: Fix (the text is false), Alignment (two documents disagree), Addition (new content) or Wording (same claim, new words). Origin: this session's work or the existing text.
- **Locate it, then show it**: Name the place by its content and say what changes, then show a fenced `diff` block with enough unchanged lines to locate it.
- **Add the fields that apply**: *Describes:* the code the passage describes. *Reviewed:* other documents read for the edit. *Alternative placements:* for an addition, other places it could go.
- **List corrections separately**: A correction replaces a wrong word, number, path, or link without changing what the sentence asks the reader to do. List corrections after the diffs, one line each.
- **Print it with the script**: `python3 "${CLAUDE_PLUGIN_ROOT}/doc-craft/doc-review.py" briefing.json` renders the review from a JSON briefing and the branch's edits; `--list` names the hunks a briefing keys on.

Revise on request, and merge only after the owner approves the wording. Approval covers documentation, the four places of [principle 6](https://github.com/mehrlander/web-tools/blob/main/docs/CONSTELLATION.md#principle-6-documentation-has-four-places-and-everything-else-is-a-question), including a doc of dated measurements. It does not cover an account: research a repository declares in `.web-tools.json`, its README included, or a record, which preserves a moment.
