// lib/kits/xlsx-people.js — WHERE A WORKBOOK MAY NAME PEOPLE, found before
// any of it is shared. The question it answers is the one asked before an
// extract leaves the device: does what I picked carry anyone's name?
//
// A RECOGNIZER IS THE WRONG TOOL, and that is measured rather than assumed:
// pages/entities.html ran spaCy's small English model over this estate's
// prose and 7 to 9 percent of its PERSON tags were people. A cell gives a
// model even less context than a sentence. What a workbook offers instead is
// STRUCTURE: names cluster in columns, a column has a heading, and a form
// puts a name beside its label ("Prepared by"). So each column is judged as
// a whole, from four kinds of evidence:
//
//   header      the column's heading reads like a person field (Employee,
//               Supervisor, Prepared by, ...)
//   dictionary  values shaped like `First Last` or `Last, First` whose first
//               name is on a list of about 8,800 common English first names
//   shape       the same shapes with the first name off the list, counted
//               only where a heading or a label also says "person"
//   email       an address, which names someone even when nothing else does
//
// plus `label`, for a form: a person-field label with a name-shaped value to
// its right. The first-name list is @stdlib's two datasets (Apache-2.0),
// fetched from jsDelivr on the first scan and never bundled; without it the
// scan still runs on headers, labels and email, and says so in `dictionary`.
//
// A MISS IS POSSIBLE AND SAID SO by the page that shows this, not hidden: a
// name in prose ("per Jane's note"), a nickname, or a column of surnames alone
// will not be found. False hits are held down by judging columns rather than
// cells and by a short stop list of the nouns that follow a first name in a
// budget workbook ("Grace Period", "June Total", "Member Services").
//
// OUTSIDE THE CELLS is where a name travels unnoticed, so those are read too:
// the file's creator and last-modified-by, its Manager property, the people
// behind threaded comments, and every comment author. The properties never
// travel in an extract; they travel only if the file itself is sent.
//
// Pure apart from loadFirstNames(): takes an analysed result (xlsxKit.readZip
// or .analyze) and returns plain objects. Attaches to window.XlsxPeople.
//
//   loadFirstNames()          Promise<Set>, fetched once per page
//   scan(result, { firstNames })
//       -> { findings, dictionary, sheets }; a finding is
//          { id, kind, sheet, object, col, cell, header, label, evidence,
//            count, filled, samples }, kind one of column | cell | author |
//          property
//   carried(found, picked)    the findings an extract pick carries; picked is
//                             the Extract tab's { sheets: Map(name -> Set of
//                             kinds), objects: Set of ids }
//   rows(found)               findings as rows for a table
//   nameKind(value, names)    'email' | 'dictionary' | 'shape' | null
(() => {
  const NAMES_AT = [
    'https://cdn.jsdelivr.net/npm/@stdlib/datasets-female-first-names-en@0.2.3/data/names.json',
    'https://cdn.jsdelivr.net/npm/@stdlib/datasets-male-first-names-en@0.2.3/data/names.json',
  ];

  // Read at call time: this kit can load before the workbook kit does.
  const kit = () => {
    if (!window.xlsxKit) throw new Error('kits/xlsx-people.js requires window.xlsxKit (load kits/xlsx.js first)');
    return window.xlsxKit;
  };

  let namesP = null;
  // A failed fetch is not cached, so the next scan tries again.
  const loadFirstNames = () => namesP ??= Promise.all(NAMES_AT.map(u => fetch(u).then(r => {
    if (!r.ok) throw new Error('first-name list: HTTP ' + r.status);
    return r.json();
  }))).then(lists => new Set(lists.flat())).catch(e => { namesP = null; throw e; });

  // A person field, as a heading or a form label. Whole words, so "Rename"
  // and "Ownership" do not read as Name and Owner.
  const PERSON_FIELD = /\b(names?|employees?|staff|person|people|contacts?|managers?|supervisors?|directors?|approvers?|analysts?|owners?|authors?|assignee|requeste[rd]|requestor|signature|surname|first|last|(prepared|reviewed|approved|submitted|requested|entered|updated|assigned|signed)\s+(by|to))\b/i;
  // "Prepared by Dana Whitfield", label and name in one cell.
  const INLINE_LABEL = /^(?:prepared|reviewed|approved|submitted|requested|entered|signed)\s+by:?\s+(.+)$/i;
  const EMAIL = /^[\w.'+-]+@[\w-]+(\.[\w-]+)+$/;
  // Capitalized (with Mc/Mac, O', hyphens) or all capitals.
  const TOKEN = /^(?:[A-Z][a-z]*(?:[A-Z][a-z]+)?(?:['’-][A-Z]?[a-z]+(?:[A-Z][a-z]+)?)*|[A-Z]{2,}(?:['’-][A-Z]+)*)$/;
  const MIDDLE = /^(?:[A-Z]\.?|[A-Z][a-z]+)$/;
  // The nouns a budget workbook puts after a word that is also a first name,
  // and the organizational words that make a two-word title look like a name.
  const STOP = new Set(('total subtotal totals amount payment payments period budget budgets fund funds funding '
    + 'services service program programs report summary balance date year month quarter account accounts '
    + 'plan cost costs fee fees rate rates tax office division unit section center centre request requests item '
    + 'items sheet notes note call up down number code codes supplies estimate actual actuals revenue expense '
    + 'expenses adjustment transfer reserve agency department board committee team group staff analyst manager '
    + 'director the and of for to').split(' '));

  const cap = (t) => t[0].toUpperCase() + t.slice(1).toLowerCase();

  function nameKind(value, names) {
    const s = String(value ?? '').trim();
    if (!s || s.length > 60) return null;
    if (EMAIL.test(s)) return 'email';
    let first = null, last = null;
    const comma = s.match(/^([^\s,]+),\s*([^\s,]+)(?:\s+[A-Za-z]\.?)?$/);
    if (comma) { last = comma[1]; first = comma[2]; }
    else {
      const parts = s.split(/\s+/);
      if (parts.length < 2 || parts.length > 3) return null;
      if (parts.length === 3 && !MIDDLE.test(parts[1])) return null;
      first = parts[0]; last = parts[parts.length - 1];
    }
    if (!TOKEN.test(first) || !TOKEN.test(last)) return null;
    if (STOP.has(first.toLowerCase()) || STOP.has(last.toLowerCase())) return null;
    return names && names.has(cap(first)) ? 'dictionary' : 'shape';
  }

  // One column's verdict from its values, in order, and its heading if any.
  // Returns null for a column with nothing worth reporting.
  function judgeColumn(values, header, names) {
    const filled = values.filter(v => v !== '' && v != null);
    if (!filled.length) return null;
    const kinds = filled.map(v => nameKind(v, names));
    const n = (k) => kinds.filter(x => x === k).length;
    const dict = n('dictionary'), shape = n('shape'), email = n('email');
    const headed = !!header && PERSON_FIELD.test(header);
    const evidence = [];
    // One address in a form's value column is that cell's finding, not the
    // column's, so the column needs a real share of them.
    if (email >= 2 || (email && email / filled.length >= 0.3)) evidence.push('email');
    if (dict >= 2 && dict / filled.length >= 0.3) evidence.push('dictionary');
    if (headed && (dict >= 1 || (shape >= 1 && (dict + shape) / filled.length >= 0.5))) evidence.push('header');
    if (!evidence.length) return null;
    if (headed && !evidence.includes('header')) evidence.push('header');
    const hit = filled.filter((v, i) => kinds[i]);
    return {
      evidence, filled: filled.length, count: hit.length,
      samples: [...new Set(hit.map(String))].slice(0, 3),
    };
  }

  // A sheet's columns, each as its values below its heading. The heading is
  // the column's first filled cell when that cell is text and not itself a
  // name, which finds a table's header wherever the table starts.
  function sheetColumns(s) {
    const K = kit();
    const cols = new Map();
    for (const r of s.rows || []) {
      for (const [idx, raw] of Object.entries(r.cells || {})) {
        if (raw === '' || raw == null) continue;
        const i = Number(idx);
        if (!cols.has(i)) cols.set(i, []);
        cols.get(i).push({ row: r.row, v: String(raw), type: r.types?.[idx] });
      }
    }
    return [...cols.entries()].sort((a, b) => a[0] - b[0]).map(([i, cells]) => {
      const top = cells[0];
      const isHeader = top && (top.type === 's' || top.type === 'inlineStr' || top.type === 'str'
        || !isFinite(Number(top.v))) && !nameKind(top.v, null) && cells.length > 1;
      return { i, letter: K.colLetter(i), header: isHeader ? top.v : '',
               cells: isHeader ? cells.slice(1) : cells };
    });
  }

  // Form labels: a person-field label with a name to its right in the same
  // row, within four columns, or a label and a name in one cell. And any
  // address in a column not already reported, labelled or not.
  function labelCells(s, skipCols, names) {
    const K = kit();
    const out = [];
    for (const r of s.rows || []) {
      const entries = Object.entries(r.cells || {}).map(([k, v]) => [Number(k), String(v ?? '')])
        .filter(([, v]) => v.trim() !== '').sort((a, b) => a[0] - b[0]);
      const taken = new Set();
      entries.forEach(([i, v], at) => {
        const inline = v.match(INLINE_LABEL);
        if (inline && !skipCols.has(i) && nameKind(inline[1], names)) {
          out.push({ cell: K.colLetter(i) + r.row, label: v.slice(0, v.length - inline[1].length).trim(),
                     value: inline[1], kind: nameKind(inline[1], names) });
          return;
        }
        if (v.length > 40 || !PERSON_FIELD.test(v) || nameKind(v, names)) return;
        const next = entries[at + 1];
        if (!next || next[0] - i > 4 || skipCols.has(next[0])) return;
        const kind = nameKind(next[1], names);
        if (kind) {
          taken.add(next[0]);
          out.push({ cell: K.colLetter(next[0]) + r.row, label: v.replace(/:\s*$/, ''), value: next[1], kind });
        }
      });
      for (const [i, v] of entries) {
        if (skipCols.has(i) || taken.has(i) || !EMAIL.test(v.trim())) continue;
        out.push({ cell: K.colLetter(i) + r.row, label: '', value: v.trim(), kind: 'email' });
      }
    }
    return out;
  }

  // The el map (every element path in every part, with its distinct text and
  // attribute values) is where the file's own properties are, so they are
  // read from there rather than taught to the workbook kit as fields.
  const textAt = (el, suffix) => Object.entries(el || {})
    .filter(([p]) => p.endsWith(suffix)).flatMap(([, d]) => [...(d.text || [])]).filter(Boolean);
  const attrAt = (el, suffix, attr) => Object.entries(el || {})
    .filter(([p]) => p.endsWith(suffix)).flatMap(([, d]) => [...(d.attr?.[attr] || [])]).filter(Boolean);

  function scan(result, opts) {
    const K = kit();
    const xl = result.xl;
    const names = opts?.firstNames || null;
    const findings = [];
    const sheets = Object.entries(xl.sheets || {})
      .map(([key, s]) => ({ key, s, name: s.name || key }))
      .sort((a, b) => (a.s.index ?? 1e9) - (b.s.index ?? 1e9));

    for (const { s, name } of sheets) {
      const flagged = new Set();
      for (const c of sheetColumns(s)) {
        const v = judgeColumn(c.cells.map(x => x.v), c.header, names);
        if (!v) continue;
        flagged.add(c.i);
        findings.push({ id: `column:${name}:${c.letter}`, kind: 'column', sheet: name, object: null,
                        col: c.letter, cell: null, header: c.header, label: '', ...v });
      }
      for (const l of labelCells(s, flagged, names)) {
        findings.push({ id: `cell:${name}:${l.cell}`, kind: 'cell', sheet: name, object: null, col: null,
                        cell: l.cell, header: '', label: l.label, evidence: l.label ? ['label', l.kind] : [l.kind],
                        filled: 1, count: 1, samples: [l.value] });
      }
    }

    // Cached pivot rows, which can hold data from a sheet that is not picked.
    for (const part of Object.keys(xl.pivotCaches || {})) {
      const got = K.pivotRecords(xl, part);
      if (!got?.rows?.length) continue;
      const src = xl.pivotCaches[part]?.source;
      for (const field of got.fields || []) {
        const v = judgeColumn(got.rows.map(r => r[field] ?? ''), field, names);
        if (!v) continue;
        findings.push({ id: `records:${part}:${field}`, kind: 'column', sheet: src?.sheet || null,
                        object: `records:${part}`, col: field, cell: null, header: field, label: '', ...v });
      }
    }

    // Comment authors, per sheet where the workbook kit placed the comment.
    const bySheet = new Map();
    for (const n of K.workbookNotes(xl)) {
      if (n.kind !== 'comment' || !n.author) continue;
      if (!bySheet.has(n.sheet)) bySheet.set(n.sheet, new Set());
      bySheet.get(n.sheet).add(n.author);
    }
    const placed = new Set([...bySheet.values()].flatMap(s => [...s]));
    for (const [sheet, who] of bySheet) {
      findings.push({ id: `author:${sheet}`, kind: 'author', sheet, object: null, col: null, cell: null,
                      header: '', label: 'comment authors', evidence: ['author'],
                      filled: who.size, count: who.size, samples: [...who] });
    }
    // Authors in a comments part the kit did not attach to a sheet, and the
    // people behind threaded comments: in the file, in no extract.
    const loose = textAt(result.el, '.authors.author').filter(a => !placed.has(a) && !/^tc=\{/.test(a));
    const people = attrAt(result.el, 'personList.person', '@displayName');
    const props = [
      ['creator', textAt(result.el, 'coreProperties.dc:creator')],
      ['last modified by', textAt(result.el, 'coreProperties.cp:lastModifiedBy')],
      ['manager', textAt(result.el, 'Properties.Manager')],
      ['threaded comment people', people],
      ['comment authors, unplaced', loose],
    ];
    for (const [label, vals] of props) {
      const who = [...new Set(vals.map(v => v.trim()).filter(Boolean))];
      if (!who.length) continue;
      findings.push({ id: `property:${label}`, kind: 'property', sheet: null, object: null, col: null,
                      cell: null, header: '', label, evidence: ['property'],
                      filled: who.length, count: who.length, samples: who.slice(0, 3) });
    }
    return { findings, dictionary: !!names, sheets: sheets.length };
  }

  // The readings that carry a sheet's cell text into an extract. `styles`,
  // `conditional` and `validations` describe cells without their values.
  const CARRY = new Set(['values', 'raw', 'cells', 'formulas', 'merges', 'columns']);

  function carried(found, picked) {
    const kindsOf = (sheet) => {
      const k = picked?.sheets?.get ? picked.sheets.get(sheet)
        : (picked?.sheets || []).find(s => s.name === sheet)?.kinds;
      return new Set(k || []);
    };
    const hasObject = (id) => picked?.objects?.has ? picked.objects.has(id) : (picked?.objects || []).includes(id);
    return (found?.findings || []).filter(f => {
      if (f.kind === 'property') return false;
      if (f.object) return hasObject(f.object);
      const kinds = kindsOf(f.sheet);
      if (f.kind === 'author') return kinds.has('comments');
      return [...kinds].some(k => CARRY.has(k));
    });
  }

  // Where, in a reader's words: a sheet column, a sheet cell, a cached field.
  const where = (f) => f.kind === 'property' ? 'file' : f.object
    ? `cache ${f.object.split('/').pop()}` + (f.sheet ? ` (${f.sheet})` : '')
    : f.kind === 'author' ? f.sheet
    : `${f.sheet}!${f.cell || f.col}`;

  function rows(found) {
    return (found?.findings || []).map(f => ({
      Where: where(f),
      Field: f.header || f.label || '',
      Evidence: f.evidence.join(', '),
      Count: f.kind === 'column' ? `${f.count} of ${f.filled}` : String(f.count),
      Examples: f.samples.join('; '),
    }));
  }

  window.XlsxPeople = { loadFirstNames, scan, carried, rows, nameKind, where };
})();
