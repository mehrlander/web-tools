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
  const descendants = (node, type) => {
    const out = [];
    const walk = n => { if (n.type === type) out.push(n); for (const c of n.namedChildren) walk(c); };
    walk(node); return out;
  };
  const unquote = s => s.replace(/^(['"])(.*)\1$/, '$2');
  const label = node => {
    if (node.type === 'function_statement') return { kind: /^filter\b/i.test(node.text) ? 'Filter' : 'Function', name: node.namedChildren.find(n => n.type === 'function_name')?.text };
    if (['class_statement', 'enum_statement'].includes(node.type)) return { kind: node.type === 'class_statement' ? 'Class' : 'Enum', name: node.text.match(/^\w+\s+(\S+)/)?.[1] };
    if (node.type !== 'pipeline') return null;
    const commands = descendants(node, 'command');
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
    const event = descendants(node, 'invokation_expression').find(n => /^(?:On|add_\w+)$/i.test(n.namedChildren.find(c => c.type === 'member_name')?.text || ''));
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
          blocked: node.hasError || unlocated, syntax: node.text,
          calls: descendants(node, 'command_name').map(n => n.text.toLowerCase()) });
        start = end;
      }
      if (units.length) { units.at(-1).end = text.length; units.at(-1).text += text.slice(start); }
      else if (text) units.push({ kind: 'Other', name: 'Other changes', key: 'text:' + text, start: 0, end: text.length, line: 1, text, calls: [] });
      return { parser: 'tree-sitter-powershell@0.26.4', units };
    } finally { tree?.delete(); }
  };
  const compare = async (before, after, options = {}) => {
    const a = (await inventory(before, options)).units, b = (await inventory(after, options)).units;
    if (a.length * b.length > 1_000_000) throw new Error('Too many statements for selective review. Use the whole-file view.');
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
        formatOnly: left.replace(/\r\n?/g, '\n') === right.replace(/\r\n?/g, '\n'),
        start: atA, end: atA + left.length, afterStart: atB, afterEnd: atB + right.length,
        line: (bb[0] || aa[0])?.line || 1, calls: bb.flatMap(u => u.calls),
        defines: bb.filter(u => ['Function', 'Filter'].includes(u.kind)).map(u => u.name.toLowerCase()), requires: [],
        blocked: [...aa, ...bb].some(u => u.blocked) });
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
    const names = parsed.units.filter(u => u.kind !== 'Other').map(u => u.key);
    if (new Set(names).size !== names.length) throw new Error('This selection leaves repeated names. Review the related additions and removals together.');
    return { text, ids };
  };
  window.PowerShellUnits = { description: 'Parser-backed PowerShell statement inventories, complete change coverage and selective update assembly that preserves unchecked work-copy text.', inventory, compare, expand, apply, prepare };
})();
