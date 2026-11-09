---
name: route
description: "Address parameters: Give each parameter a page reads from its address one of four kinds, and give it only that kind's behavior."
disable-model-invocation: true
---

<!-- Generated from docs/house-policies.md by node/build/policy-skills.mjs; do not hand-edit. -->

# Address parameters · `h:route`

Give each parameter a page reads from its address one of four kinds, and give it only that kind's behavior.

- A **route** names a place: a view, a tab, or a record inside it. It stays in the address, which then names where the reader is. A route that names a record scrolls to it and marks it on arrival.
- An **action** is done once on arrival and then dropped from the address, and a reload does not repeat it.
- A **look** points the reader at something on the page and changes nothing, as a look link's `#show=` and `#steps=` do.
- A **setting** changes how the page runs.

**Backed by:** [app-routes.csv](https://github.com/mehrlander/web-tools/blob/main/docs/app-routes.csv), the Web Tools app's routes; [lib/kits/land.js](https://github.com/mehrlander/web-tools/blob/main/lib/kits/land.js), how a route lands; [lib/kits/look.js](https://github.com/mehrlander/web-tools/blob/main/lib/kits/look.js), looks.
