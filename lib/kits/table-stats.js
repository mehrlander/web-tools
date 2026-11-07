// ── table-stats: a table's profile and its pivot, computed once for the estate
//
//   TableStats.parseNum(v)              -> number | null
//   TableStats.profile(rows, { columns }) -> { rowCount, colCount, …, columns: [...] }
//   TableStats.pivot.scan(rows)         -> { cols, distinct, isNum, dec }
//   TableStats.pivot.defaults(scan, rows) -> { dims, measure, agg }
//   TableStats.pivot.tree(rows, cfg)    -> { tree, skipped, colKeys, partition }
//   TableStats.pivot.flat(res, cfg)     -> rows, one column per dimension level
//   TableStats.pivot.label(cfg)         -> "sum(amount)" | "count"
//
//   cfg = { rows: [dims…], cols: [column dims…], measure, agg, dec, sep }
//   agg = sum | avg | min | max | count | list (distinct values, joined by sep)
//
// TWO VIEWS OF THE SAME TABLE HAD TWO ENGINES (2026-10-24). The viewer's
// explorer (kits/tabular-explorer.js) profiled well and pivoted thinly; the
// transform workbench pivoted well and profiled thinly; and each carried its
// own copy of one number parser. The numbers are computed here now, and each
// host only draws them. The workbench's pivot recipe (pvFnSrc) still writes
// its own copy of the arithmetic into the recipe it saves, on purpose: a
// recipe has to run with nothing loaded.
//
// No DOM, no globals read: plain functions over arrays of row objects.
(() => {
  // A NUMBER AS A SPREADSHEET WRITES IT. "$1,234.50", "12%" and " 7 " are
  // numbers once the decoration is gone; "(23.00)" is an accounting negative.
  // Decided by COERCION rather than typeof, since a CSV parse hands every
  // value back as a string. A body that is not plainly a decimal ("0x10",
  // "600-1", "n/a") is not a number, which is null here.
  const parseNum = (v) => {
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    if (typeof v !== 'string') return null;
    const t = v.trim();
    if (!t) return null;
    const neg = /^\(.*\)$/.test(t);
    const body = t.replace(/^\(|\)$/g, '').replace(/[$,%\s]/g, '');
    if (!/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(body)) return null;
    const n = parseFloat(body);
    return Number.isFinite(n) ? (neg ? -n : n) : null;
  };

  // ── the profile ───────────────────────────────────────────────────────────
  //
  // Every column typed from its values (numeric, categorical, text, temporal,
  // empty), with fill, distincts, the commonest values, and for a number its
  // five-number summary and a ten-bin histogram. Lifted whole from
  // tabular-explorer.js, where the Columns view drew it, so the workbench's
  // Profile reads the same figures.
  const DISTINCT_CAP = 2000;
  const DataProfile = {
    parseNum,
    analyze(rows, opts = {}) {
      const N = rows.length;
      // Declared fields preserve order and header-only columns; titles are
      // source labels, while names remain unique record keys.
      const titles = new Map((opts.columns || []).map(c => [c.field, String(c.title ?? c.field)]));
      const colSet = new Set(titles.keys());
      for (const r of rows) for (const k in r) colSet.add(k);
      const colNames = [...colSet];

      let totalFilledCells = 0;
      const typeCounts = { numeric: 0, categorical: 0, text: 0, temporal: 0, empty: 0 };

      const columns = colNames.map((name, colIdx) => {
        let nulls = 0;
        let numParsed = 0;
        let numSum = 0;
        let numMin = Infinity;
        let numMax = -Infinity;
        let numZeros = 0;
        let numNegs = 0;
        const numVals = [];

        let temporalMatches = 0;
        let textLenSum = 0;
        const valCounts = new Map();

        for (let i = 0; i < N; i++) {
          const val = rows[i][name];
          if (val == null || val === '' || (typeof val === 'string' && val.trim() === '')) {
            nulls++;
            continue;
          }

          totalFilledCells++;
          const strVal = String(val).trim();
          textLenSum += strVal.length;

          // Frequency tracking (capped to avoid memory blowup on huge unique columns)
          if (valCounts.size < DISTINCT_CAP || valCounts.has(strVal)) {
            valCounts.set(strVal, (valCounts.get(strVal) || 0) + 1);
          }

          // Number check
          const num = parseNum(val);
          if (num !== null) {
            numParsed++;
            numSum += num;
            if (num < numMin) numMin = num;
            if (num > numMax) numMax = num;
            if (num === 0) numZeros++;
            if (num < 0) numNegs++;
            numVals.push(num);
          }

          // Temporal check: YYYY or YYYY-MM or YYYY-MM-DD
          if (/^\d{4}(-\d{2}(-\d{2})?)?$/.test(strVal)) {
            temporalMatches++;
          }
        }

        const filled = N - nulls;
        const fillRate = N > 0 ? filled / N : 0;
        const distinctCount = valCounts.size;

        // Classify column type
        let type = 'categorical';
        let icon = 'ph-tag';
        let color = 'text-primary';

        if (filled === 0) {
          type = 'empty';
          icon = 'ph-prohibit';
          color = 'text-base-content/30';
          typeCounts.empty++;
        } else if (numParsed === filled && filled > 0 && !(temporalMatches === filled && numMin >= 1900 && numMax <= 2100)) {
          type = 'numeric';
          icon = 'ph-hash';
          color = 'text-success';
          typeCounts.numeric++;
        } else if (temporalMatches >= filled * 0.9 && filled > 0) {
          type = 'temporal';
          icon = 'ph-calendar';
          color = 'text-secondary';
          typeCounts.temporal++;
        } else if (textLenSum / filled > 60 || (distinctCount > 50 && distinctCount >= filled * 0.85)) {
          type = 'text';
          icon = 'ph-article';
          color = 'text-accent';
          typeCounts.text++;
        } else {
          type = 'categorical';
          icon = 'ph-tag';
          color = 'text-primary';
          typeCounts.categorical++;
        }

        // Numeric distribution stats & 10-bin histogram
        let numStats = null;
        if (type === 'numeric' && numVals.length) {
          numVals.sort((a, b) => a - b);
          const p25 = numVals[Math.floor(numVals.length * 0.25)];
          const median = numVals[Math.floor(numVals.length * 0.5)];
          const p75 = numVals[Math.floor(numVals.length * 0.75)];
          const mean = numSum / numVals.length;

          // Histogram with 10 bins
          const bins = [];
          const binCount = 10;
          const range = numMax - numMin;
          const step = range > 0 ? range / binCount : 1;
          for (let b = 0; b < binCount; b++) {
            bins.push({
              from: numMin + b * step,
              to: numMin + (b + 1) * step,
              count: 0,
            });
          }
          for (const v of numVals) {
            let idx = range > 0 ? Math.floor((v - numMin) / step) : 0;
            if (idx >= binCount) idx = binCount - 1;
            bins[idx].count++;
          }
          const maxBin = Math.max(1, ...bins.map(b => b.count));
          for (const b of bins) b.pct = b.count / maxBin;

          numStats = {
            min: numMin, max: numMax, sum: numSum, mean, median, p25, p75,
            zeros: numZeros, negatives: numNegs, bins,
          };
        }

        // Categorical top frequencies
        const topValues = [];
        if (valCounts.size > 0 && type !== 'empty') {
          const sorted = [...valCounts.entries()].sort((a, b) => b[1] - a[1]);
          for (let i = 0; i < Math.min(6, sorted.length); i++) {
            const [val, cnt] = sorted[i];
            topValues.push({
              value: val,
              count: cnt,
              pct: cnt / filled,
            });
          }
        }

        return {
          index: colIdx,
          name,
          title: titles.get(name) ?? name,
          type,
          icon,
          color,
          nulls,
          filled,
          fillRate,
          distinctCount,
          // The tally stops taking new values at DISTINCT_CAP, so a count
          // there is a floor, not a figure.
          distinctCapped: distinctCount >= DISTINCT_CAP,
          numStats,
          topValues,
          avgLen: filled > 0 ? Math.round(textLenSum / filled) : 0,
        };
      });

      const cellCount = N * colNames.length;
      const overallFillRate = cellCount > 0 ? totalFilledCells / cellCount : 0;

      return {
        rowCount: N,
        colCount: colNames.length,
        cellCount,
        fillRate: overallFillRate,
        typeCounts,
        columns,
      };
    },
  };

  // ── the pivot ─────────────────────────────────────────────────────────────
  //
  // Group by N row dimensions and up to two column dimensions, aggregate one
  // measure. Lifted from the transform workbench, whose Pivot and Layout views
  // were its first readers. It emits a {label, note, value, children} tree,
  // the shape the estate's report format already flattens, and flat rows for a
  // grid; a host decides how to draw either. Sorting is by the aggregate,
  // descending, at every level.

  const blank = (x) => x == null || x === '' ? '(blank)' : String(x);

  // A sum of floats is 3522919.4400000046, and that tail is arithmetic rather
  // than data. The measure's own precision is the honest place to round to.
  const round = (v, dec) => { const f = Math.pow(10, dec); return Math.round(v * f) / f; };

  // Every column's distinct count (to 1000, then 1001), whether a majority of
  // its filled values are numbers, and how many decimals those carry.
  //
  // A MAJORITY, NOT A SUPERMAJORITY. The flag only decides what a measure
  // list OFFERS, so being permissive costs a spare entry while being strict
  // costs a real measure: a column of money with an "n/a" scattered through it
  // is what a spreadsheet export looks like. Codes survive the bar anyway,
  // because a "600-1" or an "A" never coerces at all.
  function scan(rows) {
    const cols = [...new Set(rows.slice(0, 500).flatMap(r => Object.keys(r)))];
    const distinct = {}, isNum = {}, dec = {};
    for (const c of cols) {
      const seen = new Set();
      let filled = 0, numeric = 0, capped = false, d = 0;
      for (const r of rows) {
        const v = r[c];
        if (v == null || v === '') continue;
        filled++;
        if (!capped) { seen.add(v); if (seen.size > 1000) capped = true; }
        if (parseNum(v) !== null) {
          numeric++;
          if (d < 6) {
            const t = String(v).split('.')[1];
            if (t) d = Math.max(d, Math.min(6, t.replace(/[^0-9]/g, '').length));
          }
        }
      }
      distinct[c] = capped ? 1001 : seen.size;
      dec[c] = d;
      isNum[c] = filled > 0 && numeric / filled > 0.5;
    }
    return { cols, distinct, isNum, dec };
  }

  // A first look: the coarsest real dimension on the rows, and a measure only
  // when a column's NAME says amount. A numeric id and a numeric amount are
  // indistinguishable by shape, and defaulting to the id makes the pane look
  // broken; anything else falls through to counting rows, which is never wrong.
  function defaults(s, rows) {
    const dim = s.cols.filter(c => !s.isNum[c] && s.distinct[c] > 1 && s.distinct[c] < rows.length)
      .sort((a, b) => s.distinct[a] - s.distinct[b])[0];
    const AMT = /(amount|amt|total|sum|value|cost|spend|price|paid|qty|dollars|expend|budget|fte|hours|balance)/i;
    const ID = /(^|[_\s-])(id|key|code|no|num|year|fy|month|day|seq|rank|zip|phone)($|[_\s-])/i;
    const measure = s.cols.filter(c => s.isNum[c] && !ID.test(c)).filter(c => AMT.test(c))[0] || '';
    return { dims: dim ? [dim] : [], measure, agg: measure ? 'sum' : 'count' };
  }

  // The decimals a result carries: none for a count, the measure's own for a
  // sum, min or max, two more for an average, which lands between its inputs.
  const decFor = (s, measure, agg) => agg === 'count' ? 0
    : Math.min(6, ((s && s.dec[measure]) || 0) + (agg === 'avg' ? 2 : 0));

  const label = (cfg) => !cfg.measure || cfg.agg === 'count' ? 'count' : cfg.agg + '(' + cfg.measure + ')';

  // LIST: the one aggregate Excel lacks. A cell holds its group's distinct
  // values, sorted and joined by cfg.sep (", " unless told otherwise), with
  // blanks left out. Capped at LIST_MAX values and then "+N", so a group of
  // thousands is a short string that says how many it is not showing rather
  // than a cell that takes the page.
  const LIST_MAX = 20;
  const listOf = (set, sep) => {
    const all = [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    return all.slice(0, LIST_MAX).join(sep) + (all.length > LIST_MAX ? sep + '+' + (all.length - LIST_MAX) : '');
  };

  // The tree. One pass nests and accumulates; every node keeps its row count
  // so avg is a division at the end rather than a second walk.
  function tree(rows, cfg) {
    const dims = cfg.rows || [], cdims = cfg.cols || [], mk = cfg.measure || '';
    const agg = mk ? (cfg.agg || 'sum') : 'count';
    const dec = cfg.dec ?? 0;
    const isList = agg === 'list', sep = cfg.sep ?? ', ';
    const root = { label: 'Total', value: 0, n: 0, kids: new Map(), cells: new Map() };
    const bump = (node, v) => {
      node.n++;
      if (isList) { (node.set ||= new Set()).add(v); return; }
      if (agg === 'min') node.value = node.n === 1 ? v : Math.min(node.value, v);
      else if (agg === 'max') node.value = node.n === 1 ? v : Math.max(node.value, v);
      else node.value += v;
    };
    // The column axis: each node also accumulates one cell per column key (the
    // column dimensions' values joined), so a crosstab is the same tree read
    // sideways. colKeys collects every key seen.
    const colKeys = new Set();
    const cellKey = r => cdims.map(d => blank(r[d])).join(' · ');
    const bumpCell = (node, ck, v) => {
      let cell = node.cells.get(ck);
      if (!cell) { cell = { value: 0, n: 0 }; node.cells.set(ck, cell); }
      bump(cell, v);
    };
    let skipped = 0;
    for (const r of rows) {
      const p = agg === 'count' ? 1
        : isList ? (r[mk] == null || String(r[mk]).trim() === '' ? null : String(r[mk]).trim())
        : parseNum(r[mk]);
      // A row whose measure will not parse is SKIPPED, never counted as a zero:
      // a zero would move a sum and an average alike and look like data. The
      // count of them is reported instead.
      if (p === null) { skipped++; continue; }
      const ck = cdims.length ? cellKey(r) : '';
      if (cdims.length) colKeys.add(ck);
      bump(root, p);
      if (cdims.length) bumpCell(root, ck, p);
      let node = root;
      for (const d of dims) {
        const k = blank(r[d]);
        let kid = node.kids.get(k);
        if (!kid) { kid = { label: k, value: 0, n: 0, kids: new Map(), cells: new Map() }; node.kids.set(k, kid); }
        bump(kid, p);
        if (cdims.length) bumpCell(kid, ck, p);
        node = kid;
      }
    }
    const keys = [...colKeys].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const finCell = c => isList ? listOf(c.set || new Set(), sep) : round(agg === 'avg' ? (c.n ? c.value / c.n : 0) : c.value, dec);
    const fin = (node, seq = 0) => ({
      label: node.label,
      note: node.n.toLocaleString() + ' row' + (node.n === 1 ? '' : 's'),
      value: isList ? listOf(node.set || new Set(), sep) : round(agg === 'avg' ? (node.n ? node.value / node.n : 0) : node.value, dec),
      n: node.n,
      // Where this label sat among its siblings BEFORE the sort below, which is
      // the order the rows first introduced it. A printed report usually wants
      // the analyst's order, not the largest block first; kits/report-layout.js
      // reads it.
      seq,
      // cells: colKey -> value, only the keys this node saw; a missing key is
      // an empty cell, never a zero, for the same reason a row whose measure
      // will not parse is skipped rather than counted as zero.
      cells: Object.fromEntries([...node.cells].map(([k, c]) => [k, finCell(c)])),
      // A list has no magnitude to rank by, so its groups keep label order.
      children: [...node.kids.values()].map((k, i) => fin(k, i))
        .sort(isList ? (a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }) : (a, b) => b.value - a.value),
    });
    return {
      tree: fin(root), skipped, colKeys: keys,
      // Sum and count make a real partition, so a parent equals the sum of its
      // children and a consumer may check it. avg, min and max do not.
      partition: agg === 'sum' || agg === 'count',
    };
  }

  // The same result as table rows: one column per dimension level, filled
  // down to the node's own depth and blank below it, so a reader sorting or
  // downloading gets a pivot rather than an indent.
  function flat(res, cfg) {
    const dims = cfg.rows || [], keys = res.colKeys || [];
    const mcol = label(cfg);
    const out = [];
    const walk = (node, path) => {
      const row = { level: path.length };
      dims.forEach((d, i) => { row[d] = i < path.length ? path[i] : ''; });
      row.rows = node.n;
      // With a column axis the cells come first and the total last, so the row
      // reads across the way a crosstab does.
      for (const k of keys) row[k] = k in node.cells ? node.cells[k] : '';
      row[keys.length ? 'total' : mcol] = node.value;
      out.push(row);
      for (const k of node.children) walk(k, [...path, k.label]);
    };
    walk(res.tree, []);
    return out;
  }

  const TableStats = {
    parseNum,
    profile: (rows, opts) => DataProfile.analyze(rows, opts),
    pivot: { scan, defaults, tree, flat, label, round, decFor },
  };
  window.TableStats = TableStats;
  // The explorer published its profiler under this name; kept for a page
  // that reads it.
  window.DataProfile = DataProfile;
})();
