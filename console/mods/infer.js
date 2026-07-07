// console/mods/infer.js — glom.infer(): synthesize a CSS selector that
// matches the working set, and say honestly how well it does. Converts a
// hand-danced set (picked, grown, lassoed, keep/dropped) into something
// durable: replayable after a rerender, pasteable into Playwright or a
// scraper. Requires console/base.js (glom).
//
//   glom.infer()   → { selector, extra, missing }   (logs a verdict)
//
// extra = elements the selector matches beyond the set; missing = members it
// fails to match. (0, 0) is exact. Candidates: the members' shared atom
// (tag + classes every member carries), then the same atom scoped under each
// common ancestor with an id or classes. Mixed-tag sets infer per tag and
// join with commas.
(() => {
  const g = window.glom;
  if (!g) return console.warn('mods/infer: console/base.js must load first');
  const esc = s => window.CSS?.escape ? CSS.escape(s) : s.replace(/([^\w-])/g, '\\$1');

  const trySel = (selector, wantSet, wantLen) => {
    let got; try { got = document.querySelectorAll(selector); } catch { return null; }
    let extra = 0, hit = 0;
    for (const n of got) wantSet.has(n) ? hit++ : extra++;
    return { selector, extra, missing: wantLen - hit };
  };

  const atomFor = els => {
    const tags = new Set(els.map(n => n.tagName.toLowerCase()));
    const tag = tags.size === 1 ? [...tags][0] : '';
    const shared = [...els[0].classList].filter(c => els.every(n => n.classList.contains(c)));
    return (tag + shared.map(c => '.' + esc(c)).join('')) || tag;
  };

  const commonAncestors = els => {
    const chain = [];
    for (let c = els[0].parentElement; c && c !== document.documentElement; c = c.parentElement) chain.push(c);
    return chain.filter(a => els.every(n => a.contains(n)));
  };

  const inferOne = els => {
    const wantSet = new Set(els), wantLen = els.length;
    const atom = atomFor(els) || els[0].tagName.toLowerCase();
    const cands = [atom];
    for (const a of commonAncestors(els).slice(0, 6)) {
      const aa = a.id ? '#' + esc(a.id)
               : a.classList.length ? a.tagName.toLowerCase() + [...a.classList].map(c => '.' + esc(c)).join('')
               : null;
      if (aa) cands.push(`${aa} > ${atom}`, `${aa} ${atom}`);
    }
    const scored = cands.map(s => trySel(s, wantSet, wantLen)).filter(Boolean);
    const exact = scored.filter(r => !r.extra && !r.missing)
                        .sort((a, b) => a.selector.length - b.selector.length);
    if (exact.length) return exact[0];
    return scored.filter(r => !r.missing).sort((a, b) => a.extra - b.extra || a.selector.length - b.selector.length)[0]
        ?? scored.sort((a, b) => (a.extra + a.missing) - (b.extra + b.missing))[0];
  };

  g.infer = () => {
    const want = g.get();
    if (!want.length) { console.warn('infer: empty set'); return null; }
    const tags = [...new Set(want.map(n => n.tagName))];
    let res;
    if (tags.length === 1) res = inferOne(want);
    else {
      const joined = tags.map(t => inferOne(want.filter(n => n.tagName === t)).selector).join(', ');
      res = trySel(joined, new Set(want), want.length);
    }
    console.log(`infer: ${res.selector}${res.extra || res.missing ? ` (+${res.extra} extra, ${res.missing} missing)` : ' (exact)'}`);
    return res;
  };
})();
