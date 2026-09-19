// tabular-explorer.js — Exploratory Data Analysis (EDA) and immersive
// inspection for tabular data (CSV, TSV, JSON rows).
//
// Bridges the gap between a raw grid and a full transformation pipeline:
//   - Data: full virtualized grid (Tabulator) with column search, filter toggling,
//           empty-column suppression, and record-deck cards integration.
//   - Profile: visual EDA column profiling inspired by modern data science tools:
//              * Dataset completeness banner & type summary
//              * Rich column cards with inferred types (Numeric, Categorical, ID, Temporal, Empty)
//              * Fill rate bars (% populated vs % null)
//              * Categorical top-value frequency bars with counts & share
//              * Numeric 5-number summary (Min, 25%, Median, Mean, 75%, Max, Sum) + SVG distribution histograms
//              * Financial & accounting coercion: understands `$`, `,`, and `(23.00)`
//              * Interactive click-to-filter: clicking a category value jumps to Data filtered to that value
//   - Pivot: interactive slice-and-dice matrix:
//            * 1-3 row grouping dimensions, optional column dimension
//            * Aggregates (Sum, Mean, Count, Min, Max) on numeric measures
//            * Proportional horizontal data bars in cells
//            * Subtotals & grand totals, CSV export
//
// Usage:
//   window.TabularExplorer.mount(container, {
//     rows,          // [{}], raw record array
//     columns,       // optional [{ field, title, ... }]
//     name,          // file name for titles & downloads
//     opts,          // optional { filter, onWorkbench, ... }
//   }) -> { destroy, setView, getProfile, ... }
(() => {
  // ---- DOM Helper -----------------------------------------------------------
  const h = (tag, attrs = {}, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') {
        el.addEventListener(k.slice(2).toLowerCase(), v);
      } else el.setAttribute(k, v);
    }
    for (const k of kids.flat()) if (k != null && k !== false) el.append(k);
    return el;
  };

  const esc = (s) => {
    const d = document.createElement('div');
    d.textContent = String(s ?? '');
    return d.innerHTML;
  };

  // Financial & number parser: handles negatives like (23.00), currency symbols, commas
  const parseNum = (v) => {
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    if (typeof v !== 'string') return null;
    const t = v.trim();
    if (!t) return null;
    const neg = /^\(.*\)$/.test(t);
    const body = t.replace(/^\(|\)$/g, '').replace(/[$,%\s]/g, '');
    if (!body || isNaN(Number(body))) return null;
    const n = Number(body);
    return neg ? -n : n;
  };

  const fmtNum = (n, dec = 2) => {
    if (n == null || isNaN(n)) return '';
    const abs = Math.abs(n);
    const str = abs.toLocaleString(undefined, {
      minimumFractionDigits: Number.isInteger(abs) ? 0 : 2,
      maximumFractionDigits: dec,
    });
    return n < 0 ? `(${str})` : str;
  };

  const fmtPct = (p) => `${Math.round(p * 100)}%`;

  // ---- DataProfile: ML/Data-Science EDA Profiling Engine --------------------
  const DataProfile = {
    parseNum,
    analyze(rows, opts = {}) {
      const N = rows.length;
      if (!N) {
        return {
          rowCount: 0, colCount: 0, cellCount: 0, fillRate: 0,
          typeCounts: { numeric: 0, categorical: 0, text: 0, temporal: 0, empty: 0 },
          columns: [],
        };
      }

      // Collect all column names in order of discovery
      const colSet = new Set();
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
          if (valCounts.size < 2000) {
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
          type,
          icon,
          color,
          nulls,
          filled,
          fillRate,
          distinctCount,
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

  // ---- TabularExplorer Component -------------------------------------------
  const TabularExplorer = {
    mount(container, { rows = [], columns = null, name = 'data.csv', opts = {} } = {}) {
      const profile = DataProfile.analyze(rows, opts);
      let activeView = 'data'; // 'data' | 'profile' | 'pivot'
      let hideEmptyCols = false;
      let colSearch = '';
      let colSort = 'index'; // 'index' | 'name' | 'missing' | 'cardinality'
      let colTypeFilter = 'all';

      // Root shell
      const root = h('div', { class: 'tabular-explorer flex flex-col h-full w-full min-w-0 overflow-hidden bg-base-100 text-base-content' });
      container.replaceChildren(root);

      // Tab strip & Controls Header
      const header = h('div', { class: 'shrink-0 flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 border-b border-base-300 bg-base-200/60 select-none' });
      const navGroup = h('div', { class: 'flex items-center gap-1 font-sans text-xs' });
      const actionGroup = h('div', { class: 'flex items-center gap-1.5' });
      header.append(navGroup, actionGroup);
      root.append(header);

      // Main content view stages
      const stage = h('div', { class: 'flex-1 min-h-0 relative overflow-hidden' });
      root.append(stage);

      const dataStage = h('div', { class: 'absolute inset-0 flex flex-col' });
      const profileStage = h('div', { class: 'absolute inset-0 overflow-y-auto p-4 hidden' });
      const pivotStage = h('div', { class: 'absolute inset-0 flex flex-col hidden' });
      stage.append(dataStage, profileStage, pivotStage);

      // Tab buttons
      const btnData = h('button', {
        type: 'button',
        class: 'btn btn-xs font-medium rounded-md gap-1.5 btn-primary',
        onClick: () => setView('data'),
      }, h('i', { class: 'ph ph-table text-sm' }), h('span', { text: `Data (${profile.rowCount.toLocaleString()})` }));

      const btnProfile = h('button', {
        type: 'button',
        class: 'btn btn-xs btn-ghost font-medium rounded-md gap-1.5',
        onClick: () => setView('profile'),
      }, h('i', { class: 'ph ph-chart-bar text-sm' }), h('span', { text: `Profile (${profile.colCount})` }));

      const btnPivot = h('button', {
        type: 'button',
        class: 'btn btn-xs btn-ghost font-medium rounded-md gap-1.5',
        onClick: () => setView('pivot'),
      }, h('i', { class: 'ph ph-square-split-horizontal text-sm' }), h('span', { text: 'Pivot' }));

      navGroup.append(btnData, btnProfile, btnPivot);

      // View switcher
      function setView(view) {
        activeView = view;
        btnData.className = `btn btn-xs font-medium rounded-md gap-1.5 ${view === 'data' ? 'btn-primary' : 'btn-ghost'}`;
        btnProfile.className = `btn btn-xs font-medium rounded-md gap-1.5 ${view === 'profile' ? 'btn-primary' : 'btn-ghost'}`;
        btnPivot.className = `btn btn-xs font-medium rounded-md gap-1.5 ${view === 'pivot' ? 'btn-primary' : 'btn-ghost'}`;

        dataStage.classList.toggle('hidden', view !== 'data');
        profileStage.classList.toggle('hidden', view !== 'profile');
        pivotStage.classList.toggle('hidden', view !== 'pivot');

        renderHeaderActions();
        if (view === 'profile') renderProfileView();
        else if (view === 'pivot') renderPivotView();
        else if (view === 'data' && tabulatorInstance) {
          requestAnimationFrame(() => tabulatorInstance.redraw(true));
        }
      }

      // ---- DATA VIEW (Tabulator) --------------------------------------------
      const tableTarget = h('div', { class: 'h-full w-full' });
      dataStage.append(tableTarget);

      let tabulatorInstance = null;
      let headerFiltersVisible = true;
      const emptyColNames = profile.columns.filter(c => c.type === 'empty').map(c => c.name);

      if (typeof Tabulator !== 'undefined') {
        try {
          tabulatorInstance = new Tabulator(tableTarget, {
            data: rows,
            autoColumns: true,
            autoColumnsDefinitions: (defs) => defs.map(d => ({
              ...d,
              headerFilter: 'input',
              headerFilterPlaceholder: 'Filter...',
            })),
            layout: 'fitData',
            height: '100%',
          });
          tableTarget.__tabulator = tabulatorInstance;
          tableTarget.tabulator = tabulatorInstance;
        } catch (e) {
          tableTarget.innerHTML = `<div class="p-4 text-error font-mono text-xs">Error building table: ${esc(e.message)}</div>`;
        }
      }

      function toggleEmptyCols() {
        hideEmptyCols = !hideEmptyCols;
        if (tabulatorInstance) {
          for (const colName of emptyColNames) {
            const col = tabulatorInstance.getColumn(colName);
            if (col) {
              if (hideEmptyCols) col.hide();
              else col.show();
            }
          }
          tabulatorInstance.redraw(true);
        }
        renderHeaderActions();
      }

      function filterByColumnValue(colName, value) {
        if (!tabulatorInstance) return;
        setView('data');
        tabulatorInstance.clearFilter(true);
        tabulatorInstance.setHeaderFilterValue(colName, value);
      }

      // ---- HEADER ACTIONS ---------------------------------------------------
      function renderHeaderActions() {
        actionGroup.replaceChildren();

        if (activeView === 'data') {
          // Filter toggle
          const btnFilter = h('button', {
            type: 'button',
            class: 'btn btn-xs btn-ghost btn-square',
            title: headerFiltersVisible ? 'Hide column header filters' : 'Show column header filters',
            onClick: () => {
              headerFiltersVisible = !headerFiltersVisible;
              tableTarget.querySelectorAll('.tabulator-header-filter').forEach(el => {
                el.style.display = headerFiltersVisible ? '' : 'none';
              });
              if (tabulatorInstance) tabulatorInstance.redraw(true);
              renderHeaderActions();
            },
          }, h('i', { class: `ph text-sm ${headerFiltersVisible ? 'ph-funnel' : 'ph-funnel-x'}` }));
          actionGroup.append(btnFilter);

          // Hide empty columns button (if empty columns exist)
          if (emptyColNames.length > 0) {
            const btnEmpty = h('button', {
              type: 'button',
              class: `btn btn-xs font-normal ${hideEmptyCols ? 'btn-neutral text-primary' : 'btn-ghost text-base-content/60'} gap-1`,
              title: hideEmptyCols ? `Showing ${emptyColNames.length} empty columns (click to hide)` : `Hiding ${emptyColNames.length} empty columns (click to show)`,
              onClick: toggleEmptyCols,
            }, h('i', { class: `ph ${hideEmptyCols ? 'ph-eye' : 'ph-eye-slash'}` }),
               h('span', { text: hideEmptyCols ? `Show ${emptyColNames.length} empty` : `Hide ${emptyColNames.length} empty` }));
            actionGroup.append(btnEmpty);
          }

          // Record Deck trigger (if recordDeck is available or loads)
          const count = () => { try { return tabulatorInstance ? tabulatorInstance.getRows('active').length : rows.length; } catch { return rows.length; } };
          const btnRecords = h('button', {
            type: 'button',
            class: 'btn btn-xs btn-ghost gap-1',
            title: 'Browse records as cards',
            onClick: async () => {
              if (window.recordDeck && tabulatorInstance) {
                window.recordDeck.fromGrid(tabulatorInstance, { title: name });
              } else if (window.swipeDeck?.entry) {
                try {
                  if (!window.recordDeck) await ViewRegistry?.loadLib?.('kits/record-deck.js');
                  window.recordDeck?.fromGrid(tabulatorInstance, { title: name });
                } catch (e) { console.warn(e); }
              }
            },
          }, h('i', { class: 'ph ph-cards-three text-sm' }), h('span', { text: 'Cards' }));
          actionGroup.append(btnRecords);
        }

        // Export Download Action
        const btnDownload = h('button', {
          type: 'button',
          class: 'btn btn-xs btn-ghost btn-square',
          title: `Download ${name}`,
          onClick: () => {
            const csv = typeof Papa !== 'undefined'
              ? Papa.unparse(rows)
              : [Object.keys(rows[0] || {}).join(','), ...rows.map(r => Object.values(r).map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = name;
            a.click();
            URL.revokeObjectURL(url);
          },
        }, h('i', { class: 'ph ph-download-simple text-sm' }));
        actionGroup.append(btnDownload);

        // Host Workbench Action (if provided)
        if (opts.onWorkbench) {
          const btnWb = h('button', {
            type: 'button',
            class: 'btn btn-xs btn-primary btn-outline gap-1',
            title: 'Open in Transform Workbench',
            onClick: () => opts.onWorkbench(rows, name),
          }, h('i', { class: 'ph ph-wrench text-xs' }), h('span', { text: 'Workbench' }));
          actionGroup.append(btnWb);
        }
      }

      // ---- PROFILE VIEW (ML/EDA Column Profiler) ----------------------------
      function renderProfileView() {
        profileStage.replaceChildren();

        // 1. Dataset Overview Metric Cards
        const overview = h('div', { class: 'grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 mb-5' });

        const card = (label, val, sub, icon = '') => h('div', { class: 'p-3 rounded-lg bg-base-200/50 border border-base-300 flex flex-col justify-between' },
          h('div', { class: 'flex items-center justify-between text-xs text-base-content/60' },
            h('span', { text: label }),
            icon ? h('i', { class: `ph ${icon} text-sm opacity-60` }) : null),
          h('div', { class: 'text-lg font-semibold tabular-nums mt-1 text-base-content', text: val }),
          h('div', { class: 'text-[11px] text-base-content/50 mt-0.5', text: sub })
        );

        overview.append(
          card('Total Rows', profile.rowCount.toLocaleString(), `${profile.cellCount.toLocaleString()} total cells`, 'ph-rows'),
          card('Columns', profile.colCount.toString(), `${profile.typeCounts.empty} empty (${Math.round((profile.typeCounts.empty / profile.colCount) * 100)}%)`, 'ph-columns'),
          card('Completeness', fmtPct(profile.fillRate), `${fmtPct(1 - profile.fillRate)} missing cells`, 'ph-gauge'),
          card('Numeric Measures', profile.typeCounts.numeric.toString(), 'Quantiles & Histograms ready', 'ph-hash'),
          card('Categorical Fields', profile.typeCounts.categorical.toString(), 'Frequencies & Distributions ready', 'ph-tag')
        );
        profileStage.append(overview);

        // 2. Search, Filter & Sort Controls Bar
        const filterBar = h('div', { class: 'flex flex-wrap items-center justify-between gap-2.5 pb-4 mb-4 border-b border-base-300' });

        const searchWrap = h('div', { class: 'relative min-w-[14rem]' },
          h('i', { class: 'ph ph-magnifying-glass absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-base-content/40' }),
          h('input', {
            type: 'text',
            placeholder: 'Search columns...',
            value: colSearch,
            class: 'input input-xs input-bordered w-full pl-7 text-xs font-mono',
            onInput: (e) => { colSearch = e.target.value.toLowerCase(); updateCards(); },
          })
        );

        const pillFilters = h('div', { class: 'flex flex-wrap items-center gap-1 text-xs' });
        const types = [
          { k: 'all', l: `All (${profile.colCount})` },
          { k: 'numeric', l: `Numeric (${profile.typeCounts.numeric})` },
          { k: 'categorical', l: `Categories (${profile.typeCounts.categorical})` },
          { k: 'text', l: `Text (${profile.typeCounts.text})` },
          { k: 'empty', l: `Empty (${profile.typeCounts.empty})` },
        ];
        for (const t of types) {
          const btn = h('button', {
            type: 'button',
            class: `btn btn-xs rounded-full ${colTypeFilter === t.k ? 'btn-neutral' : 'btn-ghost text-base-content/60'}`,
            onClick: () => { colTypeFilter = t.k; renderProfileView(); },
          }, h('span', { text: t.l }));
          pillFilters.append(btn);
        }

        const sortSelect = h('div', { class: 'flex items-center gap-1.5 text-xs text-base-content/60' },
          h('span', { text: 'Sort:' }),
          h('select', {
            class: 'select select-xs select-bordered',
            onChange: (e) => { colSort = e.target.value; updateCards(); },
          },
            h('option', { value: 'index', selected: colSort === 'index', text: 'Original order' }),
            h('option', { value: 'name', selected: colSort === 'name', text: 'Column Name' }),
            h('option', { value: 'missing', selected: colSort === 'missing', text: 'Missing % (High to Low)' }),
            h('option', { value: 'cardinality', selected: colSort === 'cardinality', text: 'Cardinality (Distinct)' })
          )
        );

        filterBar.append(searchWrap, pillFilters, sortSelect);
        profileStage.append(filterBar);

        // 3. Grid of Column Cards
        const cardContainer = h('div', { class: 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5' });
        profileStage.append(cardContainer);

        function updateCards() {
          cardContainer.replaceChildren();

          let filtered = profile.columns.slice();
          if (colTypeFilter !== 'all') {
            filtered = filtered.filter(c => c.type === colTypeFilter);
          }
          if (colSearch) {
            filtered = filtered.filter(c => c.name.toLowerCase().includes(colSearch));
          }

          if (colSort === 'name') filtered.sort((a, b) => a.name.localeCompare(b.name));
          else if (colSort === 'missing') filtered.sort((a, b) => (1 - a.fillRate) - (1 - b.fillRate) || a.index - b.index);
          else if (colSort === 'cardinality') filtered.sort((a, b) => b.distinctCount - a.distinctCount || a.index - b.index);
          else filtered.sort((a, b) => a.index - b.index);

          if (!filtered.length) {
            cardContainer.append(h('div', { class: 'col-span-full py-8 text-center text-xs text-base-content/40 italic' }, 'No columns match this filter.'));
            return;
          }

          for (const col of filtered) {
            cardContainer.append(renderColumnCard(col));
          }
        }

        updateCards();
      }

      function renderColumnCard(col) {
        const card = h('div', { class: 'tabular-col-card p-3.5 rounded-lg border border-base-300 bg-base-100 shadow-sm flex flex-col justify-between hover:border-base-content/30 transition-colors' });

        // Header: #Idx, Name, Type Badge
        const topRow = h('div', { class: 'flex items-start justify-between gap-2 mb-2' });
        const nameBlock = h('div', { class: 'min-w-0 flex-1' },
          h('div', { class: 'text-[10px] font-mono text-base-content/40', text: `#${col.index + 1}` }),
          h('div', { class: 'font-semibold text-xs text-base-content truncate', title: col.name, text: col.name })
        );
        const typeBadge = h('div', { class: `badge badge-sm gap-1 font-mono text-[10px] uppercase font-bold shrink-0 ${col.color}` },
          h('i', { class: `ph ${col.icon}` }),
          h('span', { text: col.type })
        );
        topRow.append(nameBlock, typeBadge);
        card.append(topRow);

        // Quality / Fill bar
        const qualityRow = h('div', { class: 'mb-3' });
        const qualityLabels = h('div', { class: 'flex justify-between text-[11px] text-base-content/60 font-mono mb-1' },
          h('span', { text: `${col.filled.toLocaleString()} values (${fmtPct(col.fillRate)})` }),
          col.nulls > 0 ? h('span', { class: 'text-warning/80', text: `${col.nulls.toLocaleString()} empty` }) : h('span', { class: 'text-success/70', text: '100% full' })
        );
        const bar = h('div', { class: 'w-full h-1.5 bg-base-300 rounded-full overflow-hidden flex' },
          h('div', { class: `h-full ${col.fillRate === 1 ? 'bg-success' : 'bg-primary'}`, style: `width: ${col.fillRate * 100}%` }),
          h('div', { class: 'h-full bg-base-300', style: `width: ${(1 - col.fillRate) * 100}%` })
        );
        qualityRow.append(qualityLabels, bar);
        card.append(qualityRow);

        // Column Distribution Visuals
        const body = h('div', { class: 'flex-1 min-h-[5.5rem] flex flex-col justify-center' });

        if (col.type === 'empty') {
          body.append(h('div', { class: 'text-center text-xs text-base-content/30 italic py-3' }, 'All values are empty in this extract'));
        } else if (col.type === 'numeric' && col.numStats) {
          // Numeric: 5-number stats + SVG Histogram
          const stats = col.numStats;
          const statsGrid = h('div', { class: 'grid grid-cols-4 gap-1 text-[10px] font-mono text-base-content/70 py-1 mb-2 border-b border-base-200' },
            h('div', {}, h('span', { class: 'block text-base-content/40' }, 'Min'), h('span', { text: fmtNum(stats.min) })),
            h('div', {}, h('span', { class: 'block text-base-content/40' }, 'Median'), h('span', { text: fmtNum(stats.median) })),
            h('div', {}, h('span', { class: 'block text-base-content/40' }, 'Mean'), h('span', { text: fmtNum(stats.mean) })),
            h('div', {}, h('span', { class: 'block text-base-content/40' }, 'Max'), h('span', { text: fmtNum(stats.max) }))
          );

          // SVG 10-bin histogram
          const histSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          histSvg.setAttribute('viewBox', '0 0 100 24');
          histSvg.setAttribute('class', 'w-full h-7 overflow-visible');

          const binW = 9;
          const binGap = 1;
          stats.bins.forEach((b, idx) => {
            const hVal = Math.max(1, Math.round(b.pct * 22));
            const y = 24 - hVal;
            const x = idx * (binW + binGap);
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', x);
            rect.setAttribute('y', y);
            rect.setAttribute('width', binW);
            rect.setAttribute('height', hVal);
            rect.setAttribute('rx', '1');
            rect.setAttribute('fill', 'currentColor');
            rect.setAttribute('class', b.count > 0 ? 'text-primary opacity-60 hover:opacity-100 transition-opacity cursor-pointer' : 'text-base-300 opacity-40');
            const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
            title.textContent = `${fmtNum(b.from)} to ${fmtNum(b.to)}: ${b.count} rows`;
            rect.append(title);
            histSvg.append(rect);
          });

          const footer = h('div', { class: 'flex items-center justify-between text-[10px] font-mono text-base-content/50 mt-1' },
            h('span', { text: `Sum: ${fmtNum(stats.sum)}` }),
            stats.negatives > 0 ? h('span', { class: 'text-warning', text: `${stats.negatives} negative values` }) : h('span', { text: `${col.distinctCount} distinct` })
          );

          body.append(statsGrid, histSvg, footer);
        } else {
          // Categorical / Text: Top Frequency Bars
          const list = h('div', { class: 'space-y-1.5' });
          for (const item of col.topValues) {
            const itemRow = h('div', {
              class: 'group flex items-center justify-between gap-2 text-xs cursor-pointer hover:bg-base-200/60 p-1 rounded transition-colors',
              title: `Click to filter Data view for "${item.value}"`,
              onClick: () => filterByColumnValue(col.name, item.value),
            });

            const left = h('div', { class: 'min-w-0 flex-1 flex items-center gap-1.5' },
              h('div', { class: 'truncate font-sans group-hover:text-primary transition-colors', text: item.value || '(empty)' })
            );

            const right = h('div', { class: 'shrink-0 flex items-center gap-2 font-mono text-[11px] text-base-content/60' },
              h('span', { text: item.count.toLocaleString() }),
              h('span', { class: 'text-[10px] opacity-70 w-8 text-right', text: fmtPct(item.pct) })
            );

            // Subtle background progress bar
            const barWrap = h('div', { class: 'relative w-full' },
              h('div', { class: 'absolute inset-0 bg-primary/10 rounded group-hover:bg-primary/20 transition-colors', style: `width: ${item.pct * 100}%` }),
              h('div', { class: 'relative flex items-center justify-between px-1.5 py-0.5' }, left, right)
            );

            itemRow.replaceChildren(barWrap);
            list.append(itemRow);
          }

          if (col.distinctCount > col.topValues.length) {
            list.append(h('div', { class: 'text-right text-[10px] text-base-content/40 font-mono pt-0.5' }, `+ ${(col.distinctCount - col.topValues.length).toLocaleString()} other distinct values`));
          }

          body.append(list);
        }

        card.append(body);
        return card;
      }

      // ---- PIVOT VIEW (Multi-Dimension Aggregator) ---------------------------
      let pDim1 = profile.columns.find(c => c.type === 'categorical')?.name || profile.columns[0]?.name || '';
      let pDim2 = '';
      let pMeasure = profile.columns.find(c => c.type === 'numeric')?.name || '';
      let pAgg = 'sum'; // 'sum' | 'avg' | 'count' | 'min' | 'max'

      function renderPivotView() {
        pivotStage.replaceChildren();

        // Pivot Configuration Bar
        const cfgBar = h('div', { class: 'shrink-0 p-3 border-b border-base-300 bg-base-200/40 flex flex-wrap items-center gap-3 text-xs' });

        const selectOf = (label, currVal, options, onChange) => {
          const wrap = h('div', { class: 'flex items-center gap-1.5' },
            h('span', { class: 'font-semibold text-base-content/70', text: label }),
            h('select', {
              class: 'select select-xs select-bordered font-mono max-w-[14rem]',
              onChange: (e) => { onChange(e.target.value); renderPivotTable(); },
            }, ...options.map(opt => h('option', { value: opt.k, selected: opt.k === currVal, text: opt.l })))
          );
          return wrap;
        };

        const colOpts = profile.columns.filter(c => c.type !== 'empty').map(c => ({ k: c.name, l: c.name }));
        const numColOpts = profile.columns.filter(c => c.type === 'numeric').map(c => ({ k: c.name, l: c.name }));
        if (!numColOpts.length) numColOpts.push({ k: '', l: '(No numeric columns)' });

        const dim1Select = selectOf('Row Group 1:', pDim1, colOpts, (v) => { pDim1 = v; });
        const dim2Select = selectOf('Row Group 2:', pDim2, [{ k: '', l: '(None)' }, ...colOpts], (v) => { pDim2 = v; });
        const measureSelect = selectOf('Measure:', pMeasure, numColOpts, (v) => { pMeasure = v; });
        const aggSelect = selectOf('Aggregate:', pAgg, [
          { k: 'sum', l: 'Sum' },
          { k: 'avg', l: 'Average' },
          { k: 'count', l: 'Count' },
          { k: 'min', l: 'Minimum' },
          { k: 'max', l: 'Maximum' },
        ], (v) => { pAgg = v; });

        cfgBar.append(dim1Select, dim2Select, measureSelect, aggSelect);
        pivotStage.append(cfgBar);

        // Table Container
        const tblWrap = h('div', { class: 'flex-1 min-h-0 overflow-auto p-4' });
        pivotStage.append(tblWrap);

        function renderPivotTable() {
          tblWrap.replaceChildren();
          if (!pDim1) {
            tblWrap.append(h('div', { class: 'p-6 text-center text-xs text-base-content/40 italic' }, 'Select at least one Row Group dimension.'));
            return;
          }

          // Aggregation map
          const groups = new Map();
          let grandSum = 0, grandCount = 0, grandMin = Infinity, grandMax = -Infinity;

          for (const r of rows) {
            const d1 = String(r[pDim1] || '(blank)').trim();
            const d2 = pDim2 ? String(r[pDim2] || '(blank)').trim() : null;
            const key = d2 ? `${d1}::${d2}` : d1;

            let num = pMeasure ? parseNum(r[pMeasure]) : 1;
            if (num === null) num = 0;

            if (!groups.has(key)) {
              groups.set(key, { d1, d2, sum: 0, count: 0, min: Infinity, max: -Infinity });
            }
            const g = groups.get(key);
            g.sum += num;
            g.count++;
            if (num < g.min) g.min = num;
            if (num > g.max) g.max = num;

            grandSum += num;
            grandCount++;
            if (num < grandMin) grandMin = num;
            if (num > grandMax) grandMax = num;
          }

          const records = [...groups.values()].map(g => {
            let val = g.sum;
            if (pAgg === 'avg') val = g.count > 0 ? g.sum / g.count : 0;
            else if (pAgg === 'count') val = g.count;
            else if (pAgg === 'min') val = g.min;
            else if (pAgg === 'max') val = g.max;
            return { ...g, val };
          });

          // Sort by aggregated value descending
          records.sort((a, b) => b.val - a.val);

          const maxAbsVal = Math.max(1, ...records.map(r => Math.abs(r.val)));
          let grandVal = grandSum;
          if (pAgg === 'avg') grandVal = grandCount > 0 ? grandSum / grandCount : 0;
          else if (pAgg === 'count') grandVal = grandCount;
          else if (pAgg === 'min') grandVal = grandMin;
          else if (pAgg === 'max') grandVal = grandMax;

          const table = h('table', { class: 'table table-xs table-pin-rows w-full border border-base-300' });
          const thead = h('thead', {},
            h('tr', { class: 'bg-base-200 text-xs font-semibold' },
              h('th', { text: pDim1 }),
              pDim2 ? h('th', { text: pDim2 }) : null,
              h('th', { class: 'text-right', text: 'Rows' }),
              h('th', { class: 'text-right min-w-[12rem]', text: `${pAgg.toUpperCase()} of ${pMeasure || 'Rows'}` })
            )
          );
          table.append(thead);

          const tbody = h('tbody', {});
          for (const r of records) {
            const pct = Math.min(100, Math.round((Math.abs(r.val) / maxAbsVal) * 100));
            const tr = h('tr', { class: 'hover:bg-base-200/50 transition-colors' },
              h('td', { class: 'font-medium', text: r.d1 }),
              pDim2 ? h('td', { class: 'text-base-content/70', text: r.d2 }) : null,
              h('td', { class: 'text-right font-mono text-base-content/60', text: r.count.toLocaleString() }),
              h('td', { class: 'text-right font-mono tabular-nums relative p-0 overflow-hidden' },
                h('div', { class: 'absolute inset-y-0 right-0 bg-primary/15 rounded-l', style: `width: ${pct}%` }),
                h('span', { class: `relative px-3 py-1.5 block font-semibold ${r.val < 0 ? 'text-warning' : 'text-base-content'}`, text: fmtNum(r.val) })
              )
            );
            tbody.append(tr);
          }

          // Grand Total Footer
          const tfoot = h('tfoot', {},
            h('tr', { class: 'bg-base-200/80 font-bold border-t-2 border-base-300 text-xs' },
              h('td', { text: 'Grand Total' }),
              pDim2 ? h('td', { text: `${records.length} groups` }) : null,
              h('td', { class: 'text-right font-mono', text: grandCount.toLocaleString() }),
              h('td', { class: 'text-right font-mono text-primary px-3 py-1.5', text: fmtNum(grandVal) })
            )
          );
          table.append(tbody, tfoot);
          tblWrap.append(table);
        }

        renderPivotTable();
      }

      // Initial render
      renderHeaderActions();

      return {
        table: tabulatorInstance,
        profile,
        setView,
        filterByColumnValue,
        toggleEmptyCols,
        destroy: () => {
          if (tabulatorInstance) {
            try { tabulatorInstance.destroy(); } catch (e) {}
            tabulatorInstance = null;
          }
          root.remove();
        },
      };
    },
  };

  window.DataProfile = DataProfile;
  window.TabularExplorer = TabularExplorer;
})();
