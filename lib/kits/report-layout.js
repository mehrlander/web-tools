// lib/kits/report-layout.js: a report layout, meaning the declared shape of a
// printed table, kept apart from the rows it prints.
//
// The subject is a budget compare. One measure, a band of budget versions
// across the top with a period inside each, a row hierarchy down the side, a
// subtotal after each block, an opening line above them all, and a grand total
// that is the opening plus the subtotals. That shape is the levels equation of
// the budget-drs workspace (app/CARRY-FORWARD.md) widened from one budget to
// several, which is why it is worth naming rather than drawing once.
//
// WHY A SECOND OBJECT RATHER THAN A WIDER FLATTENER. The home estate's
// app/report/rows.js already turns a {label, value, children} tree into
// indented rows, and it refuses formatting on purpose: "a divisor and a
// currency are the reader's business and a flattener has no opinion about
// either." Everything this file adds is the opinion that flattener declines to
// hold: which key bands the columns, where a subtotal sits, what a missing cell
// looks like, which rows are emphasized. Folding those into the flattener would
// put display back inside the data step. So a layout is declared beside the
// rows, as JSON, and the pairing of the two is what a stored template is.
//
// THE DISTINCTION THE FORMAT RESTS ON: a blank cell and a zero are different
// claims. Blank means no row was filed. Zero means a row was filed at zero.
// fold() therefore leaves a column absent rather than seeding it, and a
// subtotal over a group with no rows in that column stays blank. In the source
// table LEOFF Restatement is 0 in both chairs' 2026 and blank in the
// Governor's, so collapsing the two would lose which budgets considered the
// item at all.
//
// THE ARITHMETIC IS BY CONSTRUCTION, so this file carries no check of its own.
// Subtotals and the grand total are computed from the item rows, and asserting
// that a computed sum equals itself proves nothing. What is worth holding is
// the TRANSCRIPTION, and tools/test/report-layout.test.mjs holds it: it builds
// the model from the committed rows and asserts every subtotal and total
// printed in the source table, typed in separately from the figures the rows
// carry. A mistyped item is what that test catches.
(() => {
  // A separator no label carries, so a composite key cannot be forged by two
  // labels that happen to abut.
  const SEP = '\u0001';
  const s = v => (v == null ? '' : String(v));
  const num = v => {
    const n = typeof v === 'number' ? v : parseFloat(v);
    return Number.isFinite(n) ? n : null;
  };
  // Escaping is window.esc from vanilla-bundle.js, first in the boot chain,
  // so this file holds no second answer to the same question.
  const esc = v => window.esc(s(v));

  // Declared order wins; otherwise first appearance, which keeps an authored
  // rows file in charge of its own reading order.
  const axis = (rows, field, declared) => {
    if (declared && declared.length) return declared.slice();
    const out = [];
    for (const r of rows) { const v = s(r[field]); if (v && !out.includes(v)) out.push(v); }
    return out;
  };

  // build(spec, rows) -> model
  //   columns: [{ key, band, within, gapBefore }]
  //   rows:    [{ kind, labels, values }]   kind: opening | item | subtotal | total
  // The model is plain data and is the stage the renderer draws from, so the
  // table can be checked, diffed or exported without going near markup.
  function build(spec, rows) {
    const cs = spec.columns;
    const measure = spec.measure || 'value';
    const bands = axis(rows, cs.band, cs.bands);
    const withins = axis(rows, cs.within, cs.withins);
    const gap = cs.gap !== false;

    const columns = [];
    bands.forEach((b, bi) => withins.forEach((w, wi) => {
      columns.push({ key: b + SEP + w, band: b, within: w, gapBefore: gap && bi > 0 && wi === 0 });
    }));

    const levels = spec.rows.levels;
    const isOpening = r => (spec.opening
      ? Object.entries(spec.opening.where).every(([k, v]) => s(r[k]) === v)
      : false);

    const fold = src => {
      const out = {};
      for (const r of src) {
        const v = num(r[measure]);
        if (v == null) continue;
        const k = s(r[cs.band]) + SEP + s(r[cs.within]);
        out[k] = (out[k] || 0) + v;
      }
      return out;
    };

    const opening = rows.filter(isOpening);
    const body = rows.filter(r => !isOpening(r));

    // One leaf per distinct level tuple, in first appearance order, then the
    // leaves gathered under the subtotal level in the order that level first
    // appeared. An authored rows file that lists an item's versions together
    // therefore prints in the order it was written.
    const at = spec.subtotal ? spec.subtotal.at : null;
    const leaves = new Map();
    for (const r of body) {
      const k = levels.map(l => s(r[l])).join(SEP);
      if (!leaves.has(k)) leaves.set(k, { labels: levels.map(l => s(r[l])), group: at ? s(r[at]) : '', src: [] });
      leaves.get(k).src.push(r);
    }
    const groups = [];
    for (const leaf of leaves.values()) {
      let g = groups.find(x => x.name === leaf.group);
      if (!g) groups.push((g = { name: leaf.group, leaves: [] }));
      g.leaves.push(leaf);
    }

    const out = [];
    const openValues = opening.length ? fold(opening) : null;
    if (openValues) out.push({ kind: 'opening', labels: [spec.opening.label], values: openValues });

    const subtotals = [];
    for (const g of groups) {
      for (const leaf of g.leaves) out.push({ kind: 'item', labels: leaf.labels, values: fold(leaf.src) });
      if (at) {
        const v = fold(g.leaves.flatMap(l => l.src));
        subtotals.push(v);
        out.push({ kind: 'subtotal', labels: [spec.subtotal.label.replace('{' + at + '}', g.name)], values: v });
      }
    }

    if (spec.total) {
      const v = {};
      for (const m of [openValues || {}, ...subtotals])
        for (const [k, n] of Object.entries(m)) v[k] = (v[k] || 0) + n;
      out.push({ kind: 'total', labels: [spec.total.label], values: v });
    }

    return { title: spec.title || '', columns, levels, rows: out };
  }

  const fmt = (v, style) => {
    if (v == null) return '';
    if (style === 'plain') return String(v);
    return Math.round(v).toLocaleString('en-US');
  };

  // Consecutive columns sharing a band, for the header's colspans.
  const bandRuns = columns => columns.reduce((runs, c) => {
    const last = runs[runs.length - 1];
    if (last && last.name === c.band) last.n++;
    else runs.push({ name: c.band, n: 1, gapBefore: c.gapBefore });
    return runs;
  }, []);

  function render(model, spec) {
    const style = ((spec && spec.format) || {}).style;
    const L = model.levels.length;
    const gapCell = tag => `<${tag} class="w-4 border-0 p-0"></${tag}>`;
    const corner = `<th colspan="${L}" class="border-0 bg-base-100"></th>`;

    const head = [
      '<tr>' + corner + bandRuns(model.columns).map(r =>
        (r.gapBefore ? gapCell('th') : '')
        + `<th colspan="${r.n}" class="bg-neutral text-center font-semibold text-neutral-content">${esc(r.name)}</th>`
      ).join('') + '</tr>',
      '<tr>' + corner + model.columns.map(c =>
        (c.gapBefore ? gapCell('th') : '')
        + `<th class="text-right font-semibold">${esc(c.within)}</th>`
      ).join('') + '</tr>',
    ].join('');

    // Repeat suppression down the label columns, which is what makes the row
    // hierarchy read as a spreadsheet rather than as an indented tree.
    const carried = new Array(L).fill(null);
    const body = model.rows.map(row => {
      let lead;
      if (row.kind === 'item') {
        lead = row.labels.map((v, i) => {
          const show = v && v !== carried[i];
          if (v !== carried[i]) { carried[i] = v; carried.fill(null, i + 1); }
          return `<td class="whitespace-nowrap">${show ? esc(v) : ''}</td>`;
        }).join('');
      } else {
        carried.fill(null);
        lead = `<td colspan="${L}" class="whitespace-nowrap font-semibold">${esc(row.labels[0])}</td>`;
      }

      const tint = row.kind === 'item' ? '' : ' bg-base-200 font-semibold';
      const rule = row.kind === 'total' ? ' border-t-2 border-base-content/20' : '';
      const values = model.columns.map(c =>
        (c.gapBefore ? gapCell('td') : '')
        + `<td class="text-right tabular-nums">${fmt(row.values[c.key], style)}</td>`
      ).join('');
      return `<tr class="${tint}${rule}">${lead}${values}</tr>`;
    }).join('');

    return (model.title ? `<div class="mb-2 font-semibold text-balance">${esc(model.title)}</div>` : '')
      + '<div class="overflow-x-auto"><table class="table table-sm w-max">'
      + `<thead>${head}</thead><tbody>${body}</tbody></table></div>`;
  }

  // The way back to a workbook. Raw numbers, not the formatted strings, so the
  // paste lands as numbers rather than as text Excel has to be argued with.
  function tsv(model) {
    const L = model.levels.length;
    const pad = new Array(L).fill('');
    const lines = [
      [...pad, ...model.columns.map(c => c.band)].join('\t'),
      [...pad, ...model.columns.map(c => c.within)].join('\t'),
    ];
    for (const row of model.rows) {
      const lead = row.kind === 'item'
        ? [...row.labels, ...new Array(Math.max(0, L - row.labels.length)).fill('')]
        : [row.labels[0], ...new Array(Math.max(0, L - 1)).fill('')];
      lines.push([...lead, ...model.columns.map(c => {
        const v = row.values[c.key];
        return v == null ? '' : String(v);
      })].join('\t'));
    }
    return lines.join('\n');
  }

  window.ReportLayout = { build, render, tsv, fmt };
})();
