// Which repository file a pasted piece of PowerShell belongs to, with no model:
// the paste is split into the same review units as a selective update
// (kits/powershell-units.js), each unit is scored against every unit of every
// indexed file by how many runs of four tokens it shares, and the scores are
// grouped by file. Scoring by unit and then grouping is the point: an ISE tab
// that has accumulated pieces of three files scores 41, 27 and 19 percent as
// one buffer, and each piece goes to its own file when scored alone
// (measured on home's wps corpus, 2026-10-13).
//
//   index = PowerShellMatch.index()                  an empty index
//   await PowerShellMatch.add(index, path, text, U?) one file in
//   await PowerShellMatch.rank(text, index, U?)      -> { units, files, tokens }
//
// `U` is window.PowerShellUnits by default. Without it, or when its parser
// does not load, a file splits at blank lines, which still attributes pieces,
// only with coarser names.
(() => {
  const N = 4;
  // Thresholds on containment: the share of a pasted unit's 4-grams found in
  // one indexed unit. Below WEAK the unit is new to the corpus.
  const STRONG = 0.5, WEAK = 0.3, MIN_TOKENS = 8;
  // Comments are dropped: a header comment repeated across files would
  // otherwise pull pieces toward each other.
  const tokens = text => (String(text).replace(/<#[\s\S]*?#>/g, ' ').replace(/(^|\s)#[^\n]*/g, ' ').toLowerCase()
    .match(/\$?[a-z_][\w:.-]*|\d+|[^\s\w]/g) || []);
  const grams = list => {
    const s = new Set();
    for (let i = 0; i + N <= list.length; i++) s.add(list.slice(i, i + N).join(' '));
    if (!s.size && list.length) s.add(list.join(' '));
    return s;
  };
  const containment = (a, b) => {
    if (!a.size) return 0;
    let n = 0; for (const g of a) if (b.has(g)) n++;
    return n / a.size;
  };
  const lines = (from, n) => n > 1 ? 'Lines ' + from + '–' + (from + n - 1) : 'Line ' + from;
  // A name as one short line: a damaged parse can carry a line break into it.
  const tidy = name => { const t = String(name).replace(/\s+/g, ' ').trim(); return t.length > 60 ? t.slice(0, 59) + '…' : t; };
  // Blank-line paragraphs, for when the parser is unavailable.
  const paragraphs = text => {
    const out = [], re = /\S[\s\S]*?(?=\n[ \t]*\r?\n|$)/g;
    let m;
    while ((m = re.exec(text))) {
      const line = text.slice(0, m.index).split('\n').length;
      out.push({ kind: 'Other', name: lines(line, m[0].split('\n').length), line, syntax: m[0] });
    }
    return out;
  };
  const split = async (text, U) => {
    try {
      if (U?.inventory) return (await U.inventory(text, { tolerant: true })).units.map(u => ({ kind: u.kind, line: u.line, syntax: u.syntax,
        name: u.kind === 'Other' ? lines(u.line, u.syntax.split('\n').length) : tidy(u.name) }));
    } catch { /* the parser did not load or could not read it: paragraphs */ }
    return paragraphs(text);
  };
  const index = () => ({ files: new Map() });
  const add = async (idx, path, text, U = window.PowerShellUnits) => {
    const units = (await split(text, U)).map(u => {
      const t = tokens(u.syntax);
      return { kind: u.kind, name: u.name, line: u.line, norm: t.join(' '), grams: grams(t) };
    }).filter(u => u.norm);
    idx.files.set(path, { path, units });
    return idx;
  };
  // Every pasted unit with its best match, and the files ranked by the share
  // of the paste (by 4-grams) attributed to them.
  const rank = async (text, idx, U = window.PowerShellUnits) => {
    const pasted = (await split(text, U)).map(u => {
      const t = tokens(u.syntax);
      return { kind: u.kind, name: u.name, line: u.line, text: u.syntax, norm: t.join(' '), grams: grams(t), size: t.length };
    }).filter(u => u.size >= MIN_TOKENS);
    const total = pasted.reduce((n, u) => n + u.grams.size, 0) || 1;
    const files = new Map();
    const units = pasted.map(u => {
      let best = null;
      for (const f of idx.files.values()) for (const c of f.units) {
        const score = containment(u.grams, c.grams);
        if (!best || score > best.score || (score === best.score && c.name === u.name)) best = { path: f.path, name: c.name, kind: c.kind, line: c.line, score, identical: c.norm === u.norm };
      }
      const verdict = !best || best.score < WEAK ? 'new' : best.identical ? 'identical' : best.score >= STRONG ? 'version' : 'similar';
      if (verdict !== 'new') {
        const f = files.get(best.path) || { path: best.path, share: 0, identical: 0, version: 0, similar: 0, units: [] };
        f.share += u.grams.size * best.score / total; f[verdict]++; f.units.push(u);
        files.set(best.path, f);
      }
      return { kind: u.kind, name: u.name, line: u.line, text: u.text, verdict, match: verdict === 'new' ? null : best };
    });
    return { units, tokens: pasted.reduce((n, u) => n + u.size, 0),
      files: [...files.values()].map(f => ({ ...f, share: Math.round(f.share * 100) / 100,
        // The pasted text that went to this file, in paste order: what to
        // compare against it.
        text: f.units.map(u => u.text).join('\n\n') + '\n', units: f.units.map(u => u.name) }))
        .sort((a, b) => b.share - a.share) };
  };
  // Whether a paste is worth matching at all: a variable, a function or a
  // Verb-Noun command. The app asks before sending a page-wide paste here
  // with no file open, so prose and links still go to the Stage.
  const looksLike = text => /\$[\w{]|\bfunction\s+[\w-]+|\b[A-Z][a-z]+-[A-Z][A-Za-z]+\b/.test(String(text || ''));
  window.PowerShellMatch = { description: 'Which repository file pasted PowerShell belongs to: units scored by shared 4-token runs against an index of files, then grouped by file.', tokens, grams, containment, index, add, rank, looksLike, STRONG, WEAK };
})();
