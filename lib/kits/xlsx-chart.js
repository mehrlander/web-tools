// lib/kits/xlsx-chart.js - Browser SVG previews of supported Excel chart models.
// xlsx.js owns parsing, reference resolution and colour resolution. These
// previews approximate Excel layout; they are not images rendered by Excel and
// do not recalculate formulas.
(() => {
  // The Office 2023 theme's six accents, which Excel cycles through for a series
  // with no colour of its own. A fallback only: xlsx.js hands over the
  // workbook's own accents as `chart.autoColors` whenever theme1.xml is readable.
  const EXCEL_PALETTE = ['#156082', '#e97132', '#196b24', '#0f9ed5', '#a02b93', '#4ea72e'];

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

  // A tick label drawn by the same number-format engine as the cells, so an
  // axis linked to `"$"#,##0` reads `$2,000` and a locale tag such as `[$-409]`
  // is not mistaken for a currency sign. General, or no code at all, prints the
  // number as General does: no grouping.
  function formatValue(v, fmt) {
    const kit = window.xlsxKit;
    if (!fmt || fmt === 'General' || !kit?.formatValue || !kit?.formatKind) return String(v);
    return String(kit.formatValue(v, { kind: kit.formatKind(fmt), code: fmt }) ?? '').trim() || String(v);
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

  // `x0` is the left edge left over once a left-hand legend has taken its column.
  function axisTitles(chart, left, top, width, height, horizontal = false, x0 = 0) {
    const xTitle = horizontal ? chart.valueAxis?.title : chart.categoryAxis?.title;
    const yTitle = horizontal ? chart.categoryAxis?.title : chart.valueAxis?.title;
    return `${xTitle ? `<text data-axis-title="x" x="${left + width / 2}" y="${top + height + 42}" text-anchor="middle" font-size="12">${esc(xTitle)}</text>` : ''}
      ${yTitle ? `<text data-axis-title="y" transform="translate(${x0 + 16} ${top + height / 2}) rotate(-90)" text-anchor="middle" font-size="12">${esc(yTitle)}</text>` : ''}`;
  }

  // ---- colour --------------------------------------------------------------
  // A series' own colour where the file gave one, else the accent Excel assigns
  // to its index. Excel varies colour by POINT only when a chart has a single
  // series and varyColors is on, which is the pie default.
  const autoColor = (chart, i) => {
    const palette = chart.autoColors?.length ? chart.autoColors : EXCEL_PALETTE;
    return palette[i % palette.length];
  };
  const seriesColor = (chart, s, i) => s.color || autoColor(chart, s.index ?? i);
  const variesByPoint = chart => !!chart.varyColors && chart.series.length === 1;
  const pointColor = (chart, s, i, c) => s.pointColors?.[c] ||
    (variesByPoint(chart) ? autoColor(chart, c) : seriesColor(chart, s, i));

  // ---- legend --------------------------------------------------------------
  // What the legend lists: the categories when colour varies by point, the
  // series otherwise, each with the mark its chart draws.
  function legendItems(chart) {
    const first = chart.series[0];
    if (variesByPoint(chart)) {
      return (first.categories || []).map((cat, c) => ({ label: cat ?? '', color: pointColor(chart, first, 0, c) }));
    }
    return chart.series.map((s, i) => ({
      label: s.name, color: seriesColor(chart, s, i),
      line: chart.subType === 'line' ? { width: s.lineWidth ?? 3, noLine: s.noLine, marker: s.marker, index: i } : null,
    }));
  }

  function legendSwatch(item, x, y) {
    const mark = item.line
      ? (item.line.noLine ? '' : `<line x1="${x}" y1="${y + 5}" x2="${x + 16}" y2="${y + 5}" stroke="${item.color}" stroke-width="${item.line.width}" />`) +
        markerSvg(item.line.marker, item.line.index, x + 8, y + 5, item.color)
      : `<rect x="${x}" y="${y}" width="10" height="10" fill="${item.color}" />`;
    return `<g data-legend-item="">${mark}<text x="${x + (item.line ? 22 : 16)}" y="${y + 9}" font-size="11" fill="#333333">${esc(item.label)}</text></g>`;
  }

  // Where the legend sits and the margin it takes from each side of the frame.
  // Excel writes r, l, t, b or tr; tr and anything unrecognised read as r, the
  // schema default. Excel has placed new legends at the bottom since 2013, so
  // the row form is the common one rather than the exception.
  const LEGEND_ROW = 20;
  const labelWidth = text => String(text ?? '').length * 6.2;
  function legendLayout(chart, width, titleHeight) {
    const items = chart.legend ? legendItems(chart) : [];
    const none = { left: 0, right: 0, top: 0, bottom: 0, draw: () => '' };
    if (!items.length) return none;
    const pos = ['l', 't', 'b'].includes(chart.legend.pos) ? chart.legend.pos : 'r';
    const itemWidth = item => (item.line ? 22 : 16) + labelWidth(item.label);

    if (pos === 'r' || pos === 'l') {
      const w = Math.min(160, Math.max(70, ...items.map(itemWidth)) + 16);
      const x = pos === 'r' ? width - w + 8 : 8;
      return {
        ...none, [pos === 'r' ? 'right' : 'left']: w,
        draw: (plotTop, plotHeight) => {
          const y0 = Math.max(plotTop, plotTop + (plotHeight - items.length * LEGEND_ROW) / 2);
          return items.map((item, i) => legendSwatch(item, x, y0 + i * LEGEND_ROW)).join('');
        },
      };
    }

    // A row legend wraps into as many lines as the frame's width needs.
    const rows = [[]];
    let run = 0;
    for (const item of items) {
      const w = itemWidth(item) + 14;
      if (run + w > width - 20 && rows.at(-1).length) { rows.push([]); run = 0; }
      rows.at(-1).push({ item, w });
      run += w;
    }
    const h = rows.length * LEGEND_ROW + 6;
    return {
      ...none, [pos === 't' ? 'top' : 'bottom']: h,
      draw: (plotTop, plotHeight, height) => rows.map((row, r) => {
        let x = (width - row.reduce((a, c) => a + c.w, 0)) / 2;
        const y = (pos === 't' ? titleHeight + 4 : height - h + 2) + r * LEGEND_ROW;
        return row.map(({ item, w }) => { const mark = legendSwatch(item, x, y); x += w; return mark; }).join('');
      }).join(''),
    };
  }

  // ---- frame ---------------------------------------------------------------
  const openSvg = (width, height) => `<svg class="xl-chart" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" style="font-family: Aptos, Calibri, -apple-system, sans-serif; background: #ffffff; border: 1px solid #d9d9d9; box-sizing: border-box; display: block;">`;
  const titleSvg = (chart, width) => chart.title
    ? `<text x="${width / 2}" y="22" text-anchor="middle" font-size="14" font-weight="bold" fill="#000000">${esc(chart.title)}</text>`
    : '';
  // Zero is always inside the value range, as Excel's automatic axis keeps it.
  function valueExtent(chart) {
    let min = 0, max = 0;
    chart.series.forEach(s => s.values.forEach(v => {
      if (v < min) min = v;
      if (v > max) max = v;
    }));
    return { min, max };
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
    const titleHeight = chart.title ? 32 : 12;
    const legend = legendLayout(chart, width, titleHeight);

    // 1. Clustered Column Chart
    if (chart.subType === 'column') {
      const { min, max } = valueExtent(chart);
      const scale = axisTicks(chart.valueAxis, min, max);
      if (!scale) return unavailable(chart, width, height, 'Axis bounds or tick spacing');
      const leftMargin = (chart.valueAxis?.title ? 80 : 60) + legend.left;
      const rightMargin = 20 + legend.right;
      const bottomMargin = (chart.categoryAxis?.title ? 67 : 45) + legend.bottom;
      const topMargin = titleHeight + 10 + legend.top;

      const pw = width - leftMargin - rightMargin;
      const ph = height - topMargin - bottomMargin;

      const y = (val) => topMargin + (chart.valueAxis?.reversed ? val - scale.min : scale.max - val) / (scale.max - scale.min) * ph;
      const yZero = y(Math.max(scale.min, Math.min(scale.max, 0)));

      const parts = [openSvg(width, height), titleSvg(chart, width)];

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
          const bx = Math.round(cx + sIdx * barW);
          const by = Math.round(Math.min(y(val), yZero));
          const bh = Math.round(Math.abs(y(val) - yZero));
          parts.push(plotMark(`<rect x="${bx}" y="${by}" width="${Math.max(1, Math.round(barW))}" height="${bh}" fill="${pointColor(chart, s, sIdx, c)}" />`, leftMargin, topMargin, pw, ph));
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

      parts.push(legend.draw(topMargin, ph, height));
      parts.push(axisTitles(chart, leftMargin, topMargin, pw, ph, false, legend.left));
      parts.push(`</svg>`);
      return parts.join('\n');
    }

    // 2. Horizontal Bar Chart
    if (chart.subType === 'bar') {
      const { min, max } = valueExtent(chart);
      const scale = axisTicks(chart.valueAxis, min, max);
      if (!scale) return unavailable(chart, width, height, 'Axis bounds or tick spacing');
      const maxCatLen = Math.max(...categories.map(c => String(c || '').length), 5);
      const leftMargin = Math.max(90, Math.min(160, maxCatLen * 6.8 + 16)) + (chart.categoryAxis?.title ? 22 : 0) + legend.left;
      const rightMargin = 20 + legend.right;
      const bottomMargin = (chart.valueAxis?.title ? 62 : 40) + legend.bottom;
      const topMargin = titleHeight + 10 + legend.top;

      const pw = width - leftMargin - rightMargin;
      const ph = height - topMargin - bottomMargin;

      const x = (val) => leftMargin + (chart.valueAxis?.reversed ? scale.max - val : val - scale.min) / (scale.max - scale.min) * pw;
      const xZero = x(Math.max(scale.min, Math.min(scale.max, 0)));

      const parts = [openSvg(width, height), titleSvg(chart, width)];

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
          const by = Math.round(cy + sIdx * barH);
          const bx = Math.round(Math.min(xZero, x(val)));
          const bw = Math.round(Math.abs(x(val) - xZero));
          parts.push(plotMark(`<rect x="${bx}" y="${by}" width="${bw}" height="${Math.round(barH)}" fill="${pointColor(chart, s, sIdx, c)}" />`, leftMargin, topMargin, pw, ph));
        });

        const labelY = topMargin + (renderIdx + 0.5) * slotH;
        const catText = categories[c] || '';
        parts.push(`<text x="${leftMargin - 8}" y="${labelY + 4}" text-anchor="end" font-size="11" fill="#333333">${esc(catText)}</text>`);
        parts.push(`<line x1="${leftMargin - 4}" y1="${labelY}" x2="${leftMargin}" y2="${labelY}" stroke="#808080" stroke-width="1" />`);
      }

      parts.push(legend.draw(topMargin, ph, height));
      parts.push(axisTitles(chart, leftMargin, topMargin, pw, ph, true, legend.left));
      parts.push(`</svg>`);
      return parts.join('\n');
    }

    // 3. Line Chart
    if (chart.subType === 'line') {
      const { min, max } = valueExtent(chart);
      const scale = axisTicks(chart.valueAxis, min, max);
      if (!scale) return unavailable(chart, width, height, 'Axis bounds or tick spacing');
      const leftMargin = (chart.valueAxis?.title ? 80 : 60) + legend.left;
      const rightMargin = 20 + legend.right;
      const bottomMargin = (chart.categoryAxis?.title ? 57 : 35) + legend.bottom;
      const topMargin = titleHeight + 10 + legend.top;

      const pw = width - leftMargin - rightMargin;
      const ph = height - topMargin - bottomMargin;

      const y = (val) => topMargin + (chart.valueAxis?.reversed ? val - scale.min : scale.max - val) / (scale.max - scale.min) * ph;
      const yZero = y(Math.max(scale.min, Math.min(scale.max, 0)));

      const parts = [openSvg(width, height), titleSvg(chart, width)];

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
        const color = seriesColor(chart, s, sIdx);
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

      parts.push(legend.draw(topMargin, ph, height));
      parts.push(axisTitles(chart, leftMargin, topMargin, pw, ph, false, legend.left));
      parts.push(`</svg>`);
      return parts.join('\n');
    }

    // 4. Pie / Doughnut Chart
    if (chart.subType === 'pie' || chart.subType === 'doughnut') {
      const series = chart.series[0];
      const values = series?.values || [];
      const total = values.reduce((a, b) => a + b, 0) || 1;
      const isDoughnut = chart.subType === 'doughnut';

      const topMargin = titleHeight + 10 + legend.top;
      const bottomMargin = 20 + legend.bottom;
      const leftMargin = 20 + legend.left;
      const rightMargin = 20 + legend.right;

      const pw = width - leftMargin - rightMargin;
      const ph = height - topMargin - bottomMargin;

      const cx = leftMargin + pw / 2;
      const cy = topMargin + ph / 2;
      const r = Math.min(pw, ph) / 2 * 0.9;
      const rInner = isDoughnut ? r * 0.55 : 0;

      const parts = [openSvg(width, height), titleSvg(chart, width)];

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
        parts.push(`<path d="${d}" fill="${pointColor(chart, series, 0, idx)}" stroke="#ffffff" stroke-width="1" />`);
      });

      parts.push(legend.draw(topMargin, ph, height));
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
