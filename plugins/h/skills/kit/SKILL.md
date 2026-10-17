---
name: kit
description: "Kits: A kit registers one `window` namespace."
disable-model-invocation: true
---

<!-- Generated from docs/house-policies.md by node/build/policy-skills.mjs; do not hand-edit. -->

# Kits · `/h:kit`

A kit registers one `window` namespace.

- A kit loads through `gh.load`, so it has no top-level `import` or `export`.
- A kit that needs Alpine reactivity gets a component wrapper rather than becoming a component.

**Covers:** web-tools.

**Detail:** [lib/kits/README.md](https://github.com/mehrlander/web-tools/blob/main/lib/kits/README.md), "Shape rules"; [code-layers.md](https://github.com/mehrlander/web-tools/blob/main/docs/code-layers.md), "Cases the table does not settle".
