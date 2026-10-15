---
name: check
description: "Checking: Verify a claim with a check that could have failed."
disable-model-invocation: true
---

<!-- Generated from docs/house-policies.md by node/build/policy-skills.mjs; do not hand-edit. -->

# Checking · `/h:check`

Verify a claim with a check that could have failed.

- Ask whether the observation itself could be wrong.
- A probe that reads through the component under suspicion cannot clear that component.
- A check that cannot see a failure says nothing about it.
- Pair a positive result with a negative control where one is possible.

**Covers:** claims about files, behavior, tests, links and CI.
