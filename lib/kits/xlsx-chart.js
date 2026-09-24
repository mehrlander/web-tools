// lib/kits/xlsx-chart.js — Native zero-dependency SVG renderer for Excel charts.
// Translates OpenXML chart models (<c:chartSpace>) into crisp, responsive vector graphics
// matching Microsoft Excel's native styling (Aptos / Calibri, Excel Office theme palettes,
// clustered columns, horizontal bars, multi-series lines with markers, and pie/doughnut slices).
(() => {
  const EXCEL_PALETTE = [
    '#1b6288', // Teal-Blue (Office Accent 1)
    '#e46c24', // Orange (Office Accent 2)
    '#24693d', // Green (Office Accent 3)
    '#0f82c2', // Light Blue (Office Accent 4)
    '#942c7f', // Purple / Magenta (Office Accent 5)
    '#e5b422', // Gold / Yellow (Office Accent 6)
    '#41719c', // Steel Blue
    '#9dc3e6', // Soft Light Blue
  ];

  const tag = (node) => node.localName || String(node.nodeName).replace(/^.*:/, '');
  const kidsNamed = (node, name) => [...(node?.children || [])].filter(c => tag(c) === name);
  const kidNamed = (node, name) => kidsNamed(node, name)[0];

  function esc(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function niceTicks(min, max, targetCount = 5) {
    if (min === max) {
      min = min > 0 ? 0 : min - 1;
      max = max < 0 ? 0 : max + 1;
    }
    const span = max - min;
    const rawStep = span / targetCount;
    const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const residual = rawStep / mag;
    let step;
    if (residual <= 1.5) step = 1 * mag;
    else if (residual <= 3) step = 2 * mag;
    else if (residual <= 7) step = 5 * mag;
    else step = 10 * mag;

    const niceMin = Math.floor(min / step) * step;
    let niceMax = Math.ceil(max / step) * step;
    if ((max - niceMin) / (niceMax - niceMin || 1) > 0.85) {
      niceMax += step;
    }

    const ticks = [];
    for (let v = niceMin; v <= niceMax + step * 0.0001; v += step) {
      ticks.push(Math.round(v * 1e9) / 1e9);
    }
    return { min: niceMin, max: niceMax, step, ticks };
  }

  function formatValue(v, fmt) {
    if (!fmt) return v.toLocaleString('en-US');
    if (fmt.includes('%')) {
      const p = (v * 100);
      return (fmt.includes('.0') ? p.toFixed(1) : Math.round(p)) + '%';
    }
    const isCurrency = fmt.includes('$');
    const hasPlus = fmt.includes('+');
    const hasMinusPrefix = fmt.includes('$-');
    const absStr = Math.abs(v).toLocaleString('en-US');
    if (v < 0) {
      if (isCurrency) {
        return hasMinusPrefix ? `$-${absStr}` : `-$${absStr}`;
      }
      return `-${absStr}`;
    }
    if (v > 0 && hasPlus) {
      return isCurrency ? `$+${absStr}` : `+${absStr}`;
    }
    if (isCurrency) {
      return `$${absStr}`;
    }
    return absStr;
  }

  function parseChartXml(docOrStr) {
    let doc = docOrStr;
    if (typeof docOrStr === 'string') {
      const Parser = typeof DOMParser !== 'undefined' ? DOMParser : globalThis.DOMParser;
      doc = new Parser().parseFromString(docOrStr, 'text/xml');
    }
    if (!doc) return null;
    const all = [...doc.getElementsByTagName('*')];

    // Chart Title
    let title = '';
    const titleEl = all.find(e => tag(e) === 'title');
    if (titleEl) {
      const texts = [...titleEl.getElementsByTagName('*')].filter(e => tag(e) === 't' || tag(e) === 'v');
      title = texts.map(t => t.textContent).join(' ').trim();
    }

    // Legend
    let legend = null;
    const legendEl = all.find(e => tag(e) === 'legend');
    if (legendEl) {
      const posEl = kidNamed(legendEl, 'legendPos');
      legend = { pos: posEl?.getAttribute('val') || 'r' };
    }

    // Plot Area
    const plotEl = all.find(e => tag(e) === 'plotArea');
    if (!plotEl) return null;

    const CHART_TYPES = ['barChart', 'lineChart', 'pieChart', 'doughnutChart', 'areaChart'];
    let chartType = null;
    let typeNode = null;
    for (const ct of CHART_TYPES) {
      typeNode = kidNamed(plotEl, ct);
      if (typeNode) { chartType = ct; break; }
    }
    if (!typeNode) return null;

    const barDir = kidNamed(typeNode, 'barDir')?.getAttribute('val') || null;
    const grouping = kidNamed(typeNode, 'grouping')?.getAttribute('val') || null;

    let subType = chartType;
    if (chartType === 'barChart') {
      subType = (barDir === 'bar') ? 'bar' : 'column';
    } else if (chartType === 'lineChart') {
      subType = 'line';
    } else if (chartType === 'pieChart') {
      subType = 'pie';
    } else if (chartType === 'doughnutChart') {
      subType = 'doughnut';
    } else if (chartType === 'areaChart') {
      subType = 'area';
    }

    const serNodes = kidsNamed(typeNode, 'ser');
    const series = serNodes.map((ser, sIdx) => {
      let name = '';
      const txEl = kidNamed(ser, 'tx');
      if (txEl) {
        const v = [...txEl.getElementsByTagName('*')].find(e => tag(e) === 'v');
        if (v) name = v.textContent.trim();
      }
      if (!name) name = `Series ${sIdx + 1}`;

      const catEl = kidNamed(ser, 'cat');
      const categories = [];
      if (catEl) {
        const pts = [...catEl.getElementsByTagName('*')].filter(e => tag(e) === 'pt');
        pts.sort((a, b) => (Number(a.getAttribute('idx')) || 0) - (Number(b.getAttribute('idx')) || 0));
        pts.forEach(p => {
          const v = kidNamed(p, 'v');
          if (v) categories.push(v.textContent.trim());
        });
      }

      const valEl = kidNamed(ser, 'val');
      const values = [];
      let formatCode = '';
      if (valEl) {
        const numCache = [...valEl.getElementsByTagName('*')].find(e => tag(e) === 'numCache');
        if (numCache) {
          const fmt = kidNamed(numCache, 'formatCode');
          if (fmt) formatCode = fmt.textContent.trim();
        }
        const pts = [...valEl.getElementsByTagName('*')].filter(e => tag(e) === 'pt');
        pts.sort((a, b) => (Number(a.getAttribute('idx')) || 0) - (Number(b.getAttribute('idx')) || 0));
        pts.forEach(p => {
          const v = kidNamed(p, 'v');
          values.push(v ? Number(v.textContent.trim()) : 0);
        });
      }

      // Series color override
      let color = null;
      const spPr = kidNamed(ser, 'spPr');
      if (spPr) {
        const srgbClr = [...spPr.getElementsByTagName('*')].find(e => tag(e) === 'srgbClr');
        if (srgbClr) color = '#' + srgbClr.getAttribute('val');
      }

      return { name, categories, values, formatCode, color };
    });

    // Propagate categories if later series omitted them
    if (series.length > 1 && series[0].categories.length > 0) {
      series.forEach(s => {
        if (!s.categories.length) s.categories = series[0].categories;
      });
    }

    return { title, chartType, subType, grouping, legend, series };
  }

  function renderSvg(chart, width = 480, height = 280, opts = {}) {
    if (!chart || !chart.series?.length) {
      return `<svg class="xl-chart" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><text x="${width/2}" y="${height/2}" text-anchor="middle" font-size="12" fill="#666">No chart data</text></svg>`;
    }

    const categories = chart.series[0]?.categories || [];
    const N = categories.length;
    const hasLegend = !!chart.legend && chart.series.length > 0;
    const legendOnRight = hasLegend && (chart.legend.pos === 'r' || chart.legend.pos === 'tr');
    const hasTitle = !!chart.title;

    const titleHeight = hasTitle ? 32 : 12;
    const rightMargin = legendOnRight ? 125 : 20;

    // 1. Clustered Column Chart
    if (chart.subType === 'column') {
      let min = 0;
      let max = 0;
      chart.series.forEach(s => s.values.forEach(v => {
        if (v < min) min = v;
        if (v > max) max = v;
      }));
      if (min >= 0) min = 0;

      const scale = niceTicks(min, max, 5);
      const leftMargin = 60;
      const bottomMargin = 45;
      const topMargin = titleHeight + 10;

      const pw = width - leftMargin - rightMargin;
      const ph = height - topMargin - bottomMargin;

      const y = (val) => topMargin + (scale.max - val) / (scale.max - scale.min) * ph;
      const yZero = y(0);

      const parts = [];
      parts.push(`<svg class="xl-chart" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" style="font-family: Aptos, Calibri, -apple-system, sans-serif; background: #ffffff; border: 1px solid #d9d9d9; box-sizing: border-box; display: block;">`);

      if (hasTitle) {
        parts.push(`<text x="${width / 2}" y="22" text-anchor="middle" font-size="14" font-weight="bold" fill="#000000">${esc(chart.title)}</text>`);
      }

      const fmt = chart.series[0]?.formatCode || '';
      scale.ticks.forEach(t => {
        const py = Math.round(y(t));
        parts.push(`<line x1="${leftMargin}" y1="${py}" x2="${leftMargin + pw}" y2="${py}" stroke="#bfbfbf" stroke-width="1" />`);
        parts.push(`<text x="${leftMargin - 8}" y="${py + 4}" text-anchor="end" font-size="11" fill="#333333">${esc(formatValue(t, fmt))}</text>`);
      });

      parts.push(`<line x1="${leftMargin}" y1="${Math.round(yZero)}" x2="${leftMargin + pw}" y2="${Math.round(yZero)}" stroke="#808080" stroke-width="1" />`);

      const S = chart.series.length;
      const slotW = pw / (N || 1);
      const clusterW = slotW * 0.7;
      const barW = Math.max(2, clusterW / S);

      for (let c = 0; c < N; c++) {
        const cx = leftMargin + c * slotW + (slotW - clusterW) / 2;
        chart.series.forEach((s, sIdx) => {
          const val = s.values[c] || 0;
          const color = s.color || EXCEL_PALETTE[sIdx % EXCEL_PALETTE.length];
          const bx = Math.round(cx + sIdx * barW);
          const by = Math.round(val >= 0 ? y(val) : yZero);
          const bh = Math.round(Math.abs(y(val) - yZero));
          parts.push(`<rect x="${bx}" y="${by}" width="${Math.max(1, Math.round(barW))}" height="${bh}" fill="${color}" />`);
        });

        const labelX = leftMargin + (c + 0.5) * slotW;
        const catText = categories[c] || '';
        const words = catText.split(' ');
        if (words.length >= 2 && (catText.length > 10 || slotW < 90)) {
          const mid = Math.ceil(words.length / 2);
          const l1 = words.slice(0, mid).join(' ');
          const l2 = words.slice(mid).join(' ');
          parts.push(`<text x="${labelX}" y="${height - bottomMargin + 14}" text-anchor="middle" font-size="10" fill="#333333">${esc(l1)}</text>`);
          parts.push(`<text x="${labelX}" y="${height - bottomMargin + 26}" text-anchor="middle" font-size="10" fill="#333333">${esc(l2)}</text>`);
        } else {
          parts.push(`<text x="${labelX}" y="${height - bottomMargin + 16}" text-anchor="middle" font-size="10" fill="#333333">${esc(catText)}</text>`);
        }
        parts.push(`<line x1="${labelX}" y1="${Math.round(yZero)}" x2="${labelX}" y2="${Math.round(yZero) + 4}" stroke="#808080" stroke-width="1" />`);
      }

      if (hasLegend) {
        const legX = width - rightMargin + 15;
        const totalLegHeight = chart.series.length * 20;
        const legY = Math.max(topMargin, topMargin + (ph - totalLegHeight) / 2);
        chart.series.forEach((s, sIdx) => {
          const ly = legY + sIdx * 20;
          const color = s.color || EXCEL_PALETTE[sIdx % EXCEL_PALETTE.length];
          parts.push(`<rect x="${legX}" y="${ly}" width="10" height="10" fill="${color}" />`);
          parts.push(`<text x="${legX + 16}" y="${ly + 9}" font-size="11" fill="#333333">${esc(s.name)}</text>`);
        });
      }

      parts.push(`</svg>`);
      return parts.join('\n');
    }

    // 2. Horizontal Bar Chart
    if (chart.subType === 'bar') {
      let min = 0;
      let max = 0;
      chart.series.forEach(s => s.values.forEach(v => {
        if (v < min) min = v;
        if (v > max) max = v;
      }));

      const scale = niceTicks(min, max, 5);
      const maxCatLen = Math.max(...categories.map(c => String(c || '').length), 5);
      const leftMargin = Math.max(90, Math.min(160, maxCatLen * 6.8 + 16));
      const bottomMargin = 40;
      const topMargin = titleHeight + 10;

      const pw = width - leftMargin - rightMargin;
      const ph = height - topMargin - bottomMargin;

      const x = (val) => leftMargin + (val - scale.min) / (scale.max - scale.min) * pw;
      const xZero = x(0);

      const parts = [];
      parts.push(`<svg class="xl-chart" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" style="font-family: Aptos, Calibri, -apple-system, sans-serif; background: #ffffff; border: 1px solid #d9d9d9; box-sizing: border-box; display: block;">`);

      if (hasTitle) {
        parts.push(`<text x="${width / 2}" y="22" text-anchor="middle" font-size="14" font-weight="bold" fill="#000000">${esc(chart.title)}</text>`);
      }

      const fmt = chart.series[0]?.formatCode || '';
      scale.ticks.forEach(t => {
        const px = Math.round(x(t));
        parts.push(`<line x1="${px}" y1="${topMargin}" x2="${px}" y2="${topMargin + ph}" stroke="#bfbfbf" stroke-width="1" />`);
        parts.push(`<text x="${px}" y="${topMargin + ph + 16}" text-anchor="middle" font-size="11" fill="#333333">${esc(formatValue(t, fmt))}</text>`);
      });

      parts.push(`<line x1="${Math.round(xZero)}" y1="${topMargin}" x2="${Math.round(xZero)}" y2="${topMargin + ph}" stroke="#808080" stroke-width="1" />`);

      const S = chart.series.length;
      const slotH = ph / (N || 1);
      const clusterH = slotH * 0.55;
      const barH = Math.max(2, clusterH / S);

      for (let c = 0; c < N; c++) {
        const renderIdx = (N - 1) - c;
        const cy = topMargin + renderIdx * slotH + (slotH - clusterH) / 2;
        chart.series.forEach((s, sIdx) => {
          const val = s.values[c] || 0;
          const color = s.color || EXCEL_PALETTE[sIdx % EXCEL_PALETTE.length];
          const by = Math.round(cy + sIdx * barH);
          const bx = Math.round(val >= 0 ? xZero : x(val));
          const bw = Math.round(Math.abs(x(val) - xZero));
          parts.push(`<rect x="${bx}" y="${by}" width="${bw}" height="${Math.round(barH)}" fill="${color}" />`);
        });

        const labelY = topMargin + (renderIdx + 0.5) * slotH;
        const catText = categories[c] || '';
        parts.push(`<text x="${leftMargin - 8}" y="${labelY + 4}" text-anchor="end" font-size="11" fill="#333333">${esc(catText)}</text>`);
        parts.push(`<line x1="${leftMargin - 4}" y1="${labelY}" x2="${leftMargin}" y2="${labelY}" stroke="#808080" stroke-width="1" />`);
      }

      parts.push(`</svg>`);
      return parts.join('\n');
    }

    // 3. Line Chart
    if (chart.subType === 'line') {
      let min = 0;
      let max = 0;
      chart.series.forEach(s => s.values.forEach(v => {
        if (v < min) min = v;
        if (v > max) max = v;
      }));
      if (min >= 0) min = 0;

      const scale = niceTicks(min, max, 5);
      const leftMargin = 60;
      const bottomMargin = 35;
      const topMargin = titleHeight + 10;

      const pw = width - leftMargin - rightMargin;
      const ph = height - topMargin - bottomMargin;

      const y = (val) => topMargin + (scale.max - val) / (scale.max - scale.min) * ph;
      const yZero = y(0);

      const parts = [];
      parts.push(`<svg class="xl-chart" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" style="font-family: Aptos, Calibri, -apple-system, sans-serif; background: #ffffff; border: 1px solid #d9d9d9; box-sizing: border-box; display: block;">`);

      if (hasTitle) {
        parts.push(`<text x="${width / 2}" y="22" text-anchor="middle" font-size="14" font-weight="bold" fill="#000000">${esc(chart.title)}</text>`);
      }

      const fmt = chart.series[0]?.formatCode || '';
      scale.ticks.forEach(t => {
        const py = Math.round(y(t));
        parts.push(`<line x1="${leftMargin}" y1="${py}" x2="${leftMargin + pw}" y2="${py}" stroke="#bfbfbf" stroke-width="1" />`);
        parts.push(`<text x="${leftMargin - 8}" y="${py + 4}" text-anchor="end" font-size="11" fill="#333333">${esc(formatValue(t, fmt))}</text>`);
      });

      parts.push(`<line x1="${leftMargin}" y1="${Math.round(yZero)}" x2="${leftMargin + pw}" y2="${Math.round(yZero)}" stroke="#808080" stroke-width="1" />`);

      const slotW = pw / (N || 1);
      for (let c = 0; c < N; c++) {
        const lx = leftMargin + (c + 0.5) * slotW;
        parts.push(`<text x="${lx}" y="${height - bottomMargin + 16}" text-anchor="middle" font-size="11" fill="#333333">${esc(categories[c] || '')}</text>`);
        parts.push(`<line x1="${lx}" y1="${Math.round(yZero)}" x2="${lx}" y2="${Math.round(yZero) + 4}" stroke="#808080" stroke-width="1" />`);
      }

      chart.series.forEach((s, sIdx) => {
        const color = s.color || EXCEL_PALETTE[sIdx % EXCEL_PALETTE.length];
        const pts = [];
        for (let c = 0; c < N; c++) {
          const px = leftMargin + (c + 0.5) * slotW;
          const py = y(s.values[c] || 0);
          pts.push({ x: px, y: py });
        }

        const d = pts.map((p, idx) => (idx === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');
        parts.push(`<path d="${d}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />`);

        pts.forEach(p => {
          if (sIdx === 0) {
            parts.push(`<polygon points="${p.x},${p.y - 5} ${p.x + 5},${p.y} ${p.x},${p.y + 5} ${p.x - 5},${p.y}" fill="${color}" stroke="#ffffff" stroke-width="1" />`);
          } else if (sIdx === 1) {
            parts.push(`<rect x="${p.x - 4}" y="${p.y - 4}" width="8" height="8" fill="${color}" stroke="#ffffff" stroke-width="1" />`);
          } else if (sIdx === 2) {
            parts.push(`<polygon points="${p.x},${p.y - 5} ${p.x + 5},${p.y + 4} ${p.x - 5},${p.y + 4}" fill="${color}" stroke="#ffffff" stroke-width="1" />`);
          } else {
            parts.push(`<circle cx="${p.x}" cy="${p.y}" r="4" fill="${color}" stroke="#ffffff" stroke-width="1" />`);
          }
        });
      });

      if (hasLegend) {
        const legX = width - rightMargin + 15;
        const totalLegHeight = chart.series.length * 20;
        const legY = Math.max(topMargin, topMargin + (ph - totalLegHeight) / 2);
        chart.series.forEach((s, sIdx) => {
          const ly = legY + sIdx * 20;
          const color = s.color || EXCEL_PALETTE[sIdx % EXCEL_PALETTE.length];
          parts.push(`<line x1="${legX}" y1="${ly + 5}" x2="${legX + 16}" y2="${ly + 5}" stroke="${color}" stroke-width="3" />`);
          if (sIdx === 0) {
            parts.push(`<polygon points="${legX + 8},${ly + 1} ${legX + 12},${ly + 5} ${legX + 8},${ly + 9} ${legX + 4},${ly + 5}" fill="${color}" stroke="#ffffff" stroke-width="0.5" />`);
          } else if (sIdx === 1) {
            parts.push(`<rect x="${legX + 5}" y="${ly + 2}" width="6" height="6" fill="${color}" stroke="#ffffff" stroke-width="0.5" />`);
          } else if (sIdx === 2) {
            parts.push(`<polygon points="${legX + 8},${ly + 1} ${legX + 12},${ly + 8} ${legX + 4},${ly + 8}" fill="${color}" stroke="#ffffff" stroke-width="0.5" />`);
          } else {
            parts.push(`<circle cx="${legX + 8}" cy="${ly + 5}" r="3" fill="${color}" stroke="#ffffff" stroke-width="0.5" />`);
          }
          parts.push(`<text x="${legX + 22}" y="${ly + 9}" font-size="11" fill="#333333">${esc(s.name)}</text>`);
        });
      }

      parts.push(`</svg>`);
      return parts.join('\n');
    }

    // 4. Pie / Doughnut Chart
    if (chart.subType === 'pie' || chart.subType === 'doughnut') {
      const values = chart.series[0]?.values || [];
      const total = values.reduce((a, b) => a + b, 0) || 1;
      const isDoughnut = chart.subType === 'doughnut';

      const topMargin = titleHeight + 10;
      const bottomMargin = 20;
      const leftMargin = 20;

      const pw = width - leftMargin - rightMargin;
      const ph = height - topMargin - bottomMargin;

      const cx = leftMargin + pw / 2;
      const cy = topMargin + ph / 2;
      const r = Math.min(pw, ph) / 2 * 0.9;
      const rInner = isDoughnut ? r * 0.55 : 0;

      const parts = [];
      parts.push(`<svg class="xl-chart" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" style="font-family: Aptos, Calibri, -apple-system, sans-serif; background: #ffffff; border: 1px solid #d9d9d9; box-sizing: border-box; display: block;">`);

      if (hasTitle) {
        parts.push(`<text x="${width / 2}" y="22" text-anchor="middle" font-size="14" font-weight="bold" fill="#000000">${esc(chart.title)}</text>`);
      }

      let currentAngle = -Math.PI / 2;
      values.forEach((v, idx) => {
        const sliceAngle = (v / total) * (Math.PI * 2);
        const startAngle = currentAngle;
        const endAngle = currentAngle + sliceAngle;
        currentAngle = endAngle;

        const x1 = cx + r * Math.cos(startAngle);
        const y1 = cy + r * Math.sin(startAngle);
        const x2 = cx + r * Math.cos(endAngle);
        const y2 = cy + r * Math.sin(endAngle);
        const largeArc = sliceAngle > Math.PI ? 1 : 0;

        const color = EXCEL_PALETTE[idx % EXCEL_PALETTE.length];

        let d;
        if (isDoughnut) {
          const ix1 = cx + rInner * Math.cos(startAngle);
          const iy1 = cy + rInner * Math.sin(startAngle);
          const ix2 = cx + rInner * Math.cos(endAngle);
          const iy2 = cy + rInner * Math.sin(endAngle);
          d = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${rInner} ${rInner} 0 ${largeArc} 0 ${ix1} ${iy1} Z`;
        } else {
          d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
        }
        parts.push(`<path d="${d}" fill="${color}" stroke="#ffffff" stroke-width="1" />`);
      });

      if (hasLegend) {
        const legX = width - rightMargin + 10;
        const totalLegHeight = categories.length * 20;
        const legY = Math.max(topMargin, topMargin + (ph - totalLegHeight) / 2);
        categories.forEach((cat, idx) => {
          const ly = legY + idx * 20;
          const color = EXCEL_PALETTE[idx % EXCEL_PALETTE.length];
          parts.push(`<rect x="${legX}" y="${ly}" width="10" height="10" fill="${color}" />`);
          parts.push(`<text x="${legX + 16}" y="${ly + 9}" font-size="11" fill="#333333">${esc(cat)}</text>`);
        });
      }

      parts.push(`</svg>`);
      return parts.join('\n');
    }

    return `<svg class="xl-chart" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><text x="${width/2}" y="${height/2}" text-anchor="middle">Unsupported Chart</text></svg>`;
  }

  const api = {
    EXCEL_PALETTE,
    niceTicks,
    formatValue,
    parseChartXml,
    renderSvg,
  };

  if (typeof window !== 'undefined') {
    window.xlsxChartKit = api;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})();
