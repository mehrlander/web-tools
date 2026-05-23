// vanilla-bundle.js — vanilla DOM helpers. No framework dependencies.

window.ea = (sel, cb = el => el) =>
  [...document.querySelectorAll(sel)].map(cb)

window.on = (root, type, fn) =>
  (root.addEventListener(type, fn), root)

window.route = (root, type, routes) =>
  window.on(root, type, e => {
    for (const [sel, fn] of Object.entries(routes)) {
      const el = e.target.closest(sel)
      if (el) return fn(e, el)
    }
  })
