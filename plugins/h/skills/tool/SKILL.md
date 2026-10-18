---
name: tool
description: "Scripts: A script outside `lib/` goes with its caller."
disable-model-invocation: true
---

<!-- Generated from docs/house-policies.md by node/build/policy-skills.mjs; do not hand-edit. -->

# Scripts · `/h:tool`

A script outside `lib/` goes with its caller.

- A pipeline step goes with its pipeline, a skill's script in that skill's folder, and a script a platform runs with that platform's files (`.githooks/`, `.github/workflows/`, `.claude/`).
- A script kept only to explain a probe stays with the probe's findings.
- Anything else goes in `python/` or `node/` by language.

**Covers:** web-tools.

**Detail:** [code-layers.md](https://github.com/mehrlander/web-tools/blob/main/docs/code-layers.md), "Outside `lib/`".
