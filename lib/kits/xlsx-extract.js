// lib/kits/xlsx-extract.js — PICK PART OF A WORKBOOK AND CARRY THE ANSWER
// AWAY. kits/xlsx.js already reads every part of an .xlsx and returns plain
// objects; what was missing was a way to ask for SOME of that reading and hand
// the result to something else. This kit is that selection, and nothing more:
// it writes no file back, reconstructs no workbook, and renders nothing.
//
// SHEETS FIRST. The current picker selects kinds independently within each
// sheet, then selects modeled objects individually. A related pivot or cache
// is never included merely because its associated sheet is selected. The
// original two-axis cross-product remains as extract() for v1 callers.
//
// THE ANSWER IS A data-view ENVELOPE, with provenance. Every kind here
// serialises to a table of rows or to a block of source text, which is exactly
// what a data-view item carries, so an extract renders in pages/data-view.html
// today with no new page and no new viewer. The one thing that envelope has no
// slot for is where the extract CAME FROM: which workbook, at which ref, what
// was picked, and what was left behind. v1 and v2 are both data-view profiles,
// and the reasoning for making it a profile over data-view rather than a
// sibling of it is in docs/envelopes/workbook-extract.md.
//
// EVERY CUT IS REPORTED, never silently applied. The habit is pivotRecords':
// each item carries the rows it returned against the total it could have, so a
// reader can see the edge rather than discover it. The same fact is written
// into the item's `note`, where today's data-view reader shows it without
// knowing this format exists.
//
// Pure: no DOM, no network, no zip. Takes an already-analysed result (what
// xlsxKit.readZip or .analyze returns) and returns a plain object. Attaches to
// window.XlsxExtract. Contract and worked examples:
// docs/envelopes/workbook-extract.md.
(() => {
  const KIND = 'workbook-extract/1';
  const SELECTED_KIND = 'workbook-extract/2';

  // Read at call time rather than at load: this kit is registered before a
  // page's gh.load chain finishes, so binding the namespace here would capture
  // an undefined. The throw names the missing load, since the alternative is a
  // TypeError three frames down that reads as a bug in this file.
  const kit = () => {
    if (!window.xlsxKit) throw new Error('kits/xlsx-extract.js requires window.xlsxKit (load kits/xlsx.js first)');
    return window.xlsxKit;
  };

  // A1 address from a zero-based column index and a 1-based row.
  const at = (col, row) => kit().colLetter(col) + row;

  // A sheet's rows keyed by the column letter, which is what sheetRows returns
  // and what every tabular kind below either is or joins to.
  const sheetsOf = (xl) => Object.entries(xl?.sheets || {})
    .map(([key, s]) => ({ key, s, name: s.name || key }))
    .sort((a, b) => (a.s.index ?? 1e9) - (b.s.index ?? 1e9) || a.key.localeCompare(b.key));

  // ---- the kinds ----------------------------------------------------------
  //
  // One entry per kind. `count` is the cheap answer for a picker's matrix and
  // `parts` is the expensive one that actually builds rows; the two MUST agree,
  // since a matrix cell showing 400 beside an item holding 12 is a lie about
  // the file rather than about the cut. Where a cheap count could not be made
  // exact the kind counts the same way it produces (`columns` scans the row
  // keys, which is the set profileColumns itself enumerates).
  //
  // `parts` returns a LIST, because three kinds legitimately produce more than
  // one item: a workbook has one records table per pivot cache and one M
  // section per query part, and folding those together would lose which cache
  // or which section a row came from.

  // One sheet in the serialized-workbook shape:
  //   { SheetName, Dimension, MergedCells: ['A1:B1', …],
  //     Cells: [{ Address, Formula, Value }, …] }
  // Formula is '' for an entered cell, '=<text>' where the file stored text,
  // and '=[fill N] <master text>' for a shared-formula follower, whose own
  // text the file never stored. Value is the cached value as a string, which
  // is how the PowerShell exporter writes it too.
  const serializeSheet = (s, name) => {
    const cells = [];
    let r1 = Infinity, c1 = Infinity, r2 = 0, c2 = -1;
    for (const r of s.rows || []) {
      for (const [idx, v] of Object.entries(r.cells || {})) {
        const col = Number(idx);
        const f = r.formulas?.[idx];
        const si = r.shared?.[idx];
        let formula = '';
        if (typeof f === 'string') formula = '=' + f;
        else if (f === true) formula = si != null ? `=[fill ${si}] ${s.sharedFormulas?.[si] ?? ''}`.trimEnd() : '=';
        cells.push({ Address: at(col, r.row), Formula: formula, Value: v == null ? '' : String(v) });
        if (r.row < r1) r1 = r.row;
        if (r.row > r2) r2 = r.row;
        if (col < c1) c1 = col;
        if (col > c2) c2 = col;
      }
    }
    return {
      SheetName: name,
      Dimension: s.dimension || (cells.length ? `${at(c1, r1)}:${at(c2, r2)}` : ''),
      MergedCells: (s.merges || []).map(m => `${at(m.c1, m.r1)}:${at(m.c2, m.r2)}`),
      Cells: cells,
    };
  };

  // A number a cell holds, for the formula table's Value column: the raw value
  // as stored, since a formula's result under a date format is a different
  // question from the formula itself.
  const rowCells = (r) => r?.cells || {};

  const notesFor = (xl, name, want) => kit().workbookNotes(xl)
    .filter(n => n.sheet === name && (want === 'comment' ? n.kind === 'comment' : n.kind !== 'comment'));

  // A dxf index turned into the few words a reader needs: what the rule paints.
  // The full record is available through xlsxKit.dxfStyle; a table cell wants a
  // label, and an empty one is honest where the rule names no format at all.
  const dxfLabel = (xl, id) => {
    if (id == null) return '';
    const d = kit().dxfStyle(xl, id);
    // A rule that names a dxf the file does not carry, and a rule whose dxf
    // sets nothing a renderer can draw, are different facts and read
    // differently: the index alone says "there is a format here that this
    // reading could not turn into anything".
    if (!d) return `dxf ${id}`;
    const bits = [];
    if (d.fill) bits.push(`fill ${d.fill}`);
    if (d.color) bits.push(`text ${d.color}`);
    for (const k of ['bold', 'italic', 'underline', 'strike']) if (d[k]) bits.push(k);
    if (d.border) bits.push('border');
    return bits.join(', ');
  };

  const KINDS = [
    {
      id: 'values', label: 'Values', scope: 'sheet', view: 'table',
      gloss: 'every row, read through its number format',
      count: (s) => (s.rows || []).length,
      parts: ({ s, xl }) => [{ rows: kit().sheetRows(s, xl) }],
    },
    {
      // THE SERIALIZED-WORKBOOK SHAPE, one object per sheet: every cell as
      // its address, its formula and its cached value, plus the sheet's
      // declared range and merges. It is the shape home's PowerShell
      // exporter (Get-WsDetail) writes and the fund view's reader consumes,
      // so an extract taken here lands where that export already lands. Raw
      // values on purpose: a number formatted "33,912,780" is a string the
      // reader cannot parse, and the cached value is what the file holds.
      // Never cut, since a partial sheet in this shape reads as a whole one.
      id: 'cells', label: 'Cells', scope: 'sheet', view: 'code',
      gloss: 'every cell as address, formula and cached value, in the serialized-workbook shape',
      count: (s) => (s.rows || []).reduce((n, r) => n + Object.keys(r.cells || {}).length, 0),
      parts: ({ s, name }) => {
        const sheet = serializeSheet(s, name);
        const fills = sheet.Cells.filter(c => c.Formula.startsWith('=[fill ')).length;
        return [{
          label: 'cells', ext: 'json',
          text: JSON.stringify(sheet, null, 1),
          note: fills ? `${fills} filled formula${fills === 1 ? '' : 's'} carry the master's text under a [fill N] marker` : '',
        }];
      },
    },
    {
      id: 'formulas', label: 'Formulas', scope: 'sheet', view: 'table',
      gloss: 'one row per computed cell, with the stored formula text',
      count: (s) => (s.rows || []).reduce((n, r) => n + Object.keys(r.formulas || {}).length, 0),
      parts: ({ s, xl }) => {
        const out = [];
        let shared = 0;
        for (const r of s.rows || []) {
          for (const [idx, f] of Object.entries(r.formulas || {})) {
            const col = Number(idx);
            // A SHARED formula's followers store no text of their own. The
            // kit reports those as `true` rather than as an empty string, so
            // the distinction survives to here: an empty Formula cell means
            // the file did not store one, and the note says how many.
            if (f === true) shared++;
            out.push({
              Cell: at(col, r.row),
              Row: r.row,
              Column: kit().colLetter(col),
              Formula: typeof f === 'string' ? f : '',
              Value: rowCells(r)[idx] ?? null,
            });
          }
        }
        return [{
          rows: out,
          note: shared ? `${shared} of ${out.length} are shared-formula followers, which store no text of their own` : '',
        }];
      },
    },
    {
      id: 'styles', label: 'Styles', scope: 'sheet', view: 'table',
      gloss: 'one row per cell carrying a style, flattened to what it draws',
      count: (s) => (s.rows || []).reduce((n, r) => n + Object.keys(r.styles || {}).length, 0),
      parts: ({ s, xl }) => {
        const out = [];
        for (const r of s.rows || []) {
          for (const [idx, sx] of Object.entries(r.styles || {})) {
            const st = kit().cellStyle(xl, sx);
            if (!st) continue;
            const col = Number(idx);
            const b = st.border;
            out.push({
              Cell: at(col, r.row),
              Row: r.row,
              Column: kit().colLetter(col),
              Font: st.fontName || '',
              Size: st.size,
              Bold: st.bold ? 'yes' : '',
              Italic: st.italic ? 'yes' : '',
              Underline: st.underline ? 'yes' : '',
              Strike: st.strike ? 'yes' : '',
              Color: st.color || '',
              Fill: st.fill || '',
              Align: st.align || '',
              Valign: st.valign || '',
              Wrap: st.wrap ? 'yes' : '',
              Indent: st.indent || 0,
              // A border is four edges and a table cell is one string: the
              // sides that are drawn, named. The full record is one
              // xlsxKit.cellStyle call away for anything that needs it.
              Border: b ? ['top', 'right', 'bottom', 'left'].filter(k => b[k]).join(' ') : '',
              Format: st.format?.code || '',
              'Format kind': st.format?.kind || '',
            });
          }
        }
        return [{ rows: out }];
      },
    },
    {
      id: 'merges', label: 'Merges', scope: 'sheet', view: 'table',
      gloss: 'one row per merged range, with the anchor cell it draws from',
      count: (s) => (s.merges || []).length,
      parts: ({ s, xl }) => [{
        rows: (s.merges || []).map(m => {
          const anchor = (s.rows || []).find(r => r.row === m.r1);
          return {
            Range: `${at(m.c1, m.r1)}:${at(m.c2, m.r2)}`,
            Anchor: at(m.c1, m.r1),
            Rows: m.r2 - m.r1 + 1,
            Columns: m.c2 - m.c1 + 1,
            Value: anchor ? (rowCells(anchor)[m.c1] ?? null) : null,
          };
        }),
      }],
    },
    {
      id: 'comments', label: 'Comments', scope: 'sheet', view: 'table',
      gloss: 'the notes people left on cells',
      count: (s, xl, name) => notesFor(xl, name, 'comment').length,
      parts: ({ xl, name }) => [{
        rows: notesFor(xl, name, 'comment').map(n => ({
          Cell: n.cell, Author: n.author, Text: n.text,
        })),
      }],
    },
    {
      id: 'validations', label: 'Validations', scope: 'sheet', view: 'table',
      gloss: "a form's own field instructions and choice lists, one row per rule",
      count: (s, xl, name) => notesFor(xl, name, 'validation').length,
      parts: ({ xl, name }) => [{
        rows: notesFor(xl, name, 'validation').map(n => ({
          Cell: n.cell,
          Span: n.span || '',
          Kind: n.kind,
          Title: n.title,
          Text: n.text,
          // The options as the file lists them, joined: a choice list is the
          // fact, and the reader wants to read it rather than expand a nested
          // array in a tree.
          Options: (n.options || []).join(' | '),
        })),
      }],
    },
    {
      id: 'conditional', label: 'Conditional', scope: 'sheet', view: 'table',
      gloss: 'the rules that repaint a cell, as written, not as evaluated',
      count: (s) => (s.conditionalFormats || []).length,
      parts: ({ s, xl }) => [{
        rows: (s.conditionalFormats || []).slice()
          .sort((a, b) => a.priority - b.priority)
          .map(r => ({
            Range: (r.ranges || []).map(g => g.r1 === g.r2 && g.c1 === g.c2
              ? at(g.c1, g.r1) : `${at(g.c1, g.r1)}:${at(g.c2, g.r2)}`).join(' '),
            Type: r.type,
            Operator: r.operator,
            Priority: r.priority,
            'Stop if true': r.stopIfTrue ? 'yes' : '',
            Text: r.text,
            Formulas: (r.formulas || []).join(' | '),
            Format: dxfLabel(xl, r.dxfId),
          })),
        // WHAT THIS KIND IS NOT. These are the rules as the file states them.
        // Which cells Excel would actually paint is a second question, and the
        // kit answers it only for the rule types decidable from a cell alone
        // (xlsxKit.cfApplies); an expression rule needs a formula engine.
        note: 'the rules as written; whether each fires is not evaluated here',
      }],
    },
    {
      id: 'columns', label: 'Column profiles', scope: 'sheet', view: 'table',
      gloss: 'what each column holds: role, kind, fill, distincts',
      count: (s) => {
        const cols = new Set();
        for (const r of s.rows || []) for (const k of Object.keys(r.cells || {})) cols.add(k);
        return cols.size;
      },
      parts: ({ s, xl, headerRow }) => [{
        rows: profileRows(s, xl, headerRow),
      }],
    },
    {
      id: 'pivots', label: 'Pivots', scope: 'workbook', view: 'table',
      gloss: 'one row per pivot table, joined to the cache it reads',
      count: (result) => Object.keys(result.xl.pivotTables || {}).length,
      parts: ({ result }) => [{ rows: kit().views.pivots(result) }],
    },
    {
      id: 'records', label: 'Pivot records', scope: 'workbook', view: 'table',
      gloss: 'the rows behind a pivot, one table per cache',
      count: (result) => caches(result.xl)
        .reduce((n, part) => n + (kit().pivotRecords(result.xl, part)?.total || 0), 0),
      parts: ({ result, maxRows }) => caches(result.xl).map(part => {
        const got = kit().pivotRecords(result.xl, part, { limit: maxRows });
        const src = result.xl.pivotCaches[part]?.source;
        return {
          // A cache has no name of its own, so it is named by the range it was
          // built from. The part filename says nothing a reader knows.
          label: src ? `${src.sheet || src.name}!${src.ref}` : part.split('/').pop(),
          rows: got.rows,
          total: got.total,
          truncated: got.truncated,
          // What the part held against what the definition claims. The two
          // disagreeing is a fact about the file, not one to reconcile away.
          note: got.declared != null && got.declared !== got.total
            ? `the definition claims ${got.declared} records; the part holds ${got.total}` : '',
        };
      }),
    },
    {
      id: 'sources', label: 'Sources', scope: 'workbook', view: 'table',
      gloss: 'one row per external connection the workbook reaches',
      count: (result) => (result.xl.connections || []).length,
      parts: ({ result }) => [{ rows: kit().views.sources(result) }],
    },
    {
      id: 'queries', label: 'Power Query', scope: 'workbook', view: 'code',
      gloss: 'the M source, as source rather than as a table cell',
      count: (result) => (result.xl.powerQuery?.sections || []).length,
      parts: ({ result }) => (result.xl.powerQuery?.sections || []).map(q => ({
        label: q.path.split('/').pop(),
        text: q.m || '',
        ext: 'm',
      })),
    },
  ];

  const BY_ID = Object.fromEntries(KINDS.map(k => [k.id, k]));

  // The caches that actually carry rows. A workbook saved to refresh on open
  // has a definition and nothing behind it, which is a different answer from
  // "the pivot has no rows", so those are not offered rather than offered empty.
  const caches = (xl) => Object.keys(xl.pivotCaches || {}).filter(p => kit().pivotRecords(xl, p));

  // ONE RENDERING OF profileColumns, here rather than in the tab that draws it.
  // The Structure mode's Columns tab reads this too: two spellings of the same
  // table is how a column reads `Role` in one place and `role` in the other.
  function profileRows(sheet, xl, headerRow) {
    const hr = headerRow === undefined ? 1 : headerRow;
    return kit().profileColumns(sheet, xl, { headerRow: hr || null }).map(c => ({
      Column: c.letter,
      Header: c.header,
      Role: c.role,
      Kind: c.kind,
      Filled: c.filled,
      Blank: c.blank,
      Computed: c.computed,
      Distinct: c.distinct,
      Min: c.min ?? '',
      Max: c.max ?? '',
      'Most common': c.top.slice(0, 4).map(t => `${t.value} (${t.count})`).join(', '),
    }));
  }

  // ---- the survey: what is on offer, and how much of it --------------------
  //
  // The picker's whole input. Every sheet against every sheet-scoped kind,
  // plus the four workbook-scoped kinds once. A zero is REPORTED rather than
  // omitted, for the reason the Structure mode keeps an empty tab in its strip:
  // a cell that disappears when empty cannot say "this workbook has no pivots",
  // it just looks like a workbook with fewer kinds.
  function survey(result) {
    const xl = result.xl;
    const sheets = sheetsOf(xl).map(({ key, s, name }) => ({
      key, name, visibility: s.visibility ?? null,
      counts: Object.fromEntries(KINDS.filter(k => k.scope === 'sheet')
        .map(k => [k.id, k.count(s, xl, name)])),
    }));
    return {
      sheets,
      workbook: Object.fromEntries(KINDS.filter(k => k.scope === 'workbook')
        .map(k => [k.id, k.count(result)])),
      kinds: KINDS.map(({ id, label, scope, view, gloss }) => ({ id, label, scope, view, gloss })),
    };
  }

  // ---- the extract --------------------------------------------------------

  // A filename stem from a sheet name. A sheet may be called "Q1 / Q2" or
  // "2024 Budget", and both have to survive into a name a link can address.
  const stem = (s) => String(s || '').replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '') || 'sheet';

  // Names are the envelope's addresses (#item=), so a collision is a link that
  // opens the wrong item. Deduped by suffix rather than by throwing: two sheets
  // may legitimately reduce to one stem.
  const uniquely = (taken, name) => {
    if (!taken.has(name)) { taken.add(name); return name; }
    const dot = name.lastIndexOf('.');
    const base = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : '';
    for (let n = 2; ; n++) {
      const tryName = `${base}-${n}${ext}`;
      if (!taken.has(tryName)) { taken.add(tryName); return tryName; }
    }
  };

  // The one sentence an item's note carries, derived from the item's own
  // record rather than written beside it: the cut first, because it is the
  // thing a reader must not discover later, then whatever the kind had to say.
  const noteFor = (rec, extra) => [
    rec.truncated ? `${rec.rows} of ${rec.total} rows` : '',
    extra || '',
  ].filter(Boolean).join('; ');

  // pick: { sheets: [name…], kinds: [id…], headerRow }
  // opts: { source, maxRows, title, note, now }
  //
  // A pick naming no sheet takes every sheet; naming no kind takes nothing,
  // since an empty selection is a real thing a picker can be in and guessing
  // "all" there would hand over a whole workbook nobody asked for.
  function extract(result, pick, opts) {
    const cfg = opts || {};
    const want = pick || {};
    const xl = result.xl;
    const maxRows = cfg.maxRows === undefined ? 2000 : cfg.maxRows;
    const headerRow = want.headerRow === undefined ? 1 : want.headerRow;

    const all = sheetsOf(xl);
    const names = all.map(s => s.name);
    const pickedSheets = want.sheets == null ? names : names.filter(n => want.sheets.includes(n));
    const wantKinds = want.kinds || [];
    const pickedKinds = KINDS.filter(k => wantKinds.includes(k.id)).map(k => k.id);

    const items = [];
    const taken = new Set();

    const push = ({ kindId, sheetName, part }) => {
      const k = BY_ID[kindId];
      const label = part.label ? `.${stem(part.label)}` : '';
      if (part.text != null) {
        // A label may already carry the extension (`Section1.m` is the part's
        // own filename), and appending it again minted `workbook.Section1.m.m`.
        const ext = part.ext || 'txt';
        const named = `${stem(sheetName || 'workbook')}${label}`;
        const name = uniquely(taken, named.endsWith(`.${ext}`) ? named : `${named}.${ext}`);
        items.push({
          name, view: k.view, note: noteFor({ truncated: false }, part.note),
          content: part.text, kind: kindId, sheet: sheetName || null,
          rows: null, total: null, truncated: false,
        });
        return;
      }
      const rows = part.rows || [];
      const total = part.total == null ? rows.length : part.total;
      const cut = maxRows != null && rows.length > maxRows;
      const kept = cut ? rows.slice(0, maxRows) : rows;
      const rec = {
        rows: kept.length, total, truncated: !!(part.truncated || cut),
      };
      const name = uniquely(taken, `${stem(sheetName || 'workbook')}.${kindId}${label}.json`);
      items.push({
        name, view: k.view, note: noteFor(rec, part.note),
        content: JSON.stringify(kept, null, 1),
        kind: kindId, sheet: sheetName || null, ...rec,
      });
    };

    for (const name of pickedSheets) {
      const entry = all.find(s => s.name === name);
      if (!entry) continue;
      for (const kindId of pickedKinds) {
        const k = BY_ID[kindId];
        if (k.scope !== 'sheet') continue;
        // An empty kind produces NO ITEM rather than an empty one. The survey
        // already said the cell was zero, and a file of `[]` in the envelope
        // reads as a finding rather than as an absence.
        if (!k.count(entry.s, xl, name)) continue;
        for (const part of k.parts({ s: entry.s, xl, name, result, headerRow, maxRows })) push({ kindId, sheetName: name, part });
      }
    }
    for (const kindId of pickedKinds) {
      const k = BY_ID[kindId];
      if (k.scope !== 'workbook' || !k.count(result)) continue;
      for (const part of k.parts({ result, xl, headerRow, maxRows })) push({ kindId, sheetName: null, part });
    }

    const leftSheets = names.filter(n => !pickedSheets.includes(n));
    const leftKinds = KINDS.map(k => k.id).filter(id => !pickedKinds.includes(id));

    return {
      kind: KIND,
      title: cfg.title || extractTitle(cfg.source, pickedKinds),
      note: cfg.note || '',
      source: cfg.source || null,
      taken: cfg.now || new Date().toISOString(),
      // WHAT WAS PICKED AND WHAT WAS LEFT, both stated. The second is the half
      // an envelope normally cannot express, and it is the difference between
      // "this is the workbook" and "this is four kinds out of twelve".
      picked: { sheets: pickedSheets, kinds: pickedKinds },
      left: { sheets: leftSheets, kinds: leftKinds },
      items,
    };
  }

  const extractTitle = (source, kinds) => {
    const what = source?.name || source?.path?.split('/').pop() || 'workbook';
    return kinds.length ? `${what}: ${kinds.join(', ')}` : what;
  };

  // A sheet-centered catalogue. A pivot table belongs to the sheet where it
  // is placed; a cache belongs beside its source sheet when that source is in
  // this workbook. Neither relationship implies that checking a sheet checks
  // the object. Cache rows can disclose data from another sheet, so objects
  // always require their own explicit selection.
  function catalog(result) {
    const { xl } = result;
    const base = survey(result);
    const names = new Set(base.sheets.map(s => s.name));
    const objects = [];
    const pivotRows = kit().views.pivots(result);
    Object.entries(xl.pivotTables || {}).forEach(([part, pt], index) => {
      const sheet = xl.sheets[pt.sheet]?.name || null;
      objects.push({ id: `pivot:${part}`, kind: 'pivots', label: pt.name || part.split('/').pop(),
        sheet: names.has(sheet) ? sheet : null, count: 1, index,
        detail: pivotRows[index]?.Source || '' });
    });
    caches(xl).forEach((part, index) => {
      const cache = xl.pivotCaches[part];
      const source = cache?.source;
      const sheet = source?.sheet || null;
      const got = kit().pivotRecords(xl, part);
      if (!got?.total) return;
      objects.push({ id: `records:${part}`, kind: 'records',
        label: source ? `${source.sheet || source.name}!${source.ref}` : part.split('/').pop(),
        sheet: names.has(sheet) ? sheet : null, count: got?.total || 0,
        index, detail: 'Cached rows' });
    });
    (xl.connections || []).forEach((c, index) => objects.push({
      id: `source:${index}`, kind: 'sources', label: c.name || `Connection ${c.id || index + 1}`,
      sheet: null, count: 1, index, detail: c.kind || '',
    }));
    (xl.powerQuery?.sections || []).forEach((q, index) => objects.push({
      id: `query:${index}`, kind: 'queries', label: q.path.split('/').pop(),
      sheet: null, count: 1, index, detail: 'M source',
    }));
    return { ...base, objects };
  }

  // v2 keeps the data-view item shape but records independent per-sheet kinds
  // and individual workbook objects. The v1 cross-product API above remains
  // available to existing callers; the Structure picker uses this contract.
  function extractSelected(result, pick, opts) {
    const want = pick || {};
    const cfg = opts || {};
    const cat = cfg.catalog || catalog(result);
    const bySheet = new Map((want.sheets || []).map(s => [s.name, s.kinds || []]));
    const wantedObjects = new Set(want.objects || []);
    const pickedSheets = [];
    const items = [];
    const usedNames = new Set();
    const now = cfg.now || new Date().toISOString();
    const add = (item, object) => {
      const copy = { ...item, name: uniquely(usedNames, item.name) };
      if (object) {
        copy.object = object.id;
        copy.sheet = object.sheet;
      }
      items.push(copy);
    };

    for (const sh of cat.sheets) {
      if (!bySheet.has(sh.name)) continue;
      const kinds = KINDS.filter(k => k.scope === 'sheet' && sh.counts[k.id] > 0 &&
        bySheet.get(sh.name).includes(k.id)).map(k => k.id);
      pickedSheets.push({ name: sh.name, kinds });
      for (const kind of kinds) {
        const one = extract(result, { sheets: [sh.name], kinds: [kind], headerRow: want.headerRow }, cfg);
        one.items.forEach(item => add(item));
      }
    }

    const pickedObjects = cat.objects.filter(o => wantedObjects.has(o.id));
    for (const kind of ['pivots', 'records', 'sources', 'queries']) {
      const group = pickedObjects.filter(o => o.kind === kind);
      if (!group.length) continue;
      const all = extract(result, { sheets: [], kinds: [kind] }, cfg).items;
      for (const object of group) {
        if (kind === 'pivots' || kind === 'sources') {
          const aggregate = all[0];
          const row = aggregate && JSON.parse(aggregate.content)[object.index];
          if (!row) continue;
          add({ ...aggregate, name: `workbook.${kind}.${stem(object.label)}.json`,
            content: JSON.stringify([row], null, 1), rows: 1, total: 1 }, object);
        } else if (all[object.index]) {
          add(all[object.index], object);
        }
      }
    }

    const selectedKinds = [...new Set([...pickedSheets.flatMap(s => s.kinds),
      ...pickedObjects.map(o => o.kind)])];
    return {
      kind: SELECTED_KIND,
      title: cfg.title || extractTitle(cfg.source, selectedKinds),
      note: cfg.note || '', source: cfg.source || null, taken: now,
      picked: { sheets: pickedSheets, objects: pickedObjects.map(({ id, kind, label, sheet }) =>
        ({ id, kind, label, sheet })) },
      left: {
        sheets: cat.sheets.filter(s => !bySheet.has(s.name)).map(s => s.name),
        sheetKinds: cat.sheets.filter(s => bySheet.has(s.name)).map(s => ({
          name: s.name,
          kinds: KINDS.filter(k => k.scope === 'sheet' && s.counts[k.id] > 0 &&
            !bySheet.get(s.name).includes(k.id)).map(k => k.id),
        })).filter(s => s.kinds.length),
        objects: cat.objects.filter(o => !wantedObjects.has(o.id)).map(o => o.id),
      },
      items,
    };
  }

  // ---- receptions: a receiving repo's standing pick -----------------------
  //
  // A repo's .web-tools.json may declare `receptions`: for a workbook whose
  // sheets match, which sheets to take, which to leave, which readings, and
  // where the extract lands. The receiver declares it and the picker runs it,
  // so nothing about any one workbook has to live in this kit or the page.
  //
  //   { id, label, match: { sheets: [name…] }, omit: [name… | 'hidden'],
  //     readings: [kind…], cap, dest, file }
  //
  // A reception with no `match.sheets` applies to every workbook; one that
  // names sheets applies only where all of them are present, by sheet set
  // rather than by file name because a workbook is renamed more often than
  // its tabs are. Declarations are tried in order, so a specific one listed
  // before a general one wins. Every sheet not omitted is taken, with the
  // readings it has any of. `omit` takes names and the token `hidden`, which
  // leaves behind every sheet the workbook hides: a gesture already made in
  // Excel, and one a rename does not undo. `cap` defaults to null (no row
  // cut), since a landed extract is a file rather than a link. `dest` and
  // `file` may carry `{date}`, `{stem}` and `{slug}`.
  const HIDDEN = 'hidden';
  const isHidden = (s) => !!s.visibility && s.visibility !== 'visible';
  function receptions(cat, declared) {
    const names = new Set((cat?.sheets || []).map(s => s.name));
    const out = [];
    for (const r of declared || []) {
      const want = r?.match?.sheets || [];
      if (want.length && !want.every(n => names.has(n))) continue;
      const omitNames = new Set((r.omit || []).filter(n => n !== HIDDEN));
      const omitHidden = (r.omit || []).includes(HIDDEN);
      const left = (s) => omitNames.has(s.name) || (omitHidden && isHidden(s));
      const readings = (r.readings || ['cells']).filter(id => BY_ID[id]?.scope === 'sheet');
      const sheets = cat.sheets.filter(s => !left(s))
        .map(s => ({ name: s.name, kinds: readings.filter(id => (s.counts?.[id] || 0) > 0) }))
        .filter(s => s.kinds.length);
      out.push({
        reception: r,
        pick: { sheets, objects: [] },
        omitted: cat.sheets.filter(left).map(s => s.name),
        cap: r.cap === undefined ? null : r.cap,
      });
    }
    return out;
  }

  // Where a reception's extract lands: `{date}` is the day (UTC), `{stem}` the
  // workbook's name without its extension reduced to filename characters, and
  // `{slug}` that stem lowercased, for a folder convention that wants it.
  function receptionTarget(r, source, now) {
    const day = (now || new Date().toISOString()).slice(0, 10);
    const stemName = stem(String(source?.name || 'workbook').replace(/\.[^.]+$/, ''));
    const fill = (t) => String(t || '').replace(/\{date\}/g, day).replace(/\{stem\}/g, stemName)
      .replace(/\{slug\}/g, stemName.toLowerCase());
    return { dest: fill(r?.dest), file: fill(r?.file) || `${stemName}.extract.json` };
  }

  window.XlsxExtract = { KIND, SELECTED_KIND, KINDS, survey, catalog, extract, extractSelected, profileRows,
                         receptions, receptionTarget };
})();
