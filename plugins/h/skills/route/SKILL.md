---
name: route
description: "Address parameters: Give each parameter a page reads from its address one of four kinds, and keep it to that kind."
disable-model-invocation: true
---

<!-- Generated from docs/house-policies.md by node/build/policy-skills.mjs; do not hand-edit. -->

# Address parameters · `h:route`

Give each parameter a page reads from its address one of four kinds, and keep it to that kind.

- A **route** names a place: a view, a tab, or a record inside it. It stays in the address, which then names where the reader is, and arriving on a record lands on it.
- An **action** is done once on arrival and then dropped from the address, and a reload does not repeat it.
- A **look** points the reader at something on the page and changes nothing.
- A **setting** changes how the page runs.

**Backed by:** [app-routes.csv](https://github.com/mehrlander/web-tools/blob/main/docs/app-routes.csv), the Web Tools app's routes; [lib/kits/land.js](https://github.com/mehrlander/web-tools/blob/main/lib/kits/land.js), how a route lands; [lib/kits/look.js](https://github.com/mehrlander/web-tools/blob/main/lib/kits/look.js), looks.
