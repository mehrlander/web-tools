// lib/kits/xlsx-people.js — WHERE A WORKBOOK NAMES PEOPLE, and whose names
// they are, found before any of it is shared. The question it answers is the
// one asked before an extract leaves the device: does what I picked carry
// anyone's name, and whose?
//
// A NAME IS A FIRST NAME BESIDE A SURNAME, read off three public lists rather
// than guessed from the shape of the text:
//
//   first     about 8,800 English first names (@stdlib's two datasets, Apache-2.0)
//   surnames  88,799 US Census surnames, most common first (@zxcvbn-ts/language-en, MIT)
//   words     about 39,000 common English words, with no proper nouns (SCOWL
//             sizes 10 to 35, US and shared spellings, via wordlist-english, MIT)
//
// Two words in a row (`First Last`, `First M. Last`, `Last, First`), both
// capitalized or both in capitals, are a name when the second is a Census
// surname and either
//   - the first is a listed first name, unless both are ordinary English words
//     and the surname is outside the 1,000 most common ("Job Class", "Fair
//     Start" are out; "Mark Smith", "Grace Young" are in), or
//   - the first is neither a listed name nor an English word, and the surname
//     is not an English word or is among the 1,000 most common ("Mateo
//     Garcia", "Jayceon Smith").
// A name is found anywhere in a cell, so "Prepared by Dana Whitfield" and
// "Contact: Rachel Kim (360) 555-0100" each give one. An email address is a
// name of its own.
//
// MEASURED, 2026-10-30, on the 87 DRS and OFM workbooks in mehrlander/home
// (209,845 text cells) and on 1,800 planted names. The rule this replaced,
// any two capitalized words beside a heading or label that read like a person
// field, flagged 722 distinct texts there, nearly all org units and fee
// titles ("IS Administration" beside "Central Reception Unit Contact Team").
// This rule flags 23, finds 88% of the planted names, whose first names were
// drawn evenly from the 2,000 most common US baby names of the 2020s, and every
// pairing of a common adult first name with one of the 120 most common
// surnames. compromise's people() found 71% of the planted names and flagged
// 182 texts. A tagger is the wrong tool in any case: pages/entities.html ran
// spaCy's small English model over this estate's prose and 7 to 9 percent of
// its PERSON tags were people, and a cell gives a model less to go on than a
// sentence.
//
// A MISS IS POSSIBLE AND SAID SO by the page that shows this: a surname
// outside the Census list, a first name that is an English word and not on
// the first-name list ("Promise Dugger", "Meadow Buck"), a lone surname or
// first name, and a nickname. A place, a product or a title can still read as
// a person ("Walla Walla", "Rock Pointe", "Bail Bond").
//
// OUTSIDE THE CELLS is where a name travels unnoticed, so those are read too:
// the file's creator and last-modified-by, its Manager property, the people
// behind threaded comments, and every comment author. The properties never
// travel in an extract; they travel only if the file itself is sent.
//
// Pure apart from loadLists(): takes an analysed result (xlsxKit.readZip or
// .analyze) and returns plain objects. Attaches to window.XlsxPeople.
//
//   loadLists()               Promise of the lists, fetched once per page
//   makeLists(first, surnames, words)
//                             the lists from plain arrays, surnames most
//                             common first: what loadLists() resolves to
//   scan(result, { lists })
//       -> { findings, lists, sheets }; a finding is
//          { id, kind, sheet, object, col, cell, header, label, evidence,
//            count, filled, names }, kind one of column | cell | author |
//          property; `lists` is false when the scan ran without them, which
//          leaves addresses, comment authors and the file's properties
//   namesIn(text, lists)      the names and addresses a text holds
//   carried(found, picked)    the findings an extract pick carries; picked is
//                             the Overview's { sheets: Map(name -> Set of
//                             kinds), objects: Set of ids }
//   rows(found)               findings as rows for a table
(() => {
  const AT = 'https://cdn.jsdelivr.net/npm/';
  const SOURCES = [
    ['@stdlib/datasets-female-first-names-en@0.2.3/data/names.json',
     '@stdlib/datasets-male-first-names-en@0.2.3/data/names.json'],
    ['@zxcvbn-ts/language-en@4.1.1/src/lastnames.json'],
    [10, 20, 35].flatMap(n => [`wordlist-english@1.2.1/english-words-${n}.json`,
                               `wordlist-english@1.2.1/american-words-${n}.json`]),
  ];

  // Read at call time: this kit can load before the workbook kit does.
  const kit = () => {
    if (!window.xlsxKit) throw new Error('kits/xlsx-people.js requires window.xlsxKit (load kits/xlsx.js first)');
    return window.xlsxKit;
  };

  const makeLists = (first, surnames, words) => ({
    first: new Set(first.map(s => s.toLowerCase())),
    surnames: new Map(surnames.map((s, i) => [s.toLowerCase(), i])),
    words: new Set(words.map(s => s.toLowerCase())),
  });

  let listsP = null;
  // A failed fetch is not cached, so the next scan tries again.
  const loadLists = () => listsP ??= Promise.all(SOURCES.map(group => Promise.all(group.map(p =>
    fetch(AT + p).then(r => {
      if (!r.ok) throw new Error(`name lists: HTTP ${r.status} for ${p}`);
      return r.json();
    })))))
    .then(([first, surnames, words]) => makeLists(first.flat(), surnames.flat(), words.flat()))
    .catch(e => { listsP = null; throw e; });

  // Capitalized (with Mc/Mac, O', hyphens) or all capitals.
  const TOKEN = /^(?:[A-Z][a-z]*(?:[A-Z][a-z]+)?(?:['’-][A-Z]?[a-z]+(?:[A-Z][a-z]+)?)*|[A-Z]{2,}(?:['’-][A-Z]+)*)$/;
  const EMAIL = /[\w.'+-]+@[\w-]+(?:\.[\w-]+)+/g;
  // Words never part of a name here, though a list holds them: the nouns a
  // budget workbook puts beside a word that is also a name, months and days,
  // and the parts of an address or an institution's name.
  const STOP = new Set(('total subtotal totals amount payment payments period budget budgets fund funds funding '
    + 'services service program programs report summary balance date year month quarter account accounts '
    + 'plan cost costs fee fees rate rates tax office division unit section center centre request requests item '
    + 'items sheet notes note call up down number code codes supplies estimate actual actuals revenue expense '
    + 'expenses adjustment transfer reserve agency department board committee team group staff analyst manager '
    + 'director the and of for to '
    + 'jan feb mar apr jun jul aug sep sept oct nov dec january february october november december '
    + 'monday tuesday wednesday thursday friday saturday sunday '
    + 'street st avenue ave road rd boulevard blvd drive dr lane ln court ct place pl highway hwy way '
    + 'ne nw se sw county city state college university school').split(' '));
  // A place in a Washington workbook long before it is anyone's first name.
  const NOT_FIRST = new Set(['washington']);
  // The surnames common enough to be names even beside a first name that is
  // also a word: Mark Smith, Grace Young, Will Hall.
  const COMMON = 1000;

  // The text cut into words, keeping a comma and an initial's period; any
  // other mark breaks the run, and so does a word cut short by a period,
  // which is an abbreviation ("Res. Grad", "Auth Del:").
  const tokens = (text) => {
    const out = [];
    for (const m of text.matchAll(/([A-Za-z][A-Za-z'’-]*)(\.)?|(,)|[^\sA-Za-z,]/g)) {
      if (m[1]) out.push(m[2] ? (m[1].length === 1 ? m[1] + '.' : '|') : m[1]);
      else out.push(m[3] ? ',' : '|');
    }
    return out;
  };

  function namesIn(value, lists) {
    const text = String(value ?? '');
    const out = [...new Set(text.match(EMAIL) || [])];
    if (!lists || !/[A-Za-z]{2}/.test(text)) return out;
    const parts = (w) => w.toLowerCase().replace(/['’]/g, '').split('-');
    const word = (w) => parts(w).every(p => lists.words.has(p));
    const usable = (w) => w && w.length >= 2 && TOKEN.test(w) && !/['’]s$/i.test(w) && !STOP.has(w.toLowerCase());
    const pair = (f, l) => {
      if (!usable(f) || !usable(l) || NOT_FIRST.has(f.toLowerCase())) return false;
      if ((f === f.toUpperCase()) !== (l === l.toUpperCase())) return false;
      // A double surname is two surnames: Perez-Carrillo, not African-American.
      const ranks = parts(l).map(p => lists.surnames.get(p));
      if (ranks.includes(undefined)) return false;
      const surname = !word(l) || Math.min(...ranks) < COMMON;
      if (lists.first.has(parts(f)[0])) return surname || !word(f);
      return surname && !word(f) && !f.includes('-') && f.length >= 3 && /[aeiouy]/i.test(f);
    };
    const initial = (w) => /^[A-Z]\.?$/.test(w || '');
    const t = tokens(text);
    for (let i = 0; i < t.length; i++) {
      const [a, b, c] = [t[i], t[i + 1], t[i + 2]];
      if (pair(a, b)) { out.push(`${a} ${b}`); i++; }
      else if (initial(b) && pair(a, c)) { out.push(`${a} ${b} ${c}`); i += 2; }
      else if (b === ',' && pair(c, a)) { out.push(`${a}, ${c}`); i += 2; }
    }
    return out;
  }

  // A COLUMN IS SAMPLED BEFORE IT IS READ IN FULL. Every distinct text is
  // read once per scan, which covers the usual workbook, whose cells repeat a
  // few thousand texts. A column of distinct texts past SAMPLE values is read
  // cell by cell only when its sample holds a name, half from the top and
  // half spread evenly down, so a 100,000-row column of codes costs a sample.
  // What that can miss is a long column whose few names all fall between the
  // sampled rows.
  const SAMPLE = 2000;
  const spread = (list) => {
    if (list.length <= SAMPLE) return list;
    const top = SAMPLE / 2, rest = SAMPLE - top;
    const out = list.slice(0, top);
    const step = (list.length - top) / rest;
    for (let k = 0; k < rest; k++) out.push(list[top + Math.floor(k * step)]);
    return out;
  };
  // A column with at least GROUP cells naming someone is reported once, as
  // the column; fewer are reported cell by cell, where they sit.
  const GROUP = 3;
  // The distinct names a finding keeps, for the roster and the table.
  const KEEP = 50;

  function columnHits(values, look) {
    const filled = values.filter(x => String(x.v ?? '').trim() !== '');
    if (filled.length > SAMPLE && !spread(filled).some(x => look(x.v).length)) return { filled: filled.length, hits: [] };
    return { filled: filled.length, hits: filled.map(x => ({ ...x, names: look(x.v) })).filter(h => h.names.length) };
  }

  const evidenceOf = (names) => [
    names.some(n => !n.includes('@')) && 'names', names.some(n => n.includes('@')) && 'email',
  ].filter(Boolean);
  const distinct = (hits) => [...new Set(hits.flatMap(h => h.names))];

  // A sheet's columns, each as its values below its heading. The heading is
  // the column's first filled cell when that cell is text and names no one,
  // which finds a table's header wherever the table starts.
  function sheetColumns(s, look) {
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
        || !isFinite(Number(top.v))) && !look(top.v).length && cells.length > 1;
      return { i, letter: K.colLetter(i), header: isHeader ? top.v : '',
               cells: isHeader ? cells.slice(1) : cells };
    });
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
    const lists = opts?.lists || null;
    const seen = new Map();
    const look = (v) => {
      const s = String(v ?? '');
      if (!seen.has(s)) seen.set(s, namesIn(s, lists));
      return seen.get(s);
    };
    const findings = [];
    const sheets = Object.entries(xl.sheets || {})
      .map(([key, s]) => ({ key, s, name: s.name || key }))
      .sort((a, b) => (a.s.index ?? 1e9) - (b.s.index ?? 1e9));

    for (const { s, name } of sheets) {
      for (const c of sheetColumns(s, look)) {
        const { filled, hits } = columnHits(c.cells, look);
        if (hits.length >= GROUP) {
          const names = distinct(hits);
          findings.push({ id: `column:${name}:${c.letter}`, kind: 'column', sheet: name, object: null,
                          col: c.letter, cell: null, header: c.header, label: '', evidence: evidenceOf(names),
                          count: hits.length, filled, names: names.slice(0, KEEP) });
        } else for (const h of hits) {
          const ref = c.letter + h.row;
          findings.push({ id: `cell:${name}:${ref}`, kind: 'cell', sheet: name, object: null, col: null,
                          cell: ref, header: c.header, label: '', evidence: evidenceOf(h.names),
                          count: 1, filled: 1, names: h.names });
        }
      }
    }

    // Cached pivot rows, which can hold data from a sheet that is not picked.
    for (const part of Object.keys(xl.pivotCaches || {})) {
      const got = K.pivotRecords(xl, part);
      if (!got?.rows?.length) continue;
      const src = xl.pivotCaches[part]?.source;
      for (const field of got.fields || []) {
        const { filled, hits } = columnHits(got.rows.map(r => ({ v: r[field] ?? '' })), look);
        if (!hits.length) continue;
        const names = distinct(hits);
        findings.push({ id: `records:${part}:${field}`, kind: 'column', sheet: src?.sheet || null,
                        object: `records:${part}`, col: field, cell: null, header: field, label: '',
                        evidence: evidenceOf(names), count: hits.length, filled, names: names.slice(0, KEEP) });
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
                      filled: who.size, count: who.size, names: [...who] });
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
                      filled: who.length, count: who.length, names: who });
    }
    return { findings, lists: !!lists, sheets: sheets.length };
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
      Names: f.names.join('; '),
    }));
  }

  window.XlsxPeople = { loadLists, makeLists, scan, namesIn, carried, rows, where };
})();
