---
name: policy
description: "Policy entries: A policy states a preference that holds across tasks, in wording the owner approved, with the cases it covers."
disable-model-invocation: true
---

<!-- Generated from docs/house-policies.md by node/build/policy-skills.mjs; do not hand-edit. -->

# Policy entries · `/h:policy`

A policy states a preference that holds across tasks, in wording the owner approved, with the cases it covers.

- An entry gives the preference and its scope, and links to the document that holds procedure and detail; neither restates the other.
- A session commits proposed wording on its branch, shows the owner the commit's diff in chat, and merges it only after the owner approves it.
- A policy gets a document of its own only after its entry has been misapplied twice.
- A shortcut names a preference or a bounded topic. A policy has one command, its slashed shortcut, and may list aliases without the slash; no shortcut is reused.
- Cite an entry by its shortcut, a slash command such as `/h:qualify`. After the first mention in a document or reply, `h:qualify` alone is enough.
- A shortcut is an address, not a summary: read the entry before applying it.

**Covers:** this document, and the repo-specific policies under `/h:local`.
