// .gitattributes, resolved in the browser as git resolves it.
//
// A page cannot run `git check-attr`, so this is git's own rule, from attr.c,
// and node/test/git-attributes-kit.test.mjs holds it to git's answer for every
// tracked file in this checkout. What git does, and so what this does:
//
//   - Each line is a pattern and a list of attributes: `name` sets one,
//     `-name` unsets it, `name=value` gives it a value, and `!name` returns it
//     to unspecified. Blank lines and `#` lines are skipped.
//   - A file takes, for each attribute, the first assignment met walking from
//     the deepest .gitattributes to the root and from each file's last line
//     up, so a later line wins and a folder's file beats its parent's. Within
//     a line, a later attribute wins. `!name` counts as an assignment, which
//     is how a later line clears an earlier one.
//   - A pattern with no slash matches the file's name at any depth. Any other
//     pattern matches the path relative to its own file's folder, with a
//     leading slash dropped. `*` and `?` stop at a slash; `**` crosses folders
//     only as `**/` at the start, `/**` at the end, or `/**/` between, and is
//     `*` anywhere else.
//   - A trailing slash matches a folder, never a file, and a negative pattern
//     is ignored, so neither ever assigns anything here.
//   - `[attr]name ...` in the root file defines a macro, and `binary` is
//     built in as `-diff -merge -text`. A macro expands only when it is set.
//
// Values are true (set), false (unset) or a string; `word()` spells one as
// check-attr prints it. The input is the text of each .gitattributes by its
// folder, '' for the root, so the caller chooses how to fetch them.
(function () {
  const esc = (c) => c.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
  const CLASSES = { alpha: 'a-zA-Z', digit: '0-9', alnum: 'a-zA-Z0-9', upper: 'A-Z', lower: 'a-z',
                    xdigit: '0-9a-fA-F', space: '\\s', blank: ' \\t' };

  // A bracket expression from `[` at i: [regex text, index of the closing `]`],
  // or null when it never closes, in which case `[` is literal.
  function bracket(p, i) {
    let j = i + 1, out = '[';
    if (p[j] === '!' || p[j] === '^') { out += '^'; j++; }
    if (p[j] === ']') { out += '\\]'; j++; }
    for (; j < p.length; j++) {
      const c = p[j];
      if (c === ']') return [out + ']', j];
      if (c === '[' && p[j + 1] === ':') {
        const end = p.indexOf(':]', j + 2);
        const name = end > 0 ? p.slice(j + 2, end) : '';
        if (CLASSES[name]) { out += CLASSES[name]; j = end + 1; continue; }
      }
      if (c === '\\' && j + 1 < p.length) { out += '\\' + p[++j]; continue; }
      out += c === '-' ? '-' : esc(c);
    }
    return null;
  }

  function globSource(p) {
    let re = '';
    for (let i = 0; i < p.length; i++) {
      const c = p[i];
      if (c === '*') {
        let j = i;
        while (p[j] === '*') j++;
        const lone = j - i >= 2 && (i === 0 || p[i - 1] === '/') && (j === p.length || p[j] === '/');
        if (lone && j === p.length) { re += '.*'; i = j - 1; }
        else if (lone) { re += '(?:.*/)?'; i = j; }
        else { re += '[^/]*'; i = j - 1; }
      } else if (c === '?') re += '[^/]';
      else if (c === '[') {
        const b = bracket(p, i);
        if (b) { re += b[0]; i = b[1]; } else re += '\\[';
      } else if (c === '\\' && i + 1 < p.length) re += esc(p[++i]);
      else re += esc(c);
    }
    return re;
  }

  // A C-style quoted pattern, as git writes a path with spaces or controls.
  function unquote(s) {
    let out = '', i = 1;
    const ESC = { n: '\n', t: '\t', r: '\r', a: '\x07', b: '\b', f: '\f', v: '\v', '"': '"', '\\': '\\' };
    for (; i < s.length && s[i] !== '"'; i++) {
      if (s[i] !== '\\') { out += s[i]; continue; }
      const n = s[++i];
      if (/[0-7]/.test(n)) { out += String.fromCharCode(parseInt(s.slice(i, i + 3), 8)); i += 2; }
      else out += ESC[n] ?? n;
    }
    return [out, s.slice(i + 1)];
  }

  function attrList(words) {
    return words.filter(Boolean).map(w =>
      w[0] === '-' ? [w.slice(1), false]
      : w[0] === '!' ? [w.slice(1), null]
      : w.includes('=') ? [w.slice(0, w.indexOf('=')), w.slice(w.indexOf('=') + 1)]
      : [w, true]);
  }

  // One file's lines, as rules: { dir, line, pattern, match(path), attrs }.
  function parse(text, dir = '') {
    const rules = [], macros = {};
    String(text || '').split(/\r?\n/).forEach((raw, n) => {
      const line = raw.replace(/^\s+/, '');
      if (!line || line[0] === '#') return;
      let pattern, rest;
      if (line[0] === '"') [pattern, rest] = unquote(line);
      else { const m = line.match(/^(\S+)\s*(.*)$/); [pattern, rest] = [m[1], m[2]]; }
      const attrs = attrList(rest.trim().split(/\s+/));
      if (pattern.startsWith('[attr]')) { if (!dir) macros[pattern.slice(6)] = attrs; return; }
      if (pattern[0] === '!' || pattern.endsWith('/')) return;
      const noDir = !pattern.includes('/');
      const re = new RegExp('^' + globSource(noDir ? pattern : pattern.replace(/^\//, '')) + '$');
      const base = dir ? dir + '/' : '';
      const match = noDir
        ? (path) => re.test(path.slice(path.lastIndexOf('/') + 1))
        : (path) => path.startsWith(base) && re.test(path.slice(base.length));
      rules.push({ dir, line: n + 1, pattern, match, attrs });
    });
    return { rules, macros };
  }

  // The resolver for one tree: files is { '<folder>': text }.
  function compile(files) {
    const parsed = Object.entries(files || {})
      .sort(([a], [b]) => a.split('/').filter(Boolean).length - b.split('/').filter(Boolean).length || a.localeCompare(b))
      .map(([dir, text]) => parse(text, dir));
    const macros = { binary: attrList(['-diff', '-merge', '-text']), ...(parsed.find(p => !p.rules[0]?.dir)?.macros || {}) };
    const rules = parsed.flatMap(p => p.rules);

    // Each specified attribute with the rule that assigned it.
    function explain(path) {
      const dirs = path.split('/').slice(0, -1).map((_, i, a) => a.slice(0, i + 1).join('/'));
      const applies = (r) => !r.dir || dirs.includes(r.dir);
      const got = new Map();
      const fill = (attrs, rule) => {
        for (let i = attrs.length - 1; i >= 0; i--) {
          const [name, value] = attrs[i];
          if (got.has(name)) continue;
          got.set(name, { value, rule });
          if (value === true && macros[name]) fill(macros[name], rule);
        }
      };
      for (let i = rules.length - 1; i >= 0; i--) if (applies(rules[i]) && rules[i].match(path)) fill(rules[i].attrs, rules[i]);
      return Object.fromEntries([...got].filter(([, a]) => a.value !== null));
    }
    const of = (path) => Object.fromEntries(Object.entries(explain(path)).map(([k, a]) => [k, a.value]));
    return { rules, explain, of };
  }

  const word = (v) => v === true ? 'set' : v === false ? 'unset' : v == null ? 'unspecified' : String(v);

  window.GitAttributes = { parse, compile, word };
})();
