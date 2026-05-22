// vanilla-bundle.js — vanilla DOM helpers. No framework dependencies.

window.ea = (sel, cb = el => el) =>
  [...document.querySelectorAll(sel)].map(cb)

window.wire = (sel, events) => {
  if (sel && typeof sel === 'object') {
    for (const [s, ev] of Object.entries(sel)) window.wire(s, ev)
    return
  }
  const els = document.querySelectorAll(sel)
  for (const el of els) {
    for (const [type, fn] of Object.entries(events)) {
      el.addEventListener(type, fn)
    }
  }
  return els[0] || null
}
