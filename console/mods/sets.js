// console/mods/sets.js — named working sets: park one dance, start another,
// zip them later. Requires console/base.js (glom).
//
//   glom.save('rows')     snapshot the current set under a name
//   glom.use('rows')      restore it as the working set (badges return)
//   glom.names()          {name: count}
//   glom.forget('rows')   drop a name;  glom.forget()  drop all
//
// Snapshots hold element references in memory: they survive the console
// session, not a rerender (re-acquire via glom.infer()'s selector when the
// page redraws).
(() => {
  const g = window.glom;
  if (!g) return console.warn('mods/sets: console/base.js must load first');
  const store = new Map();

  g.save = name => {
    const cur = g.get();
    if (!name) { console.warn('save: give it a name'); return cur; }
    store.set(String(name), cur);
    console.log(`save: ${cur.length} → "${name}"`);
    return cur;
  };
  g.use = name => store.has(String(name))
    ? g.set(store.get(String(name)))
    : (console.warn(`use: no set "${name}" — glom.names()`), g.get());
  g.names = () => Object.fromEntries([...store].map(([k, v]) => [k, v.length]));
  g.forget = name => {
    name == null ? store.clear() : store.delete(String(name));
    return g.names();
  };
})();
