// Parser-backed review units. Tree-sitter supplies statement boundaries; the
// rules below name complete statements without executing any PowerShell.
// Both the browser and node/test use this implementation. The inventory is a
// serializable stage: exact UTF-16 ranges, names and calls, not tree objects.
(() => {
  const RUNTIME = 'https://cdn.jsdelivr.net/npm/web-tree-sitter@0.25.10/';
  const GRAMMAR = 'https://cdn.jsdelivr.net/npm/tree-sitter-powershell@0.26.4/tree-sitter-powershell.wasm';
  let loading;
  const parser = () => loading || (loading = (async () => {
    const { Parser, Language } = await import(RUNTIME + 'tree-sitter.js');
    await Parser.init({ locateFile: file => RUNTIME + file });
    const p = new Parser(); p.setLanguage(await Language.load(GRAMMAR)); return p;
  })().catch(e => { loading = null; throw new Error('The PowerShell parser could not load: ' + e.message); }));
  const descendants = (node, type, topOnly = false) => {
    const out = [];
    const walk = n => {
      if (topOnly && n !== node && n.type === 'script_block_expression') return;
      if (n.type === type) out.push(n);
      for (const c of n.namedChildren) walk(c);
    };
    walk(node); return out;
  };
  // ── Edges, read without the grammar ───────────────────────────────────
  // tree-sitter-powershell 0.26.4 fails on everyday Windows PowerShell
  // syntax: comma-separated command arguments (`Add-Type -AssemblyName A, B`),
  // `2 * 1KB`, `Select-Object *, @{...}`, `.InvokeAsync{ }`. Measured on
  // home's wps corpus on 2026-10-13, that locked 29 of 69 files, with two of
  // the three pending changes in ExcelXml.ps1 among them. A selective update
  // only cuts text at unit edges, so what it needs is that each edge sits at
  // top level: outside every string, comment and here-string, at bracket
  // depth zero, and not after a line continuation. This scanner finds those
  // offsets on its own. A statement the grammar could not fully read is
  // selectable when both of its edges pass; a malformed region, whose
  // brackets or strings never close, still fails.
  const SQ = '\'‘’‚‛', DQ = '"“”„';
  const edges = text => {
    const n = text.length, ok = new Uint8Array(n + 1);
    // Open brackets, and for each $( ) opened inside a double-quoted string
    // the bracket depth it opened at, so its close resumes that string.
    const brackets = [], frames = [];
    const pairs = { ')': '(', '}': '{', ']': '[' };
    let i = 0, broken = false;
    const tokenStart = k => k === 0 || /[\s;|&(){}[\],=]/.test(text[k - 1]);
    // A double-quoted body from k: where it ends (after the closing quote),
    // or where a $( ) opens inside it, which the main loop then reads as code.
    const doubleBody = k => {
      for (; k < n; k++) {
        const c = text[k];
        if (c === '`') { k++; continue; }
        if (DQ.includes(c)) { if (DQ.includes(text[k + 1] || '')) { k++; continue; } return k + 1; }
        if (c === '$' && text[k + 1] === '(') { frames.push(brackets.length); brackets.push('('); return k + 2; }
      }
      broken = true; return n;
    };
    const skipTo = (close, from, after = close.length) => {
      const k = text.indexOf(close, from);
      if (k < 0) { broken = true; return n; }
      return k + after;
    };
    while (i <= n) {
      if (!frames.length && !brackets.length && !broken) ok[i] = 1;
      if (i === n) break;
      const c = text[i], next = text[i + 1] || '';
      if (c === '`') i += 2;
      else if (c === '<' && next === '#') i = skipTo('#>', i + 2);
      else if (c === '#' && tokenStart(i)) { const k = text.indexOf('\n', i); i = k < 0 ? n : k; }
      // A here-string closes only at the start of a line.
      else if (c === '@' && (next === '\'' || next === '"') && /^[ \t]*\r?\n/.test(text.slice(i + 2, i + 40))) i = skipTo('\n' + next + '@', i + 2);
      else if (SQ.includes(c)) {
        let k = i + 1;
        for (; k < n; k++) if (SQ.includes(text[k])) { if (SQ.includes(text[k + 1] || '')) k++; else break; }
        if (k >= n) broken = true;
        i = Math.min(k + 1, n);
      }
      else if (DQ.includes(c)) i = doubleBody(i + 1);
      else if (c === '$' && next === '{') i = skipTo('}', i + 2);
      else if ('({['.includes(c)) { brackets.push(c); i++; }
      else if (')}]'.includes(c)) {
        if (brackets.at(-1) !== pairs[c]) { broken = true; i++; continue; }
        brackets.pop();
        if (c === ')' && frames.at(-1) === brackets.length) { frames.pop(); i = doubleBody(i + 1); }
        else i++;
      }
      else i++;
    }
    // An edge after a trailing pipe, comma or backtick is inside a statement
    // that continues on the next line. And an edge has a space, a semicolon
    // or the file's end on one side: the grammar's error recovery can end a
    // statement mid-word (measured: `function Show-|Tree`), and depth alone
    // would pass that.
    for (let k = 1; k <= n; k++) if (ok[k]) {
      if (k < n && !/[\s;]/.test(text[k - 1]) && !/[\s;]/.test(text[k])) { ok[k] = 0; continue; }
      let j = k - 1;
      while (j >= 0 && /\s/.test(text[j])) j--;
      if (j >= 0 && '|,`'.includes(text[j])) ok[k] = 0;
    }
    return ok;
  };
  const unquote = s => s.replace(/^(['"])(.*)\1$/, '$2');
  const label = node => {
    if (node.type === 'function_statement') return { kind: /^filter\b/i.test(node.text) ? 'Filter' : 'Function', name: node.namedChildren.find(n => n.type === 'function_name')?.text };
    if (['class_statement', 'enum_statement'].includes(node.type)) return { kind: node.type === 'class_statement' ? 'Class' : 'Enum', name: node.text.match(/^\w+\s+([^\s:{]+)/)?.[1] };
    if (node.type !== 'pipeline') return null;
    const commands = descendants(node, 'command', true);
    const member = commands.find(c => c.namedChildren.find(n => n.type === 'command_name')?.text.toLowerCase() === 'add-member');
    if (member && descendants(member, 'script_block_expression').length) {
      const args = member.namedChildren.find(n => n.type === 'command_elements')?.namedChildren.filter(n => n.type !== 'command_argument_sep') || [];
      const value = key => args[args.findIndex(n => n.text.toLowerCase() === key) + 1]?.text;
      if (/^scriptmethod$/i.test(unquote(value('-membertype') || '')) && value('-name'))
        return { kind: 'ScriptMethod', name: node.text.slice(0, node.text.indexOf('|')).trim() + '.' + unquote(value('-name')) };
    }
    const assignment = node.namedChildren.find(n => n.type === 'assignment_expression');
    if (assignment && descendants(assignment, 'script_block_expression').length)
      return { kind: 'Scriptblock', name: assignment.namedChildren[0].text };
    const event = descendants(node, 'invokation_expression', true).find(n => /^(?:On|add_\w+)$/i.test(n.namedChildren.find(c => c.type === 'member_name')?.text || ''));
    if (event && descendants(event, 'script_block_expression').length) {
      const head = event.text.slice(0, event.text.indexOf('('));
      const args = event.text.match(/\(\s*(['"])(.*?)\1\s*,\s*(['"])(.*?)\3/);
      return { kind: 'Event', name: head + (args ? '(' + args[2] + ', ' + args[4] + ')' : '') };
    }
    return null;
  };
  const inventory = async (text, options = {}) => {
    if (typeof text !== 'string' || text.length > 2_000_000) throw new Error('Selective review supports text files up to two million characters.');
    const p = options.parser || await parser();
    let tree = p.parse(text);
    try {
      // This grammar reports an error for an empty/comment-only program.
      // A sentinel is accepted only when it proves there are no statements;
      // it must never repair an incomplete real statement.
      if (tree?.rootNode.hasError) {
        const probe = p.parse(text + '\n;');
        const roots = probe.rootNode.namedChildren.flatMap(n => n.type === 'statement_list' ? n.namedChildren : [n]);
        if (!probe.rootNode.hasError && roots.every(n => ['comment', 'empty_statement'].includes(n.type))) { tree.delete(); tree = probe; }
        else probe.delete();
      }
      if (!tree || (tree.rootNode.hasError && !options.tolerant)) {
        const errors = tree ? descendants(tree.rootNode, 'ERROR') : [];
        throw new Error('The parser could not read this file reliably' + (errors[0] ? ' near line ' + (errors[0].startPosition.row + 1) : '') + '. Use the whole-file view.');
      }
      const statements = tree.rootNode.namedChildren.flatMap(n => n.type === 'statement_list' ? n.namedChildren : [n])
        .filter(n => !['comment', 'empty_statement'].includes(n.type));
      const unlocated = tree.rootNode.hasError && !statements.some(n => n.hasError);
      const units = []; let start = 0;
      for (const node of statements) {
        const named = label(node);
        const end = node.endIndex;
        const content = text.slice(start, end);
        // Repeated names are not stable identities; compare() keeps those
        // statements in an explicit residual group instead of conflating them.
        units.push({ kind: named?.kind || 'Other', name: named?.name || 'Other changes',
          key: named?.name ? named.kind.toLowerCase() + ':' + named.name.toLowerCase() : 'text:' + node.text,
          start, end, line: node.startPosition.row + 1, text: content,
          rough: node.hasError || unlocated, syntax: node.text,
          calls: descendants(node, 'command_name').map(n => n.text.toLowerCase()) });
        start = end;
      }
      if (units.length) { units.at(-1).end = text.length; units.at(-1).text += text.slice(start); }
      else if (text) units.push({ kind: 'Other', name: 'Other changes', key: 'text:' + text, start: 0, end: text.length, line: 1, text, rough: false, calls: [] });
      // `rough`: the grammar could not read all of it. `blocked`: nor can
      // its edges be confirmed, so it is never replaced on its own.
      const ok = edges(text);
      for (const u of units) u.blocked = !!u.rough && !(ok[u.start] && ok[u.end]);
      return { parser: 'tree-sitter-powershell@0.26.4', units };
    } finally { tree?.delete(); }
  };
  const compare = async (before, after, options = {}) => {
    const a = (await inventory(before, options)).units, b = (await inventory(after, options)).units;
    if (a.length * b.length > 1_000_000) throw new Error('Too many statements for selective review. Use the whole-file view.');
    // Line endings, spaces at line ends, and blank lines at a block's edges,
    // where appending a function moves the file's last newline.
    const blank = t => t.replace(/\r\n?/g, '\n').replace(/[ \t]+$/gm, '').replace(/^\n+|\n+$/g, '');
    const counts = list => list.reduce((m, u) => m.set(u.key, (m.get(u.key) || 0) + 1), new Map());
    const ac = counts(a), bc = counts(b);
    const same = (x, y) => x.key === y.key && (x.kind === 'Other' || ((ac.get(x.key) || 0) <= 1 && (bc.get(y.key) || 0) <= 1));
    const lengths = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1));
    for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--)
      lengths[i][j] = same(a[i], b[j]) ? lengths[i + 1][j + 1] + 1 : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
    const units = []; let i = 0, j = 0, unchanged = 0;
    const add = (aa, bb, atA, atB) => {
      const left = aa.map(u => u.text).join(''), right = bb.map(u => u.text).join('');
      if (left === right) { unchanged += aa.filter(u => u.kind !== 'Other').length; return; }
      const named = aa.length <= 1 && bb.length <= 1 ? bb[0] || aa[0] : null;
      units.push({ id: 'change-' + units.length, kind: named?.kind || 'Other', name: named?.name || 'Other changes',
        action: !left ? 'Add' : !right ? 'Remove' : 'Replace', before: left, after: right,
        // Whitespace only: what a paste changes, and what the outpost
        // already reads as a match.
        formatOnly: blank(left) === blank(right),
        start: atA, end: atA + left.length, afterStart: atB, afterEnd: atB + right.length,
        line: (bb[0] || aa[0])?.line || 1, calls: bb.flatMap(u => u.calls),
        defines: bb.filter(u => ['Function', 'Filter'].includes(u.kind)).map(u => u.name.toLowerCase()), requires: [],
        blocked: [...aa, ...bb].some(u => u.blocked), rough: [...aa, ...bb].some(u => u.rough) });
    };
    while (i < a.length || j < b.length) {
      if (i < a.length && j < b.length && same(a[i], b[j])) { add([a[i]], [b[j]], a[i].start, b[j].start); i++; j++; continue; }
      const ai = i, bj = j;
      while ((i < a.length || j < b.length) && !(i < a.length && j < b.length && same(a[i], b[j]))) {
        if (j < b.length && (i === a.length || lengths[i][j + 1] > lengths[i + 1][j])) j++; else i++;
      }
      if (i === ai) for (let k = bj; k < j; k++) add([], [b[k]], a[ai]?.start ?? before.length, b[k].start);
      else if (j === bj) for (let k = ai; k < i; k++) add([a[k]], [], a[k].start, b[bj]?.start ?? after.length);
      else add(a.slice(ai, i), b.slice(bj, j), a[ai].start, b[bj].start);
    }
    // Conservative direct-call dependencies. Dynamic invocation, variables and
    // side effects still need review; a parse is never a runtime proof.
    for (const u of units) u.requires = units.filter(v => v !== u && !v.formatOnly && v.defines.some(name => u.calls.includes(name))).map(v => v.id);
    const result = { schema: 1, parser: 'tree-sitter-powershell@0.26.4', before, after, units, unchanged,
      unresolved: a.filter(u => u.blocked).map(u => u.syntax), warnings: b.filter(u => u.blocked).map(u => ({ name: u.name, line: u.line })) };
    if (apply(result, units.map(u => u.id)) !== after) throw new Error('The review units did not cover the complete change.');
    return result;
  };
  const expand = (review, selected) => {
    const ids = new Set(selected), byId = new Map(review.units.map(u => [u.id, u]));
    const visit = id => { const u = byId.get(id); if (!u) throw new Error('Unknown change selected.'); for (const dep of u.requires) if (!ids.has(dep)) { ids.add(dep); visit(dep); } };
    for (const id of [...ids]) visit(id);
    return [...ids];
  };
  const apply = (review, selected, supplied = review.before) => {
    if (supplied !== review.before) throw new Error('The work copy changed. Review it again before preparing an update.');
    const ids = new Set(expand(review, selected));
    let out = '', cursor = 0;
    for (const u of review.units) if (ids.has(u.id)) {
      if (u.start < cursor) throw new Error('Overlapping review units.');
      out += supplied.slice(cursor, u.start) + u.after; cursor = u.end;
    }
    return out + supplied.slice(cursor);
  };
  const prepare = async (review, selected, options = {}) => {
    if (!selected.length) throw new Error('Choose at least one change.');
    const ids = expand(review, selected);
    if (review.units.some(u => ids.includes(u.id) && u.blocked)) throw new Error('This selection includes a region the parser could not read reliably. Use whole-file review for that region.');
    const text = apply(review, ids);
    const parsed = await inventory(text, options);
    if (parsed.units.some(u => u.blocked && !review.unresolved.includes(u.syntax))) throw new Error('This selection introduces a new parser problem. Review the related changes together.');
    // Both versions close every bracket and string, so the assembly must too.
    if (edges(review.before)[review.before.length] && edges(review.after)[review.after.length] && !edges(text)[text.length])
      throw new Error('This selection leaves a bracket or string open. Review the related changes together.');
    const names = parsed.units.filter(u => u.kind !== 'Other').map(u => u.key);
    if (new Set(names).size !== names.length) throw new Error('This selection leaves repeated names. Review the related additions and removals together.');
    return { text, ids };
  };
  // Which version a supplied copy holds, named block by named block: the
  // copy against GitHub now and, when it is known, against the version the
  // work computer last held (`earlier`). Names are compare()'s own, so the
  // two read in the same terms. Text compares with line endings and trailing
  // spaces normalized, since a paste changes those. Each row's status is
  // the adopter's reading:
  //   same     the copy has GitHub's text (and GitHub has not changed it)
  //   updated  the copy has GitHub's text where GitHub changed it
  //   behind   the copy has the earlier text where GitHub changed it
  //   removed  GitHub removed it; the copy still has the earlier text
  //   new      GitHub added it; the copy lacks it
  //   missing  the copy lacks it, and it is not new on GitHub
  //   local    the copy differs from both GitHub and the earlier version
  //   differs  the copy differs from GitHub (no earlier version known)
  //   extra    only the copy has it
  // `outside` is the same reading for the text outside every named block.
  const versions = async ({ copy, github, earlier = null }, options = {}) => {
    const opt = { ...options, tolerant: true };
    const [c, g, e] = await Promise.all([inventory(copy, opt), inventory(github, opt), earlier == null ? null : inventory(earlier, opt)]);
    const norm = s => s.replace(/\r\n?/g, '\n').replace(/[ \t]+$/gm, '').trim();
    const named = inv => {
      const m = new Map();
      for (const u of inv.units) if (u.kind !== 'Other') m.set(u.key, [...(m.get(u.key) || []), u]);
      return m;
    };
    const body = list => list ? norm(list.map(u => u.syntax).join('\n')) : null;
    const status = (C, G, E, known) => {
      if (C !== null && C === G) return known && E !== G ? 'updated' : 'same';
      if (C === null) return known && E === null ? 'new' : 'missing';
      if (known && C === E) return G === null ? 'removed' : 'behind';
      if (G === null && (!known || E === null)) return 'extra';
      return known ? 'local' : 'differs';
    };
    const mc = named(c), mg = named(g), me = e ? named(e) : null, known = !!me;
    const rows = [];
    for (const key of new Set([...mg.keys(), ...mc.keys(), ...(me ? me.keys() : [])])) {
      const cu = mc.get(key), gu = mg.get(key), eu = me?.get(key);
      const C = body(cu), G = body(gu), E = known ? body(eu) : null;
      // Only the earlier version had it, and both dropped it: nothing to say.
      if (C === null && G === null) continue;
      const first = (cu || gu || eu)[0];
      rows.push({ key, kind: first.kind, name: first.name, line: first.line, status: status(C, G, E, known),
        inCopy: C !== null, inGithub: G !== null, inEarlier: known ? E !== null : null });
    }
    const outsideOf = inv => inv ? norm(inv.units.filter(u => u.kind === 'Other').map(u => u.syntax).join('\n')) : null;
    const [oc, og, oe] = [outsideOf(c), outsideOf(g), outsideOf(e)];
    const outside = oc === og && (!known || oe === og) ? 'same' : status(oc || null, og || null, known ? oe || null : null, known);
    const present = [...mg.keys()].filter(k => mc.has(k)).length;
    return { schema: 1, rows, outside, present, total: mg.size, copyNamed: mc.size,
      // A paste of a few blocks rather than the file: it says which version
      // those blocks are, and nothing about the rest.
      fragment: mg.size >= 3 && present * 2 < mg.size };
  };
  window.PowerShellUnits = { description: 'Parser-backed PowerShell statement inventories, complete change coverage, selective update assembly that preserves unchecked work-copy text, and a block-by-block reading of which version a supplied copy holds.', inventory, compare, expand, apply, prepare, versions, edges };
})();
