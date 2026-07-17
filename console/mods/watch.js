// console/mods/watch.js — the self-healing working set. React-style pages
// destroy data-glom attributes on every rerender, killing the selection
// mid-dance; watch re-acquires it. Requires console/base.js (glom); uses
// mods/infer.js for the automatic selector when no explicit one is given.
//
//   glom.watch()                    infer a selector from the current set and
//                                   re-apply it whenever the DOM churns
//   glom.watch({selector: '.row'})  explicit selector (infer not needed)
//   glom.watch.stop()               disarm
//
// Mutations are debounced (`settle` ms, default 250) so a rerender storm
// heals once, at the end. Healing logs only when membership actually changed.
(() => {
  const g = window.glom;
  if (!g?.core) return console.warn('mods/watch: base.js + mods/core.js must load first');
  let stopChurn = null;

  g.watch = ({ selector, settle = 250 } = {}) => {
    g.watch.stop();
    const sel = selector ?? (g.infer ? g.infer()?.selector : null);
    if (!sel) return console.warn('watch: pass {selector}, or glom something and load mods/infer.js');

    const heal = () => {
      const fresh = [...document.querySelectorAll(sel)];
      const cur = g.get();
      if (fresh.length === cur.length && fresh.every((n, i) => n === cur[i])) return;
      g.set(fresh);
      console.log(`watch: healed → ${fresh.length} (${sel})`);
    };
    stopChurn = g.core.onChurn(heal, settle);
    g.watch.selector = sel;
    console.log(`watch: armed on "${sel}" — glom.watch.stop() to disarm`);
    return sel;
  };
  g.watch.stop = () => { stopChurn?.(); stopChurn = null; };
})();
