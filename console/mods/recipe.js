// console/mods/recipe.js — the session journal: record every console-level
// glom/q call and print the dance back as a replayable script. The export's
// missing half: columns() gives the data, recipe() gives the provenance —
// how the set was produced. Loads LAST in the suite so it can wrap the verbs
// every other mod has installed. Requires base.js + mods/core.js.
//
//   glom.recipe()         print (and return) the trail as one paste-able script
//   glom.recipe.trail     the raw entries
//   glom.recipe.clear()
//
// Serialization is honest: strings/numbers/regexes/functions replay verbatim;
// element arguments (from pick, lasso, census.grab…) can't travel through
// text and appear as /* elements */ placeholders — replace them with a
// selector (glom.infer()) when hardening a recipe.
(() => {
  const g = window.glom;
  if (!g?.core) return console.warn('mods/recipe: base.js + mods/core.js must load first');

  const trail = [];
  const show = v =>
    v === undefined ? '' :
    typeof v === 'string' ? JSON.stringify(v) :
    typeof v === 'number' || typeof v === 'boolean' ? String(v) :
    (typeof v === 'object' && v && typeof v.test === 'function' && typeof v.source === 'string') ? String(v) :  // regex, cross-realm safe
    typeof v === 'function' ? v.toString() :
    v instanceof Element || (Array.isArray(v) && v.some(x => x instanceof Element)) ? '/* elements */' :
    (() => { try { return JSON.stringify(v) ?? '/* value */'; } catch { return '/* elements */'; } })();
  const record = (name, args) => trail.push(`${name}(${[...args].map(show).join(', ')})`);

  // Wrap the replayable ops in place: mods hold the same glom object, so a
  // wrapped method is seen everywhere; sub-properties (watch.stop, pick.done,
  // veins.grab…) ride along via Object.assign.
  const OPS = ['up', 'down', 'downAll', 'over', 'keep', 'drop', 'undo', 'clear',
               'grow', 'alike', 'save', 'use', 'forget', 'lasso', 'harvest',
               'columns', 'infer', 'watch', 'veins', 'templates', 'semantics', 'join'];
  for (const k of OPS) {
    const fn = g[k];
    if (typeof fn !== 'function') continue;
    const wrapped = function (...args) { record(`glom.${k}`, args); return fn.apply(this, args); };
    Object.assign(wrapped, fn);
    g[k] = wrapped;
  }

  // The glom(...) call itself: swap in a recording facade that shares every
  // property (same references) with the original.
  const G = g;
  const facade = function (...args) { record('glom', args); return G(...args); };
  Object.assign(facade, G);
  window.glom = facade;

  if (window.q) {
    const Q = window.q;
    window.q = (...args) => { record('q', args); return Q(...args); };
  }

  const recipe = () => {
    const script = trail.join(';\n') + (trail.length ? ';' : '');
    console.log(script || 'recipe: empty — do something first');
    return script;
  };
  recipe.trail = trail;
  recipe.clear = () => { trail.length = 0; };
  G.recipe = recipe;
  facade.recipe = recipe;
})();
