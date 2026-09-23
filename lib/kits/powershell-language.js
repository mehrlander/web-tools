// Browser-only, heuristic PowerShell and XAML inspection for the code workspace.
// No execution, AST, language server, or claim that an empty diagnostics list
// proves validity. String/comment masking keeps examples out of the outline.
// Consumers render these plain data records, never source-derived HTML.
(() => {
  const DESCRIPTION = 'Heuristic PowerShell symbols, explicit WPF references, XAML controls and resources, and selected Windows PowerShell 5.1 compatibility observations. Does not execute or validate code.';
  const lineReader = text => {
    const starts = [0];
    for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1);
    return index => {
      let lo = 0, hi = starts.length;
      while (lo < hi) { const mid = (lo + hi) >>> 1; if (starts[mid] <= index) lo = mid + 1; else hi = mid; }
      return lo;
    };
  };

  function lex(text) {
    const chars = text.split(''), strings = [], comments = [], diagnostics = [];
    const lineAt = lineReader(text);
    const hide = (start, end) => { for (let p = start; p < end; p++) if (!/[\r\n]/.test(chars[p])) chars[p] = ' '; };
    const quoteType = ch => /['\u2018\u2019]/.test(ch || '') ? 'single' : /["\u201c\u201d]/.test(ch || '') ? 'double' : '';
    let i = 0;
    while (i < text.length) {
      const start = i;
      if (text[i] === '`') { hide(i, Math.min(i + 2, text.length)); i += 2; continue; }
      if (text.startsWith('<#', i)) {
        let depth = 1; i += 2;
        while (i < text.length && depth) {
          if (text.startsWith('<#', i)) { depth++; i += 2; }
          else if (text.startsWith('#>', i)) { depth--; i += 2; }
          else i++;
        }
        if (depth) diagnostics.push({ line: lineAt(start), severity: 'warning', rule: 'unclosed-comment', message: 'Block comment has no closing #>.' });
        comments.push({ start, end: i, block: true }); hide(start, i); continue;
      }
      if (text[i] === '#') {
        while (i < text.length && text[i] !== '\n') i++;
        comments.push({ start, end: i, block: false }); hide(start, i); continue;
      }
      const here = text[i] === '@' && /['"]/.test(text[i + 1] || '') && /^[ \t]*\r?\n/.test(text.slice(i + 2));
      const kind = quoteType(text[here ? i + 1 : i]);
      if (!kind) { i++; continue; }
      const quote = text[here ? i + 1 : i];
      i += here ? 2 : 1;
      const contentStart = i;
      let closed = false, contentEnd = text.length;
      while (i < text.length) {
        if (here) {
          if ((i === 0 || text[i - 1] === '\n') && text.startsWith(quote + '@', i)) {
            contentEnd = i; i += 2; closed = true; break;
          }
          i++; continue;
        }
        if (kind === 'double' && text[i] === '`') { i += Math.min(2, text.length - i); continue; }
        if (quoteType(text[i]) === kind) {
          if (kind === 'single' && quoteType(text[i + 1]) === kind) { i += 2; continue; }
          contentEnd = i; i++; closed = true; break;
        }
        i++;
      }
      const raw = text.slice(contentStart, contentEnd);
      const literal = closed && !here && (kind === 'single' || !/[$`]/.test(raw));
      strings.push({ start, end: i, value: kind === 'single' ? raw.replace(/['\u2018\u2019]{2}/g, "'") : raw, literal, here });
      if (!closed) diagnostics.push({ line: lineAt(start), severity: 'warning', rule: 'unclosed-string', message: here ? 'Here-string has no closing marker at the beginning of a line.' : 'Quoted string has no closing quote.' });
      hide(start, i);
    }
    return { code: chars.join(''), strings, comments, diagnostics, lineAt };
  }

  function closeDelimiter(code, start) {
    const pairs = { '(': ')', '[': ']', '{': '}' }, stack = [pairs[code[start]]];
    if (!stack[0]) return -1;
    for (let i = start + 1; i < code.length; i++) {
      if (pairs[code[i]]) stack.push(pairs[code[i]]);
      else if (code[i] === stack[stack.length - 1]) { stack.pop(); if (!stack.length) return i; }
    }
    return -1;
  }
  function afterSpace(code, index) { while (index < code.length && /\s/.test(code[index])) index++; return index; }

  function parameters(text, code, start, lineAt, owner) {
    const end = closeDelimiter(code, start);
    if (end < 0) return [];
    const chunks = [];
    let from = start + 1;
    for (let i = from; i < end; i++) {
      if ('([{'.includes(code[i])) { const to = closeDelimiter(code, i); if (to < 0) break; i = to; }
      else if (code[i] === ',') { chunks.push([from, i]); from = i + 1; }
    }
    chunks.push([from, end]);
    return chunks.flatMap(([lo, hi]) => {
      let cursor = afterSpace(code, lo), type = '';
      while (code[cursor] === '[') {
        const to = closeDelimiter(code, cursor);
        if (to < 0 || to > hi) return [];
        const candidate = code.slice(cursor + 1, to).trim();
        if (/^[\w.\[\],\s]+$/.test(candidate) && !/^(?:Parameter|Alias|Validate\w+|Allow\w+|Argument\w+)$/i.test(candidate)) type = candidate;
        cursor = afterSpace(code, to + 1);
      }
      const variable = /^\$([\w]+)\b/.exec(code.slice(cursor, hi));
      if (!variable) return [];
      const rest = text.slice(cursor + variable[0].length, hi).trim();
      const defaultValue = rest.startsWith('=') ? rest.slice(1).trim() : '';
      return [{ name: '$' + variable[1], kind: 'parameter', line: lineAt(cursor), detail: [type && '[' + type + ']', owner, defaultValue && '= ' + defaultValue].filter(Boolean).join(' · ') }];
    });
  }

  // A ternary is a bare ? between operands with a later bare : on the same line.
  // Where-Object's ? alias follows a pipe or opens a statement and takes a
  // { block }; scope and drive colons ($script:x, C:\) touch a word on the left.
  function ternaries(code) {
    const found = [];
    for (const line of code.matchAll(/[^\r\n]+/g)) {
      for (const match of line[0].matchAll(/(?<=\S[ \t]+)\?(?=[ \t])/g)) {
        const before = line[0].slice(0, match.index).trimEnd(), rest = line[0].slice(match.index + 1);
        if (!before || /[|{;(=,]$/.test(before) || /^[ \t]*\{/.test(rest) || !/\s:(?=\s|$)/.test(rest)) continue;
        found.push({ index: line.index + match.index });
      }
    }
    return found;
  }

  function inspectPowerShell(text) {
    const { code, strings, comments, diagnostics, lineAt } = lex(text);
    const symbols = [], references = [], controls = [], resources = [];
    const stringAt = new Map(strings.map(s => [s.start, s]));
    const argumentAt = start => {
      // Use original whitespace: the mask also blanks quoted arguments.
      const index = afterSpace(text, start), quoted = stringAt.get(index);
      if (quoted) return { name: quoted.value, literal: quoted.literal, end: quoted.end };
      const match = /^[^\s;|(){}]+/.exec(code.slice(index));
      return match ? { name: text.slice(index, index + match[0].length), literal: !/[$`]/.test(match[0]), end: index + match[0].length } : null;
    };
    const seenParams = new Set();
    const declarations = /(?:^|[;{}\r\n])\s*(function|filter|workflow|class|enum)\s+((?:(?:global|script|local|private):)?[\w-]+)/gi;
    for (const match of code.matchAll(declarations)) {
      const nameIndex = match.index + match[0].lastIndexOf(match[2]);
      const kind = match[1].toLowerCase(), symbol = { name: match[2], kind, line: lineAt(nameIndex), detail: '' };
      symbols.push(symbol);
      if (!['function', 'filter', 'workflow'].includes(kind)) continue;
      let cursor = afterSpace(code, nameIndex + match[2].length);
      if (code[cursor] !== '(') {
        if (code[cursor] !== '{') continue;
        cursor = afterSpace(code, cursor + 1);
        while (code[cursor] === '[') {
          const to = closeDelimiter(code, cursor); if (to < 0) break;
          cursor = afterSpace(code, to + 1);
        }
        const param = /^param\s*\(/i.exec(code.slice(cursor));
        if (!param) continue;
        cursor += param[0].lastIndexOf('(');
      }
      const params = parameters(text, code, cursor, lineAt, symbol.name);
      seenParams.add(cursor); symbol.detail = params.map(p => p.name).join(', '); symbols.push(...params);
    }
    // The script's own param block must precede executable statements. Comment
    // help and #requires are already masked; leading binding attributes are skipped.
    let top = afterSpace(code, 0);
    while (code[top] === '[') { const end = closeDelimiter(code, top); if (end < 0) break; top = afterSpace(code, end + 1); }
    const topParam = /^param\s*\(/i.exec(code.slice(top));
    if (topParam) { const at = top + topParam[0].lastIndexOf('('); if (!seenParams.has(at)) symbols.push(...parameters(text, code, at, lineAt, 'script')); }

    for (const match of code.matchAll(/(?:^|[;{}\r\n])[ \t]*\.[ \t]+/g)) {
      const start = match.index + match[0].lastIndexOf('.') + 1, arg = argumentAt(start);
      if (arg) references.push({ name: arg.name, kind: 'dot-source', line: lineAt(start), detail: 'Path expression; not resolved in the browser' });
    }
    for (const match of code.matchAll(/(?:^|[;|{}\r\n])\s*(Import-Module|using\s+module|Add-Type)\b/gi)) {
      const command = match[1].toLowerCase();
      let start = match.index + match[0].length;
      const option = /^[ \t]+-(Name|AssemblyName)\b/i.exec(code.slice(start));
      if (option) start += option[0].length;
      if (command === 'add-type' && option?.[1].toLowerCase() !== 'assemblyname') continue;
      const arg = argumentAt(start);
      if (arg && !arg.name.startsWith('-')) references.push({ name: arg.name, kind: command === 'add-type' ? 'assembly' : 'module', line: lineAt(match.index + match[0].indexOf(match[1])), detail: arg.literal ? 'Declared reference' : 'Expression; not resolved in the browser' });
    }
    for (const match of code.matchAll(/\$([\w:]+)\s*\.\s*FindName\s*\(/gi)) {
      const arg = argumentAt(match.index + match[0].length);
      if (!arg?.literal || !/^[A-Za-z_][\w]*$/.test(arg.name) || code[afterSpace(code, arg.end)] !== ')') continue;
      const reference = { name: arg.name, kind: 'control', line: lineAt(match.index), detail: 'FindName lookup' };
      references.push(reference);
    }
    for (const match of code.matchAll(/\$([\w]+)\s*\.\s*add_([\w]+)\s*\(/gi)) {
      // Variable binding and scope need runtime/AST knowledge; keep the receiver
      // variable rather than claiming that a similarly named control is wired.
      references.push({ name: '$' + match[1], kind: 'event', line: lineAt(match.index), detail: match[2] });
    }

    const compatibility = (match, message, rule) => diagnostics.push({ line: lineAt(match.index), severity: 'warning', message, rule });
    // Selected features documented in Microsoft's PowerShell 7 announcement:
    // https://devblogs.microsoft.com/powershell/announcing-powershell-7-0/
    for (const match of code.matchAll(/&&|\|\|/g)) compatibility(match, 'Pipeline chain operators (&& and ||) require PowerShell 7 or later; Windows PowerShell 5.1 cannot use them.', 'ps51-pipeline-chain');
    // Any ?? standing alone between spaces: the masked code holds no literal or
    // comment, and an unquoted wildcard such as ??.txt touches its neighbour.
    for (const match of code.matchAll(/(?<=\s)\?\?(=?)(?=\s|$)/gm)) compatibility(match, match[1] ? 'The null-coalescing assignment operator (??=) requires PowerShell 7 or later.' : 'The null-coalescing operator (??) requires PowerShell 7 or later.', match[1] ? 'ps51-null-coalescing-assignment' : 'ps51-null-coalescing');
    for (const match of ternaries(code)) compatibility(match, 'The ternary operator (? :) requires PowerShell 7 or later; Windows PowerShell 5.1 needs if and else.', 'ps51-ternary');
    for (const match of code.matchAll(/(?:^|[;|{}\r\n])\s*ForEach-Object\s+-Parallel\b/gi)) compatibility(match, 'ForEach-Object -Parallel requires PowerShell 7 or later.', 'ps51-parallel');
    for (const comment of comments.filter(c => !c.block)) {
      const value = text.slice(comment.start, comment.end);
      const version = /^#requires\s+-Version\s+(\d+(?:\.\d+)*)\b/i.exec(value);
      const [major, minor = 0] = version ? version[1].split('.').map(Number) : [0];
      if (major > 5 || (major === 5 && minor > 1)) diagnostics.push({ line: lineAt(comment.start), severity: 'warning', rule: 'ps51-requires', message: '#requires declares PowerShell ' + version[1] + ', above the Windows PowerShell 5.1 target.' });
    }
    return { language: 'powershell', heuristic: true, symbols: symbols.sort((a, b) => a.line - b.line), diagnostics: diagnostics.sort((a, b) => a.line - b.line), controls, resources, references: references.sort((a, b) => a.line - b.line) };
  }

  function inspectXaml(text) {
    const lineAt = lineReader(text), controls = [], resources = [], references = [], symbols = [], diagnostics = [];
    const eventNames = new Set(['Click', 'Checked', 'Unchecked', 'SelectionChanged', 'TextChanged', 'KeyDown', 'KeyUp', 'Loaded', 'Unloaded', 'Closing', 'Closed', 'MouseDoubleClick', 'MouseDown', 'MouseUp', 'GotFocus', 'LostFocus', 'ValueChanged']);
    // Read complete tags, respecting quotes, and skip comments, CDATA, and PIs.
    // No DOMParser is needed and no external entities or markup are evaluated.
    let i = 0;
    while ((i = text.indexOf('<', i)) !== -1) {
      if (text.startsWith('<!--', i) || text.startsWith('<![CDATA[', i) || text.startsWith('<?', i)) {
        const closer = text.startsWith('<!--', i) ? '-->' : text.startsWith('<?', i) ? '?>' : ']]>';
        const end = text.indexOf(closer, i + 2); i = end < 0 ? text.length : end + closer.length; continue;
      }
      const start = i, tag = /^<([A-Za-z_][\w.:-]*)\b/.exec(text.slice(i));
      let quote = ''; i++;
      while (i < text.length) {
        if (quote) { if (text[i] === quote) quote = ''; }
        else if (text[i] === '"' || text[i] === "'") quote = text[i];
        else if (text[i] === '>') break;
        i++;
      }
      if (!tag) { i++; continue; }
      const attrs = [], offset = start + tag[0].length;
      for (const match of text.slice(offset, i).matchAll(/([A-Za-z_][\w.:-]*)\s*=\s*("[^"]*"|'[^']*')/g)) attrs.push({ name: match[1], value: match[2].slice(1, -1), line: lineAt(offset + match.index) });
      const name = attrs.find(a => a.name === 'x:Name') || attrs.find(a => a.name === 'Name');
      const type = tag[1].split(':').pop();
      if (name) {
        controls.push({ name: name.value, type, line: name.line });
        symbols.push({ name: name.value, kind: 'control', line: name.line, detail: type });
      }
      for (const attr of attrs) {
        if (attr.name === 'x:Key') resources.push({ name: attr.value, kind: 'definition', line: attr.line });
        for (const match of (attr.value.startsWith('{}') ? '' : attr.value).matchAll(/\{(DynamicResource|StaticResource)\s+([^{}]+)\}/g)) {
          const key = match[2].replace(/^ResourceKey\s*=\s*/, '').trim();
          resources.push({ name: key, kind: match[1] === 'DynamicResource' ? 'dynamic' : 'static', line: attr.line });
        }
        if (eventNames.has(attr.name) && /^[\w]+$/.test(attr.value)) references.push({ name: attr.value, kind: 'handler', line: attr.line, detail: attr.name });
      }
      i++;
    }
    // The Outline lists each resource key once, at its first appearance, under
    // XAML's own term: a Theme.xaml reads as the keys it defines (x:Key) and a
    // form as the keys it draws on. Every occurrence stays in resources.
    const seen = new Map();
    for (const r of resources) {
      const id = r.kind + '\0' + r.name, first = seen.get(id);
      if (first) { first.uses++; continue; }
      seen.set(id, { uses: 1, symbol: { name: r.name, kind: r.kind === 'definition' ? 'x:Key' : r.kind === 'dynamic' ? 'DynamicResource' : 'StaticResource', line: r.line, detail: '' } });
    }
    for (const { uses, symbol } of seen.values()) { symbol.detail = uses > 1 ? uses + ' uses' : ''; symbols.push(symbol); }
    symbols.sort((a, b) => a.line - b.line);
    return { language: 'xaml', heuristic: true, symbols, diagnostics, controls, resources, references };
  }

  function inspect(source, path = 'script.ps1') {
    const text = String(source ?? '');
    return /\.(?:xaml|xml|ps1xml)$/i.test(path) ? inspectXaml(text) : inspectPowerShell(text);
  }
  function compareCompanions(script, xaml) {
    const ps = typeof script === 'string' ? inspectPowerShell(script) : script;
    const form = typeof xaml === 'string' ? inspectXaml(xaml) : xaml;
    const controlRefs = ps?.references?.filter(r => r.kind === 'control') || [], definitions = form?.controls || [];
    // WPF FindName is case-sensitive. Arbitrary similarly named variables do
    // not establish that a control was found or an event handler was connected.
    const names = new Set(definitions.map(c => c.name)), used = new Set(controlRefs.map(r => r.name));
    const matched = definitions.filter(c => used.has(c.name));
    const unreferenced = definitions.filter(c => !used.has(c.name));
    const missing = controlRefs.filter(r => !names.has(r.name));
    return { heuristic: true, matched, unreferenced, missing, diagnostics: missing.map(r => ({ line: r.line, severity: 'info', rule: 'companion-control', message: 'FindName references ' + r.name + ', which was not found among named controls in this companion. Check namescopes and dynamically added controls.' })) };
  }
  window.PowerShellLanguage = { description: DESCRIPTION, inspect, compareCompanions };
})();
