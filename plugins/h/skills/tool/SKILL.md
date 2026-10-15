---
name: tool
description: "Scripts: A script outside `lib/` is placed by three questions, asked in order."
disable-model-invocation: true
---

<!-- Generated from docs/house-policies.md by node/build/policy-skills.mjs; do not hand-edit. -->

# Scripts · `/h:tool`

A script outside `lib/` is placed by three questions, asked in order.

- First: is it a maintained tool, or a script kept with a probe's findings?
- Second: which family does it belong to?
- Third: what does it need to run? Standard-library Python goes in `python/`, and Node using this repo's packages goes in `node/`.

**Covers:** web-tools.

**Detail:** [code-layers.md](https://github.com/mehrlander/web-tools/blob/main/docs/code-layers.md), "Placing a script".
