// kits/xlsx-map.js — HOW A WORKBOOK'S PARTS CONNECT, and what each sheet holds,
// read from what kits/xlsx.js already parsed. Nothing here opens a file.
//
// kits/xlsx.js joins each part to its neighbours (a pivot to the sheet it sits
// on and the cache it reads, a table to its sheet, a chart to its drawing) and
// stops there. The questions a reader brings to a workbook they did not build
// are one step further: which sheets feed which, where a pivot's rows come
// from, what a query loads and from where, which sheet is a table and which is
// a form. Those are answered here, as rows a view can draw and a test can hold.
//
//   XlsxMap.links(result)        every link, [{ kind, from, to, count, cells, via, detail }]
//   XlsxMap.gist(result)         per sheet, in workbook order: size, shape, header, facts
//   XlsxMap.queries(result)      each Power Query by name, [{ name, section, m }]
//   XlsxMap.refs(text, ctx)      the sheets, tables and names one formula reaches
//   XlsxMap.words(link)          a link as { from, verb, to }, for a table's columns
//   XlsxMap.phrase(link)         the same as one line a reader can check
//
// A link's `from` and `to` are nodes, { type, name, sheet }: `type` is one of
// sheet, external, table, pivot, query, connection, chart. `sheet` is the
// sheet a non-sheet node sits on, where it sits on one. Direction is the
// direction data moves: Ledger -> Summary means Summary reads Ledger.
//
// WHAT IS NOT READ. Formula references are found by pattern in the stored
// text, after string literals are removed; INDIRECT, OFFSET over a computed
// address and VBA can reach any sheet and are invisible to this. A shared
// formula's followers are counted against their master's text, which names the
// same sheets. Attaches to window.XlsxMap; loaded via gh.load('kits/xlsx-map.js').
(() => {
  const colLetter = (n) => {
    let s = '';
    for (n += 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
    return s;
  };

  const sheetsOf = (xl) => Object.entries(xl?.sheets || {})
    .map(([key, s]) => ({ key, s, name: s.name || key }))
    .sort((a, b) => (a.s.index ?? 1e9) - (b.s.index ?? 1e9) || a.key.localeCompare(b.key));

  // kits/xlsx.js's own rule for a relationship target, repeated rather than
  // exported: a target is relative to the folder of the part that owns it.
  const resolve = (from, target) => {
    const t = String(target || '');
    if (t.startsWith('/')) return t.slice(1);
    const out = [];
    for (const seg of (from.slice(0, from.lastIndexOf('/') + 1) + t).split('/')) {
      if (seg === '' || seg === '.') continue;
      if (seg === '..') out.pop(); else out.push(seg);
    }
    return out.join('/');
  };

  const fileName = (path) => decodeURIComponent(String(path || '').split(/[\\/]/).pop() || path || '');
  const lower = (s) => String(s || '').toLowerCase();

  // ---- the context a formula is read against -------------------------------

  // Sheet, table and defined names, each to the sheet it lives on, plus the
  // external workbooks in the order a formula's [n] counts them. The order
  // comes from workbook.xml's <externalReferences>, which kits/xlsx.js records
  // as an attribute set in document order; the filename's number is a
  // convention and is not used.
  function context(result) {
    const { xl, el = {} } = result;
    const sheets = new Map(sheetsOf(xl).map(({ name }) => [lower(name), name]));
    const tables = new Map();
    for (const t of Object.values(xl.tables || {})) {
      const host = xl.sheets[t.sheet]?.name;
      if (host) for (const n of [t.displayName, t.name]) if (n) tables.set(lower(n), { name: t.displayName || t.name, sheet: host });
    }
    const names = new Map();
    for (const d of xl.definedNames || []) {
      if (!d.name || d.name.startsWith('_xlnm.')) continue;
      const target = refSheets(d.reference || '', sheets);
      if (target.length) names.set(lower(d.name), { name: d.name, sheets: target });
    }
    const wbRels = Object.fromEntries((xl.relationships['xl/workbook.xml'] || []).map(r => [r.id, r.target]));
    const order = [...(el['xl/workbook.xml::workbook.externalReferences.externalReference']?.attr?.['@r:id'] || [])];
    const externals = order.map((rid, i) => {
      const part = wbRels[rid] ? resolve('xl/workbook.xml', wbRels[rid]) : null;
      const file = part ? (xl.relationships[part] || [])[0]?.target : null;
      return file ? fileName(file) : `external workbook [${i + 1}]`;
    });
    return { sheets, tables, names, externals };
  }

  // The sheets a reference text names, quoted or bare, by their real names.
  function refSheets(text, sheets) {
    const out = new Set();
    for (const { sheet } of scan(text)) {
      const hit = sheets.get(lower(sheet));
      if (hit) out.add(hit);
    }
    return [...out];
  }

  // `'Q1 / Q2'!A1`, `Ledger!A1`, `[1]Rates!B2`, `'[2]Year 2024'!C3` and the
  // two ends of a 3D `Jan:Mar!B4`. Bare names start with a letter or an
  // underscore, which is when Excel leaves a name unquoted.
  const QUOTED = /'((?:[^']|'')+)'!/g;
  const BARE = /(^|[^\w.'\]\\])((?:\[\d+\])?[A-Za-z_À-￿][\w.À-￿]*(?::[A-Za-z_À-￿][\w.À-￿]*)?)!/g;
  function scan(text) {
    const out = [];
    const t = String(text || '').replace(/"(?:[^"]|"")*"/g, '""');
    const take = (raw) => {
      const ext = raw.match(/^\[(\d+)\](.*)$/);
      const body = ext ? ext[2] : raw;
      for (const sheet of body.split(':')) out.push({ sheet, external: ext ? Number(ext[1]) : null });
    };
    for (const m of t.matchAll(QUOTED)) take(m[1].replace(/''/g, "'"));
    for (const m of t.replace(QUOTED, "''").matchAll(BARE)) take(m[2]);
    return out;
  }

  // ONE FORMULA'S REACH: the sheets it names, the tables its structured
  // references name, and the defined names it uses, each resolved to a sheet.
  // `self` is the sheet holding the formula, so a reference to its own sheet
  // is dropped rather than drawn as a loop.
  function refs(text, ctx, self) {
    const out = [];
    const add = (sheet, via, external) => { if (external != null || (sheet && sheet !== self)) out.push({ sheet, via, external }); };
    const t = String(text || '').replace(/"(?:[^"]|"")*"/g, '""');
    for (const { sheet, external } of scan(t)) {
      if (external != null) add(ctx.externals[external - 1] || `external workbook [${external}]`, null, external);
      else add(ctx.sheets.get(lower(sheet)), null, null);
    }
    const bare = t.replace(QUOTED, "''").replace(BARE, '$1');
    for (const m of bare.matchAll(/([A-Za-z_\\][\w.]*)\[/g)) {
      const tbl = ctx.tables.get(lower(m[1]));
      if (tbl) add(tbl.sheet, `table ${tbl.name}`, null);
    }
    for (const m of bare.matchAll(/(^|[^\w.$[\]])([A-Za-z_\\][\w.]*)(?![\w.([!])/g)) {
      const nm = ctx.names.get(lower(m[2]));
      if (nm) for (const sheet of nm.sheets) add(sheet, `name ${nm.name}`, null);
    }
    return out;
  }

  // ---- queries --------------------------------------------------------------

  // EACH QUERY BY NAME. kits/xlsx.js returns the mashup's M files, and one
  // file (`Formulas/Section1.m`, usually the only one) holds every query as a
  // `shared Name = …;` member. The member is what Excel's Queries pane lists,
  // so it is the unit here. A member is found at the start of a line, so the
  // word inside a string or a comment does not open one.
  function queries(xl) {
    const out = [];
    for (const sec of xl.powerQuery?.sections || []) {
      const m = String(sec.m || '');
      const heads = [...m.matchAll(/(?:^[ \t]*\[[^\r\n]*\][ \t]*\r?\n[ \t\r\n]*)*^[ \t]*shared[ \t]+(#"(?:[^"]|"")+"|[A-Za-z_][\w.]*)[ \t]*=/gm)];
      heads.forEach((h, i) => {
        const name = h[1].startsWith('#"') ? h[1].slice(2, -1).replace(/""/g, '"') : h[1];
        const body = m.slice(h.index + h[0].length, i + 1 < heads.length ? heads[i + 1].index : m.length)
          .trim().replace(/;\s*$/, '');
        out.push({ name, section: sec.path, m: body });
      });
    }
    return out;
  }

  // ---- links ----------------------------------------------------------------

  const node = (type, name, sheet) => ({ type, name, sheet: sheet ?? (type === 'sheet' ? name : null) });
  const SAMPLE = 6;

  function links(result) {
    const { xl, el = {} } = result;
    const ctx = context(result);
    const out = [];
    const agg = new Map();
    const bump = (kind, from, to, cell, via, detail) => {
      const k = [kind, from.type, from.name, to.type, to.name, to.sheet].join('\u0001');
      const l = agg.get(k) || { kind, from, to, count: 0, cells: [], via: new Set(), detail: detail || '' };
      l.count++;
      if (cell && l.cells.length < SAMPLE) l.cells.push(cell);
      if (via) l.via.add(via);
      agg.set(k, l);
    };

    // Formulas: every computed cell, its own text or its master's.
    for (const { s, name } of sheetsOf(xl)) {
      for (const row of s.rows || []) {
        for (const [col, f] of Object.entries(row.formulas || {})) {
          const text = typeof f === 'string' ? f
            : row.shared?.[col] != null ? s.sharedFormulas?.[row.shared[col]] : '';
          if (!text) continue;
          // One count per cell per source, however often the text names it;
          // every route it took (a table, a defined name) is kept.
          const bySource = new Map();
          for (const r of refs(text, ctx, name)) {
            const from = r.external != null ? node('external', r.sheet) : node('sheet', r.sheet);
            const k = from.type + '\u0001' + from.name;
            const got = bySource.get(k) || { from, via: [] };
            if (r.via) got.via.push(r.via);
            bySource.set(k, got);
          }
          const cell = colLetter(Number(col)) + row.row;
          for (const { from, via } of bySource.values()) {
            bump('formula', from, node('sheet', name), cell, null);
            const l = agg.get(['formula', from.type, from.name, 'sheet', name, name].join('\u0001'));
            for (const v of via) l.via.add(v);
          }
        }
      }
      // A dropdown whose list lives on another sheet.
      for (const v of s.validations || []) {
        for (const r of refs(v.formula1, ctx, name)) {
          if (r.external != null) continue;
          bump('validation', node('sheet', r.sheet), node('sheet', name), v.ranges?.[0]?.ref || null, r.via, v.type);
        }
      }
      // Charts: each series' ranges, to the chart on the sheet that draws it.
      (s.drawings || []).filter(d => d.kind === 'chart').forEach((d, i) => {
        const title = d.chart?.title || `Chart ${i + 1}`;
        const to = node('chart', title, name);
        const from = new Set();
        for (const ser of d.chart?.series || []) {
          for (const ref of [ser.valuesRef, ser.categoriesRef]) for (const sh of refSheets(ref, ctx.sheets)) from.add(sh);
        }
        for (const sh of from) bump('chart', node('sheet', sh), to, null, null, '');
      });
    }

    // Pivots: the cache's source, to the table drawn from it. A source named
    // rather than addressed (a table or a defined name) is followed to its sheet.
    for (const pt of Object.values(xl.pivotTables || {})) {
      const cache = pt.cachePart ? xl.pivotCaches?.[pt.cachePart] : null;
      const src = cache?.source;
      const host = xl.sheets[pt.sheet]?.name || null;
      if (!src) continue;
      const named = src.name ? (ctx.tables.get(lower(src.name))?.sheet || ctx.names.get(lower(src.name))?.sheets[0]) : null;
      const sheet = src.sheet ? ctx.sheets.get(lower(src.sheet)) || src.sheet : named;
      const where = src.sheet ? `${src.sheet}!${src.ref}` : src.name || '';
      const from = sheet ? node('sheet', sheet) : node('external', where || 'an external source');
      out.push({ kind: 'pivot', from, to: node('pivot', pt.name || 'Pivot', host),
        count: cache.recordCount ?? null, cells: [], via: src.name ? [`${src.name}`] : [], detail: where });
    }

    // Queries and connections: what each loads, and what each reads.
    const conns = xl.connections || [];
    const qs = queries(xl);
    const isQuery = (n) => qs.some(q => q.name === n);
    // Which query a connection runs. Excel names it in the connection string
    // (`Location=AFRS`) and usually in the command; older files say it only in
    // the connection's name or description.
    const queryOf = (c) => {
      if (!c?.powerQuery) return null;
      const said = [
        c.detail?.match(/Location=("?)([^;"]+)\1/)?.[2],
        c.detail?.match(/^\s*SELECT \* FROM \[([^\]]+)\]/i)?.[1],
        c.detail, c.name?.match(/^Query - (.+)$/)?.[1], c.description?.match(/'([^']+)' query/)?.[1],
      ];
      return said.find(n => n && isQuery(n)) || null;
    };
    const loads = (qtPart, host) => {
      const id = [...(el[`${qtPart}::queryTable`]?.attr?.['@connectionId'] || [])][0];
      const c = conns.find(x => x.id === id);
      return c ? { c, q: queryOf(c), host } : null;
    };
    const loaded = new Set();
    for (const [part, t] of Object.entries(xl.tables || {})) {
      const rel = (xl.relationships[part] || []).find(r => /queryTable/i.test(r.type) || /queryTable\d*\.xml$/i.test(r.target));
      const hit = rel && loads(resolve(part, rel.target), xl.sheets[t.sheet]?.name);
      if (!hit) continue;
      loaded.add(hit.c);
      const from = hit.q ? node('query', hit.q) : node('connection', hit.c.name || `Connection ${hit.c.id}`);
      out.push({ kind: 'load', from, to: node('table', t.displayName || t.name, hit.host), count: null, cells: [], via: [], detail: hit.c.kind || '' });
    }
    for (const { key, name } of sheetsOf(xl)) {
      for (const rel of xl.relationships[`xl/worksheets/${key}.xml`] || []) {
        if (!/queryTable/i.test(rel.type)) continue;
        const hit = loads(resolve(`xl/worksheets/${key}.xml`, rel.target), name);
        if (!hit) continue;
        loaded.add(hit.c);
        const from = hit.q ? node('query', hit.q) : node('connection', hit.c.name || `Connection ${hit.c.id}`);
        out.push({ kind: 'load', from, to: node('sheet', name), count: null, cells: [], via: [], detail: hit.c.kind || '' });
      }
    }
    for (const c of conns) {
      const conn = node('connection', c.name || `Connection ${c.id}`);
      const q = queryOf(c);
      // A query's connection that loads no table here (to the data model, or
      // only as a connection) is still the query's way out of the workbook.
      if (q && !loaded.has(c)) out.push({ kind: 'source', from: node('query', q), to: conn, count: null, cells: [], via: [], detail: c.kind || '' });
      // A connection that is not a query reads from outside the workbook.
      if (!c.powerQuery && c.detail) out.push({ kind: 'source', from: node('external', c.detail), to: conn, count: null, cells: [], via: [], detail: c.kind || '' });
    }
    // A query's own sources, by the M functions that name them.
    for (const { name, m } of qs) {
      for (const t of m.matchAll(/Excel\.CurrentWorkbook\(\)\s*\{\s*\[\s*Name\s*=\s*"([^"]+)"/g)) {
        const tbl = ctx.tables.get(lower(t[1])) || ctx.names.get(lower(t[1]));
        const sheet = tbl?.sheet || tbl?.sheets?.[0];
        out.push({ kind: 'source', from: node('table', t[1], sheet), to: node('query', name),
          count: null, cells: [], via: [], detail: 'Excel.CurrentWorkbook' });
      }
      for (const t of m.matchAll(/\b(Web\.Contents|File\.Contents|Folder\.Files|SharePoint\.(?:Files|Contents|Tables)|Sql\.Databases?|Odbc\.DataSource|OData\.Feed)\s*\(\s*"((?:[^"]|"")+)"/g)) {
        out.push({ kind: 'source', from: node('external', t[2].replace(/""/g, '"')), to: node('query', name),
          count: null, cells: [], via: [], detail: t[1] });
      }
      // Another query named in this one's text, unless the name is one of
      // this query's own steps (`Source` is a step in nearly every query and
      // occasionally also a query's name) or appears only inside a string
      // literal, comment, or bracketed field/record selector (`[Base]`).
      const stripped = m
        .replace(/\/\/[^\r\n]*|\/\*[\s\S]*?\*\//g, ' ')
        .replace(/(?<!#)"(?:[^"]|"")*"/g, '""')
        .replace(/\[[^\]]*\]/g, '[]');
      const steps = new Set([...stripped.matchAll(/(?:\blet\b|,)\s*(?:#"((?:[^"]|"")+)"|([A-Za-z_]\w*))\s*=/g)].map(t => (t[1] ? t[1].replace(/""/g, '"') : t[2])));
      for (const t of stripped.matchAll(/#"((?:[^"]|"")+)"|\b([A-Za-z_]\w*)\b/g)) {
        const other = t[1] ? t[1].replace(/""/g, '"') : t[2];
        if (other === name || steps.has(other) || !isQuery(other)) continue;
        if (!out.some(l => l.kind === 'source' && l.from.type === 'query' && l.from.name === other && l.to.name === name))
          out.push({ kind: 'source', from: node('query', other), to: node('query', name), count: null, cells: [], via: [], detail: 'query' });
      }
    }

    for (const l of agg.values()) out.push({ ...l, via: [...l.via] });
    return out;
  }

  // A link as words: the subject, what it does, the object. The names are
  // the file's own; the verb is the only thing this decides.
  const VERB = {
    formula: 'is read by formulas on',
    validation: 'supplies a dropdown list on',
    chart: 'is drawn in',
    pivot: 'is the source of',
    load: 'loads',
    source: 'feeds',
  };
  function words(l) {
    const at = (n) => n.type === 'sheet' ? n.name
      : `${n.type} ${n.name}${n.sheet && n.type !== 'external' ? ` on ${n.sheet}` : ''}`;
    return { from: at(l.from), verb: VERB[l.kind] || 'reaches', to: at(l.to) };
  }
  const phrase = (l) => { const w = words(l); return `${w.from} ${w.verb} ${w.to}`; };

  // ---- gist -----------------------------------------------------------------

  const filled = (v) => v !== null && v !== undefined && String(v).trim() !== '';
  // A stored number arrives as its <v> text, so a string of digits is a number.
  const isText = (v) => typeof v === 'string' && v.trim() !== '' && !/^[-+]?[\d,.]+(?:[eE][-+]?\d+)?%?$/.test(v.trim());

  // WHICH ROW NAMES THE COLUMNS, guessed once so a reader is shown headings
  // rather than a title band. The first of the top rows that is mostly text,
  // fills at least half the used width, and has rows under it.
  function headerRow(rows, width) {
    const top = rows.filter(r => Object.values(r.cells || {}).some(filled)).slice(0, 12);
    for (let i = 0; i < top.length - 2; i++) {
      const vals = Object.values(top[i].cells).filter(filled);
      const text = vals.filter(isText).length;
      if (vals.length >= 2 && text >= Math.max(2, vals.length * 0.6) && vals.length >= Math.max(2, width * 0.5)) return top[i].row;
    }
    return null;
  }

  function gist(result) {
    const { xl } = result;
    const ctx = context(result);
    return sheetsOf(xl).map(({ key, s, name }) => {
      const rows = (s.rows || []).filter(r => Object.values(r.cells || {}).some(filled));
      let width = 0;
      for (const r of rows) for (const [c, v] of Object.entries(r.cells)) if (filled(v)) width = Math.max(width, Number(c) + 1);
      const found = headerRow(rows, width);
      const hdrCells = found ? rows.find(r => r.row === found).cells : null;
      const heads = hdrCells ? Object.keys(hdrCells).map(Number).sort((a, b) => a - b)
        .filter(c => filled(hdrCells[c])).map(c => ({ col: colLetter(c), label: String(hdrCells[c]).trim() })) : [];
      const under = found ? rows.filter(r => r.row > found).length : 0;
      // HEADINGS OVER ROWS, and enough of either to be a list. Three headings
      // over two rows is a table; two are a form's label and value ("Prepared
      // by | Budget office") unless ten or more rows sit under them.
      const table = !!found && (heads.length >= 3 ? under >= 2 : under >= 10);
      const hdr = table ? found : null;
      const header = table ? heads : [];
      const labels = [];
      if (!table) {
        for (const r of rows) {
          for (const c of Object.keys(r.cells).map(Number).sort((a, b) => a - b)) {
            const v = r.cells[c];
            if (isText(v) && !labels.includes(v.trim())) labels.push(v.trim());
            if (labels.length >= 8) break;
          }
          if (labels.length >= 8) break;
        }
      }
      const below = table ? under : 0;
      const shape = !rows.length ? 'empty' : table ? 'table' : 'form';
      const named = [...ctx.names.values()].filter(n => n.sheets.includes(name)).map(n => n.name);
      return {
        key, name, visibility: s.visibility ?? null,
        rows: rows.length, cols: width, shape,
        headerRow: hdr, header, labels, records: below,
        formulas: s.formulas || 0,
        comments: (s.comments || xl.comments?.[key] || []).length,
        validations: (s.validations || []).length,
        merges: (s.merges || []).length,
        // What a visible sheet keeps out of sight, which Values still
        // carries: hidden rows by number, hidden columns by letter, the
        // columns only within the used width (a <col> range may run to XFD).
        hiddenRows: (s.rows || []).filter(r => r.hidden).map(r => r.row),
        hiddenCols: (s.cols || []).filter(c => c.hidden)
          .flatMap(c => { const out = []; for (let i = Math.max(1, c.min); i <= Math.min(c.max, width); i++) out.push(colLetter(i - 1)); return out; }),
        tables: (s.tables || []).map(p => xl.tables[p]?.displayName || xl.tables[p]?.name).filter(Boolean),
        pivots: (s.pivotTables || []).map(p => xl.pivotTables[p]?.name).filter(Boolean),
        charts: (s.drawings || []).filter(d => d.kind === 'chart').map((d, i) => d.chart?.title || `Chart ${i + 1}`),
        named,
      };
    });
  }

  window.XlsxMap = { links, gist, queries: (result) => queries(result.xl), refs: (text, result, self) => refs(text, context(result), self), words, phrase };
})();
