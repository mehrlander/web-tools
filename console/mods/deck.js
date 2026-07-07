// console/mods/deck.js — a live side-window view of the working set: dense,
// dark, monospace. Immediate visual validation without injecting any UI into
// the host page: the deck is its own window (same-origin about:blank, driven
// directly), so the page's CSS can't touch it and a rerender can't kill it.
// Requires console/base.js (glom, sig, text).
//
//   glom.deck()          open (or refresh) the deck; re-renders on every
//                        glom.set — verbs, pick, grow, lasso all show live
//   glom.deck.close()    close and unhook
(() => {
  const g = window.glom;
  if (!g) return console.warn('mods/deck: console/base.js must load first');
  let win = null, origSet = null;

  const escape = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const render = () => {
    if (!win || win.closed) return;
    const els = g.get();
    const rows = els.map((n, i) => {
      const href = (n.closest?.('a[href]') || n.querySelector?.('a[href]'))?.getAttribute('href') ?? '';
      return `<tr><td>${i}</td><td>${escape(sig.tag(n))}</td><td>${escape(sig.css(n))}</td>` +
             `<td>${escape(text.own.clean(n).slice(0, 120))}</td><td>${escape(href)}</td></tr>`;
    }).join('');
    win.document.body.innerHTML =
      `<h1>glom deck — ${els.length} in set</h1>` +
      `<table><thead><tr><th>#</th><th>tag</th><th>css</th><th>own text</th><th>href</th></tr></thead>` +
      `<tbody>${rows}</tbody></table>`;
  };

  g.deck = () => {
    if (win && !win.closed) { render(); return win; }
    win = window.open('', 'glom-deck', 'width=720,height=520');
    if (!win) { console.warn('deck: popup blocked'); return null; }
    win.document.title = 'glom deck';
    const style = win.document.createElement('style');
    style.textContent =
      'body{background:#0b1220;color:#cbd5e1;font:12px/1.5 ui-monospace,SFMono-Regular,monospace;margin:0;padding:10px}' +
      'h1{font-size:12px;color:#f59e0b;margin:0 0 8px;font-weight:normal}' +
      'table{border-collapse:collapse;width:100%}' +
      'td,th{border-bottom:1px solid #1e293b;padding:2px 8px;text-align:left;vertical-align:top}' +
      'th{color:#64748b;font-weight:normal}td:first-child{color:#f59e0b}';
    win.document.head.append(style);
    if (!origSet) {
      origSet = g.set;
      g.set = els => { const r = origSet(els); render(); return r; };
    }
    render();
    return win;
  };
  g.deck.close = () => {
    if (origSet) { g.set = origSet; origSet = null; }
    win?.close?.();
    win = null;
  };
})();
