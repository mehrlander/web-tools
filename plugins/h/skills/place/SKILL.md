---
name: place
description: "Library folders: A file under `lib/` goes in the folder named by what it attaches to."
disable-model-invocation: true
---

<!-- Generated from docs/house-policies.md by node/build/policy-skills.mjs; do not hand-edit. -->

# Library folders · `/h:place`

A file under `lib/` goes in the folder named by what it attaches to.

- A file that extends `GH.prototype`, or a boot bundle, goes in `lib/` itself.
- A file that registers a `window` namespace goes in `lib/kits/`.
- A file that registers with `Alpine.data` goes in `lib/alpineComponents/`.
- A file that is a single function expression, reaching neither `window` nor `document`, goes in `lib/ops/`.

**Covers:** web-tools.

**Detail:** [code-layers.md](https://github.com/mehrlander/web-tools/blob/main/docs/code-layers.md), "The layers", held by `node/test/code-layers.test.mjs`.
