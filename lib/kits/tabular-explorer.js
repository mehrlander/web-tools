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
          title: titles.get(name) ?? name,
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
      const profile = DataProfile.analyze(rows, { ...opts, columns });
      const columnTitle = field => profile.columns.find(c => c.name === field)?.title ?? field;
      let activeView = 'data'; // 'data' | 'columns' | 'pivot'
      let hideEmptyCols = false;
      let colSearch = '';
      let colSort = 'index'; // 'index' | 'name' | 'missing' | 'cardinality'
      let colTypeFilter = 'all';
      let selectedColName = profile.columns[0]?.name || null;

      // Root shell
      const root = h('div', { class: 'tabular-explorer flex flex-col h-full w-full min-w-0 overflow-hidden bg-base-100 text-base-content' });
      container.replaceChildren(root);

      // Header Bar: Segmented Tabs on the left, Actions on the right
      const header = h('div', { class: 'shrink-0 flex items-center justify-between gap-2 px-3 py-1.5 border-b border-base-300 bg-base-200/60 select-none' });
      const navGroup = h('div', { role: 'tablist', class: 'tabs tabs-box tabs-xs' });
      const actionGroup = h('div', { class: 'flex items-center gap-1' });
      header.append(navGroup, actionGroup);
      root.append(header);

      // Main content view stages
      const stage = h('div', { class: 'flex-1 min-h-0 relative overflow-hidden' });
      root.append(stage);

      const dataStage = h('div', { class: 'absolute inset-0 flex flex-col' });
      const columnsStage = h('div', { class: 'absolute inset-0 flex flex-col overflow-hidden hidden' });
      const pivotStage = h('div', { class: 'absolute inset-0 flex flex-col overflow-hidden hidden' });
      stage.append(dataStage, columnsStage, pivotStage);

      // Segmented Tabs
      const tabData = h('button', {
        role: 'tab',
        type: 'button',
        class: 'tab tab-active gap-1.5 font-medium',
        onClick: () => setView('data'),
      }, h('i', { class: 'ph ph-table text-xs' }),
         h('span', { text: 'Data' }),
         h('span', { class: 'opacity-60 font-mono text-[10px]', text: `(${profile.rowCount.toLocaleString()})` }));

      const tabCols = h('button', {
        role: 'tab',
        type: 'button',
        class: 'tab gap-1.5 font-medium',
        onClick: () => setView('columns'),
      }, h('i', { class: 'ph ph-columns text-xs' }),
         h('span', { text: 'Columns' }),
         h('span', { class: 'opacity-60 font-mono text-[10px]', text: `(${profile.colCount})` }));

      const tabPivot = h('button', {
        role: 'tab',
        type: 'button',
        class: 'tab gap-1.5 font-medium',
        onClick: () => setView('pivot'),
      }, h('i', { class: 'ph ph-square-split-horizontal text-xs' }),
         h('span', { text: 'Pivot' }));

      navGroup.append(tabData, tabCols, tabPivot);

      // View Switcher (aliases 'profile' -> 'columns' for compatibility)
      function setView(view) {
        if (view === 'profile') view = 'columns';
        activeView = view;

        tabData.classList.toggle('tab-active', view === 'data');
        tabCols.classList.toggle('tab-active', view === 'columns');
        tabPivot.classList.toggle('tab-active', view === 'pivot');

        dataStage.classList.toggle('hidden', view !== 'data');
        columnsStage.classList.toggle('hidden', view !== 'columns');
        pivotStage.classList.toggle('hidden', view !== 'pivot');

        renderHeaderActions();
        if (view === 'columns') renderColumnsView();
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
            ...(columns ? {
              columns: columns.map(c => ({
                ...c, title: esc(c.title ?? c.field),
                headerFilter: 'input', headerFilterPlaceholder: 'Filter...',
              })),
              nestedFieldSeparator: false,
            } : {
              autoColumns: true,
              autoColumnsDefinitions: (defs) => defs.map(d => ({
                ...d, headerFilter: 'input', headerFilterPlaceholder: 'Filter...',
              })),
            }),
            ...(opts.filter?.col && opts.filter?.find ? {
              initialHeaderFilter: [{ field: String(opts.filter.col), value: String(opts.filter.find) }],
            } : {}),
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

        // 1. Icon-only Card button for browsing records as cards
        const btnRecords = h('button', {
          type: 'button',
          class: 'btn btn-xs btn-ghost btn-square text-base-content/80 hover:text-base-content',
          title: `Browse ${profile.rowCount.toLocaleString()} rows as cards`,
          'aria-label': `Browse ${profile.rowCount.toLocaleString()} rows as cards`,
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
        }, h('i', { class: 'ph ph-cards-three text-sm' }));
        actionGroup.append(btnRecords);

        // 2. Three-dot dropdown menu for secondary options
        const menuDetails = h('details', { class: 'dropdown dropdown-end', 'data-auto-close': '' });
        const menuSummary = h('summary', {
          class: 'btn btn-xs btn-ghost btn-square text-base-content/80 hover:text-base-content list-none cursor-pointer',
          title: 'Options',
          'aria-label': 'Options',
        }, h('i', { class: 'ph ph-dots-three-vertical text-sm' }));

        const menuList = h('ul', { class: 'dropdown-content z-30 menu p-1.5 shadow-lg bg-base-200 rounded-box w-52 text-xs border border-base-300 mt-1' });

        // Toggle empty columns (if empty columns exist)
        if (emptyColNames.length > 0) {
          const itemEmpty = h('li', {},
            h('a', {
              class: 'flex items-center justify-between',
              onClick: (e) => {
                menuDetails.removeAttribute('open');
                toggleEmptyCols();
              },
            },
              h('span', { class: 'flex items-center gap-2' },
                h('i', { class: `ph ${hideEmptyCols ? 'ph-eye' : 'ph-eye-slash'}` }),
                h('span', { text: hideEmptyCols ? 'Show empty columns' : 'Hide empty columns' })
              ),
              h('span', { class: 'badge badge-xs font-mono opacity-70', text: String(emptyColNames.length) })
            )
          );
          menuList.append(itemEmpty);
        }

        // Download CSV
        const itemDownload = h('li', {},
          h('a', {
            class: 'flex items-center gap-2',
            onClick: (e) => {
              menuDetails.removeAttribute('open');
              const fields = profile.columns.map(c => c.title);
              const values = rows.map(r => profile.columns.map(c => r[c.name] ?? ''));
              const csv = typeof Papa !== 'undefined'
                ? Papa.unparse({ fields, data: values })
                : [fields, ...values].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
              const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = name;
              a.click();
              URL.revokeObjectURL(url);
            },
          },
            h('i', { class: 'ph ph-download-simple' }),
            h('span', { text: 'Download CSV' })
          )
        );
        menuList.append(itemDownload);

        // Workbench handoff
        if (opts.onWorkbench) {
          const itemWb = h('li', {},
            h('a', {
              class: 'flex items-center gap-2',
              onClick: (e) => {
                menuDetails.removeAttribute('open');
                opts.onWorkbench(rows, name);
              },
            },
              h('i', { class: 'ph ph-wrench' }),
              h('span', { text: 'Open in Workbench' })
            )
          );
          menuList.append(itemWb);
        }

        menuDetails.append(menuSummary, menuList);
        actionGroup.append(menuDetails);
      }

      // ---- COLUMNS VIEW (Master-Detail Schema Matrix) ------------------------
      function renderColumnsView() {
        columnsStage.replaceChildren();

        // 1. Compact Header Bar (One line, no stat cards)
        const topBar = h('div', { class: 'shrink-0 flex flex-wrap items-center justify-between gap-3 px-3 py-2 border-b border-base-300 bg-base-100 text-xs' });

        const infoLine = h('div', { class: 'font-mono text-base-content/70 truncate' },
          h('span', { class: 'font-semibold text-base-content', text: `${profile.rowCount.toLocaleString()} rows` }),
          h('span', { class: 'opacity-40 mx-1.5', text: '·' }),
          h('span', { text: `${profile.colCount} columns` }),
          profile.typeCounts.empty ? h('span', { class: 'text-warning/80 ml-1', text: `(${profile.typeCounts.empty} empty)` }) : null,
          h('span', { class: 'opacity-40 mx-1.5', text: '·' }),
          h('span', { text: `${fmtPct(profile.fillRate)} filled` })
        );

        const filterControls = h('div', { class: 'flex items-center gap-2' });

        // Search columns
        const searchInput = h('input', {
          type: 'search',
          placeholder: 'Filter columns...',
          value: colSearch,
          class: 'input input-xs input-bordered w-32 sm:w-44 font-mono text-xs',
          onInput: (e) => { colSearch = e.target.value.toLowerCase(); updateSplitView(); },
        });

        // Type filter
        const typeSelect = h('select', {
          class: 'select select-xs select-bordered font-mono text-xs',
          onChange: (e) => { colTypeFilter = e.target.value; updateSplitView(); },
        },
          h('option', { value: 'all', selected: colTypeFilter === 'all', text: `All types (${profile.colCount})` }),
          h('option', { value: 'numeric', selected: colTypeFilter === 'numeric', text: `Numeric (${profile.typeCounts.numeric})` }),
          h('option', { value: 'categorical', selected: colTypeFilter === 'categorical', text: `Categorical (${profile.typeCounts.categorical})` }),
          h('option', { value: 'temporal', selected: colTypeFilter === 'temporal', text: `Date/Year (${profile.typeCounts.temporal})` }),
          h('option', { value: 'text', selected: colTypeFilter === 'text', text: `Text (${profile.typeCounts.text})` }),
          h('option', { value: 'empty', selected: colTypeFilter === 'empty', text: `Empty (${profile.typeCounts.empty})` })
        );

        // Sort order
        const sortSelect = h('select', {
          class: 'select select-xs select-bordered font-mono text-xs',
          onChange: (e) => { colSort = e.target.value; updateSplitView(); },
        },
          h('option', { value: 'index', selected: colSort === 'index', text: 'Order: Original' }),
          h('option', { value: 'name', selected: colSort === 'name', text: 'Order: Name' }),
          h('option', { value: 'missing', selected: colSort === 'missing', text: 'Order: Missing %' }),
          h('option', { value: 'cardinality', selected: colSort === 'cardinality', text: 'Order: Distinct' })
        );

        filterControls.append(searchInput, typeSelect, sortSelect);
        topBar.append(infoLine, filterControls);
        columnsStage.append(topBar);

        // 2. Master-Detail Split Pane Container
        const split = h('div', { class: 'flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden' });
        columnsStage.append(split);

        // Left Pane: Column Schema Table
        const listPane = h('div', { class: 'flex-1 min-h-0 overflow-y-auto bg-base-100 border-b md:border-b-0 md:border-r border-base-300' });
        // Right Pane: Active Column Inspector
        const detailPane = h('div', { class: 'w-full md:w-80 lg:w-96 shrink-0 min-h-0 overflow-y-auto bg-base-200/40 p-3.5' });
        split.append(listPane, detailPane);

        function updateSplitView() {
          listPane.replaceChildren();

          let cols = profile.columns.slice();
          if (colTypeFilter !== 'all') cols = cols.filter(c => c.type === colTypeFilter);
          if (colSearch) cols = cols.filter(c => c.title.toLowerCase().includes(colSearch));

          if (colSort === 'name') cols.sort((a, b) => a.title.localeCompare(b.title));
          else if (colSort === 'missing') cols.sort((a, b) => (1 - a.fillRate) - (1 - b.fillRate) || a.index - b.index);
          else if (colSort === 'cardinality') cols.sort((a, b) => b.distinctCount - a.distinctCount || a.index - b.index);
          else cols.sort((a, b) => a.index - b.index);

          if (!cols.some(c => c.name === selectedColName)) {
            selectedColName = cols[0]?.name || null;
          }

          if (!cols.length) {
            listPane.append(h('div', { class: 'p-8 text-center text-xs text-base-content/40 italic' }, 'No columns match this filter.'));
            detailPane.replaceChildren(h('div', { class: 'p-6 text-center text-xs text-base-content/40 italic' }, 'No column selected.'));
            return;
          }

          // Dense Schema Table
          const tbl = h('table', { class: 'table table-xs table-pin-rows w-full font-sans' });
          const thead = h('thead', {},
            h('tr', { class: 'bg-base-200 text-xs' },
              h('th', { class: 'w-8 text-base-content/40 font-mono text-[10px]' }, '#'),
              h('th', { class: 'min-w-[10rem]' }, 'Column'),
              h('th', { class: 'w-24' }, 'Type'),
              h('th', { class: 'w-32' }, 'Completeness'),
              h('th', { class: 'w-20 text-right' }, 'Distinct'),
              h('th', { class: 'min-w-[12rem]' }, 'Profile Summary')
            )
          );
          tbl.append(thead);

          const tbody = h('tbody', {});
          for (const col of cols) {
            const isSelected = col.name === selectedColName;

            // Summary cell preview
            let summaryNode;
            if (col.type === 'empty') {
              summaryNode = h('span', { class: 'opacity-40 italic text-[11px]' }, '100% blank');
            } else if (col.type === 'numeric' && col.numStats) {
              summaryNode = h('span', { class: 'font-mono text-[11px] text-base-content/70' },
                `${fmtNum(col.numStats.min)} · Med ${fmtNum(col.numStats.median)} · ${fmtNum(col.numStats.max)} (Sum: ${fmtNum(col.numStats.sum)})`
              );
            } else if (col.topValues.length) {
              const chips = col.topValues.slice(0, 3).map(tv =>
                h('span', { class: 'badge badge-xs bg-base-200 border-base-300 font-mono text-[10px] mr-1' },
                  `${tv.value}: ${tv.count}`
                )
              );
              summaryNode = h('div', { class: 'flex items-center flex-wrap gap-0.5' }, ...chips);
            } else {
              summaryNode = h('span', { class: 'font-mono text-[11px] text-base-content/50' }, `${col.filled} values`);
            }

            const tr = h('tr', {
              class: `cursor-pointer transition-colors ${isSelected ? 'bg-primary/15 font-semibold text-primary' : 'hover:bg-base-200/50'}`,
              onClick: () => {
                selectedColName = col.name;
                updateSplitView();
              },
            },
              h('td', { class: 'font-mono text-[10px] opacity-50', text: String(col.index + 1) }),
              h('td', { class: 'font-mono text-xs font-semibold' },
                h('span', { title: col.title, text: col.title })
              ),
              h('td', {},
                h('span', { class: `badge badge-xs font-mono text-[10px] uppercase gap-1 ${col.color}` },
                  h('i', { class: `ph ${col.icon} text-[10px]` }),
                  h('span', { text: col.type })
                )
              ),
              h('td', {},
                h('div', { class: 'flex items-center gap-1.5 font-mono text-[10px]' },
                  h('div', { class: 'w-12 h-1.5 bg-base-300 rounded-full overflow-hidden flex shrink-0' },
                    h('div', { class: `h-full ${col.fillRate === 1 ? 'bg-success' : 'bg-primary'}`, style: `width: ${col.fillRate * 100}%` })
                  ),
                  h('span', { text: fmtPct(col.fillRate) }),
                  col.nulls > 0 ? h('span', { class: 'text-warning/80 text-[9px]', text: `(${col.nulls})` }) : null
                )
              ),
              h('td', { class: 'text-right font-mono text-xs text-base-content/70', text: col.distinctCount.toLocaleString() }),
              h('td', { class: 'align-middle' }, summaryNode)
            );
            tbody.append(tr);
          }

          tbl.append(tbody);
          listPane.append(tbl);

          renderInspector(cols.find(c => c.name === selectedColName) || cols[0]);
        }

        // Right Inspector Panel
        function renderInspector(col) {
          detailPane.replaceChildren();
          if (!col) return;

          const panel = h('div', { class: 'flex flex-col gap-3 font-sans' });

          // Header
          const hd = h('div', { class: 'flex items-start justify-between gap-2 pb-2 border-b border-base-300' },
            h('div', { class: 'min-w-0 flex-1' },
              h('div', { class: 'text-[10px] font-mono text-base-content/40', text: `Column #${col.index + 1}` }),
              h('h3', { class: 'font-mono text-sm font-bold truncate text-base-content', title: col.title, text: col.title })
            ),
            h('span', { class: `badge badge-sm font-mono text-[10px] uppercase gap-1 shrink-0 ${col.color}` },
              h('i', { class: `ph ${col.icon}` }),
              h('span', { text: col.type })
            )
          );
          panel.append(hd);

          // Completeness / Quality summary
          const qBox = h('div', { class: 'p-2 rounded bg-base-100 border border-base-300 text-xs font-mono flex flex-col gap-1' },
            h('div', { class: 'flex justify-between text-[11px] text-base-content/70' },
              h('span', { text: `${col.filled.toLocaleString()} filled (${fmtPct(col.fillRate)})` }),
              h('span', { class: col.nulls > 0 ? 'text-warning' : 'text-success', text: col.nulls > 0 ? `${col.nulls.toLocaleString()} null` : '0 null' })
            ),
            h('div', { class: 'w-full h-1.5 bg-base-300 rounded-full overflow-hidden flex' },
              h('div', { class: `h-full ${col.fillRate === 1 ? 'bg-success' : 'bg-primary'}`, style: `width: ${col.fillRate * 100}%` })
            )
          );
          panel.append(qBox);

          // Numeric Deep Dive
          if (col.type === 'numeric' && col.numStats) {
            const st = col.numStats;

            // 5-number summary matrix
            const numGrid = h('div', { class: 'grid grid-cols-2 gap-1.5 text-xs font-mono p-2 rounded bg-base-100 border border-base-300' },
              h('div', {}, h('span', { class: 'text-base-content/50 block text-[10px]' }, 'Minimum'), h('span', { class: 'font-semibold', text: fmtNum(st.min) })),
              h('div', {}, h('span', { class: 'text-base-content/50 block text-[10px]' }, 'Maximum'), h('span', { class: 'font-semibold', text: fmtNum(st.max) })),
              h('div', {}, h('span', { class: 'text-base-content/50 block text-[10px]' }, 'Median'), h('span', { class: 'font-semibold', text: fmtNum(st.median) })),
              h('div', {}, h('span', { class: 'text-base-content/50 block text-[10px]' }, 'Mean'), h('span', { class: 'font-semibold', text: fmtNum(st.mean) })),
              h('div', {}, h('span', { class: 'text-base-content/50 block text-[10px]' }, 'Total Sum'), h('span', { class: 'font-semibold text-primary', text: fmtNum(st.sum) })),
              h('div', {}, h('span', { class: 'text-base-content/50 block text-[10px]' }, 'Zeros / Negatives'), h('span', { text: `${st.zeros} / ${st.negatives}` }))
            );
            panel.append(numGrid);

            // Distribution Histogram
            const histHeader = h('div', { class: 'text-[11px] font-mono text-base-content/70 mt-1' }, 'Distribution (10 bins):');
            panel.append(histHeader);

            const histWrap = h('div', { class: 'p-2 rounded bg-base-100 border border-base-300' });
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('viewBox', '0 0 200 48');
            svg.setAttribute('class', 'w-full h-12 block');

            const binW = 18;
            const gap = 2;
            st.bins.forEach((b, i) => {
              const hVal = Math.max(2, Math.round(b.pct * 40));
              const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
              rect.setAttribute('x', String(i * (binW + gap)));
              rect.setAttribute('y', String(44 - hVal));
              rect.setAttribute('width', String(binW));
              rect.setAttribute('height', String(hVal));
              rect.setAttribute('rx', '1');
              rect.setAttribute('fill', 'currentColor');
              rect.setAttribute('class', b.count > 0 ? 'text-primary opacity-70 hover:opacity-100 transition-opacity cursor-pointer' : 'text-base-300 opacity-40');

              const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
              title.textContent = `${fmtNum(b.from)} to ${fmtNum(b.to)}: ${b.count} rows`;
              rect.append(title);
              svg.append(rect);
            });
            histWrap.append(svg);

            const histFoot = h('div', { class: 'flex justify-between text-[10px] font-mono text-base-content/50 mt-1' },
              h('span', { text: fmtNum(st.min) }),
              h('span', { text: fmtNum(st.max) })
            );
            histWrap.append(histFoot);
            panel.append(histWrap);
          }

          // Categorical & Temporal Frequency Table
          if (col.topValues && col.topValues.length && col.type !== 'empty') {
            const freqTitle = h('div', { class: 'flex items-center justify-between text-[11px] font-mono text-base-content/70 mt-1' },
              h('span', { text: `Values (${col.distinctCount.toLocaleString()} distinct):` }),
              h('span', { class: 'text-[10px] opacity-60', text: 'Tap to filter' })
            );
            panel.append(freqTitle);

            const valList = h('div', { class: 'rounded border border-base-300 bg-base-100 max-h-60 overflow-y-auto' });
            for (const tv of col.topValues) {
              const row = h('div', {
                class: 'px-2.5 py-1.5 flex items-center justify-between text-xs hover:bg-base-200/60 cursor-pointer transition-colors border-b border-base-200 last:border-b-0',
                title: `Filter Data view by ${col.title} = "${tv.value}"`,
                onClick: () => filterByColumnValue(col.name, tv.value),
              },
                h('span', { class: 'font-mono text-xs truncate max-w-[12rem] text-base-content', text: tv.value }),
                h('div', { class: 'flex items-center gap-1.5 shrink-0 font-mono text-[11px] text-base-content/60' },
                  h('span', { text: tv.count.toLocaleString() }),
                  h('span', { class: 'opacity-50 text-[10px]', text: `(${fmtPct(tv.pct)})` }),
                  h('i', { class: 'ph ph-funnel-simple text-xs opacity-50 hover:opacity-100 hover:text-primary' })
                )
              );
              valList.append(row);
            }
            panel.append(valList);
          }

          if (col.type === 'empty') {
            const empMsg = h('div', { class: 'p-4 rounded border border-base-300 bg-base-100 text-xs text-base-content/60 italic text-center' },
              `All ${profile.rowCount.toLocaleString()} rows are empty or blank in this column.`
            );
            panel.append(empMsg);
          }

          detailPane.append(panel);
        }

        updateSplitView();
      }

      // Backward compatibility: alias renderProfileView to renderColumnsView
      const renderProfileView = renderColumnsView;

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

        const colOpts = profile.columns.filter(c => c.type !== 'empty').map(c => ({ k: c.name, l: c.title }));
        const numColOpts = profile.columns.filter(c => c.type === 'numeric').map(c => ({ k: c.name, l: c.title }));
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
              h('th', { text: columnTitle(pDim1) }),
              pDim2 ? h('th', { text: columnTitle(pDim2) }) : null,
              h('th', { class: 'text-right', text: 'Rows' }),
              h('th', { class: 'text-right min-w-[12rem]', text: `${pAgg.toUpperCase()} of ${pMeasure ? columnTitle(pMeasure) : 'Rows'}` })
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
