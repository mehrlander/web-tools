// lib/kits/xlsx-chart.js - Browser SVG previews of supported Excel chart models.
// xlsx.js owns parsing and reference resolution. These previews approximate Excel
// layout; they are not images rendered by Excel and do not recalculate formulas.
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

  const esc = value => window.esc(value);

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

  function axisTicks(axis, min, max) {
    const automatic = niceTicks(min, max, 5);
    const lo = axis?.min ?? automatic.min, hi = axis?.max ?? automatic.max;
    const step = axis?.majorUnit ?? automatic.step;
    if (!(hi > lo) || !(step > 0) || (hi - lo) / step > 1000) return null;
    const ticks = [];
    for (let i = 0; lo + i * step <= hi + step * 1e-9; i++) ticks.push(Number((lo + i * step).toPrecision(12)));
    return { min: lo, max: hi, step, ticks };
  }

  function unavailable(chart, width, height, reason) {
    return `<svg class="xl-chart" data-chart-status="unsupported" role="img" aria-label="${esc(chart?.title || 'Chart')}: preview unavailable" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" style="background:white;border:1px solid #d9d9d9;font-family:Calibri,sans-serif">
      <text x="${width / 2}" y="${height / 2 - 24}" text-anchor="middle" font-size="14">Chart preview unavailable</text>
      <text x="${width / 2}" y="${height / 2}" text-anchor="middle" font-size="12">${esc(reason)}</text>
      <text x="${width / 2}" y="${height / 2 + 24}" text-anchor="middle" font-size="12">Open the workbook in Excel.</text></svg>`;
  }

  function markerSvg(marker, index, x, y, color) {
    const symbol = marker?.symbol === 'auto' ? ['diamond', 'square', 'triangle', 'circle'][index % 4] : marker?.symbol;
    const r = Math.max(1, Math.min(72, marker?.size || 5)) * 2 / 3;
    const paint = `data-chart-marker="${esc(symbol)}" fill="${color}" stroke="${color}" stroke-width="1"`;
    if (!symbol || symbol === 'none') return '';
    if (symbol === 'circle') return `<circle cx="${x}" cy="${y}" r="${r}" ${paint}/>`;
    if (symbol === 'square') return `<rect x="${x-r}" y="${y-r}" width="${2*r}" height="${2*r}" ${paint}/>`;
    if (symbol === 'diamond') return `<polygon points="${x},${y-r} ${x+r},${y} ${x},${y+r} ${x-r},${y}" ${paint}/>`;
    if (symbol === 'triangle') return `<polygon points="${x},${y-r} ${x+r},${y+r} ${x-r},${y+r}" ${paint}/>`;
    const horizontal = `M ${x-r} ${y} H ${x+r}`;
    const cross = `M ${x-r} ${y-r} L ${x+r} ${y+r} M ${x-r} ${y+r} L ${x+r} ${y-r}`;
    const plus = `${horizontal} M ${x} ${y-r} V ${y+r}`;
    const d = symbol === 'x' ? cross : symbol === 'plus' ? plus : symbol === 'star' ? `${plus} ${cross}` : horizontal;
    return `<path d="${d}" data-chart-marker="${esc(symbol)}" fill="none" stroke="${color}" stroke-width="${symbol === 'dot' ? 3 : 1.5}"/>`;
  }

  // A nested SVG clips data at the plot boundary without document-global IDs.
  const plotMark = (mark, x, y, width, height) => `<svg x="${x}" y="${y}" width="${width}" height="${height}" viewBox="${x} ${y} ${width} ${height}" overflow="hidden">${mark}</svg>`;

  function axisTitles(chart, left, top, width, height, horizontal = false) {
    const xTitle = horizontal ? chart.valueAxis?.title : chart.categoryAxis?.title;
    const yTitle = horizontal ? chart.categoryAxis?.title : chart.valueAxis?.title;
    return `${xTitle ? `<text data-axis-title="x" x="${left + width / 2}" y="${top + height + 42}" text-anchor="middle" font-size="12">${esc(xTitle)}</text>` : ''}
      ${yTitle ? `<text data-axis-title="y" transform="translate(16 ${top + height / 2}) rotate(-90)" text-anchor="middle" font-size="12">${esc(yTitle)}</text>` : ''}`;
  }

  function renderSvg(chart, width = 480, height = 280, opts = {}) {
    const reason = chart?.unsupported?.[0] ||
      (chart?.grouping && !['standard', 'clustered'].includes(chart.grouping) ? `${chart.grouping} grouping` : '') ||
      (chart && !['column', 'bar', 'line', 'pie', 'doughnut'].includes(chart.subType) ? `${chart.subType} charts` : '');
    if (reason) return unavailable(chart, width, height, reason);
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

      const scale = axisTicks(chart.valueAxis, min, max);
      if (!scale) return unavailable(chart, width, height, 'Axis bounds or tick spacing');
      const leftMargin = chart.valueAxis?.title ? 80 : 60;
      const bottomMargin = chart.categoryAxis?.title ? 67 : 45;
      const topMargin = titleHeight + 10;

      const pw = width - leftMargin - rightMargin;
      const ph = height - topMargin - bottomMargin;

      const y = (val) => topMargin + (chart.valueAxis?.reversed ? val - scale.min : scale.max - val) / (scale.max - scale.min) * ph;
      const yZero = y(Math.max(scale.min, Math.min(scale.max, 0)));

      const parts = [];
      parts.push(`<svg class="xl-chart" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" style="font-family: Aptos, Calibri, -apple-system, sans-serif; background: #ffffff; border: 1px solid #d9d9d9; box-sizing: border-box; display: block;">`);

      if (hasTitle) {
        parts.push(`<text x="${width / 2}" y="22" text-anchor="middle" font-size="14" font-weight="bold" fill="#000000">${esc(chart.title)}</text>`);
      }

      const fmt = chart.valueAxis?.formatCode || chart.series[0]?.formatCode || '';
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
        const cx = leftMargin + (chart.categoryAxis?.reversed ? N - 1 - c : c) * slotW + (slotW - clusterW) / 2;
        chart.series.forEach((s, sIdx) => {
          const val = s.values[c];
          if (!Number.isFinite(val)) return;
          const color = s.color || EXCEL_PALETTE[sIdx % EXCEL_PALETTE.length];
          const bx = Math.round(cx + sIdx * barW);
          const by = Math.round(Math.min(y(val), yZero));
          const bh = Math.round(Math.abs(y(val) - yZero));
          parts.push(plotMark(`<rect x="${bx}" y="${by}" width="${Math.max(1, Math.round(barW))}" height="${bh}" fill="${color}" />`, leftMargin, topMargin, pw, ph));
        });

        const labelX = leftMargin + ((chart.categoryAxis?.reversed ? N - 1 - c : c) + 0.5) * slotW;
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

      parts.push(axisTitles(chart, leftMargin, topMargin, pw, ph, false));
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

      const scale = axisTicks(chart.valueAxis, min, max);
      if (!scale) return unavailable(chart, width, height, 'Axis bounds or tick spacing');
      const maxCatLen = Math.max(...categories.map(c => String(c || '').length), 5);
      const leftMargin = Math.max(90, Math.min(160, maxCatLen * 6.8 + 16)) + (chart.categoryAxis?.title ? 22 : 0);
      const bottomMargin = chart.valueAxis?.title ? 62 : 40;
      const topMargin = titleHeight + 10;

      const pw = width - leftMargin - rightMargin;
      const ph = height - topMargin - bottomMargin;

      const x = (val) => leftMargin + (chart.valueAxis?.reversed ? scale.max - val : val - scale.min) / (scale.max - scale.min) * pw;
      const xZero = x(Math.max(scale.min, Math.min(scale.max, 0)));

      const parts = [];
      parts.push(`<svg class="xl-chart" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" style="font-family: Aptos, Calibri, -apple-system, sans-serif; background: #ffffff; border: 1px solid #d9d9d9; box-sizing: border-box; display: block;">`);

      if (hasTitle) {
        parts.push(`<text x="${width / 2}" y="22" text-anchor="middle" font-size="14" font-weight="bold" fill="#000000">${esc(chart.title)}</text>`);
      }

      const fmt = chart.valueAxis?.formatCode || chart.series[0]?.formatCode || '';
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
        const renderIdx = chart.categoryAxis?.reversed ? c : (N - 1) - c;
        const cy = topMargin + renderIdx * slotH + (slotH - clusterH) / 2;
        chart.series.forEach((s, sIdx) => {
          const val = s.values[c];
          if (!Number.isFinite(val)) return;
          const color = s.color || EXCEL_PALETTE[sIdx % EXCEL_PALETTE.length];
          const by = Math.round(cy + sIdx * barH);
          const bx = Math.round(Math.min(xZero, x(val)));
          const bw = Math.round(Math.abs(x(val) - xZero));
          parts.push(plotMark(`<rect x="${bx}" y="${by}" width="${bw}" height="${Math.round(barH)}" fill="${color}" />`, leftMargin, topMargin, pw, ph));
        });

        const labelY = topMargin + (renderIdx + 0.5) * slotH;
        const catText = categories[c] || '';
        parts.push(`<text x="${leftMargin - 8}" y="${labelY + 4}" text-anchor="end" font-size="11" fill="#333333">${esc(catText)}</text>`);
        parts.push(`<line x1="${leftMargin - 4}" y1="${labelY}" x2="${leftMargin}" y2="${labelY}" stroke="#808080" stroke-width="1" />`);
      }

      parts.push(axisTitles(chart, leftMargin, topMargin, pw, ph, true));
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

      const scale = axisTicks(chart.valueAxis, min, max);
      if (!scale) return unavailable(chart, width, height, 'Axis bounds or tick spacing');
      const leftMargin = chart.valueAxis?.title ? 80 : 60;
      const bottomMargin = chart.categoryAxis?.title ? 57 : 35;
      const topMargin = titleHeight + 10;

      const pw = width - leftMargin - rightMargin;
      const ph = height - topMargin - bottomMargin;

      const y = (val) => topMargin + (chart.valueAxis?.reversed ? val - scale.min : scale.max - val) / (scale.max - scale.min) * ph;
      const yZero = y(Math.max(scale.min, Math.min(scale.max, 0)));

      const parts = [];
      parts.push(`<svg class="xl-chart" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" style="font-family: Aptos, Calibri, -apple-system, sans-serif; background: #ffffff; border: 1px solid #d9d9d9; box-sizing: border-box; display: block;">`);

      if (hasTitle) {
        parts.push(`<text x="${width / 2}" y="22" text-anchor="middle" font-size="14" font-weight="bold" fill="#000000">${esc(chart.title)}</text>`);
      }

      const fmt = chart.valueAxis?.formatCode || chart.series[0]?.formatCode || '';
      scale.ticks.forEach(t => {
        const py = Math.round(y(t));
        parts.push(`<line x1="${leftMargin}" y1="${py}" x2="${leftMargin + pw}" y2="${py}" stroke="#bfbfbf" stroke-width="1" />`);
        parts.push(`<text x="${leftMargin - 8}" y="${py + 4}" text-anchor="end" font-size="11" fill="#333333">${esc(formatValue(t, fmt))}</text>`);
      });

      parts.push(`<line x1="${leftMargin}" y1="${Math.round(yZero)}" x2="${leftMargin + pw}" y2="${Math.round(yZero)}" stroke="#808080" stroke-width="1" />`);

      const slotW = pw / (N || 1);
      for (let c = 0; c < N; c++) {
        const lx = leftMargin + ((chart.categoryAxis?.reversed ? N - 1 - c : c) + 0.5) * slotW;
        parts.push(`<text x="${lx}" y="${height - bottomMargin + 16}" text-anchor="middle" font-size="11" fill="#333333">${esc(categories[c] || '')}</text>`);
        parts.push(`<line x1="${lx}" y1="${Math.round(yZero)}" x2="${lx}" y2="${Math.round(yZero) + 4}" stroke="#808080" stroke-width="1" />`);
      }

      chart.series.forEach((s, sIdx) => {
        const color = s.color || EXCEL_PALETTE[sIdx % EXCEL_PALETTE.length];
        const pts = [], commands = [];
        let segmentStart = true;
        for (let c = 0; c < N; c++) {
          let value = s.values[c];
          if (!Number.isFinite(value)) {
            if (chart.blanks === 'zero') value = 0;
            else { if (chart.blanks !== 'span') segmentStart = true; continue; }
          }
          const px = leftMargin + ((chart.categoryAxis?.reversed ? N - 1 - c : c) + 0.5) * slotW;
          const py = y(value);
          pts.push({ x: px, y: py });
          commands.push(`${segmentStart ? 'M' : 'L'} ${px} ${py}`);
          segmentStart = false;
        }
        const line = s.noLine ? '' : `<path data-chart-series="${sIdx}" d="${commands.join(' ')}" fill="none" stroke="${color}" stroke-width="${s.lineWidth ?? 3}" stroke-linecap="round" stroke-linejoin="round" />`;
        const markers = pts.map(p => markerSvg(s.marker, sIdx, p.x, p.y, color)).join('');
        parts.push(plotMark(line + markers, leftMargin, topMargin, pw, ph));
      });

      if (hasLegend) {
        const legX = width - rightMargin + 15;
        const totalLegHeight = chart.series.length * 20;
        const legY = Math.max(topMargin, topMargin + (ph - totalLegHeight) / 2);
        chart.series.forEach((s, sIdx) => {
          const ly = legY + sIdx * 20;
          const color = s.color || EXCEL_PALETTE[sIdx % EXCEL_PALETTE.length];
          if (!s.noLine) parts.push(`<line x1="${legX}" y1="${ly + 5}" x2="${legX + 16}" y2="${ly + 5}" stroke="${color}" stroke-width="${s.lineWidth ?? 3}" />`);
          parts.push(markerSvg(s.marker, sIdx, legX + 8, ly + 5, color));
          parts.push(`<text x="${legX + 22}" y="${ly + 9}" font-size="11" fill="#333333">${esc(s.name)}</text>`);
        });
      }

      parts.push(axisTitles(chart, leftMargin, topMargin, pw, ph, false));
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
    renderSvg,
  };

  if (typeof window !== 'undefined') {
    window.xlsxChartKit = api;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})();
