// usage-chart.js — a session's context and cost per prompt as one SVG chart,
// drawn from kits/session-usage.js's reading (SessionUsage.read or
// SessionUsage.fromExtract). The session view's Cost tab and the Compactions
// card draw with it, so the two show the same chart.
//
//   UsageChart.svg(u, W, o) -> the chart's SVG as a string, W pixels wide
//     o.dark      the series hues for a dark page
//     o.ph        the context panel's height (default 150)
//     o.costPh    the cost panel's height: the context panel's when left out,
//                 and 0 for no cost panel
//     o.combined  one panel for both, o.ph tall: the cost bars behind the
//                 context line, context on the left axis and dollars on the
//                 right, the two sharing gridlines. The left axis is in the
//                 line's hue and the bars are grey, so each axis reads as
//                 its series'. Its legend names each series (context, cost
//                 per prompt, idle re-load) and, where the row has room,
//                 adds the session's totals to the two cost entries.
//     o.pick      the index in u.compactions to pick out (a tinted column and
//                 a filled mark), or -1 for none
//     o.href(c)   where a compaction's mark goes; by default its summary on
//                 pages/compactions.html
//     o.link      { href, label }: a link at the context panel's head, right
//   UsageChart.mark(host, u, k)  mark prompt k (or none, -1) in the chart
//                 drawn in host: the band across the panels and the dot on
//                 the line
//   UsageChart.at(e)             the prompt index under an event, or -1
//   UsageChart.dark(el)          whether el's text is light, so the page dark
//
// Pure string building and attribute setting; the host owns sizing, redraws
// and what a tap does. A string rather than an x-for, since an x-for inside
// <svg> draws nothing (html-style mechanics), and a string redraws at a new
// width in one go. Sized in the host's own pixels, so its text is the size it
// says. Hit areas carry data-k (the prompt's index) and a title-tip with its
// figures; compaction marks are links carrying data-cost-compaction and
// data-name (the summary's id). Its fill- and stroke- classes on theme colours
// compile because the pages that load it boot through lib/gh-boot.js, which
// registers the theme colours with Tailwind.
(function () {
  const plural = (n, noun) => n + ' ' + noun + (n === 1 ? '' : 's');
  const money = (v) => {
    if (!Number.isFinite(v)) return '';
    return v >= 100 ? '$' + Math.round(v).toLocaleString('en-US') : '$' + v.toFixed(2);
  };
  const tok = (v) => v >= 1e6 ? +(v / 1e6).toFixed(2) + 'M' : v ? Math.round(v / 1000) + 'k' : '0';
  // Addresses and labels go into the markup through the page's one escape
  // (lib/vanilla-bundle.js).
  const attr = (v) => (window.esc ? window.esc(v) : String(v));
  const summaryHref = (c) => 'https://mehrlander.github.io/web-tools/pages/compactions.html#at=' + encodeURIComponent(c.name);

  // Dark where the page's text is light, read off the element itself, so a
  // daisyUI theme, the system setting or a host's override all count.
  function dark(el) {
    const c = getComputedStyle(el).color;
    const ok = /oklch\(\s*([\d.]+)(%?)/.exec(c);
    if (ok) return (ok[2] ? ok[1] / 100 : +ok[1]) > 0.6;
    const m = c.match(/[\d.]+/g);
    if (!m || m.length < 3) return false;
    return (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255 > 0.6;
  }

  function svg(u, W, o = {}) {
    const ph = o.ph || 150;
    const hue = o.dark ? { a: '#3987e5', b: '#d95926' } : { a: '#2a78d6', b: '#eb6834' };
    const rows = u.prompts, n = rows.length || 1;
    const one = !!o.combined;
    const L = 46, R = one ? 38 : 6, FS = 12;
    const cost = one || o.costPh !== 0;
    // Combined, the cost panel is the context panel.
    const t1 = one ? 18 : 22, h1 = ph, t2 = one ? t1 : t1 + h1 + 44, h2 = one ? h1 : cost ? (o.costPh || ph) : 0;
    const foot = cost ? t2 + h2 : t1 + h1, xrow = one ? 16 : 24, H = foot + xrow;
    const pw = W - L - R, band = pw / n;
    const X = (k) => L + band * (k + 0.5);
    const f = (v) => Math.round(v * 10) / 10;
    // Ticks at 1, 2, 2.5 or 5 of a power of ten, about four to a panel and
    // two to a short one.
    const ticks = (max, h) => {
      if (!(max > 0)) return [0, 1];
      const raw = max / (h < 120 ? 2 : 4), p = 10 ** Math.floor(Math.log10(raw));
      const step = [1, 2, 2.5, 5, 10].map(m => m * p).find(s => s >= raw);
      const out = [];
      for (let v = 0; v < max + step * 0.999; v += step) out.push(+v.toPrecision(12));
      return out;
    };
    // Two intervals exactly, so two axes on one panel share their gridlines.
    const halves = (max) => {
      const raw = max / 2, p = 10 ** Math.floor(Math.log10(raw));
      const step = [1, 2, 2.5, 5, 10].map(m => m * p).find(s => s >= raw);
      return [0, step, +(2 * step).toPrecision(12)];
    };
    const usd = (v, step) => '$' + (step < 1 ? v.toFixed(2) : v);
    const ctxMax = Math.max(1, ...rows.map(r => r.context || 0), ...u.compactions.map(c => c.before || 0));
    const t1s = one ? halves(ctxMax) : ticks(ctxMax, h1), y1max = t1s[t1s.length - 1];
    const costMax = Math.max(0.01, ...rows.map(r => r.cost));
    const t2s = !cost ? [] : one ? halves(costMax) : ticks(costMax, h2), y2max = t2s[t2s.length - 1], step2 = t2s[1] - t2s[0];
    const Y1 = (v) => t1 + h1 - (v / y1max) * h1;
    const Y2 = (v) => t2 + h2 - (v / y2max) * h2;
    const ink = 'fill="currentColor"';
    const S = [];
    S.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" class="block select-none" font-size="${FS}" role="img" aria-label="${cost ? 'Context and cost of each prompt' : 'Context after each prompt'}">`);
    // Combined: one row of legend, each series named beside its swatch. A
    // bar is one prompt's cost at API list prices, and the session's totals
    // follow the names while the row has room.
    if (one) {
      const tt = u.totals || {};
      const entries = (full) => [
        ['line', 'context'],
        ['bar', 'cost per prompt' + (full && Number.isFinite(tt.modelled) ? ', ' + money(tt.modelled) + ' total' : '')],
        ...(rows.some(r => r.reload) ? [['idle', 'idle re-load' + (full && Number.isFinite(tt.reload) ? ', ' + money(tt.reload) + ' of it' : '')]] : []),
      ];
      const width = (es) => es.reduce((w, e) => w + 18 + e[1].length * 6.4 + 12, -12);
      const es = width(entries(true)) <= W ? entries(true) : entries(false);
      let lx = 0;
      for (const [kind, label] of es) {
        S.push(kind === 'line'
          ? `<line x1="${f(lx)}" x2="${f(lx + 12)}" y1="${t1 - 12}" y2="${t1 - 12}" stroke="${hue.a}" stroke-width="2" stroke-linecap="round"/>`
          : `<rect x="${f(lx + 1)}" y="${t1 - 17}" width="10" height="10" rx="2" ${kind === 'idle' ? `fill="${hue.b}"` : `${ink} fill-opacity=".3"`}/>`);
        S.push(`<text data-usage-legend="${kind}" x="${f(lx + 18)}" y="${t1 - 8}" ${ink} fill-opacity=".7">${attr(label)}</text>`);
        lx += 18 + label.length * 6.4 + 12;
      }
    }
    // Panel headings and the legend: chrome, in the text colour.
    if (!one) S.push(`<text x="0" y="${t1 - 10}" ${ink} fill-opacity=".75" font-weight="600">Context after each prompt</text>`);
    if (o.link && !one) S.push(`<a href="${attr(o.link.href)}" data-usage-link><text x="${W - R}" y="${t1 - 10}" text-anchor="end" class="fill-primary underline-offset-2 hover:underline">${attr(o.link.label)}</text></a>`);
    if (cost && !one) {
      S.push(`<text x="0" y="${t2 - 12}" ${ink} fill-opacity=".75" font-weight="600">Cost of each prompt</text>`);
      const leg = [['idle re-load', hue.b], ['warm cache', hue.a]];
      let lx = W - R;
      for (const [label, c] of leg) {
        const tw = label.length * 6.4;
        lx -= tw;
        S.push(`<text x="${f(lx)}" y="${t2 - 12}" ${ink} fill-opacity=".7">${label}</text>`);
        lx -= 14;
        S.push(`<rect x="${f(lx)}" y="${t2 - 21}" width="10" height="10" rx="2" fill="${c}"/>`);
        lx -= 12;
      }
    }
    // Gridlines and their labels, recessive.
    for (const v of t1s) S.push(`<line x1="${L}" x2="${W - R}" y1="${f(Y1(v))}" y2="${f(Y1(v))}" stroke="currentColor" stroke-opacity=".12"/>`
      + `<text x="${L - 6}" y="${f(Y1(v) + 4)}" text-anchor="end" ${one ? `fill="${hue.a}"` : `${ink} fill-opacity=".55"`}>${tok(v)}</text>`);
    for (const v of t2s) S.push(one
      ? `<text data-usage-right x="${W - R + 6}" y="${f(Y2(v) + 4)}" ${ink} fill-opacity=".55">${usd(v, step2)}</text>`
      : `<line x1="${L}" x2="${W - R}" y1="${f(Y2(v))}" y2="${f(Y2(v))}" stroke="currentColor" stroke-opacity=".12"/>`
        + `<text x="${L - 6}" y="${f(Y2(v) + 4)}" text-anchor="end" ${ink} fill-opacity=".55">${usd(v, step2)}</text>`);
    // The picked compaction's column, in the line's hue, under everything:
    // which drop the reader is looking at. At least 8px wide, so it shows
    // when the prompts are packed.
    const picked = o.pick >= 0 ? u.compactions[o.pick] : null;
    const pk = picked ? rows.findIndex(r => r.n === picked.prompt) : -1;
    if (pk >= 0) {
      const pw2 = Math.max(band, 8);
      S.push(`<rect data-usage-pick x="${f(X(pk) - pw2 / 2)}" y="${t1}" width="${f(pw2)}" height="${h1}" fill="${hue.a}" fill-opacity="${o.dark ? .26 : .16}" pointer-events="none"/>`);
    }
    // The marked prompt's band across both panels, under the marks.
    S.push(`<rect data-cost-band x="0" y="${t1}" width="${f(Math.max(band, 2))}" height="${foot - t1}" fill="currentColor" fill-opacity=".08" visibility="hidden" pointer-events="none"/>`);
    // Bars: the warm part from the axis, the idle re-load stacked on it.
    if (cost) {
      const bw = band >= 4 ? band - Math.max(1, band * 0.25) : band * 0.85;
      rows.forEach((r, k) => {
        const x = f(X(k) - bw / 2), base = t2 + h2;
        const hr = (r.rest / y2max) * h2, hl = (r.reload / y2max) * h2;
        if (hr > 0) S.push(`<rect data-usage-bar x="${x}" y="${f(base - hr)}" width="${f(bw)}" height="${f(hr)}" ${one ? `${ink} fill-opacity=".3"` : `fill="${hue.a}"`}/>`);
        if (hl > 0) {
          const gap = hl > 3 && bw > 3 ? 1 : 0;
          S.push(`<rect x="${x}" y="${f(base - hr - hl)}" width="${f(bw)}" height="${f(Math.max(0, hl - gap))}" fill="${hue.b}"/>`);
        }
      });
    }
    // The context line. A compaction draws the climb to the context it
    // compacted, then a dashed drop to where the prompt ended.
    const byPrompt = new Map();
    for (const c of u.compactions) if (c.prompt) (byPrompt.get(c.prompt) || byPrompt.set(c.prompt, []).get(c.prompt)).push(c);
    let d = '', pen = false;
    const drops = [];
    rows.forEach((r, k) => {
      if (r.context == null) return;
      const x = f(X(k));
      const cs = byPrompt.get(r.n) || [];
      if (cs.length && pen) {
        const top = Math.max(...cs.map(c => c.before || 0));
        d += `L${x},${f(Y1(top))} `;
        drops.push(`<line x1="${x}" x2="${x}" y1="${f(Y1(top))}" y2="${f(Y1(r.context))}" stroke="${hue.a}" stroke-width="1.5" stroke-dasharray="3 3"/>`);
        pen = false;
      }
      d += `${pen ? 'L' : 'M'}${x},${f(Y1(r.context))} `;
      pen = true;
    });
    S.push(`<path d="${d.trim()}" fill="none" stroke="${hue.a}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`, ...drops);
    // The hover dot on the line.
    S.push(`<circle data-cost-dot r="3.5" cx="0" cy="0" fill="${hue.a}" class="stroke-base-100" stroke-width="1.5" visibility="hidden" pointer-events="none"/>`);
    // Prompt numbers under the bars, spaced to stay apart at any width.
    const every = [1, 2, 5, 10, 20, 50, 100, 200, 500].find(s => s * band >= 26) || 1000;
    const xy = foot + (one ? 13 : 17);
    S.push(`<text x="${L - 6}" y="${xy}" text-anchor="end" ${ink} fill-opacity=".55">prompt</text>`);
    rows.forEach((r, k) => {
      // The first prompt is labelled too, where it clears the next label.
      if (r.n % every && !(r.n === 1 && (every - 1) * band >= 26)) return;
      S.push(`<text x="${f(X(k))}" y="${xy}" text-anchor="middle" ${ink} fill-opacity=".55">${r.n}</text>`);
    });
    // Hit areas, one per prompt in each panel, so a title-tip opens beside
    // the mark under the pointer. They carry the figures.
    const when = (iso) => {
      const t = new Date(iso);
      return Number.isNaN(t.getTime()) ? '' : t.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ', '
        + t.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    };
    rows.forEach((r, k) => {
      const tip = [when(r.at), plural(r.steps, 'model step'),
                   r.context != null ? tok(r.context) + ' context' : '',
                   money(r.cost) + (r.reload ? ', ' + money(r.reload) + ' of it idle re-load' : '')
                     + (r.unpriced ? ' (partly unpriced)' : ''),
                   r.compaction ? 'compacted' : ''].filter(Boolean).join(' · ');
      const a = `data-k="${k}" data-title-tip="${tip}" data-title-tip-lead="Prompt ${r.n}" data-title-tip-bare fill="transparent" class="cursor-pointer outline-none"`;
      S.push(`<rect ${a} x="${f(L + band * k)}" y="${t1}" width="${f(band)}" height="${h1}"/>`
        + (cost && !one ? `<rect ${a} x="${f(L + band * k)}" y="${t2}" width="${f(band)}" height="${h2}"/>` : ''));
    });
    // Compaction marks, last so they take the pointer: each opens its
    // summary. The picked one is filled in the line's hue.
    const href = o.href || summaryHref;
    let ci = 0;
    for (const c of u.compactions) {
      ci++;
      const k = rows.findIndex(r => r.n === c.prompt);
      if (k < 0 || c.before == null || !c.name) continue;
      const x = f(X(k)), y = f(Y1(c.before));
      const tip = 'Compaction ' + ci + ' of ' + u.compactions.length + ': ' + tok(c.before) + ' to '
        + (c.after != null ? tok(c.after) : '?') + ' context, a summary of ' + c.chars.toLocaleString('en-US') + ' characters';
      const on = c === picked;
      S.push(`<a href="${attr(href(c))}" target="_top" data-cost-compaction${o.href ? ` data-name="${c.name}"` : ''}${on ? ' data-picked' : ''} data-title-tip="${tip}" aria-label="${tip}">`
        + `<circle cx="${x}" cy="${y}" r="12" fill="transparent"/>`
        + (on ? `<circle cx="${x}" cy="${y}" r="6" fill="${hue.a}" class="stroke-base-100" stroke-width="2"/></a>`
          : `<circle cx="${x}" cy="${y}" r="4.5" class="fill-base-100" stroke="currentColor" stroke-opacity=".75" stroke-width="1.5"/></a>`));
    }
    S.push('</svg>');
    return S.join('');
  }

  // Mark prompt k (or none) in both panels: the band and the dot.
  function mark(host, u, k) {
    const svg = host?.querySelector('svg');
    if (!svg) return;
    const band = svg.querySelector('[data-cost-band]'), dot = svg.querySelector('[data-cost-dot]');
    const hit = k >= 0 ? svg.querySelector(`rect[data-k="${k}"]`) : null;
    const r = k >= 0 ? u?.prompts[k] : null;
    if (!hit || !r) { band.setAttribute('visibility', 'hidden'); dot.setAttribute('visibility', 'hidden'); return; }
    band.setAttribute('x', hit.getAttribute('x'));
    band.setAttribute('visibility', 'visible');
    const line = svg.querySelector('path');
    if (r.context == null || !line) { dot.setAttribute('visibility', 'hidden'); return; }
    // The dot sits on the line's own vertex for this prompt.
    const pts = (line.getAttribute('d').match(/[ML][\d.]+,[\d.]+/g) || []).map(s => s.slice(1).split(',').map(Number));
    const cx = +hit.getAttribute('x') + (+hit.getAttribute('width')) / 2;
    const v = pts.filter(p => Math.abs(p[0] - cx) < 0.2).pop();
    if (!v) { dot.setAttribute('visibility', 'hidden'); return; }
    dot.setAttribute('cx', v[0]); dot.setAttribute('cy', v[1]);
    dot.setAttribute('visibility', 'visible');
  }

  const at = (e) => {
    const el = e && e.target instanceof Element ? e.target.closest('[data-k]') : null;
    return el ? +el.getAttribute('data-k') : -1;
  };

  window.UsageChart = { svg, mark, at, dark, money, plural, tok };
})();
