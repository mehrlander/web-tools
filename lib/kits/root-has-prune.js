// kits/root-has-prune.js — daisyUI's :root:has() rules, removed from the
// loaded stylesheet so that a change anywhere in the page stops costing a
// restyle of all of it.
//
// MEASURED 2026-10-23, on the app with a nine-sheet workbook in the transform
// workbench: one batch-chip click forced 15 to 17 style recalculations (the
// grid measuring its height while it redraws), and they cost 264 to 349 ms
// together. With daisyUI's stylesheet switched off the same click spent 40 to
// 60 ms recalculating; with only its :root:has() selectors taken out, about
// 96 ms. A selector anchored on :root that asks about the page's descendants
// makes the browser re-check the root, and so restyle the whole tree, after
// any change below it, which is every change. The page is large (8,500 nodes
// with the reader open), so every recalculation is expensive.
//
// WHAT THE RULES DO, and why losing them changes nothing here. daisyUI 5.7
// carries 55 of them, in two families:
//   - theme-controller: `:root:has(input.theme-controller[value=x]:checked)`
//     beside `[data-theme=x]` on every theme, so a checked radio input can
//     switch the theme. This estate sets `data-theme` and has no such input,
//     and the `[data-theme=x]` half of each selector is kept.
//   - page scroll lock: `:root:has(.drawer-toggle:checked)` and nested
//     `:root:has(&)` under the modal and drawer states, which hold the page
//     still behind an open modal. The app's views are fixed to the viewport
//     and scroll inside their own panes, so there is no page scroll to lock.
// A page that does use either would lose that behavior, which is why this
// runs only on a stylesheet that opts in (below), never on every sheet.
//
// HOW: a CSSOM edit of the stylesheet already loaded, not a second copy and
// not a pinned fork. A selector list loses only its :root:has() alternatives
// (`:root,:root:has(…),[data-theme=light]` keeps `:root,[data-theme=light]`),
// and a rule left with none is deleted. Grouping rules (@layer, @media,
// @supports) and nested rules are walked. Reading another origin's rules needs
// the link to be CORS-mode, and jsDelivr answers `access-control-allow-origin:
// *`, so the opt-in is two attributes on the link:
//
//   <link href="https://cdn.jsdelivr.net/…daisyui@5…" rel="stylesheet"
//         crossorigin="anonymous" data-prune-root-has>
//
// A sheet that cannot be read, or a rule the browser refuses to edit, is left
// as it was: the cost of a miss is the old speed, never a broken page.
//
//   RootHasPrune.run(doc?)        prune every opted-in link, now or on load;
//                                 resolves to { sheets, rewritten, removed }
//   RootHasPrune.prune(sheet)     one stylesheet; { rewritten, removed }
//   RootHasPrune.strip(selector)  the selector without its :root:has()
//                                 alternatives, or '' when none is left
//   RootHasPrune.split(selector)  a selector list split at its top-level commas
(() => {
  const ROOT_HAS = /:root:has\(/;

  // Top-level commas only: a comma inside :is(), :has() or an attribute value
  // belongs to the alternative it sits in.
  function split(text) {
    const out = [];
    let depth = 0, quote = '', start = 0;
    const s = String(text || '');
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (quote) { if (c === '\\') i++; else if (c === quote) quote = ''; continue; }
      if (c === '"' || c === "'") quote = c;
      else if (c === '(' || c === '[') depth++;
      else if (c === ')' || c === ']') depth--;
      else if (c === ',' && depth === 0) { out.push(s.slice(start, i).trim()); start = i + 1; }
    }
    out.push(s.slice(start).trim());
    return out.filter(Boolean);
  }

  function strip(selector) {
    return split(selector).filter(alt => !ROOT_HAS.test(alt)).join(', ');
  }

  function prune(sheet) {
    const n = { rewritten: 0, removed: 0 };
    const walk = (parent) => {
      let rules;
      try { rules = parent.cssRules; } catch { return; }
      if (!rules) return;
      for (let i = rules.length - 1; i >= 0; i--) {
        const r = rules[i];
        const sel = r.selectorText;
        if (typeof sel === 'string' && ROOT_HAS.test(sel)) {
          const kept = strip(sel);
          try {
            if (kept) { r.selectorText = kept; n.rewritten++; }
            else { parent.deleteRule(i); n.removed++; continue; }
          } catch { /* left as it was */ }
        }
        if (r.cssRules) walk(r);
      }
    };
    walk(sheet);
    return n;
  }

  function run(doc) {
    const d = doc || document;
    const links = [...d.querySelectorAll('link[rel~="stylesheet"][data-prune-root-has]')];
    const one = (link) => new Promise((done) => {
      const go = () => done(link.sheet ? prune(link.sheet) : { rewritten: 0, removed: 0 });
      if (link.sheet) return go();
      link.addEventListener('load', go, { once: true });
      link.addEventListener('error', () => done({ rewritten: 0, removed: 0 }), { once: true });
    });
    return Promise.all(links.map(one)).then(all => all.reduce(
      (t, x) => ({ sheets: t.sheets + 1, rewritten: t.rewritten + x.rewritten, removed: t.removed + x.removed }),
      { sheets: 0, rewritten: 0, removed: 0 }));
  }

  window.RootHasPrune = { run, prune, strip, split };
})();
