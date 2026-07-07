// console/mods/semantics.js — grab the structured data pages already carry:
// JSON-LD blocks, microdata items, and og:/twitter: meta tags. Often the
// whole scrape is sitting here, typed and labeled, before any DOM dancing.
// Requires base.js + mods/core.js.
//
//   glom.semantics()      → { jsonld: [...], microdata: [...], meta: {...} }
//
// Microdata items come back as {type, props, el}: props read content/href/src
// attributes before falling back to text, and nested itemscopes keep their
// own props.
(() => {
  const g = window.glom;
  if (!g?.core) return console.warn('mods/semantics: base.js + mods/core.js must load first');
  const { clean } = g.core;

  g.semantics = () => {
    const jsonld = [...document.querySelectorAll('script[type="application/ld+json"]')]
      .map(s => { try { return JSON.parse(s.textContent); } catch { return null; } })
      .filter(Boolean);

    const meta = {};
    for (const m of document.querySelectorAll('meta[property], meta[name]')) {
      const k = m.getAttribute('property') || m.getAttribute('name');
      const v = m.getAttribute('content');
      if (k && v != null && /^(og|twitter|article|fb):/.test(k)) meta[k] = v;
    }

    const microdata = [...document.querySelectorAll('[itemscope]')].map(scope => {
      const props = {};
      for (const el of scope.querySelectorAll('[itemprop]')) {
        const owner = el.hasAttribute('itemscope') ? el.parentElement?.closest('[itemscope]') : el.closest('[itemscope]');
        if (owner !== scope) continue;
        const k = el.getAttribute('itemprop');
        const v = el.getAttribute('content') ?? el.getAttribute('href') ?? el.getAttribute('src') ?? clean(el.textContent);
        if (!(k in props)) props[k] = v;
      }
      return { type: scope.getAttribute('itemtype') || '', props, el: scope };
    });

    console.log(`semantics: ${jsonld.length} JSON-LD, ${microdata.length} microdata items, ${Object.keys(meta).length} social metas`);
    return { jsonld, microdata, meta };
  };
})();
