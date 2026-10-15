---
name: kit
description: "Kits: A kit registers one `window` namespace."
disable-model-invocation: true
---

<!-- Generated from docs/house-policies.md by node/build/policy-skills.mjs; do not hand-edit. -->

# Kits · `/h:kit`

A kit registers one `window` namespace.

- A kit does not decide where it is mounted, own reactive state or assume a framework.
- A kit takes the host it is given and returns a handle.
- A kit that needs reactivity gets a component wrapper.

**Covers:** web-tools.

**Detail:** [lib/kits/README.md](https://github.com/mehrlander/web-tools/blob/main/lib/kits/README.md), "Concept".
