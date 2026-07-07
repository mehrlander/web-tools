// console/mods/lasso.js — drag a rectangle, select what's inside. The
// feature scraping libraries can't have: they don't have a screen. Requires
// console/base.js (glom, ea).
//
//   await glom.lasso()                  non-empty set → spatial refine (keep
//                                       members inside); empty set → discover
//   glom.lasso({mode: 'intersect'})     touching counts (default 'contain')
//
// Esc cancels (set unchanged). Discovery keeps selection roots: contained
// elements whose parent isn't contained, so a tight rectangle around a list
// gets the items, not every span inside them. Zero-size boxes (hidden
// elements, and everything under jsdom's inert layout) are skipped;
// {zero: true} keeps them, which headless tests need.
(() => {
  const g = window.glom;
  if (!g?.core) return console.warn('mods/lasso: base.js + mods/core.js must load first');
  const { SCOPE } = g.core;

  g.lasso = ({ mode = 'contain', zero = false } = {}) => new Promise(resolve => {
    const doc = document;
    const box = Object.assign(doc.createElement('div'), { id: 'glom-lasso-box' });
    box.style.cssText = 'position:fixed;z-index:2147483647;border:1.5px dashed #f59e0b;background:#f59e0b22;pointer-events:none;display:none';
    const veil = Object.assign(doc.createElement('div'), { id: 'glom-lasso-veil' });
    veil.style.cssText = 'position:fixed;inset:0;z-index:2147483646;cursor:crosshair;background:transparent';
    doc.body.append(veil, box);

    let x0 = 0, y0 = 0, dragging = false;
    const frame = e => {
      const x = Math.min(x0, e.clientX), y = Math.min(y0, e.clientY);
      const w = Math.abs(e.clientX - x0), h = Math.abs(e.clientY - y0);
      Object.assign(box.style, { display: 'block', left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` });
      return { x1: x, y1: y, x2: x + w, y2: y + h };
    };
    const cleanup = () => { veil.remove(); box.remove(); doc.removeEventListener('keydown', onKey, true); };
    const onKey = e => {
      if (e.key !== 'Escape') return;
      cleanup();
      console.log('lasso: cancelled');
      resolve(g.get());
    };

    veil.addEventListener('pointerdown', e => { dragging = true; x0 = e.clientX; y0 = e.clientY; frame(e); });
    veil.addEventListener('pointermove', e => { if (dragging) frame(e); });
    veil.addEventListener('pointerup', e => {
      const r = frame(e);
      cleanup();
      const inside = n => {
        const b = n.getBoundingClientRect();
        if (!zero && (b.width <= 0 || b.height <= 0)) return false;
        return mode === 'intersect'
          ? b.left < r.x2 && b.right > r.x1 && b.top < r.y2 && b.bottom > r.y1
          : b.left >= r.x1 && b.right <= r.x2 && b.top >= r.y1 && b.bottom <= r.y2;
      };
      const cur = g.get();
      let picked;
      if (cur.length) picked = cur.filter(inside);
      else {
        const all = ea(SCOPE).filter(inside), s = new Set(all);
        picked = all.filter(n => !s.has(n.parentElement));
      }
      const res = g.set(picked);
      console.log(`lasso: ${res.length} selected`);
      resolve(res);
    });
    doc.addEventListener('keydown', onKey, true);
    console.log('lasso: drag a rectangle — Esc cancels');
  });
})();
