// ── select + read ──
window.ea = (sel, cb = el => el) =>
  [...document.querySelectorAll(sel)].map(cb)

window.el = new Proxy({}, { get: (_, k) => node => node[k] })

// ── id / data-ui lookup ──
const dash  = s => s.replace(/[A-Z]/g, c => '-' + c.toLowerCase())
const camel = s => s.replace(/-+(.)/g, (_, c) => c.toUpperCase())

// ids.fooBar → getElementById('foo-bar'). Keyed, so `const { a, b } = ids` is
// order-independent. The then/symbol guard keeps the proxy await-safe.
window.ids = new Proxy({}, {
  get: (_, k) => typeof k === 'string' && k !== 'then'
    ? document.getElementById(dash(k))
    : undefined
})

// ui(root).fooBar → root.querySelector('[data-ui="foo-bar"]'). Scoped and not
// id-unique, so the same name can repeat across component instances.
window.ui = (root = document) => new Proxy({}, {
  get: (_, k) => typeof k === 'string' && k !== 'then'
    ? root.querySelector(`[data-ui="${CSS.escape(dash(k))}"]`)
    : undefined
})

// grab(root) → eager { fooBar: el } snapshot of every [id] under root.
window.grab = (root = document) => Object.fromEntries(
  [...root.querySelectorAll('[id]')].map(el => [camel(el.id), el]))

// ── structural write ──
// function → run, array → run each on the matched el, object → assign, else → text
window.fill = (root, spec) =>
  Object.entries(spec).forEach(([sel, v]) =>
    root.querySelectorAll(sel).forEach(
      typeof v === 'function' ? v
      : Array.isArray(v)      ? el => v.forEach(f => f(el))
      : typeof v === 'object' ? el => Object.assign(el, v)
      : el => el.textContent = v))

// ── callback helpers: the non-property writes ──
window.attr   = (k, v)  => el => (el.setAttribute(k, v), el)
window.cls    = (k, on) => el => (el.classList.toggle(k, on), el)
window.listen = (ev, f) => el => (el.addEventListener(ev, f), el)
window.data   = obj     => el => (Object.assign(el.dataset, obj), el)

// ── tpl: build rows into markup, then place ──
const node = h => {
  const t = document.createElement('template')
  t.innerHTML = h
  return t.content
}
const build = (strings, ...fns) => rows =>
  rows.map(row => strings.reduce((s, seg, i) =>
    s + seg + (typeof fns[i] === 'function' ? fns[i](row) : fns[i] ?? ''), '')).join('')

window.tpl = {
  html:    (...a) => rows => el => el.innerHTML = build(...a)(rows),
  append:  (...a) => rows => el => el.append(node(build(...a)(rows))),
  prepend: (...a) => rows => el => el.prepend(node(build(...a)(rows))),
  replace: (...a) => rows => el => el.replaceChildren(node(build(...a)(rows)))
}

// ── events ──
window.on = (root, type, fn) =>
  (root.addEventListener(type, fn), root)

window.route = (root, type, routes) =>
  on(root, type, e => {
    for (const [sel, fn] of Object.entries(routes)) {
      const match = e.target.closest(sel)
      if (match) return fn(e, match)
    }
  })
